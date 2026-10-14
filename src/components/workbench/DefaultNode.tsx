import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, RefObject } from 'react';
import { ParameterType, PortType } from '@/core/base/ModuleBase';
import type { FlowNodeData, RuntimeModuleSnapshot } from '@/core/graph/types';
import { useRuntimeModule } from '@/core/hooks/useRuntimeModule';
import { useFlowStore } from '@/store/canvas-store';
import { useNodeDetailLevel } from '@/store/canvas-lod-store';
import { ModuleInitializationStatus } from '@/components/audioControls/ModuleInitializationStatus';
import CustomUIComponents, {
  InputPort,
  ModuleEnableToggle,
  OutputPort,
  ParameterControl,
} from '@/components/audioControls';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/shadcn/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import { getModuleDescription } from '@/core/modules';
import { useTransportRuntimeStore } from '@/store/transport-runtime-store';
import { cn } from '@/lib/utils';
import LowDetailNode from './LowDetailNode';
import {
  getOpenParameterGroup,
  rememberNodeSize,
  setOpenParameterGroup,
} from './nodeViewCache';

interface DefaultNodeProps {
  data: FlowNodeData;
  id: string;
  selected?: boolean;
}

interface CustomUIRenderProps extends Record<string, unknown> {
  moduleId?: string;
  paramValues: Record<string, number | boolean | string>;
  onParamChange: (paramKey: string, value: number | boolean | string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

interface ParameterItem {
  key: string;
  type: ParameterType;
  label: string;
  describe?: string;
  readonly?: boolean;
  meta: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
}

/** 参数布局只依赖参数元数据；运行时会复用未变化的元数据引用。 */
function buildParameterLayout(
  parameterMeta: RuntimeModuleSnapshot['parameterMeta'] | undefined
): Record<string, ParameterItem[]> {
  const grouped: Record<string, ParameterItem[]> = { '': [] };
  if (!parameterMeta) return grouped;
  Object.entries(parameterMeta).forEach(([key, meta]) => {
    if (meta.uiOptions?.hide || meta.uiOptions?.hideInNode) {
      return;
    }
    const group = (meta.uiOptions?.group as string) || '';
    (grouped[group] ??= []).push({
      key,
      type: meta.type,
      label: (meta.uiOptions?.label as string) || key,
      describe: meta.uiOptions?.describe as string | undefined,
      readonly: meta.uiOptions?.readonly as boolean | undefined,
      meta: {
        min: meta.min,
        max: meta.max,
        step: meta.step,
        options: meta.options,
      },
    });
  });
  return grouped;
}

/** 完整档位下记录卡片尺寸，供低档位占位卡片复用。 */
function useRememberNodeSize(
  id: string,
  ref: RefObject<HTMLDivElement | null>
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      // offsetWidth/Height 不受画布缩放 transform 影响
      rememberNodeSize(id, {
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [id, ref]);
}

const FullDetailNode = ({ data, id, selected }: DefaultNodeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useRememberNodeSize(id, containerRef);
  const snapshot = useRuntimeModule(id);
  const updateModuleParameter = useFlowStore(
    (state) => state.updateModuleParameter
  );
  const toggleModuleEnabled = useFlowStore(
    (state) => state.toggleModuleEnabled
  );
  const invokeModuleAction = useFlowStore((state) => state.invokeModuleAction);
  const beginHistoryTransaction = useFlowStore(
    (state) => state.beginHistoryTransaction
  );
  const commitHistoryTransaction = useFlowStore(
    (state) => state.commitHistoryTransaction
  );
  // 记录本卡片开启但尚未结束的编辑事务：拖动中途切档导致卸载时补交，
  // 否则事务深度停在 1，之后的所有编辑都会被并进同一条历史。
  const openEdits = useRef(0);
  const handleEditStart = useCallback(() => {
    openEdits.current += 1;
    beginHistoryTransaction();
  }, [beginHistoryTransaction]);
  const handleEditEnd = useCallback(() => {
    if (openEdits.current === 0) return;
    openEdits.current -= 1;
    commitHistoryTransaction();
  }, [commitHistoryTransaction]);
  useEffect(
    () => () => {
      while (openEdits.current > 0) {
        openEdits.current -= 1;
        commitHistoryTransaction();
      }
    },
    [commitHistoryTransaction]
  );
  // 切档会卸载完整卡片，分组展开状态存在 nodeViewCache，放大回来时恢复
  const [openGroup, setOpenGroup] = useState(() => getOpenParameterGroup(id));
  const handleOpenGroupChange = useCallback(
    (group: string) => {
      setOpenGroup(group);
      setOpenParameterGroup(id, group);
    },
    [id]
  );
  const isTransportPlaying = useTransportRuntimeStore(
    (state) => state.isPlaying
  );

  const paramValues = snapshot?.parameters ?? data.parameters;
  const moduleEnabled = snapshot?.enabled ?? data.enabled;
  const handleParameterChange = useCallback(
    (paramKey: string, value: number | boolean | string) =>
      updateModuleParameter(id, paramKey, value),
    [id, updateModuleParameter]
  );
  const handleToggle = useCallback(
    () => toggleModuleEnabled(id),
    [id, toggleModuleEnabled]
  );

  const customUI = snapshot?.customUI;
  const parameterMeta = snapshot?.parameterMeta;
  const customUIProps = useMemo(() => {
    if (!customUI) return undefined;
    const actionProps = Object.fromEntries(
      customUI.actions
        .filter((action) => !action.includes('.'))
        .map((action) => [
          action,
          (...args: unknown[]) => invokeModuleAction(id, action, ...args),
        ])
    );
    const props = { ...customUI.props };

    if (customUI.type === 'XYPad') {
      (['xParam', 'yParam'] as const).forEach((axis) => {
        const config = props[axis];
        if (
          config &&
          typeof config === 'object' &&
          'paramKey' in config &&
          typeof config.paramKey === 'string' &&
          !('step' in config)
        ) {
          props[axis] = {
            ...config,
            step: parameterMeta?.[config.paramKey]?.step,
          };
        }
      });
    }
    return { ...props, ...actionProps };
  }, [customUI, id, invokeModuleAction, parameterMeta]);

  const renderCustomUI = () => {
    if (!customUI || !(customUI.type in CustomUIComponents)) return null;

    const componentType = customUI.type as keyof typeof CustomUIComponents;
    const CustomComponent = CustomUIComponents[
      componentType
    ] as ComponentType<CustomUIRenderProps>;

    return (
      <div className="custom-ui-container">
        <CustomComponent
          moduleId={id}
          paramValues={paramValues}
          onParamChange={handleParameterChange}
          onEditStart={handleEditStart}
          onEditEnd={handleEditEnd}
          {...customUIProps}
        />
      </div>
    );
  };

  const groupedParameters = useMemo(
    () => buildParameterLayout(parameterMeta),
    [parameterMeta]
  );
  const groups = Object.keys(groupedParameters).filter(
    (group) => group && groupedParameters[group].length > 0
  );

  const renderParameter = (parameter: ParameterItem) => (
    <ParameterControl
      moduleId={id}
      key={parameter.key}
      paramKey={parameter.key}
      paramType={parameter.type}
      value={paramValues[parameter.key]}
      meta={parameter.meta}
      updateParameter={handleParameterChange}
      label={parameter.label}
      description={parameter.describe}
      readonly={parameter.readonly}
      onEditStart={handleEditStart}
      onEditEnd={handleEditEnd}
    />
  );

  return (
    <div
      ref={containerRef}
      data-testid={`module-node-${id}`}
      data-module-type={data.type}
      data-detail-level="full"
      className={cn(
        'node-container relative min-w-[180px] rounded-md border bg-white p-3 shadow-sm transition-[opacity,box-shadow,border-color]',
        !moduleEnabled && 'opacity-50',
        data.type === 'sequencer' &&
          isTransportPlaying &&
          'border-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.2),0_8px_26px_rgba(245,158,11,0.16)]'
      )}
    >
      <div className="node-drag-handle mb-2 flex cursor-move items-center justify-between border-b pb-1 text-sm font-medium">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{data.label || '模块'}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs break-words text-xs">
              {getModuleDescription(data.type)}
            </p>
          </TooltipContent>
        </Tooltip>
        {snapshot?.canEnable && (
          <ModuleEnableToggle enabled={moduleEnabled} onToggle={handleToggle} />
        )}
      </div>

      {/* 非音频模块不会注册初始化状态，组件会直接返回 null */}
      <ModuleInitializationStatus moduleId={id} />
      {renderCustomUI()}
      {groupedParameters[''].map(renderParameter)}
      {groups.length > 0 && (
        <div className="mt-2">
          <Accordion
            type="single"
            collapsible
            className="w-full"
            value={openGroup}
            onValueChange={handleOpenGroupChange}
          >
            {groups.map((group) => (
              <AccordionItem value={group} key={group}>
                <AccordionTrigger className="py-2 text-xs">
                  {group}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-1">
                    {groupedParameters[group].map(renderParameter)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {snapshot &&
        Object.keys(snapshot.inputPortTypes).map((portKey, index) => (
          <InputPort
            key={portKey}
            moduleId={id}
            portKey={portKey}
            portType={snapshot.inputPortTypes[portKey] as PortType}
            index={index}
            isSelected={Boolean(selected)}
          />
        ))}
      {snapshot &&
        Object.keys(snapshot.outputPortTypes).map((portKey, index) => (
          <OutputPort
            key={portKey}
            moduleId={id}
            portKey={portKey}
            portType={snapshot.outputPortTypes[portKey] as PortType}
            index={index}
            isSelected={Boolean(selected)}
          />
        ))}
    </div>
  );
};

/**
 * 节点卡片入口：按细节档位选择完整卡片或只读的精简/极简卡片。
 * 只有完整卡片订阅运行时快照，缩小查看全局时不再承担遥测开销。
 */
const DefaultNode = (props: DefaultNodeProps) => {
  const level = useNodeDetailLevel();
  if (level === 'full') {
    return <FullDetailNode {...props} />;
  }
  return (
    <LowDetailNode
      id={props.id}
      data={props.data}
      level={level}
      selected={Boolean(props.selected)}
    />
  );
};

export default memo(DefaultNode);
