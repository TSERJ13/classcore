import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
  animated?: boolean;
  transparent?: boolean;
  loading?: boolean;
  radar?: boolean;
  src?: string | null;
}

export const AppLogo: React.FC<LogoProps> = React.memo(({ 
  className, 
  size = 80, 
  animated = true, 
  transparent = false,
  loading = false,
  radar = false,
  src = null
}) => {
  return (
    <div 
      className={cn(
        "relative flex items-center justify-center shrink-0", 
        className
      )} 
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        minWidth: `${size}px`, 
        minHeight: `${size}px`
      }}
    >
      {/* Radar Ring */}
      {(loading || radar) && (
        <div className="absolute inset-[-12px] rounded-full border-2 border-slate-200/50 dark:border-white/5" />
      )}
      {(loading || radar) && (
        <div 
          className="absolute inset-[-12px] rounded-full border-2 border-transparent border-t-indigo-500 animate-[radar-spin_1.5s_linear_infinite]" 
        />
      )}
      {(loading || radar) && (
        <div 
          className="absolute inset-[-12px] rounded-full border-2 border-transparent border-b-indigo-400/20 animate-[radar-spin_2s_linear_infinite_reverse]" 
        />
      )}

      {/* Main Logo Container */}
      <div className={cn(
        "relative w-full h-full rounded-full overflow-hidden flex items-center justify-center",
        !transparent && !src && "bg-gradient-to-br from-indigo-500 to-indigo-600",
        loading && "animate-pulse"
      )}>
        {src ? (
          <img 
            src={src} 
            alt="logo" 
            className="w-full h-full object-cover"
          />
        ) : (
          <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 100 100" 
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible p-[20%]"
          >
            <defs>
              <style>{`
                @keyframes radar-spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                @keyframes draw-c {
                  0% { stroke-dashoffset: 200; opacity: 1; }
                  100% { stroke-dashoffset: 0; }
                }
                @keyframes pulse-dot {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.3); opacity: 0.8; }
                }
                .animate-c {
                  stroke-dasharray: 200;
                  animation: draw-c 2s ease-out forwards;
                }
                .animate-dot {
                  transform-origin: center;
                  animation: pulse-dot 3s ease-in-out infinite;
                }
              `}</style>
            </defs>
            
            <g>
              {/* Animated 'C' Shape */}
              <path 
                d="M70 35C70 35 60 25 50 25C30 25 25 40 25 50C25 60 30 75 50 75C60 75 70 65 70 65" 
                stroke={transparent ? "#6366f1" : "white"} 
                strokeWidth="12" 
                strokeLinecap="round" 
                fill="none"
                className={cn(animated && "animate-c")}
              />
              
              {/* Animated Dot */}
              <circle 
                cx="50" 
                cy="50" 
                r="8" 
                fill={transparent ? "#6366f1" : "white"} 
                className={cn(animated && "animate-dot")}
              />
            </g>
          </svg>
        )}
      </div>
    </div>
  );
});

AppLogo.displayName = 'AppLogo';
