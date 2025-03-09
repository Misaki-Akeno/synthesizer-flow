import moduleService from '@/services/moduleService';

/**
 * 创建新节点
 * @param {string} type 节点类型
 * @param {number|string} id 节点ID
 * @param {Object} position 节点位置 {x, y}
 * @param {string} [moduleId=null] 关联的模块ID
 * @param {Object} [additionalData={}] 附加数据
 * @param {Function} [onNodeUpdate=null] 节点更新回调函数
 * @returns {Object} 新创建的节点对象
 */
export const createNode = (
  type,
  id,
  position,
  moduleId = null,
  additionalData = {},
  onNodeUpdate = null
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
      // 提取可调制参数信息
      const modulatableParams = Object.keys(
        moduleConfig.parameters || {}
      ).filter((key) => moduleConfig.parameters[key].modulatable === true);

      // 处理参数值，为每个参数添加调制相关属性
      const processedParams = {};
      Object.entries(moduleConfig.parameters).forEach(([key, paramConfig]) => {
        processedParams[key] = {
          ...paramConfig,
          value: paramConfig.default,
          isModulated: false,
          modRange: null,
          displayValue: paramConfig.default,
        };
      });

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
        parameters: processedParams,
        moduleConfig, // 存储完整模块配置
        modulatableParams, // 存储可调制参数列表

        // 添加参数更改处理函数
        onParameterChange:
          additionalData.onParameterChange ||
          ((key, value) => {
            console.log(`参数 ${key} 已更改为 ${value}`);
            
            // 调用父组件提供的节点更新函数
            if (onNodeUpdate) {
              onNodeUpdate(nodeId, {
                parameterKey: key,
                parameterValue: value,
                type: 'PARAMETER_CHANGE'
              });
            }
          }),

        // 添加调制范围更改处理函数
        onModRangeChange: (key, range) => {
          console.log(`参数 ${key} 调制范围变更为 [${range[0]}, ${range[1]}]`);
          
          // 调用父组件提供的节点更新函数
          if (onNodeUpdate) {
            onNodeUpdate(nodeId, {
              parameterKey: key,
              modRange: range,
              type: 'MOD_RANGE_CHANGE'
            });
          }
        }
      };

      // 如果指定了预设，加载预设数据
      if (additionalData.preset) {
        const presetData = moduleService.loadPreset(
          moduleId,
          additionalData.preset
        );
        if (presetData) {
          baseNode.data.presetId = additionalData.preset;
          // 将预设值应用到每个参数
          Object.entries(presetData).forEach(([key, value]) => {
            if (baseNode.data.parameters[key]) {
              baseNode.data.parameters[key].value = value;
              baseNode.data.parameters[key].displayValue = value;
            }
          });
        }
      }
    }
  }

  return baseNode;
};
