'use client';

import { useEffect, useState } from 'react';
import { moduleRegistry } from '@/core/factory/ModuleRegistry';
import { eventBus } from '@/core/events/EventBus';
import { useModulesStore } from '@/core/store/useModulesStore';
import { Button } from '@/components/ui/button';
import { bootstrapApplication, getService } from '@/core/bootstrap';

export default function ModuleDebugger() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [modules, setModules] = useState<string[]>([]);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const allModules = useModulesStore((state) => state.modules);

  // 初始化模块系统
  useEffect(() => {
    const initApp = async () => {
      // 引导应用初始化
      await bootstrapApplication();
      setIsInitialized(true);

      // 获取所有可用模块类型
      const moduleTypes = moduleRegistry.getAll().map((m) => m.metadata.id);
      setAvailableModules(moduleTypes);
    };

    initApp();

    // 监听模块创建事件
    const onModuleCreated = ({ moduleId }: { moduleId: string }) => {
      setModules((prev) => [...prev, moduleId]);
      console.log(`模块已创建: ${moduleId}`);
    };

    eventBus.on('MODULE.CREATED', onModuleCreated);

    return () => {
      eventBus.off('MODULE.CREATED', onModuleCreated);
    };
  }, []);

  // 添加模块
  const addModule = async (moduleTypeId: string) => {
    try {
      // 使用依赖注入获取模块服务
      const moduleService = getService('moduleService');
      await moduleService.createModule(moduleTypeId, {
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 200,
      });
    } catch (error) {
      console.error('添加模块失败:', error);
    }
  };

  // 连接两个模块
  const connectModules = () => {
    if (Object.keys(allModules).length < 2) {
      alert('需要至少两个模块才能建立连接');
      return;
    }

    const moduleIds = Object.keys(allModules);
    const source = moduleIds[0];
    const target = moduleIds[1];

    // 使用连接服务创建连接
    const connectionService = getService('connectionService');
    connectionService.createConnection(
      source,
      target,
      'audio_out',
      'audio_in'
    );
  };

  // 触发示波器模块显示
  const playTestTone = async () => {
    // 查找振荡器模块
    const oscillatorModule = Object.values(allModules).find(
      (module) => module.typeId === 'oscillator-basic'
    );

    if (oscillatorModule) {
      // 使用参数服务修改振荡器参数
      const parameterService = getService('parameterService');
      parameterService.setParameterValue(oscillatorModule.id, 'frequency', 880);
      parameterService.setParameterValue(oscillatorModule.id, 'amplitude', 0.5);
    } else {
      console.log('未找到振荡器模块，请先添加一个');
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-3">
        <h3 className="font-medium mb-2">状态: {isInitialized ? '已初始化' : '初始化中...'}</h3>
      </div>

      <div className="mb-3">
        <h3 className="font-medium mb-2">可用模块</h3>
        <div className="flex gap-2 flex-wrap">
          {availableModules.map((moduleType) => (
            <Button
              size="sm"
              variant="outline"
              key={moduleType}
              onClick={() => addModule(moduleType)}
              disabled={!isInitialized}
            >
              添加 {moduleType}
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <h3 className="font-medium mb-2">操作</h3>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={connectModules}
            disabled={!isInitialized}
          >
            连接前两个模块
          </Button>
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={playTestTone}
            disabled={!isInitialized}
          >
            测试声音
          </Button>
        </div>
      </div>
    </div>
  );
}
