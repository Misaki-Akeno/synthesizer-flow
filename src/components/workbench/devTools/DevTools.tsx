import { useState, type ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ChevronDown, Minimize } from 'lucide-react';

import NodeInspector from './NodeInspector';
import ChangeLogger from './ChangeLogger';
import ViewportLogger from './ViewportLogger';
import EdgeModuleLogger from './EdgeModuleLogger';
import SerializationTester from './SerializationTester';

interface DevToolsProps {
  inSidebar?: boolean;
}

export default function DevTools({ }: DevToolsProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">开发工具</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <Minimize className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {isOpen && (
        <Accordion 
          type="multiple" 
          defaultValue={['serialization-tester']}
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
      )}
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
