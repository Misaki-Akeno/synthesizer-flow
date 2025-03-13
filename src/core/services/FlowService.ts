import { eventBus } from '../events/EventBus';
import type { ModuleBase } from '@/interfaces/module';
import type { Position } from '@/interfaces/event';
import { nanoid } from 'nanoid';
import { container } from '../di/Container';

type FlowNode = {
  id: string;
  type: string;
  data: {
    moduleId: string;
    moduleTypeId: string;
    module: ModuleBase | null;
    label: string;
  };
  position: {
    x: number;
    y: number;
  };
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export class FlowService {
  private nodes: FlowNode[] = [];
  private edges: FlowEdge[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.registerEventListeners();
    // 将自身注册到容器
    container.register('flowService', this);
  }

  private registerEventListeners(): void {
    // 监听模块实例化事件
    eventBus.on('MODULE.INSTANTIATED', (event) => {
      this.addNode(event.moduleId, event.moduleTypeId, event.position);
    });

    // 监听连接请求事件
    eventBus.on('CONNECTION.REQUESTED', (event) => {
      this.addEdge(
        event.source,
        event.target,
        event.sourceHandle,
        event.targetHandle
      );
    });

    // 监听节点移动事件
    eventBus.on('UI.NODE.MOVED', (event) => {
      this.updateNodePosition(event.nodeId, event.position);
    });

    // 监听节点删除事件
    eventBus.on('UI.NODE.DELETED', (event) => {
      this.removeNode(event.nodeId);
    });

    // 监听连接删除事件
    eventBus.on('UI.CONNECTION.DELETED', (event) => {
      this.removeEdge(event.connectionId);
    });
  }

  public addNode(
    moduleId: string,
    moduleTypeId: string,
    position?: Position
  ): void {
    const newNode: FlowNode = {
      id: moduleId,
      type: 'moduleNode',
      data: {
        moduleId,
        moduleTypeId,
        module: null,
        label: moduleTypeId, // 默认使用模块类型ID作为标签
      },
      position: position || { x: 100, y: 100 }, // 默认位置
    };

    this.nodes.push(newNode);
    this.notifyListeners();

    // 通知UI节点已创建
    eventBus.emit('UI.NODE.CREATED', { nodeId: moduleId });
  }

  public addEdge(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ): void {
    const edgeId = `edge-${nanoid()}`;
    const newEdge: FlowEdge = {
      id: edgeId,
      source,
      target,
      sourceHandle,
      targetHandle,
    };

    this.edges.push(newEdge);
    this.notifyListeners();

    // 通知UI连接已创建
    eventBus.emit('UI.CONNECTION.CREATED', {
      connectionId: edgeId,
      sourceId: source,
      targetId: target,
      sourceHandle,
      targetHandle,
    });

    // 通知系统连接已建立
    eventBus.emit('CONNECTION.ESTABLISHED', {
      connectionId: edgeId,
      sourceId: source,
      targetId: target,
      sourceHandle,
      targetHandle,
    });
  }

  public updateNodePosition(nodeId: string, position: Position): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.position = position;
      this.notifyListeners();
    }
  }

  public removeNode(nodeId: string): void {
    // 首先删除与此节点相关的所有边
    this.edges = this.edges.filter((edge) => {
      if (edge.source === nodeId || edge.target === nodeId) {
        // 通知系统连接已断开
        eventBus.emit('CONNECTION.BROKEN', {
          connectionId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        });
        return false;
      }
      return true;
    });

    // 删除节点
    this.nodes = this.nodes.filter((node) => node.id !== nodeId);
    this.notifyListeners();

    // 通知系统请求销毁模块
    eventBus.emit('MODULE.DISPOSE_REQUESTED', { moduleId: nodeId });
  }

  public removeEdge(edgeId: string): void {
    const edge = this.edges.find((e) => e.id === edgeId);
    if (edge) {
      // 通知系统连接已断开
      eventBus.emit('CONNECTION.BROKEN', {
        connectionId: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      });
    }

    this.edges = this.edges.filter((edge) => edge.id !== edgeId);
    this.notifyListeners();
  }

  public getNodes(): FlowNode[] {
    return [...this.nodes];
  }

  public getEdges(): FlowEdge[] {
    return [...this.edges];
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// 不再导出单例实例，请通过容器获取
// 使用方法：container.get<FlowService>('flowService')
