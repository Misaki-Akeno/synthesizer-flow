import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  Calculator,
  CircleOff,
  ListMusic,
  Music,
  Piano,
  Sliders,
  SlidersHorizontal,
  Speaker,
  Waves,
  Zap,
} from 'lucide-react';
import { ParameterType, PortType } from '@/core/base/ModuleBase';
import type { FlowNodeData, RuntimeParameterMeta } from '@/core/graph/types';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';
import { getModuleMetadata } from '@/core/modules';
import { getClipLengthTicks, parseMidiClipJson } from '@/core/midi/utils';
import {
  InputPort,
  OutputPort,
  getPortOffset,
} from '@/components/audioControls/ModulePorts';
import { SequenceNotePreview } from '@/components/audioControls/SequenceEditor';
import type { NodeDetailLevel } from '@/store/canvas-lod-store';
import { cn } from '@/lib/utils';

export interface NodeSize {
  width: number;
  height: number;
}

/**
 * 记录每个节点在完整档位下的尺寸。低档位按同样尺寸渲染占位卡片，
 * 端口 Handle 位置也不变，切换档位时连线不会跳动。
 */
const measuredNodeSizes = new Map<string, NodeSize>();

export function rememberNodeSize(id: string, size: NodeSize): void {
  if (size.width > 0 && size.height > 0) measuredNodeSizes.set(id, size);
}

export function getRememberedNodeSize(id: string): NodeSize | undefined {
  return measuredNodeSizes.get(id);
}

const COMPACT_PARAMETER_LIMIT = 3;

const CATEGORY_STYLES: Record<string, string> = {
  信号源: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  效果: 'border-violet-300 bg-violet-50 text-violet-800',
  输入: 'border-sky-300 bg-sky-50 text-sky-800',
  输出: 'border-amber-300 bg-amber-50 text-amber-800',
  逻辑: 'border-slate-300 bg-slate-50 text-slate-700',
  音频处理: 'border-rose-300 bg-rose-50 text-rose-800',
};
const DEFAULT_CATEGORY_STYLE = 'border-zinc-300 bg-zinc-50 text-zinc-700';

const CUSTOM_UI_LABELS: Record<string, string> = {
  PianoKeyboard: '键盘',
  EnvelopeEditor: '包络',
  XYPad: 'XY Pad',
  oscilloscope: '示波器',
  RecorderControls: '录音',
};

function ModuleIcon({
  iconType,
  className,
}: {
  iconType?: string;
  className?: string;
}): ReactNode {
  switch (iconType) {
    case 'Waves':
      return <Waves className={className} />;
    case 'Music':
      return <Music className={className} />;
    case 'Speaker':
      return <Speaker className={className} />;
    case 'Activity':
      return <Activity className={className} />;
    case 'Calculator':
      return <Calculator className={className} />;
    case 'ListMusic':
      return <ListMusic className={className} />;
    case 'SlidersHorizontal':
      return <SlidersHorizontal className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    default:
      return <Sliders className={className} />;
  }
}

interface ModuleShape {
  inputPortTypes: Record<string, PortType>;
  outputPortTypes: Record<string, PortType>;
  parameterMeta: Record<string, RuntimeParameterMeta>;
  defaultParameters: Record<string, number | boolean | string>;
  customUIType?: string;
}

/**
 * 低档位节点不订阅运行时：端口与参数结构一次性读取当前快照，
 * 快照尚未建立时退回静态模块定义。
 */
function readModuleShape(id: string, type: string): ModuleShape {
  const snapshot = audioGraphRuntime.getModuleSnapshot(id);
  const definition =
    moduleDefinitionRegistry.get(type) ??
    moduleDefinitionRegistry.resolve(type);
  return {
    inputPortTypes:
      snapshot?.inputPortTypes ?? definition?.inputPortTypes ?? {},
    outputPortTypes:
      snapshot?.outputPortTypes ?? definition?.outputPortTypes ?? {},
    parameterMeta: snapshot?.parameterMeta ?? definition?.parameterMeta ?? {},
    defaultParameters: definition?.defaultParameters ?? {},
    customUIType: snapshot?.customUI?.type ?? definition?.customUI?.type,
  };
}

function estimateNodeSize(shape: ModuleShape): NodeSize {
  const portCount = Math.max(
    Object.keys(shape.inputPortTypes).length,
    Object.keys(shape.outputPortTypes).length
  );
  return { width: 220, height: Math.max(96, getPortOffset(portCount)) };
}

function formatParameterValue(value: unknown): string {
  if (typeof value === 'number') return String(Number(value.toFixed(2)));
  if (typeof value === 'boolean') return value ? '开' : '关';
  const text = String(value ?? '–');
  return text.length > 12 ? `${text.slice(0, 11)}…` : text;
}

