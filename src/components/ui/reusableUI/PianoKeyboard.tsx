import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ModuleBase } from '@/core/base/ModuleBase';

// 钢琴键盘属性接口
interface PianoKeyboardProps {
  // 模块实例
  module?: ModuleBase;
  // 键盘宽度(可选)
  width?: number;
  // 键盘高度(可选)
  height?: number;
  // 起始音符(默认为中央C - 60)
  startNote?: number;
  // 音符数量(默认为1个八度 - 12个键)
  noteCount?: number;
  // 当前激活的音符
  activeNotes?: number[];
  // 音符触发回调
  onNoteOn?: (note: number, velocity: number) => void;
  // 音符释放回调
  onNoteOff?: (note: number) => void;
}

// 音符数据结构
interface NoteKey {
  note: number;
  name: string;
  isBlack: boolean;
}

// 钢琴键盘组件
const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  width = 300,
  height = 120,
  startNote = 60, // 中央C (MIDI音符60)
  noteCount = 12, // 默认1个八度
  activeNotes = [],
  onNoteOn,
  onNoteOff,
}) => {
  // 创建音符布局
  const [keys, setKeys] = useState<NoteKey[]>([]);
  // 追踪鼠标/触摸状态
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [touchedKeys, setTouchedKeys] = useState<Set<number>>(new Set());

  // 根据起始音符和数量生成键盘布局
  useEffect(() => {
    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    const blackKeyIndices = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A# 的索引

    const newKeys: NoteKey[] = [];

    for (let i = 0; i < noteCount; i++) {
      const note = startNote + i;
      const nameIndex = note % 12;
      const octave = Math.floor(note / 12) - 1; // MIDI标准，C4是中央C (MIDI音符60)
      const name = `${noteNames[nameIndex]}${octave}`;
      const isBlack = blackKeyIndices.includes(nameIndex);

      newKeys.push({ note, name, isBlack });
    }

    setKeys(newKeys);
  }, [startNote, noteCount]);

  // 计算白键数量(用于布局)
  const whiteKeyCount = keys.filter((key) => !key.isBlack).length;
  // 计算白键宽度
  const whiteKeyWidth = width / whiteKeyCount;
  // 黑键宽度和高度
  const blackKeyWidth = whiteKeyWidth * 0.6;
  const blackKeyHeight = height * 0.6;

  // 获取键的实际X位置
  const getKeyPosition = (index: number): number => {
    // 计算白键数量
    let whiteKeyIndex = 0;
    for (let i = 0; i < index; i++) {
      if (!keys[i].isBlack) {
        whiteKeyIndex++;
      }
    }

    const currentKey = keys[index];
    if (!currentKey.isBlack) {
      // 白键位置
      return whiteKeyIndex * whiteKeyWidth;
    } else {
      // 黑键位置
      return whiteKeyIndex * whiteKeyWidth - blackKeyWidth / 2;
    }
  };

  // 处理音符按下事件
  const calculateVelocity = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const clamped = Math.max(0, Math.min(1, relativeY / rect.height));

    // 点击越靠近底部力度越强，靠近顶部力度越弱
    return clamped;
  }, []);

  const handleNoteOn = useCallback(
    (note: number, event: React.PointerEvent<HTMLElement>) => {
      if (!touchedKeys.has(note)) {
        // 添加到已触摸的键集合中
        setTouchedKeys((prev) => {
          const newSet = new Set(prev);
          newSet.add(note);
          return newSet;
        });

        const velocity = calculateVelocity(event);

        // 调用外部回调
        onNoteOn?.(note, velocity);
      }
    },
    [calculateVelocity, onNoteOn, touchedKeys]
  );

  // 处理音符释放事件
  const handleNoteOff = useCallback(
    (note: number) => {
      if (touchedKeys.has(note)) {
        // 从触摸的键集合中移除
        setTouchedKeys((prev) => {
          const newSet = new Set(prev);
          newSet.delete(note);
          return newSet;
        });

        // 调用外部回调
        onNoteOff?.(note);
      }
    },
    [onNoteOff, touchedKeys]
  );

  // 鼠标/触摸事件处理
  const handlePointerDown = (note: number) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    setIsPointerDown(true);
    handleNoteOn(note, e);
  };

  const handlePointerEnter =
    (note: number) => (e: React.PointerEvent<HTMLElement>) => {
      if (isPointerDown) {
        handleNoteOn(note, e);
      }
    };

  const handlePointerLeave = (note: number) => () => {
    if (isPointerDown) {
      handleNoteOff(note);
    }
  };

  const handlePointerUp = (note: number) => () => {
    setIsPointerDown(false);
    handleNoteOff(note);
  };

  // 全局鼠标抬起处理器
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setIsPointerDown(false);
      // 释放所有被触摸的键
      touchedKeys.forEach((note) => {
        onNoteOff?.(note);
      });
      setTouchedKeys(new Set());
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [onNoteOff, touchedKeys]);

  // 更新UI以反映当前的活跃音符
  useEffect(() => {
    if (activeNotes) {
      // 只保留本键盘范围内的音符
      const validNotes = activeNotes.filter(
        (note) => note >= startNote && note < startNote + noteCount
      );

      // 如果外部活跃音符集合与当前触摸键集合不一致，更新触摸键集合
      const currentTouchedNotes = Array.from(touchedKeys);
      if (
        JSON.stringify(validNotes.sort()) !==
        JSON.stringify(currentTouchedNotes.sort())
      ) {
        setTouchedKeys(new Set(validNotes));
      }
    }
  }, [activeNotes, startNote, noteCount, touchedKeys]);

  return (
    <div
      className="piano-keyboard-container my-2 select-none"
      tabIndex={0} // 使元素可获取焦点
    >
      <div
        className="relative bg-gray-100 border border-gray-300 rounded-md overflow-hidden"
        style={{ width, height }}
      >
        {/* 白键 */}
        {keys
          .filter((key) => !key.isBlack)
          .map((key, _index) => {
            const isActive =
              activeNotes.includes(key.note) || touchedKeys.has(key.note);
            return (
              <div
                key={key.note}
                className={cn(
                  'absolute bottom-0 border-r border-gray-300 bg-white hover:bg-gray-50 transition-colors',
                  isActive ? 'bg-gray-200' : ''
                )}
                style={{
                  left: getKeyPosition(keys.indexOf(key)),
                  width: whiteKeyWidth,
                  height: height,
                }}
                onPointerDown={handlePointerDown(key.note)}
                onPointerEnter={handlePointerEnter(key.note)}
                onPointerLeave={handlePointerLeave(key.note)}
                onPointerUp={handlePointerUp(key.note)}
                data-note={key.note}
              >
                <div className="text-xs text-gray-400 absolute bottom-1 left-1/2 transform -translate-x-1/2">
                  {key.name}
                </div>
              </div>
            );
          })}

        {/* 黑键 */}
        {keys
          .filter((key) => key.isBlack)
          .map((key) => {
            const isActive =
              activeNotes.includes(key.note) || touchedKeys.has(key.note);
            return (
              <div
                key={key.note}
                className={cn(
                  'absolute top-0 rounded-b-md bg-gray-800 hover:bg-gray-700 z-10 transition-colors',
                  isActive ? 'bg-gray-600' : ''
                )}
                style={{
                  left: getKeyPosition(keys.indexOf(key)),
                  width: blackKeyWidth,
                  height: blackKeyHeight,
                }}
                onPointerDown={handlePointerDown(key.note)}
                onPointerEnter={handlePointerEnter(key.note)}
                onPointerLeave={handlePointerLeave(key.note)}
                onPointerUp={handlePointerUp(key.note)}
                data-note={key.note}
              />
            );
          })}
      </div>
      <div className="mt-2 text-center text-xs text-gray-500">
        鼠标点击或使用键盘输入 (ASDFGHJKL / WETYUOP)
      </div>
    </div>
  );
};

export default PianoKeyboard;
