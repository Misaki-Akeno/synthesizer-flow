import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// 先导入所有子系统创建函数
import createFlowStore from './flowStore';
import createModulationStore from './modulationStore';

// 以后再添加这些
// import createAudioStore from './audioStore';
// import createMidiStore from './midiStore';

// 创建根 store
const useRootStore = create(
  devtools(
    (set, get) => ({
      // 全局状态和 actions
      initialized: false,
      error: null,

      // 合并所有子系统（在创建时就合并，而不是后期setState）
      // 流程图子系统
      ...createFlowStore(set, get),

      // 调制子系统
      ...createModulationStore(set, get),

      // 音频系统 (以后添加)
      // ...createAudioStore(set, get),

      // MIDI系统 (以后添加)
      // ...createMidiStore(set, get),

      // 提供缺失的音频相关接口，避免错误
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      updateAudioParameter: (nodeId, paramKey, value) => {
        // console.log(`假更新音频参数: ${nodeId}.${paramKey} = ${value}`);
        // 临时空实现
      },

      removeAudioNode: () => {},

      createAudioConnection: () => {},

      removeAudioConnection: () => {},

      startAudio: () => {
        console.log('假启动音频引擎');
        set({ audioStarted: true });
      },

      audioStarted: false,

      // 全局初始化方法
      initialize: async () => {
        try {
          set({ initialized: false });

          // 按顺序初始化各子系统
          if (get().initializeFlow) await get().initializeFlow();
          if (get().initializeModulation) await get().initializeModulation();
          // if (get().initializeAudio) await get().initializeAudio();
          // if (get().initializeMidi) await get().initializeMidi();

          set({ initialized: true });
          console.log('系统初始化完成');
        } catch (error) {
          console.error('初始化系统失败:', error);
          set({ error: error.message || '初始化失败' });
        }
      },

      // 全局关闭方法
      shutdown: () => {
        // 按顺序关闭各子系统
        // if (get().cleanupMidi) get().cleanupMidi();
        if (get().cleanupModulation) get().cleanupModulation();
        if (get().cleanupFlow) get().cleanupFlow();
        // if (get().cleanupAudio) get().cleanupAudio();

        set({ initialized: false });
        console.log('系统已关闭');
      },
    }),
    { name: 'SynthesizerFlow' }
  )
);

export default useRootStore;
