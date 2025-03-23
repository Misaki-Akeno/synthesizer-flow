'use client'

import { useCallback } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { useContextMenu } from './useContextMenu';
import { MenuItem } from '../types';

export const useFlowContextMenu = () => {
  const { handleContextMenu } = useContextMenu();
  const reactFlowInstance = useReactFlow();

  // 处理事件类型的辅助函数
  const handleEvent = (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
    if ('nativeEvent' in event) {
      return event; // 已经是React事件
    } else {
      // 创建一个简化的兼容对象
      return {
        ...event,
        nativeEvent: event,
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist: () => { },
      } as unknown as React.MouseEvent<Element, MouseEvent>;
    }
  };

  // 画布右键菜单
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      event.preventDefault();

      // 读取 event 的 clientX 与 clientY 均可
      const clientX =
        'nativeEvent' in event ? event.nativeEvent.clientX : event.clientX;
      const clientY =
        'nativeEvent' in event ? event.nativeEvent.clientY : event.clientY;

      const paneMenuItems: MenuItem[] = [
        {
          id: 'add-node',
          label: '添加节点',
          onClick: () => {
            const position = reactFlowInstance.screenToFlowPosition({
              x: clientX,
              y: clientY,
            });
            console.log('添加节点在位置', position);
          },
        },
        {
          id: 'center-view',
          label: '居中视图',
          onClick: () => {
            reactFlowInstance.fitView();
          },
        },
      ];

      handleContextMenu(handleEvent(event), paneMenuItems);
    },
    [handleContextMenu, reactFlowInstance]
  );

  // 节点右键菜单
  const onNodeContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>, node: Node) => {
      event.preventDefault();

      const nodeMenuItems: MenuItem[] = [
        {
          id: 'edit-node',
          label: '编辑节点',
          onClick: () => {
            console.log('编辑节点', node.id);
          },
        },
        {
          id: 'delete-node',
          label: '删除节点',
          onClick: () => {
            console.log('删除节点', node.id);
          },
        },
        { id: 'divider', divider: true, onClick: () => {} },
        {
          id: 'duplicate-node',
          label: '复制节点',
          onClick: () => {
            console.log('复制节点', node.id);
          },
        },
      ];

      handleContextMenu(handleEvent(event), nodeMenuItems);
    },
    [handleContextMenu]
  );

  // 连接线右键菜单
  const onEdgeContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>, edge: Edge) => {
      event.preventDefault();

      const edgeMenuItems: MenuItem[] = [
        {
          id: 'delete-edge',
          label: '删除连接',
          onClick: () => {
            console.log('删除连接', edge.id);
          },
        },
        {
          id: 'edit-edge',
          label: '编辑连接',
          onClick: () => {
            console.log('编辑连接', edge.id);
          },
        },
      ];

      handleContextMenu(handleEvent(event), edgeMenuItems);
    },
    [handleContextMenu]
  );

  return {
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
  };
};
