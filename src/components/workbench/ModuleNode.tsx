import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Position, NodeProps } from '@xyflow/react';
import { ModuleInterface, ModuleConfiguration } from '@/interfaces/module';
import { Parameter } from '@/interfaces/parameter';
import { Services } from '@/core/services/ServiceManager';
import { moduleRegistry } from '@/core/factory/ModuleRegistry';
import { ParameterValue } from '@/interfaces/event';

// 新增 DefaultModuleComponents 的引用
import {
  ModuleHeader,
  PortContainer,
  ParameterControl,
  PortHandle,
} from './ModuleNodeComponents';

interface ModuleNodeData {
  moduleId: string;
  moduleTypeId: string;
  module: unknown;
  label: string;
}

const ModuleNode: React.FC<NodeProps> = ({ data }) => {
  // 数据类型转换
  const nodeData = data as unknown as ModuleNodeData;
  const [moduleConfig, setModuleConfig] = useState<ModuleConfiguration | null>(
    null
  );
  const [parameters, setParameters] = useState<Record<string, Parameter>>({});

  // 使用 useRef 存储订阅，以便在组件卸载时取消订阅
  const subscriptions = useRef<{ unsubscribe: () => void }[]>([]);

  // 加载模块的所有参数
  const loadModuleParameters = useCallback(() => {
    // 清理之前的订阅
    subscriptions.current.forEach((sub) => sub.unsubscribe());
    subscriptions.current = [];

    // 获取模块参数 - 通过新的参数系统
    const moduleParamsSub = Services.parameterSystem
      .getModuleParameters$(nodeData.moduleId)
      .subscribe((params) => {
        // 将参数对象转换为UI组件所需的格式
        const parameterMap: Record<string, Parameter> = {};

        Object.entries(params || {}).forEach(([paramId, paramData]) => {
          // 构建带有UI状态的参数对象
          const param: Parameter = {
            id: paramId,
            name: paramId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: (paramData.type || 'number') as any,
            value: paramData.value,
            defaultValue: paramData.defaultValue,
            min: paramData.min,
            max: paramData.max,
            step: paramData.step,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            options: paramData.options as any,
            unit: paramData.unit,
            label: paramData.label || paramId,
            isAutomated: paramData.automated || false,
            automationRange: paramData.automationRange,
            displayValue: paramData.value,
            automationAmount: 1.0,
            automationSource: null,
            // 其他UI相关状态
            visible: paramData.visible !== false,
            disabled: paramData.disabled || false,
            automatable: paramData.automatable || false,
          };

          // 添加到参数映射
          parameterMap[paramId] = param;

          // 获取参数的自动化状态
          const stateSub = Services.parameterSystem
            .getParameterState$(nodeData.moduleId, paramId)
            .subscribe((state) => {
              setParameters((prevParams) => ({
                ...prevParams,
                [paramId]: {
                  ...(prevParams[paramId] || {}),
                  // 动态更新值和状态
                  value: state.value,
                  isAutomated: state.automated || false,
                  automationRange: state.automationRange,
                  displayValue: state.value,
                } as Parameter,
              }));
            });

          subscriptions.current.push(stateSub);
        });

        // 初始设置参数
        setParameters(parameterMap);
      });

    subscriptions.current.push(moduleParamsSub);
  }, [nodeData.moduleId]);

  useEffect(() => {
    // 根据 moduleTypeId 获取模块配置
    const config = moduleRegistry.getById(nodeData.moduleTypeId);
    if (config) {
      setModuleConfig(config);
    }

    // 获取模块参数
    loadModuleParameters();

    // 订阅参数变化
    const subscription = Services.parameterSystem
      .getModuleParameterChanges$(nodeData.moduleId)
      .subscribe(() => {
        // 当参数发生变化时重新加载参数状态
        loadModuleParameters();
      });

    subscriptions.current.push(subscription);

    return () => {
      // 清理所有订阅
      subscriptions.current.forEach((sub) => sub.unsubscribe());
      subscriptions.current = [];
    };
  }, [nodeData.moduleTypeId, nodeData.moduleId, loadModuleParameters]);

  // 处理参数控制器变化
  const handleSliderChange = useCallback(
    (key: string, newValue: ParameterValue) => {
      Services.parameterSystem.updateParameterValue(
        nodeData.moduleId,
        key,
        newValue,
        'ui'
      );

      // 本地状态更新，用于即时UI反馈
      setParameters((prev) => {
        const updated = { ...prev };
        if (updated[key]) {
          updated[key] = {
            ...updated[key],
            value: newValue,
            displayValue: newValue,
          };
        }
        return updated;
      });
    },
    [nodeData.moduleId]
  );

  // 处理自动化范围变化
  const handleModRangeChange = useCallback(
    (paramId: string, range: number[]) => {
      if (range.length !== 2) return;

      // 更新自动化范围
      Services.parameterSystem.setParameterAutomationRange(
        nodeData.moduleId,
        paramId,
        range[0],
        range[1]
      );

      // 更新本地状态用于UI反馈
      setParameters((prev) => {
        const updated = { ...prev };
        if (updated[paramId]) {
          updated[paramId] = {
            ...updated[paramId],
            automationRange: range as [number, number],
          };
        }
        return updated;
      });
    },
    [nodeData.moduleId]
  );

  // 处理自动化开关
  const handleAutomationToggle = useCallback(
    (paramId: string, enabled: boolean) => {
      if (enabled) {
        // 这里只是启用自动化准备，实际的自动化连接需要在连线时创建
        setParameters((prev) => {
          const updated = { ...prev };
          if (updated[paramId]) {
            updated[paramId] = {
              ...updated[paramId],
              isAutomationEnabled: true,
            };
          }
          return updated;
        });
      } else {
        // 禁用自动化
        Services.parameterSystem.removeParameterAutomation(
          nodeData.moduleId,
          paramId,
          '', // 源模块ID，空字符串表示移除所有
          '' // 源参数ID，空字符串表示移除所有
        );

        // 更新本地状态
        setParameters((prev) => {
          const updated = { ...prev };
          if (updated[paramId]) {
            updated[paramId] = {
              ...updated[paramId],
              isAutomated: false,
              isAutomationEnabled: false,
            };
          }
          return updated;
        });
      }
    },
    [nodeData.moduleId]
  );

  return (
    <div
      className="module-node"
      style={{
        backgroundColor: moduleConfig?.ui?.color
          ? String(moduleConfig.ui.color)
          : '#cccccc',
        borderRadius: '8px',
        minWidth: '240px',
        width: '100%',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {/* 标题区域 */}
      <ModuleHeader
        label={nodeData.label}
        category={String(moduleConfig?.metadata?.category || '')}
      />
      <div className="bg-white bg-opacity-90 rounded-md">
        {/* 输入/输出端口区域 */}
        <div className="px-0 pt-3 pb-1">
          <div className="flex justify-between">
            <div className="flex-1">
              {moduleConfig &&
                moduleConfig.interfaces.inputs.map((input: ModuleInterface) => (
                  <PortContainer key={input.id}>
                    <PortHandle
                      type="target"
                      position={Position.Left}
                      id={input.id}
                      dataType={input.dataType}
                      style={{ left: '0px' }}
                    />
                    <span className="text-xs ml-2">{input.label}</span>
                  </PortContainer>
                ))}
            </div>
            <div className="flex-1">
              {moduleConfig &&
                moduleConfig.interfaces.outputs.map(
                  (output: ModuleInterface) => (
                    <PortContainer key={output.id} isOutput={true}>
                      <span className="text-xs mr-2">{output.label}</span>
                      <PortHandle
                        type="source"
                        position={Position.Right}
                        id={output.id}
                        dataType={output.dataType}
                        style={{ right: '0px' }}
                      />
                    </PortContainer>
                  )
                )}
            </div>
          </div>
        </div>

        {/* 参数控制区域 */}
        {Object.keys(parameters).length > 0 && (
          <div className="nodrag parameters-container border-t border-gray-200 px-3 py-2">
            {Object.entries(parameters).map(([key, param]) => (
              <ParameterControl
                key={key}
                paramKey={key}
                param={param}
                modInputId={`mod_${key}`}
                handleSliderChange={handleSliderChange}
                handleModRangeChange={handleModRangeChange}
                handleAutomationToggle={handleAutomationToggle}
                isModulatable={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleNode;
