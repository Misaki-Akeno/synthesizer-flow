/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Slider } from '@/components/ui/slider';

// 定义 PortHandle 的类型
interface PortHandleProps {
  type: 'source' | 'target';
  position: Position;
  id: string;
  dataType: string;
  style?: React.CSSProperties;
}

export const PortHandle: React.FC<PortHandleProps> = ({
  type,
  position,
  id,
  dataType,
  style = {},
}) => {
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

// 定义 ModuleHeader 的类型
interface ModuleHeaderProps {
  label: string;
  category: string;
}

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  label,
  category,
}) => {
  return (
    <div className="py-1.5 px-2">
      <div className="font-bold text-sm">{label}</div>
      <div className="text-xs opacity-80">{category}</div>
    </div>
  );
};

// 定义 PortContainer 的类型
interface PortContainerProps {
  children: React.ReactNode;
  isOutput?: boolean;
}

export const PortContainer: React.FC<PortContainerProps> = ({
  children,
  isOutput = false,
}) => {
  const alignment = isOutput ? 'justify-end' : '';
  return (
    <div
      className={`port-container relative mb-2 flex items-center ${alignment}`}
    >
      {children}
    </div>
  );
};

// 定义 ParameterControl 的类型
interface ParameterControlProps {
  paramKey: string;
  param: any;
  isModulatable: boolean;
  modInputId: string;
  handleSliderChange: (key: string, newValue: any) => void;
  handleModRangeChange: (key: string, newRange: any) => void;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
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

// 定义 renderParameterControl 方法的参数类型
const renderParameterControl = (
  param: any,
  key: string,
  handleSliderChange: (key: string, newValue: any) => void,
  handleModRangeChange: (key: string, newRange: any) => void
): React.ReactNode => {
  // 根据参数类型渲染不同控件
  switch (param.type.toString().toUpperCase()) {
    case 'ENUM':
      // 检查选项是否存在
      if (
        !param.options ||
        !Array.isArray(param.options) ||
        param.options.length === 0
      ) {
        // 如果没有选项或选项为空数组，显示错误信息
        return (
          <div className="w-full text-xs p-1 border rounded bg-red-50 text-red-500">
            枚举选项为空，请检查参数配置
            <div className="text-[9px] mt-1">参数 ID: {param.id || key}</div>
          </div>
        );
      }

      // 正常渲染选择框
      return (
        <select
          value={param.value}
          onChange={(e) => handleSliderChange(key, e.target.value)}
          className="w-full text-xs p-1 border rounded"
        >
          {param.options.map((option: any) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case 'BOOLEAN':
      // 如果是普通布尔值而非触发按钮，使用复选框
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
      return null; // 触发按钮由上面的特殊处理块处理

    case 'STRING':
      return (
        <input
          type="text"
          value={param.value || ''}
          onChange={(e) => handleSliderChange(key, e.target.value)}
          className="w-full text-xs p-1 border rounded"
          placeholder={param.placeholder || ''}
        />
      );

    case 'NUMBER':
    case 'INTEGER':
      return (
        <div className="w-full relative pt-0 pb-1">
          {!param.isModulated ? (
            <Slider
              min={param.min || 0}
              max={param.max || 100}
              step={
                param.step ||
                (param.type.toString().toUpperCase() === 'INTEGER' ? 1 : 0.01)
              }
              value={[param.value || 0]}
              onValueChange={(newValue: number[]) =>
                handleSliderChange(key, newValue[0])
              }
              className="h-4"
            />
          ) : (
            <>
              <Slider
                min={param.min || 0}
                max={param.max || 100}
                step={
                  param.step ||
                  (param.type.toString().toUpperCase() === 'INTEGER' ? 1 : 0.01)
                }
                value={[
                  param.modRange ? param.modRange[0] : param.min,
                  param.modRange ? param.modRange[1] : param.max,
                ]}
                onValueChange={(newValue: number[]) =>
                  handleModRangeChange(key, newValue)
                }
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
        </div>
      );

    case 'OBJECT':
      return (
        <div className="w-full text-xs p-1 border rounded bg-gray-50">
          <pre className="whitespace-pre-wrap break-all overflow-hidden max-h-20">
            {JSON.stringify(param.value, null, 2)}
          </pre>
          <button
            className="text-xs mt-1 bg-gray-200 rounded px-2 py-0.5"
            onClick={() => alert('对象编辑功能尚未实现')}
          >
            编辑
          </button>
        </div>
      );

    default:
      // 未知类型的参数，显示为只读文本
      return (
        <div className="w-full text-xs p-1 border rounded bg-gray-50">
          {String(param.value)}
          <div className="text-[9px] text-gray-500">
            未知参数类型: {param.type}
          </div>
        </div>
      );
  }
};

// Define color mapping for different data types
const DATA_TYPE_COLORS: Record<string, string> = {
  AUDIO: '#ff5722',
  CONTROL: '#3498db',
  TRIGGER: '#e74c3c',
  NUMBER: '#2ecc71',
  STRING: '#9b59b6',
  BOOLEAN: '#f1c40f',
  CUSTOM: '#95a5a6',
};

export const getPortColor = (dataType: string): string => {
  return DATA_TYPE_COLORS[dataType] || DATA_TYPE_COLORS.CUSTOM;
};
