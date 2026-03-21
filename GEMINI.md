# Synthesizer Flow - 项目指南 (GEMINI.md)

本文件为 Gemini CLI 提供项目的核心上下文、架构设计及开发规范，以便在后续开发中保持一致性。

## 1. 项目概览 (Project Overview)
**Synthesizer Flow** 是一个基于 Web 的模块化音频合成器。用户通过可视化的连线界面（基于 React Flow）构建音频处理链，利用 Tone.js 和 Web Audio API 进行实时声音合成。

### 核心亮点：
- **AI Agent 集成**: 基于 LangChain/LangGraph 的服务端 Agent，通过“影子状态模式”操作前端画布。
- **响应式音频流**: 使用 RxJS 管理模块间的参数调制和信号订阅。
- **RAG 知识库**: 集成了音频合成领域的知识库，支持向量搜索 (pgvector)。

## 2. 技术栈 (Tech Stack)
- **前端**: Next.js 15 (App Router), TypeScript, React 19, Tailwind CSS 4, Shadcn UI.
- **音频引擎**: Tone.js, Web Audio API, RxJS.
- **可视化**: @xyflow/react (React Flow).
- **AI/LLM**: LangChain, LangGraph, Model Context Protocol (MCP), Vercel AI SDK.
- **后端/数据库**: Drizzle ORM, PostgreSQL (Neon), NextAuth.js.
- **测试**: Vitest.

## 3. 核心架构与概念 (Core Concepts)

### 3.1 音频模块化系统 (`src/core`)
- **`ModuleBase`**: 所有模块的基类，定义了输入/输出端口 (Ports) 和参数 (Parameters)。
- **端口系统**: 使用 RxJS `BehaviorSubject` 实现。蓝色为 `NUMBER` (控制信号)，绿色为 `AUDIO` (音频信号)，紫色为 `ARRAY` (复杂数据如 MIDI)。
- **`ModuleManager`**: 单例模式，负责音频实例的生命周期管理及其与 React Flow 节点的同步。

### 3.2 AI Agent 影子状态模式 (`src/agent`)
- **影子执行 (Shadow Execution)**: Agent 在服务端维护一个虚拟画布快照，执行 LLM 指令并计算坐标/验证连线。
- **指令同步**: 执行结果以 `ClientOperation` 列表形式返回前端，前端 Store 响应并更新真实 AudioContext。
- **人机回环 (HIL)**: 敏感操作（如删除、大规模修改）需要用户通过 `threadId` 确认。

### 3.3 数据流
- **UI -> Store (Zustand) -> ModuleManager -> Tone.js**: 用户操作触发状态更新，进而驱动底层音频节点。
- **Agent -> Server Action -> Shadow State -> ClientOperations -> Store**: Agent 指令流。

## 4. 开发规范 (Development Conventions)

### 4.1 编码风格
- **TypeScript**: 严格类型约束。音频模块参数必须在 `parameters` 中定义类型。
- **响应式编程**: 模块内部状态变化优先使用 RxJS Observable/Subject。
- **UI 组件**: 遵循 Shadcn UI 规范，保持组件原子化。

### 4.2 模块添加指南
1. 在 `src/core/modules` 下创建对应类（继承 `AudioModuleBase` 或 `ModuleBase`）。
2. 在 `src/core/modules/index.ts` 中注册新模块。
3. 定义 `uiOptions` 以适配属性面板。

### 4.3 数据库变更
- 使用 `npm run drizzle:generate` 生成迁移文件。
- 使用 `npm run drizzle:migrate` 同步至数据库。

## 5. 提交与发布规范 (Commit & Release Conventions)

### 5.1 小功能提升流程
每当完成一个完整的小功能提升或修复时，必须执行以下步骤：
1. **更新 ChangeLog**: 在 `CHANGELOG.md` 中添加对应的更新记录，遵循现有的分类（如 Features, Architecture, UI Enhancements 等）。
2. **提升版本号**: 修改 `package.json` 中的版本号。通常进行修订版本号（Patch）的递增（例如 `0.8.6` -> `0.8.7`）。
3. **提交代码**: 将代码更改、`CHANGELOG.md` 和 `package.json` 的变动一并提交。

### 5.2 Commit 信息
- 推荐使用清晰、简洁的信息，重点描述“为什么”而非“做了什么”。

## 6. 常用命令 (Key Commands)
- **开发**: `npm run dev`
- **构建**: `npm run build`
- **测试**: `npm run test` (单元测试), `npm run test:watch` (监听模式)
- **代码规范**: `npm run lint`, `npm run format`

## 6. 目录结构指南
- `src/agent`: AI Agent 核心逻辑、工具定义及 Graph 流程。
- `src/app`: Next.js 路由与 Server Actions。
- `src/components`: UI 组件（`layout` 布局, `workbench` 画布, `ui` 基础组件）。
- `src/core`: 音频引擎核心（`base` 基类, `modules` 具体实现, `services` 管理器）。
- `src/db`: 数据库 Schema 与 Drizzle 配置。
- `src/store`: Zustand 全局状态管理。
- `docs`: 项目详尽架构文档与更新日志。

---
*注：本文件由 Gemini CLI 自动生成，作为项目开发的长期指令参考。*
