import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export const BackgroundLayer: React.FC = () => {
  const { theme } = useTheme();
  const { background } = theme;

  return (
    <div className="background-layer" aria-hidden="true">
      <div
        className="background-layer__color"
        style={{ background: background.value }}
      />
    </div>
  );
};
