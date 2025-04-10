/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useNodes,
  ViewportPortal,
  useReactFlow,
  type XYPosition,
} from '@xyflow/react';
import { ModuleBase } from '../../../core/ModuleBase';

// 安全的JSON序列化函数，处理循环引用
const safeStringify = (obj: any, depth = 0, maxDepth = 2): string => {
  // 避免过深的递归
  if (depth > maxDepth) return '"[Nested Object]"';

  // 处理简单类型
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);

  // 处理BehaviorSubject
  if (obj && typeof obj.getValue === 'function') {
    try {
      const value = obj.getValue();
      return `"BehaviorSubject(${typeof value === 'number' ? value : '[Complex Value]'})"`;
    } catch (_e) {
      return '"BehaviorSubject[Error]"';
    }
  }

  // 处理数组
  if (Array.isArray(obj)) {
    const items = obj.map((item) => {
      try {
        return safeStringify(item, depth + 1, maxDepth);
      } catch (_e) {
        return '"[Error]"';
      }
    });
    return `[${items.join(', ')}]`;
  }

  // 处理普通对象
  try {
    const pairs = Object.entries(obj)
      .filter(([key]) => !key.startsWith('_')) // 忽略私有属性
      .map(([key, value]) => {
        try {
          return `"${key}": ${safeStringify(value, depth + 1, maxDepth)}`;
        } catch (_e) {
          return `"${key}": "[Complex Value]"`;
        }
      });
    return `{${pairs.join(', ')}}`;
  } catch (_e) {
    return '"[Object]"';
  }
};

// 格式化模块数据
const formatModuleData = (module: ModuleBase): string => {
  if (!module) return 'undefined';

  const result: Record<string, any> = {
    moduleType: module.moduleType,
    id: module.id,
    name: module.name,
    parameters: {},
    inputPorts: {},
    outputPorts: {},
  };

  // 获取参数值
  Object.entries(module.parameters || {}).forEach(([key, subject]) => {
    try {
      result.parameters[key] = subject.getValue();
    } catch (_e) {
      result.parameters[key] = '[Error]';
    }
  });

  // 获取输入端口值
  Object.entries(module.inputPorts || {}).forEach(([key, subject]) => {
    try {
      const value = subject.getValue();
      result.inputPorts[key] =
        typeof value === 'number' ? value : '[Complex Value]';
    } catch (_e) {
      result.inputPorts[key] = '[Error]';
    }
  });

  // 获取输出端口值
  Object.entries(module.outputPorts || {}).forEach(([key, subject]) => {
    try {
      const value = subject.getValue();
      result.outputPorts[key] =
        typeof value === 'number' ? value : '[Complex Value]';
    } catch (_e) {
      result.outputPorts[key] = '[Error]';
    }
  });

  return JSON.stringify(result, null, 2);
};

export default function NodeInspector() {
  const { getInternalNode } = useReactFlow();
  const nodes = useNodes();

  return (
    <ViewportPortal>
      <div className="react-flow__devtools-nodeinspector">
        {nodes.map((node) => {
          const internalNode = getInternalNode(node.id);
          if (!internalNode) {
            return null;
          }

          const absPosition = internalNode?.internals.positionAbsolute;

          return (
            <NodeInfo
              key={node.id}
              id={node.id}
              selected={!!node.selected}
              type={node.type || 'default'}
              position={node.position}
              absPosition={absPosition}
              width={node.measured?.width ?? 0}
              height={node.measured?.height ?? 0}
              data={node.data}
            />
          );
        })}
      </div>
    </ViewportPortal>
  );
}

type NodeInfoProps = {
  id: string;
  type: string;
  selected: boolean;
  position: XYPosition;
  absPosition: XYPosition;
  width?: number;
  height?: number;
  data: any;
};

function NodeInfo({
  id,
  type,
  selected,
  position,
  absPosition,
  width,
  height,
  data,
}: NodeInfoProps) {
  if (!width || !height) {
    return null;
  }

  // 格式化数据，避免循环引用错误
  const formattedData = data.module
    ? formatModuleData(data.module)
    : safeStringify(data);

  return (
    <div
      className="react-flow__devtools-nodeinfo"
      style={{
        position: 'absolute',
        transform: `translate(${absPosition.x}px, ${absPosition.y + height}px)`,
        width: width * 2,
      }}
    >
      <div>id: {id}</div>
      <div>type: {type}</div>
      <div>selected: {selected ? 'true' : 'false'}</div>
      <div>
        position: {position.x.toFixed(1)}, {position.y.toFixed(1)}
      </div>
      <div>
        dimensions: {width} × {height}
      </div>
      <div>
        data:
        <pre style={{ margin: 0 }}>{formattedData}</pre>
      </div>
    </div>
  );
}
