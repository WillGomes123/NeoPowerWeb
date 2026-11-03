/**
 * Relatório de recargas de um local, recarga a recarga: o arquivo que a
 * NeoPower manda ao dono do local para o repasse (PDF e Excel).
 *
 * Os números vêm prontos da API (GET /reports/financial?locationId=): valor
 * cobrado, débito na carteira, conferência, comissão e repasse de cada
 * recarga, e os subtotais. Aqui só se formata. O conteúdo segue o modelo
 * que o dono montou à mão para a Cantina do Papai (out/2026).
 *
 * A taxa do Mercado Pago não entra no arquivo para ninguém: ele vai para o
 * dono do local, e a taxa é custo interno da NeoPower (sai dos 5% dela).
 *
 * O PDF é desenhado em pdfDoLocal.ts, a partir do que é montado aqui.
 */
import { AbaXlsx, CelulaXlsx, EstiloXlsx, gerarXlsx, letraDaColuna } from './xlsx';

// ─── Dados (formato da API) ──────────────────────────────────────────────────

/** 'Spott': recarga do histórico importado da Spott, paga lá; não há débito na carteira daqui. */
export type ConferenciaDaRecarga = 'OK' | 'Sem débito' | 'Diferença' | 'Spott';

/** Conferência que pede atenção antes do repasse (a da Spott não). */
export const conferenciaComProblema = (l: { conferencia: ConferenciaDaRecarga }) =>
  l.conferencia !== 'OK' && l.conferencia !== 'Spott';

export interface LinhaDoLocal {
  numero: number;
  carregador?: string | null;
  data: string | null;
  horaInicio: string | null;
  horaFim: string | null;
  dataFim: string | null;
  duracaoMin: number;
  cliente: string;
  tipoDeConta: string;
  contaInterna: boolean;
  energiaKwh: number;
  tarifaKwh: number | null;
  taxaDeDestrava?: number | null;
  valorCobrado: number;
  valorEstornado?: number;
  debitoCarteira: number | null;
  conferencia: ConferenciaDaRecarga;
  diferencaCarteira?: number;
  comissao: number;
  repasse: number;
  situacao: string;
  /** Valor cobrado menos o estorno: a base do repasse. */
  receita?: number;
  /** Parte do repasse que o dono já recebeu pelo split, e o que falta. */
  recebidoNoSplit?: number;
  aRepassar?: number;
  recargaCruzada?: boolean;
  redeDoCliente?: string | null;
}

export interface SubtotalDoLocal {
  quantidade: number;
  energiaKwh: number;
  valorCobrado: number;
  debitoCarteira: number;
  receita: number;
  comissao: number;
  repasse: number;
  conferidas: number;
}

export interface SubtotaisDoLocal {
  todas: SubtotalDoLocal;
  clientes: SubtotalDoLocal;
  internas: SubtotalDoLocal;
}

export interface LocalDoRelatorio {
  id: number;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  marca?: string | null;
  fuso: string;
  fusoOrigem: 'estado' | 'padrao';
  /** "Manaus (UTC-4)" */
  fusoRotulo: string;
  carregadores: Array<{
    id: string;
    descricao: string | null;
    modelo: string | null;
    potenciaKw: number | null;
  }>;
}

export interface EntradaDoRelatorioDoLocal {
  local: LocalDoRelatorio;
  /** Em qualquer ordem; o relatório ordena da primeira para a última. */
  linhas: LinhaDoLocal[];
  subtotais: SubtotaisDoLocal;
  comissaoPercent: number;
  repassePercent?: number;
  criterioContaInterna?: string | null;
  split?: { ativo: boolean; desde: string | null } | null;
  /** Período escolhido na tela, AAAA-MM-DD. */
  inicio?: string | null;
  fim?: string | null;
  geradoEm?: Date;
}

// ─── Formatação ──────────────────────────────────────────────────────────────

