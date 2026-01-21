# Synthesizer Flow 项目技术架构文档

## 1. 项目概览 (Project Overview)

Synthesizer Flow 是一个基于 Web 的模块化音频合成器应用，深度集成了 AI Agent 辅助创作功能。项目旨在通过可视化拖拽界面让用户自由构建音频链路，并利用大语言模型（LLM）通过自然语言指令控制合成器、生成音色或检索音频知识。

## 2. 前端架构 (Frontend Architecture)

### 核心技术栈

- **框架**: Next.js 15 (App Router), React 19, TypeScript
- **构建工具**: Turbopack (Next.js default)
- **UI 组件库**: Radix UI (Primitives), TailwindCSS v4 (Styling), Shadcn/UI, Lucide React (Icons)
- **可视化/画布**: React Flow (`@xyflow/react`) - 用于构建可拖拽的模块化合成器界面
- **音频引擎**: Web Audio API (Tone.js) - 浏览器端实时音频合成
- **状态管理**: Zustand - 用于管理全局应用状态、项目配置及音频参数

### 关键设计与实现

- **模块化画布 (Workbench Canvas)**:

  - 基于 React Flow 实现，支持节点（Modules）和边（Connections）的增删改查。
  - 自定义节点组件对应不同的音频模块（如 Oscillator, Filter, Envelope 等）。
  - 右键菜单（Context Menu）与快捷键支持，提升交互体验。

- **音频引擎集成**:

  - 音频逻辑与 UI 分离，Tone.js 负责底层的声音生成与处理。
  - 通过 Zustand store 同步 UI 状态与音频引擎参数，实现"数据驱动视图，视图更新音频"的单向流。

- **性能优化**:
  - 使用 React 19 的新特性（如 Hooks 优化）。
  - 组件懒加载与 memoization 避免不必要的重渲染，特别是在音频频谱可视化的处理上。

## 3. 后端与数据库 (Backend & Database Architecture)

### 核心技术栈

- **运行时**: Node.js (Next.js Server Actions & API Routes)
- **数据库**: PostgreSQL (Vercel Postgres)
- **ORM**: Drizzle ORM - 类型安全的数据库操作
- **认证**: NextAuth.js (v5 beta / v4) - 支持 OAuth (GitHub, Google 等)
- **向量数据库**: `pgvector` (PostgreSQL 扩展) - 用于 RAG 知识库存储

### 数据库设计 (`/src/db/schema.ts`)

- **用户系统**: `users`, `accounts`, `sessions` (标准的 NextAuth Schema).
- **RAG 知识库**:
  - `rag_documents`: 存储文本片段及其向量 Embedding。
  - 使用 HNSW 索引 (`embeddingIndex`) 加速余弦相似度搜索。
  - 能够存储元数据 (`meta` jsonb 字段) 以支持更灵活的检索。

### API 与服务器架构

- **Server Actions**: 主要用于与 AI Agent 的交互 (`chatWithAgent`)，利用 Next.js 的服务器端能力隐藏 Prompt 和 API Key，并在服务端处理复杂的 Agent 逻辑。
- **REST API**:
  - `/api/auth/*`: 处理身份验证。
  - `/api/rag/ingest`: 知识库入库接口。
  - `/api/rag/search`: RAG 检索接口。

## 4. AI Agent 系统 (AI Agent System)

项目实现了一个基于 **LangGraph** 的有状态 AI Agent，能够理解用户自然语言指令并操作合成器界面或回答专业问题。Agent 系统采用分层架构，通过工具调用实现服务端决策与客户端执行的解耦。

### 4.1 核心技术栈

- **AI 框架**: LangChain (工具抽象), LangGraph (状态机编排)
- **语言模型**: OpenAI SDK (支持 GPT-4o/GPT-3.5 及兼容 API)
- **工具系统**: Zod (Schema 验证), DynamicStructuredTool (工具定义)
- **状态管理**: LangGraph Annotation (消息流管理)
- **数据持久化**: Drizzle ORM + PostgreSQL (Checkpoint 存储)

### 4.2 系统架构层级

#### 4.2.1 核心层 (Core Layer) - `/src/agent/core`

**Agent 类** (`Agent.ts`):

- **单例模式**: 管理全局 Agent 实例，确保资源复用。
- **职责**: 接收用户消息，初始化 LLM 和工具，编排执行流程，返回结构化响应。
- **关键方法**:
  - `sendMessage()`: 核心入口，处理消息转换、Graph 调用、工具调用追踪、响应格式化。
  - 支持 `useTools` 参数动态控制是否启用工具调用（纯对话模式 vs. 操作模式）。

