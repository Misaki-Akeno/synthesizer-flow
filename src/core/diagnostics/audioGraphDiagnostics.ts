import { PortType } from '@/core/base/ModuleBase';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';

const AUDIO_GENERATOR_TYPES = new Set([
  'simpleoscillator',
  'advancedoscillator',
  'noise',
  'trumpet',
]);

export type AudioGraphDiagnosticSeverity = 'critical' | 'warning' | 'info';

export type AudioGraphDiagnosticFix =
  | {
      id: string;
      kind: 'create-safe-output';
      label: string;
      sourceId: string;
      sourcePort: string;
    }
  | {
      id: string;
      kind: 'route-to-output';
      label: string;
      sourceId: string;
      sourcePort: string;
      speakerId: string;
      speakerPort: string;
    }
  | {
      id: string;
      kind: 'insert-limiter';
      label: string;
      sourceId: string;
      sourcePort: string;
      speakerId: string;
      speakerPort: string;
    }
  | {
      id: string;
      kind: 'disconnect-invalid';
      label: string;
      sourceId: string;
      sourcePort: string;
      targetId: string;
      targetPort: string;
    };

export interface AudioGraphDiagnosticFinding {
  id: string;
  code:
    | 'canvas-empty'
    | 'invalid-connection'
    | 'missing-output'
    | 'silent-output'
    | 'unprotected-output'
    | 'unrouted-generator'
    | 'audio-feedback';
  severity: AudioGraphDiagnosticSeverity;
  title: string;
  message: string;
  moduleIds: string[];
  fix?: AudioGraphDiagnosticFix;
}

export interface AudioGraphDiagnosticNode {
  id: string;
  type?: string;
  data: {
    type?: string;
    label?: string;
    ports?: {
      inputs?: Record<string, string>;
      outputs?: Record<string, string>;
    };
  };
}

export interface AudioGraphDiagnosticEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface AudioGraphDiagnosticReport {
  health: 'healthy' | 'attention' | 'critical';
  findings: AudioGraphDiagnosticFinding[];
  stats: {
    modules: number;
    connections: number;
    audioConnections: number;
    suggestedFixes: number;
  };
}

function nodeType(node: AudioGraphDiagnosticNode): string {
  return (node.data.type || node.type || '').toLowerCase();
}

function getPorts(node: AudioGraphDiagnosticNode): {
  inputs: Record<string, string>;
  outputs: Record<string, string>;
} {
  const definition = moduleDefinitionRegistry.resolve(nodeType(node));
  return {
    inputs: node.data.ports?.inputs ?? definition?.inputPortTypes ?? {},
    outputs: node.data.ports?.outputs ?? definition?.outputPortTypes ?? {},
  };
}

function firstAudioPort(ports: Record<string, string>): string | undefined {
  return Object.entries(ports).find(([, type]) => type === PortType.AUDIO)?.[0];
}

function fixId(kind: string, ...parts: string[]): string {
  return [kind, ...parts.map(encodeURIComponent)].join('|');
}

