// "Destaques do mês" em formato de card: título curto, um número grande, uma
// linha de contexto e, quando o destaque aponta vários carregadores, a lista
// agrupada por local. A API (gerarLeituras, OCPP_API) decide QUAIS destaques
// existem e manda um texto corrido; aqui o texto vira estrutura a partir dos
// próprios números do relatório. Se a regra da API mudar e não der para
// reconstruir, o card cai no texto original da API.

import {
  fmtBRL,
  fmtInt,
  fmtPct,
  fmtVar,
  nomeDoMes,
  type Carregador,
  type Leitura,
  type RelatorioMensal,
} from './tipos';

export type Severidade = 'atencao' | 'ok' | 'info';

export interface ItemDestaque {
  chargePointId: string;
  /** Nome do carregador dentro do local (ex.: "Diamond 01"). */
  rotulo: string;
  /** Valor do carregador no destaque (ex.: "64%", "R$ 1,03/kWh"). */
  detalhe?: string;
}

export interface GrupoDestaque {
  local: string;
  /** Carregadores do local que entram no destaque. */
  itens: ItemDestaque[];
  /** Quantos carregadores o local tem no relatório. */
  totalNoLocal: number;
  /** Todos os carregadores do local entram no destaque. */
  todos: boolean;
}

export interface Destaque {
  id: string;
  severidade: Severidade;
  icone: string;
  titulo: string;
  /** Número grande do card. */
  valor: string;
  /** Texto pequeno ao lado do número (ex.: "carregadores"). */
  unidade?: string;
  /** Uma linha de contexto. */
  contexto: string;
  /** Lista agrupada por local, quando o destaque aponta mais de um carregador. */
  grupos?: GrupoDestaque[];
  /** O que fazer a respeito, quando couber (ex.: "Confira se estão ligados"). */
  dica?: string;
  /** Versão em uma frase para a apresentação (.pptx). */
  textoCurto: string;
}

const PALAVRAS_MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no']);

/**
 * "CONDOMÍNIO MORADA DOS PRÍNCIPES" → "Condomínio Morada dos Príncipes".
 * Só mexe em nomes todos em maiúsculas; o resto fica como foi cadastrado.
 */
export function nomeLegivel(nome: string): string {
  const letras = nome.replace(/[^\p{L}]/gu, '');
  if (letras.length < 4 || letras !== letras.toLocaleUpperCase('pt-BR')) return nome;
  return nome
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+)/)
    .map((p, i) =>
      i > 0 && PALAVRAS_MINUSCULAS.has(p)
        ? p
        : p.replace(/^(\p{L})/u, l => l.toLocaleUpperCase('pt-BR'))
    )
    .join('');
}

const localDe = (c: Carregador) => c.local?.trim() || c.nome;

/** Nome do carregador sem o nome do local na frente ("Local · Diamond 01" → "Diamond 01"). */
function rotuloNoLocal(c: Carregador): string {
  const local = c.local?.trim();
  if (local && c.nome.startsWith(`${local} · `)) return c.nome.slice(local.length + 3);
  if (local && c.nome === local) return c.chargePointId;
  return c.nome;
}

/** Nome completo e legível: "Condomínio Carpe Diem · Carpe Diem 01". */
export const nomeCompleto = (c: Carregador) => {
  const local = c.local?.trim();
  if (!local) return nomeLegivel(c.nome);
  const rotulo = rotuloNoLocal(c);
  return rotulo === c.chargePointId && c.nome === local
    ? nomeLegivel(local)
    : `${nomeLegivel(local)} · ${nomeLegivel(rotulo)}`;
};

