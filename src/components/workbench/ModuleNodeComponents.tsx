/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
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
  isAutomatable: boolean;
  modInputId: string;
  handleSliderChange: (key: string, newValue: any) => void;
  handleModRangeChange: (key: string, newRange: any) => void;
  handleAutomationToggle?: (key: string, enabled: boolean) => void;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  paramKey,
  param,
  isAutomatable: isAutomatable,
  modInputId,
  handleSliderChange,
  handleModRangeChange,
  handleAutomationToggle,
}) => {
  const [showAutomationControls, setShowAutomationControls] = useState(false);

  // 是否为数值类型参数
  const isNumericParam = param.type && 
    (param.type.toString().toUpperCase() === 'NUMBER' || 
     param.type.toString().toUpperCase() === 'INTEGER');

  return (
    <div className="parameter-control relative mb-2">
      {/* 参数标签和控件的水平布局 */}
      <div className="flex items-center">
        {/* 左侧: 自动化输入端口和标签 */}
        <div className="flex items-center w-10 min-w-[5rem] flex-shrink-0">
          {isAutomatable && (
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
              {isNumericParam && (
                <button 
                  className={`absolute -left-1 top-8 text-xs p-0.5 rounded-sm ${showAutomationControls || param.isAutomated ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                  onClick={() => {
                    setShowAutomationControls(!showAutomationControls);
                    if (handleAutomationToggle && !showAutomationControls && !param.isAutomated) {
                      handleAutomationToggle(paramKey, true);
                    }
                  }}
                  title="自动化设置"
                >
                  A
                </button>
              )}
            </div>
          )}
          <label
            className="text-xs font-medium truncate"
            title={param.label || paramKey}
          >
            {param.label || paramKey}:
          </label>
        </div>

        {/* 右侧: 参数控件 */}
        <div className="flex-1 flex items-center">
          {renderParameterControl(
            param,
            paramKey,
            handleSliderChange,
            handleModRangeChange,
            showAutomationControls || param.isAutomated
          )}

          {/* 当前值显示 - 修正条件判断 */}
          {isNumericParam && (
            <div className="ml-2 w-14 flex-shrink-0">
              <input
                type="number"
                className="w-full text-xs p-1 border rounded"
                value={param.value || 0}
                min={param.min || 0}
                max={param.max || 100}
                step={
                  param.step ||
                  (param.type.toString().toUpperCase() === 'INTEGER'
                    ? 1
                    : 0.01)
                }
                onChange={(e) =>
                  handleSliderChange(paramKey, parseFloat(e.target.value))
                }
              />
            </div>
          )}

          {/* 单位显示 */}
          {param.unit && <span className="text-xs ml-1">{param.unit}</span>}

          {/* 自动化指示器 */}
          {param.isAutomated && (
            <span className="text-blue-500 ml-1 text-xs animate-pulse">~</span>
          )}
        </div>
      </div>
      
      {/* 自动化范围控制区域 */}
      {isNumericParam && showAutomationControls && (
        <div className="ml-12 mt-1 text-xs">
          <div className="flex items-center">
            <span className="mr-2">范围:</span>
            <div className="flex-1">
              <Slider
                min={param.min || 0}
                max={param.max || 100}
                step={param.step || (param.type.toString().toUpperCase() === 'INTEGER' ? 1 : 0.01)}
                value={[
                  param.automationRange ? param.automationRange[0] : (param.min || 0),
                  param.automationRange ? param.automationRange[1] : (param.max || 100)
                ]}
                onValueChange={(values) => handleModRangeChange(paramKey, values)}
                className="h-2"
              />
            </div>
            <div className="ml-2 w-20 flex text-xs items-center justify-between">
              <span>{param.automationRange ? param.automationRange[0].toFixed(1) : (param.min || 0)}</span>
              <span>{param.automationRange ? param.automationRange[1].toFixed(1) : (param.max || 100)}</span>
            </div>
          </div>
          {handleAutomationToggle && (
            <div className="mt-1 flex justify-end">
              <button
                className="text-xs bg-red-100 text-red-700 rounded px-2 py-0.5"
                onClick={() => handleAutomationToggle(paramKey, false)}
              >
                关闭自动化
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 定义 renderParameterControl 方法的参数类型
const renderParameterControl = (
  param: any,
  key: string,
  handleSliderChange: (key: string, newValue: any) => void,
  handleModRangeChange: (key: string, newRange: any) => void,
  showAutomationControls: boolean
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
          {!showAutomationControls ? (
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
                value={[param.value || 0]}
                onValueChange={(newValue: number[]) =>
                  handleSliderChange(key, newValue[0])
                }
                className="h-3"
              />

              {param.isAutomated && param.displayValue !== undefined && (
                <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
                  <div
                    className="absolute w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `${((parseFloat(param.displayValue) - (param.min || 0)) / ((param.max || 100) - (param.min || 0))) * 100}%`,
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
          <div
            className="border rounded bg-gray-50 px-2 py-0.5 truncate flex-1"
            title={JSON.stringify(param.value)}
          >
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
          <span className="text-[9px] text-gray-500 ml-1">({param.type})</span>
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
