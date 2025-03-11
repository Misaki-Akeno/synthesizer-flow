'use client';

import { useEffect, useState } from 'react';
import { moduleService } from '@/core/services/ModuleService';
import { moduleRegistry } from '@/core/services/ModuleRegistry';
import { discoverAndRegisterModules } from '@/core/services/ModuleRegistry';
import { eventBus } from '@/core/events/EventBus';
import { useModulesStore } from '@/core/store/useModulesStore';

export default function DebugPage() {
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
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">合成器调试页面</h1>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">可用模块</h2>
        <div className="flex gap-2 flex-wrap">
          {availableModules.map((moduleType) => (
            <button
              key={moduleType}
              onClick={() => addModule(moduleType)}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              添加 {moduleType}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">已创建模块</h2>
        <ul className="list-disc pl-5">
          {modules.map((moduleId) => (
            <li key={moduleId}>{moduleId}</li>
          ))}
        </ul>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">操作</h2>
        <div className="flex gap-2">
          <button
            onClick={connectModules}
            className="px-4 py-2 bg-purple-500 text-white rounded"
          >
            连接前两个模块
          </button>
          <button
            onClick={playTestTone}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            测试声音
          </button>
        </div>
      </div>
    </div>
  );
}
