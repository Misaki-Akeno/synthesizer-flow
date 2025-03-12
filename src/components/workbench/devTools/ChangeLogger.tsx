import { useEffect, useRef, useState } from 'react';
import {
  useStore,
  useStoreApi,
  type OnNodesChange,
  type NodeChange,
} from '@xyflow/react';
// import { ScrollArea } from "@/components/ui/scroll-area";

type ChangeLoggerProps = {
  color?: string;
  limit?: number;
};

type ChangeInfoProps = {
  change: NodeChange;
};

function ChangeInfo({ change }: ChangeInfoProps) {
  const id = 'id' in change ? change.id : '-';
  const { type } = change;

  return (
    <div className="border-b last:border-0 py-2">
      <div className="font-medium text-sm">
        {type} - 节点ID: {id}
      </div>
      <div className="text-xs text-muted-foreground">
        {type === 'add' ? JSON.stringify(change.item, null, 2) : null}
        {type === 'dimensions'
          ? `尺寸: ${change.dimensions?.width} × ${change.dimensions?.height}`
          : null}
        {type === 'position'
          ? `位置: ${change.position?.x.toFixed(
              1
            )}, ${change.position?.y.toFixed(1)}`
          : null}
        {type === 'remove' ? '已移除' : null}
      </div>
    </div>
  );
}

export default function ChangeLogger({ limit = 20 }: ChangeLoggerProps) {
  const [changes, setChanges] = useState<NodeChange[]>([]);
  const onNodesChangeIntercepted = useRef(false);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const store = useStoreApi();

  useEffect(() => {
    if (!onNodesChange || onNodesChangeIntercepted.current) {
      return;
    }

    onNodesChangeIntercepted.current = true;
    const userOnNodesChange = onNodesChange;

    const onNodesChangeLogger: OnNodesChange = (changes) => {
      userOnNodesChange(changes);

      setChanges((oldChanges) => [...changes, ...oldChanges].slice(0, limit));
    };

    store.setState({ onNodesChange: onNodesChangeLogger });
  }, [onNodesChange, limit, store]);

  return (
    <div className="react-flow__devtools-changelogger">
      {changes.length === 0 ? (
        <>no changes triggered</>
      ) : (
        changes.map((change, index) => (
          <ChangeInfo key={index} change={change} />
        ))
      )}
    </div>
  );
}
