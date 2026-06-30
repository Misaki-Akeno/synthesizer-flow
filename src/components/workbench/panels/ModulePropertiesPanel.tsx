'use client';

import { useMemo, useState, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { ParameterType, ModuleBase } from '@/core/base/ModuleBase';
import { useModuleSubscription } from '@/core/hooks/useModuleSubscription';
import { useFlowStore } from '@/store/canvas-store';
import { ParameterControl } from '@/components/audioControls';
import type { FlowNode } from '@/core/services/ModuleManager';
import { Input } from '@/components/ui/shadcn/input';

type ModulePropertiesPanelProps = {
  onRequestClose?: () => void;
};

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

export function ModulePropertiesPanel({
  onRequestClose: _onRequestClose,
}: ModulePropertiesPanelProps) {
  void _onRequestClose;
  const nodes = useFlowStore((state) => state.nodes);
  const updateModuleParameter = useFlowStore(
    (state) => state.updateModuleParameter
  );
  const renameNode = useFlowStore((state) => state.renameNode);

  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.selected && node.data?.module);
  }, [nodes]) as FlowNode | undefined;

  const moduleInstance = selectedNode?.data?.module as ModuleBase | undefined;

  const { paramValues } = useModuleSubscription(moduleInstance);

  const commitRename = useCallback(
    (value: string) => {
      if (!selectedNode) return;

      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      if (trimmed === selectedNode.data?.label) {
        return;
      }

      renameNode(selectedNode.id, trimmed);
    },
    [renameNode, selectedNode]
  );

  if (!selectedNode || !moduleInstance) {
    return (
      <div className="text-sm text-muted-foreground">
        请选择一个模块以查看属性。
      </div>
    );
  }

  const handleParameterChange = (
    paramKey: string,
    value: number | boolean | string
  ) => {
    updateModuleParameter(selectedNode.id, paramKey, value);
  };

  const groupedParameters: Record<string, ParameterItem[]> = { '': [] };

  Object.keys(moduleInstance.parameters).forEach((paramKey) => {
    const meta = moduleInstance.getParameterMeta(paramKey);

    if (meta.uiOptions?.hide) {
      return;
    }

    const displayName = (meta.uiOptions?.label as string) || paramKey;
    const description = meta.uiOptions?.describe as string | undefined;
    const group = (meta.uiOptions?.group as string) || '';

    const fallbackValue = (() => {
      switch (meta.type) {
        case ParameterType.BOOLEAN:
          return false;
        case ParameterType.LIST:
          return meta.options?.[0] ?? '';
        case ParameterType.NUMBER:
        default:
          return meta.min ?? 0;
      }
    })();

    const value =
      paramValues[paramKey] ??
      moduleInstance.parameters[paramKey]?.getValue?.() ??
      fallbackValue;

    const parameterItem: ParameterItem = {
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
      value: value as number | boolean | string,
    };

    if (!groupedParameters[group]) {
      groupedParameters[group] = [];
    }

    groupedParameters[group].push(parameterItem);
  });

  const hasGroups =
    Object.keys(groupedParameters).filter(
      (group) => group !== '' && groupedParameters[group].length > 0
    ).length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            模块名称
          </div>
          <ModuleNameInput
            key={selectedNode.id}
            initialName={selectedNode.data?.label || moduleInstance.name || ''}
            onCommit={commitRename}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          类型：{moduleInstance.moduleType}
        </div>
      </div>

      {groupedParameters['']?.length ? (
        <div className="space-y-3">
          {groupedParameters[''].map((param) => (
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
      ) : null}

      {hasGroups ? (
        <div className="space-y-4">
          {Object.keys(groupedParameters)
            .filter((group) => group !== '' && groupedParameters[group].length)
            .map((group) => (
              <div key={group} className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground">
                  {group}
                </div>
                <div className="space-y-3">
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
              </div>
            ))}
        </div>
      ) : null}

      {!groupedParameters['']?.length && !hasGroups ? (
        <div className="text-sm text-muted-foreground">
          当前模块没有可配置的参数。
        </div>
      ) : null}
    </div>
  );
}

function ModuleNameInput({
  initialName,
  onCommit,
}: {
  initialName: string;
  onCommit: (value: string) => void;
}) {
  const [displayName, setDisplayName] = useState(initialName);

  const handleNameInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onCommit(event.currentTarget.value);
        event.currentTarget.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setDisplayName(initialName);
        event.currentTarget.blur();
      }
    },
    [initialName, onCommit]
  );

  return (
    <Input
      value={displayName}
      onChange={(event) => setDisplayName(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={handleNameInputKeyDown}
      placeholder="输入模块显示名"
    />
  );
}

export default ModulePropertiesPanel;
