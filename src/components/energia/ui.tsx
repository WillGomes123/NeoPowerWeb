import type { ReactNode } from 'react';
import { classeDoCartao } from '../painel/Pagina';

/**
 * Peças visuais do módulo Energia. Desde o redesenho de nov/2026 (Figma da
 * Lauriane, Frame 18) seguem as peças do painel: cartão branco de cantos 15 px,
 * títulos em Poppins, botões em pílula na cor da marca.
 */

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
    <section className={`${classeDoCartao} overflow-hidden`}>
      <div className="px-6 py-5 border-b border-border flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h3 className="text-[20px] leading-tight font-semibold text-foreground">{titulo}</h3>
          {detalhe && (
            <p className="text-[15px] font-medium text-muted-foreground mt-0.5">{detalhe}</p>
          )}
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
          <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/60">
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
        <tbody className="divide-y divide-border text-foreground">{children}</tbody>
      </table>
      {vazio && <p className="px-6 py-10 text-center text-[15px] text-muted-foreground">{vazio}</p>}
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
  <span className="block text-xs text-muted-foreground font-medium">{children}</span>
);

// Tons fixos de estado (mesmos da Visão geral), não a cor da marca.
const TONS = {
  ok: 'bg-estado-livre text-estado-livre-forte border-transparent',
  aviso: 'bg-estado-problema text-estado-problema-forte border-transparent',
  erro: 'bg-destructive/10 text-destructive border-transparent',
  neutro: 'bg-muted text-muted-foreground border-transparent',
};

export function Selo({ tom, children }: { tom: keyof typeof TONS; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[25px] border px-3 py-0.5 text-xs font-semibold whitespace-nowrap ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}

/** Sigla da modalidade (AUTO, CONS…), em fonte monoespaçada. */
export const Sigla = ({ children }: { children: ReactNode }) => (
  <span className="inline-block rounded-[5px] border border-border px-1.5 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
    {children}
  </span>
);

export function Medidor({ valor, alerta }: { valor: number; alerta?: boolean }) {
  return (
    <div
      className="h-2.5 min-w-[90px] rounded-[5px] bg-muted overflow-hidden"
      role="meter"
      aria-valuenow={Math.round(valor * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i
        className={`block h-full ${alerta ? 'bg-estado-problema-forte' : 'bg-primary'}`}
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
  const icone = tom === 'erro' ? 'error' : tom === 'ok' ? 'check_circle' : 'warning';
  return (
    <div
      className={`flex items-start gap-2.5 rounded-[10px] px-4 py-3 text-sm font-medium ${TONS[tom]}`}
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
    <div className={`${classeDoCartao} p-5`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-[41px] h-[38px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-xl">{icone}</span>
        </span>
        <span className="text-base leading-tight font-semibold text-muted-foreground">
          {rotulo}
        </span>
      </div>
      <p
        className={`text-[28px] leading-tight font-semibold tabular-nums ${destaque ? 'text-primary-strong' : 'text-foreground'}`}
      >
        {valor}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{detalhe}</p>
    </div>
  );
}

/** Bloco de fórmula / prévia de conta, em fonte monoespaçada. */
export const Formula = ({ children }: { children: ReactNode }) => (
  <div className="font-mono text-xs leading-relaxed bg-muted rounded-[10px] px-4 py-3 text-muted-foreground overflow-x-auto">
    {children}
  </div>
);

/** Botão em pílula do Figma: verde (marca) no principal, cinza nos outros. */
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
    className={`inline-flex items-center gap-1.5 rounded-[25px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
      pequeno ? 'px-3.5 py-1.5 text-sm' : 'px-5 py-2.5 text-[15px]'
    } ${
      primario
        ? 'bg-primary text-primary-foreground hover:brightness-105'
        : 'bg-[#d9d9d9] dark:bg-muted text-foreground hover:brightness-95'
    }`}
  >
    {children}
  </button>
);