**类型定义** (`types.ts`):

- `ChatMessage`: 统一的消息格式（user/assistant/system）。
- `GraphStateSnapshot`: 画布状态快照（nodes/edges），用于 Agent 感知当前界面。
- `ClientOperation`: 客户端操作指令类型（ADD_MODULE, CONNECT_MODULES 等），实现服务端-客户端协同。
- `ChatResponse`: Agent 响应结构，包含消息、工具调用记录、客户端操作指令。

#### 4.2.2 图编排层 (Graph Layer) - `/src/agent/graph`

**状态定义** (`state.ts`):

- 使用 LangGraph `Annotation` 定义 Agent 状态。
- `messages`: 对话历史数组，通过 reducer 累积消息（`concat`）。

**工作流编排** (`workflow.ts`):

- **节点定义**:
  - `agent` 节点: 调用 LLM（带工具绑定），生成响应或工具调用决策。
  - `tools` 节点: 执行工具调用，返回结果。
- **条件边**:
  - `shouldContinue()`: 检查最后一条消息是否包含工具调用。
    - 有工具调用 → 路由到 `tools` 节点。
    - 无工具调用 → 终止流程（END）。
- **循环结构**: `START -> agent -> [tools -> agent]* -> END`，支持多轮工具调用。
- **System Prompt 注入**: 自动在消息链头部插入 System Prompt，定义 Agent 角色和工具使用规范。

**顺序工具节点** (`sequentialToolNode.ts`):

- **关键创新**: 顺序执行工具调用（`for...of` 循环），而非并行。
- **原因**: 确保状态依赖的工具调用（如先 `add_module` 再 `connect_modules`）能获取最新状态。
- **错误处理**: 捕获工具执行异常，返回错误消息给 LLM，避免流程中断。
- **返回格式**: 为每个工具调用生成 `ToolMessage`，追踪 `tool_call_id`。

#### 4.2.3 工具层 (Tools Layer) - `/src/agent/tools`

**工具定义** (`definitions.ts`):

- 使用 `DynamicStructuredTool` + Zod Schema 定义 8 种工具：
  - **感知类**:
    - `get_canvas`: 获取画布完整快照（模块+连接）。
    - `get_module_details`: 查询特定模块的参数、端口、连接信息。
  - **操作类**:
    - `add_module`: 添加新模块，返回详细信息（包括可用端口）。
    - `delete_module`: 删除模块及其连接。
    - `update_module_parameter`: 更新参数值，返回更新后的模块状态。
    - `connect_modules`: 连接两个模块（支持 Handle 指定）。
    - `disconnect_modules`: 断开连接。
  - **知识类**:
    - `rag_search`: 向量检索本地知识库（音频合成教程、模块文档等）。

**工具执行器** (`executor.ts`):

- **核心模式**: 服务端状态模拟器 + 操作记录器。
- **内部状态**:
  - 维护 `nodes` 和 `edges` 的虚拟副本（基于 `GraphStateSnapshot` 初始化）。
  - 通过模拟执行保持状态同步，支持后续工具调用的依赖查询。
- **操作记录**:
  - 每个修改类工具执行后，记录 `ClientOperation` 指令。
  - 通过 `getOperations()` 方法返回给 Server Action，最终传递给前端。
- **关键方法**:
  - `addModule()`: 创建虚拟节点，计算安全位置（防重叠），记录 ADD_MODULE 操作。
  - `connectModules()`: 验证端口类型匹配，创建虚拟连接，记录 CONNECT_MODULES 操作。
  - `getModuleDetails()`: 实例化模块类，提取参数定义和端口信息（通过 `moduleClassMap`）。
  - `ragSearch()`: 直接调用 `searchDocuments()` 进行向量检索，避免 HTTP 调用失败。
- **位置算法**: `findSafePosition()` 检测现有节点，偏移新节点位置避免重叠。

#### 4.2.4 Prompt 层 (Prompts Layer) - `/src/agent/prompts`

**System Prompt** (`system.ts`):

- **角色定义**: 定位为"无状态 AI 助手"，强调必须通过工具感知和操作状态。
- **核心原则**:
  - 无状态性: 禁止幻觉（不调用工具不说"已完成"）。
  - 工具优先: 明确"工具是唯一途径"。
  - 验证先行: 操作前必须先查询（如调用 `get_canvas` 获取 ID，`get_module_details` 确认参数名）。
- **工具使用规范**:
  - ID 必须真实（从 `get_canvas` 获取）。
  - 参数名必须准确（从 `get_module_details` 获取）。
  - 连接前检查端口类型和可用性。
