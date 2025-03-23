'use client'

import { useContext, useCallback } from 'react';
import { ContextMenuContext } from '../ContextMenuProvider';
import { MenuItem } from '../types';

export const useContextMenu = () => {
  const { state, showMenu, hideMenu } = useContext(ContextMenuContext);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, items: MenuItem[]) => {
      event.preventDefault();
      event.stopPropagation();
      showMenu(event.clientX, event.clientY, items);
    },
    [showMenu]
  );

  return {
    isOpen: state.visible,
    position: { x: state.x, y: state.y },
    items: state.items,
    showMenu,
    hideMenu,
    handleContextMenu,
  };
};
