/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ModuleBase, ParameterType, PortType } from '../../core/ModuleBase';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFlowStore } from '../../store/store';
import { useModuleSubscription } from '../../hooks/useModuleSubscription';
import React from 'react';

interface DefaultNodeProps {
  data: {
    label: string;
    type: string;
    module?: ModuleBase;
  };
  id: string;
  selected?: boolean;
}

// 数值参数控制组件
const NumberParameterControl = ({
  paramKey,
  value,
  min,
  max,
  step,
  updateParameter,
}: {
  paramKey: string;
  value: number;
  min: number;
  max: number;
  step: number;
  updateParameter: (key: string, value: number) => void;
}) => {
  // 使用useEffect来确保inputValue总是跟随value的变化而更新
  const [inputValue, setInputValue] = useState<string>(typeof value === 'number' ? value.toFixed(2) : '0.00');
  
  // 当外部value变化时更新输入框的值
  React.useEffect(() => {
    setInputValue(typeof value === 'number' ? value.toFixed(2) : '0.00');
  }, [value]);

  const [, setIsFocused] = useState(false);

  // 处理滑块值变化
  const handleSliderChange = (newValue: number[]) => {
    updateParameter(paramKey, newValue[0]);
    setInputValue(newValue[0].toFixed(2));
  };

  // 处理输入框值变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // 处理输入框失焦和回车事件
  const handleInputCommit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clampedValue = Math.min(Math.max(parsed, min), max);
      updateParameter(paramKey, clampedValue);
      setInputValue(clampedValue.toFixed(2));
    } else {
      setInputValue(value.toFixed(2));
    }
    setIsFocused(false);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputCommit();
    }
  };

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center text-xs mb-1">
        <span>{paramKey}:</span>
        <div className="w-16">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputCommit}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            className="h-6 text-xs px-2 py-0.5 leading-tight"
          />
        </div>
      </div>
      <Slider
        value={[typeof value === 'number' ? value : 0]}
        min={min}
        max={max}
        step={step} 
        onValueChange={handleSliderChange}
      />
    </div>
  );
};

// 布尔参数控制组件
const BooleanParameterControl = ({ 
  paramKey, 
  value, 
  updateParameter 
}: { 
  paramKey: string, 
  value: boolean, 
  updateParameter: (key: string, value: boolean) => void 
}) => (
  <div className="mb-3">
    <div className="flex justify-between items-center text-xs">
      <span>{paramKey}:</span>
      <Switch 
        checked={Boolean(value)}
        onCheckedChange={(checked) => updateParameter(paramKey, checked)}
      />
    </div>
  </div>
);

// 列表参数控制组件
const ListParameterControl = ({ 
  paramKey, 
  value, 
  options,
  updateParameter 
}: { 
  paramKey: string, 
  value: string, 
  options: string[],
  updateParameter: (key: string, value: string) => void 
}) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span>{paramKey}:</span>
    </div>
    <Select 
      value={String(value)} 
      onValueChange={(val) => updateParameter(paramKey, val)}
    >
      <SelectTrigger className="w-full text-xs h-8">
        <SelectValue placeholder="选择选项" />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

// 输入端口子组件
const InputPort = ({
  portKey,
  value,
  portType,
  index,
  module,
  isSelected,
}: {
  portKey: string;
  value: any;
  portType: PortType;
  index: number;
  module: ModuleBase;
  isSelected: boolean;
}) => {
  const portColor = module.getPortColor(portType);
  const portPosition = 40 + index * 28; // 将间距从20px增加到25px
  
  // 确定显示的值
  const displayValue = () => {
    if (typeof value === 'number') {
      return value.toFixed(2);
    } else if (value !== undefined && value !== null && value !== '') {
      return '🔊'; // 音频或其他非空值显示声音emoji
    } else {
      return '–';
    }
  };
  
  return (
    <div key={`input-container-${portKey}`}>
      <Handle
        key={`input-${portKey}`}
        type="target"
        position={Position.Left}
        id={portKey}
        style={{ top: portPosition, backgroundColor: portColor }}
        className="w-2 h-2"
      />
      {isSelected && (
        <div
          className="text-xs text-gray-700 absolute px-2 py-1 bg-white/60 border border-gray-200 rounded shadow-sm z-10 whitespace-nowrap text-right"
          style={{
            top: portPosition - 2,
            transform: 'translateY(-50%)',
            right: 'calc(100% + 10px)',
            left: 'auto',
          }}
        >
          {portKey}: {displayValue()}
        </div>
      )}
    </div>
  );
};

