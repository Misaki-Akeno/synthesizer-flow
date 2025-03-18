import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ModuleBase } from '../../core/ModuleBase';
import { Slider } from '@/components/ui/slider';
import { useFlowStore } from '../../store/store';

interface DefaultNodeProps {
  data: {
    label: string;
    type: string;
    module?: ModuleBase;
  };
  id: string;
}

const DefaultNode: React.FC<DefaultNodeProps> = ({ data, id }) => {
  const { module: moduleInstance } = data;
  const updateModuleParameter = useFlowStore(state => state.updateModuleParameter);
  
  // 更新参数的处理函数
  const handleParameterChange = (paramKey: string, value: number[]) => {
    if (moduleInstance && moduleInstance.parameters) {
      updateModuleParameter(id, paramKey, value[0]);
    }
  };
  
  return (
    <div className="node-container p-3 rounded-md border bg-white shadow-sm min-w-[180px]">
      {/* 模块标题 */}
      <div className="font-medium text-sm mb-2 pb-1 border-b">
        {data.label || moduleInstance?.name || "模块"}
      </div>
      
      {/* 参数控制 */}
      {moduleInstance && Object.keys(moduleInstance.parameters).map((paramKey) => (
        <div key={paramKey} className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span>{paramKey}:</span>
            <span>{moduleInstance.parameters[paramKey].toFixed(2)}</span>
          </div>
          <Slider
            value={[moduleInstance.parameters[paramKey]]}
            max={1}
            step={0.01}
            onValueChange={(value) => handleParameterChange(paramKey, value)}
          />
        </div>
      ))}
      
      {/* 输入接口 */}
      {moduleInstance && Object.keys(moduleInstance.inputPorts).map((inputKey, index) => (
        <Handle
          key={`input-${inputKey}`}
          type="target"
          position={Position.Left}
          id={inputKey}
          style={{ top: 40 + index * 20 }}
          className="w-2 h-2 bg-blue-500"
        />
      ))}
      
      {/* 输出接口 */}
      {moduleInstance && Object.keys(moduleInstance.outputPorts).map((outputKey, index) => (
        <Handle
          key={`output-${outputKey}`}
          type="source"
          position={Position.Right}
          id={outputKey}
          style={{ top: 40 + index * 20 }}
          className="w-2 h-2 bg-green-500"
        />
      ))}
    </div>
  );
}
 
export default memo(DefaultNode);