/** Agrupa carregadores por local; locais inteiros primeiro, depois os maiores. */
export function agruparPorLocal(
  lista: Carregador[],
  todosDoRelatorio: Carregador[],
  detalhe?: (c: Carregador) => string
): GrupoDestaque[] {
  const porLocal = new Map<string, number>();
  for (const c of todosDoRelatorio) porLocal.set(localDe(c), (porLocal.get(localDe(c)) ?? 0) + 1);

  const grupos = new Map<string, GrupoDestaque>();
  for (const c of lista) {
    const chave = localDe(c);
    const g = grupos.get(chave) ?? {
      local: nomeLegivel(chave),
      itens: [],
      totalNoLocal: porLocal.get(chave) ?? 1,
      todos: false,
    };
    g.itens.push({
      chargePointId: c.chargePointId,
      rotulo: nomeLegivel(rotuloNoLocal(c)),
      detalhe: detalhe?.(c),
    });
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map(g => ({ ...g, todos: g.totalNoLocal > 1 && g.itens.length >= g.totalNoLocal }))
    .sort(
      (a, b) =>
        Number(b.todos) - Number(a.todos) ||
        b.itens.length - a.itens.length ||
        a.local.localeCompare(b.local, 'pt-BR')
    );
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** "Edifício Diamond (todos os 4), Carpe Diem (Carpe Diem 01) e mais 2 locais" */
function resumoDosGrupos(grupos: GrupoDestaque[], max = 4): string {
  const partes = grupos.slice(0, max).map(g => {
    if (g.todos) return `${g.local} (todos os ${g.totalNoLocal})`;
    if (g.totalNoLocal === 1) {
      const det = g.itens[0]?.detalhe;
      return det ? `${g.local} (${det})` : g.local;
    }
    const itens = g.itens.map(i => (i.detalhe ? `${i.rotulo} ${i.detalhe}` : i.rotulo));
    return `${g.local} (${itens.join(', ')})`;
  });
  const resto = grupos.length - max;
  if (resto > 0) partes.push(`mais ${resto} ${plural(resto, 'local', 'locais')}`);
  return partes.length > 1
    ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
    : (partes[0] ?? '');
}

const SEVERIDADE: Record<Leitura['tipo'], Severidade> = {
  alerta: 'atencao',
  positivo: 'ok',
  info: 'info',
};

const ICONE_PADRAO: Record<Severidade, string> = {
  atencao: 'priority_high',
  ok: 'trending_up',
  info: 'info',
};

/** Destaque com vários carregadores: card com lista; com um só, cabe na linha de contexto. */
function destaqueDeLista(
  base: Pick<Destaque, 'id' | 'severidade' | 'icone' | 'titulo'>,
  lista: Carregador[],
  r: RelatorioMensal,
  opcoes: {
    unidade: [string, string];
    contexto: string;
    detalhe?: (c: Carregador) => string;
    /** Com um carregador só, o número grande passa a ser o valor dele. */
    valorUnico?: (c: Carregador) => [string, string];
    dica?: string;
    fraseFinal: string;
  }
): Destaque {
  const grupos = agruparPorLocal(lista, r.carregadores, opcoes.detalhe);
  const n = lista.length;
  if (n === 1) {
    const c = lista[0];
    const det = opcoes.detalhe?.(c);
    const [valor, unidade] = opcoes.valorUnico?.(c) ?? [fmtInt(1), opcoes.unidade[0]];
    return {
      ...base,
      dica: opcoes.dica,
      valor,
      unidade,
      contexto: `${nomeCompleto(c)}${det && !opcoes.valorUnico ? ` · ${det}` : ''}`,
      textoCurto: `${nomeCompleto(c)}${det ? ` (${det})` : ''}. ${opcoes.fraseFinal}`,
    };
  }
  const locais = grupos.length;
  return {
    ...base,
    dica: opcoes.dica,
    valor: fmtInt(n),
    unidade: plural(n, opcoes.unidade[0], opcoes.unidade[1]),
    contexto:
      locais > 1
        ? `em ${locais} locais · ${opcoes.contexto}`
        : `em ${grupos[0].local} · ${opcoes.contexto}`,
    grupos,
    textoCurto: `${fmtInt(n)} ${plural(n, opcoes.unidade[0], opcoes.unidade[1])}: ${resumoDosGrupos(grupos)}. ${opcoes.fraseFinal}`,
  };
}

function montarUm(l: Leitura, r: RelatorioMensal, i: number): Destaque | null {
  const severidade = SEVERIDADE[l.tipo] ?? 'info';
  const cps = r.carregadores;
  const ativos = cps.filter(c => c.operacoes > 0);
  const v = r.variacoes;
  const mesAnterior = nomeDoMes(r.periodoAnterior.ini.slice(0, 7));
  const refAnterior = r.comparacaoParcial ? `mesmo período de ${mesAnterior}` : mesAnterior;

  if (l.titulo === 'Crescimento consistente' || l.titulo === 'Mês mais fraco') {
    if (v.faturamento === null) return null;
    const subiu = l.titulo === 'Crescimento consistente';
    const outros = [
      v.energiaKwh !== null ? `energia ${fmtVar(v.energiaKwh)}` : null,
      v.operacoes !== null ? `recargas ${fmtVar(v.operacoes)}` : null,
    ].filter(Boolean);
    return {
      id: `tendencia-${i}`,
      severidade,
      icone: subiu ? 'trending_up' : 'trending_down',
      titulo: subiu ? 'Crescimento consistente' : 'Mês mais fraco',
      valor: fmtVar(v.faturamento),
      unidade: 'no faturamento',
      contexto: `vs ${refAnterior}${outros.length ? ` · ${outros.join(' · ')}` : ''}`,
      textoCurto: l.texto,
    };
  }

  if (l.titulo === 'Carregadores sem recarga') {
    const parados = cps.filter(c => c.operacoes === 0);
    if (!parados.length) return null;
    return destaqueDeLista(
      {
        id: `parados-${i}`,
        severidade,
        icone: 'power_off',
        titulo: parados.length === 1 ? 'Carregador sem recarga' : 'Carregadores sem recarga',
      },
      parados,
      r,
      {
        unidade: ['carregador', 'carregadores'],
        contexto: `de ${fmtInt(cps.length)} no total`,
        dica: 'Confira se estão ligados e conectados.',
        fraseFinal: 'Nenhuma recarga no período: confira se estão ligados e conectados.',
      }
    );
  }

  if (l.titulo === 'Carregador com muito uso' || l.titulo === 'Carregadores com muito uso') {
    const saturados = cps
      .filter(c => c.ocupacaoPct >= 60)
      .sort((a, b) => b.ocupacaoPct - a.ocupacaoPct);
    if (!saturados.length) return null;
    return destaqueDeLista(
      {
        id: `uso-${i}`,
        severidade,
        icone: 'local_fire_department',
        titulo: saturados.length === 1 ? 'Carregador com muito uso' : 'Carregadores com muito uso',
      },
      saturados,
      r,
      {
        unidade: ['carregador', 'carregadores'],
        contexto: '60% ou mais do tempo em uso',
        detalhe: c => `${fmtPct(c.ocupacaoPct, 0)} em uso`,
        valorUnico: c => [fmtPct(c.ocupacaoPct, 0), 'do tempo em uso'],
        dica: 'Pode haver fila no pico; vale considerar mais conectores ou um ponto próximo.',
        fraseFinal: 'Pode haver fila no pico; vale considerar mais conectores ou um ponto próximo.',
      }
    );
  }

  if (l.titulo === 'Vale revisar o preço') {
    const media = r.resumo.precoMedioKwh;
    if (!media) return null;
    const baratos = ativos.filter(
      c => c.precoMedioKwh !== null && c.energiaKwh >= 100 && c.precoMedioKwh < media * 0.85
    );
    if (!baratos.length) return null;
    return destaqueDeLista(
      { id: `preco-${i}`, severidade, icone: 'sell', titulo: 'Vale revisar o preço' },
      baratos,
      r,
      {
        unidade: ['carregador', 'carregadores'],
        contexto: `abaixo da média da rede (${fmtBRL(media, 2)}/kWh)`,
        detalhe: c => `${fmtBRL(c.precoMedioKwh, 2)}/kWh`,
        valorUnico: c => [
          fmtBRL(c.precoMedioKwh, 2),
          `por kWh · média da rede ${fmtBRL(media, 2)}`,
        ],
        fraseFinal: `Abaixo da média da rede (${fmtBRL(media, 2)}/kWh).`,
      }
    );
  }

  if (l.titulo === 'Quem mais trouxe novos motoristas') {
    const lider = [...ativos].sort((a, b) => b.novosUsuarios - a.novosUsuarios)[0];
    if (!lider || lider.novosUsuarios <= 0) return null;
    return {
      id: `novos-${i}`,
      severidade,
      icone: 'person_add',
      titulo: 'Quem mais trouxe novos motoristas',
      valor: fmtInt(lider.novosUsuarios),
      unidade: plural(lider.novosUsuarios, 'novo motorista', 'novos motoristas'),
      contexto: nomeCompleto(lider),
      textoCurto: `${nomeCompleto(lider)} recebeu ${fmtInt(lider.novosUsuarios)} ${plural(lider.novosUsuarios, 'motorista novo', 'motoristas novos')}.`,
    };
  }

  if (l.titulo.endsWith(' cresceu')) {
    const acel = ativos
      .filter(c => c.anterior.faturamento > 0)
      .map(c => ({ c, v: (c.faturamento / c.anterior.faturamento - 1) * 100 }))
      .sort((a, b) => b.v - a.v)[0];
    if (!acel) return null;
    return {
      id: `cresceu-${i}`,
      severidade,
      icone: 'rocket_launch',
      titulo: 'Quem mais cresceu',
      valor: fmtVar(acel.v),
      unidade: 'no faturamento',
      contexto: `${nomeCompleto(acel.c)} · ${fmtBRL(acel.c.anterior.faturamento)} → ${fmtBRL(acel.c.faturamento)}`,
      textoCurto: `${nomeCompleto(acel.c)}: de ${fmtBRL(acel.c.anterior.faturamento)} para ${fmtBRL(acel.c.faturamento)} (${fmtVar(acel.v)}).`,
    };
  }

  if (l.titulo.endsWith(' tem o menor faturamento')) {
    const fraco = [...ativos].sort((a, b) => a.faturamento - b.faturamento)[0];
    if (!fraco) return null;
    const part = r.resumo.faturamento > 0 ? (fraco.faturamento / r.resumo.faturamento) * 100 : 0;
    return {
      id: `menor-${i}`,
      severidade,
      icone: 'south',
      titulo: 'Menor faturamento',
      valor: fmtBRL(fraco.faturamento),
      contexto: `${nomeCompleto(fraco)} · ${fmtPct(part)} do total · ${fmtPct(fraco.ocupacaoPct, 0)} em uso`,
      textoCurto: `${nomeCompleto(fraco)}: ${fmtBRL(fraco.faturamento)} (${fmtPct(part)} do total), ${fmtPct(fraco.ocupacaoPct, 0)} do tempo em uso.`,
    };
  }

  if (l.titulo === 'Poucos motoristas voltaram') {
    const pct = r.resumo.baseAtivaPct;
    if (pct === null) return null;
    return {
      id: `voltaram-${i}`,
      severidade,
      icone: 'person_search',
      titulo: 'Poucos motoristas voltaram',
      valor: fmtPct(pct, 0),
      unidade: 'da base voltou',
      contexto: 'Uma notificação ou um voucher pode trazê-los de volta',
      textoCurto: l.texto,
    };
  }

  return null;
}

const ORDEM: Record<Severidade, number> = { atencao: 0, ok: 1, info: 2 };

/** Destaques do relatório, na ordem: atenção, bons sinais, informativos. */
export function montarDestaques(r: RelatorioMensal): Destaque[] {
  return r.leituras
    .map((l, i) => {
      const d = montarUm(l, r, i);
      if (d) return d;
      // Leitura que a tela ainda não conhece: título + texto da API.
      const severidade = SEVERIDADE[l.tipo] ?? 'info';
      return {
        id: `leitura-${i}`,
        severidade,
        icone: ICONE_PADRAO[severidade],
        titulo: l.titulo,
        valor: '',
        contexto: l.texto,
        textoCurto: l.texto,
      } satisfies Destaque;
    })
    .map((d, i) => ({ d, i }))
    .sort((a, b) => ORDEM[a.d.severidade] - ORDEM[b.d.severidade] || a.i - b.i)
    .map(({ d }) => d);
}

/** "2 pontos de atenção · 3 bons sinais · 1 para saber" */
export function resumoDosDestaques(destaques: Destaque[]): string {
  if (!destaques.length) return 'Nada fora do normal neste período';
  const n = (s: Severidade) => destaques.filter(d => d.severidade === s).length;
  const partes = [
    n('atencao') && `${n('atencao')} ${n('atencao') === 1 ? 'ponto' : 'pontos'} de atenção`,
    n('ok') && `${n('ok')} ${n('ok') === 1 ? 'bom sinal' : 'bons sinais'}`,
    n('info') && `${n('info')} para saber`,
  ].filter(Boolean);
  return partes.join(' · ');
}
