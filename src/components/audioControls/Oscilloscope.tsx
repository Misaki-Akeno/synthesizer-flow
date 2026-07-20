import React, { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/shadcn/card';
import { useRuntimeModule } from '@/core/hooks/useRuntimeModule';

interface OscilloscopeProps {
  moduleId: string;
}

interface DataPoint {
  time: number;
  value: number;
}

const MAX_POINTS = 50;

const Oscilloscope: React.FC<OscilloscopeProps> = ({ moduleId }) => {
  const snapshot = useRuntimeModule(moduleId);
  const [data, setData] = useState<DataPoint[]>([]);
  const startedAt = useRef<number | undefined>(undefined);
  const value = snapshot?.inputValues.input;

  useEffect(() => {
    if (typeof value !== 'number') return;
    const now = Date.now();
    startedAt.current ??= now;
    const point = { time: (now - startedAt.current) / 1000, value };
    setData((current) => [...current, point].slice(-MAX_POINTS));
  }, [value]);

  if (!snapshot) {
    return <div className="text-red-500">Module not found</div>;
  }

  return (
    <Card className="h-full w-full border-none bg-background shadow-none">
      <CardContent className="h-[200px] w-[300px] p-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <YAxis domain={['auto', 'auto']} hide />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8884d8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="absolute right-2 top-2 font-mono text-xs text-muted-foreground">
          {data.length > 0 ? data[data.length - 1].value.toFixed(2) : '0.00'}
        </div>
      </CardContent>
    </Card>
  );
};

export default Oscilloscope;
