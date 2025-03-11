// 模块状态存储
// - 存储模块注册表
// - 存储当前工作区中的模块实例
// - 提供添加/删除/更新模块的操作

import { create } from 'zustand';
import { ModuleBase } from '@/types/module';
import { Position as NodePosition } from '@/types/event';

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
        [module.id]: module
      },
      positions: {
        ...state.positions,
        [module.id]: position || { x: 100, y: 100 }
      }
    }));
  },
  
  updatePosition: (moduleId, position) => {
    set((state) => ({
      positions: {
        ...state.positions,
        [moduleId]: position
      }
    }));
  },
  
  addConnection: (connection) => {
    set((state) => ({
      connections: {
        ...state.connections,
        [connection.id]: connection
      }
    }));
  },
  
  removeConnection: (connectionId) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  }
}));
