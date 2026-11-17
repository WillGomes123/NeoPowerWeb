import { useEffect, useMemo, useState } from 'react';
import { classeDoBotaoContorno } from '../painel/Pecas';

/**
 * Linhas por página nas tabelas do Relatório Financeiro.
 *
 * O relatório de uma marca em "todo o período" traz milhares de recargas (a
 * NeoPower passa de 4 mil, 5,7 MB). Desenhar todas de uma vez punha 60 mil
 * elementos na página, e cada medida de texto dos gráficos recalculava o
 * layout da página inteira: a tela ficava travada por quase um minuto até a
 * tabela aparecer. As exportações (CSV, Excel, PDF) continuam com tudo.
 */
export const LINHAS_POR_PAGINA = 50;

/**
 * Recorta a lista na página atual. Lista nova (outro período, outro local,
 * outro filtro) volta para a primeira página.
 */
export function usePagina<T>(lista: readonly T[], porPagina = LINHAS_POR_PAGINA) {
  const [pagina, setPagina] = useState(1);
  useEffect(() => {
    setPagina(1);
  }, [lista]);
  const total = Math.max(1, Math.ceil(lista.length / porPagina));
  const atual = Math.min(pagina, total);
  const itens = useMemo(
    () => lista.slice((atual - 1) * porPagina, atual * porPagina),
    [lista, atual, porPagina]
  );
  return { pagina: atual, total, itens, irPara: setPagina };
}

/** Rodapé "Página 2 de 81 (4.012 recargas)" com Anterior e Próxima. */
export function Paginacao({
  pagina,
  total,
  quantidade,
  rotulo,
  aoMudar,
}: {
  pagina: number;
  total: number;
  quantidade: number;
  /** O que a tabela lista, no plural: "recargas", "notas". */
  rotulo: string;
  aoMudar: (pagina: number) => void;
}) {
  if (total <= 1) return null;
  return (
    <nav
      aria-label={`Páginas de ${rotulo}`}
      className="px-6 py-4 border-t border-border flex flex-wrap gap-3 justify-between items-center"
    >
      <p className="text-sm text-muted-foreground">
        Página <span className="font-semibold text-foreground">{pagina}</span> de{' '}
        <span className="font-semibold text-foreground">{total}</span>
        <span className="ml-2">
          ({quantidade.toLocaleString('pt-BR')} {rotulo})
        </span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => aoMudar(Math.max(1, pagina - 1))}
          disabled={pagina <= 1}
          className={`${classeDoBotaoContorno} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            chevron_left
          </span>
          Anterior
        </button>
        <button
          type="button"
          onClick={() => aoMudar(Math.min(total, pagina + 1))}
          disabled={pagina >= total}
          className={`${classeDoBotaoContorno} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Próxima
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            chevron_right
          </span>
        </button>
      </div>
    </nav>
  );
}
