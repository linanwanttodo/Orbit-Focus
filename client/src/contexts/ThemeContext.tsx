import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface BackgroundState {
  type: 'color';
  value: string;
}

export interface ThemeState {
  mode: ThemeMode;
  background: BackgroundState;
}

interface ThemeContextType {
  theme: ThemeState;
  setThemeMode: (mode: ThemeMode) => void;
}

// 背景色由模式派生，与 index.css 色板对齐（深空蓝黑 / 浅灰蓝）
// 注意：dark 用 #0b0b0d 而非纯黑，避免和边框形成刺眼硬线对比
const DEFAULT_BACKGROUNDS: Record<ThemeMode, BackgroundState> = {
  dark: { type: 'color', value: '#0b0b0d' },
  light: { type: 'color', value: '#f4f6fb' },
};

function themeForMode(mode: ThemeMode): ThemeState {
  return { mode, background: DEFAULT_BACKGROUNDS[mode] };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeState>(() => {
    try {
      const saved = localStorage.getItem('orbit-focus-theme');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ThemeState>;
        if (parsed.mode === 'dark' || parsed.mode === 'light') {
          return themeForMode(parsed.mode);
        }
      }
    } catch { /* ignore */ }
    return themeForMode('dark');
  });

  useEffect(() => {
    localStorage.setItem('orbit-focus-theme', JSON.stringify(theme));
    document.documentElement.setAttribute('data-theme', theme.mode);
  }, [theme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setTheme(themeForMode(mode));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
