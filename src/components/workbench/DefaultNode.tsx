import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ModuleBase } from '../../core/ModuleBase';
import { Slider } from '@/components/ui/slider';

interface DefaultNodeProps {
  data: {
    label: string;
    type: string;
    module?: ModuleBase;
  }
}

const DefaultNode: React.FC<DefaultNodeProps> = ({ data }) => {
  const [expanded, setExpanded] = useState(false);
  const [paramExpanded, setParamExpanded] = useState(false);
  const [interfacesExpanded, setInterfacesExpanded] = useState(false);
  const moduleInstance = data.module;

  // 渲染参数控件
  const renderParameters = () => {
    if (!moduleInstance || !moduleInstance.parameters) return null;
    
    return (
      <div className="w-full">
        <div 
          className="flex justify-between items-center py-1 px-2 bg-gray-100 hover:bg-gray-200 cursor-pointer rounded"
          onClick={() => setParamExpanded(!paramExpanded)}
        >
          <h4 className="text-xs font-medium">参数</h4>
          <span>{paramExpanded ? '▲' : '▼'}</span>
        </div>
        
        {paramExpanded && (
          <div className="p-2 text-xs border-t border-gray-200 nodrag">
            {Object.entries(moduleInstance.parameters).map(([key, value]) => (
              <div key={key} className="mb-3 last:mb-0">
                <div className="flex justify-between mb-1">
                  <label className="text-gray-700">{key}:</label>
                  <span className="text-gray-700">{value.toFixed(2)}</span>
                </div>
                <Slider
                  className="w-full"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[value]}
                  onValueChange={(newValue) => {
                    if (moduleInstance) {
                      moduleInstance.parameters[key] = newValue[0];
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 渲染接口列表
  const renderInterfaces = () => {
    if (!moduleInstance) return null;
    const hasInput = moduleInstance.inputInterfaces && Object.keys(moduleInstance.inputInterfaces).length > 0;
    const hasOutput = moduleInstance.outputInterfaces && Object.keys(moduleInstance.outputInterfaces).length > 0;
    
    if (!hasInput && !hasOutput) return null;
    
    return (
      <div className="w-full">
        <div 
          className="flex justify-between items-center py-1 px-2 bg-gray-100 hover:bg-gray-200 cursor-pointer rounded"
          onClick={() => setInterfacesExpanded(!interfacesExpanded)}
        >
          <h4 className="text-xs font-medium">接口</h4>
          <span>{interfacesExpanded ? '▲' : '▼'}</span>
        </div>
        
        {interfacesExpanded && (
          <div className="p-2 text-xs border-t border-gray-200 nodrag">
            {hasInput && (
              <div className="mb-2">
                <h5 className="font-medium text-gray-700 mb-1">输入</h5>
                <ul className="pl-2">
                  {Object.entries(moduleInstance.inputInterfaces).map(([key, value]) => (
                    <li key={key} className="text-gray-600">
                      {key}: {typeof value === 'number' ? value.toFixed(2) : '音频信号'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {hasOutput && (
              <div>
                <h5 className="font-medium text-gray-700 mb-1">输出</h5>
                <ul className="pl-2">
                  {Object.entries(moduleInstance.outputInterfaces).map(([key, value]) => (
                    <li key={key} className="text-gray-600">
                      {key}: {typeof value === 'number' ? value.toFixed(2) : '音频信号'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`module-node ${data.type}-node bg-white overflow-hidden rounded-[2px] shadow-md border border-gray-200 min-w-[180px]`}>
      {/* 标题栏 */}
      <div 
        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 px-3 flex justify-between items-center cursor-move"
        onClick={() => setExpanded(!expanded)}
      >
        <strong className="text-sm truncate">{data.label}</strong>
        <span>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* 可折叠内容 */}
      {expanded && moduleInstance && (
        <div className="nodrag divide-y divide-gray-200">
          <div className="p-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">类型:</span>
              <span className="text-gray-700">{moduleInstance.moduleType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ID:</span>
              <span className="text-gray-700">{moduleInstance.id.substring(0, 6)}...</span>
            </div>
          </div>
          
          {renderParameters()}
          {renderInterfaces()}
        </div>
      )}
      
      {/* 连接点 */}
      {moduleInstance && moduleInstance.inputInterfaces && Object.keys(moduleInstance.inputInterfaces).length > 0 && (
        <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-blue-400 !border !border-white" />
      )}
      
      {moduleInstance && moduleInstance.outputInterfaces && Object.keys(moduleInstance.outputInterfaces).length > 0 && (
        <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-green-400 !border !border-white" />
      )}
    </div>
  );
};
 
export default memo(DefaultNode);