import { container } from '../di/Container';
import type { ModuleService } from './ModuleService';
import type { ConnectionService } from './ConnectionService';
import type { FlowService } from './FlowService';
import type { ParametersService } from './ParametersService';

/**
 * 服务访问器
 * 提供获取各种服务的便捷方法，解耦代码对具体实例的依赖
 * 
 * 这是项目中获取服务实例的首选方式，取代了之前的 getService 函数
 */
export class ServiceAccessor {
  /**
   * 获取模块服务
   * 
   * @提供的方法:
   * - async createModule(typeId: string, position?: Position): Promise<ModuleBase>
   *   创建模块实例
   * 
   * - getModuleState(moduleId: string): ModuleLifecycleState | undefined
   *   获取模块当前生命周期状态
   * 
   * - isModuleInitialized(moduleId: string): boolean
   *   检查模块是否已初始化
   * 
   * - isModuleDisposed(moduleId: string): boolean
   *   检查模块是否已销毁
   */
  static get moduleService(): ModuleService {
    return container.get<ModuleService>('moduleService');
  }

  /**
   * 获取连接服务
   * 
   * @提供的方法:
   * - createConnection(sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string): void
   *   创建两个模块之间的连接
   * 
   * - removeConnection(connectionId: string): void
   *   删除连接
   */
  static get connectionService(): ConnectionService {
    return container.get<ConnectionService>('connectionService');
  }

  /**
   * 获取流程服务
   * 
   * @提供的方法:
   * - addNode(moduleId: string, moduleTypeId: string, position?: Position): void
   *   添加节点
   * 
   * - addEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): void
   *   添加边（连接）
   * 
   * - updateNodePosition(nodeId: string, position: Position): void
   *   更新节点位置
   * 
   * - removeNode(nodeId: string): void
   *   删除节点
   * 
   * - removeEdge(edgeId: string): void
   *   删除边（连接）
   * 
   * - getNodes(): FlowNode[]
   *   获取所有节点
   * 
   * - getEdges(): FlowEdge[]
   *   获取所有边（连接）
   * 
   * - subscribe(listener: () => void): () => void
   *   订阅流程图变更，返回取消订阅的函数
   */
  static get flowService(): FlowService {
    return container.get<FlowService>('flowService');
  }

  /**
   * 获取参数服务
   * 
   * @提供的方法:
   * - createObservableParameter(
   *     id: string, 
   *     name: string, 
   *     type: ParameterType | string, 
   *     value: string | number, 
   *     defaultValue: ParameterValue, 
   *     options?: {
   *       min?: number;
   *       max?: number;
   *       step?: number;
   *       unit?: string;
   *       options?: Array<string | number>;
   *       modulatable?: boolean;
   *     }
   *   ): ObservableParameter
   *   创建可观察参数
   * 
   * - getParameters(moduleId: string): Record<string, Parameter>
   *   获取模块的所有参数
   * 
   * - getParameterValue(moduleId: string, parameterId: string): ParameterValue | undefined
   *   获取指定参数的值
   * 
   * - setParameterValue(moduleId: string, parameterId: string, value: ParameterValue): boolean
   *   设置参数值
   * 
   * - requestParameterChange(moduleId: string, parameterId: string, value: ParameterValue): void
   *   请求修改参数值（通过事件总线）
   * 
   * - setModulation(moduleId: string, parameterId: string, sourceId: string | null, amount: number): boolean
   *   设置参数调制
   */
  static get parameterService(): ParametersService {
    return container.get<ParametersService>('parameterService');
  }
}

// 添加一个简写方法，使访问更简洁
export const Services = ServiceAccessor;

/**
 * 使用示例:
 * 
 * import { Services } from '../services/ServiceAccessor';
 * 
 * // 获取服务
 * const moduleService = Services.moduleService;
 * 
 * // 使用服务
 * moduleService.createModule('oscillator');
 */