export function diagnoseAudioGraph(
  nodes: AudioGraphDiagnosticNode[],
  edges: AudioGraphDiagnosticEdge[]
): AudioGraphDiagnosticReport {
  if (nodes.length === 0) {
    return {
      health: 'healthy',
      findings: [
        {
          id: 'canvas-empty',
          code: 'canvas-empty',
          severity: 'info',
          title: '画布还是空的',
          message: '添加一个信号源，再建立带主限幅器的输出链即可开始。',
          moduleIds: [],
        },
      ],
      stats: {
        modules: 0,
        connections: 0,
        audioConnections: 0,
        suggestedFixes: 0,
      },
    };
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const findings: AudioGraphDiagnosticFinding[] = [];
  const audioEdges: AudioGraphDiagnosticEdge[] = [];

  edges.forEach((edge, index) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const sourcePort = edge.sourceHandle ?? 'output';
    const targetPort = edge.targetHandle ?? 'input';
    const sourceType = source
      ? getPorts(source).outputs[sourcePort]
      : undefined;
    const targetType = target ? getPorts(target).inputs[targetPort] : undefined;
    if (sourceType === PortType.AUDIO && targetType === PortType.AUDIO) {
      audioEdges.push(edge);
      return;
    }
    if (
      !source ||
      !target ||
      !sourceType ||
      !targetType ||
      sourceType !== targetType
    ) {
      findings.push({
        id: `invalid-connection-${edge.id ?? index}`,
        code: 'invalid-connection',
        severity: 'warning',
        title: '存在无效连接',
        message: `${edge.source}.${sourcePort} → ${edge.target}.${targetPort} 无法按当前端口声明绑定。`,
        moduleIds: [edge.source, edge.target],
        fix: {
          id: fixId(
            'disconnect-invalid',
            edge.source,
            sourcePort,
            edge.target,
            targetPort
          ),
          kind: 'disconnect-invalid',
          label: '断开无效连接',
          sourceId: edge.source,
          sourcePort,
          targetId: edge.target,
          targetPort,
        },
      });
    }
  });

  const speakers = nodes.filter((node) => nodeType(node) === 'speaker');
  const generators = nodes.filter((node) =>
    AUDIO_GENERATOR_TYPES.has(nodeType(node))
  );
  const firstGenerator = generators
    .map((node) => ({ node, port: firstAudioPort(getPorts(node).outputs) }))
    .find((item): item is { node: AudioGraphDiagnosticNode; port: string } =>
      Boolean(item.port)
    );

  if (speakers.length === 0 && firstGenerator) {
    findings.push({
      id: 'missing-output',
      code: 'missing-output',
      severity: 'warning',
      title: '没有监听输出',
      message: '画布包含音频信号源，但还没有 Speaker 输出链。',
      moduleIds: [firstGenerator.node.id],
      fix: {
        id: fixId(
          'create-safe-output',
          firstGenerator.node.id,
          firstGenerator.port
        ),
        kind: 'create-safe-output',
        label: '创建主限幅器与 Speaker',
        sourceId: firstGenerator.node.id,
        sourcePort: firstGenerator.port,
      },
    });
  }

  const adjacency = new Map<string, string[]>();
  audioEdges.forEach((edge) => {
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  });
  const reachesAnySpeaker = (sourceId: string): boolean => {
    const visited = new Set<string>();
    const pending = [sourceId];
    while (pending.length > 0) {
      const current = pending.pop() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      if (speakers.some((speaker) => speaker.id === current)) return true;
      pending.push(...(adjacency.get(current) ?? []));
    }
    return false;
  };

  speakers.forEach((speaker) => {
    const incoming = audioEdges.filter((edge) => edge.target === speaker.id);
    if (incoming.length === 0 && firstGenerator) {
      const speakerPort =
        firstAudioPort(getPorts(speaker).inputs) ?? 'audioInLeft';
      findings.push({
        id: `silent-output-${speaker.id}`,
        code: 'silent-output',
        severity: 'critical',
        title: 'Speaker 没有音频输入',
        message: `${speaker.data.label ?? speaker.id} 不会产生声音；可建立受限幅保护的主输出链。`,
        moduleIds: [firstGenerator.node.id, speaker.id],
        fix: {
          id: fixId(
            'route-to-output',
            firstGenerator.node.id,
            firstGenerator.port,
            speaker.id,
            speakerPort
          ),
          kind: 'route-to-output',
          label: '经主限幅器连接到 Speaker',
          sourceId: firstGenerator.node.id,
          sourcePort: firstGenerator.port,
          speakerId: speaker.id,
          speakerPort,
        },
      });
    }

    incoming.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      if (!source || nodeType(source) === 'masterlimiter') return;
      const sourcePort = edge.sourceHandle ?? 'output';
      const speakerPort = edge.targetHandle ?? 'audioInLeft';
      findings.push({
        id: `unprotected-output-${edge.id ?? `${edge.source}-${speakerPort}`}`,
        code: 'unprotected-output',
        severity: 'warning',
        title: '输出链没有主限幅保护',
        message: `${source.data.label ?? source.id} 正在直接进入 Speaker。`,
        moduleIds: [source.id, speaker.id],
        fix: {
          id: fixId(
            'insert-limiter',
            source.id,
            sourcePort,
            speaker.id,
            speakerPort
          ),
          kind: 'insert-limiter',
          label: '在连接中插入主限幅器',
          sourceId: source.id,
          sourcePort,
          speakerId: speaker.id,
          speakerPort,
        },
      });
    });
  });

  generators.forEach((generator) => {
    if (!reachesAnySpeaker(generator.id) && speakers.length > 0) {
      findings.push({
        id: `unrouted-generator-${generator.id}`,
        code: 'unrouted-generator',
        severity: 'info',
        title: '音频源尚未进入输出链',
        message: `${generator.data.label ?? generator.id} 当前没有通往 Speaker 的音频路径。`,
        moduleIds: [generator.id],
      });
    }
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycleNodeId: string | null = null;
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) {
      cycleNodeId = nodeId;
      return true;
    }
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    if ((adjacency.get(nodeId) ?? []).some(visit)) return true;
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };
  nodes.some((node) => visit(node.id));
  if (cycleNodeId) {
    findings.push({
      id: `audio-feedback-${cycleNodeId}`,
      code: 'audio-feedback',
      severity: 'warning',
      title: '检测到音频反馈环',
      message: '反馈可能是有意设计，也可能快速放大电平；启用前请降低增益。',
      moduleIds: [cycleNodeId],
    });
  }

  const health = findings.some((item) => item.severity === 'critical')
    ? 'critical'
    : findings.some((item) => item.severity === 'warning')
      ? 'attention'
      : 'healthy';
  return {
    health,
    findings,
    stats: {
      modules: nodes.length,
      connections: edges.length,
      audioConnections: audioEdges.length,
      suggestedFixes: findings.filter((finding) => finding.fix).length,
    },
  };
}
