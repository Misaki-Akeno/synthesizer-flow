export interface MenuItem {
  id: string;
  label?: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  divider?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: MenuItem[];
}