// 输出端口子组件
const OutputPort = ({
  portKey,
  value,
  portType,
  index,
  module,
  isSelected,
}: {
  portKey: string;
  value: any;
  portType: PortType;
  index: number;
  module: ModuleBase;
  isSelected: boolean;
}) => {
  const portColor = module.getPortColor(portType);
  const portPosition = 40 + index * 28; // 将间距从20px增加到25px
  
  // 确定显示的值
  const displayValue = () => {
    if (typeof value === 'number') {
      return value.toFixed(2);
    } else if (value !== undefined && value !== null && value !== '') {
      return '🔊'; // 音频或其他非空值显示声音emoji
    } else {
      return '–';
    }
  };
  
  return (
    <div key={`output-container-${portKey}`} className="text-right">
      <Handle
        key={`output-${portKey}`}
        type="source"
        position={Position.Right}
        id={portKey}
        style={{ top: portPosition, backgroundColor: portColor }}
        className="w-2 h-2"
      />
      {isSelected && (
        <div
          className="text-xs text-gray-700 absolute px-2 py-1 bg-white/60 border border-gray-200 rounded shadow-sm z-10 whitespace-nowrap text-left"
          style={{
            top: portPosition - 2,
            transform: 'translateY(-50%)',
            left: 'calc(100% + 10px)',
            right: 'auto',
          }}
        >
          {portKey}: {displayValue()}
        </div>
      )}
    </div>
  );
};

const DefaultNode: React.FC<DefaultNodeProps> = ({ data, id, selected }) => {
  const { module: moduleInstance } = data;
  const updateModuleParameter = useFlowStore(state => state.updateModuleParameter);
  
  // 使用自定义Hook获取模块数据
  const { 
    paramValues, 
    inputPortValues, inputPortTypes,
    outputPortValues, outputPortTypes
  } = useModuleSubscription(moduleInstance);
  
  // 参数更新处理函数
  const handleParameterChange = (paramKey: string, value: number | boolean | string) => {
    if (moduleInstance) {
      updateModuleParameter(id, paramKey, value);
    }
  };
  
  // 渲染参数控制器
  const renderParameterControl = (paramKey: string) => {
    if (!moduleInstance) return null;
    
    const meta = moduleInstance.getParameterMeta(paramKey);
    const value = paramValues[paramKey];
    
    switch (meta.type) {
      case ParameterType.NUMBER:
        return (
          <NumberParameterControl
            key={paramKey}
            paramKey={paramKey}
            value={typeof value === 'number' ? value : 0}
            min={meta.min || 0}
            max={meta.max || 1}
            step={meta.step || 0.1}
            updateParameter={handleParameterChange}
          />
        );
      case ParameterType.BOOLEAN:
        return (
          <BooleanParameterControl
            key={paramKey}
            paramKey={paramKey}
            value={Boolean(value)}
            updateParameter={handleParameterChange}
          />
        );
      case ParameterType.LIST:
        return (
          <ListParameterControl
            key={paramKey}
            paramKey={paramKey}
            value={String(value)}
            options={meta.options || []}
            updateParameter={handleParameterChange}
          />
        );
      default:
        return <div key={paramKey}>未知参数类型</div>;
    }
  };
  
  return (
    <div 
      className="node-container p-3 rounded-md border bg-white shadow-sm min-w-[180px] relative"
    >
      {/* 模块标题 */}
      <div className="font-medium text-sm mb-2 pb-1 border-b">
        {data.label || moduleInstance?.name || "模块"}
      </div>
      
      {/* 参数控制列表 */}
      {moduleInstance && Object.keys(moduleInstance.parameters).map(renderParameterControl)}
      
      {/* 输入端口列表 */}
      {moduleInstance && Object.keys(moduleInstance.inputPorts).map((inputKey, index) => (
        <InputPort
          key={inputKey}
          portKey={inputKey}
          value={inputPortValues[inputKey]}
          portType={inputPortTypes[inputKey] || PortType.NUMBER}
          index={index}
          module={moduleInstance}
          isSelected={!!selected}
        />
      ))}
      
      {/* 输出端口列表 */}
      {moduleInstance && Object.keys(moduleInstance.outputPorts).map((outputKey, index) => (
        <OutputPort
          key={outputKey}
          portKey={outputKey}
          value={outputPortValues[outputKey]}
          portType={outputPortTypes[outputKey] || PortType.NUMBER}
          index={index}
          module={moduleInstance}
          isSelected={!!selected}
        />
      ))}
    </div>
  );
}
 
export default memo(DefaultNode);