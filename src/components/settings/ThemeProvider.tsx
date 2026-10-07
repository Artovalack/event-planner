'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
    theme: Theme;
    setTheme: (_theme: Theme) => void;
};

const THEME_STORAGE_KEY = 'event-planner-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setCurrentTheme] = useState<Theme>('light');

    useEffect(() => {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'light' || storedTheme === 'dark') {
            setCurrentTheme(storedTheme);
            applyTheme(storedTheme);
        }
    }, []);

    const setTheme = (nextTheme: Theme) => {
        setCurrentTheme(nextTheme);
        applyTheme(nextTheme);
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    };

    const contextValue = useMemo(() => ({ theme, setTheme }), [theme]);
    return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
    return context;
}
