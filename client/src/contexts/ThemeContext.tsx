import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark';
export type ThemeColorKey = 'emerald' | 'indigo' | 'rose' | 'blue' | 'amber';

export interface ThemeColor {
    base: string;
    hover: string;
    soft: string;
    shadow: string;
}

export const THEME_COLORS: Record<ThemeColorKey, ThemeColor> = {
    emerald: { base: '#10b981', hover: '#059669', soft: 'rgba(16, 185, 129, 0.1)', shadow: 'rgba(16, 185, 129, 0.2)' },
    indigo: { base: '#6366f1', hover: '#4f46e5', soft: 'rgba(99, 102, 241, 0.1)', shadow: 'rgba(99, 102, 241, 0.2)' },
    rose: { base: '#f43f5e', hover: '#e11d48', soft: 'rgba(244, 63, 94, 0.1)', shadow: 'rgba(244, 63, 94, 0.2)' },
    blue: { base: '#3b82f6', hover: '#2563eb', soft: 'rgba(59, 130, 246, 0.1)', shadow: 'rgba(59, 130, 246, 0.2)' },
    amber: { base: '#f59e0b', hover: '#d97706', soft: 'rgba(245, 158, 11, 0.1)', shadow: 'rgba(245, 158, 11, 0.2)' },
};

interface ThemeContextType {
    theme: ThemeMode;
    toggleTheme: () => void;
    themeColor: ThemeColorKey;
    setThemeColor: (color: ThemeColorKey) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem('checkin_theme');
        return (saved as ThemeMode) || 'dark';
    });

    const themeColor = 'emerald';

    useEffect(() => {
        localStorage.setItem('checkin_theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    useEffect(() => {
        const color = THEME_COLORS['emerald'];
        const root = document.documentElement;
        root.style.setProperty('--brand-color', color.base);
        root.style.setProperty('--brand-color-hover', color.hover);
        root.style.setProperty('--brand-color-soft', color.soft);
        root.style.setProperty('--brand-color-shadow', color.shadow);
    }, []);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const setThemeColor = (color: ThemeColorKey) => {
        console.warn('Theme switching is disabled');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, themeColor, setThemeColor }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
