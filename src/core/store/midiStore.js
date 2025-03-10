const createMidiStore = (set, get) => ({
  // 状态
  midiEnabled: false,
  midiInputs: [],
  midiOutputs: [],
  midiListeners: {},
  midiInputConnections: {}, // 记录哪些节点连接到哪些MIDI输入

  // Actions
  initializeMidi: async () => {
    console.log('初始化MIDI子系统');

    try {
      // 检查MIDI API是否可用
      if (navigator.requestMIDIAccess) {
        // 获取MIDI访问
        const midiAccess = await navigator.requestMIDIAccess();

        // 获取MIDI输入和输出
        const inputs = Array.from(midiAccess.inputs.values());
        const outputs = Array.from(midiAccess.outputs.values());

        // 监听MIDI状态变化
        midiAccess.onstatechange = (_e) => {
          get().refreshMidiDevices();
        };

        set({
          midiEnabled: true,
          midiAccess,
          midiInputs: inputs,
          midiOutputs: outputs,
        });

        console.log(
          `MIDI系统初始化成功，发现 ${inputs.length} 个输入和 ${outputs.length} 个输出设备`
        );
        return true;
      } else {
        console.log('此浏览器不支持MIDI API');
        set({ midiEnabled: false });
        return false;
      }
    } catch (error) {
      console.error('MIDI初始化失败:', error);
      set({ midiEnabled: false });
      return false;
    }
  },

  cleanupMidi: () => {
    // 移除所有MIDI监听器
    Object.entries(get().midiListeners).forEach(([inputId, _listener]) => {
      const input = get().midiInputs.find((input) => input.id === inputId);
      if (input) {
        input.onmidimessage = null;
      }
    });

    set({
      midiEnabled: false,
      midiInputs: [],
      midiOutputs: [],
      midiListeners: {},
      midiInputConnections: {},
    });
  },

  // 刷新MIDI设备列表
  refreshMidiDevices: () => {
    if (!get().midiAccess) return;

    const inputs = Array.from(get().midiAccess.inputs.values());
    const outputs = Array.from(get().midiAccess.outputs.values());

    set({ midiInputs: inputs, midiOutputs: outputs });
  },

  // 连接节点到MIDI输入
  connectNodeToMidiInput: (nodeId, inputId) => {
    const input = get().midiInputs.find((input) => input.id === inputId);
    if (!input) return false;

    // 创建MIDI消息监听器
    const handleMidiMessage = (message) => {
      // 处理MIDI消息并应用到节点
      get().processMidiMessageForNode(nodeId, message);
    };

    // 如果此输入已有监听器，先移除旧的
    if (get().midiListeners[inputId]) {
      input.onmidimessage = null;
    }

    // 设置新的监听器
    input.onmidimessage = handleMidiMessage;

    // 更新状态
    set((state) => ({
      midiListeners: {
        ...state.midiListeners,
        [inputId]: handleMidiMessage,
      },
      midiInputConnections: {
        ...state.midiInputConnections,
        [nodeId]: inputId,
      },
    }));

    return true;
  },

  // 断开节点与MIDI输入的连接
  disconnectNodeFromMidi: (nodeId) => {
    const inputId = get().midiInputConnections[nodeId];
    if (!inputId) return false;

    // 检查是否有其他节点还在使用此输入
    const otherNodesUsingInput =
      Object.entries(get().midiInputConnections).filter(
        ([nId, iId]) => iId === inputId && nId !== nodeId
      ).length > 0;

    // 如果没有其他节点使用此输入，移除监听器
    if (!otherNodesUsingInput) {
      const input = get().midiInputs.find((input) => input.id === inputId);
      if (input) {
        input.onmidimessage = null;
      }

      // 更新监听器状态
      set((state) => {
        const newListeners = { ...state.midiListeners };
        delete newListeners[inputId];
        return { midiListeners: newListeners };
      });
    }

    // 更新连接状态
    set((state) => {
      const newConnections = { ...state.midiInputConnections };
      delete newConnections[nodeId];
      return { midiInputConnections: newConnections };
    });

    return true;
  },

  // 处理MIDI消息并应用到节点
  processMidiMessageForNode: (nodeId, midiMessage) => {
    // 获取节点信息
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // 解析MIDI消息
    const data = midiMessage.data;
    const messageType = data[0] & 0xf0; // 取高4位作为命令类型
    const _channel = data[0] & 0x0f; // 取低4位作为通道

    switch (messageType) {
      case 0x90: // Note On
        if (data[2] > 0) {
          // 音符开始 (note, velocity > 0)
          const note = data[1];
          const velocity = data[2] / 127;

          // 如果节点是合成器，触发音符开始
          if (
            node.data.moduleId === 'synth' ||
            node.data.category === 'GENERATOR'
          ) {
            // 更新节点状态
            get().updateNodeParameter(nodeId, {
              type: 'MIDI_NOTE_ON',
              note,
              velocity,
            });

            // 通知音频引擎
            if (get().audioNodes[nodeId]?.instance?.triggerAttack) {
              const freq = Tone.Frequency(note, 'midi').toFrequency();
              get().audioNodes[nodeId].instance.triggerAttack(
                freq,
                Tone.now(),
                velocity
              );
            }
          }
        } else {
          // 音符结束 (velocity = 0 的 Note On 等同于 Note Off)
          // 与Note Off相同的处理
          const note = data[1];

          if (
            node.data.moduleId === 'synth' ||
            node.data.category === 'GENERATOR'
          ) {
            // 更新节点状态
            get().updateNodeParameter(nodeId, {
              type: 'MIDI_NOTE_OFF',
              note,
            });

            // 通知音频引擎
            if (get().audioNodes[nodeId]?.instance?.triggerRelease) {
              const freq = Tone.Frequency(note, 'midi').toFrequency();
              get().audioNodes[nodeId].instance.triggerRelease(freq);
            }
          }
        }
        break;

      case 0x80: // Note Off
        const note = data[1];

        if (
          node.data.moduleId === 'synth' ||
          node.data.category === 'GENERATOR'
        ) {
          // 更新节点状态
          get().updateNodeParameter(nodeId, {
            type: 'MIDI_NOTE_OFF',
            note,
          });

          // 通知音频引擎
          if (get().audioNodes[nodeId]?.instance?.triggerRelease) {
            const freq = Tone.Frequency(note, 'midi').toFrequency();
            get().audioNodes[nodeId].instance.triggerRelease(freq);
          }
        }
        break;

      case 0xb0: // Control Change
        const controlNumber = data[1];
        const controlValue = data[2] / 127; // 归一化到 0-1

        // 查找节点中可能映射到此控制器的参数
        const midiMappableParams = Object.entries(node.data.parameters)
          .filter(([_, param]) => param.midiControllable)
          .find(([_, param]) => param.midiCC === controlNumber);

        if (midiMappableParams) {
          const [paramKey, param] = midiMappableParams;

          // 将控制器值映射到参数范围
          const mappedValue =
            param.min + (param.max - param.min) * controlValue;

          // 更新节点参数
          get().updateNodeParameter(nodeId, {
            type: 'PARAMETER_CHANGE',
            parameterKey: paramKey,
            parameterValue: mappedValue,
          });
        }

        // 更新节点状态，表示收到了控制器消息
        get().updateNodeParameter(nodeId, {
          type: 'MIDI_CC',
          controlNumber,
          controlValue,
        });
        break;

      case 0xe0: // Pitch Bend
        const lsb = data[1];
        const msb = data[2];
        const pitchBendValue = (((msb << 7) | lsb) / 16383) * 2 - 1; // 转换为 -1 到 1

        // 更新节点状态
        get().updateNodeParameter(nodeId, {
          type: 'MIDI_PITCH_BEND',
          pitchBendValue,
        });

        // 如果节点有音高参数，可以自动映射
        if (node.data.parameters?.pitch || node.data.parameters?.frequency) {
          const paramKey = node.data.parameters?.pitch ? 'pitch' : 'frequency';
          const param = node.data.parameters[paramKey];

          // 假设音高弯曲范围为 ±2 个半音
          const pitchBendRange = 2;
          const pitchOffset = pitchBendValue * pitchBendRange;

          // 如果是频率参数，需要进行指数变换
          if (paramKey === 'frequency') {
            const baseFreq = param.value;
            const newFreq = baseFreq * Math.pow(2, pitchOffset / 12);

            // 更新节点参数
            get().updateNodeParameter(nodeId, {
              type: 'PARAMETER_CHANGE',
              parameterKey: paramKey,
              parameterValue: newFreq,
            });
          } else {
            // 直接更新音高参数
            const newPitch = param.value + pitchOffset;

            // 更新节点参数
            get().updateNodeParameter(nodeId, {
              type: 'PARAMETER_CHANGE',
              parameterKey: paramKey,
              parameterValue: newPitch,
            });
          }
        }
        break;

      // 可以根据需要添加其他MIDI消息类型的处理
    }
  },

  // MIDI学习模式
  midiLearnMode: {
    active: false,
    targetNodeId: null,
    targetParamKey: null,
  },

  // 启动MIDI学习
  startMidiLearn: (nodeId, paramKey) => {
    set({
      midiLearnMode: {
        active: true,
        targetNodeId: nodeId,
        targetParamKey: paramKey,
      },
    });
  },

  // 停止MIDI学习
  stopMidiLearn: () => {
    set({
      midiLearnMode: {
        active: false,
        targetNodeId: null,
        targetParamKey: null,
      },
    });
  },

  // 处理MIDI学习
  handleMidiLearn: (ccNumber, channel = 0) => {
    const { midiLearnMode } = get();

    if (midiLearnMode.active) {
      const { targetNodeId, targetParamKey } = midiLearnMode;

      // 更新参数的MIDI映射
      get().updateNodeParameter(targetNodeId, {
        type: 'MIDI_MAPPING',
        parameterKey: targetParamKey,
        midiCC: ccNumber,
        midiChannel: channel,
        midiControllable: true,
      });

      // 停止学习模式
      get().stopMidiLearn();

      return true;
    }

    return false;
  },
});

export default createMidiStore;
