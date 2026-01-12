# Synthesizer Flow

Synthesizer Flow 致力于构建模块化合成器。可以通过菜单来添加不同的音频模块，然后用接口相互连接，可以制造想要的任何声音。可以用虚拟midi键盘模块，连接到振荡器，再用调制器来控制振荡器波形，并把信号输出到调音台和扬声器模块，实现音乐生成！还可以用音序器来自动化播放音乐，通过时序器模块来控制拍子和歌曲进度，音序器根据时序来自动输出midi！

### **1. 技术栈 (Tech Stack)**

**前端架构 (Frontend)**

- **Framework**: **Next.js 15 (App Router)** - 利用最新的 React Server Components (RSC) 和 Server Actions。
- **Language**: **TypeScript** - 全类型安全开发，确保复杂音频模块逻辑的健壮性。
- **UI Library**: **React 19**, **Tailwind CSS 4**, **Shadcn UI** (Radix UI) - 构建高性能、可访问的现代化界面。
- **Visual Flow**: **React Flow (@xyflow/react)** - 实现复杂的节点可视化编辑、连线和交互。
- **State Management**: **Zustand** - 处理全局应用状态（如当前项目配置、UI 状态）。

**核心音频引擎 (Audio Engine)**

- **Audio Processing**: **Tone.js** & **Web Audio API** - 浏览器端的实时音频合成与处理。
- **Reactive Programming**: **RxJS** - 处理模块间复杂的信号流、参数调制和事件订阅，实现音频信号与 UI 的解耦。

**AI & LLM Agent (核心亮点)**

- **Agent Protocol**: **Model Context Protocol (MCP)** - 实现了 MCP 客户端标准，让 LLM 能够标准化地“感知”和“操作”应用状态。
- **Orchestration**: **LangChain** & **Vercel AI SDK** - 管理 LLM 上下文、工具调用 (Tool Calling) 和流式响应。
- **RAG System**: **OpenAI Embeddings** + **pgvector** (via Drizzle) - 构建向量知识库，使 Agent 能够基于文档回答专业音频问题。

**后端与基础设施 (Backend & Infra)**

- **Database**: **PostgreSQL** (Neon/Supabase) + **Drizzle ORM** - 存储用户项目、预设和 RAG 向量数据。
- **Auth**: **NextAuth.js (Auth.js)** - 安全的用户认证系统。
- **Testing**: **Vitest** - 单元测试与集成测试。

最后非常感谢陪伴我的ChatGPT Codex, Claude 3.5 3.7 4以及Gemini 3！
