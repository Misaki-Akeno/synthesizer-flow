import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { PORT_COLORS, PortType } from '@/core/base/ModuleBase';
import { useRuntimeModuleTelemetry } from '@/core/hooks/useRuntimeModule';

type PortDirection = 'input' | 'output';

interface ModulePortProps {
  moduleId: string;
  portKey: string;
  portType: PortType;
  index: number;
  /** 选中节点时才挂载端口值标签，也只有这时才订阅端口遥测。 */
  isSelected: boolean;
}

/** 端口 Handle 的纵向位置；LOD 占位卡片也依赖它保持连线锚点不变。 */
export function getPortOffset(index: number): number {
  return 40 + index * 28; // 端口间距 28px
}

// 确定显示的值
function formatPortValue(value: unknown, portType: PortType): string {
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
}

const PortValueLabel = ({
  moduleId,
  portKey,
  portType,
  top,
  direction,
}: {
  moduleId: string;
  portKey: string;
  portType: PortType;
  top: number;
  direction: PortDirection;
}) => {
  const telemetry = useRuntimeModuleTelemetry(moduleId);
  const value =
    direction === 'input'
      ? telemetry?.inputValues[portKey]
      : telemetry?.outputValues[portKey];

  return (
    <div
      className={`text-xs text-gray-700 absolute px-2 py-1 bg-white/60 border border-gray-200 rounded shadow-sm z-10 whitespace-nowrap ${direction === 'input' ? 'text-right' : 'text-left'}`}
      style={{
        top: top - 2,
        transform: 'translateY(-50%)',
        ...(direction === 'input'
          ? { right: 'calc(100% + 10px)', left: 'auto' }
          : { left: 'calc(100% + 10px)', right: 'auto' }),
      }}
    >
      {portKey}: {formatPortValue(value, portType)}
    </div>
  );
};

const ModulePort = ({
  moduleId,
  portKey,
  portType,
  index,
  isSelected,
  direction,
}: ModulePortProps & { direction: PortDirection }) => {
  const portPosition = getPortOffset(index);

  return (
    <div className={direction === 'output' ? 'text-right' : undefined}>
      <Handle
        type={direction === 'input' ? 'target' : 'source'}
        position={direction === 'input' ? Position.Left : Position.Right}
        id={portKey}
        style={{ top: portPosition, backgroundColor: PORT_COLORS[portType] }}
        className="w-2 h-2"
        isConnectable={true}
        data-port-type={portType} // 添加自定义属性存储端口类型
      />
      {isSelected && (
        <PortValueLabel
          moduleId={moduleId}
          portKey={portKey}
          portType={portType}
          top={portPosition}
          direction={direction}
        />
      )}
    </div>
  );
};

// 输入端口组件
export const InputPort = memo((props: ModulePortProps) => (
  <ModulePort {...props} direction="input" />
));
InputPort.displayName = 'InputPort';

// 输出端口组件
export const OutputPort = memo((props: ModulePortProps) => (
  <ModulePort {...props} direction="output" />
));
OutputPort.displayName = 'OutputPort';
