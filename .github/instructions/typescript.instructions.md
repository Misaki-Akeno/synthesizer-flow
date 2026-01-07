---
applyTo: '**'
---

# SynthesizerFlow 项目结构与开发指南

## 项目架构概述

本项目是一个基于Web的音频合成器应用，使用Next.js框架构建，结合React Flow实现模块化音频处理流程。应用核心是基于模块的音频处理系统，通过可视化连接不同音频模块实现声音合成。

## 目录结构

### 前端应用层

- **`app/`**: Next.js应用入口
  - `api/auth/`: NextAuth认证API
  - `auth/login/`: 登录页面
  - `globals.css`, `layout.tsx`, `page.tsx`: 全局样式与布局

### UI组件层

- **`components/`**: 所有React组件
  - **界面布局组件**:
    - `layout/navigation/`: 导航组件 (Header, NavUser, SearchBar)
    - `layout/sidebars/`: 侧边栏组件，含模块浏览器和项目管理器
    - `layout/workbench/`: 核心工作区 (Canvas, DefaultNode)
    - `layout/`: 活动栏和辅助侧边栏
  - **功能UI组件**:
    - `auth/`: 认证相关组件
    - `ui/contextMenu/`: 上下文菜单系统
    - `ui/reusableUI/`: 可复用模块UI组件
    - `ui/shadcn/`: 基础UI组件库

### 核心功能层

- **`core/`**: 应用核心逻辑
  - **基础架构**:
    - `base/`: 基础类和接口定义 (ModuleBase, AudioModuleBase)
    - `audio/`: 音频处理核心 (AudioInputHandler)
    - `services/`: 核心服务 (ModuleManager, SerializationManager)
    - `types/`: 类型定义和验证
  - **模块实现**:
    - `modules/audio/`: 音频处理模块 (Oscillator, Reverb, Speaker)
    - `modules/input/`: 输入模块 (Keyboard, MIDI)
    - `modules/modulation/`: 调制模块 (LFO)

### 数据与工具层

- **`db/`**: 数据库交互
- **`hooks/`**: React自定义钩子
- **`lib/`**: 工具函数和辅助库
- **`store/`**: 状态管理 (Zustand)

## 核心文件与功能

### 基础组件

- `components/layout/workbench/Canvas.tsx`: 核心画布，处理模块渲染与交互
- `components/layout/workbench/DefaultNode.tsx`: 默认节点实现

### 核心逻辑

- `core/base/ModuleBase.ts`: 所有模块的基础类，定义模块接口和行为
- `core/services/ModuleManager.ts`: 模块生命周期管理
- `core/services/SerializationManager.ts`: 数据序列化与持久化
- `store/store.ts`: 应用全局状态管理

## 技术实现

- **基础技术**: React, Next.js, TypeScript, Zustand
- **核心功能**:
  - 使用Reactflow实现模块可视化与连接
  - 基于rxjs实现模块间参数绑定与数据流
  - 使用AudioContext和Tone.js处理音频
  - 模块化架构确保组件解耦和可扩展性

## 代码风格指南

- **核心原则**: 简洁、可读、可维护
- **代码质量**:
  - 使用清晰命名和适当注释
  - 遵循一致的编码风格
  - 避免过度复杂的实现
- **开发流程**:
  - 重大更改前先进行设计和构思
  - 考虑兼容性和对其他模块的影响
  - 小的bug修复可直接实施
  - 参考开源项目的最佳实践

## Langchain Agent 系统

本项目集成了基于 Langchain 的 AI Agent 系统，允许 LLM 与应用状态进行交互并执行操作。

### 架构概述

Agent 系统位于 `src/lib/mcp/` 目录下，实现了 Model Context Protocol (MCP) 的核心概念。

- **核心逻辑**: `src/lib/mcp/`
- **UI 组件**: `src/components/ui/llm/`

### 关键文件

- **`src/lib/mcp/langchainClient.ts`**: Langchain 客户端单例，负责管理与 LLM 的连接、消息历史和工具调用。
- **`src/lib/mcp/executor.ts`**: `MCPToolExecutor` 类，包含工具的具体实现逻辑（如获取画布状态、搜索文档等）。
- **`src/lib/mcp/langchainTools.ts`**: 定义 Langchain 工具（`DynamicStructuredTool`），将 Zod Schema 映射到 `MCPToolExecutor` 的方法。
- **`src/lib/mcp/systemPrompt.ts`**: 生成系统提示词，定义 Agent 的角色和行为准则。

### 开发指南

#### 添加新工具 (Tool)

1.  **实现逻辑**: 在 `src/lib/mcp/executor.ts` 的 `MCPToolExecutor` 类中添加静态方法实现业务逻辑。
2.  **定义工具**: 在 `src/lib/mcp/langchainTools.ts` 中：
    - 定义 Zod Schema 描述输入参数。
    - 创建 `DynamicStructuredTool` 实例，绑定 Schema 和 Executor 方法。
    - 将新工具添加到底部的 `tools` 数组导出。

#### 调试与日志

- 使用 `createModuleLogger('LangChainClient')` 或 `createModuleLogger('MCPExecutor')` 进行日志记录。
- 在 `ChatInterface` 中可以查看交互过程。

#### RAG 集成

- RAG 功能已作为 `rag_search` 工具集成，Agent 可通过此工具检索本地知识库。

