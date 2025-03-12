import React, { useEffect, useState } from 'react';
import { Position, NodeProps } from '@xyflow/react';
import { ModuleInterface, ModuleConfiguration } from '@/types/module';
import { Parameter } from '@/types/parameter';
import parametersService from '@/core/services/ParametersService';
import { moduleRegistry } from '@/core/services/ModuleRegistry';

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

  useEffect(() => {
    // 根据 moduleTypeId 获取模块配置
    const config = moduleRegistry.getById(nodeData.moduleTypeId);
    if (config) {
      setModuleConfig(config);
    }
    // 获取模块参数
    const moduleParams = parametersService.getParameters(nodeData.moduleId);
    setParameters(moduleParams);
  }, [nodeData.moduleTypeId, nodeData.moduleId]);

  // 处理参数控制器滑块变化
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSliderChange = (key: string, newValue: any) => {
    parametersService.setParameterValue(nodeData.moduleId, key, newValue);
    setParameters({
      ...parameters,
      [key]: { ...parameters[key], value: newValue },
    });
  };

  return (
    <div
      className="module-node"
      style={{
        backgroundColor: moduleConfig?.color
          ? String(moduleConfig.color)
          : '#cccccc',
        borderRadius: '6px',
        minWidth: '240px',
        width: '100%',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {/* 标题区域 */}
      <ModuleHeader
        label={nodeData.label}
        category={String(moduleConfig?.category || '')}
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
          <div className="nodrag parameters-container border-t border-gray-200 px-2 py-2">
            {Object.entries(parameters).map(([key, param]) => (
              <ParameterControl
                key={key}
                paramKey={key}
                param={param}
                isModulatable={false}
                modInputId=""
                handleSliderChange={handleSliderChange}
                handleModRangeChange={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleNode;
