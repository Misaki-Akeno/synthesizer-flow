# Synthesizer Flow 技术架构文档

本文档基于现有代码库事实，详细阐述 Synthesizer Flow 项目的系统架构、核心模块设计及内部交互机制。

## 1. 系统概览 (System Overview)

Synthesizer Flow 是一个模块化音频合成器应用，其核心架构采用了 **"双向状态同步"** 模式，将基于 Web Audio API 的即时音频合成能力与基于 Server-side 的 AI Agent 决策能力相结合。

系统主要由三个部分组成：
1.  **Frontend (Client)**: 负责 UI 渲染、用户交互、以及核心的音频信号处理 (Tone.js)。
2.  **Backend (Server)**: 基于 Next.js Server Actions，提供业务逻辑、数据库访问及 Agent 运行环境。
3.  **AI Agent**: 运行在服务端的智能体，维护一个虚拟的"影子状态"来感知和操作前端画布。

---

## 2. 前端架构详解 (Frontend Architecture Detail)

前端不仅是 UI 展示层，更是整个音频引擎的宿主。其核心挑战在于如何将 **声明式的 React UI** 与 **指令式的 Audio Context** 进行同步。

### 2.1 UI 交互逻辑 (Canvas & Interaction)

画布系统基于 `@xyflow/react` (React Flow) 构建，位于 `src/components/layout/workbench/Canvas.tsx`。

- **组件层级**:
  - `Canvas`: 顶层容器，处理 Context Menu 屏蔽。
  - `CanvasInner`: 承载 `ReactFlow` 实例，负责处理拖拽 (`onDrop`)、连接验证 (`isValidConnection`) 和项目加载逻辑。

- **交互流程**:
  1.  **模块添加**: 用户从侧边栏拖拽组件 -> `handleDrop` 计算坐标 -> 调用 Store `addNode`。
  2.  **连线验证**: `isValidConnection` 会实时检查源端口 (`sourceHandle`) 和目标端口 (`targetHandle`) 的类型兼容性（如 `Audio` 不能连 `Number`）。
  3.  **右键菜单**: 通过 `useFlowContextMenu` 钩子，统一管理节点、边和画布背景的 Context Menu 事件。

### 2.2 核心桥接器：ModuleManager (`src/core/services/ModuleManager.ts`)

`ModuleManager` 是连接 React 视图层与 Tone.js 音频层的单例控制器。它确保了"数据驱动视图，视图驱动音频"的单向流。

- **节点生命周期管理**:
  - **创建**: 当 Store 调用 `addNode` 时，`ModuleManager.createNode` 会同时做两件事：
    1.  生成 React Flow 所需的 JSON 数据（用于渲染 UI）。
    2.  调用 `createModuleInstance` 实例化对应的音频类（如 `OscillatorModule`），并将其挂载在 Node 的 `data.module` 属性上。
  - **销毁**: 节点删除时，`ModuleManager` 负责调用模块的 `dispose` 方法，清理 Tone.js 节点和 RxJS 订阅。

- **连接绑定 (Binding)**:
  - `bindModules(source, target)` 是音频图构建的核心。
  - 当 UI 上建立连线时，它会查找源模块和目标模块实例，并调用 `sourceModule.connectOutput(...)`，从而在底层建立 RxJS 流或 Tone.js 连接。

### 2.3 音频模块设计 (Audio Module Design)

音频模块系统采用 **类响应式架构**，基类定义在 `src/core/base/ModuleBase.ts`。

#### 2.3.1 端口与参数系统 (RxJS Core)
为了实现高性能的实时控制，模块内部广泛采用 **RxJS** 的 `BehaviorSubject`：

- **Ports (端口)**:
  - 每个输入/输出端口都是一个 `BehaviorSubject`。
  - **Input**: 订阅上游流，当上游数据变化时自动触发内部逻辑。
  - **Output**: 作为数据源，向下游广播变化。
  - **类型系统**:
    - `PortType.NUMBER`: 控制信号 (蓝色)，如 LFO 频率。
    - `PortType.AUDIO`: 音频信号 (绿色)，底层对应 Tone.js Node 连接。
    - `PortType.ARRAY`: 复杂数据 (紫色)，如 MIDI 及其 Velocity 数组，支持多重输入聚合。

- **Parameters (参数)**:
  - 模块参数（如频率、波形）也是 `BehaviorSubject`。
  - UI 组件直接订阅这些 Subject，实现无 React Render 开销的实时数值更新。

#### 2.3.2 音频实现模式 (Tone.js Integration)
以 `AdvancedOscillatorModule` (`src/core/modules/audio/AdvancedOscillatorModule.ts`) 为例：

- **复音管理 (Polyphony)**:
  - 内部维护一个 `Map<note, Voice>` 结构，支持动态声部分配。
  - 处理 `notes` (Array) 输入流，自动触发声部的 Attack/Release 包络。

