import type { ModuleMetadata } from '@/core/base/ModuleBase';
import { moduleClassMap, moduleMetadataMap } from '@/core/modules';
import type {
  ParameterValue,
  RuntimeCustomUI,
  RuntimeModuleSnapshot,
  RuntimeParameterMeta,
} from './types';
import type { PortType } from '@/core/base/ModuleBase';

export interface ModuleDefinition {
  type: string;
  metadata: ModuleMetadata;
  defaultParameters: Record<string, ParameterValue>;
  parameterMeta: Record<string, RuntimeParameterMeta>;
  inputPortTypes: Record<string, PortType>;
  outputPortTypes: Record<string, PortType>;
  customUI?: RuntimeCustomUI;
}

/**
 * 模块声明注册表。旧模块首次实例化时提取声明，之后 UI、校验和序列化
 * 均读取纯 Definition，不再读取 ModuleBase。
 */
export class ModuleDefinitionRegistry {
  private definitions = new Map<string, ModuleDefinition>();

  registerSnapshot(snapshot: RuntimeModuleSnapshot): ModuleDefinition {
    const existing = this.definitions.get(snapshot.type);
    const definition: ModuleDefinition = {
      type: snapshot.type,
      metadata: moduleMetadataMap[snapshot.type] ?? {
        type: snapshot.type,
        label: snapshot.name,
        description: '',
        category: '其他',
      },
      defaultParameters: existing?.defaultParameters ?? {
        ...snapshot.parameters,
      },
      parameterMeta: { ...snapshot.parameterMeta },
      inputPortTypes: { ...snapshot.inputPortTypes },
      outputPortTypes: { ...snapshot.outputPortTypes },
      customUI: snapshot.customUI,
    };
    this.definitions.set(snapshot.type, definition);
    return definition;
  }

  get(type: string): ModuleDefinition | undefined {
    return this.definitions.get(type.toLowerCase());
  }

  /**
   * 兼容旧模块类的声明提取入口。实例仅短暂用于读取构造器中的声明，
   * 不会进入画布、Agent 状态或序列化数据。
   */
  resolve(type: string): ModuleDefinition | undefined {
    const normalizedType = type.toLowerCase();
    const existing = this.definitions.get(normalizedType);
    if (existing) return existing;

    const ModuleClass = moduleClassMap[normalizedType];
    const metadata = moduleMetadataMap[normalizedType];
    if (!ModuleClass || !metadata) return undefined;

    const instance = new ModuleClass(
      `definition-preview-${normalizedType}`,
      metadata.label
    );
    try {
      const definition: ModuleDefinition = {
        type: normalizedType,
        metadata,
        defaultParameters: Object.fromEntries(
          Object.entries(instance.parameters).map(([key, subject]) => [
            key,
            subject.getValue(),
          ])
        ),
        parameterMeta: Object.fromEntries(
          Object.keys(instance.parameters).map((key) => [
            key,
            instance.getParameterMeta(key),
          ])
        ),
        inputPortTypes: { ...instance.inputPortTypes },
        outputPortTypes: { ...instance.outputPortTypes },
      };
      this.definitions.set(normalizedType, definition);
      return definition;
    } finally {
      instance.dispose();
    }
  }

  has(type: string): boolean {
    return Boolean(moduleMetadataMap[type.toLowerCase()]);
  }

  clear(): void {
    this.definitions.clear();
  }
}

export const moduleDefinitionRegistry = new ModuleDefinitionRegistry();
