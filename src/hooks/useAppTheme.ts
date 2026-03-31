import { useState, useEffect, useCallback } from 'react';
import { lightVars } from '../lib/theme-constants';


const STORAGE_KEY = 'neopower-theme';

// Vars are now imported from theme-constants.ts


const STYLE_ID = 'neopower-theme-overrides';

function applyTheme(isDark: boolean) {
  // Toggle class for glass-panel / glass-card
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Remove existing override style
  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

  if (isDark) {
    // Dark is the default in @theme inline — remove any override
    if (styleEl) styleEl.remove();
    return;
  }

  // Light mode: inject a <style> with :root overrides that beat @theme
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const vars = lightVars;
  const rules = Object.entries(vars)
    .map(([key, value]) => `${key}: ${value} !important;`)
    .join('\n    ');

  styleEl.textContent = `:root {\n    ${rules}\n  }`;
}

function getInitialTheme(brandingTheme?: 'dark' | 'light'): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
  } catch { /* ignore */ }

  // Fallback to branding theme if no saved preference
  if (brandingTheme === 'light') return false;
  return true; // default: dark
}

export function useAppTheme(brandingTheme?: 'dark' | 'light') {
  const [isDark, setIsDark] = useState(() => getInitialTheme(brandingTheme));

  // Update theme if branding theme changes and no saved preference
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY) && brandingTheme) {
      setIsDark(brandingTheme === 'dark');
    }
  }, [brandingTheme]);

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  // Apply on mount (before first render paint)
  useEffect(() => {
    applyTheme(isDark);
  }, []);

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { isDark, toggle };
}