- **标准工作流示例**: 提供查询、操作的典型流程模板。
- **动态策略**: 根据 `useTools` 参数切换工具启用/禁用模式的提示语。

#### 4.2.5 Server Actions 层 - `/src/agent/actions.ts`

**chatWithAgent**:

- **Next.js Server Action**: 标记为 `'use server'`，在服务端执行。
- **职责**:
  - 接收前端传递的消息、AI 设置、画布状态。
  - 调用 `Agent.sendMessage()`。
  - 序列化响应（确保可通过 RSC 传输）。
- **安全性**: API Key 和 Prompt 不暴露给客户端。

**Checkpoint Actions** (`checkpoint-actions.ts`):

- **saveCheckpoint**: 保存对话状态到数据库，支持 LLM 自动生成标题。
- **getCheckpoints**: 查询用户的历史 Checkpoint 列表。
- **deleteCheckpoint**: 删除指定 Checkpoint（带权限验证）。
- **updateCheckpointTitle**: 重命名 Checkpoint。
- **自动命名**: 调用 LLM 根据对话内容生成简洁标题（限 12 字符以内）。

### 4.3 前后端协同机制 (Server-Client Sync)

#### 核心挑战

- Agent 运行在 Node.js 服务端，无法直接访问浏览器的 Web Audio Context。
- 需要一种机制让服务端 Agent "看到" 画布状态，并 "指挥" 客户端执行操作。

#### 解决方案：双向状态同步

1. **客户端 → 服务端**:

   - 前端通过 `chatWithAgent` Server Action 传递 `GraphStateSnapshot`（当前画布的 nodes 和 edges）。
   - ToolExecutor 基于快照初始化虚拟状态，所有工具调用在此状态上模拟执行。

2. **服务端 → 客户端**:
   - ToolExecutor 记录每个修改操作为 `ClientOperation` 指令。
   - Server Action 返回 `ClientOperation[]` 数组。
   - 前端接收后，通过 Zustand store 逐个执行操作：
     - `ADD_MODULE`: 调用 `addNode()` 和音频模块实例化。
     - `CONNECT_MODULES`: 调用 `addEdge()` 和音频节点连接。
     - `UPDATE_MODULE_PARAM`: 更新参数并同步到音频引擎。

#### 状态一致性保证

- **乐观更新**: 前端执行操作前不需等待服务端确认（操作已在服务端验证）。
- **顺序执行**: 前端按数组顺序执行操作，确保依赖关系（如先添加后连接）。
- **错误处理**: 如有 `ERROR` 类型操作，前端显示错误提示。

### 4.4 RAG 知识增强 (Retrieval-Augmented Generation)

#### 工作流程

1. 用户提问触发 `rag_search` 工具调用。
2. ToolExecutor 调用 `searchDocuments()`（`/src/lib/rag/vectorStore.ts`）。
3. 向量相似度搜索（pgvector HNSW 索引）返回 Top-K 文档片段。
4. 工具结果作为 `ToolMessage` 返回给 LLM。
5. LLM 基于检索内容生成回答（引用文档证据）。

#### 应用场景

- 音频合成理论解释（振荡器、滤波器原理）。
- 模块使用文档查询（特定模块的参数说明）。
- 声音设计建议（基于知识库的最佳实践）。

### 4.5 关键设计决策

#### 顺序工具执行 vs. 并行执行

- **问题**: LangChain 默认并行执行多个工具调用，导致 `add_module` 未完成时 `connect_modules` 找不到模块。
- **解决**: 实现 `SequentialToolNode`，强制顺序执行，确保每个工具调用都能看到前一个的状态变更。

#### 虚拟状态 vs. 数据库状态

- **选择**: 使用内存虚拟状态而非实时查询数据库。
- **原因**: 降低延迟，简化事务管理，单次对话中的状态是短暂的（最终由客户端持久化）。

#### 工具返回详细信息

- **策略**: 修改类工具（add, update, connect）返回完整的模块详情，而非简单的成功消息。
- **优势**: LLM 能立即了解操作结果（参数值、端口列表等），减少后续查询工具调用。

### 4.6 测试与验证

- **单元测试** (`tools.test.ts`): 覆盖所有工具的核心逻辑（使用 Vitest）。
- **端到端验证**: 通过前端 Agent 面板测试完整对话流程。
- **错误注入测试**: 验证无效 ID、参数名、端口名的处理逻辑。

---

_文档生成时间: 2026-01-07，最后更新: 2026-01-14_
