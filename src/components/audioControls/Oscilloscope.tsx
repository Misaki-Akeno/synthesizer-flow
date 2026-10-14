import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/shadcn/card';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';

interface OscilloscopeProps {
  moduleId: string;
}

const MAX_POINTS = 50;
const WIDTH = 300;
const HEIGHT = 200;
const STROKE = '#8884d8';
const GRID = 'rgba(136, 136, 136, 0.2)';

/** 固定容量的环形缓冲区，写入不分配新数组。 */
export class RingBuffer {
  private readonly values: Float64Array;
  private start = 0;
  length = 0;

  constructor(readonly capacity: number) {
    this.values = new Float64Array(capacity);
  }

  push(value: number): void {
    const index = (this.start + this.length) % this.capacity;
    this.values[index] = value;
    if (this.length < this.capacity) this.length += 1;
    else this.start = (this.start + 1) % this.capacity;
  }

  at(index: number): number {
    return this.values[(this.start + index) % this.capacity];
  }

  last(): number | undefined {
    return this.length > 0 ? this.at(this.length - 1) : undefined;
  }
}

function drawScope(
  canvas: HTMLCanvasElement,
  buffer: RingBuffer,
  pixelRatio: number
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, WIDTH, HEIGHT);

  context.strokeStyle = GRID;
  context.lineWidth = 1;
  context.setLineDash([3, 3]);
  context.beginPath();
  for (let i = 1; i < 4; i += 1) {
    const y = Math.round((HEIGHT / 4) * i) + 0.5;
    context.moveTo(0, y);
    context.lineTo(WIDTH, y);
  }
  for (let i = 1; i < 6; i += 1) {
    const x = Math.round((WIDTH / 6) * i) + 0.5;
    context.moveTo(x, 0);
    context.lineTo(x, HEIGHT);
  }
  context.stroke();
  context.setLineDash([]);

  if (buffer.length === 0) return;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < buffer.length; i += 1) {
    const value = buffer.at(i);
    if (value < min) min = value;
    if (value > max) max = value;
  }
  // 自动量程，留 10% 边距；常量信号居中显示
  const span = max - min || Math.max(Math.abs(max), 1);
  const padding = span * 0.1;
  const low = min - padding;
  const range = span + padding * 2;
  const step = WIDTH / Math.max(1, MAX_POINTS - 1);
  const offset = (MAX_POINTS - buffer.length) * step;

  context.strokeStyle = STROKE;
  context.lineWidth = 2;
  context.lineJoin = 'round';
  context.beginPath();
  for (let i = 0; i < buffer.length; i += 1) {
    const x = offset + i * step;
    const y =
      max === min
        ? HEIGHT / 2
        : HEIGHT - ((buffer.at(i) - low) / range) * HEIGHT;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
}

/**
 * 示波器直接订阅端口遥测并画到 canvas：数据进环形缓冲区，
 * 每帧最多重绘一次，离开视口时暂停绘制，全程不触发 React 渲染。
 */
const Oscilloscope: React.FC<OscilloscopeProps> = ({ moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 画布最大会被放大到 2 倍左右，按 2x 设备像素渲染避免放大后发糊
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1) * 2;
    canvas.width = WIDTH * pixelRatio;
    canvas.height = HEIGHT * pixelRatio;

    const buffer = new RingBuffer(MAX_POINTS);
    let visible = true;
    let dirty = true;
    let frame: number | undefined;

    const render = () => {
      frame = undefined;
      if (!visible || !dirty) return;
      dirty = false;
      drawScope(canvas, buffer, pixelRatio);
      const latest = buffer.last();
      if (valueRef.current) {
        valueRef.current.textContent = (latest ?? 0).toFixed(2);
      }
    };
    const schedule = () => {
      dirty = true;
      if (visible && frame === undefined) {
        frame = window.requestAnimationFrame(render);
      }
    };

    const sample = () => {
      const value =
        audioGraphRuntime.getModuleTelemetry(moduleId)?.inputValues.input;
      if (typeof value !== 'number') return;
      buffer.push(value);
      schedule();
    };
    sample();
    const unsubscribe = audioGraphRuntime.subscribeModuleTelemetry(
      moduleId,
      sample
    );

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (visible && dirty) schedule();
          });
    observer?.observe(canvas);
    schedule();

    return () => {
      unsubscribe();
      observer?.disconnect();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [moduleId]);

  return (
    <Card className="h-full w-full border-none bg-background shadow-none">
      <CardContent className="relative h-[200px] w-[300px] p-0">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ width: WIDTH, height: HEIGHT }}
          aria-label="示波器"
        />
        <div
          ref={valueRef}
          className="absolute right-2 top-2 font-mono text-xs text-muted-foreground"
        >
          0.00
        </div>
      </CardContent>
    </Card>
  );
};

export default Oscilloscope;
