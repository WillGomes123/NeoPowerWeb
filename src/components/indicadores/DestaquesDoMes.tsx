import { useState, type ReactNode } from 'react';
import type { Destaque, GrupoDestaque, Severidade } from './destaques';

/*
 * Cards de "Destaques do mês": título, número grande e uma linha de contexto.
 * Destaques que apontam vários carregadores ganham um card largo com a lista
 * agrupada por local (local → carregadores), recolhida quando é longa.
 */

const ESTILO: Record<
  Severidade,
  { rotulo: string; texto: string; fundo: string; barra: string; chip: string }
> = {
  atencao: {
    rotulo: 'Atenção',
    texto: 'text-amber-600 dark:text-amber-400',
    fundo: 'bg-amber-500/10',
    barra: 'bg-amber-500/70',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  ok: {
    rotulo: 'Bom sinal',
    texto: 'text-emerald-600 dark:text-emerald-400',
    fundo: 'bg-emerald-500/10',
    barra: 'bg-emerald-500/70',
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  info: {
    rotulo: 'Para saber',
    texto: 'text-sky-600 dark:text-sky-400',
    fundo: 'bg-sky-500/10',
    barra: 'bg-sky-500/70',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
};

/** Quantos locais aparecem antes do "ver todos". */
const LOCAIS_VISIVEIS = 4;
/** Quantos carregadores de um mesmo local aparecem antes do "ver todos". */
const CHIPS_VISIVEIS = 6;

function Cabecalho({ d }: { d: Destaque }) {
  const e = ESTILO[d.severidade];
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden
          className={`material-symbols-outlined h-7 w-7 shrink-0 rounded-full ${e.fundo} ${e.texto} inline-flex items-center justify-center text-[17px]`}
        >
          {d.icone}
        </span>
        <h4 className="text-sm font-semibold text-on-surface leading-tight">{d.titulo}</h4>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${e.chip}`}
      >
        {e.rotulo}
      </span>
    </div>
  );
}

function Numero({ d }: { d: Destaque }) {
  if (!d.valor) return null;
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-3xl font-headline font-bold text-on-surface tabular-nums leading-none">
        {d.valor}
      </span>
      {d.unidade && <span className="text-sm text-on-surface-variant">{d.unidade}</span>}
    </div>
  );
}

function Cartao({
  d,
  className = '',
  children,
}: {
  d: Destaque;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-high/40 p-4 pl-5 print-avoid ${className}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${ESTILO[d.severidade].barra}`} />
      {children}
    </article>
  );
}

function DestaqueCurto({ d }: { d: Destaque }) {
  return (
    <Cartao d={d} className="flex flex-col">
      <Cabecalho d={d} />
      <Numero d={d} />
      <p
        title={d.contexto}
        className={`mt-1.5 text-sm text-on-surface-variant leading-snug ${d.valor ? 'line-clamp-2' : 'mt-3 line-clamp-4'}`}
      >
        {d.contexto}
      </p>
      {d.dica && <p className="mt-auto pt-2 text-xs text-on-surface-variant/80">{d.dica}</p>}
    </Cartao>
  );
}

function Grupo({
  g,
  severidade,
  aberto,
  className = '',
}: {
  g: GrupoDestaque;
  severidade: Severidade;
  aberto: boolean;
  className?: string;
}) {
  const unico = g.totalNoLocal === 1;
  const itens = aberto ? g.itens : g.itens.slice(0, CHIPS_VISIVEIS);
  const escondidos = g.itens.length - itens.length;
  return (
    <li className={`rounded-lg bg-surface-container-highest/40 px-3 py-2.5 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-on-surface truncate" title={g.local}>
          {g.local}
        </p>
        {!unico && !g.todos && (
          <span className="shrink-0 text-[11px] text-on-surface-variant tabular-nums pt-0.5">
            {g.itens.length} de {g.totalNoLocal}
          </span>
        )}
      </div>
      {g.todos ? (
        <p className={`mt-1 text-xs font-medium ${ESTILO[severidade].texto}`}>
          Todos os {g.totalNoLocal} carregadores do local
          {g.itens.some(i => i.detalhe) &&
            ` · ${g.itens
              .map(i => i.detalhe)
              .filter(Boolean)
              .join(', ')}`}
        </p>
      ) : unico ? (
        <p className="mt-1 text-xs text-on-surface-variant">
          {g.itens[0]?.detalhe ?? 'Único carregador do local'}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {itens.map(i => (
            <span
              key={i.chargePointId}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface"
              title={i.rotulo}
            >
              <span className="truncate">{i.rotulo}</span>
              {i.detalhe && <span className="shrink-0 text-on-surface-variant">{i.detalhe}</span>}
            </span>
          ))}
          {escondidos > 0 && (
            <span className="rounded-full px-2 py-0.5 text-xs text-on-surface-variant">
              +{escondidos}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function DestaqueComLista({ d }: { d: Destaque }) {
  const [aberto, setAberto] = useState(false);
  const grupos = d.grupos ?? [];
  const total = grupos.reduce((s, g) => s + g.itens.length, 0);
  const temMais =
    grupos.length > LOCAIS_VISIVEIS ||
    grupos.some(g => !g.todos && g.itens.length > CHIPS_VISIVEIS);
  return (
    <Cartao d={d} className="lg:p-5 lg:pl-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="lg:w-72 shrink-0 flex flex-col">
          <Cabecalho d={d} />
          <Numero d={d} />
          <p className="mt-1.5 text-sm text-on-surface-variant leading-snug">{d.contexto}</p>
          {d.dica && <p className="mt-2 text-xs text-on-surface-variant/80">{d.dica}</p>}
        </div>
        <div className="flex-1 min-w-0">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {grupos.map((g, i) => (
              <Grupo
                key={g.local}
                g={g}
                severidade={d.severidade}
                aberto={aberto}
                className={!aberto && i >= LOCAIS_VISIVEIS ? 'hidden print:block' : ''}
              />
            ))}
          </ul>
          {temMais && (
            <button
              type="button"
              onClick={() => setAberto(a => !a)}
              aria-expanded={aberto}
              className="no-print mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-base">
                {aberto ? 'expand_less' : 'expand_more'}
              </span>
              {aberto ? 'Mostrar menos' : `Ver todos (${total})`}
            </button>
          )}
        </div>
      </div>
    </Cartao>
  );
}

export function DestaquesDoMes({ destaques }: { destaques: Destaque[] }) {
  if (!destaques.length) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-surface-container-high/40 p-4 text-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-emerald-500">check_circle</span>
        Nada fora do normal neste período.
      </div>
    );
  }
  const curtos = destaques.filter(d => !d.grupos?.length);
  const comLista = destaques.filter(d => d.grupos?.length);
  return (
    <div className="space-y-3">
      {curtos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {curtos.map(d => (
            <DestaqueCurto key={d.id} d={d} />
          ))}
        </div>
      )}
      {comLista.map(d => (
        <DestaqueComLista key={d.id} d={d} />
      ))}
    </div>
  );
}
