'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WorkbenchPanelProps {
  children: ReactNode;
  className?: string;
}

interface WorkbenchPanelHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

interface WorkbenchResizeHandleProps {
  orientation: 'horizontal' | 'vertical';
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  className?: string;
}

export function WorkbenchPanel({ children, className }: WorkbenchPanelProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground',
        className
      )}
    >
      {children}
    </section>
  );
}

export function WorkbenchPanelHeader({
  title,
  subtitle,
  actions,
  className,
}: WorkbenchPanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center justify-between border-b bg-card px-2',
        className
      )}
    >
      <div className="flex h-full min-w-0 items-end gap-1">
        <div className="flex h-8 min-w-0 items-center border-b-2 border-chart-5 px-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
              {title}
            </div>
            {subtitle && (
              <div className="truncate text-[10px] leading-3 text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}

export function WorkbenchPanelBody({ children, className }: WorkbenchPanelProps) {
  return <div className={cn('min-h-0 min-w-0 flex-1', className)}>{children}</div>;
}

export function WorkbenchResizeHandle({
  orientation,
  label,
  onPointerDown,
  className,
}: WorkbenchResizeHandleProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'group relative shrink-0 bg-border transition-colors hover:bg-chart-5/50',
        isHorizontal
          ? 'h-px w-full cursor-row-resize before:absolute before:-inset-y-2 before:left-0 before:right-0'
          : 'h-full w-px cursor-col-resize before:absolute before:-inset-x-2 before:bottom-0 before:top-0',
        className
      )}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
    >
      <div
        className={cn(
          'absolute rounded-sm border bg-background shadow-sm transition-colors group-hover:border-chart-5/50',
          isHorizontal
            ? 'left-1/2 top-1/2 h-2.5 w-9 -translate-x-1/2 -translate-y-1/2'
            : 'left-1/2 top-1/2 h-9 w-2.5 -translate-x-1/2 -translate-y-1/2'
        )}
      />
    </div>
  );
}
