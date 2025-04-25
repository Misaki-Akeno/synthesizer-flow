import { type ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { PanelRight } from 'lucide-react';

import NodeInspector from './NodeInspector';
import ChangeLogger from './ChangeLogger';
import ViewportLogger from './ViewportLogger';
import EdgeModuleLogger from './EdgeModuleLogger';
import SerializationTester from './SerializationTester';

interface DevToolsProps {
  onClose: () => void;
}

export default function DevTools({ onClose }: DevToolsProps) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-2 border-b">
        <h2 className="text-sm font-medium pl-1">开发工具</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
        >
          <PanelRight size={15} />
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        <Accordion
          type="multiple"
          defaultValue={['serialization-tester', 'edge-module-logger']}
          className="w-full"
        >
          <DevToolSection id="serialization-tester" title="项目保存/加载">
            <SerializationTester />
          </DevToolSection>

          <DevToolSection id="edge-module-logger" title="边和模块信息">
            <EdgeModuleLogger />
          </DevToolSection>

          <DevToolSection id="viewport-logger" title="视口信息">
            <ViewportLogger />
          </DevToolSection>

          <DevToolSection id="node-inspector" title="节点检查器">
            <NodeInspector />
          </DevToolSection>

          <DevToolSection id="change-logger" title="变更日志">
            <ChangeLogger />
          </DevToolSection>
        </Accordion>
      </div>
    </div>
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
      <AccordionTrigger className="px-4 hover:bg-muted/50 text-xs">
        {title}
      </AccordionTrigger>
      <AccordionContent className="text-xs vscode-scrollbar">
        <div className="px-4 py-2">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}
