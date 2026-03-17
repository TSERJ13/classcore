'use client';

import { cn } from '@/lib/utils';

type PieData = {
    label: string;
    value: number;
    color: string;
};

interface PieChartProps {
    data: PieData[];
    size?: number;
    thickness?: number;
    className?: string;
    centerLabel?: React.ReactNode;
}

export function PieChart({ data, size = 160, thickness = 20, className, centerLabel }: PieChartProps) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const radius = (size - thickness) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    let currentOffset = 0;

    return (
        <div className={cn("relative flex items-center justify-center shrink-0", className)}>
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth={thickness}
                    className="text-surface border-border-subtle opacity-10"
                />

                {total > 0 ? data.map((item, i) => {
                    const percentage = (item.value / total) * 100;
                    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -currentOffset;

                    currentOffset += (percentage / 100) * circumference;

                    return (
                        <circle
                            key={i}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth={thickness}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                        />
                    );
                }) : (
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={thickness}
                        className="text-muted/10"
                    />
                )}
            </svg>

            {centerLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    {centerLabel}
                </div>
            )}
        </div>
    );
}

export function GaugeChart({ value, total, color, size = 160, thickness = 20, className, centerLabel }: { value: number, total: number, color: string, size?: number, thickness?: number, className?: string, centerLabel?: React.ReactNode }) {
    const data = [
        { label: 'Value', value: Math.min(value, total), color },
        { label: 'Remaining', value: Math.max(0, total - value), color: 'transparent' }
    ];

    return (
        <PieChart
            data={data}
            size={size}
            thickness={thickness}
            className={className}
            centerLabel={centerLabel}
        />
    );
}
