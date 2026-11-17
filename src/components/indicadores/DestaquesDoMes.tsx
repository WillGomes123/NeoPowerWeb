import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { IconeSvg } from '../painel/Icone';
import iconeRaio from '../../assets/icones/indicadores-energia.svg';
import type { Destaque, GrupoDestaque, Severidade } from './destaques';

/*
 * "Destaques do mês" no desenho do Figma (nov/2026): uma linha por destaque,
 * em fundo verde suave, com o raio, o título, o número e o contexto, a pílula
 * ("Bom sinal!") e a seta. Destaque de atenção ou informativo usa o mesmo
 * desenho no tom dele ("Atenção", "Para saber"). A seta abre o que o destaque
 * tem a mais: o que fazer e a lista de carregadores agrupada por local
 * (local → carregadores). Na impressão, tudo aberto.
 */

const ESTILO: Record<
  Severidade,
  { rotulo: string; linha: string; bloco: string; pilula: string; texto: string }
> = {
  ok: {
    rotulo: 'Bom sinal!',
    linha: 'bg-[#40d78d]/[0.14]',
    bloco: 'bg-[#d3fde2] text-[#00cc6a] dark:bg-estado-livre dark:text-estado-livre-forte',
    pilula: 'bg-[#00cc6a] border-[#00cc6a] text-white',
    texto: 'text-estado-livre-forte',
  },
  atencao: {
    rotulo: 'Atenção',
    linha: 'bg-[#f5a524]/[0.16]',
    bloco: 'bg-estado-problema text-estado-problema-forte',
    pilula: 'bg-[#c27c00] border-[#c27c00] text-white',
    texto: 'text-estado-problema-forte',
  },
  info: {
    rotulo: 'Para saber',
    linha: 'bg-[#089ef7]/[0.12]',
    bloco: 'bg-tom-azul text-tom-azul-icone',
    pilula: 'bg-[#089ef7] border-[#089ef7] text-white',
    texto: 'text-tom-azul-icone',
  },
};

/** Carregadores de um local dentro do destaque (aberto pela seta). */
function Grupo({ g, severidade }: { g: GrupoDestaque; severidade: Severidade }) {
  const unico = g.totalNoLocal === 1;
  return (
    <li className="rounded-[10px] bg-card/80 px-3 py-2.5 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground truncate" title={g.local}>
          {g.local}
        </p>
        {!unico && !g.todos && (
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums pt-0.5">
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
        <p className="mt-1 text-xs text-muted-foreground">
          {g.itens[0]?.detalhe ?? 'Único carregador do local'}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {g.itens.map(i => (
            <span
              key={i.chargePointId}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
              title={i.rotulo}
            >
              <span className="truncate">{i.rotulo}</span>
              {i.detalhe && <span className="shrink-0 text-muted-foreground">{i.detalhe}</span>}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function LinhaDoDestaque({ d }: { d: Destaque }) {
  const [aberto, setAberto] = useState(false);
  const idDoDetalhe = useId();
  const e = ESTILO[d.severidade];
  const grupos = d.grupos ?? [];
  // O texto completo da API, quando a linha mostra outra coisa.
  const textoCompleto = !d.dica && !grupos.length && d.textoCurto !== d.contexto;
  const temDetalhe = !!d.dica || grupos.length > 0 || textoCompleto;
  return (
    <li className={`rounded-[15px] ${e.linha} print-avoid`}>
      <div className="flex items-start pl-[18px] 3xl:pl-[26px] pr-4 3xl:pr-[28px] pt-[21px] pb-[20px]">
        <span
          aria-hidden="true"
          className={`w-10 h-[39px] rounded-[5px] ${e.bloco} flex items-center justify-center shrink-0`}
        >
          <IconeSvg src={iconeRaio} tamanho={26} altura={28} />
        </span>
        <div className="flex-1 min-w-0 ml-4 3xl:ml-[23px]">
          <div className="flex flex-wrap items-start gap-x-1 gap-y-1.5">
            <h4 className="flex-1 min-w-[140px] max-w-[236px] text-base font-semibold leading-[1.01] text-foreground">
              {d.titulo}
            </h4>
            <span
              className={`shrink-0 min-w-[89px] h-[23px] px-3 rounded-[25px] border text-[10px] font-semibold inline-flex items-center justify-center shadow-pilula ${e.pilula}`}
            >
              {e.rotulo}
            </span>
          </div>
          {d.valor && (
            <p className="mt-[11px] text-sm leading-[1.01] text-foreground">
              <b className="font-semibold tabular-nums">{d.valor}</b>
              {d.unidade ? ` ${d.unidade}` : ''}
            </p>
          )}
          <p
            title={d.contexto}
            className={`text-sm font-medium leading-[1.15] text-foreground ${d.valor ? 'mt-[3px] line-clamp-2' : 'mt-[11px] line-clamp-4'}`}
          >
            {d.contexto}
          </p>
          {temDetalhe && (
            <div
              id={idDoDetalhe}
              className={`mt-3 space-y-2 ${aberto ? '' : 'hidden print:block'}`}
            >
              {d.dica && <p className="text-xs text-muted-foreground">{d.dica}</p>}
              {grupos.length > 0 && (
                <ul className="grid grid-cols-1 gap-2">
                  {grupos.map(g => (
                    <Grupo key={g.local} g={g} severidade={d.severidade} />
                  ))}
                </ul>
              )}
              {textoCompleto && <p className="text-xs text-muted-foreground">{d.textoCurto}</p>}
            </div>
          )}
        </div>
        {temDetalhe ? (
          <button
            type="button"
            onClick={() => setAberto(a => !a)}
            aria-expanded={aberto}
            aria-controls={idDoDetalhe}
            aria-label={aberto ? 'Esconder detalhes' : 'Ver detalhes'}
            title={aberto ? 'Esconder detalhes' : 'Ver detalhes'}
            className="no-print ml-2 -mr-1 -mt-1 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full text-foreground hover:bg-card/70"
          >
            <ChevronRight
              aria-hidden="true"
              className={`w-[18px] h-[18px] transition-transform ${aberto ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="ml-2 -mr-1 w-7 shrink-0" />
        )}
      </div>
    </li>
  );
}

export function DestaquesDoMes({ destaques }: { destaques: Destaque[] }) {
  if (!destaques.length) {
    return (
      <div className="flex items-center gap-3 rounded-[15px] bg-[#40d78d]/[0.14] p-4 text-sm text-foreground">
        <span className="material-symbols-outlined text-estado-livre-forte">check_circle</span>
        Nada fora do normal neste período.
      </div>
    );
  }
  return (
    <ul className="space-y-[17px]">
      {destaques.map(d => (
        <LinhaDoDestaque key={d.id} d={d} />
      ))}
    </ul>
  );
}
