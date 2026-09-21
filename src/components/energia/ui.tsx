import type { ReactNode } from 'react';

/** Peças visuais do módulo Energia, no mesmo vocabulário das outras páginas do painel. */

export function Painel({
  titulo,
  detalhe,
  acao,
  children,
}: {
  titulo: string;
  detalhe?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h3 className="text-lg font-headline font-bold text-on-surface">{titulo}</h3>
          {detalhe && <p className="text-xs text-on-surface-variant mt-0.5">{detalhe}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function Tabela({
  cabecalho,
  children,
  vazio,
  denso,
}: {
  cabecalho: (string | { t: string; n?: boolean })[];
  children: ReactNode;
  vazio?: string;
  /** Fonte menor, para tabela com muitas colunas de valor (a apuração). */
  denso?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left border-collapse ${denso ? 'text-[13px]' : 'text-sm'}`}>
        <thead>
          <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
            {cabecalho.map((c, i) => {
              const t = typeof c === 'string' ? c : c.t;
              const n = typeof c === 'string' ? false : c.n;
              return (
                <th key={i} className={`px-3 py-3 whitespace-nowrap ${n ? 'text-right' : ''}`}>
                  {t}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/5 text-on-surface">{children}</tbody>
      </table>
      {vazio && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">{vazio}</p>}
    </div>
  );
}

export const Td = ({
  children,
  n,
  className = '',
}: {
  children: ReactNode;
  n?: boolean;
  className?: string;
}) => (
  <td
    className={`px-3 py-3 align-middle tabular-nums ${n ? 'text-right whitespace-nowrap' : ''} ${className}`}
  >
    {children}
  </td>
);

/** Linha secundária dentro de uma célula (grupo, distribuidora…). */
export const Sub = ({ children }: { children: ReactNode }) => (
  <span className="block text-[11px] text-on-surface-variant font-medium">{children}</span>
);

const TONS = {
  ok: 'bg-primary/10 text-primary border-primary/20',
  aviso: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  erro: 'bg-error/10 text-error border-error/20',
  neutro: 'bg-surface-container-highest text-on-surface-variant border-outline-variant/20',
};

export function Selo({ tom, children }: { tom: keyof typeof TONS; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}

/** Sigla da modalidade (AUTO, CONS…), em fonte monoespaçada. */
export const Sigla = ({ children }: { children: ReactNode }) => (
  <span className="inline-block rounded border border-outline-variant/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-on-surface-variant">
    {children}
  </span>
);

export function Medidor({ valor, alerta }: { valor: number; alerta?: boolean }) {
  return (
    <div
      className="h-2 min-w-[90px] rounded bg-surface-container-highest overflow-hidden"
      role="meter"
      aria-valuenow={Math.round(valor * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i
        className={`block h-full ${alerta ? 'bg-amber-500' : 'bg-primary'}`}
        style={{ width: `${Math.min(100, valor * 100)}%` }}
      />
    </div>
  );
}

export function Aviso({
  tom,
  children,
  acao,
}: {
  tom: 'aviso' | 'erro' | 'ok';
  children: ReactNode;
  acao?: ReactNode;
}) {
  const cls =
    tom === 'erro'
      ? 'bg-error/10 text-error border-error/20'
      : tom === 'ok'
        ? 'bg-primary/10 text-primary border-primary/20'
        : 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  const icone = tom === 'erro' ? 'error' : tom === 'ok' ? 'check_circle' : 'warning';
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium ${cls}`}
    >
      <span className="material-symbols-outlined text-lg shrink-0">{icone}</span>
      <span className="flex-1">{children}</span>
      {acao}
    </div>
  );
}

export function KPI({
  icone,
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  icone: string;
  rotulo: string;
  valor: string;
  detalhe: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`p-5 rounded-xl border relative overflow-hidden ${destaque ? 'bg-surface-container-highest border-primary/20' : 'glass-card border-outline-variant/10'}`}
    >
      {destaque && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      )}
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-xl text-primary">{icone}</span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
            {rotulo}
          </span>
        </div>
        <p className="text-2xl font-headline font-bold text-on-surface tabular-nums">{valor}</p>
        <p className="text-[11px] text-on-surface-variant mt-1">{detalhe}</p>
      </div>
    </div>
  );
}

/** Bloco de fórmula / prévia de conta, em fonte monoespaçada. */
export const Formula = ({ children }: { children: ReactNode }) => (
  <div className="font-mono text-xs leading-relaxed bg-surface-container rounded-lg px-4 py-3 text-on-surface-variant overflow-x-auto">
    {children}
  </div>
);

export const Botao = ({
  children,
  onClick,
  primario,
  pequeno,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  primario?: boolean;
  pequeno?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1.5 rounded-lg font-bold font-headline transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      pequeno ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'
    } ${primario ? 'bg-primary text-on-primary hover:bg-primary/90' : 'bg-surface-container-low border border-outline-variant/20 text-on-surface-variant hover:text-primary'}`}
  >
    {children}
  </button>
);
