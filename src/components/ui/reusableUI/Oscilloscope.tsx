import React, { useEffect, useState, useRef } from 'react';
import {
    LineChart,
    Line,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
} from 'recharts';
import { useFlowStore } from '@/store/store';
import { OscilloscopeModule } from '@/core/modules/logic/OscilloscopeModule';
import { Card, CardContent } from '@/components/ui/shadcn/card';

interface OscilloscopeProps {
    moduleId: string;
}

const MAX_POINTS = 50;
const REFRESH_RATE = 30; // ms

interface DataPoint {
    time: number;
    value: number;
}

const Oscilloscope: React.FC<OscilloscopeProps> = ({ moduleId }) => {
    const [data, setData] = useState<DataPoint[]>([]);
    const moduleInstance = useFlowStore((state) =>
        state.nodes.find((n) => n.id === moduleId)?.data?.module
    ) as OscilloscopeModule | undefined;

    const dataRef = useRef<DataPoint[]>([]);
    const startTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        if (!moduleInstance) return;

        const inputSubject = moduleInstance.inputPorts['input'];
        if (!inputSubject) return;

        const subscription = inputSubject.subscribe((value) => {
            if (typeof value === 'number') {
                const now = Date.now();
                const time = (now - startTimeRef.current) / 1000; // seconds

                const newPoint = { time, value };

                // Log for debugging
                // console.log('Oscilloscope Value:', value);

                // Update ref directly for performance (though React state update is needed for re-render)
                // We'll buffer updates slightly or just rely on React's batching if poss, 
                // but for smooth animation we might need requestAnimationFrame or throttled updates.
                // For now, let's just push to ref and update state periodically?
                // Actually, direct state update for every sample might be too much if high freq.
                // But since this is likely driven by JS timer/LFO loop, it might be manageable.

                // Let's use a simple approach first: Append and slice.
                dataRef.current = [...dataRef.current, newPoint].slice(-MAX_POINTS);
            }
        });

        // Use an interval to update the UI to avoid re-rendering on every single value change if it's too fast
        const interval = setInterval(() => {
            setData([...dataRef.current]);
        }, REFRESH_RATE);

        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [moduleInstance]);

    if (!moduleInstance) {
        return <div className="text-red-500">Module not found</div>;
    }

    return (
        <Card className="w-full h-full bg-background border-none shadow-none">
            <CardContent className="p-0 h-[200px] w-[300px]">
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
                            isAnimationActive={false} // Disable animation for real-time updates
                        />
                    </LineChart>
                </ResponsiveContainer>
                <div className="absolute top-2 right-2 font-mono text-xs text-muted-foreground">
                    {data.length > 0 ? data[data.length - 1].value.toFixed(2) : '0.00'}
                </div>
            </CardContent>
        </Card>
    );
};

export default Oscilloscope;
