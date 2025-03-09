import React from 'react';
import { Handle, Position } from '@xyflow/react';

const DefaultNode = ({ data }) => {
  const {
    label,
    moduleId,
    category,
    color = '#cccccc',
    inputs = [],
    outputs = [],
    parameters = {},
    moduleConfig, // 添加对完整模块配置的引用
  } = data;

  // 从moduleConfig中提取可调制参数信息
  const modulatableParams = moduleConfig
    ? Object.keys(moduleConfig.parameters || {}).filter(
        (key) => moduleConfig.parameters[key].modulatable === true
      )
    : [];

  // 将输入分为常规输入和调制输入
  const regularInputs = inputs.filter((input) => !input.isModulationInput);

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
      <div className="py-1.5 px-2">
        <div className="font-bold text-sm">{label}</div>
        <div className="text-xs opacity-80">{category}</div>
      </div>

      {/* 内容区域 - 浅白色背景的圆角矩形 */}
      <div className="bg-white bg-opacity-90 rounded-md">
        {/* 顶部输入/输出端口区域 - 显示常规输入输出 */}
        <div className="px-0 py-2">
          <div className="flex justify-between">
            {/* 左侧常规输入端口 */}
            <div className="flex-1">
              {regularInputs.map((input) => (
                <div
                  key={input.id}
                  className="port-container relative mb-2 flex items-center"
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={input.id}
                    style={{
                      background: getPortColor(input.dataType),
                      width: '12px',
                      height: '12px',
                      left: '0px',
                    }}
                  />
                  <span className="text-xs ml-2 flex-grow">{input.label}</span>
                </div>
              ))}
            </div>

            {/* 右侧输出端口 */}
            <div className="flex-1">
              {outputs.map((output) => (
                <div
                  key={output.id}
                  className="port-container relative mb-2 text-right flex items-center justify-end"
                >
                  <span className="text-xs mr-2">{output.label}</span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={output.id}
                    style={{
                      background: getPortColor(output.dataType),
                      width: '12px',
                      height: '12px',
                      right: '0px',
                    }}
                  />
                </div>
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
                <div key={key} className="parameter-control mb-4 relative">
                  {/* 参数标签和当前值 */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      {/* 调制端口移到最左侧 */}
                      {isModulatable && (
                        <div
                          className="relative flex items-center justify-center mr-1"
                          style={{ width: '16px', height: '16px' }}
                        >
                          <Handle
                            type="target"
                            position={Position.Left}
                            id={modInputId}
                            style={{
                              background: '#3498db', // 调制端口颜色
                              width: '8px',
                              height: '8px',
                              left: '-4px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                            }}
                          />
                          <span className="text-blue-500 text-xs">~</span>
                        </div>
                      )}

                      <label className="text-xs font-medium ml-0">
                        {param.label || key}:
                      </label>
                    </div>

                    <div className="flex items-center">
                      {/* 参数调制状态指示 */}
                      {param.isModulated && (
                        <span className="text-blue-500 mr-1 text-xs">~</span>
                      )}
                      <span className="text-xs">
                        {param.displayValue || param.value || 0}
                        {param.unit && (
                          <span className="ml-0.5">{param.unit}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 参数控制器 - 基于参数类型 */}
                  <div className="flex items-center relative">
                    {param.type === 'ENUM' ? (
                      <select
                        value={param.value}
                        onChange={(e) => {
                          if (data.onParameterChange) {
                            data.onParameterChange(key, e.target.value);
                          }
                        }}
                        className="w-full text-xs p-1 border rounded"
                      >
                        {param.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : param.type === 'BOOLEAN' ? (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={!!param.value}
                          onChange={(e) => {
                            if (data.onParameterChange) {
                              data.onParameterChange(key, e.target.checked);
                            }
                          }}
                          className="mr-1"
                        />
                        <span className="text-xs">{param.label}</span>
                      </label>
                    ) : (
                      // 数值类型参数 - 默认单滑块或调制状态下的双滑块
                      <div className="w-full relative">
                        {/* 基础滑块轨道 */}
                        <div className="w-full h-1.5 bg-gray-300 rounded-full"></div>

                        {/* 当未被调制时，显示普通滑块 */}
                        {!param.isModulated ? (
                          <input
                            type="range"
                            min={param.min || 0}
                            max={param.max || 100}
                            step={param.step || 1}
                            value={param.value || 0}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value);
                              if (data.onParameterChange) {
                                data.onParameterChange(key, newValue);
                              }
                            }}
                            className="absolute top-0 w-full h-1.5 opacity-0 cursor-pointer"
                            style={{ zIndex: 2 }}
                          />
                        ) : (
                          <>

                            {/* 调制范围显示 */}
                            <div
                              className="absolute top-0 h-2 bg-blue-200 rounded-full pointer-events-none"
                              style={{
                                left: `${(((param.modRange ? param.modRange[0] : param.min) - param.min) / (param.max - param.min)) * 100}%`,
                                width: `${(((param.modRange ? param.modRange[1] : param.max) - (param.modRange ? param.modRange[0] : param.min)) / (param.max - param.min)) * 100}%`,
                              }}
                            ></div>

                            {/* 上限滑块 */}
                            <input
                              type="range"
                              min={param.min || 0}
                              max={param.max || 100}
                              step={param.step || 1}
                              value={
                                param.modRange ? param.modRange[1] : param.max
                              }
                              onChange={(e) => {
                                const newMax = parseFloat(e.target.value);
                                const newMin = param.modRange
                                  ? param.modRange[0]
                                  : param.min;
                                if (data.onModRangeChange) {
                                  data.onModRangeChange(key, [
                                    Math.min(newMin, newMax),
                                    newMax,
                                  ]);
                                }
                              }}
                              className="absolute top-0 w-full h-1.5 opacity-0 cursor-pointer mod-range-slider"
                              style={{ zIndex: 3 }}
                            />

                            {/* 下限滑块 */}
                            <input
                              type="range"
                              min={param.min || 0}
                              max={param.max || 100}
                              step={param.step || 1}
                              value={
                                param.modRange ? param.modRange[0] : param.min
                              }
                              onChange={(e) => {
                                const newMin = parseFloat(e.target.value);
                                const newMax = param.modRange
                                  ? param.modRange[1]
                                  : param.max;
                                if (data.onModRangeChange) {
                                  data.onModRangeChange(key, [
                                    newMin,
                                    Math.max(newMin, newMax),
                                  ]);
                                }
                              }}
                              className="absolute top-0 w-full h-1.5 opacity-0 cursor-pointer mod-range-slider"
                              style={{ zIndex: 3 }}
                            />
                          </>
                        )}

                        {/* 滑块手柄 - 当前值位置 */}
                        <div
                          className="absolute top-0 w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/4 pointer-events-none"
                          style={{
                            left: `${((param.value - param.min) / (param.max - param.min)) * 100}%`,
                          }}
                        ></div>

                        {/* 被调制时的当前值指示器 */}
                        {param.isModulated && param.displayValue && (
                          <div
                            className="absolute top-0 w-2 h-2 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none mod-display-handle"
                            style={{
                              left: `${((parseFloat(param.displayValue) - param.min) / (param.max - param.min)) * 100}%`,
                            }}
                          ></div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 调制范围显示文本 - 仅在被调制的数值参数上显示 */}
                  {param.isModulated &&
                    param.type !== 'ENUM' &&
                    param.type !== 'BOOLEAN' && (
                      <div className="flex justify-between mt-1 text-xs text-blue-500">
                        <span>
                          {param.modRange
                            ? param.modRange[0].toFixed(1)
                            : param.min}
                        </span>
                        <span>
                          {param.modRange
                            ? param.modRange[1].toFixed(1)
                            : param.max}
                        </span>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// 根据数据类型获取端口颜色
const getPortColor = (dataType) => {
  switch (dataType) {
    case 'AUDIO':
      return '#e74c3c'; // 红色
    case 'CONTROL':
      return '#3498db'; // 蓝色
    case 'TRIGGER':
      return '#f39c12'; // 橙色
    case 'MIDI':
      return '#9b59b6'; // 紫色
    case 'CLOCK':
      return '#2ecc71'; // 绿色
    default:
      return '#95a5a6'; // 灰色
  }
};

export default DefaultNode;
