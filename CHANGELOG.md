# Changelog

## 0.7.4 (2025-05-26)

模块组织架构更新，更可读；添加了设置页面以及其持久化功能；添加了右侧边栏。添加了LLM Chat的ui界面和对应的api端口，并进行了实现。

## 0.7.3 (2025-05-12)

- **新增菜单系统**: 实现了基于Radix UI的完整菜单栏

  - 添加文件、编辑、视图和帮助主菜单，每个菜单含多个选项
  - 支持键盘快捷键显示和命令执行
  - 移动端自适应为下拉菜单，保持功能完整性

- **对话框组件**: 添加Dialog组件系统

  - 实现帮助和设置对话框，提供应用信息和配置入口
  - 统一的对话框设计风格，包含标题、内容和操作按钮区域

- **导航体验改进**:
  - 优化侧边栏提示显示位置，确保多平台一致性
  - 改善搜索栏视觉效果，去除多余的搜索图标
  - 标准化布局组件的空白和对齐方式

## 0.7.2 (2025-04-28)

### Features

### 🖱️ 模块拖放支持

- 现在您可以从模块浏览器直接拖放模块到画布上
- 保留了单击添加模块的便捷操作
- 优化了拖放交互体验，确保模块准确放置

### 🔊 扬声器模块重大增强

- 添加双声道立体声支持，可独立控制左右声道输入
- 新增声道平衡控制参数，从全左(-1)到全右(1)灵活调节
- 实现音频上下文自动检测和启动功能
- 添加音频启动按钮，解决浏览器音频策略限制

### 🎹 屏幕键盘MIDI输入

- 添加屏幕键盘MIDI输入组件，无需外部MIDI设备也能创作
- 提供直观的键盘界面，方便音乐创作和测试

### 🧭 导航改进

- 添加sidebar的URL导引功能
- 为右键菜单指定正确的路径，提升导航体验

## Module

添加屏幕键盘midi输入组件

## 0.7.1 (2025-04-25)

### Features

- **日志系统**: 添加全新的统一日志管理框架

  - 实现`Logger`类和`createModuleLogger`函数，支持模块化日志记录
  - 集成控制台日志和Toast通知，提供不同级别的日志显示
  - 为关键模块添加专用日志记录器，改进错误跟踪和调试体验

- **MIDI设备管理改进**:

  - 为MIDI输入模块添加"刷新MIDI设备"按钮，方便用户重新扫描设备
  - 实现ModuleButton组件作为可复用的模块内UI元素
  - 优化MIDI设备连接状态提示和错误处理

- **数据验证增强**:
  - 添加SerializationValidator模块，使用Zod进行严格的数据验证
  - 为画布序列化/反序列化流程增加验证层，提高系统安全性
  - 改进项目导入导出功能的健壮性

### Improvements

- **认证体验优化**:

  - 改进登录流程，添加登录状态Toast提示
  - 优化用户操作反馈，包括登录中和成功状态显示
  - 完善错误处理和日志记录

- **模块参数调整**:
  - 将AdvancedOscillator默认波形从sine改为triangle，提供更丰富的泛音

### Bug Fixes

- 修复MIDI设备列表刷新功能中的错误处理
- 修复项目加载和验证时的潜在问题
- 改进数据库连接错误处理机制

### Code Quality

- 减少控制台冗余日志，使用结构化日志替代
- 改进错误处理和状态提示方式
- 增强代码可维护性和调试能力

## 0.7.0 (2025-04-23)

### Features

- **用户认证系统**: 实现完整的用户认证和会话管理
  - 集成NextAuth.js与GitHub OAuth认证
  - 添加自定义登录页面和用户会话状态管理
  - 实现Drizzle ORM适配器，提供持久化的用户会话
  - 用户可通过GitHub账号登录并保持登录状态

### Database

- **数据库架构升级**: 扩展数据模型支持用户认证
  - 更新用户表结构以符合NextAuth要求
  - 添加accounts、sessions和verification_tokens表
  - 改进数据库连接处理和错误管理机制
  - 实现安全的用户身份存储方案

### UI Enhancements

