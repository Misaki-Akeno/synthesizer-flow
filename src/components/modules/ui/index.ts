import XYPad from './XYPad';

// 导出所有自定义UI组件
export const CustomUIComponents = {
  XYPad
};

// 确保类型能被正确导出
export type CustomUIComponentType = keyof typeof CustomUIComponents;

// 设置默认导出
export default CustomUIComponents;