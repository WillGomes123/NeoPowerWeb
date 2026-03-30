import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'neopower-theme';

const darkVars: Record<string, string> = {
  '--primary': '#39FF14',
  '--color-primary': '#39FF14',
  '--color-primary-container': '#2ff801',
  '--color-primary-dim': '#2be800',
  '--color-on-primary': '#0d6100',
  '--color-on-primary-container': '#0b5800',
  '--color-inverse-primary': '#106f00',
  '--color-primary-foreground': '#0d6100',
  '--color-secondary': '#90f9a3',
  '--color-secondary-dim': '#82ea96',
  '--color-tertiary': '#88f6ff',
  '--color-tertiary-dim': '#00deea',
  '--color-error': '#ff7351',
  '--color-error-dim': '#d53d18',
  '--color-surface': '#0e0e0e',
  '--color-surface-dim': '#0e0e0e',
  '--color-surface-bright': '#2c2c2c',
  '--color-surface-container': '#1a1919',
  '--color-surface-container-low': '#131313',
  '--color-surface-container-high': '#201f1f',
  '--color-surface-container-highest': '#262626',
  '--color-surface-container-lowest': '#000000',
  '--color-surface-variant': '#262626',
  '--color-on-surface': '#ffffff',
  '--color-on-surface-variant': '#adaaaa',
  '--color-on-background': '#ffffff',
  '--color-inverse-surface': '#fcf8f8',
  '--color-inverse-on-surface': '#565554',
  '--color-outline': '#777575',
  '--color-outline-variant': '#494847',
  '--color-background': '#0e0e0e',
  '--color-foreground': '#ffffff',
  '--color-card': '#1a1919',
  '--color-card-foreground': '#ffffff',
  '--color-popover': '#262626',
  '--color-popover-foreground': '#ffffff',
  '--color-primary-foreground': '#0d6100',
  '--color-muted': '#1a1919',
  '--color-muted-foreground': '#adaaaa',
  '--color-accent': '#262626',
  '--color-accent-foreground': '#ffffff',
  '--color-destructive': '#ff7351',
  '--color-destructive-foreground': '#ffffff',
  '--color-border': '#494847',
  '--color-input': '#494847',
  '--color-input-background': '#131313',
  '--color-switch-background': '#494847',
  '--color-chart-2': '#90f9a3',
  '--color-chart-3': '#88f6ff',
  '--color-chart-4': '#2ff801',
  '--color-chart-5': '#ff7351',
  '--color-sidebar': '#131313',
  '--color-sidebar-foreground': '#ffffff',
  '--color-sidebar-accent': '#262626',
  '--color-sidebar-accent-foreground': '#ffffff',
  '--color-sidebar-border': '#494847',
};

const lightVars: Record<string, string> = {
  '--primary': '#059669',
  '--color-primary': '#059669',
  '--color-primary-container': '#059669',
  '--color-primary-dim': '#047857',
  '--color-on-primary': '#ffffff',
  '--color-on-primary-container': '#ffffff',
  '--color-inverse-primary': '#34d399',
  '--color-primary-foreground': '#ffffff',
  '--color-secondary': '#10b981',
  '--color-secondary-dim': '#059669',
  '--color-tertiary': '#0891b2',
  '--color-tertiary-dim': '#0e7490',
  '--color-error': '#dc2626',
  '--color-error-dim': '#b91c1c',
  '--color-surface': '#f0f2f5',
  '--color-surface-dim': '#e4e6e9',
  '--color-surface-bright': '#ffffff',
  '--color-surface-container': '#ffffff',
  '--color-surface-container-low': '#f7f8fa',
  '--color-surface-container-high': '#eceef1',
  '--color-surface-container-highest': '#e2e4e8',
  '--color-surface-container-lowest': '#ffffff',
  '--color-surface-variant': '#eceef1',
  '--color-on-surface': '#111827',
  '--color-on-surface-variant': '#4b5563',
  '--color-on-background': '#111827',
  '--color-inverse-surface': '#1a1919',
  '--color-inverse-on-surface': '#ffffff',
  '--color-outline': '#9ca3af',
  '--color-outline-variant': '#d1d5db',
  '--color-background': '#f0f2f5',
  '--color-foreground': '#111827',
  '--color-card': '#ffffff',
  '--color-card-foreground': '#111827',
  '--color-popover': '#ffffff',
  '--color-popover-foreground': '#111827',
  '--color-primary-foreground': '#ffffff',
  '--color-muted': '#f3f4f6',
  '--color-muted-foreground': '#4b5563',
  '--color-accent': '#f3f4f6',
  '--color-accent-foreground': '#111827',
  '--color-destructive': '#dc2626',
  '--color-destructive-foreground': '#ffffff',
  '--color-border': '#e5e7eb',
  '--color-input': '#e5e7eb',
  '--color-input-background': '#ffffff',
  '--color-switch-background': '#d1d5db',
  '--color-chart-2': '#10b981',
  '--color-chart-3': '#06b6d4',
  '--color-chart-4': '#22c55e',
  '--color-chart-5': '#ef4444',
  '--color-sidebar': '#ffffff',
  '--color-sidebar-foreground': '#111827',
  '--color-sidebar-accent': '#f3f4f6',
  '--color-sidebar-accent-foreground': '#111827',
  '--color-sidebar-border': '#e5e7eb',
};

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

function getInitialTheme(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
  } catch { /* ignore */ }
  return true; // default: dark (original theme)
}

export function useAppTheme() {
  const [isDark, setIsDark] = useState(getInitialTheme);

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