- **信号流建立**:
  ```typescript
  // 伪代码示例
  initializeAudio() {
    this.output = new Tone.Gain();
    // 订阅参数变化，实时控制 Tone.js 属性
    this.parameters['frequency'].subscribe(freq => {
      this.oscillator.frequency.rampTo(freq, 0.1);
    });
  }
  ```
- **UI 渲染**: 模块通过 `uiOptions` 定义其在属性面板中的外观，支持 Group 分组、Slider 范围和 Log 对数刻度。

---

## 3. 后端与数据库 (Backend & Database)

后端主要依托 Next.js 的 Server Actions 和 API Routes，结合 Postgres 提供持久化服务。

### 3.1 核心技术栈
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: NextAuth.js
- **Vector Search**: pgvector

### 3.2 数据库模型 (`src/db/schema.ts`)
数据库设计涵盖了四个关键领域：

1.  **用户与鉴权**:
    - `users`, `accounts`, `sessions`: 标准 NextAuth 表结构，支持 OAuth 登录。

2.  **项目数据**:
    - `projects`: 存储画布的 JSON 快照 (`data` 字段)，支持完整的项目保存与恢复。
    - `users_to_projects`: 多对多关联表，管理用户对项目的访问权限。

3.  **RAG 知识库**:
    - `rag_documents`: 存储文本片段及其向量表示 (`embedding` 字段, 1536维)，使用 HNSW 索引加速检索。

4.  **Agent 状态持久化**:
    - `checkpoints`: 简单的对话历史快照。
    - `langgraph_checkpoints` & `langgraph_writes`: 复杂的 LangGraph 状态机持久化，支持 Agent 的长期记忆和状态恢复。

---

## 4. AI Agent 系统架构 (AI Agent System)

项目实现了一个高度定制的 **Server-side Agent**，其独特之处在于能够在服务端"盲操作"客户端的音频画布。

### 4.1 核心组件 (`src/agent`)

1.  **Agent 入口 (`Agent.ts`)**:
    - 基于 LangChain/LangGraph 构建。
    - 提供了 `sendMessage` 接口，支持带状态的对话。
    - 内置 **Human-in-the-Loop (HIL)** 机制：检测到 `unsafe_tools` 标签的操作时，会暂停执行并在返回结果中标记 `approvalRequired`，等待用户确认 (`threadId` 关联上下文)。

2.  **执行器 (`ToolExecutor` - `src/agent/tools/executor.ts`)**:
    这是 Agent 系统最核心的创新点。由于服务端无法访问浏览器的 AudioContext，Executor 实现了一个 **"影子状态模式 (Shadow State Pattern)"**：
    - **初始化**: 每次请求时，接收前端传来的画布快照 (`GraphStateSnapshot`)，在内存中重建虚拟的 `nodes` 和 `edges`。
    - **模拟执行**: 当 LLM 调用 `add_module` 或 `connect_modules` 时，Executor 在虚拟状态上执行操作（如计算不重叠的坐标、验证端口兼容性）。
    - **指令记录**: 操作不仅仅是修改虚拟状态，更会被记录为 `ClientOperation` 指令（如 `ADD_MODULE`, `CONNECT_MODULES`）。

3.  **顺序工具节点 (`SequentialToolNode`)**:
    - 为了解决 LLM 并行调用工具时产生的依赖问题（例如同时“添加模块A”和“连接模块A”，后者会因为A尚未存在而失败），系统强制工具按顺序执行。
    - 后一个工具能立即感知到前一个工具对"影子状态"的修改。

### 4.2 交互流程 (Internal Interaction Flow)

一个典型的 "User: 添加一个振荡器" 请求流程如下：

1.  **用户发起**: 前端调用 Server Action `chatWithAgent`，携带当前画布快照 (`nodes`, `edges`)。
2.  **Agent 规划**: 服务端 Agent 接收消息，LLM 决定调用 `add_module` 工具。
3.  **影子执行**: `ToolExecutor` 在虚拟画布上添加节点，计算出安全坐标 (x, y)，并记录操作指令 `ClientOperation`。
4.  **响应返回**: Server Action 返回 LLM 的文本回复以及 `clientOperations` 列表。
5.  **前端同步**: 前端接收到响应，解析 `clientOperations`，并通过 Zustand Store 真正执行 `addNode`，此时才会触发浏览器的 AudioContext 创建声音并在 Canvas 上渲染 UI。

### 4.3 检索增强生成 (RAG)
Agent 集成了 RAG 能力 (`rag_search` 工具)，直接在服务端调用 `searchDocuments` 查询 Postgres 向量数据库，无需外部 API 调用。这使得 Agent 能够查询项目文档、音频合成原理等知识来辅助用户。
