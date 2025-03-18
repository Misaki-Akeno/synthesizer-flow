import { useState, useEffect } from 'react';
import { BehaviorSubject } from 'rxjs';
import { ModuleBase, ModuleInterface, PortType } from '../core/ModuleBase';

/**
 * 自定义Hook，用于订阅模块数据并返回当前值，主要用于UI
 * @param module 模块实例
 * @returns 包含参数值、输入端口值和输出端口值的对象
 */
export function useModuleSubscription(module: ModuleBase | undefined) {
  // 使用状态存储参数和端口的当前值
  const [paramValues, setParamValues] = useState<{[key: string]: number | boolean | string}>({});
  const [inputPortValues, setInputPortValues] = useState<{[key: string]: ModuleInterface}>({});
  const [inputPortTypes, setInputPortTypes] = useState<{[key: string]: PortType}>({});
  const [outputPortValues, setOutputPortValues] = useState<{[key: string]: ModuleInterface}>({});
  const [outputPortTypes, setOutputPortTypes] = useState<{[key: string]: PortType}>({});

  // 订阅参数和端口的变化
  useEffect(() => {
    if (!module) return;
    
    console.debug(`[useModuleSubscription] Setting up subscriptions for module: ${module.id} (${module.moduleType})`);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscriptions: {[key: string]: any} = {};
    
    // 初始化参数状态
    const initialParams: {[key: string]: number | boolean | string} = {};
    const initialInputTypes: {[key: string]: PortType} = {};
    const initialOutputTypes: {[key: string]: PortType} = {};
    
    // 订阅参数变化
    Object.entries(module.parameters).forEach(([key, subject]) => {
      const paramSubject = subject as BehaviorSubject<number | boolean | string>;
      const initialValue = paramSubject.getValue();
      initialParams[key] = initialValue;
      
      subscriptions[`param_${key}`] = paramSubject.subscribe(value => {
        setParamValues(prev => ({...prev, [key]: value}));
      });
    });
    setParamValues(initialParams);
    
    // 订阅输入端口变化
    Object.entries(module.inputPorts).forEach(([key, subject]) => {
      const portSubject = subject as BehaviorSubject<ModuleInterface>;
      initialInputTypes[key] = module.getInputPortType(key);
      
      subscriptions[`input_${key}`] = portSubject.subscribe(value => {
        setInputPortValues(prev => ({...prev, [key]: value}));
      });
    });
    setInputPortTypes(initialInputTypes);
    
    // 订阅输出端口变化
    Object.entries(module.outputPorts).forEach(([key, subject]) => {
      const portSubject = subject as BehaviorSubject<ModuleInterface>;
      initialOutputTypes[key] = module.getOutputPortType(key);
      
      subscriptions[`output_${key}`] = portSubject.subscribe(value => {
        setOutputPortValues(prev => ({...prev, [key]: value}));
      });
    });
    setOutputPortTypes(initialOutputTypes);
    
    // 组件卸载时取消订阅
    return () => {
      console.debug(`[useModuleSubscription] Cleaning up subscriptions for module: ${module.id}`);
      Object.values(subscriptions).forEach(sub => sub.unsubscribe());
    };
  }, [module]);

  return { 
    paramValues, 
    inputPortValues, inputPortTypes,
    outputPortValues, outputPortTypes
  };
}
