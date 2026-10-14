import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { PORT_COLORS, PortType } from '@/core/base/ModuleBase';

// 输入端口组件
export const InputPort = ({
  portKey,
  value,
  portType,
  index,
  isSelected,
}: {
  portKey: string;
  value: unknown;
  portType: PortType;
  index: number;
  isSelected: boolean;
}) => {
  const portColor = PORT_COLORS[portType];
  const portPosition = 40 + index * 28; // 端口间距调整为28px

  // 确定显示的值
  const displayValue = () => {
    if (
      portType === PortType.MIDI &&
      value &&
      typeof value === 'object' &&
      'activeNotes' in value &&
      Array.isArray((value as { activeNotes?: unknown }).activeNotes)
    ) {
      return `MIDI ${(value as { activeNotes: unknown[] }).activeNotes.length}`;
    } else if (portType === PortType.ARRAY && Array.isArray(value)) {
      // 如果是数组类型，显示前几个数字
      const numbers = value.filter((v) => typeof v === 'number');
      if (numbers.length > 0) {
        const displayLimit = 3; // 最多显示3个数字
        const displayedNumbers = numbers
          .slice(0, displayLimit)
          .map((n) => n.toFixed(1));
        return `[${displayedNumbers.join(', ')}${numbers.length > displayLimit ? ', ...' : ''}]`;
      } else {
        return '[]'; // 空数组或非数字数组
      }
    } else if (typeof value === 'number') {
      return value.toFixed(2);
    } else if (value !== undefined && value !== null && value !== '') {
      return '🔊'; // 音频或其他非空值显示声音emoji
    } else {
      return '–';
    }
  };

  return (
    <div key={`input-container-${portKey}`}>
      <Handle
        key={`input-${portKey}`}
        type="target"
        position={Position.Left}
        id={portKey}
        style={{ top: portPosition, backgroundColor: portColor }}
        className="w-2 h-2"
        isConnectable={true}
        data-port-type={portType} // 添加自定义属性存储端口类型
      />
      {isSelected && (
        <div
          className="text-xs text-gray-700 absolute px-2 py-1 bg-white/60 border border-gray-200 rounded shadow-sm z-10 whitespace-nowrap text-right"
          style={{
            top: portPosition - 2,
            transform: 'translateY(-50%)',
            right: 'calc(100% + 10px)',
            left: 'auto',
          }}
        >
          {portKey}: {displayValue()}
        </div>
      )}
    </div>
  );
};

// 输出端口组件
export const OutputPort = ({
  portKey,
  value,
  portType,
  index,
  isSelected,
}: {
  portKey: string;
  value: unknown;
  portType: PortType;
  index: number;
  isSelected: boolean;
}) => {
  const portColor = PORT_COLORS[portType];
  const portPosition = 40 + index * 28; // 端口间距调整为28px

  // 确定显示的值
  const displayValue = () => {
    if (
      portType === PortType.MIDI &&
      value &&
      typeof value === 'object' &&
      'activeNotes' in value &&
      Array.isArray((value as { activeNotes?: unknown }).activeNotes)
    ) {
      return `MIDI ${(value as { activeNotes: unknown[] }).activeNotes.length}`;
    } else if (portType === PortType.ARRAY && Array.isArray(value)) {
      // 如果是数组类型，显示前几个数字
      const numbers = value.filter((v) => typeof v === 'number');
      if (numbers.length > 0) {
        const displayLimit = 3; // 最多显示3个数字
        const displayedNumbers = numbers
          .slice(0, displayLimit)
          .map((n) => n.toFixed(1));
        return `[${displayedNumbers.join(', ')}${numbers.length > displayLimit ? ', ...' : ''}]`;
      } else {
        return '[]'; // 空数组或非数字数组
      }
    } else if (typeof value === 'number') {
      return value.toFixed(2);
    } else if (value !== undefined && value !== null && value !== '') {
      return '🔊'; // 音频或其他非空值显示声音emoji
    } else {
      return '–';
    }
  };

  return (
    <div key={`output-container-${portKey}`} className="text-right">
      <Handle
        key={`output-${portKey}`}
        type="source"
        position={Position.Right}
        id={portKey}
        style={{ top: portPosition, backgroundColor: portColor }}
        className="w-2 h-2"
        isConnectable={true}
        data-port-type={portType} // 添加自定义属性存储端口类型
      />
      {isSelected && (
        <div
          className="text-xs text-gray-700 absolute px-2 py-1 bg-white/60 border border-gray-200 rounded shadow-sm z-10 whitespace-nowrap text-left"
          style={{
            top: portPosition - 2,
            transform: 'translateY(-50%)',
            left: 'calc(100% + 10px)',
            right: 'auto',
          }}
        >
          {portKey}: {displayValue()}
        </div>
      )}
    </div>
  );
};
