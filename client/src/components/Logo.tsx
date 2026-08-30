import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

// 品牌 Logo：手绘番茄插画（透明底 PNG）
export const Logo: React.FC<LogoProps> = ({ size = 16, className = '' }) => {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="Orbit Focus"
      className={className}
      draggable={false}
    />
  );
};
