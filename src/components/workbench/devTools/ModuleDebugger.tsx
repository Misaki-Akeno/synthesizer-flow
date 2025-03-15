'use client';

import { useEffect, useState } from 'react';
import { moduleRegistry } from '@/core/factory/ModuleRegistry';
import { eventBus } from '@/core/events/EventBus';
import { Button } from '@/components/ui/button';
import { Services } from '@/core/services/ServiceManager';

export default function ModuleDebugger() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [modules, setModules] = useState<string[]>([]);
  const [availableModules, setAvailableModules] = useState<string[]>([]);

  // 初始化模块系统
  useEffect(() => {
    const initApp = async () => {
      // 获取所有可用模块类型
      const moduleTypes = moduleRegistry.getAll().map((m) => m.metadata.id);
      setAvailableModules(moduleTypes);
    };

    initApp();

    // 监听模块创建事件
    const onModuleCreated = ({ moduleId }: { moduleId: string }) => {
      setModules((prev) => [...prev, moduleId]);
    };

    eventBus.on('MODULE.CREATED', onModuleCreated);

    return () => {
      eventBus.off('MODULE.CREATED', onModuleCreated);
    };
  }, []);

  // 添加模块
  const addModule = async (moduleTypeId: string) => {
    try {
      // 使用 ServiceAccessor 获取模块服务
      await Services.moduleService.createModule(moduleTypeId, {
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 200,
      });
    } catch (error) {
      console.error('添加模块失败:', error);
    }
  };


  return (
    <div className="space-y-3">


      <div className="mb-3">
        <h3 className="font-medium mb-2">可用模块</h3>
        <div className="flex gap-2 flex-wrap">
          {availableModules.map((moduleType) => (
            <Button
              size="sm"
              variant="outline"
              key={moduleType}
              onClick={() => addModule(moduleType)}
            >
              添加 {moduleType}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
