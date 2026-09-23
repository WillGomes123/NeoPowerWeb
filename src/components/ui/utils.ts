import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Lê uma data "yyyy-MM-dd" (a que o seletor de período grava) como meia-noite
 * LOCAL. `new Date("2026-09-23")` é meia-noite UTC — no Brasil ainda é dia 22 —,
 * e isso fazia o calendário marcar e filtrar o dia anterior ao escolhido.
 * Strings com hora (ISO completo) seguem o parse normal.
 */
export function dataLocal(valor: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(valor);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
