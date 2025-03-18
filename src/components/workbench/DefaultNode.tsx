/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ModuleBase } from '../../core/ModuleBase';
import { Slider } from '@/components/ui/slider';
import { useFlowStore } from '../../store/store';
import { BehaviorSubject } from 'rxjs';

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
  
  // 使用状态存储参数和端口的当前值
  const [paramValues, setParamValues] = useState<{[key: string]: number}>({});
  const [inputPortValues, setInputPortValues] = useState<{[key: string]: any}>({});
  const [outputPortValues, setOutputPortValues] = useState<{[key: string]: any}>({});

  // 订阅参数和端口的变化
  useEffect(() => {
    if (!moduleInstance) return;
    
    const paramSubscriptions: {[key: string]: any} = {};
    const inputSubscriptions: {[key: string]: any} = {};
    const outputSubscriptions: {[key: string]: any} = {};
    
    // 初始化参数状态
    const initialParams: {[key: string]: number} = {};
    
    // 订阅参数变化
    Object.entries(moduleInstance.parameters).forEach(([key, subject]) => {
      const paramSubject = subject as BehaviorSubject<number>;
      initialParams[key] = paramSubject.getValue();
      
      paramSubscriptions[key] = paramSubject.subscribe(value => {
        setParamValues(prev => ({...prev, [key]: value}));
      });
    });
    setParamValues(initialParams);
    
    // 订阅输入端口变化
    Object.entries(moduleInstance.inputPorts).forEach(([key, subject]) => {
      const portSubject = subject as BehaviorSubject<any>;
      inputSubscriptions[key] = portSubject.subscribe(value => {
        setInputPortValues(prev => ({...prev, [key]: value}));
      });
    });
    
    // 订阅输出端口变化
    Object.entries(moduleInstance.outputPorts).forEach(([key, subject]) => {
      const portSubject = subject as BehaviorSubject<any>;
      outputSubscriptions[key] = portSubject.subscribe(value => {
        setOutputPortValues(prev => ({...prev, [key]: value}));
      });
    });
    
    // 组件卸载时取消订阅
    return () => {
      Object.values(paramSubscriptions).forEach(sub => sub.unsubscribe());
      Object.values(inputSubscriptions).forEach(sub => sub.unsubscribe());
      Object.values(outputSubscriptions).forEach(sub => sub.unsubscribe());
    };
  }, [moduleInstance]);
  
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
            <span>{paramValues[paramKey]?.toFixed(2) || "0.00"}</span>
          </div>
          <Slider
            value={[paramValues[paramKey] || 0]}
            max={1}
            step={0.01}
            onValueChange={(value) => handleParameterChange(paramKey, value)}
          />
        </div>
      ))}
      
      {/* 输入接口与当前值 */}
      {moduleInstance && Object.keys(moduleInstance.inputPorts).map((inputKey, index) => (
        <div key={`input-container-${inputKey}`}>
          <Handle
            key={`input-${inputKey}`}
            type="target"
            position={Position.Left}
            id={inputKey}
            style={{ top: 40 + index * 20 }}
            className="w-2 h-2 bg-blue-500"
          />
          <div className="text-xs text-gray-500 ml-1 mb-1">
            {inputKey}: {typeof inputPortValues[inputKey] === 'number' ? 
              inputPortValues[inputKey]?.toFixed(2) : '–'}
          </div>
        </div>
      ))}
      
      {/* 输出接口与当前值 */}
      {moduleInstance && Object.keys(moduleInstance.outputPorts).map((outputKey, index) => (
        <div key={`output-container-${outputKey}`} className="text-right">
          <Handle
            key={`output-${outputKey}`}
            type="source"
            position={Position.Right}
            id={outputKey}
            style={{ top: 40 + index * 20 }}
            className="w-2 h-2 bg-green-500"
          />
          <div className="text-xs text-gray-500 mr-1 mb-1">
            {outputKey}: {typeof outputPortValues[outputKey] === 'number' ? 
              outputPortValues[outputKey]?.toFixed(2) : '–'}
          </div>
        </div>
      ))}
    </div>
  );
}
 
export default memo(DefaultNode);