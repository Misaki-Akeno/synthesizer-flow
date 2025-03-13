import { ModuleBase, ModuleConfiguration, ModuleInterface, ModuleMetadata, ParameterDefinition } from './module';

/**
 * 模块构造函数参数类型
 */
export interface ModuleConstructorParams {
  id: string;
  typeId: string;
  config?: ModuleConfiguration;
  metadata: ModuleMetadata;
  parameters: Record<string, ParameterDefinition>;
  interfaces: { inputs: ModuleInterface[]; outputs: ModuleInterface[] };
}

/**
 * 模块构造函数类型
 */
export type ModuleConstructor = new (params: ModuleConstructorParams) => ModuleBase;

export * from './factory';
