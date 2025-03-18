/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ModuleBase, ParameterType, PortType } from '../../core/ModuleBase';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFlowStore } from '../../store/store';
import { useModuleSubscription } from '../../hooks/useModuleSubscription';

interface DefaultNodeProps {
  data: {
    label: string;
    type: string;
    module?: ModuleBase;
  };
  id: string;
}

// 数值参数控制组件
const NumberParameterControl = ({ 
  paramKey, 
  value, 
  min,
  max,
  updateParameter 
}: { 
  paramKey: string, 
  value: number, 
  min: number,
  max: number,
  updateParameter: (key: string, value: number) => void 
}) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span>{paramKey}:</span>
      <span>{typeof value === 'number' ? value.toFixed(2) : "0.00"}</span>
    </div>
    <Slider
      value={[typeof value === 'number' ? value : 0]}
      min={min}
      max={max}
      step={(max - min) / 100} // 动态计算合适的步长
      onValueChange={(newValue) => updateParameter(paramKey, newValue[0])}
    />
  </div>
);

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
}: {
  portKey: string;
  value: any;
  portType: PortType;
  index: number;
  module: ModuleBase;
}) => {
  const portColor = module.getPortColor(portType);
  
  return (
    <div key={`input-container-${portKey}`}>
      <Handle
        key={`input-${portKey}`}
        type="target"
        position={Position.Left}
        id={portKey}
        style={{ top: 40 + index * 20, backgroundColor: portColor }}
        className="w-2 h-2"
      />
      <div className="text-xs text-gray-500 ml-1 mb-1">
        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: portColor }}></span>
        {portKey}: {typeof value === 'number' ? value.toFixed(2) : '–'}
      </div>
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
}: {
  portKey: string;
  value: any;
  portType: PortType;
  index: number;
  module: ModuleBase;
}) => {
  const portColor = module.getPortColor(portType);
  
  return (
    <div key={`output-container-${portKey}`} className="text-right">
      <Handle
        key={`output-${portKey}`}
        type="source"
        position={Position.Right}
        id={portKey}
        style={{ top: 40 + index * 20, backgroundColor: portColor }}
        className="w-2 h-2"
      />
      <div className="text-xs text-gray-500 mr-1 mb-1">
        {portKey}: {typeof value === 'number' ? value.toFixed(2) : '–'}
        <span className="inline-block w-2 h-2 rounded-full ml-1" style={{ backgroundColor: portColor }}></span>
      </div>
    </div>
  );
};

const DefaultNode: React.FC<DefaultNodeProps> = ({ data, id }) => {
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
  
  return (
    <div className="node-container p-3 rounded-md border bg-white shadow-sm min-w-[180px]">
      {/* 模块标题 */}
      <div className="font-medium text-sm mb-2 pb-1 border-b">
        {data.label || moduleInstance?.name || "模块"}
      </div>
      
      {/* 参数控制列表 */}
      {moduleInstance && Object.keys(moduleInstance.parameters).map((paramKey) => {
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
      })}
      
      {/* 输入端口列表 */}
      {moduleInstance && Object.keys(moduleInstance.inputPorts).map((inputKey, index) => (
        <InputPort
          key={inputKey}
          portKey={inputKey}
          value={inputPortValues[inputKey]}
          portType={inputPortTypes[inputKey] || PortType.NUMBER}
          index={index}
          module={moduleInstance}
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
        />
      ))}
    </div>
  );
}
 
export default memo(DefaultNode);