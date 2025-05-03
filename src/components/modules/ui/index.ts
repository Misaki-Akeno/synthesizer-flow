import XYPad from './XYPad';
import PianoKeyboard from './PianoKeyboard';
import {
  ParameterControl,
  NumberParameterControl,
  BooleanParameterControl,
  ListParameterControl,
  ParamLabel,
} from './ParameterControls';
import { InputPort, OutputPort } from './ModulePorts';
import { ModuleEnableToggle } from './ModuleEnableToggle';
import ModuleButton from './ModuleButton';

// 导出所有自定义UI组件
export const CustomUIComponents = {
  XYPad,
  PianoKeyboard,
  CommonButton: ModuleButton, // 添加按钮组件作为可渲染的自定义UI组件
};

// 确保类型能被正确导出
export type CustomUIComponentType = keyof typeof CustomUIComponents;

// 导出组件
export {
  ParameterControl,
  NumberParameterControl,
  BooleanParameterControl,
  ListParameterControl,
  ParamLabel,
  InputPort,
  OutputPort,
  ModuleEnableToggle,
  ModuleButton,
  PianoKeyboard,
};

// 设置默认导出
export default CustomUIComponents;
