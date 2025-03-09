import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// 输入节点 - 只有输出端口
export const InputNode = ({ data, isConnectable }) => {
  return (
    <Card className="w-[200px] shadow-md border-t-4 border-t-blue-600">
      <CardHeader className="px-4 py-2 border-b border-border">
        <CardTitle className="text-sm font-medium">{data.label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 text-sm">输入数据源</CardContent>
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="bg-blue-600 w-3 h-3"
        isConnectable={isConnectable}
      />
    </Card>
  );
};

// 默认节点 - 有输入和输出端口
export const DefaultNode = ({ data, isConnectable }) => {
  return (
    <Card className="w-[200px] shadow-md">
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="bg-neutral-600 w-3 h-3"
        isConnectable={isConnectable}
      />
      <CardHeader className="px-4 py-2 border-b border-border">
        <CardTitle className="text-sm font-medium">{data.label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 text-sm">处理数据</CardContent>
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="bg-neutral-600 w-3 h-3"
        isConnectable={isConnectable}
      />
    </Card>
  );
};

// 输出节点 - 只有输入端口
export const OutputNode = ({ data, isConnectable }) => {
  return (
    <Card className="w-[200px] shadow-md border-t-4 border-t-pink-600">
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="bg-pink-600 w-3 h-3"
        isConnectable={isConnectable}
      />
      <CardHeader className="px-4 py-2 border-b border-border">
        <CardTitle className="text-sm font-medium">{data.label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 text-sm">输出结果</CardContent>
    </Card>
  );
};

// 自定义节点 - 多个输入输出端口
export const CustomNode = ({ data, isConnectable }) => {
  return (
    <Card className="w-[240px] shadow-md border-t-4 border-t-green-600">
      <CardHeader className="px-4 py-2 border-b border-border">
        <CardTitle className="text-sm font-medium">{data.label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex justify-between mb-3">
          <div className="relative w-1/2">
            <Handle
              type="target"
              position={Position.Top}
              id="input1"
              className="left-1/4 bg-green-600 w-3 h-3"
              isConnectable={isConnectable}
            />
            <div className="text-[0.7rem] text-center">输入1</div>
          </div>
          <div className="relative w-1/2">
            <Handle
              type="target"
              position={Position.Top}
              id="input2"
              className="left-3/4 bg-green-600 w-3 h-3"
              isConnectable={isConnectable}
            />
            <div className="text-[0.7rem] text-center">输入2</div>
          </div>
        </div>

        <div className="py-2 text-sm">自定义处理逻辑</div>

        <div className="flex justify-between mt-3">
          <div className="relative w-1/2">
            <Handle
              type="source"
              position={Position.Bottom}
              id="output1"
              className="left-1/4 bg-green-600 w-3 h-3"
              isConnectable={isConnectable}
            />
            <div className="text-[0.7rem] text-center">输出1</div>
          </div>
          <div className="relative w-1/2">
            <Handle
              type="source"
              position={Position.Bottom}
              id="output2"
              className="left-3/4 bg-green-600 w-3 h-3"
              isConnectable={isConnectable}
            />
            <div className="text-[0.7rem] text-center">输出2</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// 导出所有节点类型供ReactFlow使用
export const nodeTypes = {
  input: InputNode,
  default: DefaultNode,
  output: OutputNode,
  custom: CustomNode,
};
