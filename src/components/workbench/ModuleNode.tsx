import React, { useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ModuleInterface, ModuleConfiguration, DataType } from '@/types/module';
import { Parameter } from '@/types/parameter';
import parametersService from '@/core/services/ParametersService';

// 需要导入模块注册表
import { moduleRegistry } from '@/core/services/ModuleRegistry';

interface ModuleNodeData {
  moduleId: string;
  moduleTypeId: string;
  module: unknown;
  label: string;
}

// 根据数据类型获取连接点样式
const getHandleStyleByDataType = (dataType: DataType | string): string => {
  switch (dataType) {
    case DataType.AUDIO:
      return 'bg-blue-500';
    case DataType.CONTROL:
      return 'bg-yellow-500';
    case DataType.TRIGGER:
      return 'bg-red-500';
    case DataType.MIDI:
      return 'bg-purple-500';
    case DataType.EVENT:
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
};

// 参数控制组件
const ParameterControl: React.FC<{ parameter: Parameter; moduleId: string }> = ({ parameter, moduleId }) => {
  const [value, setValue] = useState<string | number | boolean>(parameter.value);
  
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newValue = event.target.type === 'checkbox' 
      ? (event.target as HTMLInputElement).checked 
      : event.target.value;
    setValue(newValue as string | number | boolean);
    parametersService.setParameterValue(moduleId, parameter.id, newValue);
  };
  
  // 根据参数类型渲染不同的控制组件
  switch (parameter.type) {
    case 'number':
    case 'integer':
      return (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-300 mr-2">{parameter.name}</span>
          <input
            type="range"
            min={parameter.min}
            max={parameter.max}
            step={parameter.step || (parameter.type === 'integer' ? 1 : 0.01)}
            value={value as number}
            onChange={handleChange}
            className="h-2 w-24 bg-slate-600 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-slate-400 ml-1 w-8 text-right">
            {Number(value).toFixed(parameter.type === 'integer' ? 0 : 2)}
            {parameter.unit && ` ${parameter.unit}`}
          </span>
        </div>
      );
      
    case 'boolean':
      return (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-300">{parameter.name}</span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={handleChange}
            className="w-4 h-4 accent-blue-500"
          />
        </div>
      );
      
    case 'enum':
      return (
        <div className="flex flex-col mb-1">
          <span className="text-xs text-slate-300 mb-1">{parameter.name}</span>
          <select 
            value={value as string} 
            onChange={handleChange}
            className="bg-slate-700 text-xs text-white rounded px-1 py-0.5 border-none outline-none"
          >
            {parameter.options?.map((option) => (
              <option key={String(option)} value={String(option)}>
                {String(option)}
              </option>
            ))}
          </select>
        </div>
      );
      
    default:
      return (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-300">{parameter.name}</span>
          <input
            type="text"
            value={String(value)}
            onChange={handleChange}
            className="bg-slate-700 text-xs text-white rounded px-1 py-0.5 w-20"
          />
        </div>
      );
  }
};

const ModuleNode: React.FC<NodeProps> = ({ data, isConnectable }) => {
  const nodeData = data as unknown as ModuleNodeData;
  const [moduleConfig, setModuleConfig] = useState<ModuleConfiguration | null>(null);
  const [parameters, setParameters] = useState<Record<string, Parameter>>({});
  const [showParameters, setShowParameters] = useState(false);

  useEffect(() => {
    // 根据moduleTypeId获取模块配置
    const config = moduleRegistry.getById(nodeData.moduleTypeId);
    if (config) {
      setModuleConfig(config);
    }
    
    // 获取模块参数
    const moduleParams = parametersService.getParameters(nodeData.moduleId);
    setParameters(moduleParams);
  }, [nodeData.moduleTypeId, nodeData.moduleId]);

  return (
    <div className="rounded-md bg-slate-800 border border-slate-600 p-2 min-w-[180px]">
      <div className="flex justify-between items-center mb-2">
        <div className="font-bold text-sm text-white">{nodeData.label}</div>
        <button 
          onClick={() => setShowParameters(!showParameters)}
          className="text-xs text-slate-400 hover:text-white bg-slate-700 px-1 rounded"
        >
          {showParameters ? '收起' : '参数'}
        </button>
      </div>
      
      <div className="text-xs text-slate-300 mb-2">{nodeData.moduleTypeId}</div>
      
      {/* 参数控制面板 */}
      {showParameters && Object.keys(parameters).length > 0 && (
        <div className="mb-3 p-2 bg-slate-700 rounded">
          <div className="text-xs font-semibold text-slate-300 mb-2 border-b border-slate-600 pb-1">参数设置</div>
          <div className="space-y-2">
            {Object.values(parameters).map(param => (
              <ParameterControl 
                key={param.id} 
                parameter={param} 
                moduleId={nodeData.moduleId} 
              />
            ))}
          </div>
        </div>
      )}
      
      {/* 输入接口 */}
      {moduleConfig &&
        moduleConfig.interfaces.inputs.map((input: ModuleInterface) => (
          <div key={`input-${input.id}`} className="flex items-center my-1">
            <Handle
              type="target"
              position={Position.Left}
              id={input.id}
              className={`w-3 h-3 ${getHandleStyleByDataType(input.dataType)}`}
              isConnectable={isConnectable}
            />
            <span className="text-xs text-slate-400 ml-2">{input.label}</span>
          </div>
        ))}

      {/* 分隔线 */}
      {moduleConfig &&
        moduleConfig.interfaces.inputs.length > 0 &&
        moduleConfig.interfaces.outputs.length > 0 && (
          <div className="my-2 border-t border-slate-600"></div>
        )}

      {/* 输出接口 */}
      {moduleConfig &&
        moduleConfig.interfaces.outputs.map((output: ModuleInterface) => (
          <div
            key={`output-${output.id}`}
            className="flex justify-between items-center my-1"
          >
            <span className="text-xs text-slate-400 mr-2">{output.label}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={output.id}
              className={`w-3 h-3 ${getHandleStyleByDataType(output.dataType)}`}
              isConnectable={isConnectable}
            />
          </div>
        ))}
    </div>
  );
};

export default ModuleNode;
