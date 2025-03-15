import { EventTypes, Position } from '@/interfaces/event';
import { eventBus } from '../events/EventBus';
import { BehaviorSubject, Observable } from 'rxjs';

// 菜单项接口
export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
  action?: () => void;
}

// 菜单上下文数据接口
export interface MenuContext {
  position: Position;
  sourceId: string;
  sourceType: 'node' | 'edge' | 'pane';
  nodeType?: string;
  isOpen: boolean;
  items: MenuItem[];
}

// 初始菜单上下文
const initialMenuContext: MenuContext = {
  position: { x: 0, y: 0 },
  sourceId: '',
  sourceType: 'pane',
  isOpen: false,
  items: [],
};

/**
 * 上下文菜单服务
 * 管理右键菜单的状态和行为
 */
export class ContextMenuService {
  // 使用 BehaviorSubject 跟踪菜单上下文状态
  private menuContextSubject = new BehaviorSubject<MenuContext>(initialMenuContext);
  private isInitialized = false;

  constructor() {
    // 只在客户端环境中初始化
    if (typeof window !== 'undefined') {
      this.registerEventHandlers();
    }
  }

  /**
   * 确保服务在客户端环境中初始化
   * 这个方法将被组件调用
   */
  public ensureInitialized(): void {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.registerEventHandlers();
      this.isInitialized = true;
    }
  }

  // 获取菜单上下文的可观察对象
  public getMenuContext(): Observable<MenuContext> {
    return this.menuContextSubject.asObservable();
  }

  // 获取当前菜单上下文
  public getCurrentMenuContext(): MenuContext {
    return this.menuContextSubject.getValue();
  }

  // 打开菜单
  public openMenu(
    position: Position,
    sourceId: string,
    sourceType: 'node' | 'edge' | 'pane',
    nodeType?: string
  ): void {
    const items = this.generateMenuItems(sourceId, sourceType, nodeType);

    this.menuContextSubject.next({
      position,
      sourceId,
      sourceType,
      nodeType,
      isOpen: true,
      items,
    });
  }

  // 关闭菜单
  public closeMenu(): void {
    const currentContext = this.menuContextSubject.getValue();
    if (currentContext.isOpen) {
      this.menuContextSubject.next({
        ...currentContext,
        isOpen: false,
      });
    }
  }

  // 根据上下文生成菜单项
  private generateMenuItems(
    sourceId: string,
    sourceType: 'node' | 'edge' | 'pane',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    nodeType?: string
  ): MenuItem[] {
    // 基础菜单项
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const baseItems: MenuItem[] = [];

    // 根据不同的源类型提供不同的菜单项
    switch (sourceType) {
      case 'node':
        return [
          {
            id: 'pin',
            label: '固定节点',
            icon: '📌',
            action: () => this.handlePinModule(sourceId),
          },
          {
            id: 'unpin',
            label: '取消固定',
            icon: '📎',
            action: () => this.handleUnpinModule(sourceId),
          },
          {
            id: 'close',
            label: '关闭模块',
            icon: '❌',
            action: () => this.handleCloseModule(sourceId),
          },
          {
            id: 'delete',
            label: '删除',
            icon: '🗑️',
            action: () => this.handleDeleteNode(sourceId),
          },
        ];

      case 'edge':
        return [
          {
            id: 'delete',
            label: '删除连接',
            icon: '🗑️',
            action: () => this.handleDeleteEdge(sourceId),
          },
        ];

      case 'pane':
      default:
        return [
          {
            id: 'add-module',
            label: '添加模块',
            icon: '➕',
            action: () => this.handleAddModule(sourceId),
          },
          {
            id: 'clear-all',
            label: '清空画布',
            icon: '🧹',
            action: () => this.handleClearCanvas(),
          },
        ];
    }
  }

  // 注册事件处理器
  private registerEventHandlers(): void {
    // 订阅右键菜单打开事件
    eventBus.on<'UI.CONTEXT_MENU.OPEN'>(
      'UI.CONTEXT_MENU.OPEN',
      (event: EventTypes['UI.CONTEXT_MENU.OPEN']) => {
        this.openMenu(
          event.position,
          event.sourceId,
          event.sourceType,
          event.nodeType
        );
      }
    );

    // 订阅右键菜单关闭事件
    eventBus.on<'UI.CONTEXT_MENU.CLOSE'>(
      'UI.CONTEXT_MENU.CLOSE',
      () => {
        this.closeMenu();
      }
    );

    // 点击文档时关闭菜单
    if (typeof document !== 'undefined') {
      document.addEventListener('click', () => {
        this.closeMenu();
      });
    }
  }

  // 处理固定模块
  private handlePinModule(moduleId: string): void {
    eventBus.emit('UI.MODULE.PIN', { moduleId });
    this.closeMenu();
  }

  // 处理取消固定模块
  private handleUnpinModule(moduleId: string): void {
    eventBus.emit('UI.MODULE.UNPIN', { moduleId });
    this.closeMenu();
  }

  // 处理关闭模块
  private handleCloseModule(moduleId: string): void {
    eventBus.emit('UI.MODULE.CLOSE', { moduleId });
    this.closeMenu();
  }

  // 处理删除节点
  private handleDeleteNode(nodeId: string): void {
    eventBus.emit('UI.NODE.DELETED', { nodeId });
    this.closeMenu();
  }

  // 处理删除边
  private handleDeleteEdge(edgeId: string): void {
    eventBus.emit('UI.CONNECTION.DELETED', { connectionId: edgeId });
    this.closeMenu();
  }

  // 处理添加模块（示例函数）
  private handleAddModule(sourceId: string): void {
    console.log(`添加模块到画布，源ID: ${sourceId}`);
    this.closeMenu();
    // 这里可以实现后续的添加模块逻辑
  }

  // 处理清空画布（示例函数）
  private handleClearCanvas(): void {
    console.log('清空画布');
    this.closeMenu();
    // 这里可以实现清空画布的逻辑
  }
}
