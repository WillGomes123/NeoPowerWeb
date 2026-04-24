import { useState, useEffect, useCallback } from 'react';
import { lightVars, darkVars } from '../lib/theme-constants';


const STORAGE_KEY = 'neopower-theme';

// Vars are now imported from theme-constants.ts


const STYLE_ID = 'neopower-theme-overrides';

function applyTheme(isDark: boolean, branding?: any) {
  // Toggle class for basic tailwind compatibility
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Determine base variables
  const baseVars = isDark ? darkVars : lightVars;

  // Determine primary color based on current theme
  const defaultPrimary = !isDark ? '#059669' : '#39FF14';
  let activePrimary = branding?.primaryColor || defaultPrimary;
  
  if (isDark && branding?.primaryColorDark) {
    activePrimary = branding.primaryColorDark;
  } else if (!isDark && branding?.primaryColorLight) {
    activePrimary = branding.primaryColorLight;
  }

  // Prepare primary-related derivations (matching auth.tsx logic)
  const hex = activePrimary.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  
  // Contrast color for text on primary
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const onPrimary = luminance > 0.5 ? '#000000' : '#ffffff';

  // Calculate a "container" color for gradients
  // Se a cor principal for muito escura, o container precisa ser ligeiramente mais claro para dar o efeito de gradiente
  const isDarkColor = luminance < 0.25;
  const factor = isDarkColor ? 1.4 : 0.7; // Clarear se for escuro, escurecer se for claro
  const dimR = Math.min(255, Math.max(0, Math.floor(r * factor)));
  const dimG = Math.min(255, Math.max(0, Math.floor(g * factor)));
  const dimB = Math.min(255, Math.max(0, Math.floor(b * factor)));
  const containerHex = `#${dimR.toString(16).padStart(2,'0')}${dimG.toString(16).padStart(2,'0')}${dimB.toString(16).padStart(2,'0')}`;

  // Branding variables
  const brandingVars: Record<string, string> = {
    '--primary': activePrimary,
    '--primary-rgb': `${r}, ${g}, ${b}`,
    '--ring': activePrimary,
    '--sidebar-primary': activePrimary,
    '--sidebar-ring': activePrimary,
    '--color-primary': activePrimary,
    '--color-primary-dim': containerHex,
    '--color-primary-container': activePrimary,
    '--color-on-primary': onPrimary,
    '--color-primary-foreground': onPrimary,
    '--color-sidebar-primary-foreground': onPrimary,
  };

  // Merge all
  const allRules = { ...baseVars, ...brandingVars };

  console.log('[useAppTheme] applyTheme isDark:', isDark, 'branding:', branding?.theme, branding?.primaryColor);
  console.log('[useAppTheme] First 5 rules applied:', Object.entries(allRules).slice(0, 5));

  // Apply to DOM
  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const cssContent = Object.entries(allRules)
    .map(([key, value]) => {
      const dynKey = key.startsWith('--color-') 
        ? `--dyn-${key.substring(2)}` 
        : `--dyn${key}`; 
      return `${key}: ${value};\n    ${dynKey}: ${value};`;
    })
    .join('\n    ');

  styleEl.textContent = `:root {\n    ${cssContent}\n  }`;
}

function getInitialTheme(brandingTheme?: 'dark' | 'light'): boolean {
  // 1. O Tema definido pelo dono do Branding (Whitelabel) é prioridade absoluta.
  if (brandingTheme === 'light') return false;
  if (brandingTheme === 'dark') return true;

  // 2. Se a marcação for genérica, fallback para o cache local do admin 
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
  } catch { /* ignore */ }

  // 3. Padrão Absoluto
  return true; 
}

export function useAppTheme(branding?: any) {
  const [isDark, setIsDark] = useState(() => getInitialTheme(branding?.theme));

  // Força atualização se o admin mudar ou logar e vier uma informação nova
  useEffect(() => {
    if (branding?.theme) {
      setIsDark(branding.theme === 'dark');
      try {
        localStorage.setItem(STORAGE_KEY, branding.theme);
      } catch { /* ignore */ }
    }
  }, [branding?.theme]);

  // Unified effect to apply both mode and branding
  useEffect(() => {
    applyTheme(isDark, branding);
  }, [isDark, branding]);

  // Apply on mount
  useEffect(() => {
    applyTheme(isDark, branding);
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
