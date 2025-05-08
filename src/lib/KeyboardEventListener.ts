/**
 * 全局键盘事件监听器
 * 用于在整个应用中捕获和管理键盘事件
 */

type KeyboardEventHandler = (e: KeyboardEvent) => void;
type KeyboardEventType = 'keydown' | 'keyup';

interface KeyListener {
  key: string;
  type: KeyboardEventType;
  handler: KeyboardEventHandler;
  moduleId: string; // 用于标识哪个模块注册了这个监听器
}

class KeyboardEventListener {
  private listeners: KeyListener[] = [];
  private isInitialized: boolean = false;
  private isEnabled: boolean = true;
  private activeKeys: Set<string> = new Set(); // 跟踪当前按下的键

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * 初始化全局事件监听器
   */
  private initialize(): void {
    if (this.isInitialized) return;

    // 添加全局按键监听
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    // 当窗口失去焦点时，重置所有按键状态
    window.addEventListener('blur', this.handleWindowBlur);

    this.isInitialized = true;
    console.debug('全局键盘事件监听器已初始化');
  }

  /**
   * 处理按键按下事件
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isEnabled) return;

    // 如果正在进行文本输入，忽略键盘事件
    if (this.isTextInputActive()) {
      return;
    }

    // 添加到活跃键集合
    this.activeKeys.add(e.key.toLowerCase());

    // 执行所有匹配的监听器
    this.listeners
      .filter(
        (listener) =>
          listener.type === 'keydown' &&
          (listener.key === '*' || listener.key === e.key.toLowerCase())
      )
      .forEach((listener) => {
        listener.handler(e);
      });
  };

  /**
   * 处理按键释放事件
   */
  private handleKeyUp = (e: KeyboardEvent): void => {
    if (!this.isEnabled) return;

    // 如果正在进行文本输入，忽略键盘事件
    if (this.isTextInputActive()) {
      return;
    }

    // 从活跃键集合移除
    this.activeKeys.delete(e.key.toLowerCase());

    // 执行所有匹配的监听器
    this.listeners
      .filter(
        (listener) =>
          listener.type === 'keyup' &&
          (listener.key === '*' || listener.key === e.key.toLowerCase())
      )
      .forEach((listener) => {
        listener.handler(e);
      });
  };

  /**
   * 当窗口失去焦点时重置所有按键状态
   */
  private handleWindowBlur = (): void => {
    // 为每个活跃的键触发一个keyup事件
    this.activeKeys.forEach((key) => {
      const e = new KeyboardEvent('keyup', { key });
      this.listeners
        .filter(
          (listener) =>
            listener.type === 'keyup' &&
            (listener.key === '*' || listener.key === key)
        )
        .forEach((listener) => {
          listener.handler(e);
        });
    });
    // 清空活跃键集合
    this.activeKeys.clear();
  };

  /**
   * 检查是否在进行文本输入（聚焦在输入元素上）
   */
  private isTextInputActive(): boolean {
    if (typeof document === 'undefined') return false;

    const activeElement = document.activeElement;
    const nodeName = activeElement?.nodeName.toLowerCase();

    // 如果焦点在输入元素上，不拦截键盘事件
    return (
      nodeName === 'input' ||
      nodeName === 'textarea' ||
      activeElement?.getAttribute('contenteditable') === 'true'
    );
  }

  /**
   * 添加键盘事件监听器
   * @param key 要监听的键名（小写），使用'*'匹配所有键
   * @param type 事件类型：'keydown'或'keyup'
   * @param handler 事件处理函数
   * @param moduleId 模块ID
   * @returns 监听器ID，用于后续移除
   */
  addListener(
    key: string,
    type: KeyboardEventType,
    handler: KeyboardEventHandler,
    moduleId: string
  ): number {
    // 确保初始化
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.initialize();
    }

    const listener: KeyListener = {
      key: key.toLowerCase(),
      type,
      handler,
      moduleId,
    };

    this.listeners.push(listener);
    return this.listeners.length - 1;
  }

  /**
   * 移除特定的键盘事件监听器
   * @param id 监听器ID
   */
  removeListener(id: number): void {
    if (id >= 0 && id < this.listeners.length) {
      this.listeners.splice(id, 1);
    }
  }

  /**
   * 移除指定模块的所有监听器
   * @param moduleId 模块ID
   */
  removeModuleListeners(moduleId: string): void {
    this.listeners = this.listeners.filter((l) => l.moduleId !== moduleId);
  }

  /**
   * 启用键盘事件监听
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * 禁用键盘事件监听
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * 销毁监听器
   */
  dispose(): void {
    if (!this.isInitialized) return;

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.listeners = [];
    this.activeKeys.clear();
    this.isInitialized = false;
    console.debug('全局键盘事件监听器已销毁');
  }

  /**
   * 获取当前按下的所有键
   */
  getActiveKeys(): string[] {
    return Array.from(this.activeKeys);
  }

  /**
   * 检查特定的键是否被按下
   * @param key 要检查的键名（小写）
   */
  isKeyPressed(key: string): boolean {
    return this.activeKeys.has(key.toLowerCase());
  }
}

// 创建单例实例
const keyboardEventListener = new KeyboardEventListener();

export default keyboardEventListener;
