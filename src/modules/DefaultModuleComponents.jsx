import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Slider } from '@/components/ui/slider';
import { DATA_TYPE_COLORS } from '@/lib/constants/moduleTypes';

// 控制端口组件
export const PortHandle = ({ type, position, id, dataType, style = {} }) => {
  return (
    <Handle
      type={type}
      position={position}
      id={id}
      style={{
        background: getPortColor(dataType),
        width: '12px',
        height: '12px',
        ...style,
      }}
    />
  );
};

// 模块标题组件
export const ModuleHeader = ({ label, category }) => {
  return (
    <div className="py-1.5 px-2">
      <div className="font-bold text-sm">{label}</div>
      <div className="text-xs opacity-80">{category}</div>
    </div>
  );
};

// 端口容器组件
export const PortContainer = ({ children, isOutput = false }) => {
  const alignment = isOutput ? 'justify-end' : '';
  return (
    <div
      className={`port-container relative mb-2 flex items-center ${alignment}`}
    >
      {children}
    </div>
  );
};

// 参数控制器组件
export const ParameterControl = ({
  paramKey,
  param,
  isModulatable,
  modInputId,
  handleSliderChange,
  handleModRangeChange,
}) => {
  return (
    <div className="parameter-control relative">
      {/* 参数标签和当前值 */}
      <div className="flex items-center justify-between mb-1 pt-1 pb-0">
        <div className="flex items-center">
          {/* 调制端口 */}
          {isModulatable && (
            <div
              className="relative flex items-center justify-center mr-1"
              style={{ width: '2px', height: '16px' }}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={modInputId}
                style={{
                  background: '#3498db',
                  width: '8px',
                  height: '8px',
                  left: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          )}

          <label className="text-xs font-medium ml-0">
            {param.label || paramKey}:
          </label>
        </div>

        <div className="flex items-center">
          {param.isModulated && (
            <span className="text-blue-500 mr-1 text-xs">~</span>
          )}
          <span className="text-xs">
            {param.displayValue || param.value || 0}
            {param.unit && <span className="ml-0.5">{param.unit}</span>}
          </span>
        </div>
      </div>

      {/* 参数控制器 - 基于参数类型 */}
      <div className="flex items-center relative">
        {renderParameterControl(
          param,
          paramKey,
          handleSliderChange,
          handleModRangeChange
        )}
      </div>
    </div>
  );
};

// 渲染不同类型的参数控制器
const renderParameterControl = (
  param,
  key,
  handleSliderChange,
  handleModRangeChange
) => {
  if (param.type === 'ENUM') {
    return (
      <select
        value={param.value}
        onChange={(e) => handleSliderChange(key, e.target.value)}
        className="w-full text-xs p-1 border rounded"
      >
        {param.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else if (param.type === 'BOOLEAN') {
    return (
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={!!param.value}
          onChange={(e) => handleSliderChange(key, e.target.checked)}
          className="mr-1"
        />
        <span className="text-xs">{param.label}</span>
      </label>
    );
  } else {
    return (
      <div className="w-full relative pt-0 pb-1">
        {!param.isModulated ? (
          <Slider
            min={param.min || 0}
            max={param.max || 100}
            step={param.step || 1}
            value={[param.value || 0]}
            onValueChange={(newValue) => handleSliderChange(key, newValue[0])}
            className="h-4"
          />
        ) : (
          <>
            <Slider
              min={param.min || 0}
              max={param.max || 100}
              step={param.step || 1}
              value={[
                param.modRange ? param.modRange[0] : param.min,
                param.modRange ? param.modRange[1] : param.max,
              ]}
              onValueChange={(newValue) => handleModRangeChange(key, newValue)}
              className="h-4"
            />

            {param.isModulated && param.displayValue && (
              <div
                className="ml-2 mr-2 relative"
                style={{ transform: 'translateY(-8px)' }}
              >
                <div
                  className="absolute w-3 h-3 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none mod-display-handle"
                  style={{
                    left: `${((parseFloat(param.displayValue) - param.min) / (param.max - param.min)) * 100}%`,
                    zIndex: 2,
                  }}
                  title={`当前值: ${parseFloat(param.displayValue).toFixed(1)}`}
                ></div>
              </div>
            )}
          </>
        )}
        {/* 调试信息 */}
        <div className="text-[9px] text-gray-400 mt-1 bg-gray-100 p-1 rounded">
          <details>
            <summary className="cursor-pointer">Debug Info</summary>
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(
                {
                  value: param.value,
                  displayValue: param.displayValue,
                  modRange: param.modRange,
                  isModulated: param.isModulated,
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      </div>
    );
  }
};

// 根据数据类型获取端口颜色
export const getPortColor = (dataType) => {
  // 使用常量文件中定义的颜色
  return DATA_TYPE_COLORS[dataType] || DATA_TYPE_COLORS.CUSTOM;
};
