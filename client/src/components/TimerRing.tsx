import React from 'react';
import { TimerMode } from '../types';
import { RING_COLORS } from '../constants';

interface TimerRingProps {
  radius: number;
  stroke: number;
  progress: number; // 0 to 100
  mode: TimerMode;
  customColor?: string; // Optional override for specific design requirements
}

export const TimerRing: React.FC<TimerRingProps> = ({ radius, stroke, progress, mode, customColor }) => {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determine the color class: use customColor if provided, otherwise fallback to mode color
  const colorClass = customColor || RING_COLORS[mode];

  return (
    <div className="relative flex items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="rotate-[-90deg] transition-all duration-500 ease-in-out"
      >
        {/* Background Ring */}
        <circle
          className="stroke-dark-700"
          strokeWidth={stroke}
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress Ring */}
        <circle
          className={`${colorClass} transition-all duration-1000 ease-linear`}
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      {/* Glow Effect behind the ring */}
      <div
        className={`absolute inset-0 rounded-full blur-[60px] opacity-20 pointer-events-none
          ${customColor ? customColor.replace('stroke-', 'bg-').replace('text-', 'bg-') : (mode === TimerMode.WORK ? 'bg-rose-600' : mode === TimerMode.SHORT_BREAK ? 'bg-brand' : 'bg-cyan-600')}
        `}
      />
    </div>
  );
};