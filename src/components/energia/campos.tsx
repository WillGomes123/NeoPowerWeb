import type { ReactNode } from 'react';

/** Campos de formulário do módulo, com o mesmo estilo dos diálogos do painel. */

const base =
  'w-full h-10 rounded-md border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40';

export function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-on-surface-variant text-[11px] uppercase tracking-widest font-bold">
        {rotulo}
      </span>
      {children}
      {dica && <span className="text-[11px] text-on-surface-variant">{dica}</span>}
    </label>
  );
}

export function Texto({
  valor,
  onChange,
  placeholder,
  max,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
}) {
  return (
    <input
      className={base}
      value={valor}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={max}
    />
  );
}

export function Numero({
  valor,
  onChange,
  min = 0,
  step = 1,
}: {
  valor: number | '';
  onChange: (v: number | '') => void;
  min?: number;
  step?: number;
}) {
  return (
    <input
      className={`${base} tabular-nums`}
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      value={valor}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  );
}

export function Escolha<T extends string>({
  valor,
  onChange,
  opcoes,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: { v: T; t: string }[];
}) {
  return (
    <select className={base} value={valor} onChange={e => onChange(e.target.value as T)}>
      {opcoes.map(o => (
        <option key={o.v} value={o.v}>
          {o.t}
        </option>
      ))}
    </select>
  );
}

export function Marcar({
  marcado,
  onChange,
  children,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={marcado}
        onChange={e => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
