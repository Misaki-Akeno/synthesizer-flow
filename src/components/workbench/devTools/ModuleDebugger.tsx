'use client';

import { useEffect, useState } from 'react';
import { moduleService } from '@/core/services/ModuleService';
import { moduleRegistry } from '@/core/factory/ModuleRegistry';
import { discoverAndRegisterModules } from '@/core/factory/ModuleRegistry';
import { eventBus } from '@/core/events/EventBus';
import { useModulesStore } from '@/core/store/useModulesStore';
import { Button } from '@/components/ui/button';

export default function ModuleDebugger() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [modules, setModules] = useState<string[]>([]);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const allModules = useModulesStore((state) => state.modules);

  // 初始化模块系统
  useEffect(() => {
    const initModuleSystem = async () => {
      await discoverAndRegisterModules();
      await moduleService.initialize();

      // 获取所有可用模块类型
      const moduleTypes = moduleRegistry.getAll().map((m) => m.metadata.id);
      setAvailableModules(moduleTypes);
    };

    initModuleSystem();

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

    eventBus.emit('CONNECTION.REQUESTED', {
      source,
      target,
      sourceHandle: 'audio_out',
      targetHandle: 'audio_in',
    });
  };

  // 触发示波器模块显示
  const playTestTone = async () => {
    // 查找振荡器模块
    const oscillatorModule = Object.values(allModules).find(
      (module) => module.typeId === 'oscillator-basic'
    );

    if (oscillatorModule) {
      // 改变振荡器参数
      oscillatorModule.setParameterValue('frequency', 880);
      oscillatorModule.setParameterValue('amplitude', 0.5);
    } else {
      console.log('未找到振荡器模块，请先添加一个');
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

      <div className="mb-3">
        <h3 className="font-medium mb-2">操作</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={connectModules}>
            连接前两个模块
          </Button>
          <Button size="sm" variant="secondary" onClick={playTestTone}>
            测试声音
          </Button>
        </div>
      </div>
    </div>
  );
}
