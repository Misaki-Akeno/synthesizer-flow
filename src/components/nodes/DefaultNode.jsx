import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { DataType } from '../../constants/moduleTypes';

const DefaultNode = ({ data }) => {
  const {
    label,
    moduleId,
    category,
    color = '#cccccc',
    inputs = [],
    outputs = [],
    parameters = {},
  } = data;

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
        {/* 顶部输入/输出端口区域 */}
        <div className="px-0 py-2">
          <div className="flex justify-between">
            {/* 左侧所有输入端口（普通和调制） */}
            <div className="flex-1">
              {inputs.map((input) => (
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
                      left: '0px', // 放到左侧边缘
                    }}
                  />
                  <span className="text-xs ml-2 flex-grow">
                    {input.label}
                    {input.dataType === 'CONTROL' && (
                      <span className="text-blue-500 ml-1 text-xs">(调制)</span>
                    )}
                  </span>
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
                      right: '0px', // 放到右侧边缘
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 参数控制区域 - 添加 nodrag 属性 */}
        {Object.keys(parameters).length > 0 && (
          <div className="nodrag parameters-container border-t border-gray-200 px-2 py-2">
            {Object.entries(parameters).map(([key, param]) => (
              <div key={key} className="parameter-control mb-3">
                {/* 参数标签和值 */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    <label className="text-xs font-medium ml-0">
                      {param.label || key}:
                    </label>
                  </div>
                  <span className="text-xs">{param.value || 0}</span>
                </div>

                {/* 参数滑块 */}
                <input
                  type="range"
                  min={param.min || 0}
                  max={param.max || 100}
                  value={param.value || 0}
                  onChange={(e) => {
                    const newValue = parseFloat(e.target.value);
                    if (data.onParameterChange) {
                      data.onParameterChange(key, newValue);
                    }
                  }}
                  className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer"
                />
              </div>
            ))}
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
