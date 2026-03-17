import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
    return (
        <div
            className={cn(
                "bg-card border border-border-subtle shadow-sm transition-all duration-300",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
