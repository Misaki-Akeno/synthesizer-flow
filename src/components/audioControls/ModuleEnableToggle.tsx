import React from 'react';

// 模块启用/禁用切换按钮组件
export const ModuleEnableToggle = ({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) => {
  const toggleEnabled = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <button
      onClick={toggleEnabled}
      className="relative w-4 h-4 flex items-center justify-center focus:outline-none"
      title={enabled ? '点击禁用模块' : '点击启用模块'}
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          fill={enabled ? '#4ade80' : 'transparent'}
        />
        {!enabled && (
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
            stroke="currentColor"
            strokeWidth="2"
          />
        )}
      </svg>
    </button>
  );
};
