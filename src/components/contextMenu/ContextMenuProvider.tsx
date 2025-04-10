'use client';

import React, {
  createContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { ContextMenuState, MenuItem } from './types';

interface ContextMenuContextType {
  state: ContextMenuState;
  showMenu: (x: number, y: number, items: MenuItem[]) => void;
  hideMenu: () => void;
}

const initialState: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  items: [],
};

export const ContextMenuContext = createContext<ContextMenuContextType>({
  state: initialState,
  showMenu: () => {},
  hideMenu: () => {},
});

interface ContextMenuProviderProps {
  children: ReactNode;
}

export const ContextMenuProvider: React.FC<ContextMenuProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<ContextMenuState>(initialState);

  const showMenu = useCallback((x: number, y: number, items: MenuItem[]) => {
    setState({
      visible: true,
      x,
      y,
      items,
    });
  }, []);

  const hideMenu = useCallback(() => {
    setState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  useEffect(() => {
    // 只监听点击事件来关闭菜单，不再监听所有右键事件
    const handleClick = (e: MouseEvent) => {
      // 如果点击的是菜单内容，不关闭菜单
      if ((e.target as HTMLElement).closest('.context-menu-content')) {
        return;
      }
      hideMenu();
    };

    // 监听全局点击来关闭菜单
    window.addEventListener('click', handleClick);

    // 添加ESC键关闭菜单
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hideMenu]);

  return (
    <ContextMenuContext.Provider value={{ state, showMenu, hideMenu }}>
      {children}
    </ContextMenuContext.Provider>
  );
};