function CustomUIThumbnail({
  customUIType,
  parameters,
}: {
  customUIType?: string;
  parameters: FlowNodeData['parameters'];
}) {
  const serializedClip =
    customUIType === 'SequenceEditor' ? String(parameters.clip ?? '') : '';
  const clip = useMemo(
    () => (serializedClip ? parseMidiClipJson(serializedClip) : undefined),
    [serializedClip]
  );

  if (clip) {
    return (
      <div className="relative mt-2 h-20 overflow-hidden rounded-md border bg-[linear-gradient(90deg,color-mix(in_oklab,var(--chart-5)_18%,transparent)_1px,transparent_1px)] bg-[length:25%_100%]">
        <SequenceNotePreview
          notes={clip.notes}
          clipLengthTicks={Math.max(1, getClipLengthTicks(clip))}
        />
      </div>
    );
  }

  const label = customUIType ? CUSTOM_UI_LABELS[customUIType] : undefined;
  if (!label) return null;
  return (
    <div className="mt-2 flex h-14 items-center justify-center gap-2 rounded-md border border-dashed bg-muted/40 text-base text-muted-foreground">
      {customUIType === 'PianoKeyboard' ? (
        <Piano className="size-5" />
      ) : (
        <Activity className="size-5" />
      )}
      {label}
    </div>
  );
}

interface LowDetailNodeProps {
  id: string;
  data: FlowNodeData;
  level: Exclude<NodeDetailLevel, 'full'>;
}

/**
 * 缩小画布时使用的精简/极简卡片：只读、无运行时订阅，
 * 但保留与完整卡片相同的尺寸和端口 Handle，保证连线稳定。
 */
const LowDetailNode = ({ id, data, level }: LowDetailNodeProps) => {
  const shape = useMemo(() => readModuleShape(id, data.type), [id, data.type]);
  const metadata = getModuleMetadata(data.type);
  const size = getRememberedNodeSize(id) ?? estimateNodeSize(shape);
  const categoryStyle =
    (metadata && CATEGORY_STYLES[metadata.category]) ?? DEFAULT_CATEGORY_STYLE;

  const keyParameters = useMemo(
    () =>
      Object.entries(shape.parameterMeta)
        .filter(
          ([, meta]) =>
            !meta.uiOptions?.hide &&
            !meta.uiOptions?.hideInNode &&
            meta.type !== ParameterType.STRING
        )
        // 优先展示卡片顶层参数；全部参数都在分组里的模块（如 EQ）再取分组参数
        .sort(
          ([, a], [, b]) =>
            Number(Boolean(a.uiOptions?.group)) -
            Number(Boolean(b.uiOptions?.group))
        )
        .slice(0, COMPACT_PARAMETER_LIMIT)
        .map(([key, meta]) => ({
          key,
          label: (meta.uiOptions?.label as string) || key,
        })),
    [shape.parameterMeta]
  );

  return (
    <div
      data-testid={`module-node-${id}`}
      data-module-type={data.type}
      data-detail-level={level}
      style={{ width: size.width, height: size.height }}
      className={cn(
        'node-container node-drag-handle relative cursor-move rounded-md border shadow-sm',
        level === 'minimal' ? categoryStyle : 'bg-white',
        !data.enabled && 'opacity-50'
      )}
    >
      {/* 内容层单独裁剪，避免把贴边的端口 Handle 一起裁掉 */}
      {level === 'minimal' ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md px-3 text-center">
          <ModuleIcon iconType={metadata?.iconType} className="size-10" />
          <div className="line-clamp-2 text-2xl font-semibold leading-tight">
            {data.label || metadata?.label || '模块'}
          </div>
        </div>
      ) : (
        <div className="h-full overflow-hidden rounded-md p-3">
          <div
            className={cn(
              '-mx-3 -mt-3 mb-2 flex items-center gap-2 border-b px-3 py-2',
              categoryStyle
            )}
          >
            <ModuleIcon
              iconType={metadata?.iconType}
              className="size-5 shrink-0"
            />
            <div className="truncate text-lg font-semibold">
              {data.label || metadata?.label || '模块'}
            </div>
            {!data.enabled && (
              <CircleOff
                className="ml-auto size-5 shrink-0"
                aria-label="已停用"
              />
            )}
          </div>
          <dl className="space-y-1 text-base">
            {keyParameters.map(({ key, label }) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="truncate text-muted-foreground">{label}</dt>
                <dd className="shrink-0 font-mono">
                  {formatParameterValue(
                    data.parameters[key] ?? shape.defaultParameters[key]
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <CustomUIThumbnail
            customUIType={shape.customUIType}
            parameters={data.parameters}
          />
        </div>
      )}

      {Object.entries(shape.inputPortTypes).map(
        ([portKey, portType], index) => (
          <InputPort
            key={portKey}
            moduleId={id}
            portKey={portKey}
            portType={portType}
            index={index}
            isSelected={false}
          />
        )
      )}
      {Object.entries(shape.outputPortTypes).map(
        ([portKey, portType], index) => (
          <OutputPort
            key={portKey}
            moduleId={id}
            portKey={portKey}
            portType={portType}
            index={index}
            isSelected={false}
          />
        )
      )}
    </div>
  );
};

export default memo(LowDetailNode);
