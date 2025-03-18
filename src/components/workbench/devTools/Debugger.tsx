import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';
import * as Tone from 'tone';

export default function Debugger() {
  const [isPlaying, setIsPlaying] = useState(false);
  const oscillatorRef = useRef<Tone.Oscillator | null>(null);

  useEffect(() => {
    // 清理函数，组件卸载时停止振荡器
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.dispose();
      }
    };
  }, []);

  const startOscillator = async () => {
    // 确保音频上下文已经启动
    if (Tone.Transport.state !== "started") {
      await Tone.start();
    }

    // 创建并配置振荡器
    const oscillator = new Tone.Oscillator({
      frequency: 440, // A4音符
      type: "sine",
      volume: -10
    }).toDestination();

    // 启动振荡器
    oscillator.start();
    oscillatorRef.current = oscillator;
    setIsPlaying(true);
  };

  const stopOscillator = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.dispose();
      oscillatorRef.current = null;
      setIsPlaying(false);
    }
  };

  const toggleOscillator = async () => {
    if (isPlaying) {
      stopOscillator();
    } else {
      await startOscillator();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <div className="text-sm font-medium">音频测试</div>
        <div className="text-xs text-muted-foreground mb-2">
          点击按钮启动/停止Tone.js振荡器(440Hz)
        </div>
        
        <Button 
          onClick={toggleOscillator}
          variant={isPlaying ? "destructive" : "default"}
          className="flex items-center gap-2"
        >
          {isPlaying ? (
            <>
              <Square className="h-4 w-4" /> 停止振荡器
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> 启动振荡器
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
