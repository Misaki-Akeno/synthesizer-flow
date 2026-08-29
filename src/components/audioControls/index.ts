'use client';

import dynamic from 'next/dynamic';
import { createElement } from 'react';
import XYPad from './XYPad';
import PianoKeyboard from './PianoKeyboard';
import SequenceEditor from './SequenceEditor';
import EnvelopeEditor from './EnvelopeEditor';
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

const Oscilloscope = dynamic(() => import('./Oscilloscope'), {
  ssr: false,
  loading: () =>
    createElement('div', {
      className: 'h-[200px] w-[300px] animate-pulse bg-muted/20',
    }),
});

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
  EnvelopeEditor,
  oscilloscope: Oscilloscope,
};

// 设置默认导出
export default CustomUIComponents;
