/**
 * Tiny client-only theme provider (replaces next-themes, whose inline <script> React 19 warns
 * about in an SPA). Theme is 'light' | 'dark' | 'system', stored in localStorage; the resolved
 * theme is applied as the `dark` class on <html> so portalled sheets/popovers theme correctly.
 * Outside a provider (public site) `useTheme()` returns the inert default.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme | undefined;
  resolvedTheme: 'light' | 'dark' | undefined;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: undefined, resolvedTheme: undefined, setTheme: () => {} });

const MEDIA = '(prefers-color-scheme: dark)';

function readStored(key: string, fallback: Theme): Theme {
  try {
    const v = localStorage.getItem(key);
    return v === 'light' || v === 'dark' || v === 'system' ? v : fallback;
  } catch {
    return fallback;
  }
}

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia?.(MEDIA).matches === true;
}

export function ThemeProvider({
  children,
  storageKey = 'theme',
  defaultTheme = 'system',
}: {
  children: ReactNode;
  storageKey?: string;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(() => readStored(storageKey, defaultTheme));
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.(MEDIA);
    if (!mq) return;
    const onChange = () => setSysDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (sysDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* storage unavailable: keep in memory */
      }
    },
    [storageKey],
  );

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
