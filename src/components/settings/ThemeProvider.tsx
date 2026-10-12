'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const THEMES = ['tempo', 'gather', 'meadow', 'afterglow', 'daymark'] as const;
export type Theme = (typeof THEMES)[number];

type ThemeContextValue = {
    theme: Theme;
    setTheme: (_theme: Theme) => void;
};

const THEME_STORAGE_KEY = 'event-planner-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'afterglow' ? 'dark' : 'light';
}

function isTheme(value: string | null): value is Theme {
    return THEMES.some((theme) => theme === value);
}

function readStoredTheme(): Theme | null {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(storedTheme)) return storedTheme;

    // Preserve existing Light/Dark preferences when upgrading to the five new directions.
    if (storedTheme === 'dark') return 'afterglow';
    if (storedTheme === 'light') return 'tempo';
    return null;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setCurrentTheme] = useState<Theme>('tempo');

    useEffect(() => {
        const storedTheme = readStoredTheme() ?? 'tempo';
        setCurrentTheme(storedTheme);
        applyTheme(storedTheme);
        window.localStorage.setItem(THEME_STORAGE_KEY, storedTheme);

        const syncTheme = (event: StorageEvent) => {
            if (event.key !== THEME_STORAGE_KEY) return;
            const nextTheme = readStoredTheme() ?? 'tempo';
            setCurrentTheme(nextTheme);
            applyTheme(nextTheme);
        };
        window.addEventListener('storage', syncTheme);
        return () => window.removeEventListener('storage', syncTheme);
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
