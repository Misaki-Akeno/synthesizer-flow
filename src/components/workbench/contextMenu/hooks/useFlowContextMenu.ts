'use client';

import { useCallback } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { useContextMenu } from './useContextMenu';
import { MenuItem } from '../types';
import { useFlowStore } from '@/store/canvas-store';

export const useFlowContextMenu = () => {
  const { handleContextMenu } = useContextMenu();
  const reactFlowInstance = useReactFlow();
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);

  // 处理事件类型的辅助函数
  const handleEvent = (
    event: MouseEvent | React.MouseEvent<Element, MouseEvent>
  ) => {
    if ('nativeEvent' in event) {
      return event; // 已经是React事件
    } else {
      // 创建一个简化的兼容对象
      return {
        ...event,
        nativeEvent: event,
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist: () => {},
      } as unknown as React.MouseEvent<Element, MouseEvent>;
    }
  };

  // 画布右键菜单
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      event.preventDefault();

      const paneMenuItems: MenuItem[] = [
        {
          id: 'add-node',
          label: '添加节点',
          onClick: () => {
            // 将显示模块选择器替换为引导到新的 Sidebar URL
            const params = new URLSearchParams(window.location.search);
            params.set('panel', 'module-browser');
            window.history.pushState({}, '', `?${params.toString()}`);
          },
        },
        {
          id: 'paste-node',
          label: '粘贴节点',
          onClick: () => {
            useFlowStore.getState().pasteSelection();
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
            console.info('编辑节点', node.id);
          },
        },
        {
          id: 'delete-node',
          label: '删除节点',
          onClick: () => {
            useFlowStore.getState().deleteNode(node.id);
          },
        },
        { id: 'divider', divider: true, onClick: () => {} },
        {
          id: 'duplicate-node',
          label: '复制节点',
          onClick: () => {
            const store = useFlowStore.getState();
            if (!store.nodes.find((item) => item.id === node.id)?.selected) {
              store.onNodesChange(
                store.nodes.map((item) => ({
                  type: 'select' as const,
                  id: item.id,
                  selected: item.id === node.id,
                }))
              );
            }
            useFlowStore.getState().duplicateSelection();
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
            console.info('删除连接', edge.id);
            onEdgesChange([
              {
                id: edge.id,
                type: 'remove',
              },
            ]);
          },
        },
      ];

      handleContextMenu(handleEvent(event), edgeMenuItems);
    },
    [handleContextMenu, onEdgesChange]
  );

  return {
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
  };
};
