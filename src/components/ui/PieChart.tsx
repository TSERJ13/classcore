'use client';

import { useState } from 'react';
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
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const radius = Math.max(0, (size - thickness) / 2);
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    let currentOffset = 0;

    return (
        <div
            className={cn("relative flex items-center justify-center shrink-0", className)}
            style={{ width: size, height: size }}
        >
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className="w-full h-full transform -rotate-90"
                preserveAspectRatio="xMidYMid meet"
            >
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
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            className={cn(
                                "transition-all duration-500 ease-out cursor-pointer",
                                hoveredIndex !== null && hoveredIndex !== i ? "opacity-20 blur-[1px]" : "opacity-100"
                            )}
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

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                {hoveredIndex !== null ? (
                    <div className="animate-in fade-in zoom-in duration-200">
                        <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">{data[hoveredIndex].label}</p>
                        <p className="text-sm font-black text-primary tabular-nums">{Math.round(data[hoveredIndex].value).toLocaleString()}</p>
                    </div>
                ) : (
                    centerLabel
                )}
            </div>
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
