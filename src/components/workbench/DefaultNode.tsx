import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
 
interface DefaultNodeProps {
  data: {
    label: string;
  }
}

const DefaultNode: React.FC<DefaultNodeProps> = ({ data }) => {
  return (
    <>
      <div style={{ padding: '10px 20px' }}>
        {data.label}
      </div>
 
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  );
};
 
export default memo(DefaultNode);