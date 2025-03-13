/* eslint-disable @typescript-eslint/no-unused-vars */
// 模块状态存储
// - 存储模块注册表
// - 存储当前工作区中的模块实例
// - 提供添加/删除/更新模块的操作

import { create } from 'zustand';
import { ModuleBase } from '@/interfaces/module';
import { Position as NodePosition } from '@/interfaces/event';

// 连接定义
export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// 模块状态接口
interface ModulesState {
  // 所有模块实例
  modules: Record<string, ModuleBase>;

  // 模块位置信息
  positions: Record<string, NodePosition>;

  // 模块间的连接
  connections: Record<string, Connection>;

  // 当前选中的模块ID
  selectedModuleId: string | null;

  // 添加模块实例
  addModule: (module: ModuleBase, position?: NodePosition) => void;

  // 删除模块实例
  removeModule: (moduleId: string) => void;

  // 更新模块位置
  updatePosition: (moduleId: string, position: NodePosition) => void;

  // 添加连接
  addConnection: (connection: Connection) => void;

  // 删除连接
  removeConnection: (connectionId: string) => void;

  // 设置选中模块
  selectModule: (moduleId: string | null) => void;

  // 获取模块实例
  getModule: (moduleId: string) => ModuleBase | undefined;

  // 获取所有模块实例
  getAllModules: () => ModuleBase[];

  // 获取模块位置
  getPosition: (moduleId: string) => NodePosition | undefined;

  // 获取所有连接
  getAllConnections: () => Connection[];
}

// 创建模块状态存储
export const useModulesStore = create<ModulesState>((set, get) => ({
  modules: {},
  positions: {},
  connections: {},
  selectedModuleId: null,

  addModule: (module, position) => {
    set((state) => ({
      modules: {
        ...state.modules,
        [module.id]: module,
      },
      positions: {
        ...state.positions,
        [module.id]: position || { x: 100, y: 100 },
      },
    }));
  },

  removeModule: (moduleId) => {
    set((state) => {
      // 创建modules和positions的副本，排除要删除的模块
      const { [moduleId]: removedModule, ...remainingModules } = state.modules;
      const { [moduleId]: removedPosition, ...remainingPositions } =
        state.positions;

      // 找到与该模块相关的所有连接
      const remainingConnections = { ...state.connections };
      Object.keys(state.connections).forEach((connectionId) => {
        const connection = state.connections[connectionId];
        if (
          connection.sourceId === moduleId ||
          connection.targetId === moduleId
        ) {
          delete remainingConnections[connectionId];
        }
      });

      return {
        modules: remainingModules,
        positions: remainingPositions,
        connections: remainingConnections,
        // 如果当前选中的是被删除的模块，则清除选中状态
        selectedModuleId:
          state.selectedModuleId === moduleId ? null : state.selectedModuleId,
      };
    });
  },

  updatePosition: (moduleId, position) => {
    set((state) => ({
      positions: {
        ...state.positions,
        [moduleId]: position,
      },
    }));
  },

  addConnection: (connection) => {
    set((state) => ({
      connections: {
        ...state.connections,
        [connection.id]: connection,
      },
    }));
  },

  removeConnection: (connectionId) => {
    set((state) => {
      const { [connectionId]: removed, ...rest } = state.connections;
      return { connections: rest };
    });
  },

  selectModule: (moduleId) => {
    set({ selectedModuleId: moduleId });
  },

  getModule: (moduleId) => {
    return get().modules[moduleId];
  },

  getAllModules: () => {
    return Object.values(get().modules);
  },

  getPosition: (moduleId) => {
    return get().positions[moduleId];
  },

  getAllConnections: () => {
    return Object.values(get().connections);
  },
}));