- **用户界面升级**: 添加用户相关交互元素
  - 改进NavUser组件，支持实时显示用户登录状态
  - 集成用户头像和下拉菜单功能
  - 添加登录/登出按钮和状态指示器
  - 优化侧边栏组件结构，支持用户相关功能

### Infrastructure

- **应用架构改进**: 增强系统稳定性和安全性
  - 添加基于Zod的环境变量验证系统
  - 集成Sonner toast通知系统，提供更好的用户反馈
  - 实现更安全的身份验证流程和会话管理

## 0.6.9 (2025-04-20)

### Architecture

- **模块元数据系统改进**: 引入统一的模块元数据管理机制
  - 为所有模块类添加了静态 `metadata` 属性，包含类型、标签、描述和分类信息
  - 创建了 `Modules/index.ts` 作为统一导出点，简化模块导入
  - 实现 `moduleClassMap` 和 `moduleMetadataMap` 用于模块类型查找
  - 添加 `getModuleDescription` 和 `getModuleMetadata` 辅助函数

### UI Enhancements

- **模块提示增强**: 为模块标题添加了tooltip显示功能
  - 模块标题悬停时显示模块的详细描述
  - 描述信息直接从模块的元数据中获取，保证数据一致性

### Code Quality

- **代码优化**: 大幅简化了与模块相关的代码
  - 重构 `ModuleManager.createModuleInstance` 方法，避免使用冗长的switch语句
  - 统一了模块类型和元数据的注册流程
  - 改进了代码可维护性和扩展性，便于添加新模块

## 0.6.8 (2025-04-19)

### Features

- **侧边栏界面重构**: 实现更模块化的侧边栏设计
  - 添加了独立的模块浏览器、项目管理器和开发工具面板
  - 创建了统一的侧边栏组件系统，便于扩展新功能
  - 实现了类似VS Code的功能切换和面板管理系统
  - 底部添加了用户菜单，实现账户管理和系统设置的入口

### Improvements

- **UI层次结构优化**: 改进视觉层次和交互体验
  - 采用白色活动栏配合#FAFAFA面板的配色方案
  - 所有按钮设计为固定尺寸的正方形，提高一致性
  - 优化了头像和用户信息的显示方式
  - 使用shadcn的Tooltip组件替换自定义工具提示

### UI/UX Enhancements

- 改进了项目管理器UI，参考SerializationTester实现，支持项目全高度预览
- 修复了ReactFlow Provider问题，确保模块浏览器正常工作
- 统一了所有头部标题栏的样式和交互行为
- 实现了更一致的图标和按钮集合，遵循最新设计规范

## 0.6.7 (2025-04-19)

### Features

- **UI界面全面升级**: 实现VS Code风格的界面布局
  - 添加了可折叠侧边栏，支持多种功能面板切换
  - 重新设计了Header组件，包含动态搜索栏功能
  - 创建了独立的布局组件系统(Sidebar, Header, SearchBar)

### Improvements

- **开发工具优化**: 完全重构DevTools
  - 移除了悬浮窗模式，集成到侧边栏中
  - 优化了工具面板的组织和显示方式
  - 改进了滚动条样式，采用VS Code风格半透明设计

### UI/UX Enhancements

- 实现了自适应菜单系统，在窄屏幕上自动折叠为下拉菜单
- 优化了搜索栏交互，支持展开/折叠模式切换
- 改进了整体布局流程，提升了不同屏幕尺寸下的可用性

## 0.6.6 (2025-04-18)

### Features

- **项目管理优化**: 完善项目管理与URL共享功能
  - 改进项目存储结构，统一使用ProjectConfig格式
  - 引入nanoid为项目生成简短唯一ID
  - 实现通过URL参数分享和恢复项目状态
  - 优化项目加载流程，支持通过ID直接加载
  - 添加音频上下文重置功能，确保项目切换时音频资源正确释放

### Improvements

- 简化预设数据格式，统一内置预设和用户项目的数据结构
- 优化URL处理逻辑，防止URL反复跳转
- 提升项目切换体验，避免上一个项目的音频继续播放

## 0.6.5 (2025-04-18)

### Features

