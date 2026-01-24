import XYPad from './XYPad';
import PianoKeyboard from './PianoKeyboard';
import SequenceEditor from './SequenceEditor';
import Oscilloscope from './Oscilloscope';
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
  SequenceEditor,
};

// 导出所有自定义UI组件
export const CustomUIComponents = {
  XYPad,
  PianoKeyboard,
  CommonButton: ModuleButton,
  SequenceEditor, // sequencer: SequenceEditor,
  oscilloscope: Oscilloscope,
};

// 设置默认导出
export default CustomUIComponents;
