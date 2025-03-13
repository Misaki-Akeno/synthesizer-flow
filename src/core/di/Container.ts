/* eslint-disable @typescript-eslint/no-explicit-any */
type Constructor<T> = new (...args: any[]) => T;

/**
 * 简单的依赖注入容器
 */
export class Container {
  private instances: Map<string, any> = new Map();
  private factories: Map<string, () => any> = new Map();

  /**
   * 注册单例实例
   */
  register<T>(key: string, instance: T): void {
    this.instances.set(key, instance);
  }

  /**
   * 注册工厂函数
   */
  registerFactory<T>(key: string, factory: () => T): void {
    this.factories.set(key, factory);
  }

  /**
   * 注册类
   */
  registerClass<T>(
    key: string,
    constructor: Constructor<T>,
    ...args: any[]
  ): void {
    this.registerFactory(key, () => new constructor(...args));
  }

  /**
   * 获取实例
   */
  get<T>(key: string): T {
    if (this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    if (this.factories.has(key)) {
      const instance = this.factories.get(key)!();
      this.instances.set(key, instance);
      return instance as T;
    }

    throw new Error(`No registration for key: ${key}`);
  }
}

// 导出容器单例
export const container = new Container();
