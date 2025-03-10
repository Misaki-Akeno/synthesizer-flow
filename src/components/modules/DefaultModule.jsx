import React from 'react';
import { Position } from '@xyflow/react';
import useRootStore from '@/core/store/rootStore';
import {
  ModuleHeader,
  PortContainer,
  ParameterControl,
  PortHandle,
} from '@/components/modules/DefaultModuleComponents.jsx';

const DefaultModule = ({ data, id }) => {
  const {
    label,
    moduleId,
    category,
    color = '#cccccc',
    inputs = [],
    outputs = [],
    parameters = {},
    moduleConfig,
  } = data;

  // 从 store 获取相关函数
  const { updateNodeParameter } = useRootStore();

  // 从moduleConfig中提取可调制参数信息
  const modulatableParams = moduleConfig
    ? Object.keys(moduleConfig.parameters || {}).filter(
        (key) => moduleConfig.parameters[key].modulatable === true
      )
    : [];

  // 将输入分为常规输入和调制输入
  const regularInputs = inputs.filter((input) => !input.isModulationInput);

  // 处理滑块值变化
  const handleSliderChange = (key, newValue) => {
    updateNodeParameter(id, {
      type: 'PARAMETER_CHANGE',
      parameterKey: key,
      parameterValue: newValue,
    });
  };

  // 处理调制范围滑块值变化
  const handleModRangeChange = (key, newRange) => {
    updateNodeParameter(id, {
      type: 'MOD_RANGE_CHANGE',
      parameterKey: key,
      modRange: newRange,
    });
  };

  return (
    <div
      className="module-node"
      style={{
        backgroundColor: color,
        borderRadius: '6px',
        minWidth: '240px',
        width: '100%',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {/* 标题区域 */}
      <ModuleHeader label={label} category={category} />

      {/* 内容区域 - 浅白色背景的圆角矩形 */}
      <div className="bg-white bg-opacity-90 rounded-md">
        {/* 顶部输入/输出端口区域 - 显示常规输入输出 */}
        <div className="px-0 pt-3 pb-1">
          <div className="flex justify-between">
            {/* 左侧常规输入端口 */}
            <div className="flex-1">
              {regularInputs.map((input) => (
                <PortContainer key={input.id}>
                  <PortHandle
                    type="target"
                    position={Position.Left}
                    id={input.id}
                    dataType={input.dataType}
                    style={{ left: '0px' }}
                  />
                  <span className="text-xs ml-2 flex-grow">{input.label}</span>
                </PortContainer>
              ))}
            </div>

            {/* 右侧输出端口 */}
            <div className="flex-1">
              {outputs.map((output) => (
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
              ))}
            </div>
          </div>
        </div>

        {/* 参数控制区域 - 每个可调制参数都有调制输入接口 */}
        {Object.keys(parameters).length > 0 && (
          <div className="nodrag parameters-container border-t border-gray-200 px-2 py-2">
            {Object.entries(parameters).map(([key, param]) => {
              // 判断此参数是否可调制
              const isModulatable = modulatableParams.includes(key);
              // 生成唯一的调制输入ID
              const modInputId = `mod_${moduleId}_${key}`;

              return (
                <ParameterControl
                  key={key}
                  paramKey={key}
                  param={param}
                  isModulatable={isModulatable}
                  modInputId={modInputId}
                  handleSliderChange={handleSliderChange}
                  handleModRangeChange={handleModRangeChange}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DefaultModule;
