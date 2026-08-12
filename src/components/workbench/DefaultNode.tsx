import { memo } from 'react';
import type { ComponentType } from 'react';
import { ParameterType, PortType } from '@/core/base/ModuleBase';
import type { FlowNodeData } from '@/core/graph/types';
import { useRuntimeModule } from '@/core/hooks/useRuntimeModule';
import { useFlowStore } from '@/store/canvas-store';
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import { getModuleDescription } from '@/core/modules';
import { useTransportRuntimeStore } from '@/store/transport-runtime-store';
import { cn } from '@/lib/utils';

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
  value: number | boolean | string;
}

const DefaultNode = ({ data, id, selected }: DefaultNodeProps) => {
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
  const isTransportPlaying = useTransportRuntimeStore(
    (state) => state.isPlaying
  );

  const paramValues = snapshot?.parameters ?? data.parameters;
  const moduleEnabled = snapshot?.enabled ?? data.enabled;
  const handleParameterChange = (
    paramKey: string,
    value: number | boolean | string
  ) => updateModuleParameter(id, paramKey, value);

  const renderCustomUI = () => {
    const customUI = snapshot?.customUI;
    if (!customUI || !(customUI.type in CustomUIComponents)) return null;

    const componentType = customUI.type as keyof typeof CustomUIComponents;
    const CustomComponent = CustomUIComponents[
      componentType
    ] as ComponentType<CustomUIRenderProps>;
    const actionProps = Object.fromEntries(
      customUI.actions
        .filter((action) => !action.includes('.'))
        .map((action) => [
          action,
          (...args: unknown[]) => invokeModuleAction(id, action, ...args),
        ])
    );
    const props = { ...customUI.props };

    if (componentType === 'XYPad') {
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
            step: snapshot.parameterMeta[config.paramKey]?.step,
          };
        }
      });
    }

    return (
      <div className="custom-ui-container">
        <CustomComponent
          moduleId={id}
          paramValues={paramValues}
          onParamChange={handleParameterChange}
          onEditStart={beginHistoryTransaction}
          onEditEnd={commitHistoryTransaction}
          {...props}
          {...actionProps}
        />
      </div>
    );
  };

  const groupedParameters: Record<string, ParameterItem[]> = { '': [] };
  if (snapshot) {
    Object.entries(snapshot.parameterMeta).forEach(([key, meta]) => {
      if (meta.uiOptions?.hide) return;
      const group = (meta.uiOptions?.group as string) || '';
      const item: ParameterItem = {
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
        value: paramValues[key],
      };
      (groupedParameters[group] ??= []).push(item);
    });
  }
  const groups = Object.keys(groupedParameters).filter(
    (group) => group && groupedParameters[group].length > 0
  );

  const renderParameter = (parameter: ParameterItem) => (
    <ParameterControl
      moduleId={id}
      key={parameter.key}
      paramKey={parameter.key}
      paramType={parameter.type}
      value={parameter.value}
      meta={parameter.meta}
      updateParameter={handleParameterChange}
      label={parameter.label}
      description={parameter.describe}
      readonly={parameter.readonly}
      onEditStart={beginHistoryTransaction}
      onEditEnd={commitHistoryTransaction}
    />
  );

  return (
    <div
      data-testid={`module-node-${id}`}
      data-module-type={data.type}
      className={cn(
        'node-container relative min-w-[180px] rounded-md border bg-white p-3 shadow-sm transition-[opacity,box-shadow,border-color]',
        !moduleEnabled && 'opacity-50',
        data.type === 'sequencer' &&
          isTransportPlaying &&
          'border-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.2),0_8px_26px_rgba(245,158,11,0.16)]'
      )}
    >
      <div className="node-drag-handle mb-2 flex cursor-move items-center justify-between border-b pb-1 text-sm font-medium">
        <TooltipProvider>
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
        </TooltipProvider>
        {snapshot?.canEnable && (
          <ModuleEnableToggle
            enabled={moduleEnabled}
            onToggle={() => toggleModuleEnabled(id)}
          />
        )}
      </div>

      {renderCustomUI()}
      {groupedParameters[''].map(renderParameter)}
      {groups.length > 0 && (
        <div className="mt-2">
          <Accordion type="single" collapsible className="w-full">
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
            portKey={portKey}
            value={snapshot.inputValues[portKey]}
            portType={snapshot.inputPortTypes[portKey] as PortType}
            index={index}
            isSelected={Boolean(selected)}
          />
        ))}
      {snapshot &&
        Object.keys(snapshot.outputPortTypes).map((portKey, index) => (
          <OutputPort
            key={portKey}
            portKey={portKey}
            value={snapshot.outputValues[portKey]}
            portType={snapshot.outputPortTypes[portKey] as PortType}
            index={index}
            isSelected={Boolean(selected)}
          />
        ))}
    </div>
  );
};

export default memo(DefaultNode);
