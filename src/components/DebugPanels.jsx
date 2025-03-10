'use client';

import React, { useState } from 'react';
import useRootStore from '@/store/rootStore';

const ModulationDebug = () => {
  // 从根 store 中获取调制系统状态
  const modulationConnections = useRootStore(
    (state) => state.modulationConnections
  );
  const modulationValues = useRootStore((state) => state.modulationValues);
  const initialized = useRootStore((state) => state.initialized);
  const modulationUpdateInterval = useRootStore(
    (state) => state.modulationUpdateInterval
  );
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="p-3 bg-gray-100 rounded-md text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">调制系统状态</h3>
        <button onClick={() => setExpanded(!expanded)} className="text-xs">
          {expanded ? '折叠' : '展开'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="mb-2">
            系统状态:{' '}
            <span className={initialized ? 'text-green-600' : 'text-red-600'}>
              {initialized ? '已初始化' : '未初始化'}
            </span>
          </div>

          <div className="mb-2">
            调制系统:{' '}
            <span
              className={
                modulationUpdateInterval ? 'text-green-600' : 'text-red-600'
              }
            >
              {modulationUpdateInterval ? '运行中' : '已停止'}
            </span>
          </div>

          <div className="mb-2">
            <div className="font-semibold">
              活动连接 ({Object.keys(modulationConnections || {}).length})
            </div>
            {Object.entries(modulationConnections || {}).map(([id, conn]) => (
              <div key={id} className="pl-2 mb-1 border-l border-gray-300">
                <div>
                  {conn.source} ➡️ {conn.target}:{conn.paramKey}
                </div>
                <div className="pl-2 text-gray-500 text-xxs">
                  深度: {conn.depth}, 双极性: {conn.bipolar ? '是' : '否'}
                </div>
              </div>
            ))}
            {Object.keys(modulationConnections || {}).length === 0 && (
              <div className="text-gray-500 italic pl-2">无活动连接</div>
            )}
          </div>

          <div>
            <div className="font-semibold">调制值</div>
            {Object.entries(modulationValues || {}).map(([key, value]) => (
              <div key={key} className="pl-2 flex justify-between">
                <span>{key}:</span>
                <span className={value > 0 ? 'text-green-600' : 'text-red-600'}>
                  {typeof value === 'number'
                    ? value.toFixed(2)
                    : value || 'N/A'}
                </span>
              </div>
            ))}
            {Object.keys(modulationValues || {}).length === 0 && (
              <div className="text-gray-500 italic pl-2">无调制值</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// 扩展调试面板，添加流程图信息
const FlowDebug = () => {
  const nodes = useRootStore((state) => state.nodes);
  const edges = useRootStore((state) => state.edges);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-3 bg-gray-100 rounded-md text-xs mt-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">流程图状态</h3>
        <button onClick={() => setExpanded(!expanded)} className="text-xs">
          {expanded ? '折叠' : '展开'}
        </button>
      </div>

      <div className="mb-2">
        节点数量: <span>{nodes.length}</span>
      </div>
      <div className="mb-2">
        连接数量: <span>{edges.length}</span>
      </div>

      {expanded && (
        <>
          <div className="mb-2">
            <div className="font-semibold">节点</div>
            {nodes.map((node) => (
              <div key={node.id} className="pl-2 mb-1 border-l border-gray-300">
                {node.id}: {node.data?.label || '无标签'}
                <span className="ml-1 text-gray-500">
                  ({Math.round(node.position.x)},{Math.round(node.position.y)})
                </span>
                {node.data?.parameters && (
                  <div className="pl-2 text-gray-600">
                    {Object.entries(node.data.parameters)
                      .filter(([_, param]) => param.isModulated)
                      .map(([key, param]) => (
                        <div key={key} className="flex justify-between">
                          <span>{key}:</span>
                          <span
                            className={param.isModulated ? 'text-blue-500' : ''}
                          >
                            {param.displayValue || param.value}
                            {param.isModulated && ' ~'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <div className="font-semibold">连接</div>
            {edges.map((edge) => (
              <div key={edge.id} className="pl-2 text-xs">
                {edge.source} → {edge.target}
                <span className="text-gray-500 ml-1">
                  ({edge.sourceHandle || 'default'} →{' '}
                  {edge.targetHandle || 'default'})
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// 总体系统调试面板
const SystemDebug = () => {
  const initialized = useRootStore((state) => state.initialized);
  const audioStarted = useRootStore((state) => state.audioStarted);
  const error = useRootStore((state) => state.error);

  return (
    <div className="p-3 bg-gray-100 rounded-md text-xs">
      <h3 className="font-bold mb-2">系统状态</h3>
      <div className="mb-1">
        初始化状态:{' '}
        <span className={initialized ? 'text-green-600' : 'text-yellow-600'}>
          {initialized ? '已初始化' : '未初始化'}
        </span>
      </div>
      <div className="mb-1">
        音频状态:{' '}
        <span className={audioStarted ? 'text-green-600' : 'text-yellow-600'}>
          {audioStarted ? '已启动' : '未启动'}
        </span>
      </div>
      {error && <div className="text-red-600">错误: {error}</div>}
    </div>
  );
};

// 性能调试面板
const PerformanceDebug = () => {
  const [fpsValues, setFpsValues] = useState([]);
  const [expanded, setExpanded] = useState(false);

  // 监控FPS
  React.useEffect(() => {
    if (!expanded) return;

    let lastTime = performance.now();
    let frames = 0;
    let fpsList = [];

    const calculateFps = () => {
      const now = performance.now();
      frames++;

      if (now > lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTime));

        fpsList.push(fps);
        if (fpsList.length > 10) fpsList.shift();

        setFpsValues([...fpsList]);

        frames = 0;
        lastTime = now;
      }

      animationFrameId = requestAnimationFrame(calculateFps);
    };

    let animationFrameId = requestAnimationFrame(calculateFps);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [expanded]);

  const averageFps =
    fpsValues.length > 0
      ? Math.round(
          fpsValues.reduce((sum, fps) => sum + fps, 0) / fpsValues.length
        )
      : 0;

  return (
    <div className="p-3 bg-gray-100 rounded-md text-xs mt-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">性能监控</h3>
        <button onClick={() => setExpanded(!expanded)} className="text-xs">
          {expanded ? '停止' : '开始'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="mb-1">
            当前FPS:{' '}
            <span
              className={averageFps > 45 ? 'text-green-600' : 'text-red-600'}
            >
              {averageFps}
            </span>
          </div>
          <div className="h-20 border border-gray-300 flex items-end">
            {fpsValues.map((fps, i) => (
              <div
                key={i}
                className="h-full flex-1"
                style={{
                  height: `${Math.min(100, (fps / 60) * 100)}%`,
                  backgroundColor: fps > 45 ? '#10B981' : '#EF4444',
                  marginRight: '1px',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// 调制详情调试面板
const ModulationDetailsDebug = () => {
  const nodes = useRootStore((state) => state.nodes);
  const modulationConnections = useRootStore(
    (state) => state.modulationConnections
  );
  const modulationValues = useRootStore((state) => state.modulationValues);
  const [expanded, setExpanded] = useState(false);

  // 找出所有被调制的参数
  const modulatedParams = React.useMemo(() => {
    const results = [];

    nodes.forEach((node) => {
      if (!node.data?.parameters) return;

      Object.entries(node.data.parameters).forEach(([key, param]) => {
        if (param.isModulated) {
          const valueKey = `${node.id}:${key}`;
          const modValue = modulationValues[valueKey];

          results.push({
            nodeId: node.id,
            nodeLabel: node.data.label,
            paramKey: key,
            paramLabel: param.label || key,
            value: param.value,
            displayValue: param.displayValue,
            modRange: param.modRange,
            modValue: modValue !== undefined ? modValue.toFixed(2) : 'N/A',
          });
        }
      });
    });

    return results;
  }, [nodes, modulationValues]);

  return (
    <div className="p-3 bg-gray-100 rounded-md text-xs mt-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">调制详情</h3>
        <button onClick={() => setExpanded(!expanded)} className="text-xs">
          {expanded ? '折叠' : '展开'}
        </button>
      </div>

      <div className="mb-2">
        被调制参数数量:{' '}
        <span className="font-semibold">{modulatedParams.length}</span>
      </div>

      {expanded && (
        <>
          <div className="overflow-auto max-h-[200px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-1">节点</th>
                  <th className="p-1">参数</th>
                  <th className="p-1">基准值</th>
                  <th className="p-1">显示值</th>
                  <th className="p-1">调制值</th>
                </tr>
              </thead>
              <tbody>
                {modulatedParams.map((item, index) => (
                  <tr key={index} className="border-t border-gray-300">
                    <td className="p-1">{item.nodeLabel}</td>
                    <td className="p-1">{item.paramLabel}</td>
                    <td className="p-1">{item.value}</td>
                    <td className="p-1 text-blue-600">
                      {item.displayValue || 'N/A'}
                    </td>
                    <td className="p-1">{item.modValue}</td>
                  </tr>
                ))}
                {modulatedParams.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-2 text-center text-gray-500">
                      没有被调制的参数
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <div className="font-semibold mb-1">调制连接映射</div>
            {Object.entries(modulationConnections).map(([id, conn]) => {
              const sourceNode = nodes.find((n) => n.id === conn.source);
              const targetNode = nodes.find((n) => n.id === conn.target);
              const paramKey = conn.paramKey;
              const valueKey = `${conn.target}:${paramKey}`;
              const modValue = modulationValues[valueKey];

              return (
                <div key={id} className="pl-2 mb-2 border-l border-gray-300">
                  <div>
                    {sourceNode?.data?.label || conn.source} ➡️
                    {targetNode?.data?.label || conn.target}.{paramKey}
                  </div>
                  <div className="pl-2 flex justify-between text-gray-600">
                    <span>调制值:</span>
                    <span>
                      {modValue !== undefined ? modValue.toFixed(2) : 'N/A'}
                    </span>
                  </div>

                  {targetNode?.data?.parameters[paramKey] && (
                    <div className="pl-2 flex justify-between text-gray-600">
                      <span>标记为已调制:</span>
                      <span>
                        {targetNode.data.parameters[paramKey].isModulated
                          ? '是'
                          : '否'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// 组合所有调试面板
const DebugPanels = () => {
  return (
    <div className="debug-panels p-3 bg-white shadow-md rounded-md overflow-auto max-h-[80vh] max-w-md">
      <h2 className="text-lg font-bold mb-3">调试面板</h2>
      <SystemDebug />
      <ModulationDebug />
      <ModulationDetailsDebug /> {/* 添加这一行 */}
      <FlowDebug />
      <PerformanceDebug />
    </div>
  );
};

export default DebugPanels;
