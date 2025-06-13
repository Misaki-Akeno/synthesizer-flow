'use client';

import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContextMenu } from './hooks/useContextMenu';

export const ContextMenu: React.FC = () => {
  const { isOpen, position, items, hideMenu } = useContextMenu();
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // 处理SSR兼容性
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    // 确保菜单在视口内
    const adjustPosition = () => {
      if (!menuRef.current) return;

      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let { x, y } = position;

      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width;
      }

      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height;
      }

      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    };

    setTimeout(adjustPosition, 0);
  }, [isOpen, position, mounted]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-white dark:bg-gray-800 shadow-lg rounded-md overflow-hidden context-menu-content"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <ul className="py-1">
        {items.map((item) => (
          <React.Fragment key={item.id}>
            {item.divider ? (
              <li className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            ) : (
              <li>
                <button
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    item.disabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick();
                      hideMenu();
                    }
                  }}
                  disabled={item.disabled}
                >
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                  {item.label}
                </button>
              </li>
            )}
          </React.Fragment>
        ))}
      </ul>
    </div>,
    document.body
  );
};
