# Changelog


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
