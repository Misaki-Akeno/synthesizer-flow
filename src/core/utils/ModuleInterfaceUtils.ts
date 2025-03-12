import type { ModuleConfiguration } from '@/types/module';

/**
 * 工具类，用于处理模块接口和连接点
 */
export class ModuleInterfaceUtils {
  /**
   * 根据模块配置生成模块节点的接口连接点
   * @param module 模块配置
   * @returns 输入和输出接口列表
   */
  static generateNodeInterfaces(moduleConfig: ModuleConfiguration) {
    const inputs = moduleConfig.interfaces.inputs.map(input => ({
      id: input.id,
      label: input.label,
      type: input.dataType,
    }));

    const outputs = moduleConfig.interfaces.outputs.map(output => ({
      id: output.id,
      label: output.label,
      type: output.dataType,
    }));

    return { inputs, outputs };
  }

  /**
   * 基于模块接口生成对应的 Handle ID
   * @param moduleId 模块ID
   * @param interfaceId 接口ID
   * @param isInput 是否是输入接口
   * @returns Handle ID
   */
  static createHandleId(moduleId: string, interfaceId: string, isInput: boolean): string {
    return `${isInput ? 'input' : 'output'}-${moduleId}-${interfaceId}`;
  }

  /**
   * 解析 Handle ID 获取原始接口信息
   * @param handleId Handle ID
   * @returns 解析后的接口信息
   */
  static parseHandleId(handleId: string): { type: 'input' | 'output', moduleId: string, interfaceId: string } | null {
    const parts = handleId.split('-');
    if (parts.length >= 3) {
      const type = parts[0] as 'input' | 'output';
      const moduleId = parts[1];
      // 接口ID可能包含连字符，需要正确处理
      const interfaceId = parts.slice(2).join('-');
      return { type, moduleId, interfaceId };
    }
    return null;
  }
}