const numero = (n: number, casas = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
/** "R$ 52,53"; zero ou sem valor vira "-", como no modelo. */
export const reaisOuTraco = (n: number | null | undefined) =>
  n == null || Math.round(n * 100) === 0 ? '-' : `R$ ${numero(n)}`;
const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. */
const dataDoFiltro = (iso?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};
/** 'DD/MM/AAAA' → número comparável. */
const chaveDaData = (d: string) => {
  const [dia, mes, ano] = d.split('/');
  return Number(`${ano}${mes}${dia}`);
};

const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Local';

export interface PeriodoDoRelatorio {
  de: string | null;
  ate: string | null;
  /** O período veio do filtro da tela (e não das recargas encontradas). */
  escolhido: boolean;
}

export function periodoDoRelatorio(e: EntradaDoRelatorioDoLocal): PeriodoDoRelatorio {
  const de = dataDoFiltro(e.inicio);
  const ate = dataDoFiltro(e.fim);
  if (de || ate) {
    return { de: de ?? ate, ate: ate ?? de, escolhido: true };
  }
  const datas = e.linhas
    .map(l => l.data)
    .filter((d): d is string => !!d)
    .sort((a, b) => chaveDaData(a) - chaveDaData(b));
  return { de: datas[0] ?? null, ate: datas[datas.length - 1] ?? null, escolhido: false };
}

/**
 * Relatorio_<Local>_<dd-mm>_a_<dd-mm-aaaa>, ex.:
 * Relatorio_Cantina_do_Papai_01-10_a_07-10-2026. Anos diferentes levam o ano
 * nas duas pontas.
 */
export function nomeDoArquivoDoLocal(nomeDoLocal: string, de: string | null, ate: string | null) {
  const base = `Relatorio_${slug(nomeDoLocal)}`;
  if (!de || !ate) {
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    return `${base}_${hoje}`;
  }
  const [d1, m1, a1] = de.split('/');
  const [d2, m2, a2] = ate.split('/');
  const inicio = a1 === a2 ? `${d1}-${m1}` : `${d1}-${m1}-${a1}`;
  return `${base}_${inicio}_a_${d2}-${m2}-${a2}`;
}

// ─── Colunas (as mesmas no PDF, no Excel e na tela) ──────────────────────────

export interface ColunaDoLocal {
  chave: string;
  titulo: string;
  /** Largura no PDF (mm, antes de ajustar à página) e no Excel (caracteres). */
  larguraPdf: number;
  larguraXlsx: number;
  alinhar: 'left' | 'center' | 'right';
  texto: (l: LinhaDoLocal) => string;
  /** Valor da célula no Excel (número quando dá para somar). */
  planilha: (l: LinhaDoLocal) => string | number | null;
  formato?: string;
}

/** R$ com o zero como "-", igual ao modelo. */
const FORMATO_REAIS = '"R$" #,##0.00;-"R$" #,##0.00;"-"';
const FORMATO_KWH = '#,##0.00';

export const fimDaRecarga = (l: LinhaDoLocal) =>
  l.horaFim
    ? `${l.horaFim}${l.dataFim && l.data && l.dataFim !== l.data ? ` (${l.dataFim.slice(0, 5)})` : ''}`
    : '-';

export const textoDaConferencia = (l: LinhaDoLocal) =>
  l.conferencia === 'Diferença' && l.diferencaCarteira
    ? `Diferença R$ ${numero(l.diferencaCarteira)}`
    : l.conferencia;

export function colunasDoLocal(comCarregador: boolean): ColunaDoLocal[] {
  const colunas: Array<ColunaDoLocal | null> = [
    {
      chave: 'numero',
      titulo: 'Nº recarga',
      larguraPdf: 15,
      larguraXlsx: 10,
      alinhar: 'center',
      texto: l => String(l.numero),
      planilha: l => l.numero,
      formato: '0',
    },
    {
      chave: 'data',
      titulo: 'Data',
      larguraPdf: 18,
      larguraXlsx: 11,
      alinhar: 'center',
      texto: l => l.data ?? '-',
      planilha: l => l.data,
    },
    {
      chave: 'inicio',
      titulo: 'Início',
      larguraPdf: 12,
      larguraXlsx: 8,
      alinhar: 'center',
      texto: l => l.horaInicio ?? '-',
      planilha: l => l.horaInicio,
    },
    {
      chave: 'fim',
      titulo: 'Fim',
      larguraPdf: 20,
      larguraXlsx: 13,
      alinhar: 'center',
      texto: fimDaRecarga,
      planilha: fimDaRecarga,
    },
    {
      chave: 'duracao',
      titulo: 'Duração (min)',
      larguraPdf: 14,
      larguraXlsx: 10,
      alinhar: 'center',
      texto: l => String(l.duracaoMin),
      planilha: l => l.duracaoMin,
      formato: '0',
    },
    comCarregador
      ? {
          chave: 'carregador',
          titulo: 'Carregador',
          larguraPdf: 24,
          larguraXlsx: 18,
          alinhar: 'left',
          texto: l => l.carregador ?? '-',
          planilha: l => l.carregador ?? null,
        }
      : null,
    {
      chave: 'cliente',
      titulo: 'Cliente',
      larguraPdf: 32,
      larguraXlsx: 22,
      alinhar: 'left',
      texto: l => l.cliente,
      planilha: l => l.cliente,
    },
    {
      chave: 'tipo',
      titulo: 'Tipo de conta',
      larguraPdf: 25,
      larguraXlsx: 17,
      alinhar: 'left',
      texto: l => l.tipoDeConta,
      planilha: l => l.tipoDeConta,
    },
    {
      chave: 'energia',
      titulo: 'Energia (kWh)',
      larguraPdf: 15,
      larguraXlsx: 11,
      alinhar: 'right',
      texto: l => numero(l.energiaKwh),
      planilha: l => Math.round(l.energiaKwh * 1000) / 1000,
      formato: FORMATO_KWH,
    },
    {
      chave: 'tarifa',
      titulo: 'Tarifa (R$/kWh)',
      larguraPdf: 15,
      larguraXlsx: 11,
      alinhar: 'right',
      texto: l => reaisOuTraco(l.tarifaKwh),
      planilha: l => l.tarifaKwh,
      formato: FORMATO_REAIS,
    },
    {
      chave: 'cobrado',
      titulo: 'Valor cobrado (R$)',
      larguraPdf: 19,
      larguraXlsx: 13,
      alinhar: 'right',
      texto: l => reaisOuTraco(l.valorCobrado),
      planilha: l => l.valorCobrado,
      formato: FORMATO_REAIS,
    },
    {
      chave: 'debito',
      titulo: 'Débito na carteira (R$)',
      larguraPdf: 19,
      larguraXlsx: 13,
      alinhar: 'right',
      texto: l => reaisOuTraco(l.debitoCarteira),
      planilha: l => (l.debitoCarteira == null ? '-' : l.debitoCarteira),
      formato: FORMATO_REAIS,
    },
    {
      chave: 'conferencia',
      titulo: 'Conferência',
      larguraPdf: 18,
      larguraXlsx: 14,
      alinhar: 'center',
      texto: textoDaConferencia,
      planilha: textoDaConferencia,
    },
    {
      chave: 'comissao',
      titulo: 'Comissão NeoPower (R$)',
      larguraPdf: 19,
      larguraXlsx: 13,
      alinhar: 'right',
      texto: l => reaisOuTraco(l.comissao),
      planilha: l => l.comissao,
      formato: FORMATO_REAIS,
    },
    {
      chave: 'repasse',
      titulo: 'Repasse ao local (R$)',
      larguraPdf: 19,
      larguraXlsx: 13,
      alinhar: 'right',
      texto: l => reaisOuTraco(l.repasse),
      planilha: l => l.repasse,
      formato: FORMATO_REAIS,
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      larguraPdf: 17,
      larguraXlsx: 13,
      alinhar: 'center',
      texto: l => l.situacao,
      planilha: l => l.situacao,
    },
  ];
  return colunas.filter((c): c is ColunaDoLocal => !!c);
}

// ─── Conteúdo ────────────────────────────────────────────────────────────────

export interface LinhaDeSubtotal {
  rotulo: string;
  valores: SubtotalDoLocal;
  /** Texto da coluna Conferência ("22 de 22 OK", "8 recargas"). */
  conferencia: string;
}

export interface RelatorioDoLocal {
  titulo: string;
  /** Endereço/carregadores e período/fuso. */
  cabecalho: string[];
  /** O que entra e a regra do repasse. */
  explicacoes: string[];
  regraDoRepasse: string;
  colunas: ColunaDoLocal[];
  linhas: LinhaDoLocal[];
  subtotais: LinhaDeSubtotal[];
  notas: string[];
  tituloDoResumo: string;
  notasDoResumo: string[];
  nomeDoArquivo: string;
  periodo: PeriodoDoRelatorio;
  local: LocalDoRelatorio;
  /** O nome do local, sem o caixa alta do cadastro. */
  nomeDoLocal: string;
  comissaoPercent: number;
  repassePercent: number;
  criterioContaInterna: string | null;
  split: { ativo: boolean; desde: string | null } | null;
  geradoEm: Date;
}

/** Faixas de tarifa na ordem das recargas: "R$ 2,35/kWh de 01/10 a 02/10". */
function faixasDeTarifa(linhas: LinhaDoLocal[]): string | null {
  const faixas: Array<{ tarifa: number; de: string; ate: string }> = [];
  for (const l of linhas) {
    if (l.tarifaKwh == null || !l.data) continue;
    const ultima = faixas[faixas.length - 1];
    if (ultima && Math.abs(ultima.tarifa - l.tarifaKwh) < 0.00005) ultima.ate = l.data;
    else faixas.push({ tarifa: l.tarifaKwh, de: l.data, ate: l.data });
  }
  if (!faixas.length) return null;
  const preco = (t: number) =>
    `R$ ${t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/kWh`;
  if (faixas.length === 1)
    return `Tarifa: ${preco(faixas[0].tarifa)} em todas as recargas do período.`;
  const dm = (d: string) => d.slice(0, 5);
  return `Tarifa: ${faixas
    .map(
      f =>
        `${preco(f.tarifa)} ${f.de === f.ate ? `em ${dm(f.de)}` : `de ${dm(f.de)} a ${dm(f.ate)}`}`
    )
    .join('; ')}.`;
}

export function montarRelatorioDoLocal(e: EntradaDoRelatorioDoLocal): RelatorioDoLocal {
  const { local } = e;
  const geradoEm = e.geradoEm ?? new Date();
  const comissao = e.comissaoPercent;
  const repassePercent = e.repassePercent ?? 100 - comissao;
  // A API manda da mais recente para a mais antiga; o extrato vai em ordem.
  const linhas = [...e.linhas].sort((a, b) => {
    const da = a.data ? chaveDaData(a.data) : 0;
    const db = b.data ? chaveDaData(b.data) : 0;
    return da - db || (a.horaInicio ?? '').localeCompare(b.horaInicio ?? '') || a.numero - b.numero;
  });
  const periodo = periodoDoRelatorio({ ...e, linhas });

  const carregadores = local.carregadores.map(
    c => `${c.id}${c.potenciaKw ? ` (${pct(c.potenciaKw)} kW)` : ''}`
  );
  const endereco = local.endereco || [local.cidade, local.estado].filter(Boolean).join('/');
  const linhaDoLocal = [
    endereco,
    carregadores.length
      ? `${carregadores.length > 1 ? 'Carregadores' : 'Carregador'} ${carregadores.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const textoDoPeriodo =
    periodo.de && periodo.ate
      ? `${periodo.escolhido ? 'Período' : 'Todo o período'}: ${periodo.de} a ${periodo.ate}`
      : 'Período: sem recargas';
  const cabecalho = [
    linhaDoLocal,
    `${textoDoPeriodo} · horários de ${local.fusoRotulo} · gerado em ${geradoEm.toLocaleDateString('pt-BR')}`,
  ].filter(Boolean);

  const regraDoRepasse = `${pct(comissao)}% da NeoPower. Repasse ao local = valor cobrado - comissão (${pct(repassePercent)}%; as taxas do Mercado Pago saem da comissão da NeoPower).`;
  const explicacoes = [
    'Valores das recargas efetivamente feitas e cobradas no carregador. Não inclui créditos colocados na carteira (recargas de saldo).',
  ];

  const s = e.subtotais;
  const subtotais: LinhaDeSubtotal[] = [
    {
      rotulo: 'TOTAL — todas as recargas',
      valores: s.todas,
      conferencia: `${s.todas.conferidas} de ${s.todas.quantidade} OK`,
    },
    {
      rotulo: 'Só clientes',
      valores: s.clientes,
      conferencia: `${s.clientes.quantidade} recarga${s.clientes.quantidade === 1 ? '' : 's'}`,
    },
    {
      rotulo: 'Só contas internas NeoPower',
      valores: s.internas,
      conferencia: `${s.internas.quantidade} recarga${s.internas.quantidade === 1 ? '' : 's'}`,
    },
  ];

  const destravas = [...new Set(linhas.map(l => l.taxaDeDestrava ?? 0).filter(v => v > 0))];
  const notas: string[] = [
    `Valor cobrado: o que o sistema cobrou do cliente pela recarga (energia × tarifa${
      destravas.length ? ' + taxa de destrava' : ''
    }). Débito na carteira: o que saiu do saldo do cliente; a coluna Conferência compara os dois.`,
  ];
  const tarifas = faixasDeTarifa(linhas);
  if (tarifas) notas.push(tarifas);
  if (destravas.length) {
    notas.push(
      `Taxa de destrava: ${destravas.map(v => `R$ ${numero(v)}`).join(' / ')} por recarga com consumo, já somada ao valor cobrado.`
    );
  }
  if (s.internas.quantidade > 0) {
    notas.push(
      `Contas internas NeoPower (linhas em laranja): recargas da equipe, pagas com saldo da carteira${
        e.criterioContaInterna ? ` (critério: ${e.criterioContaInterna})` : ''
      }. Entram no total; o subtotal "Só clientes" mostra o repasse sem elas.`
    );
  }
  const pendentes = linhas.filter(conferenciaComProblema).length;
  if (pendentes > 0) {
    notas.push(
      `Atenção: ${pendentes} recarga${pendentes === 1 ? '' : 's'} sem débito na carteira ou com diferença (coluna Conferência). Confira antes de pagar o repasse.`
    );
  }
  const daSpott = linhas.filter(l => l.conferencia === 'Spott').length;
  if (daSpott > 0) {
    notas.push(
      `Spott: ${daSpott} recarga${daSpott === 1 ? '' : 's'} do histórico da plataforma anterior (até 11/10/2026), paga${daSpott === 1 ? '' : 's'} na Spott. Entram no total e no repasse; não passaram pela carteira daqui.`
    );
  }
  const estornado = linhas.reduce((t, l) => t + (l.valorEstornado ?? 0), 0);
  if (estornado > 0.004) {
    notas.push(
      `Recargas estornadas: comissão e repasse sobre o que ficou depois do estorno (R$ ${numero(estornado)} devolvidos no período).`
    );
  }
  if (linhas.some(l => l.situacao === 'Sem energia')) {
    notas.push('Recargas sem energia (0 kWh) não têm cobrança.');
  }
  if (linhas.some(l => l.cliente === 'Visitante')) {
    notas.push('Visitante: recarga paga por Pix no QR do carregador, sem cadastro no app.');
  }
  if (local.fusoOrigem === 'padrao') {
    notas.push(`Horários de ${local.fusoRotulo}: o local não tem estado cadastrado.`);
  }
  notas.push('Clientes identificados só pelo primeiro nome e inicial do sobrenome (LGPD).');

  const periodoCurto =
    periodo.de && periodo.ate
      ? periodo.de.slice(6) === periodo.ate.slice(6)
        ? `${periodo.de.slice(0, 5)} a ${periodo.ate}`
        : `${periodo.de} a ${periodo.ate}`
      : 'sem recargas';

  return {
    titulo: `Relatório de recargas — ${local.nome}`,
    cabecalho,
    explicacoes,
    regraDoRepasse,
    colunas: colunasDoLocal(local.carregadores.length > 1),
    linhas,
    subtotais,
    notas,
    tituloDoResumo: `Resumo — ${local.nome} (${periodoCurto})`,
    notasDoResumo: [
      `Comissão da NeoPower: ${pct(comissao)}%. Repasse ao local = valor cobrado - comissão.`,
      'Valores por recarga efetivamente feita (não por crédito colocado na carteira).',
    ],
    nomeDoArquivo: nomeDoArquivoDoLocal(nomeApresentavel(local.nome), periodo.de, periodo.ate),
    periodo,
    local,
    nomeDoLocal: nomeApresentavel(local.nome),
    comissaoPercent: comissao,
    repassePercent,
    criterioContaInterna: e.criterioContaInterna ?? null,
    split: e.split ?? null,
    geradoEm,
  };
}

/** Monta o relatório a partir da resposta de GET /reports/financial?locationId=. */
export function relatorioDaApi(
  data: {
    items?: unknown[];
    local?: LocalDoRelatorio | null;
    porTipoDeConta?: SubtotaisDoLocal | null;
    comissaoPercent?: number;
    criterioContaInterna?: string | null;
    repasse?: { repassePercent?: number; split?: RelatorioDoLocal['split'] } | null;
  },
  inicio: string | null,
  fim: string | null
): RelatorioDoLocal | null {
  if (!data?.local || !data.porTipoDeConta) return null;
  return montarRelatorioDoLocal({
    local: data.local,
    linhas: (data.items ?? []).filter(
      (r): r is LinhaDoLocal => typeof (r as LinhaDoLocal)?.numero === 'number'
    ),
    subtotais: data.porTipoDeConta,
    comissaoPercent: data.comissaoPercent ?? 5,
    repassePercent: data.repasse?.repassePercent,
    criterioContaInterna: data.criterioContaInterna,
    split: data.repasse?.split ?? null,
    inicio,
    fim,
  });
}

// ─── Por carregador ──────────────────────────────────────────────────────────

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/**
 * Nome todo em maiúsculas no cadastro ("CONDOMÍNIO ART VILLE") vira "Condomínio
 * Art Ville". Sigla curta (BR, SC, II) fica como está, e nome já com minúsculas
 * é respeitado.
 */
export function nomeApresentavel(nome: string): string {
  const t = nome.trim().replace(/\s+/g, ' ');
  if (!t || t !== t.toUpperCase() || t === t.toLowerCase()) return t;
  return t
    .split(' ')
    .map((palavra, i) => {
      const minuscula = palavra.toLowerCase();
      if (i > 0 && PARTICULAS.has(minuscula)) return minuscula;
      if (palavra.length <= 2 || minuscula === palavra) return palavra;
      return minuscula.charAt(0).toUpperCase() + minuscula.slice(1);
    })
    .join(' ');
}

/** "Carregador DIAMOND 04" → "Diamond 04"; sem descrição que sirva, o ID. */
export function nomeDoCarregador(id: string, descricao: string | null | undefined): string {
  const sem = (descricao ?? '').trim().replace(/^carregador\b\s*/i, '');
  return sem ? nomeApresentavel(sem) : id;
}

export interface CarregadorDoRelatorio {
  id: string;
  nome: string;
  potenciaKw: number | null;
  linhas: LinhaDoLocal[];
}

/** Os carregadores do local, por nome (01, 02...), com as recargas de cada um. */
export function carregadoresDoRelatorio(rel: RelatorioDoLocal): CarregadorDoRelatorio[] {
  const porId = new Map<string, CarregadorDoRelatorio>(
    rel.local.carregadores.map(c => [
      c.id,
      { id: c.id, nome: nomeDoCarregador(c.id, c.descricao), potenciaKw: c.potenciaKw, linhas: [] },
    ])
  );
  for (const l of rel.linhas) {
    const id = l.carregador ?? '-';
    // Carregador que saiu do local depois da recarga continua no relatório.
    if (!porId.has(id)) porId.set(id, { id, nome: id, potenciaKw: null, linhas: [] });
    porId.get(id)!.linhas.push(l);
  }
  return [...porId.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );
}

export interface TotaisDasLinhas {
  quantidade: number;
  energiaKwh: number;
  valorCobrado: number;
  valorEstornado: number;
  receita: number;
  comissao: number;
  repasse: number;
  recebidoNoSplit: number;
  aRepassar: number;
}

export function somarLinhas(linhas: LinhaDoLocal[]): TotaisDasLinhas {
  const soma = (valor: (l: LinhaDoLocal) => number | null | undefined) =>
    Math.round(linhas.reduce((t, l) => t + (valor(l) ?? 0), 0) * 100) / 100;
  return {
    quantidade: linhas.length,
    energiaKwh: soma(l => l.energiaKwh),
    valorCobrado: soma(l => l.valorCobrado),
    valorEstornado: soma(l => l.valorEstornado),
    receita: soma(l => l.receita),
    comissao: soma(l => l.comissao),
    repasse: soma(l => l.repasse),
    recebidoNoSplit: soma(l => l.recebidoNoSplit),
    aRepassar: soma(l => l.aRepassar ?? l.repasse),
  };
}

export const temSplitNoRelatorio = (rel: RelatorioDoLocal) =>
  !!rel.split?.ativo || rel.linhas.some(l => (l.recebidoNoSplit ?? 0) > 0);

export type MarcaDaLinha = '' | 'M' | 'P' | 'C' | 'S';

/**
 * Por que o valor não é kWh × tarifa + destrava. O mínimo mudou com o tempo e
 * o cadastro só guarda o de hoje, então ele é reconhecido pelo valor redondo
 * acima da conta.
 */
export function marcaDaLinha(l: LinhaDoLocal): MarcaDaLinha {
  const kwh = l.energiaKwh || 0;
  const tarifa = l.tarifaKwh || 0;
  const destrava = l.taxaDeDestrava || 0;
  const cobrado = l.valorCobrado || 0;
  if (cobrado <= 0) return kwh >= 0.05 ? 'S' : '';
  if (!tarifa) return '';
  const esperado = kwh * tarifa + destrava;
  if (Math.abs(esperado - cobrado) <= 0.06) return '';
  if (cobrado < esperado && Math.abs(esperado - destrava - cobrado) <= 0.06) return 'C';
  if (cobrado > esperado && Number.isInteger(cobrado)) return 'M';
  return 'P';
}

/** Notas do PDF, só com o que aparece nestas recargas. "# " abre um título; **negrito**. */
export function notasDoValor(
  rel: RelatorioDoLocal,
  linhas: LinhaDoLocal[],
  nomeDaMarca: string | null
): string[] {
  const com = pct(rel.comissaoPercent);
  const rep = pct(rel.repassePercent);
  const notas = [
    '# Como ler',
    '**Cobrado:** valor debitado do cliente. **Estorno:** o que foi devolvido a ele. **Consumido:** cobrado menos estorno; é a base do repasse.',
    `**Comissão:** ${com}% do consumido, arredondada recarga a recarga. **Repasse:** o restante (${rep}%). As taxas do Mercado Pago saem da comissão da NeoPower.`,
  ];
  if (temSplitNoRelatorio(rel)) {
    const desde = rel.split?.desde ? new Date(rel.split.desde).toLocaleDateString('pt-BR') : null;
    notas.push(
      `**Já no split:** parte do repasse paga com crédito que caiu direto na conta Mercado Pago ${
        nomeDaMarca ? `da ${nomeDaMarca}` : 'do dono'
      }${desde ? ` (split ativo desde ${desde})` : ''}. **Via NeoPower:** o restante do repasse.`
    );
  }
  notas.push(
    '**Este relatório não desconta repasses já pagos:** ele lista o que cada recarga gerou. O acerto é feito por mês.',
    `**Horários** de ${rel.local.fusoRotulo}${
      rel.local.fusoOrigem === 'padrao' ? ' (o local não tem estado cadastrado)' : ''
    }. Recargas ainda em andamento não entram. Clientes identificados só pelo primeiro nome e inicial do sobrenome (LGPD).`
  );

  const marcas = new Set(linhas.map(marcaDaLinha));
  const destravas = [...new Set(linhas.map(l => l.taxaDeDestrava ?? 0).filter(v => v > 0))];
  const tarifas = faixasDeTarifa(linhas);
  notas.push('# Tarifa e valor cobrado');
  if (tarifas) notas.push(`**${tarifas.replace(': ', ':** ')}`);
  if (destravas.length) {
    notas.push(
      `**Taxa de destrava:** ${destravas.map(v => `R$ ${numero(v)}`).join(' / ')} por recarga com consumo, já somada ao valor cobrado.`
    );
  }
  if (marcas.has('M')) {
    notas.push(
      '**M:** valor mínimo por recarga vigente na época. Se depois houve devolução da diferença, ela aparece em Estorno.'
    );
  }
  if (marcas.has('P')) {
    notas.push(
      '**P:** preço do kWh diferente do mostrado na tarifa (faixa de horário do local, ou tarifa alterada depois da recarga).'
    );
  }
  if (marcas.has('C')) {
    notas.push('**C:** continuação de uma recarga anterior, sem nova taxa de destrava.');
  }
  if (marcas.has('S')) {
    notas.push(
      '**S:** energia registrada sem valor cobrado nesta plataforma (por exemplo, valor devolvido ao visitante). Não gera comissão nem repasse.'
    );
  }

  const cruzadas = linhas.filter(l => l.recargaCruzada);
  if (cruzadas.length) {
    const redes = [...new Set(cruzadas.map(l => l.redeDoCliente).filter(Boolean))].join(', ');
    notas.push(
      `**Clientes de outra rede:** ${cruzadas.length} ${cruzadas.length === 1 ? 'recarga' : 'das ' + linhas.length + ' recargas'} de quem usa outro app${
        redes ? ` (${redes})` : ''
      } neste local; ${cruzadas.length === 1 ? 'entra' : 'entram'} no repasse da mesma forma.`
    );
  }
  if (linhas.some(l => l.contaInterna)) {
    notas.push(
      `**Contas internas NeoPower (linhas em laranja):** recargas da equipe, pagas com saldo da carteira${
        rel.criterioContaInterna ? ` (critério: ${rel.criterioContaInterna})` : ''
      }. Entram no total; a tabela Por mês mostra o repasse sem elas.`
    );
  }
  const pendentes = linhas.filter(conferenciaComProblema).length;
  if (pendentes) {
    notas.push(
      `**Atenção:** ${pendentes} recarga${pendentes === 1 ? '' : 's'} sem débito na carteira ou com diferença (coluna Situação). Confira antes de pagar o repasse.`
    );
  }
  const daSpott = linhas.filter(l => l.conferencia === 'Spott').length;
  if (daSpott) {
    notas.push(
      `**Spott:** ${daSpott} recarga${daSpott === 1 ? '' : 's'} do histórico da plataforma anterior (até 11/10/2026), paga${daSpott === 1 ? '' : 's'} na Spott. Entram no total e no repasse; não passaram pela carteira daqui.`
    );
  }
  const semEnergia = linhas.filter(l => l.situacao === 'Sem energia').length;
  if (semEnergia) {
    notas.push(
      `**Sem energia:** ${semEnergia} recarga${semEnergia === 1 ? '' : 's'} sem energia entregue, sem cobrança.`
    );
  }
  if (linhas.some(l => l.cliente === 'Visitante')) {
    notas.push('**Visitante:** recarga paga por Pix no QR do carregador, sem cadastro no app.');
  }
  return notas;
}

// ─── Excel ───────────────────────────────────────────────────────────────────

export function gerarXlsxDoLocal(rel: RelatorioDoLocal): Uint8Array<ArrayBuffer> {
  const n = rel.colunas.length;
  const ultima = letraDaColuna(n - 1);
  const borda: EstiloXlsx = { borda: true, tamanho: 10 };
  const cabecalho: EstiloXlsx = {
    negrito: true,
    tamanho: 10,
    cor: 'FFFFFF',
    fundo: '1F4E3D',
    borda: true,
    alinhar: 'center',
    quebrar: true,
  };
  const celula = (valor: CelulaXlsx['valor'], estilo: EstiloXlsx): CelulaXlsx => ({
    valor,
    estilo,
  });

  const linhas: CelulaXlsx[][] = [];
  const mesclas: string[] = [];
  const alturas: Record<number, number> = {};
  const texto = (t: string, estilo: EstiloXlsx) => {
    linhas.push([celula(t, estilo)]);
    mesclas.push(`A${linhas.length}:${ultima}${linhas.length}`);
  };

  texto(rel.titulo, { negrito: true, tamanho: 14 });
  alturas[1] = 22;
  for (const c of [...rel.cabecalho, ...rel.explicacoes]) texto(c, { tamanho: 10, cor: '595959' });
  linhas.push([
    celula('Comissão:', { negrito: true, tamanho: 10 }),
    celula(rel.regraDoRepasse, { tamanho: 10 }),
  ]);
  mesclas.push(`B${linhas.length}:${ultima}${linhas.length}`);
  linhas.push([]);

  linhas.push(rel.colunas.map(c => celula(c.titulo, cabecalho)));
  alturas[linhas.length] = 32;

  for (const l of rel.linhas) {
    const fundo = l.contaInterna ? 'FCE4D6' : undefined;
    linhas.push(
      rel.colunas.map(c =>
        celula(c.planilha(l), {
          ...borda,
          fundo,
          alinhar: c.alinhar,
          formato: c.formato,
          ...(c.chave === 'conferencia' && conferenciaComProblema(l)
            ? { cor: 'C00000', negrito: true }
            : {}),
        })
      )
    );
  }

  const indice = (chave: string) => rel.colunas.findIndex(c => c.chave === chave);
  const mesclarAte = indice('energia');
  for (const st of rel.subtotais) {
    const total: EstiloXlsx = { ...borda, negrito: true, fundo: 'E2EFDA' };
    const linha = rel.colunas.map(c => celula(null, { ...total, alinhar: c.alinhar }));
    linha[0] = celula(st.rotulo, { ...total, alinhar: 'left' });
    const por = (chave: string, valor: string | number, formato?: string) => {
      const i = indice(chave);
      if (i >= 0) linha[i] = celula(valor, { ...total, alinhar: rel.colunas[i].alinhar, formato });
    };
    por('energia', Math.round(st.valores.energiaKwh * 1000) / 1000, FORMATO_KWH);
    por('cobrado', st.valores.valorCobrado, FORMATO_REAIS);
    por('debito', st.valores.debitoCarteira, FORMATO_REAIS);
    por('conferencia', st.conferencia);
    por('comissao', st.valores.comissao, FORMATO_REAIS);
    por('repasse', st.valores.repasse, FORMATO_REAIS);
    linhas.push(linha);
    if (mesclarAte > 0)
      mesclas.push(`A${linhas.length}:${letraDaColuna(mesclarAte - 1)}${linhas.length}`);
  }

  linhas.push([]);
  texto('Notas', { negrito: true, tamanho: 10 });
  for (const nota of rel.notas) {
    texto(`• ${nota}`, { tamanho: 9, cor: '595959', quebrar: true });
    // Nota longa ocupa mais de uma linha na largura da tabela.
    const larguraTotal = rel.colunas.reduce((s, c) => s + c.larguraXlsx, 0);
    const linhasDeTexto = Math.ceil((nota.length + 2) / (larguraTotal * 1.1));
    if (linhasDeTexto > 1) alturas[linhas.length] = 13 * linhasDeTexto;
  }

  const recargas: AbaXlsx = {
    nome: 'Recargas',
    linhas,
    larguras: rel.colunas.map(c => c.larguraXlsx),
    mesclas,
    alturas,
  };

  const reais: EstiloXlsx = { ...borda, formato: FORMATO_REAIS, alinhar: 'right' };
  const resumo: AbaXlsx = {
    nome: 'Resumo',
    larguras: [34, 11, 14, 18, 22, 20],
    mesclas: ['A1:F1'],
    alturas: { 1: 22, 3: 30 },
    linhas: [
      [celula(rel.tituloDoResumo, { negrito: true, tamanho: 14 })],
      [],
      [
        '',
        'Recargas',
        'Energia (kWh)',
        'Valor cobrado (R$)',
        'Comissão NeoPower (R$)',
        'Repasse ao local (R$)',
      ].map(t => celula(t, cabecalho)),
      ...rel.subtotais.map((st, i) => {
        const destaque: EstiloXlsx = i === 0 ? { negrito: true, fundo: 'E2EFDA' } : {};
        return [
          celula(i === 0 ? 'Todas as recargas' : st.rotulo, { ...borda, ...destaque }),
          celula(st.valores.quantidade, { ...borda, ...destaque, formato: '0', alinhar: 'right' }),
          celula(Math.round(st.valores.energiaKwh * 1000) / 1000, {
            ...borda,
            ...destaque,
            formato: FORMATO_KWH,
            alinhar: 'right',
          }),
          celula(st.valores.valorCobrado, { ...reais, ...destaque }),
          celula(st.valores.comissao, { ...reais, ...destaque }),
          celula(st.valores.repasse, { ...reais, ...destaque }),
        ];
      }),
      [],
      ...rel.notasDoResumo.map(t => [celula(t, { tamanho: 9, cor: '595959' })]),
    ],
    paisagem: false,
  };

  return gerarXlsx([recargas, resumo]);
}

/** Baixa um arquivo gerado no navegador. */
export function baixarArquivo(dados: Uint8Array<ArrayBuffer> | Blob, nome: string, tipo?: string) {
  const blob = dados instanceof Blob ? dados : new Blob([dados], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
