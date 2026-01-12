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
  - 通过 Zustand store 同步 UI 状态与音频引擎参数，实现“数据驱动视图，视图更新音频”的单向流。

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

项目实现了一个基于 **LangGraph** 的有状态 AI Agent，能够理解用户自然语言指令并操作合成器界面或回答专业问题。

### 核心架构

- **框架**: LangChain, LangGraph, OpenAI SDK
- **模型**: 支持 OpenAI (GPT-4o/GPT-3.5)

### Agent 工作流 (Workflow)

1.  **LangGraph 状态机**:

    - 定义了 `agent` (LLM 决策) 和 `tools` (工具执行) 两个主要节点。
    - 使用循环图结构：`Start -> Agent -> (如有工具调用) -> Tools -> Agent -> End`。
    - 维护对话历史 (`messages`) 和 Agent 状态。

2.  **工具集 (Tools)** (`/src/agent/tools`):

    - **操作类**: `add_module` (添加模块), `connect_modules` (连接), `update_module_parameter` (调参) 等。
    - **感知类**: `get_canvas_modules` (获取当前画布状态), `get_module_details` (查询参数)。
    - **知识类**: `rag_search` (利用 RAG 检索合成器使用手册或声学知识)。

3.  **前后端协同模式 (Server-Client Sync)**:

    - **问题**: Agent 运行在服务器端，无法直接操作用户浏览器中的音频上下文 (Web Audio Context)。
    - **解决方案**:
      - `ToolExecutor` 在服务端模拟执行，并记录一系列 **Client Operations** (`ADD_MODULE`, `CONNECT`, etc.)。
      - Server Action 返回 Agent 的文本回复以及操作指令列表。
      - 前端接收到指令后，通过 Zustand 同步更新 UI 和 Audio Engine，实现“服务端决策，客户端执行”。

4.  **RAG 实现 (Retrieval-Augmented Generation)**:
    - 用户提问 -> 生成 Embedding -> 在 `rag_documents` 表中进行向量相似度搜索 ->检索相关文档 -> 构建增强 Prompt -> 输入 LLM。
    - 使得 Agent 能够回答关于合成器原理、特定模块使用方法的专业问题。

---

_文档生成时间: 2026-01-07_
