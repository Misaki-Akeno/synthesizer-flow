'use client';

import * as React from 'react';
import { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

interface SidebarContextType {
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isMobile: false,
});

export function useSidebar() {
  return useContext(SidebarContext);
}

interface SidebarMenuProps {
  children: React.ReactNode;
  className?: string;
}

export function SidebarMenu({ children, className }: SidebarMenuProps) {
  return <div className={cn('flex flex-col gap-1', className)}>{children}</div>;
}

interface SidebarMenuItemProps {
  children: React.ReactNode;
  className?: string;
}

export function SidebarMenuItem({ children, className }: SidebarMenuItemProps) {
  return <div className={cn('px-1', className)}>{children}</div>;
}

interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'default' | 'sm' | 'lg';
}

export function SidebarMenuButton({
  size = 'default',
  children,
  className,
  ...props
}: SidebarMenuButtonProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
        size === 'sm' && 'py-1',
        size === 'default' && 'py-1.5',
        size === 'lg' && 'py-2',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface SidebarProviderProps {
  isMobile?: boolean;
  children: React.ReactNode;
}

export function SidebarProvider({
  isMobile = false,
  children,
}: SidebarProviderProps) {
  return (
    <SidebarContext.Provider value={{ isMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}
