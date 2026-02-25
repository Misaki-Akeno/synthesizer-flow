import React from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

interface ModuleButtonProps {
  // 按钮文本内容
  label: string;
  // 点击按钮时触发的函数
  onClick: () => void;
  // 按钮图标（可选）
  icon?: React.ReactNode;
  // 是否禁用按钮
  disabled?: boolean;
  // 按钮变体样式
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  // 按钮尺寸
  size?: 'default' | 'sm' | 'lg' | 'icon';
  // 自定义CSS类名
  className?: string;
  // 模块自定义属性
  module?: unknown;
}

/**
 * ModuleButton组件 - 用于模块UI中的操作按钮
 * 基于shadcn的Button组件，适用于模块内的操作
 */
const ModuleButton: React.FC<ModuleButtonProps> = ({
  label,
  onClick,
  icon,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className,
}) => {
  return (
    <div className="module-button-container my-2">
      <Button
        variant={variant}
        size={size}
        onClick={onClick}
        disabled={disabled}
        className={cn('w-full', className)}
      >
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </Button>
    </div>
  );
};

export default ModuleButton;
