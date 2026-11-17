import type { ReactNode } from 'react';

/**
 * Abas dos detalhes do local, no visual das `AbasDaPagina` (faixa com a aba
 * ativa numa pílula branca, ícone e texto na cor da marca). A diferença é que
 * quebram linha: o local tem até nove abas e, rolando para o lado, metade
 * delas ficaria escondida em 1366 px.
 */
export function AbasDoLocal<T extends string>({
  abas,
  ativa,
  aoMudar,
  rotulo,
}: {
  abas: { id: T; rotulo: string; icone: ReactNode }[];
  ativa: T;
  aoMudar: (id: T) => void;
  rotulo: string;
}) {
  return (
    <nav
      aria-label={rotulo}
      className="flex flex-wrap gap-1 rounded-[25px] bg-muted/60 dark:bg-card/60 p-1"
    >
      {abas.map(a => {
        const eAtiva = a.id === ativa;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => aoMudar(a.id)}
            aria-current={eAtiva ? 'page' : undefined}
            className={`h-[52px] shrink-0 inline-flex items-center gap-2.5 rounded-[25px] px-5 text-[15px] font-semibold whitespace-nowrap transition-colors ${
              eAtiva
                ? 'bg-card text-primary-strong shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-foreground hover:bg-card/70'
            }`}
          >
            {a.icone}
            {a.rotulo}
          </button>
        );
      })}
    </nav>
  );
}
