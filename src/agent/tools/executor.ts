/**
 * 工具执行器 - 执行工具调用
 * 修改为服务端运行，通过模拟状态变更并返回操作指令给客户端执行
 */

import { createModuleLogger } from '@/lib/logger';
import { normalizeTopK } from '@/lib/rag/searchParams';
import { ClientOperation, GraphStateSnapshot } from '../core/types';
import { ParameterType, PortType } from '../../core/base/ModuleBase';
import { createEdgeId, createNodeId } from '../../core/utils/nodeId';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';
import {
  diagnoseAudioGraph,
  type AudioGraphDiagnosticFix,
} from '@/core/diagnostics/audioGraphDiagnostics';

const logger = createModuleLogger('ToolExecutor');

export type AgentKnowledgeSearch = (
  query: string,
  limit: number
) => Promise<unknown>;

export interface ToolExecutorDependencies {
  searchDocuments?: AgentKnowledgeSearch;
}

async function searchKnowledgeBase(
  query: string,
  limit: number
): Promise<unknown> {
  const { searchDocuments } = await import('@/lib/rag/vectorStore');
  return searchDocuments(query, limit);
}

// 定义基本类型 (保持与Store兼容)
interface FlowNode {
  id: string;
  type?: string;
  data: {
    label?: string;
    type?: string;
    parameters?: Record<string, unknown>;
    ports?: {
      inputs?: Record<string, string>;
      outputs?: Record<string, string>;
    };
  };
  position: { x: number; y: number };
  selected?: boolean;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

function toUnknownRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value));
}

function toPortRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(toUnknownRecord(value)).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}

/**
 * 工具执行器类
 */
export class ToolExecutor {
  private nodes: FlowNode[];
  private edges: FlowEdge[];
  private operations: ClientOperation[] = [];
  private readonly searchDocuments: AgentKnowledgeSearch;

