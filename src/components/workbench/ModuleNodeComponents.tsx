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
    <div className="parameter-control relative mb-2">
      {/* 参数标签和控件的水平布局 */}
      <div className="flex items-center">
        {/* 左侧: 调制输入端口和标签 */}
        <div className="flex items-center w-10 min-w-[5rem] flex-shrink-0">
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
          <label className="text-xs font-medium truncate" title={param.label || paramKey}>
            {param.label || paramKey}:
          </label>
        </div>
        
        {/* 右侧: 参数控件 */}
        <div className="flex-1 flex items-center">
          {renderParameterControl(
            param,
            paramKey,
            handleSliderChange,
            handleModRangeChange
          )}
          
          {/* 当前值显示 - 修正条件判断 */}
          {(param.type && (param.type.toString().toUpperCase() === "NUMBER" || param.type.toString().toUpperCase() === "INTEGER")) && (
            <div className="ml-2 w-14 flex-shrink-0">
              <input
                type="number"
                className="w-full text-xs p-1 border rounded"
                value={param.value || 0}
                min={param.min || 0}
                max={param.max || 100}
                step={param.step || (param.type.toString().toUpperCase() === "INTEGER" ? 1 : 0.01)}
                onChange={(e) => handleSliderChange(paramKey, parseFloat(e.target.value))}
              />
            </div>
          )}
          
          {/* 单位显示 */}
          {param.unit && (
            <span className="text-xs ml-1">{param.unit}</span>
          )}
          
          {/* 调制指示器 */}
          {param.isModulated && (
            <span className="text-blue-500 ml-1 text-xs">~</span>
          )}
        </div>
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
        <div className="flex-1 relative">
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
              className="h-3"
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
                className="h-3"
              />

              {param.isModulated && param.displayValue && (
                <div
                  className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none"
                >
                  <div
                    className="absolute w-2 h-2 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `${((parseFloat(param.displayValue) - param.min) / (param.max - param.min)) * 100}%`,
                      top: '50%',
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
        <div className="flex-1 text-xs flex items-center">
          <div className="border rounded bg-gray-50 px-2 py-0.5 truncate flex-1" title={JSON.stringify(param.value)}>
            {JSON.stringify(param.value).substring(0, 20)}
            {JSON.stringify(param.value).length > 20 ? '...' : ''}
          </div>
          <button
            className="text-xs ml-2 bg-gray-200 rounded px-2 py-0.5"
            onClick={() => alert('对象编辑功能尚未实现')}
          >
            编辑
          </button>
        </div>
      );

    default:
      // 未知类型的参数，显示为只读文本
      return (
        <div className="flex-1 text-xs p-1 border rounded bg-gray-50">
          {String(param.value)}
          <span className="text-[9px] text-gray-500 ml-1">
            ({param.type})
          </span>
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
