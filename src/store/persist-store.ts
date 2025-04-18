import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useFlowStore } from './store';

export interface ProjectConfig {
  name: string;
  description?: string;
  created: string;
  lastModified: string;
  data: string; // JSON 格式的画布数据
  thumbnail?: string; // Base64格式的画布缩略图
  tags?: string[];
}

interface PersistState {
  // 用户偏好设置
  preferences: {
    darkMode: boolean;
    autoSave: boolean;
    snapToGrid: boolean;
    gridSize: number;
    controlPanelVisible: boolean;
  };

  // 用户最近保存的项目记录
  recentProjects: ProjectConfig[];
  
  // 当前加载的项目
  currentProject: ProjectConfig | null;

  // 项目管理方法
  saveCurrentCanvas: (name: string, description?: string) => Promise<boolean>;
  loadProject: (projectData: ProjectConfig) => Promise<boolean>;
  deleteProject: (projectName: string) => void;
  exportProjectToFile: (projectName: string) => void;
  importProjectFromJson: (jsonData: string) => Promise<boolean>;
}

// 创建用于处理JSON字符串的工具函数
const jsonUtils = {
  // 将JSON字符串转换为URL安全格式（替换特殊字符）
  makeJsonUrlSafe(jsonStr: string): string {
    return encodeURIComponent(jsonStr);
  },
  
  // 将URL安全的JSON字符串转回正常格式
  restoreUrlSafeJson(safeJsonStr: string): string {
    return decodeURIComponent(safeJsonStr);
  }
};

export const usePersistStore = create<PersistState>()(
  persist(
    (set, get) => ({
      // 默认偏好设置
      preferences: {
        darkMode: false,
        autoSave: true, 
        snapToGrid: true,
        gridSize: 15,
        controlPanelVisible: true,
      },
      
      // 保存的项目列表
      recentProjects: [],
      
      // 当前项目
      currentProject: null,

      // 保存当前画布状态为新项目
      saveCurrentCanvas: async (name: string, description?: string) => {
        try {
          // 获取当前画布的JSON编码
          const canvasData = useFlowStore.getState().exportCanvasToJson();
          
          // 使用URL安全的JSON格式
          const safeJson = jsonUtils.makeJsonUrlSafe(canvasData);
          
          // 创建项目配置
          const now = new Date().toISOString();
          const project: ProjectConfig = {
            name,
            description,
            created: now,
            lastModified: now,
            data: safeJson,
            // TODO: 添加缩略图生成功能
          };
          
          // 更新状态
          set((state) => {
            // 检查是否已存在同名项目
            const existingIndex = state.recentProjects.findIndex(
              (p) => p.name === name
            );
            
            const updatedProjects = [...state.recentProjects];
            if (existingIndex >= 0) {
              // 更新现有项目
              updatedProjects[existingIndex] = project;
            } else {
              // 添加新项目
              updatedProjects.unshift(project);
              // 保持列表长度不超过20个项目
              if (updatedProjects.length > 20) {
                updatedProjects.pop();
              }
            }
            
            return {
              recentProjects: updatedProjects,
              currentProject: project,
            };
          });
          
          return true;
        } catch (error) {
          console.error('保存画布失败:', error);
          return false;
        }
      },
      
      // 加载已保存的项目
      loadProject: async (projectData: ProjectConfig) => {
        try {
          // 将URL安全的JSON转换回标准JSON
          const jsonData = jsonUtils.restoreUrlSafeJson(projectData.data);
          
          // 将JSON数据导入到画布
          const success = useFlowStore.getState().importCanvasFromJson(jsonData);
          
          if (success) {
            // 更新当前项目
            set({
              currentProject: {
                ...projectData,
                lastModified: new Date().toISOString(),
              },
            });
          }
          
          return success;
        } catch (error) {
          console.error('加载项目失败:', error);
          return false;
        }
      },
      
      // 删除已保存的项目
      deleteProject: (projectName: string) => {
        set((state) => {
          const updatedProjects = state.recentProjects.filter(
            (p) => p.name !== projectName
          );
          
          return {
            recentProjects: updatedProjects,
            // 如果删除的是当前项目，则清空当前项目
            currentProject: 
              state.currentProject?.name === projectName ? null : state.currentProject,
          };
        });
      },
      
      // 导出项目到文件
      exportProjectToFile: (projectName: string) => {
        const { recentProjects } = get();
        const project = recentProjects.find((p) => p.name === projectName);
        
        if (!project) {
          console.error('找不到要导出的项目:', projectName);
          return;
        }
        
        // 创建下载链接
        const dataStr = JSON.stringify(project);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${projectName.replace(/\s+/g, '_')}.sfproj`;
        link.click();
        
        // 清理资源
        URL.revokeObjectURL(url);
      },
      
      // 从JSON字符串导入项目
      importProjectFromJson: async (jsonData: string) => {
        try {
          const success = useFlowStore.getState().importCanvasFromJson(jsonData);
          
          if (success) {
            // 自动创建一个导入的项目
            const now = new Date().toISOString();
            const safeJson = jsonUtils.makeJsonUrlSafe(jsonData);
            
            const importedProject: ProjectConfig = {
              name: `导入的项目 ${new Date().toLocaleString()}`,
              created: now,
              lastModified: now,
              data: safeJson,
            };
            
            set((state) => ({
              recentProjects: [importedProject, ...state.recentProjects],
              currentProject: importedProject,
            }));
          }
          
          return success;
        } catch (error) {
          console.error('导入项目失败:', error);
          return false;
        }
      },
    }),
    {
      name: 'synthesizer-flow-storage', // 本地存储的键名
    }
  )
);