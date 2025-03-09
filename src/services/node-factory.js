/**
 * 节点工厂服务 - 用于创建各种类型的节点
 */
import moduleService from './moduleService';

/**
 * 创建新节点
 * @param {string} type 节点类型
 * @param {number|string} id 节点ID
 * @param {Object} position 节点位置 {x, y}
 * @param {string} [moduleId=null] 关联的模块ID
 * @param {Object} [additionalData={}] 附加数据
 * @returns {Object} 新创建的节点对象
 */
export const createNode = (
  type,
  id,
  position,
  moduleId = null,
  additionalData = {}
) => {
  // 创建基本节点结构
  const nodeId = `${type}-${id}`;

  const baseNode = {
    id: nodeId,
    type: type, // react-flow节点类型
    position,
    data: {
      label: `${type} ${id}`,
      ...additionalData,
    },
  };

  // 如果是模块类型的节点，添加模块特定的属性
  if (type === 'module' && moduleId) {
    const moduleConfig = moduleService.getModuleById(moduleId);

    if (moduleConfig) {
      // 合并模块配置信息到节点数据
      baseNode.data = {
        ...baseNode.data,
        moduleId: moduleId,
        moduleType: moduleId,
        label: additionalData.label || moduleConfig.metadata.name,
        color: additionalData.color || moduleConfig.ui?.color || '#cccccc',
        category: moduleConfig.metadata.category,
        inputs: moduleConfig.interfaces.inputs,
        outputs: moduleConfig.interfaces.outputs,
        parameters: moduleConfig.parameters,
      };

      // 如果指定了预设，加载预设数据
      if (additionalData.preset) {
        const presetData = moduleService.loadPreset(
          moduleId,
          additionalData.preset
        );
        if (presetData) {
          baseNode.data.presetId = additionalData.preset;
          baseNode.data.parameterValues = presetData;
        }
      } else {
        // 使用默认参数值
        const defaultParams = {};
        Object.keys(moduleConfig.parameters).forEach((key) => {
          defaultParams[key] = moduleConfig.parameters[key].default;
        });
        baseNode.data.parameterValues = defaultParams;
      }
    }
  }

  return baseNode;
};