  constructor(
    initialState: GraphStateSnapshot,
    dependencies: ToolExecutorDependencies = {}
  ) {
    this.searchDocuments = dependencies.searchDocuments ?? searchKnowledgeBase;
    // Agent 只维护纯数据 shadow graph，不保留客户端运行时引用。
    this.nodes = initialState.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        parameters: { ...(node.data.parameters || {}) },
        ports: node.data.ports,
      },
      position: { ...node.position },
    }));
    this.edges = JSON.parse(JSON.stringify(initialState.edges));
  }

  public getOperations(): ClientOperation[] {
    return this.operations;
  }

  public diagnoseCanvas() {
    return {
      success: true,
      data: diagnoseAudioGraph(this.nodes, this.edges),
    };
  }

  private resultError(result: unknown): string {
    if (
      typeof result === 'object' &&
      result !== null &&
      'error' in result &&
      typeof result.error === 'string'
    ) {
      return result.error;
    }
    return '诊断修复执行失败';
  }

  private addFixModule(
    type: string,
    label: string,
    position: { x: number; y: number }
  ): string {
    const operationIndex = this.operations.length;
    const result = this.addModule(type, label, position);
    if (!result.success) throw new Error(this.resultError(result));
    const operation = this.operations[operationIndex];
    if (operation?.type !== 'ADD_MODULE') {
      throw new Error('修复模块创建后未生成客户端操作');
    }
    return operation.data.id;
  }

  private requireFixSuccess(result: unknown): void {
    if (
      typeof result !== 'object' ||
      result === null ||
      !('success' in result) ||
      result.success !== true
    ) {
      throw new Error(this.resultError(result));
    }
  }

  private applyFixOperations(fix: AudioGraphDiagnosticFix): void {
    const source = this.nodes.find((node) => node.id === fix.sourceId);
    if (!source) throw new Error(`未找到模块: ${fix.sourceId}`);

    if (fix.kind === 'disconnect-invalid') {
      this.requireFixSuccess(
        this.disconnectModules(
          fix.sourceId,
          fix.targetId,
          fix.sourcePort,
          fix.targetPort
        )
      );
      return;
    }

    if (fix.kind === 'create-safe-output') {
      const limiterId = this.addFixModule('masterlimiter', '主限幅器', {
        x: source.position.x + 300,
        y: source.position.y,
      });
      const speakerId = this.addFixModule('speaker', '扬声器', {
        x: source.position.x + 600,
        y: source.position.y,
      });
      this.requireFixSuccess(
        this.connectModules(fix.sourceId, limiterId, fix.sourcePort, 'input')
      );
      this.requireFixSuccess(
        this.connectModules(limiterId, speakerId, 'output', 'audioInLeft')
      );
      this.requireFixSuccess(
        this.connectModules(limiterId, speakerId, 'output', 'audioInRight')
      );
      return;
    }

    const speaker = this.nodes.find((node) => node.id === fix.speakerId);
    if (!speaker) throw new Error(`未找到模块: ${fix.speakerId}`);
    const limiterId = this.addFixModule('masterlimiter', '主限幅器', {
      x: (source.position.x + speaker.position.x) / 2,
      y: (source.position.y + speaker.position.y) / 2,
    });

    if (fix.kind === 'insert-limiter') {
      this.requireFixSuccess(
        this.disconnectModules(
          fix.sourceId,
          fix.speakerId,
          fix.sourcePort,
          fix.speakerPort
        )
      );
    }
    this.requireFixSuccess(
      this.connectModules(fix.sourceId, limiterId, fix.sourcePort, 'input')
    );
    this.requireFixSuccess(
      this.connectModules(limiterId, fix.speakerId, 'output', fix.speakerPort)
    );
  }

  public applyDiagnosticFix(fixId: string) {
    const report = diagnoseAudioGraph(this.nodes, this.edges);
    const fix = report.findings.find(
      (finding) => finding.fix?.id === fixId
    )?.fix;
    if (!fix) {
      return {
        success: false,
        error: '修复建议已过期，请重新运行 canvas_diagnose',
      };
    }

    const previousNodes = JSON.parse(JSON.stringify(this.nodes)) as FlowNode[];
    const previousEdges = JSON.parse(JSON.stringify(this.edges)) as FlowEdge[];
    const operationCount = this.operations.length;
    try {
      this.applyFixOperations(fix);
      return {
        success: true,
        data: {
          fixId,
          message: `已应用诊断修复：${fix.label}`,
          operationsAdded: this.operations.length - operationCount,
          report: diagnoseAudioGraph(this.nodes, this.edges),
        },
      };
    } catch (error) {
      this.nodes = previousNodes;
      this.edges = previousEdges;
      this.operations.splice(operationCount);
      return {
        success: false,
        error: error instanceof Error ? error.message : '诊断修复执行失败',
      };
    }
  }

  /**
   * 获取画布上的所有模块和连接 (合并视图)
   */
  public getCanvas() {
    const modules = this.nodes.map((node) => ({
      id: node.id,
      type: node.data?.type || node.type,
      label: node.data?.label,
      position: node.position,
      // parameters: node.data?.parameters || {},
      selected: node.selected || false,
    }));

    const connections = this.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    return {
      success: true,
      data: {
        totalModules: modules.length,
        totalConnections: connections.length,
        modules,
        connections,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Helper to resolve ports for a node
   */
  private getNodePorts(node: FlowNode): {
    inputs: Record<string, string>;
    outputs: Record<string, string>;
  } {
    // 优先使用 snapshot 中传递过来的端口信息
    let ports = node.data?.ports;

    if (!ports) {
      const definition = moduleDefinitionRegistry.resolve(
        node.data.type || node.type || ''
      );
      ports = {
        inputs: toPortRecord(definition?.inputPortTypes),
        outputs: toPortRecord(definition?.outputPortTypes),
      };
    }

    if (!ports) {
      ports = { inputs: {}, outputs: {} };
    }

    return {
      inputs: ports.inputs || {},
      outputs: ports.outputs || {},
    };
  }

  private isMultiInputPort(portType: string | undefined): boolean {
    return portType === PortType.AUDIO || portType === PortType.ARRAY;
  }

  private normalizeSourceHandle(handle: string | undefined): string {
    return handle || 'output';
  }

  private normalizeTargetHandle(handle: string | undefined): string {
    return handle || 'input';
  }

  /**
   * 获取指定模块的详细信息
   */
  public getModuleDetails(moduleId: string) {
    const node = this.nodes.find((n) => n.id === moduleId);

    if (!node) {
      return {
        success: false,
        error: `未找到模块: ${moduleId}`,
      };
    }

    const incomingConnections = this.edges.filter(
      (edge) => edge.target === moduleId
    );
    const outgoingConnections = this.edges.filter(
      (edge) => edge.source === moduleId
    );

    const parameters = { ...(node.data?.parameters || {}) };

    const ports = this.getNodePorts(node);

    return {
      success: true,
      data: {
        module: {
          id: node.id,
          type: node.data?.type || node.type,
          label: node.data?.label,
          position: node.position,
          parameters,
          selected: node.selected || false,
          ports,
        },
        connections: {
          incoming: incomingConnections.map((edge) => ({
            fromModule: edge.source,
            fromHandle: edge.sourceHandle,
            toHandle: edge.targetHandle,
          })),
          outgoing: outgoingConnections.map((edge) => ({
            toModule: edge.target,
            fromHandle: edge.sourceHandle,
            toHandle: edge.targetHandle,
          })),
        },
      },
    };
  }

  /**
   * 添加新模块
   */
  /**
   * 查找安全的不重叠位置
   * 防止新创建的模块与现有模块完全重叠
   */
  private findSafePosition(initialPos: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    let { x, y } = initialPos;
    const offset = 30; // 每次偏移量
    let attempts = 0;
    const maxAttempts = 100; // 防止死循环

    // 简单的碰撞检测，如果位置非常接近（视为重叠），则偏移
    // 这里的 20px 是一个简单的阈值，用于检测完全重叠的情况
    while (attempts < maxAttempts) {
      const isOverlapping = this.nodes.some(
        (node) =>
          Math.abs(node.position.x - x) < 20 &&
          Math.abs(node.position.y - y) < 20
      );

      if (!isOverlapping) {
        break;
      }

      x += offset;
      y += offset;
      attempts++;
    }

    return { x, y };
  }

  /**
   * 添加新模块
   */
  public addModule(
    type: string,
    label: string,
    position?: { x: number; y: number }
  ) {
    const normalizedType = type.toLowerCase();
    const definition = moduleDefinitionRegistry.resolve(normalizedType);
    if (!definition) {
      return {
        success: false,
        error: `未知模块类型: ${type}`,
      };
    }

    // 如果没有提供位置，默认从 (100, 100) 开始
    // 使用 findSafePosition 确保不会与现有模块重叠
    const basePos = position || { x: 100, y: 100 };
    const pos = this.findSafePosition(basePos);

    const nodeId = createNodeId(this.nodes.map((node) => node.id));

    const newNode: FlowNode = {
      id: nodeId,
      type: 'default',
      data: {
        label,
        type: normalizedType,
        parameters: { ...definition.defaultParameters },
        ports: {
          inputs: { ...definition.inputPortTypes },
          outputs: { ...definition.outputPortTypes },
        },
      },
      position: pos,
    };

    this.nodes.push(newNode);

    this.operations.push({
      type: 'ADD_MODULE',
      data: { id: nodeId, type: normalizedType, label, position: pos },
    });

    const details = this.getModuleDetails(nodeId);

    return {
      success: true,
      data: {
        moduleId: nodeId,
        message: `成功添加模块: ${label} (${type}) 在位置 (${pos.x}, ${pos.y})`,
        moduleDetails: details.data,
      },
    };
  }

  /**
   * 删除模块
   */
  public deleteModule(moduleId: string) {
    if (!this.nodes.some((n) => n.id === moduleId)) {
      return {
        success: false,
        error: `未找到模块: ${moduleId}`,
      };
    }

    this.nodes = this.nodes.filter((n) => n.id !== moduleId);
    this.edges = this.edges.filter(
      (e) => e.source !== moduleId && e.target !== moduleId
    );

    this.operations.push({
      type: 'DELETE_MODULE',
      data: { id: moduleId },
    });

    return {
      success: true,
      data: {
        message: `成功删除模块: ${moduleId}`,
      },
    };
  }

  private validateParameterUpdate(
    node: FlowNode,
    paramKey: string,
    value: unknown
  ): { success: true } | { success: false; error: string } {
    if (!paramKey) {
      return { success: false, error: '参数名不能为空' };
    }

    const definition = moduleDefinitionRegistry.resolve(
      node.data.type || node.type || ''
    );
    const meta = definition?.parameterMeta[paramKey];
    if (definition) {
      if (!meta) {
        return {
          success: false,
          error: `参数不存在: ${node.id}.${paramKey}`,
        };
      }

      if (meta.type === ParameterType.NUMBER && typeof value !== 'number') {
        return {
          success: false,
          error: `参数类型不匹配: ${paramKey} 需要 number`,
        };
      }
      if (meta.type === ParameterType.BOOLEAN && typeof value !== 'boolean') {
        return {
          success: false,
          error: `参数类型不匹配: ${paramKey} 需要 boolean`,
        };
      }
      if (meta.type === ParameterType.STRING && typeof value !== 'string') {
        return {
          success: false,
          error: `参数类型不匹配: ${paramKey} 需要 string`,
        };
      }
      if (meta.type === ParameterType.LIST) {
        if (typeof value !== 'string') {
          return {
            success: false,
            error: `参数类型不匹配: ${paramKey} 需要 string`,
          };
        }
        if (meta.options && !meta.options.includes(value)) {
          return {
            success: false,
            error: `参数选项不存在: ${paramKey}=${value}`,
          };
        }
      }

      return { success: true };
    }

    const parameters = node.data?.parameters || {};
    if (!Object.prototype.hasOwnProperty.call(parameters, paramKey)) {
      return {
        success: false,
        error: `参数不存在: ${node.id}.${paramKey}`,
      };
    }

    const currentValue = parameters[paramKey];
    const currentType = typeof currentValue;
    if (
      (currentType === 'number' ||
        currentType === 'boolean' ||
        currentType === 'string') &&
      typeof value !== currentType
    ) {
      return {
        success: false,
        error: `参数类型不匹配: ${paramKey} 需要 ${currentType}`,
      };
    }

    return { success: true };
  }

  /**
   * 更新模块参数
   */
  public updateModuleParameter(
    moduleId: string,
    paramKey: string,
    value: unknown
  ) {
    const node = this.nodes.find((n) => n.id === moduleId);
    if (!node) {
      return { success: false, error: `未找到模块: ${moduleId}` };
    }

    const validation = this.validateParameterUpdate(node, paramKey, value);
    if (!validation.success) {
      return validation;
    }

    if (!node.data) node.data = {};
    if (!node.data.parameters) node.data.parameters = {};

    node.data.parameters[paramKey] = value;

    this.operations.push({
      type: 'UPDATE_MODULE_PARAM',
      data: { id: moduleId, key: paramKey, value },
    });

    const details = this.getModuleDetails(moduleId);

    return {
      success: true,
      data: {
        message: `成功更新模块 ${moduleId} 的参数 ${paramKey} 为 ${value}`,
        moduleDetails: details.data,
      },
    };
  }

  /**
   * 连接模块
   */
  public connectModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) {
    const sourceNode = this.nodes.find((n) => n.id === sourceId);
    const targetNode = this.nodes.find((n) => n.id === targetId);

    if (!sourceNode || !targetNode) {
      return {
        success: false,
        error: `找不到源模块 (${sourceId}) 或目标模块 (${targetId})`,
      };
    }

    // 自动端口发现逻辑
    let finalSourceHandle = sourceHandle;
    let finalTargetHandle = targetHandle;

    if (!finalSourceHandle || !finalTargetHandle) {
      const sourcePorts = this.getNodePorts(sourceNode);
      const targetPorts = this.getNodePorts(targetNode);

      // 如果未指定 sourceHandle，尝试自动选择
      if (!finalSourceHandle) {
        const outputs = Object.keys(sourcePorts.outputs || {});
        // 优先找 "output" 或 "out"
        const defaultOut = outputs.find(
          (k) =>
            k.toLowerCase().includes('output') ||
            k.toLowerCase().includes('out')
        );
        // 如果没有明确的，且只有一个输出，就用那个
        if (defaultOut) {
          finalSourceHandle = defaultOut;
        } else if (outputs.length === 1) {
          finalSourceHandle = outputs[0];
        }
      }

      // 如果未指定 targetHandle，尝试自动选择
      if (!finalTargetHandle) {
        const inputs = Object.keys(targetPorts.inputs || {});
        // 优先找 "input" 或 "in"
        const defaultIn = inputs.find(
          (k) =>
            k.toLowerCase().includes('input') || k.toLowerCase().includes('in')
        );
        // 如果没有明确的，且只有一个输入，就用那个
        if (defaultIn) {
          finalTargetHandle = defaultIn;
        } else if (inputs.length === 1) {
          finalTargetHandle = inputs[0];
        }
      }
    }

    if (!finalSourceHandle || !finalTargetHandle) {
      return {
        success: false,
        error: '无法自动确定连接端口，请指定 sourceHandle 和 targetHandle',
      };
    }

    const sourcePorts = this.getNodePorts(sourceNode);
    const targetPorts = this.getNodePorts(targetNode);
    const sourcePortType = sourcePorts.outputs[finalSourceHandle];
    const targetPortType = targetPorts.inputs[finalTargetHandle];

    if (!sourcePortType || !targetPortType) {
      return {
        success: false,
        error: `端口不存在: ${sourceId}.${finalSourceHandle} -> ${targetId}.${finalTargetHandle}`,
      };
    }

    if (sourcePortType !== targetPortType) {
      return {
        success: false,
        error: `端口类型不匹配: ${sourcePortType} -> ${targetPortType}`,
      };
    }

    const hasDuplicate = this.edges.some(
      (edge) =>
        edge.source === sourceId &&
        edge.target === targetId &&
        this.normalizeSourceHandle(edge.sourceHandle) === finalSourceHandle &&
        this.normalizeTargetHandle(edge.targetHandle) === finalTargetHandle
    );
    if (hasDuplicate) {
      return {
        success: false,
        error: '连接已存在',
      };
    }

    const conflictingEdges = this.isMultiInputPort(targetPortType)
      ? []
      : this.edges.filter(
          (edge) =>
            edge.target === targetId &&
            this.normalizeTargetHandle(edge.targetHandle) === finalTargetHandle
        );

    if (conflictingEdges.length > 0) {
      const conflictingIds = new Set(conflictingEdges.map((edge) => edge.id));
      this.edges = this.edges.filter((edge) => !conflictingIds.has(edge.id));

      conflictingEdges.forEach((edge) => {
        this.operations.push({
          type: 'DISCONNECT_MODULES',
          data: {
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          },
        });
      });
    }

    const edgeId = createEdgeId(this.edges.map((edge) => edge.id));
    const newEdge: FlowEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: finalSourceHandle,
      targetHandle: finalTargetHandle,
    };

    this.edges.push(newEdge);

    this.operations.push({
      type: 'CONNECT_MODULES',
      data: {
        source: sourceId,
        target: targetId,
        sourceHandle: finalSourceHandle,
        targetHandle: finalTargetHandle,
      },
    });

    const sourceDetails = this.getModuleDetails(sourceId);
    const targetDetails = this.getModuleDetails(targetId);

    return {
      success: true,
      data: {
        message: `成功连接模块 ${sourceId} (${finalSourceHandle || 'default'}) 到 ${targetId} (${finalTargetHandle || 'default'})`,
        sourceModuleDetails: sourceDetails.data,
        targetModuleDetails: targetDetails.data,
      },
    };
  }

  /**
   * 断开模块连接
   */
  public disconnectModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) {
    const initialLength = this.edges.length;
    this.edges = this.edges.filter(
      (e) =>
        !(
          e.source === sourceId &&
          e.target === targetId &&
          (!sourceHandle ||
            this.normalizeSourceHandle(e.sourceHandle) === sourceHandle) &&
          (!targetHandle ||
            this.normalizeTargetHandle(e.targetHandle) === targetHandle)
        )
    );

    if (this.edges.length < initialLength) {
      this.operations.push({
        type: 'DISCONNECT_MODULES',
        data: {
          source: sourceId,
          target: targetId,
          sourceHandle,
          targetHandle,
        },
      });

      const sourceDetails = this.getModuleDetails(sourceId);
      const targetDetails = this.getModuleDetails(targetId);

      return {
        success: true,
        data: {
          message: `成功断开模块 ${sourceId} 和 ${targetId} 之间的连接`,
          sourceModuleDetails: sourceDetails.data,
          targetModuleDetails: targetDetails.data,
        },
      };
    }

    return {
      success: false,
      error: '未找到指定的连接',
    };
  }

  /**
   * RAG: 本地向量检索
   * 直接调用 RAG Service 逻辑，避免 fetch 调用失败
   */
  public async ragSearch(query: string, topK?: unknown) {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'query is required' };
    }

    try {
      const results = await this.searchDocuments(query, normalizeTopK(topK));
      return { success: true, data: results };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'RAG 搜索失败';
      logger.error('RAG Search Failed', msg);
      return { success: false, error: `RAG 搜索失败: ${msg}` };
    }
  }
}
