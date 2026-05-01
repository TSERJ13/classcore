import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
  animated?: boolean;
  transparent?: boolean;
  loading?: boolean;
}

export const AppLogo: React.FC<LogoProps> = React.memo(({ 
  className, 
  size = 80, // Updated default to match loader for stability
  animated = true, 
  transparent = false,
  loading = false
}) => {
  return (
    <div 
      className={cn(
        "relative flex items-center justify-center overflow-hidden shrink-0 rounded-full", 
        loading && "animate-slow-spin", 
        className
      )} 
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        minWidth: `${size}px`, 
        minHeight: `${size}px`,
        maxWidth: `${size}px`,
        maxHeight: `${size}px`
      }}
    >
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 100" 
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#6366f1', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#4f46e5', stopOpacity: 1 }} />
          </linearGradient>
          <style>{`
            @keyframes slow-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes draw-c {
              0% { stroke-dashoffset: 200; opacity: 1; }
              50% { opacity: 1; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes pulse-dot {
              0%, 100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.4)); }
              50% { transform: scale(1.3); opacity: 0.8; filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.6)); }
            }
            @keyframes float-c {
              0%, 100% { transform: translate(0, 0) rotate(0deg); }
              33% { transform: translate(3px, -3px) rotate(1deg); }
              66% { transform: translate(-2px, 2px) rotate(-1deg); }
            }
            .animate-slow-spin {
              animation: slow-spin 8s linear infinite;
            }
            .animate-c {
              stroke-dasharray: 200;
              animation: draw-c 2s ease-out forwards;
            }
            .animate-dot {
              transform-origin: center;
              animation: pulse-dot 3s ease-in-out infinite;
            }
            .float-c {
              transform-origin: center;
              animation: float-c 6s ease-in-out infinite;
            }
          `}</style>
        </defs>
        
        {/* Background Rect */}
        {!transparent && (
          <circle cx="50" cy="50" r="50" fill="url(#logo-grad)" className="shadow-lg" />
        )}
        
        <g className={cn(animated && "float-c")}>
          {/* Animated 'C' Shape */}
          <path 
            d="M70 35C70 35 60 25 50 25C30 25 25 40 25 50C25 60 30 75 50 75C60 75 70 65 70 65" 
            stroke={transparent ? "url(#logo-grad)" : "white"} 
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
            fill={transparent ? "url(#logo-grad)" : "white"} 
            className={cn(animated && "animate-dot")}
          />
        </g>
      </svg>
    </div>
  );
});

AppLogo.displayName = 'AppLogo';
