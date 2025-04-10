/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode, useRef, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ChevronDown, Minimize } from 'lucide-react';
import Draggable from 'react-draggable';

import NodeInspector from './NodeInspector';
import ChangeLogger from './ChangeLogger';
import ViewportLogger from './ViewportLogger';
import EdgeModuleLogger from './EdgeModuleLogger';

export default function DevTools() {
  const [isOpen, setIsOpen] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 100 }); // 初始位置将被useEffect更新
  const [isPositioned, setIsPositioned] = useState(false); // 添加位置计算完成状态
  const nodeRef = useRef<HTMLDivElement>(
    null
  ) as React.RefObject<HTMLDivElement>;

  // 计算右上角位置
  useEffect(() => {
    const updatePosition = () => {
      const rightPosition = window.innerWidth - 340; // 320px宽度 + 20px边距
      setPosition({ x: rightPosition, y: 20 });
      setIsPositioned(true); // 标记位置已计算完成
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  const handleDrag = (_e: any, data: { x: number; y: number }) => {
    setPosition({ x: data.x, y: data.y });
  };

  // 如果位置未计算完成，则不渲染组件
  if (!isPositioned) return null;

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".handle"
      position={position}
      onDrag={handleDrag}
      bounds="parent"
    >
      <div
        ref={nodeRef}
        style={{
          position: 'absolute',
          zIndex: 1000,
          transition: 'width 0.3s, height 0.3s',
        }}
        className={`w-[320px] bg-background border rounded-lg shadow-lg`}
      >
        {/* 窗口标题栏 */}
        <div className="handle p-2 bg-primary text-primary-foreground rounded-t-lg flex items-center justify-between cursor-move">
          {<h2 className="text-lg font-bold ml-1">开发工具</h2>}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              {isOpen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* 内容区域 */}
        {isOpen && (
          <div className="overflow-y-auto max-h-[80vh]">
            <Accordion type="multiple" defaultValue={['edge-module-logger']}>
              <DevToolSection id="edge-module-logger" title="边和模块信息">
                <div className="px-4 py-2">
                  <EdgeModuleLogger />
                </div>
              </DevToolSection>

              <DevToolSection id="viewport-logger" title="视口信息">
                <div className="px-4 py-2">
                  <ViewportLogger />
                </div>
              </DevToolSection>

              <DevToolSection id="node-inspector" title="节点检查器">
                <div className="px-4 py-2">
                  <NodeInspector />
                </div>
              </DevToolSection>

              <DevToolSection id="change-logger" title="变更日志">
                <div className="px-4 py-2">
                  <ChangeLogger />
                </div>
              </DevToolSection>
            </Accordion>
          </div>
        )}
      </div>
    </Draggable>
  );
}

function DevToolSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={id}>
      <AccordionTrigger className="px-4 hover:bg-muted/50">
        {title}
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}
