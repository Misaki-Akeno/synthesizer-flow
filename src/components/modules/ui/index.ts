import XYPad from './XYPad';
import {
  ParameterControl,
  NumberParameterControl,
  BooleanParameterControl,
  ListParameterControl,
  ParamLabel,
} from './ParameterControls';
import { InputPort, OutputPort } from './ModulePorts';
import { ModuleEnableToggle } from './ModuleEnableToggle';

// 导出所有自定义UI组件
export const CustomUIComponents = {
  XYPad,
};

// 确保类型能被正确导出
export type CustomUIComponentType = keyof typeof CustomUIComponents;

// 导出参数控制组件
export {
  ParameterControl,
  NumberParameterControl,
  BooleanParameterControl,
  ListParameterControl,
  ParamLabel,
  InputPort,
  OutputPort,
  ModuleEnableToggle,
};

// 设置默认导出
export default CustomUIComponents;
