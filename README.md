# Synthesizer Flow

Synthesizer Flow 致力于构建模块化合成器。可以通过菜单来添加不同的音频模块，然后用接口相互连接，可以制造想要的任何声音。可以用虚拟midi键盘模块，连接到振荡器，再用调制器来控制振荡器波形，并把信号输出到调音台和扬声器模块，实现音乐生成！还可以用音序器来自动化播放音乐，通过时序器模块来控制拍子和歌曲进度，音序器根据时序来自动输出midi！

### **1. 技术栈 (Tech Stack)**

**前端架构 (Frontend)**
*   **Framework**: **Next.js 15 (App Router)** - 利用最新的 React Server Components (RSC) 和 Server Actions。
*   **Language**: **TypeScript** - 全类型安全开发，确保复杂音频模块逻辑的健壮性。
*   **UI Library**: **React 19**, **Tailwind CSS 4**, **Shadcn UI** (Radix UI) - 构建高性能、可访问的现代化界面。
*   **Visual Flow**: **React Flow (@xyflow/react)** - 实现复杂的节点可视化编辑、连线和交互。
*   **State Management**: **Zustand** - 处理全局应用状态（如当前项目配置、UI 状态）。

**核心音频引擎 (Audio Engine)**
*   **Audio Processing**: **Tone.js** & **Web Audio API** - 浏览器端的实时音频合成与处理。
*   **Reactive Programming**: **RxJS** - 处理模块间复杂的信号流、参数调制和事件订阅，实现音频信号与 UI 的解耦。

**AI & LLM Agent (核心亮点)**
*   **Agent Protocol**: **Model Context Protocol (MCP)** - 实现了 MCP 客户端标准，让 LLM 能够标准化地“感知”和“操作”应用状态。
*   **Orchestration**: **LangChain** & **Vercel AI SDK** - 管理 LLM 上下文、工具调用 (Tool Calling) 和流式响应。
*   **RAG System**: **OpenAI Embeddings** + **pgvector** (via Drizzle) - 构建向量知识库，使 Agent 能够基于文档回答专业音频问题。

**后端与基础设施 (Backend & Infra)**
*   **Database**: **PostgreSQL** (Neon/Supabase) + **Drizzle ORM** - 存储用户项目、预设和 RAG 向量数据。
*   **Auth**: **NextAuth.js (Auth.js)** - 安全的用户认证系统。
*   **Testing**: **Vitest** - 单元测试与集成测试。


### **2. 系统架构 (System Architecture)**

#### **A. 核心音频模块架构 (The "Module" System)**
采用了 **UI 与 逻辑分离** 的设计模式，确保音频处理不受 React 渲染周期的影响。

*   **`ModuleBase` (Abstract Class)**:
    *   所有模块（振荡器、混响等）的基类。
    *   使用 **RxJS `BehaviorSubject`** 管理参数状态，实现参数变化的响应式传播。
    *   定义了标准化的 `Port` (端口) 接口：`Audio` (音频流), `Number` (控制电压/参数), `Array` (MIDI 数据)。
*   **`AudioModuleBase`**:
    *   继承自 `ModuleBase`，封装了 **Tone.js** 的节点生命周期（创建、连接、销毁）。
    *   实现了自动化的资源清理机制，防止 Web Audio Context 内存泄漏。

#### **B. LLM Agent 架构 (MCP Implementation)**

*   **MCP Client (mcp)**:
    *   实现了一个本地 MCP 客户端，充当 LLM 与应用之间的桥梁。
    *   **Tool Definitions (tools.ts)**: 定义了 Agent 可用的“手”和“眼”：
        *   `get_canvas_modules`: 获取当前画布上的所有模块状态（Agent 的“眼睛”）。
        *   `connect_modules`: 连接两个音频模块（Agent 的“手”）。
        *   `update_parameter`: 调整模块参数（如频率、波形）。
    *   **Executor (`executor.ts`)**: 负责解析 LLM 的 Tool Call 指令，并安全地执行对应的应用逻辑。

#### **C. RAG 知识库架构**
*   **Ingestion Pipeline (`api/rag/ingest`)**: 将项目文档、音频合成教程切片并向量化。
*   **Vector Store**: 使用 PostgreSQL 的 `pgvector` 扩展存储向量。
*   **Retrieval**: 当用户提问时，系统会先在向量库中检索相关上下文，注入到 System Prompt 中，再由 LLM 生成回答。