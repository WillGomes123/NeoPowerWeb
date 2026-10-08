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
 */
import { jsPDF } from 'jspdf';
import { AbaXlsx, CelulaXlsx, EstiloXlsx, gerarXlsx, letraDaColuna } from './xlsx';

// ─── Dados (formato da API) ──────────────────────────────────────────────────

export type ConferenciaDaRecarga = 'OK' | 'Sem débito' | 'Diferença';

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
  const pendentes = linhas.filter(l => l.conferencia !== 'OK').length;
  if (pendentes > 0) {
    notas.push(
      `Atenção: ${pendentes} recarga${pendentes === 1 ? '' : 's'} sem débito na carteira ou com diferença (coluna Conferência). Confira antes de pagar o repasse.`
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
    nomeDoArquivo: nomeDoArquivoDoLocal(local.nome, periodo.de, periodo.ate),
    periodo,
  };
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

type Cor = [number, number, number];
const VERDE_ESCURO: Cor = [31, 78, 61];
const LARANJA_CLARO: Cor = [252, 228, 214];
const VERDE_CLARO: Cor = [226, 239, 218];
const CINZA_LINHA: Cor = [191, 191, 191];
const TEXTO: Cor = [33, 33, 33];
const TEXTO_SUAVE: Cor = [90, 90, 90];
const VERMELHO: Cor = [192, 0, 0];

interface LinhaDaTabela {
  celulas: string[];
  fundo?: Cor;
  negrito?: boolean;
  /** Cor do texto por coluna. */
  cores?: Array<Cor | undefined>;
  /** Mescla as N primeiras colunas (rótulo dos totais). */
  mesclar?: number;
}

/** Texto que cabe na largura, cortado com "..." quando não cabe. */
function caber(doc: jsPDF, texto: string, largura: number): string {
  if (doc.getTextWidth(texto) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > largura) t = t.slice(0, -1);
  return `${t}...`;
}

function desenharTabela(
  doc: jsPDF,
  o: {
    x: number;
    y: number;
    larguras: number[];
    alinhamentos: Array<'left' | 'center' | 'right'>;
    cabecalho: string[];
    linhas: LinhaDaTabela[];
    fonte: number;
    alturaLinha: number;
    topo: number;
    limite: number;
  }
): number {
  const mm = o.fonte * 0.3528;
  const larguraTotal = o.larguras.reduce((s, w) => s + w, 0);
  const desenharCabecalho = (y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(o.fonte);
    const quebrados = o.cabecalho.map(
      (t, i) => doc.splitTextToSize(t, o.larguras[i] - 2) as string[]
    );
    const linhasMax = Math.max(...quebrados.map(q => q.length));
    const h = Math.max(o.alturaLinha, linhasMax * mm * 1.25 + 2.4);
    doc.setFillColor(...VERDE_ESCURO);
    doc.setDrawColor(...CINZA_LINHA);
    doc.setLineWidth(0.1);
    doc.rect(o.x, y, larguraTotal, h, 'FD');
    doc.setTextColor(255, 255, 255);
    let x = o.x;
    quebrados.forEach((q, i) => {
      const w = o.larguras[i];
      const altura = q.length * mm * 1.25;
      let ty = y + (h - altura) / 2 + mm * 0.95;
      for (const parte of q) {
        doc.text(parte, x + w / 2, ty, { align: 'center' });
        ty += mm * 1.25;
      }
      x += w;
    });
    return y + h;
  };

  let y = desenharCabecalho(o.y);
  for (const linha of o.linhas) {
    if (y + o.alturaLinha > o.limite) {
      doc.addPage();
      y = desenharCabecalho(o.topo);
    }
    doc.setFont('helvetica', linha.negrito ? 'bold' : 'normal');
    doc.setFontSize(o.fonte);
    doc.setDrawColor(...CINZA_LINHA);
    doc.setLineWidth(0.1);
    const base = y + o.alturaLinha / 2 + mm * 0.35;
    let x = o.x;
    let i = 0;
    while (i < o.larguras.length) {
      const mescla = i === 0 && linha.mesclar ? linha.mesclar : 1;
      const w = o.larguras.slice(i, i + mescla).reduce((s, v) => s + v, 0);
      // A cor do texto é a mesma "cor de preenchimento" do PDF: o fundo é
      // refeito a cada célula, senão a célula seguinte sai pintada da cor do
      // texto anterior.
      if (linha.fundo) doc.setFillColor(...linha.fundo);
      doc.rect(x, y, w, o.alturaLinha, linha.fundo ? 'FD' : 'S');
      const texto = linha.celulas[i] ?? '';
      if (texto) {
        doc.setTextColor(...(linha.cores?.[i] ?? TEXTO));
        const alinhar = mescla > 1 ? 'left' : o.alinhamentos[i];
        const t = caber(doc, texto, w - 2);
        const tx = alinhar === 'left' ? x + 1 : alinhar === 'right' ? x + w - 1 : x + w / 2;
        doc.text(t, tx, base, { align: alinhar });
      }
      x += w;
      i += mescla;
    }
    y += o.alturaLinha;
  }
  return y;
}

function escreverNotas(
  doc: jsPDF,
  titulo: string,
  notas: string[],
  y: number,
  margem: number,
  largura: number,
  limite: number
): number {
  const mm = 7.5 * 0.3528;
  if (y + 12 > limite) {
    doc.addPage();
    y = margem + 4;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXTO);
  doc.text(titulo, margem, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXTO_SUAVE);
  for (const nota of notas) {
    const partes = doc.splitTextToSize(`• ${nota}`, largura) as string[];
    if (y + partes.length * mm * 1.3 > limite) {
      doc.addPage();
      y = margem + 4;
    }
    for (const p of partes) {
      doc.text(p, margem, y);
      y += mm * 1.3;
    }
    y += 0.8;
  }
  return y;
}

export function gerarPdfDoLocal(rel: RelatorioDoLocal): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 10;
  const util = largura - 2 * margem;
  const limite = altura - margem - 6; // espaço do rodapé

  let y = margem + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...TEXTO);
  doc.text(rel.titulo, margem, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXTO_SUAVE);
  for (const linha of [...rel.cabecalho, ...rel.explicacoes]) {
    for (const parte of doc.splitTextToSize(linha, util) as string[]) {
      doc.text(parte, margem, y);
      y += 4;
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXTO);
  doc.text('Comissão:', margem, y);
  doc.setFont('helvetica', 'normal');
  doc.text(rel.regraDoRepasse, margem + 16, y);
  y += 4;

  // Larguras ajustadas à página.
  const soma = rel.colunas.reduce((s, c) => s + c.larguraPdf, 0);
  const larguras = rel.colunas.map(c => (c.larguraPdf * util) / soma);
  const indice = (chave: string) => rel.colunas.findIndex(c => c.chave === chave);
  const iConferencia = indice('conferencia');
  const mesclarTotais = indice('energia');

  const linhas: LinhaDaTabela[] = rel.linhas.map(l => {
    const cores: Array<Cor | undefined> = [];
    if (l.conferencia !== 'OK') cores[iConferencia] = VERMELHO;
    return {
      celulas: rel.colunas.map(c => c.texto(l)),
      fundo: l.contaInterna ? LARANJA_CLARO : undefined,
      cores,
    };
  });
  for (const st of rel.subtotais) {
    const celulas = rel.colunas.map(() => '');
    celulas[0] = st.rotulo;
    const por = (chave: string, texto: string) => {
      const i = indice(chave);
      if (i >= 0) celulas[i] = texto;
    };
    por('energia', numero(st.valores.energiaKwh));
    por('cobrado', reaisOuTraco(st.valores.valorCobrado));
    por('debito', reaisOuTraco(st.valores.debitoCarteira));
    por('conferencia', st.conferencia);
    por('comissao', reaisOuTraco(st.valores.comissao));
    por('repasse', reaisOuTraco(st.valores.repasse));
    linhas.push({ celulas, fundo: VERDE_CLARO, negrito: true, mesclar: mesclarTotais });
  }

  y = desenharTabela(doc, {
    x: margem,
    y: y + 1,
    larguras,
    alinhamentos: rel.colunas.map(c => c.alinhar),
    cabecalho: rel.colunas.map(c => c.titulo),
    linhas,
    fonte: 6.8,
    alturaLinha: 4.4,
    topo: margem + 4,
    limite,
  });

  escreverNotas(doc, 'Notas', rel.notas, y + 6, margem, util, limite);

  // Resumo (página própria, como no modelo).
  doc.addPage();
  y = margem + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...TEXTO);
  doc.text(rel.tituloDoResumo, margem, y);
  const larguraResumo = [70, 25, 30, 35, 40, 40];
  y = desenharTabela(doc, {
    x: margem,
    y: y + 5,
    larguras: larguraResumo,
    alinhamentos: ['left', 'right', 'right', 'right', 'right', 'right'],
    cabecalho: [
      '',
      'Recargas',
      'Energia (kWh)',
      'Valor cobrado (R$)',
      'Comissão NeoPower (R$)',
      'Repasse ao local (R$)',
    ],
    linhas: rel.subtotais.map((st, i) => ({
      celulas: [
        i === 0 ? 'Todas as recargas' : st.rotulo,
        String(st.valores.quantidade),
        numero(st.valores.energiaKwh),
        reaisOuTraco(st.valores.valorCobrado),
        reaisOuTraco(st.valores.comissao),
        reaisOuTraco(st.valores.repasse),
      ],
      negrito: i === 0,
      fundo: i === 0 ? VERDE_CLARO : undefined,
    })),
    fonte: 9,
    alturaLinha: 6.5,
    topo: margem + 4,
    limite,
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXTO_SUAVE);
  y += 7;
  for (const nota of rel.notasDoResumo) {
    doc.text(nota, margem, y);
    y += 4.5;
  }

  // Rodapé com a paginação.
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXTO_SUAVE);
    doc.text(rel.titulo, margem, altura - margem + 2);
    doc.text(`Página ${p} de ${paginas}`, largura - margem, altura - margem + 2, {
      align: 'right',
    });
  }
  return doc;
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
          ...(c.chave === 'conferencia' && l.conferencia !== 'OK'
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