- **项目持久化**: 添加项目保存和加载功能
  - 实现`SerializationManager`类，提供模块和画布的序列化/反序列化功能
  - 使用Zustand的persist中间件实现本地存储
  - 添加项目管理UI界面，支持保存、加载、导出和导入项目
  - 支持Base64格式的画布数据导入导出
  - URL安全的Base64转换，确保序列化数据可用于URL参数

### Bug Fixes

- 修复`ModuleInitManager`中模块注册逻辑，优化模块初始化流程
- 减少`AdvancedOscillatorModule`中的冗余日志输出
- 修复`MIDIInputModule`中无效设备ID处理逻辑

## 0.6.4 (2025-04-18)

### UI Improvements

- 增强型模块选择器：
  - 实现可拖拽的模块选择器面板，通过标题栏可移动整个选择器
  - 添加模块拖放功能，只有拖出选择器窗口时才创建新模块
  - 提供拖拽过程中的视觉反馈，清晰区分拖拽状态
  - 优化搜索体验，按类别分组显示模块
- 改进的交互体验：
  - 优化右键菜单集成
  - 改进模块添加和删除流程
  - 支持通过双击快速添加模块到画布

### Core Architecture Updates

- 添加新的模块生命周期管理：
  - 集成`ModuleInitManager`用于处理节点的删除和资源释放
  - 改进`ModuleManager`中的节点删除功能
  - 支持更高效的模块创建和销毁流程

## 0.6.2 (2025-04-14)

## UI Improvements

### New Components

- Added modular UI components for better code organization:
  - `ModuleEnableToggle`: Component for toggling module enabled/disabled state
  - `ModulePorts`: Reusable components for input and output ports
  - `ParameterControls`: Standardized parameter control components with tooltips

### Parameter Interface Enhancements

- Replaced the "advanced parameters" drawer with Radix UI Accordion groups
- Added tooltips to parameter labels for better documentation
- Improved parameter organization with logical grouping
- Added human-readable labels and descriptions to module parameters

## Core Architecture Updates

- Updated `ModuleBase` parameter metadata to support:
  - Parameter hiding (`hide: true`)
  - Parameter grouping (`group: "Group Name"`)
  - Parameter descriptions (`describe: "Description text"`)
  - Custom display labels (`label: "Display Name"`)
- Added URL-based preset loading via query parameters
  - Enhanced `page.tsx` to support URL query parameters (`?preset=presetId`)
  - Added `initialPresetId` prop to `Canvas.tsx` component
  - Updated `PresetLoader.tsx` to prioritize URL-specified presets
  - Maintained backward compatibility with default preset loading
  - Examples:
    - `/` loads default preset
    - `/?preset=major-chord` loads the major chord preset
    - `/?preset=midi-input-test` loads MIDI controller test preset

## Module Improvements

- Enhanced `AdvancedOscillatorModule` with comprehensive envelope controls
- Made `MIDIInputModule` client-side safe with proper browser detection
- Improved parameter organization across all modules

## 0.6.1 (2025-04-13)

### Features

- **Polyphonic Synthesis**: Added support for multiple simultaneous notes
  - Created new `PolyphonicOscillatorModule` for handling multiple voices
  - Enhanced `MIDIInputModule` with `activeNotes` and `activeVelocities` outputs
  - Added new `ARRAY` port type to support complex data transmission
  - Implemented voice allocation and management system (up to 16 voices)

### Improvements

- **Module System**: New port types for advanced data flows
  - Added array-type ports with purple color for complex data structures
  - Improved port type checking and validation

### Presets

- Added new "复音合成器测试" (Polyphonic Synthesizer Test) preset

## 0.6.0 (2023-11-12)

### Features

- **MIDI Support**: Added WebMIDI API integration
  - Added new MIDIInputModule for receiving data from MIDI controllers
  - Added AdvancedOscillatorModule with MIDI note and velocity inputs
  - Created MIDI controller test preset

### Improvements

- **Preset System**: Enhanced preset management
  - Added support for default preset selection
  - Added getDefaultPresetId method to PresetManager
  - Updated PresetLoader to use dynamic default preset

### UI Enhancements

- Added advanced UI options to ReverbModule parameters
- Created responsive MIDI controller connection interface

### Dependencies

- Added webmidi v3.1.12
