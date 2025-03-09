'use client';
import React from 'react';
import useModulationStore from '@/store/modulationStore';

const ModulationDebug = () => {
  // 从 store 中选择需要的状态
  const connections = useModulationStore((state) => state.connections);
  const modulationValues = useModulationStore(
    (state) => state.modulationValues
  );
  const isActive = useModulationStore((state) => state.isActive);

  return (
    <div className="p-3 bg-gray-100 rounded-md text-xs">
      <h3 className="font-bold mb-2">调制系统状态</h3>
      <div className="mb-2">
        状态:{' '}
        <span className={isActive ? 'text-green-600' : 'text-red-600'}>
          {isActive ? '运行中' : '已停止'}
        </span>
      </div>

      <div className="mb-2">
        <div className="font-semibold">
          活动连接 ({Object.keys(connections).length})
        </div>
        {Object.entries(connections).map(([id, conn]) => (
          <div key={id} className="pl-2 mb-1 border-l border-gray-300">
            {conn.source} ➡️ {conn.target} ({conn.paramKey})
          </div>
        ))}
      </div>

      <div>
        <div className="font-semibold">调制值</div>
        {Object.entries(modulationValues).map(([key, value]) => (
          <div key={key} className="pl-2 flex justify-between">
            <span>{key}:</span>
            <span>{value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModulationDebug;
