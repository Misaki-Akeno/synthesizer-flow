/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ModuleBase } from '../../core/ModuleBase';
import { Slider } from '@/components/ui/slider';
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

// 参数控制子组件
const ParameterControl = ({ 
  paramKey, 
  value, 
  updateParameter 
}: { 
  paramKey: string, 
  value: number, 
  updateParameter: (key: string, value: number[]) => void 
}) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span>{paramKey}:</span>
      <span>{value?.toFixed(2) || "0.00"}</span>
    </div>
    <Slider
      value={[value || 0]}
      max={1}
      step={0.01}
      onValueChange={(newValue) => updateParameter(paramKey, newValue)}
    />
  </div>
);

// 输入端口子组件
const InputPort = ({ 
  portKey, 
  value, 
  index 
}: { 
  portKey: string, 
  value: any, 
  index: number 
}) => (
  <div key={`input-container-${portKey}`}>
    <Handle
      key={`input-${portKey}`}
      type="target"
      position={Position.Left}
      id={portKey}
      style={{ top: 40 + index * 20 }}
      className="w-2 h-2 bg-blue-500"
    />
    <div className="text-xs text-gray-500 ml-1 mb-1">
      {portKey}: {typeof value === 'number' ? value.toFixed(2) : '–'}
    </div>
  </div>
);

// 输出端口子组件
const OutputPort = ({ 
  portKey, 
  value, 
  index 
}: { 
  portKey: string, 
  value: any, 
  index: number 
}) => (
  <div key={`output-container-${portKey}`} className="text-right">
    <Handle
      key={`output-${portKey}`}
      type="source"
      position={Position.Right}
      id={portKey}
      style={{ top: 40 + index * 20 }}
      className="w-2 h-2 bg-green-500"
    />
    <div className="text-xs text-gray-500 mr-1 mb-1">
      {portKey}: {typeof value === 'number' ? value.toFixed(2) : '–'}
    </div>
  </div>
);

const DefaultNode: React.FC<DefaultNodeProps> = ({ data, id }) => {
  const { module: moduleInstance } = data;
  const updateModuleParameter = useFlowStore(state => state.updateModuleParameter);
  
  // 使用自定义Hook获取模块数据
  const { paramValues, inputPortValues, outputPortValues } = useModuleSubscription(moduleInstance);
  
  // 参数更新处理函数
  const handleParameterChange = (paramKey: string, value: number[]) => {
    if (moduleInstance) {
      updateModuleParameter(id, paramKey, value[0]);
    }
  };
  
  return (
    <div className="node-container p-3 rounded-md border bg-white shadow-sm min-w-[180px]">
      {/* 模块标题 */}
      <div className="font-medium text-sm mb-2 pb-1 border-b">
        {data.label || moduleInstance?.name || "模块"}
      </div>
      
      {/* 参数控制列表 */}
      {moduleInstance && Object.keys(moduleInstance.parameters).map((paramKey) => (
        <ParameterControl
          key={paramKey}
          paramKey={paramKey}
          value={paramValues[paramKey] || 0}
          updateParameter={handleParameterChange}
        />
      ))}
      
      {/* 输入端口列表 */}
      {moduleInstance && Object.keys(moduleInstance.inputPorts).map((inputKey, index) => (
        <InputPort
          key={inputKey}
          portKey={inputKey}
          value={inputPortValues[inputKey]}
          index={index}
        />
      ))}
      
      {/* 输出端口列表 */}
      {moduleInstance && Object.keys(moduleInstance.outputPorts).map((outputKey, index) => (
        <OutputPort
          key={outputKey}
          portKey={outputKey}
          value={outputPortValues[outputKey]}
          index={index}
        />
      ))}
    </div>
  );
}
 
export default memo(DefaultNode);