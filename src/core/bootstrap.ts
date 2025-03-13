import { container } from './di/Container';
import { errorHandler } from './events/ErrorHandler';
import { ModuleService } from './services/ModuleService';
import { ConnectionService } from './services/ConnectionService';
import { moduleLifecycleManager } from './domain/ModuleLifecycle';
import { FlowService } from './services/FlowService';
import { moduleRegistry } from './factory/ModuleRegistry';
import { discoverAndRegisterModules } from './factory/ModuleRegistry';
import { eventBus } from './events/EventBus';
import { ParametersService } from './services/ParametersService';

/**
 * 应用引导，初始化依赖注入容器和核心服务
 */
export async function bootstrapApplication(): Promise<void> {
  console.log('🚀 开始初始化应用...');
  
  // 注册基础服务
  container.register('eventBus', eventBus);
  container.register('errorHandler', errorHandler);
  container.register('moduleLifecycleManager', moduleLifecycleManager);
  container.register('moduleRegistry', moduleRegistry);
  
  // 注册服务类
  container.registerClass('moduleService', ModuleService);
  container.registerClass('connectionService', ConnectionService);
  container.registerClass('flowService', FlowService);
  container.registerClass('parameterService', ParametersService);
  
  // 获取服务实例
  const moduleService = container.get<ModuleService>('moduleService');
  const connectionService = container.get<ConnectionService>('connectionService');
  const parameterService = container.get<ParametersService>('parameterService');
  
  // 初始化各服务
  await moduleService.initialize();
  await connectionService.initialize();
  await parameterService.initialize();
  
  // 发现并注册所有可用的模块
  await discoverAndRegisterModules();
  
  console.log('✅ 应用初始化完成');
  
  // 发布系统初始化完成事件
  eventBus.emit('SYSTEM.INITIALIZED', {});
}

/**
 * 服务类型映射接口 - 定义服务名称与其类型的映射关系
 */
export interface ServiceMap {
  moduleService: ModuleService;
  connectionService: ConnectionService;
  flowService: FlowService;
  parameterService: ParametersService;
  eventBus: typeof eventBus;
  errorHandler: typeof errorHandler;
  moduleLifecycleManager: typeof moduleLifecycleManager;
  moduleRegistry: typeof moduleRegistry;
}

