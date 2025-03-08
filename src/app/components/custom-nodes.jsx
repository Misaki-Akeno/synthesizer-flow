import React from 'react';
import { Handle, Position } from '@xyflow/react';

// 输入节点 - 只有输出端口
export const InputNode = ({ data, isConnectable }) => {
  return (
    <div className="custom-node input-node">
      <div className="custom-node-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '8px', paddingBottom: '8px' }}>
        {data.label}
      </div>
      <div className="custom-node-body">
        输入数据源
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        style={{ background: '#0041d0' }}
        isConnectable={isConnectable}
      />
    </div>
  );
};

// 默认节点 - 有输入和输出端口
export const DefaultNode = ({ data, isConnectable }) => {
  return (
    <div className="custom-node default-node">
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        style={{ background: '#555' }}
        isConnectable={isConnectable}
      />
      <div className="custom-node-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '8px', paddingBottom: '8px' }}>
        {data.label}
      </div>
      <div className="custom-node-body">
        处理数据
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        style={{ background: '#555' }}
        isConnectable={isConnectable}
      />
    </div>
  );
};

// 输出节点 - 只有输入端口
export const OutputNode = ({ data, isConnectable }) => {
  return (
    <div className="custom-node output-node">
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        style={{ background: '#ff0072' }}
        isConnectable={isConnectable}
      />
      <div className="custom-node-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '8px', paddingBottom: '8px' }}>
        {data.label}
      </div>
      <div className="custom-node-body">
        输出结果
      </div>
    </div>
  );
};

// 自定义节点 - 多个输入输出端口
export const CustomNode = ({ data, isConnectable }) => {
  return (
    <div className="custom-node custom-node">
      <div className="custom-node-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '8px', paddingBottom: '8px' }}>
        {data.label}
      </div>
      <div className="custom-node-ports">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ position: 'relative', width: '50%' }}>
            <Handle
              type="target"
              position={Position.Top}
              id="input1"
              style={{ left: '25%', background: '#00a650' }}
              isConnectable={isConnectable}
            />
            <div style={{ fontSize: '0.7em', textAlign: 'center' }}>输入1</div>
          </div>
          <div style={{ position: 'relative', width: '50%' }}>
            <Handle
              type="target"
              position={Position.Top}
              id="input2"
              style={{ left: '75%', background: '#00a650' }}
              isConnectable={isConnectable}
            />
            <div style={{ fontSize: '0.7em', textAlign: 'center' }}>输入2</div>
          </div>
        </div>
        
        <div className="custom-node-body" style={{ padding: '10px 0' }}>
          自定义处理逻辑
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <div style={{ position: 'relative', width: '50%' }}>
            <Handle
              type="source"
              position={Position.Bottom}
              id="output1"
              style={{ left: '25%', background: '#00a650' }}
              isConnectable={isConnectable}
            />
            <div style={{ fontSize: '0.7em', textAlign: 'center' }}>输出1</div>
          </div>
          <div style={{ position: 'relative', width: '50%' }}>
            <Handle
              type="source"
              position={Position.Bottom}
              id="output2"
              style={{ left: '75%', background: '#00a650' }}
              isConnectable={isConnectable}
            />
            <div style={{ fontSize: '0.7em', textAlign: 'center' }}>输出2</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 导出所有节点类型供ReactFlow使用
export const nodeTypes = {
  input: InputNode,
  default: DefaultNode,
  output: OutputNode,
  custom: CustomNode
};