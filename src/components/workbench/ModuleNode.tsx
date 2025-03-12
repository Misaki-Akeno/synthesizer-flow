import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

interface ModuleNodeData {
  moduleId: string;
  moduleTypeId: string;
  module: unknown;
  label: string;
}

// 使用通用的 NodeProps 类型，而不是约束它只接受 ModuleNodeData
const ModuleNode: React.FC<NodeProps> = ({ data, isConnectable }) => {
  // 强制类型转换确保我们可以访问 data 中的特定属性
  const nodeData = data as unknown as ModuleNodeData;
  
  return (
    <div className="rounded-md bg-slate-800 border border-slate-600 p-2 min-w-[150px]">
      <div className="font-bold text-sm text-white mb-2">{nodeData.label}</div>
      <div className="text-xs text-slate-300 mb-2">{nodeData.moduleTypeId}</div>

      {/* 这里只是一个简化版的输入/输出节点，实际上应该根据模块配置动态创建 */}
      <div className="flex justify-between items-center mt-1">
        <Handle
          type="target"
          position={Position.Left}
          id="audio_in"
          className="w-3 h-3 bg-blue-500"
          isConnectable={isConnectable}
        />
        <div className="text-xs text-slate-400">入/出</div>
        <Handle
          type="source"
          position={Position.Right}
          id="audio_out"
          className="w-3 h-3 bg-green-500"
          isConnectable={isConnectable}
        />
      </div>
    </div>
  );
};

export default ModuleNode;
