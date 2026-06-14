import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 16, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Glow effect */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="starGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff6b5a" />
          <stop offset="50%" stopColor="#f85149" />
          <stop offset="100%" stopColor="#da3633" />
        </radialGradient>
      </defs>

      {/* Outer orbit ring */}
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="6"
        transform="rotate(-30 16 16)"
        stroke="#30363d"
        strokeWidth="0.8"
        fill="none"
        opacity="0.6"
      />

      {/* Middle orbit ring */}
      <ellipse
        cx="16"
        cy="16"
        rx="10"
        ry="4"
        transform="rotate(15 16 16)"
        stroke="#30363d"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />

      {/* Inner orbit ring */}
      <ellipse
        cx="16"
        cy="16"
        rx="7"
        ry="2.5"
        transform="rotate(-60 16 16)"
        stroke="#30363d"
        strokeWidth="0.7"
        fill="none"
        opacity="0.4"
      />

      {/* Central star - main focus */}
      <circle
        cx="16"
        cy="16"
        r="3.5"
        fill="url(#starGradient)"
        filter="url(#glow)"
      />

      {/* Planet on outer orbit */}
      <circle
        cx="6"
        cy="12"
        r="1.2"
        fill="#58a6ff"
        opacity="0.9"
      />

      {/* Small planet on middle orbit */}
      <circle
        cx="22"
        cy="18"
        r="0.8"
        fill="#3fb950"
        opacity="0.8"
      />
    </svg>
  );
};
