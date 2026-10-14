'use client';

import { useMemo, useState, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { ParameterType } from '@/core/base/ModuleBase';
import { useRuntimeModule } from '@/core/hooks/useRuntimeModule';
import { useFlowStore } from '@/store/canvas-store';
import { ParameterControl } from '@/components/audioControls';
import type { FlowNode } from '@/core/graph/types';
import { Input } from '@/components/ui/shadcn/input';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('Workbench.properties');
  void _onRequestClose;
  const nodes = useFlowStore((state) => state.nodes);
  const updateModuleParameter = useFlowStore(
    (state) => state.updateModuleParameter
  );
  const renameNode = useFlowStore((state) => state.renameNode);
  const beginHistoryTransaction = useFlowStore(
    (state) => state.beginHistoryTransaction
  );
  const commitHistoryTransaction = useFlowStore(
    (state) => state.commitHistoryTransaction
  );

  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.selected);
  }, [nodes]) as FlowNode | undefined;

  const snapshot = useRuntimeModule(selectedNode?.id);

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

  if (!selectedNode || !snapshot) {
    return <div className="text-sm text-muted-foreground">{t('empty')}</div>;
  }

  const handleParameterChange = (
    paramKey: string,
    value: number | boolean | string
  ) => {
    updateModuleParameter(selectedNode.id, paramKey, value);
  };

  const groupedParameters: Record<string, ParameterItem[]> = { '': [] };

  Object.keys(snapshot.parameters).forEach((paramKey) => {
    const meta = snapshot.parameterMeta[paramKey];

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

    const value = snapshot.parameters[paramKey] ?? fallbackValue;

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
            {t('name')}
          </div>
          <ModuleNameInput
            key={selectedNode.id}
            initialName={selectedNode.data.label || snapshot.name || ''}
            onCommit={commitRename}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {t('type', { type: snapshot.type })}
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
              onEditStart={beginHistoryTransaction}
              onEditEnd={commitHistoryTransaction}
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
                      onEditStart={beginHistoryTransaction}
                      onEditEnd={commitHistoryTransaction}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : null}

      {!groupedParameters['']?.length && !hasGroups ? (
        <div className="text-sm text-muted-foreground">{t('noParameters')}</div>
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
  const t = useTranslations('Workbench.properties');
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
      placeholder={t('namePlaceholder')}
    />
  );
}

export default ModulePropertiesPanel;
