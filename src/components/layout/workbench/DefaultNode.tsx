import { memo, useState } from 'react';
import {
  ModuleBase,
  ParameterType,
  PortType,
} from '../../../core/base/ModuleBase';
import { useFlowStore } from '../../../store/store';
import { useModuleSubscription } from '../../../hooks/useModuleSubscription';
import React from 'react';
import { AudioModuleBase } from '../../../core/base/AudioModuleBase';
import CustomUIComponents, {
  ParameterControl,
  InputPort,
  OutputPort,
  ModuleEnableToggle,
} from '../../ui/reusableUI';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/shadcn/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
// 导入统一的模块元数据和辅助函数
import { getModuleDescription } from '@/core/modules';

interface DefaultNodeProps {
  data: {
    label: string;
    type: string;
    module?: ModuleBase;
  };
  id: string;
  selected?: boolean;
}

const DefaultNode: React.FC<DefaultNodeProps> = ({ data, id, selected }) => {
  const { module: moduleInstance } = data;
  const updateModuleParameter = useFlowStore(
    (state) => state.updateModuleParameter
  );

  // 使用自定义Hook获取模块数据
  const {
    paramValues,
    inputPortValues,
    inputPortTypes,
    outputPortValues,
    outputPortTypes,
  } = useModuleSubscription(moduleInstance);

  // 追踪模块是否启用的状态
  const [moduleEnabled, setModuleEnabled] = useState(
    moduleInstance instanceof AudioModuleBase
      ? moduleInstance.isEnabled()
      : true
  );

  // 监听模块的启用状态变化
  React.useEffect(() => {
    if (moduleInstance instanceof AudioModuleBase) {
      const subscription = moduleInstance.enabled.subscribe((enabled) => {
        setModuleEnabled(enabled);
      });

      return () => subscription.unsubscribe();
    }
  }, [moduleInstance]);

  // 参数更新处理函数
  const handleParameterChange = (
    paramKey: string,
    value: number | boolean | string
  ) => {
    if (moduleInstance) {
      updateModuleParameter(id, paramKey, value);
    }
  };

  // 渲染自定义UI组件
  const renderCustomUI = () => {
    if (!moduleInstance) return null;

    const customUI = moduleInstance.getCustomUI();
    if (!customUI) return null;

    const { type, props = {} } = customUI;
    // 检查type是否为有效的组件类型
    if (!(type in CustomUIComponents)) {
      return (
        <div className="text-xs text-red-500">未知的自定义UI组件: {type}</div>
      );
    }

    // 类型断言为字符串类型的键
    const componentType = type as keyof typeof CustomUIComponents;
    const CustomComponent = CustomUIComponents[componentType];

    // 处理参数更改的回调函数
    const handleParamChange = (
      paramKey: string,
      value: number | boolean | string
    ) => {
      handleParameterChange(paramKey, value);
    };

    // 将模块参数和metaData与UI组件props合并（使用安全类型）
    return (
      <div className="custom-ui-container">
        <CustomComponent
          label={''}
          onClick={function (): void {
            throw new Error('Function not implemented.');
          }}
          xParam={{
            paramKey: 'x',
            label: 'X',
            min: 0,
            max: 1,
          }}
          yParam={{
            paramKey: 'y',
            label: 'Y',
            min: 0,
            max: 1,
          }}
          module={moduleInstance}
          paramValues={paramValues}
          onParamChange={handleParamChange}
          {...(props as Record<string, unknown>)}
        />
      </div>
    );
  };

  // 处理参数分组和提取信息
  type ParameterItem = {
    key: string;
    type: ParameterType;
    label: string;
    describe?: string;
    meta: {
      min?: number;
      max?: number;
      step?: number;
      options?: string[];
    };
    value: number | boolean | string;
  };

  // 按组分类的参数
  const groupedParameters: Record<string, ParameterItem[]> = { '': [] };

  if (moduleInstance) {
    Object.keys(moduleInstance.parameters).forEach((paramKey) => {
      const meta = moduleInstance.getParameterMeta(paramKey);

      if (meta.uiOptions?.hide) {
        return;
      }

      const displayName = (meta.uiOptions?.label as string) || paramKey;
      const description = meta.uiOptions?.describe as string | undefined;
      const group = (meta.uiOptions?.group as string) || '';
      const value = paramValues[paramKey];

      // 创建参数对象
      const paramObj: ParameterItem = {
        key: paramKey,
        type: meta.type,
        label: displayName,
        describe: description,
        meta: {
          min: meta.min,
          max: meta.max,
          step: meta.step,
          options: meta.options,
        },
        value,
      };

      // 按组分类
      if (!groupedParameters[group]) {
        groupedParameters[group] = [];
      }
      groupedParameters[group].push(paramObj);
    });
  }

  // 检查是否有分组参数
  const hasGroups =
    Object.keys(groupedParameters).filter(
      (g) => g !== '' && groupedParameters[g].length > 0
    ).length > 0;

  return (
    <div
      className={`node-container p-3 rounded-md border bg-white shadow-sm min-w-[180px] relative transition-opacity ${
        !moduleEnabled ? 'opacity-50' : ''
      }`}
    >
      {/* 模块标题栏 */}
      <div className="font-medium text-sm mb-2 pb-1 border-b flex justify-between items-center node-drag-handle cursor-move">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                {data.label || moduleInstance?.name || '模块'}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs break-words text-xs">
                {getModuleDescription(data.type)}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 启用/禁用切换按钮 */}
        {moduleInstance instanceof AudioModuleBase && (
          <ModuleEnableToggle module={moduleInstance} />
        )}
      </div>

      {/* 自定义UI组件 */}
      {renderCustomUI()}

      {/* 默认组参数 */}
      {groupedParameters['']?.map((param) => (
        <ParameterControl
          key={param.key}
          paramKey={param.key}
          paramType={param.type}
          value={param.value}
          meta={param.meta}
          updateParameter={handleParameterChange}
          label={param.label}
          description={param.describe}
        />
      ))}

      {/* 带分组的参数 */}
      {hasGroups && (
        <div className="mt-2">
          <Accordion type="single" collapsible className="w-full">
            {Object.keys(groupedParameters)
              .filter(
                (group) => group !== '' && groupedParameters[group].length > 0
              )
              .map((group) => (
                <AccordionItem value={group} key={group}>
                  <AccordionTrigger className="text-xs py-2">
                    {group}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-1">
                      {groupedParameters[group].map((param) => (
                        <ParameterControl
                          key={param.key}
                          paramKey={param.key}
                          paramType={param.type}
                          value={param.value}
                          meta={param.meta}
                          updateParameter={handleParameterChange}
                          label={param.label}
                          description={param.describe}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        </div>
      )}

      {/* 输入端口列表 */}
      {moduleInstance &&
        Object.keys(moduleInstance.inputPorts).map((inputKey, index) => (
          <InputPort
            key={inputKey}
            portKey={inputKey}
            value={inputPortValues[inputKey]}
            portType={inputPortTypes[inputKey] as PortType}
            index={index}
            module={moduleInstance}
            isSelected={!!selected}
          />
        ))}

      {/* 输出端口列表 */}
      {moduleInstance &&
        Object.keys(moduleInstance.outputPorts).map((outputKey, index) => (
          <OutputPort
            key={outputKey}
            portKey={outputKey}
            value={outputPortValues[outputKey]}
            portType={outputPortTypes[outputKey] as PortType}
            index={index}
            module={moduleInstance}
            isSelected={!!selected}
          />
        ))}
    </div>
  );
};

export default memo(DefaultNode);
