import React, { useRef, useState, useEffect } from 'react';
import { ModuleBase } from '@/core/ModuleBase';

interface XYPadProps {
  // 模块实例
  module?: ModuleBase;
  // 模块参数值
  paramValues: Record<string, number | boolean | string>;
  // 参数更新回调
  onParamChange: (paramKey: string, value: number | boolean | string) => void;
  // X轴参数配置
  xParam: {
    paramKey: string;
    label?: string;
    min: number;
    max: number;
  };
  // Y轴参数配置
  yParam: {
    paramKey: string;
    label?: string;
    min: number;
    max: number;
  };
  // 自定义尺寸
  width?: number;
  height?: number;
  // 默认PAD的背景颜色
  backgroundColor?: string;
}

/**
 * XYPad组件，用于同时控制两个参数
 */
const XYPad: React.FC<XYPadProps> = ({
  paramValues,
  onParamChange,
  xParam,
  yParam,
  width = 180,
  height = 120,
  backgroundColor = 'rgb(241, 245, 249)',
}) => {
  const padRef = useRef<HTMLDivElement>(null);

  // 获取当前X和Y参数的值
  const xValue =
    typeof paramValues[xParam.paramKey] === 'number'
      ? (paramValues[xParam.paramKey] as number)
      : xParam.min;

  const yValue =
    typeof paramValues[yParam.paramKey] === 'number'
      ? (paramValues[yParam.paramKey] as number)
      : yParam.min;

  // 当前点的位置
  const [position, setPosition] = useState({
    x: normalizeValue(xValue, xParam.min, xParam.max, width),
    y: normalizeValue(yValue, yParam.min, yParam.max, height, true),
  });

  // 是否正在拖动
  const [isDragging, setIsDragging] = useState(false);

  // 将值从实际范围归一化到像素位置
  function normalizeValue(
    value: number,
    min: number,
    max: number,
    dimension: number,
    invert = false
  ): number {
    const normalized = ((value - min) / (max - min)) * dimension;
    return invert ? dimension - normalized : normalized;
  }

  // 将像素位置转换回实际值
  function denormalizeValue(
    pos: number,
    min: number,
    max: number,
    dimension: number,
    invert = false
  ): number {
    const normalized = invert ? dimension - pos : pos;
    return min + (normalized / dimension) * (max - min);
  }

  // 更新位置和触发值更改
  const updatePosition = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!padRef.current) return;

      const rect = padRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(width, clientX - rect.left));
      const y = Math.max(0, Math.min(height, clientY - rect.top));

      setPosition({ x, y });

      // 更新参数值
      const newXValue = denormalizeValue(x, xParam.min, xParam.max, width);
      const newYValue = denormalizeValue(
        y,
        yParam.min,
        yParam.max,
        height,
        true
      );

      onParamChange(xParam.paramKey, newXValue);
      onParamChange(yParam.paramKey, newYValue);
    },
    [padRef, width, height, xParam, yParam, onParamChange]
  );

  // 处理鼠标/触摸事件
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updatePosition(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    updatePosition(touch.clientX, touch.clientY);
  };

  // 使用 useEffect 的依赖中加入 updatePosition 会导致循环依赖
  // 使用 useCallback 避免依赖问题
  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        updatePosition(e.clientX, e.clientY);
      }
    },
    [isDragging, updatePosition]
  );

  const handleTouchMove = React.useCallback(
    (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        e.preventDefault();
        const touch = e.touches[0];
        updatePosition(touch.clientX, touch.clientY);
      }
    },
    [isDragging, updatePosition]
  );

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    // 添加事件监听
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    // 清理事件监听
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleMouseUp]);

  // 当参数值外部更改时，更新点的位置
  useEffect(() => {
    setPosition({
      x: normalizeValue(xValue, xParam.min, xParam.max, width),
      y: normalizeValue(yValue, yParam.min, yParam.max, height, true),
    });
  }, [
    xValue,
    yValue,
    xParam.min,
    xParam.max,
    yParam.min,
    yParam.max,
    width,
    height,
  ]);

  return (
    <div className="xypad-container my-2">
      <div className="xypad-labels flex justify-between text-xs mb-1">
        <div>{xParam.label || xParam.paramKey}</div>
        <div>{yParam.label || yParam.paramKey}</div>
      </div>
      <div
        ref={padRef}
        className="xypad relative rounded-md cursor-pointer"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: backgroundColor,
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* 十字线 */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute bg-gray-400/40 h-px w-full"
            style={{ top: position.y }}
          />
          <div
            className="absolute bg-gray-400/40 w-px h-full"
            style={{ left: position.x }}
          />
        </div>

        {/* 控制点 */}
        <div
          className="absolute w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: position.x,
            top: position.y,
          }}
        />
      </div>
      <div className="xypad-values flex justify-between text-xs mt-1 text-gray-500">
        <div>{xValue.toFixed(2)}</div>
        <div>{yValue.toFixed(2)}</div>
      </div>
    </div>
  );
};

export default XYPad;
