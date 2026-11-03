/**
 * PDF do relatório do local, no visual do relatório financeiro: capa, resumo
 * com o gráfico e o extrato recarga a recarga. Sai o do local inteiro (uma
 * seção por carregador) ou o de um carregador só.
 *
 * Os números vêm prontos da API (GET /reports/financial?locationId=); aqui só
 * se soma e se desenha. O texto é de verdade (dá para selecionar e buscar) e o
 * arquivo leva a marca do local, não a de quem gerou.
 *
 * Este módulo carrega sob demanda (import()) porque traz as fontes embutidas.
 */
import { jsPDF } from 'jspdf';
import { api } from './api';
import { FONTES_DO_RELATORIO } from './fontesDoRelatorio';
import NeoPowerLogo from '../assets/NeoPower.png';
import { zipSemCompressao } from './xlsx';
import {
  CarregadorDoRelatorio,
  LinhaDoLocal,
  RelatorioDoLocal,
  carregadoresDoRelatorio,
  conferenciaComProblema,
  fimDaRecarga,
  marcaDaLinha,
  nomeDoArquivoDoLocal,
  notasDoValor,
  somarLinhas,
  temSplitNoRelatorio,
  TotaisDasLinhas,
} from './relatorioDoLocal';

// ─── Cores ───────────────────────────────────────────────────────────────────

type Cor = [number, number, number];
type Peso = keyof typeof FONTES_DO_RELATORIO;

const BRANCO: Cor = [255, 255, 255];
const PRETO: Cor = [9, 9, 11];
const TEXTO: Cor = [24, 24, 27];
const TEXTO_MEDIO: Cor = [82, 82, 91];
const TEXTO_SUAVE: Cor = [113, 113, 122];
const TEXTO_APAGADO: Cor = [184, 184, 194];
const FUNDO_RESUMO: Cor = [248, 249, 250];
const BORDA_CARTAO: Cor = [239, 239, 242];
const BORDA: Cor = [228, 228, 231];
const LINHA_FINA: Cor = [241, 241, 244];
const GRADE: Cor = [232, 232, 236];
const AMBAR: Cor = [180, 83, 9];
const VERMELHO: Cor = [220, 38, 38];
const VERDE: Cor = [4, 120, 87];
const LARANJA_CLARO: Cor = [255, 243, 232];
const CONCLUSAO: Cor = [24, 24, 27];
const CONCLUSAO_ROTULO: Cor = [161, 161, 170];
const CONCLUSAO_VERDE: Cor = [52, 211, 153];
const CONCLUSAO_AMBAR: Cor = [251, 191, 36];

const COR_PADRAO = '#10b981';

const misturar = (a: Cor, b: Cor, t: number): Cor => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

function corDoHex(hex: string | null | undefined): Cor | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function contrasteComBranco(c: Cor): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luz = 0.2126 * canal(c[0]) + 0.7152 * canal(c[1]) + 0.0722 * canal(c[2]);
  return 1.05 / (luz + 0.05);
}

/** A cor da marca escurecida até dar para ler no branco (marca de cor clara). */
function corLegivel(c: Cor): Cor {
  let cor = c;
  for (let i = 0; i < 12 && contrasteComBranco(cor) < 3; i++) cor = misturar(cor, PRETO, 0.12);
  return cor;
}

// ─── Marca ───────────────────────────────────────────────────────────────────

export interface VisualDaMarca {
  nome: string | null;
  cor: string | null;
  /** PNG em data URL, com o tamanho para manter a proporção. */
  logo: { dados: string; largura: number; altura: number } | null;
}

interface Paleta {
  marca: Cor;
  clara: Cor;
  bordaClara: Cor;
  traco: Cor;
}

const paletaDaMarca = (hex: string | null): Paleta => {
  const marca = corLegivel(corDoHex(hex) ?? (corDoHex(COR_PADRAO) as Cor));
  return {
    marca,
    clara: misturar(BRANCO, marca, 0.05),
    bordaClara: misturar(BRANCO, marca, 0.18),
    traco: misturar(BRANCO, marca, 0.35),
  };
};

/** Logo em PNG (no máximo 480 px); sem CORS ou sem rede, o PDF sai sem logo. */
function carregarLogo(url: string, limiteMs = 6000): Promise<VisualDaMarca['logo']> {
  return new Promise(resolve => {
    const img = new Image();
    const prazo = setTimeout(() => resolve(null), limiteMs);
    img.crossOrigin = 'anonymous';
    img.onerror = () => {
      clearTimeout(prazo);
      resolve(null);
    };
    img.onload = () => {
      clearTimeout(prazo);
      try {
        const escala = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dados: canvas.toDataURL('image/png'),
          largura: canvas.width,
          altura: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.src = url;
  });
}

/** Logo, cor e nome da marca dona do local (a NeoPower quando não tem marca). */
export async function visualDaMarca(marca: string | null | undefined): Promise<VisualDaMarca> {
  let dados: {
    companyName?: string | null;
    logoUri?: string | null;
    primaryColor?: string | null;
  } | null = null;
  if (marca) {
    try {
      const r = await api.get(`/branding/${encodeURIComponent(marca)}`);
      if (r.ok) {
        const corpo = await r.json();
        dados = corpo?.data ?? corpo;
      }
    } catch {
      // Sem a marca, o relatório sai com a logo e a cor da NeoPower.
    }
  }
  const logo = await carregarLogo(dados?.logoUri || NeoPowerLogo);
  return { nome: dados?.companyName?.trim() || null, cor: dados?.primaryColor || null, logo };
}

// ─── Formatação ──────────────────────────────────────────────────────────────

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const num = (n: number, casas = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const reais = (n: number) => `R$ ${num(n)}`;
/** Zero vira traço nas tabelas. */
const celula = (n: number | null | undefined) =>
  n == null || Math.round(n * 100) === 0 ? '-' : num(n);
const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const recargas = (n: number) => `${n} recarga${n === 1 ? '' : 's'}`;

const nomeDoMes = (mes: string) => {
  const [m, a] = mes.split('/');
  return MESES[Number(m) - 1] ? `${MESES[Number(m) - 1]}/${a}` : mes || 'Sem data';
};

const diaUtc = (d: string) =>
  Date.UTC(Number(d.slice(6)), Number(d.slice(3, 5)) - 1, Number(d.slice(0, 2)));
const DIA_MS = 86400000;

/** "Salvador (UTC-3)" → "Salvador". */
const cidadeDoFuso = (rotulo: string) => rotulo.replace(/\s*\(.*\)$/, '');

function geradoNoFuso(rel: RelatorioDoLocal) {
  const fuso = rel.local.fuso;
  try {
    const data = rel.geradoEm.toLocaleDateString('pt-BR', { timeZone: fuso });
    const hora = rel.geradoEm.toLocaleTimeString('pt-BR', {
      timeZone: fuso,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${data}, ${hora}`;
  } catch {
    return rel.geradoEm.toLocaleString('pt-BR');
  }
}

function agruparPorMes(linhas: LinhaDoLocal[]) {
  const meses = new Map<string, LinhaDoLocal[]>();
  for (const l of linhas) {
    const chave = l.data?.slice(3) ?? '';
    meses.set(chave, [...(meses.get(chave) ?? []), l]);
  }
  return [...meses.entries()];
}

// ─── Desenho ─────────────────────────────────────────────────────────────────

type Alinhar = 'left' | 'center' | 'right';

interface OpcoesDeTexto {
  tamanho: number;
  peso?: Peso;
  cor?: Cor;
  alinhar?: Alinhar;
  /** Espaço entre letras, em mm (rótulos em maiúsculas). */
  espaco?: number;
}

const usarFonte = (doc: jsPDF, peso: Peso, tamanho: number) => {
  doc.setFont(`Inter${peso}`, 'normal');
  doc.setFontSize(tamanho);
};

function escrever(doc: jsPDF, texto: string, x: number, y: number, o: OpcoesDeTexto) {
  usarFonte(doc, o.peso ?? 400, o.tamanho);
  doc.setTextColor(...(o.cor ?? TEXTO));
  const espaco = o.espaco ?? 0;
  const largura = doc.getTextWidth(texto) + espaco * Math.max(0, texto.length - 1);
  const x0 = o.alinhar === 'right' ? x - largura : o.alinhar === 'center' ? x - largura / 2 : x;
  if (espaco) doc.text(texto, x0, y, { charSpace: espaco });
  else doc.text(texto, x0, y);
  return largura;
}

function caber(doc: jsPDF, texto: string, largura: number) {
  if (doc.getTextWidth(texto) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > largura) t = t.slice(0, -1);
  return `${t}...`;
}

function cartao(
  doc: jsPDF,
  x: number,
  y: number,
  l: number,
  a: number,
  fundo: Cor,
  borda: Cor,
  raio = 3
) {
  doc.setFillColor(...fundo);
  doc.setDrawColor(...borda);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, l, a, raio, raio, 'FD');
}

function pilula(
  doc: jsPDF,
  texto: string,
  xCentro: number,
  y: number,
  o: {
    tamanho: number;
    espaco: number;
    fundo: Cor;
    cor: Cor;
    altura: number;
    folga: number;
    borda?: Cor;
    peso?: Peso;
  }
) {
  usarFonte(doc, o.peso ?? 700, o.tamanho);
  const largura = doc.getTextWidth(texto) + o.espaco * (texto.length - 1) + o.folga * 2;
  const x = xCentro - largura / 2;
  doc.setFillColor(...o.fundo);
  doc.setDrawColor(...(o.borda ?? o.fundo));
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, largura, o.altura, o.altura / 2, o.altura / 2, 'FD');
  escrever(doc, texto, x + o.folga, y + o.altura / 2 + o.tamanho * 0.3528 * 0.36, {
    tamanho: o.tamanho,
    peso: o.peso ?? 700,
    cor: o.cor,
    espaco: o.espaco,
  });
  return largura;
}

function logoNaCaixa(
  doc: jsPDF,
  logo: NonNullable<VisualDaMarca['logo']>,
  x: number,
  y: number,
  caixa: number
) {
  const escala = Math.min(caixa / logo.largura, caixa / logo.altura);
  const l = logo.largura * escala;
  const a = logo.altura * escala;
  doc.addImage(logo.dados, 'PNG', x + (caixa - l) / 2, y + (caixa - a) / 2, l, a, 'logo', 'FAST');
}

function titulo(doc: jsPDF, texto: string, x: number, y: number, p: Paleta, tamanho = 15) {
  const largura = escrever(doc, texto, x, y, { tamanho, peso: 800 });
  doc.setFillColor(...p.marca);
  doc.rect(x + largura + 3, y - tamanho * 0.3528 * 0.42, 11, 0.55, 'F');
}

/** Uma tabela enxuta (mês, carregador, totais), com números à direita. */
interface TabelaEnxuta {
  colunas: Array<{ titulo: string; largura: number; esquerda?: boolean }>;
  linhas: Array<{ celulas: string[]; destaque?: boolean }>;
}

const ALTURA_DA_LINHA_ENXUTA = 5.9;

const alturaDaTabelaEnxuta = (t: TabelaEnxuta) => 6.2 + t.linhas.length * ALTURA_DA_LINHA_ENXUTA;

function tabelaEnxuta(doc: jsPDF, x: number, y: number, largura: number, t: TabelaEnxuta) {
  const pesoDaCelula = (destaque: boolean | undefined, i: number): Peso =>
    destaque ? 800 : t.colunas[i].esquerda && i === 0 ? 600 : 400;
  const minimas = t.colunas.map((c, i) => {
    usarFonte(doc, 700, 5.6);
    const titulo = c.titulo.length
      ? doc.getTextWidth(c.titulo.toUpperCase()) + 0.09 * (c.titulo.length - 1)
      : 0;
    const corpo = t.linhas.map(l => {
      usarFonte(doc, pesoDaCelula(l.destaque, i), 7.4);
      return doc.getTextWidth(l.celulas[i] ?? '');
    });
    return Math.max(titulo, ...corpo) + 2.6;
  });
  const somaMinima = minimas.reduce((a, b) => a + b, 0);
  const somaPesos = t.colunas.reduce((a, c) => a + c.largura, 0);
  const folga = largura - somaMinima;
  const larguras = minimas.map((m, i) =>
    folga >= 0 ? m + (folga * t.colunas[i].largura) / somaPesos : (m * largura) / somaMinima
  );
  const xDaColuna = (i: number) => x + larguras.slice(0, i).reduce((a, b) => a + b, 0);
  t.colunas.forEach((c, i) => {
    const xc = xDaColuna(i);
    escrever(doc, c.titulo.toUpperCase(), c.esquerda ? xc + 1 : xc + larguras[i] - 1, y + 3.4, {
      tamanho: 5.6,
      peso: 700,
      cor: TEXTO_SUAVE,
      alinhar: c.esquerda ? 'left' : 'right',
      espaco: 0.09,
    });
  });
  doc.setDrawColor(...BORDA);
  doc.setLineWidth(0.25);
  doc.line(x, y + 5.2, x + largura, y + 5.2);
  let ly = y + 6.2;
  for (const linha of t.linhas) {
    const base = ly + ALTURA_DA_LINHA_ENXUTA / 2 + 0.9;
    linha.celulas.forEach((texto, i) => {
      const c = t.colunas[i];
      const peso = pesoDaCelula(linha.destaque, i);
      usarFonte(doc, peso, 7.4);
      const cabe = caber(doc, texto, larguras[i] - 1.6);
      escrever(doc, cabe, c.esquerda ? xDaColuna(i) + 1 : xDaColuna(i) + larguras[i] - 1, base, {
        tamanho: 7.4,
        peso,
        alinhar: c.esquerda ? 'left' : 'right',
      });
    });
    doc.setDrawColor(...(linha.destaque ? BORDA : LINHA_FINA));
    doc.setLineWidth(0.2);
    if (!linha.destaque)
      doc.line(x, ly + ALTURA_DA_LINHA_ENXUTA, x + largura, ly + ALTURA_DA_LINHA_ENXUTA);
    else doc.line(x, ly, x + largura, ly);
    ly += ALTURA_DA_LINHA_ENXUTA;
  }
  return ly;
}

// ─── Capa ────────────────────────────────────────────────────────────────────

const A4_RETRATO = { largura: 210, altura: 297 };
const A4_PAISAGEM = { largura: 297, altura: 210 };

function desenharCapa(
  doc: jsPDF,
  v: VisualDaMarca,
  p: Paleta,
  o: { titulo: string; detalhes: string[]; periodo: string; gerado: string; cidade: string }
) {
  const { largura } = A4_RETRATO;
  const meio = largura / 2;
  doc.setFillColor(...p.clara);
  doc.circle(23, 29, 75, 'F');
  doc.circle(187, 203, 53, 'F');

  let y = 74;
  if (v.logo) {
    cartao(doc, meio - 13, y, 26, 26, BRANCO, BORDA_CARTAO, 4);
    logoNaCaixa(doc, v.logo, meio - 11, y + 2, 22);
    y += 26;
  }
  y += 12;
  pilula(doc, 'RELATÓRIO FINANCEIRO', meio, y, {
    tamanho: 8,
    espaco: 0.9,
    fundo: PRETO,
    cor: BRANCO,
    altura: 7.4,
    folga: 9,
  });
  y += 7.4 + 20;

  usarFonte(doc, 800, 34);
  const linhas = doc.splitTextToSize(o.titulo, largura - 32) as string[];
  for (const linha of linhas) {
    escrever(doc, linha, meio, y, { tamanho: 34, peso: 800, alinhar: 'center' });
    y += 13.4;
  }
  y -= 7;
  for (const d of o.detalhes) {
    usarFonte(doc, 400, 10);
    for (const parte of doc.splitTextToSize(d, largura - 32) as string[]) {
      y += 5.4;
      escrever(doc, parte, meio, y, { tamanho: 10, cor: TEXTO_SUAVE, alinhar: 'center' });
    }
  }
  y += 8;
  doc.setFillColor(...p.traco);
  doc.rect(meio - 12, y, 24, 0.55, 'F');
  y += 11;

  const rico = (rotulo: string, valor: string, resto: string) => {
    usarFonte(doc, 400, 11);
    const lr = doc.getTextWidth(rotulo);
    const lresto = doc.getTextWidth(resto);
    usarFonte(doc, 700, 11);
    const lv = doc.getTextWidth(valor);
    let x = meio - (lr + lv + lresto) / 2;
    escrever(doc, rotulo, x, y, { tamanho: 11, cor: TEXTO_SUAVE });
    x += lr;
    escrever(doc, valor, x, y, { tamanho: 11, peso: 700 });
    x += lv;
    if (resto) escrever(doc, resto, x, y, { tamanho: 11, cor: TEXTO_SUAVE });
    y += 7;
  };
  rico('Período: ', o.periodo, '');
  rico('Data de Geração: ', o.gerado, ` (horário de ${o.cidade})`);
}

// ─── Resumo ──────────────────────────────────────────────────────────────────

function desenharTopoDoResumo(doc: jsPDF, v: VisualDaMarca, p: Paleta, rotulo: string) {
  const { largura, altura } = A4_RETRATO;
  doc.setFillColor(...FUNDO_RESUMO);
  doc.rect(0, 0, largura, altura, 'F');
  let x = 14;
  if (v.logo) {
    logoNaCaixa(doc, v.logo, x, 13, 9);
    x += 12;
    doc.setDrawColor(...BORDA);
    doc.setLineWidth(0.25);
    doc.line(x, 14.5, x, 20.5);
    x += 3;
  }
  usarFonte(doc, 600, 7.5);
  const texto = caber(doc, rotulo.toUpperCase(), 130);
  escrever(doc, texto, x, 18.4, { tamanho: 7.5, peso: 600, cor: TEXTO_SUAVE, espaco: 0.32 });
  usarFonte(doc, 700, 6.5);
  const lp = doc.getTextWidth('OPERACIONAL') + 0.14 * 10 + 7.2;
  pilula(doc, 'OPERACIONAL', largura - 14 - lp / 2, 14.2, {
    tamanho: 6.5,
    espaco: 0.14,
    fundo: BRANCO,
    cor: p.marca,
    altura: 5.6,
    folga: 3.6,
    borda: BORDA,
  });
}

/** Consumido por dia: uma série, barras finas, um eixo. Dia sem recarga fica vazio. */
function desenharGrafico(
  doc: jsPDF,
  x: number,
  y: number,
  l: number,
  a: number,
  linhas: LinhaDoLocal[],
  de: string | null,
  ate: string | null,
  p: Paleta
) {
  const inicio = de ? diaUtc(de) : 0;
  const dias = de && ate ? Math.max(1, Math.round((diaUtc(ate) - inicio) / DIA_MS) + 1) : 1;
  const porDia = new Map<number, number>();
  for (const linha of linhas) {
    if (!linha.data || !de) continue;
    const i = Math.round((diaUtc(linha.data) - inicio) / DIA_MS);
    porDia.set(i, (porDia.get(i) ?? 0) + (linha.receita ?? 0));
  }
  const maior = Math.max(0, ...porDia.values());
  const esq = 10;
  const topo = 4.5;
  const baseDoEixo = 5.5;
  const passos = [
    1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000,
    100000,
  ];
  const passo = passos.find(v => maior / v <= 4) ?? passos[passos.length - 1];
  const teto = maior > 0 ? passo * (Math.floor(maior / passo) + 1) : passo * 4;
  const yDe = (v: number) => y + topo + (a - topo - baseDoEixo) * (1 - v / teto);

  for (let v = 0; v <= teto + 0.0001; v += passo) {
    doc.setDrawColor(...GRADE);
    doc.setLineWidth(0.15);
    doc.line(x + esq, yDe(v), x + l, yDe(v));
    escrever(doc, num(v, 0), x + esq - 1.6, yDe(v) + 0.8, {
      tamanho: 6.2,
      cor: TEXTO_SUAVE,
      alinhar: 'right',
    });
  }

  const largDia = (l - esq) / dias;
  const barra = Math.max(0.5, Math.min(largDia - 0.55, 4.2));
  const intervalo = Math.max(1, Math.round(dias / 7));
  let rotulado = false;
  for (let i = 0; i < dias; i++) {
    const cx = x + esq + largDia * (i + 0.5);
    if (i % intervalo === 0) {
      const d = new Date(inicio + i * DIA_MS);
      const dm = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      escrever(doc, dm, cx, y + a - 1.6, { tamanho: 6.2, cor: TEXTO_SUAVE, alinhar: 'center' });
    }
    const valor = porDia.get(i) ?? 0;
    if (valor <= 0) continue;
    const yy = yDe(valor);
    const h = yDe(0) - yy;
    const raio = Math.min(1, barra / 2, h);
    const x0 = cx - barra / 2;
    doc.setFillColor(...p.marca);
    doc.roundedRect(x0, yy, barra, h, raio, raio, 'F');
    if (h > raio) doc.rect(x0, yy + raio, barra, h - raio, 'F');
    if (valor === maior && !rotulado) {
      rotulado = true;
      const ancora: Alinhar = i > dias * 0.85 ? 'right' : i < dias * 0.15 ? 'left' : 'center';
      const xr = ancora === 'right' ? cx + barra / 2 : ancora === 'left' ? cx - barra / 2 : cx;
      escrever(doc, reais(valor), xr, yy - 1.4, { tamanho: 6.8, peso: 700, alinhar: ancora });
    }
  }
}

interface DadosDoResumo {
  rotulo: string;
  linhas: LinhaDoLocal[];
  de: string | null;
  ate: string | null;
  porCarregador?: TabelaEnxuta;
}

const colunasDeValores = (temSplit: boolean): TabelaEnxuta['colunas'] => [
  { titulo: 'Recargas', largura: 12 },
  { titulo: 'kWh', largura: 14 },
  { titulo: 'Consumido', largura: 16 },
  { titulo: 'Comissão', largura: 14 },
  { titulo: 'Repasse', largura: 16 },
  ...(temSplit
    ? [
        { titulo: 'Já no split', largura: 14 },
        { titulo: 'Via NeoPower', largura: 15 },
      ]
    : []),
];

const celulasDeValores = (t: TotaisDasLinhas, temSplit: boolean, comTraco = true): string[] => {
  const v = (n: number) => (comTraco ? celula(n) : num(n));
  return [
    String(t.quantidade),
    num(t.energiaKwh),
    v(t.receita),
    v(t.comissao),
    v(t.repasse),
    ...(temSplit ? [celula(t.recebidoNoSplit), celula(t.aRepassar)] : []),
  ];
};

function tabelaPorMes(linhas: LinhaDoLocal[], temSplit: boolean): TabelaEnxuta {
  const t = somarLinhas(linhas);
  const internas = linhas.filter(l => l.contaInterna);
  return {
    colunas: [{ titulo: 'Mês', largura: 30, esquerda: true }, ...colunasDeValores(temSplit)],
    linhas: [
      ...agruparPorMes(linhas).map(([mes, lm]) => ({
        celulas: [nomeDoMes(mes), ...celulasDeValores(somarLinhas(lm), temSplit)],
      })),
      { celulas: ['Total', ...celulasDeValores(t, temSplit, false)], destaque: true },
      ...(internas.length
        ? [
            {
              celulas: [
                'Só clientes',
                ...celulasDeValores(somarLinhas(linhas.filter(l => !l.contaInterna)), temSplit),
              ],
            },
            {
              celulas: [
                'Só contas internas NeoPower',
                ...celulasDeValores(somarLinhas(internas), temSplit),
              ],
            },
          ]
        : []),
    ],
  };
}

function tabelaPorCarregador(
  rel: RelatorioDoLocal,
  carregadores: CarregadorDoRelatorio[],
  temSplit: boolean
): TabelaEnxuta {
  return {
    colunas: [
      { titulo: 'Carregador', largura: 30, esquerda: true },
      { titulo: 'ID', largura: 27, esquerda: true },
      { titulo: 'Potência', largura: 11 },
      ...colunasDeValores(temSplit),
    ],
    linhas: [
      ...carregadores.map(c => ({
        celulas: [
          c.nome,
          c.id,
          c.potenciaKw ? `${pct(c.potenciaKw)} kW` : '-',
          ...celulasDeValores(somarLinhas(c.linhas), temSplit),
        ],
      })),
      {
        celulas: [
          'Total do local',
          '',
          '',
          ...celulasDeValores(somarLinhas(rel.linhas), temSplit, false),
        ],
        destaque: true,
      },
    ],
  };
}

function desenharResumo(
  doc: jsPDF,
  rel: RelatorioDoLocal,
  v: VisualDaMarca,
  p: Paleta,
  r: DadosDoResumo
) {
  const { largura, altura } = A4_RETRATO;
  const margem = 14;
  const util = largura - margem * 2;
  const limite = altura - 20;
  const temSplit = temSplitNoRelatorio(rel);
  const t = somarLinhas(r.linhas);
  const com = pct(rel.comissaoPercent);
  const rep = pct(rel.repassePercent);

  doc.addPage('a4', 'portrait');
  desenharTopoDoResumo(doc, v, p, `Financeiro · ${r.rotulo}`);
  let y = 37;
  titulo(doc, 'Resumo de Recargas', margem, y, p);
  y += 4;

  const cartoes: Array<{
    rotulo: string;
    valor: string;
    unidade?: string;
    nota: string;
    cor: Cor;
  }> = [
    {
      rotulo: 'Consumido em recargas',
      valor: reais(t.receita),
      nota: recargas(t.quantidade),
      cor: p.marca,
    },
    {
      rotulo: `Comissão NeoPower ${com}%`,
      valor: reais(t.comissao),
      nota: `${com}% do consumido`,
      cor: VERMELHO,
    },
    {
      rotulo: `Repasse ao dono ${rep}%`,
      valor: reais(t.repasse),
      nota: temSplit ? `${reais(t.recebidoNoSplit)} já no split` : `${rep}% do consumido`,
      cor: VERDE,
    },
    {
      rotulo: 'Energia',
      valor: num(t.energiaKwh),
      unidade: 'kWh',
      nota: 'Entregue no período',
      cor: p.marca,
    },
  ];
  const lc = (util - 9) / 4;
  cartoes.forEach((c, i) => {
    const x = margem + i * (lc + 3);
    cartao(doc, x, y, lc, 27, BRANCO, BORDA_CARTAO);
    usarFonte(doc, 700, 5.8);
    const partes = (doc.splitTextToSize(c.rotulo.toUpperCase(), lc - 7.4) as string[]).slice(0, 2);
    partes.forEach((parte, j) => {
      escrever(doc, parte, x + 3.4, y + 5.6 + j * 2.8, {
        tamanho: 5.8,
        peso: 700,
        cor: TEXTO_SUAVE,
        espaco: 0.1,
      });
    });
    // Valor grande que não cabe no cartão diminui em vez de vazar.
    let tamanho = 14;
    usarFonte(doc, 800, tamanho);
    const larguraDaUnidade = c.unidade ? 8 : 0;
    while (tamanho > 8 && doc.getTextWidth(c.valor) + larguraDaUnidade > lc - 7) {
      tamanho -= 0.5;
      usarFonte(doc, 800, tamanho);
    }
    const lv = escrever(doc, c.valor, x + 3.4, y + 17, { tamanho, peso: 800 });
    if (c.unidade)
      escrever(doc, c.unidade, x + 3.4 + lv + 1, y + 17, {
        tamanho: 7,
        peso: 600,
        cor: TEXTO_SUAVE,
      });
    escrever(doc, c.nota, x + 3.4, y + 22, { tamanho: 6.4, peso: 600, cor: c.cor });
  });
  y += 27 + 5;

  const legenda = `O repasse ao dono é ${rep}% do consumido em recargas; o saldo parado na carteira é do cliente até ele usar. As taxas do Mercado Pago saem dos ${com}% da NeoPower. Valores brutos do período, sem descontar repasses já pagos.`;
  usarFonte(doc, 400, 7.4);
  for (const parte of doc.splitTextToSize(legenda, util) as string[]) {
    escrever(doc, parte, margem, y, { tamanho: 7.4, cor: TEXTO_MEDIO });
    y += 3.7;
  }
  y += 2;

  cartao(doc, margem, y, util, 66, BRANCO, BORDA_CARTAO);
  escrever(doc, 'CONSUMIDO POR DIA (R$)', margem + 4.5, y + 6, {
    tamanho: 6.6,
    peso: 700,
    cor: TEXTO_SUAVE,
    espaco: 0.22,
  });
  if (r.linhas.length) {
    desenharGrafico(doc, margem + 4.5, y + 8, util - 9, 55, r.linhas, r.de, r.ate, p);
  } else {
    escrever(doc, 'Sem recargas no período.', largura / 2, y + 36, {
      tamanho: 8,
      cor: TEXTO_SUAVE,
      alinhar: 'center',
    });
  }
  y += 66 + 10;

  const blocos: Array<{ titulo: string; tabela: TabelaEnxuta }> = [
    { titulo: 'Por mês', tabela: tabelaPorMes(r.linhas, temSplit) },
    ...(r.porCarregador ? [{ titulo: 'Por carregador', tabela: r.porCarregador }] : []),
  ];
  for (const b of blocos) {
    const alturaDoBloco = alturaDaTabelaEnxuta(b.tabela) + 6;
    if (y + alturaDoBloco > limite) {
      doc.addPage('a4', 'portrait');
      desenharTopoDoResumo(doc, v, p, `Financeiro · ${r.rotulo}`);
      y = 37;
    }
    titulo(doc, b.titulo, margem, y, p);
    y += 4;
    cartao(doc, margem, y, util, alturaDoBloco, BRANCO, BORDA_CARTAO);
    tabelaEnxuta(doc, margem + 4, y + 2.4, util - 8, b.tabela);
    y += alturaDoBloco + 10;
  }
}

// ─── Extrato ─────────────────────────────────────────────────────────────────

const MARGEM_EXTRATO = 12;
const TOPO_EXTRATO = 15;
const LIMITE_EXTRATO = A4_PAISAGEM.altura - 15;
const ALTURA_DA_LINHA = 4.85;
const FONTE_DA_LINHA = 7.1;

type Tom = 'kwh' | 'com' | 'rep' | 'fraco';

interface ColunaDoExtrato {
  titulo: string;
  largura: number;
  esquerda?: boolean;
  tom?: Tom;
  texto: (l: LinhaDoLocal) => string;
  total?: (t: TotaisDasLinhas) => string;
}

function colunasDoExtrato(temSplit: boolean): ColunaDoExtrato[] {
  const duracao = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
  return [
    { titulo: 'Nº', largura: 10, texto: l => String(l.numero) },
    { titulo: 'Data', largura: 16, esquerda: true, texto: l => l.data ?? '-' },
    { titulo: 'Início', largura: 10, esquerda: true, texto: l => l.horaInicio ?? '-' },
    { titulo: 'Fim', largura: 19, esquerda: true, texto: fimDaRecarga },
    { titulo: 'Duração', largura: 12, texto: l => duracao(l.duracaoMin || 0) },
    {
      titulo: 'Cliente',
      largura: temSplit ? 35 : 48,
      esquerda: true,
      texto: l => l.cliente || '-',
    },
    {
      titulo: 'kWh',
      largura: 12,
      tom: 'kwh',
      texto: l => num(l.energiaKwh || 0),
      total: t => num(t.energiaKwh),
    },
    {
      titulo: 'Cobrado',
      largura: 15,
      texto: l => celula(l.valorCobrado),
      total: t => celula(t.valorCobrado),
    },
    {
      titulo: 'Estorno',
      largura: 13,
      tom: 'fraco',
      texto: l => celula(l.valorEstornado),
      total: t => celula(t.valorEstornado),
    },
    {
      titulo: 'Consumido',
      largura: 16,
      texto: l => celula(l.receita),
      total: t => celula(t.receita),
    },
    {
      titulo: 'Comissão',
      largura: 15,
      tom: 'com',
      texto: l => celula(l.comissao),
      total: t => celula(t.comissao),
    },
    {
      titulo: 'Repasse',
      largura: 15,
      tom: 'rep',
      texto: l => celula(l.repasse),
      total: t => celula(t.repasse),
    },
    ...(temSplit
      ? ([
          {
            titulo: 'Já no split',
            largura: 16,
            tom: 'fraco',
            texto: l => celula(l.recebidoNoSplit),
            total: t => celula(t.recebidoNoSplit),
          },
          {
            titulo: 'Via NeoPower',
            largura: 19,
            texto: l => celula(l.aRepassar ?? l.repasse),
            total: t => celula(t.aRepassar),
          },
        ] as ColunaDoExtrato[])
      : []),
    {
      titulo: 'Situação',
      largura: 0,
      esquerda: true,
      texto: l => {
        const marca = marcaDaLinha(l);
        return `${l.situacao}${marca ? ` · ${marca}` : ''}${conferenciaComProblema(l) ? ` · ${l.conferencia}` : ''}`;
      },
    },
  ];
}

const estiloDoTom = (tom?: Tom): { cor: Cor; peso: Peso } => {
  if (tom === 'kwh') return { cor: AMBAR, peso: 600 };
  if (tom === 'com') return { cor: VERMELHO, peso: 400 };
  if (tom === 'rep') return { cor: VERDE, peso: 700 };
  if (tom === 'fraco') return { cor: TEXTO_SUAVE, peso: 400 };
  return { cor: TEXTO, peso: 400 };
};

function desenharSecaoDoCarregador(
  doc: jsPDF,
  rel: RelatorioDoLocal,
  c: CarregadorDoRelatorio,
  p: Paleta,
  o: { tituloDaPagina: string | null }
) {
  const margem = MARGEM_EXTRATO;
  const util = A4_PAISAGEM.largura - margem * 2;
  const temSplit = temSplitNoRelatorio(rel);
  const t = somarLinhas(c.linhas);

  doc.addPage('a4', 'landscape');
  let y = TOPO_EXTRATO;
  if (o.tituloDaPagina) {
    titulo(doc, o.tituloDaPagina, margem, y + 1, p, 14);
    y += 5.5;
  } else {
    y -= 2;
  }

  // Faixa do carregador com os totais.
  const alturaDaFaixa = 14.5;
  cartao(doc, margem, y, util, alturaDaFaixa, p.clara, p.bordaClara, 2.5);
  escrever(doc, c.nome, margem + 4, y + 6.2, { tamanho: 13, peso: 800 });
  const sub = [`ID ${c.id}`, c.potenciaKw ? `${pct(c.potenciaKw)} kW` : null, rel.nomeDoLocal]
    .filter(Boolean)
    .join(' · ');
  escrever(doc, sub, margem + 4, y + 10.6, { tamanho: 7, cor: TEXTO_MEDIO });

  const numeros: Array<[string, string]> = [
    ['Recargas', String(t.quantidade)],
    ['Energia', `${num(t.energiaKwh)} kWh`],
    ['Consumido', reais(t.receita)],
    ['Comissão', reais(t.comissao)],
    ['Repasse', reais(t.repasse)],
    ...(temSplit
      ? ([
          ['Já no split', reais(t.recebidoNoSplit)],
          ['Via NeoPower', reais(t.aRepassar)],
        ] as Array<[string, string]>)
      : []),
  ];
  let xn = margem + util - 4;
  for (const [rotulo, valor] of [...numeros].reverse()) {
    usarFonte(doc, 700, 5.6);
    const lr = doc.getTextWidth(rotulo.toUpperCase()) + 0.1 * (rotulo.length - 1);
    usarFonte(doc, 800, 8.6);
    const lv = doc.getTextWidth(valor);
    const lm = Math.max(lr, lv);
    xn -= lm;
    escrever(doc, rotulo.toUpperCase(), xn, y + 5.6, {
      tamanho: 5.6,
      peso: 700,
      cor: TEXTO_SUAVE,
      espaco: 0.1,
    });
    escrever(doc, valor, xn, y + 9.8, { tamanho: 8.6, peso: 800 });
    xn -= 5;
  }
  y += alturaDaFaixa + 4;

  escrever(
    doc,
    `Todas as recargas deste carregador, da primeira para a última · valores em R$ · horários de ${cidadeDoFuso(rel.local.fusoRotulo)}`,
    margem,
    y,
    { tamanho: 7.4, cor: TEXTO_SUAVE }
  );
  y += 2.2;

  // Larguras: a coluna Situação fica com o que sobra.
  const colunas = colunasDoExtrato(temSplit);
  const ocupado = colunas.reduce((s, col) => s + col.largura, 0);
  const larguras = colunas.map(col => col.largura || util - ocupado);
  const xDe = (i: number) => margem + larguras.slice(0, i).reduce((s, w) => s + w, 0);
  const xDoTexto = (i: number) => (colunas[i].esquerda ? xDe(i) + 1.2 : xDe(i) + larguras[i] - 1.2);
  const alinhar = (i: number): Alinhar => (colunas[i].esquerda ? 'left' : 'right');

  const cabecalho = (yc: number) => {
    colunas.forEach((col, i) => {
      escrever(doc, col.titulo.toUpperCase(), xDoTexto(i), yc + 3.6, {
        tamanho: 5.9,
        peso: 700,
        cor: TEXTO_SUAVE,
        alinhar: alinhar(i),
        espaco: 0.06,
      });
    });
    doc.setDrawColor(212, 212, 216);
    doc.setLineWidth(0.4);
    doc.line(margem, yc + 5.4, margem + util, yc + 5.4);
    return yc + 5.4;
  };
  y = cabecalho(y);

  const quebrarSePreciso = (alturaDaLinha: number) => {
    if (y + alturaDaLinha > LIMITE_EXTRATO) {
      doc.addPage('a4', 'landscape');
      y = cabecalho(TOPO_EXTRATO - 2);
    }
  };

  const linhaDeTotal = (
    rotulo: string,
    totais: TotaisDasLinhas,
    fundo: Cor,
    cor: Cor,
    peso: Peso,
    altura: number,
    comTom: boolean
  ) => {
    quebrarSePreciso(altura);
    doc.setFillColor(...fundo);
    doc.rect(margem, y, util, altura, 'F');
    const base = y + altura / 2 + FONTE_DA_LINHA * 0.3528 * 0.36;
    escrever(doc, rotulo, margem + 1.2, base, { tamanho: FONTE_DA_LINHA, peso, cor });
    colunas.forEach((col, i) => {
      if (!col.total) return;
      const estilo = comTom ? estiloDoTom(col.tom) : { cor, peso };
      escrever(doc, col.total(totais), xDoTexto(i), base, {
        tamanho: FONTE_DA_LINHA,
        peso: comTom ? peso : estilo.peso,
        cor: comTom ? cor : estilo.cor,
        alinhar: alinhar(i),
      });
    });
    y += altura;
  };

  for (const [mes, linhasDoMes] of agruparPorMes(c.linhas)) {
    linhaDeTotal(
      `${nomeDoMes(mes)} · ${recargas(linhasDoMes.length)}`,
      somarLinhas(linhasDoMes),
      p.clara,
      TEXTO,
      700,
      ALTURA_DA_LINHA + 0.3,
      true
    );
    doc.setDrawColor(...p.bordaClara);
    doc.setLineWidth(0.2);
    doc.line(margem, y, margem + util, y);
    for (const l of linhasDoMes) {
      quebrarSePreciso(ALTURA_DA_LINHA);
      if (l.contaInterna) {
        doc.setFillColor(...LARANJA_CLARO);
        doc.rect(margem, y, util, ALTURA_DA_LINHA, 'F');
      }
      const base = y + ALTURA_DA_LINHA / 2 + FONTE_DA_LINHA * 0.3528 * 0.36;
      colunas.forEach((col, i) => {
        const estilo = estiloDoTom(col.tom);
        usarFonte(doc, estilo.peso, FONTE_DA_LINHA);
        const texto = caber(doc, col.texto(l), larguras[i] - 2);
        const destaque = col.titulo === 'Situação' && conferenciaComProblema(l);
        escrever(doc, texto, xDoTexto(i), base, {
          tamanho: FONTE_DA_LINHA,
          peso: destaque ? 700 : estilo.peso,
          cor: destaque ? VERMELHO : estilo.cor,
          alinhar: alinhar(i),
        });
      });
      y += ALTURA_DA_LINHA;
      doc.setDrawColor(...LINHA_FINA);
      doc.setLineWidth(0.15);
      doc.line(margem, y, margem + util, y);
    }
  }
  linhaDeTotal(`TOTAL ${c.nome} · ${recargas(c.linhas.length)}`, t, PRETO, BRANCO, 800, 6.2, false);
  return y;
}

// ─── Conclusão e notas ───────────────────────────────────────────────────────

type Trecho = { texto: string; negrito: boolean };

const FONTE_DA_NOTA = 7.1;
const ALTURA_DA_LINHA_DA_NOTA = 3.72;

/** Parágrafo com **negrito**, quebrado na largura da coluna. */
function quebrarNota(doc: jsPDF, rico: string, largura: number): Trecho[][] {
  const linhas: Trecho[][] = [];
  let atual: Trecho[] = [];
  let ocupado = 0;
  rico.split('**').forEach((parte, i) => {
    const negrito = i % 2 === 1;
    usarFonte(doc, negrito ? 700 : 400, FONTE_DA_NOTA);
    for (const palavra of parte.split(/(?<=\s)/)) {
      if (!palavra) continue;
      const lp = doc.getTextWidth(palavra.trimEnd());
      if (ocupado + lp > largura && atual.length) {
        linhas.push(atual);
        atual = [];
        ocupado = 0;
      }
      atual.push({ texto: palavra, negrito });
      ocupado += doc.getTextWidth(palavra);
    }
  });
  if (atual.length) linhas.push(atual);
  return linhas;
}

function medirNotas(doc: jsPDF, notas: string[], largura: number) {
  return notas.map(n => ({
    linhas: n.startsWith('# ') ? [] : quebrarNota(doc, n, largura),
    cabecalho: n.startsWith('# ') ? n.slice(2) : null,
  }));
}

const alturaDaNota = (n: ReturnType<typeof medirNotas>[number]) =>
  n.cabecalho ? ALTURA_DA_LINHA_DA_NOTA + 0.9 : n.linhas.length * ALTURA_DA_LINHA_DA_NOTA + 1.2;

function alturaDasNotas(doc: jsPDF, notas: string[], largura: number) {
  const medidas = medirNotas(doc, notas, (largura - 8) / 2);
  const total = medidas.reduce((s, n) => s + alturaDaNota(n), 0);
  // Duas colunas nunca ficam exatamente iguais: folga de uma nota.
  return total / 2 + 8;
}

function desenharNotas(doc: jsPDF, notas: string[], x: number, y: number, largura: number) {
  const lc = (largura - 8) / 2;
  const medidas = medirNotas(doc, notas, lc);
  const total = medidas.reduce((s, n) => s + alturaDaNota(n), 0);
  let coluna = 0;
  let acumulado = 0;
  let yn = y;
  medidas.forEach((n, i) => {
    const a = alturaDaNota(n);
    // O título vai junto com a primeira nota dele.
    const seguinte = n.cabecalho && medidas[i + 1] ? alturaDaNota(medidas[i + 1]) : 0;
    if (coluna === 0 && acumulado > 0 && acumulado + (a + seguinte) / 2 > total / 2) {
      coluna = 1;
      yn = y;
    }
    const xc = x + coluna * (lc + 8);
    if (n.cabecalho) {
      escrever(doc, n.cabecalho, xc, yn + 2.6, { tamanho: 7.4, peso: 700 });
    } else {
      n.linhas.forEach((linha, l) => {
        let xt = xc;
        for (const trecho of linha) {
          usarFonte(doc, trecho.negrito ? 700 : 400, FONTE_DA_NOTA);
          doc.setTextColor(...(trecho.negrito ? TEXTO : TEXTO_MEDIO));
          doc.text(trecho.texto, xt, yn + 2.6 + l * ALTURA_DA_LINHA_DA_NOTA);
          xt += doc.getTextWidth(trecho.texto);
        }
      });
    }
    yn += a;
    acumulado += a;
  });
}

function desenharConclusao(
  doc: jsPDF,
  linhas: LinhaDoLocal[],
  x: number,
  y: number,
  largura: number
) {
  const altura = 22;
  cartao(doc, x, y, largura, altura, CONCLUSAO, CONCLUSAO, 3);
  const t = somarLinhas(linhas);
  const media = t.energiaKwh > 0 ? t.receita / t.energiaKwh : 0;
  const pendentes = linhas.filter(conferenciaComProblema).length;
  const daSpott = linhas.filter(l => l.conferencia === 'Spott').length;
  const conferidas = linhas.length - pendentes;
  const frase = pendentes
    ? `${recargas(pendentes)} para conferir antes do repasse`
    : daSpott
      ? 'Todas as recargas conferem; as da plataforma anterior foram pagas lá'
      : 'Todas as recargas conferem com o débito na carteira do cliente';
  const lp = largura * 0.42;
  escrever(doc, 'CONCLUSÃO DO PERÍODO', x + 6, y + 7, {
    tamanho: 6.2,
    peso: 600,
    cor: CONCLUSAO_ROTULO,
    espaco: 0.42,
  });
  usarFonte(doc, 700, 12);
  (doc.splitTextToSize(frase, lp) as string[]).slice(0, 2).forEach((parte, i) => {
    escrever(doc, parte, x + 6, y + 12.2 + i * 5.2, { tamanho: 12, peso: 700, cor: BRANCO });
  });
  const stats: Array<[string, string, Cor]> = [
    ['Média por kWh', reais(media), CONCLUSAO_VERDE],
    ['Sessões processadas', String(linhas.length), CONCLUSAO_AMBAR],
    ['Conferidas', `${conferidas} de ${linhas.length}`, pendentes ? CONCLUSAO_AMBAR : BRANCO],
  ];
  const inicio = x + 6 + lp + 8;
  const lDoStat = (x + largura - 6 - inicio) / 3;
  stats.forEach(([rotulo, valor, cor], i) => {
    const xs = inicio + i * lDoStat;
    escrever(doc, rotulo.toUpperCase(), xs, y + 10.6, {
      tamanho: 6,
      peso: 600,
      cor: CONCLUSAO_ROTULO,
      espaco: 0.17,
    });
    escrever(doc, valor, xs, y + 16.6, { tamanho: 13, peso: 800, cor });
  });
  return y + altura;
}

function desenharFim(
  doc: jsPDF,
  rel: RelatorioDoLocal,
  v: VisualDaMarca,
  linhas: LinhaDoLocal[],
  yAtual: number
) {
  const x = MARGEM_EXTRATO;
  const largura = A4_PAISAGEM.largura - x * 2;
  const notas = notasDoValor(rel, linhas, v.nome);
  const necessario = 22 + 5 + alturaDasNotas(doc, notas, largura);
  let y = yAtual + 5;
  if (y + necessario > LIMITE_EXTRATO) {
    doc.addPage('a4', 'landscape');
    y = TOPO_EXTRATO - 2;
  }
  y = desenharConclusao(doc, linhas, x, y, largura);
  desenharNotas(doc, notas, x, y + 5, largura);
}

// ─── Arquivos ────────────────────────────────────────────────────────────────

function novoDocumento(titulo: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  for (const peso of Object.keys(FONTES_DO_RELATORIO) as unknown as Peso[]) {
    doc.addFileToVFS(`Inter-${peso}.ttf`, FONTES_DO_RELATORIO[peso]);
    doc.addFont(`Inter-${peso}.ttf`, `Inter${peso}`, 'normal');
  }
  doc.setProperties({ title: titulo, author: 'NeoPower', creator: 'NeoPower' });
  return doc;
}

/** A capa leva só a assinatura; as outras páginas, o sistema e o número. */
function desenharRodapes(doc: jsPDF) {
  const paginas = doc.getNumberOfPages();
  for (let n = 1; n <= paginas; n++) {
    doc.setPage(n);
    const largura = doc.internal.pageSize.getWidth();
    const altura = doc.internal.pageSize.getHeight();
    if (n === 1) {
      escrever(doc, 'NEOPOWER BILLING INTELLIGENCE', largura / 2, altura - 15.5, {
        tamanho: 6.5,
        peso: 700,
        cor: TEXTO_APAGADO,
        alinhar: 'center',
        espaco: 0.5,
      });
      continue;
    }
    escrever(doc, 'NEOPOWER FINANCIAL SYSTEM', 12, altura - 7, {
      tamanho: 6,
      cor: TEXTO_APAGADO,
      espaco: 0.2,
    });
    escrever(
      doc,
      `PÁGINA ${String(n).padStart(2, '0')} DE ${String(paginas).padStart(2, '0')}`,
      largura - 12,
      altura - 7,
      {
        tamanho: 6,
        cor: TEXTO_APAGADO,
        alinhar: 'right',
      }
    );
  }
}

const periodoEscrito = (de: string | null, ate: string | null) =>
  de && ate ? `${de} a ${ate}` : 'Sem recargas';

/** Local inteiro: capa, resumo, uma seção por carregador e o total do local. */
export function gerarPdfDoLocal(rel: RelatorioDoLocal, v: VisualDaMarca): jsPDF {
  const p = paletaDaMarca(v.cor);
  const temSplit = temSplitNoRelatorio(rel);
  const carregadores = carregadoresDoRelatorio(rel);
  const { de, ate } = rel.periodo;
  const periodo = periodoEscrito(de, ate);
  const doc = novoDocumento(`Relatório financeiro · ${rel.nomeDoLocal} · ${periodo}`);

  const endereco =
    rel.local.endereco || [rel.local.cidade, rel.local.estado].filter(Boolean).join('/');
  desenharCapa(doc, v, p, {
    titulo: rel.nomeDoLocal,
    detalhes: endereco ? [endereco] : [],
    periodo,
    gerado: geradoNoFuso(rel),
    cidade: cidadeDoFuso(rel.local.fusoRotulo),
  });
  const porCarregador = tabelaPorCarregador(rel, carregadores, temSplit);
  desenharResumo(doc, rel, v, p, {
    rotulo: rel.nomeDoLocal,
    linhas: rel.linhas,
    de,
    ate,
    porCarregador,
  });

  carregadores
    .filter(c => c.linhas.length > 0)
    .forEach((c, i) => {
      desenharSecaoDoCarregador(doc, rel, c, p, {
        tituloDaPagina: i === 0 ? 'Extrato por Carregador' : null,
      });
    });

  doc.addPage('a4', 'landscape');
  const x = MARGEM_EXTRATO;
  const util = A4_PAISAGEM.largura - x * 2;
  titulo(doc, 'Total do Local', x, TOPO_EXTRATO + 1, p, 14);
  escrever(doc, `${rel.nomeDoLocal} · ${periodo}`, x, TOPO_EXTRATO + 6.5, {
    tamanho: 7.6,
    cor: TEXTO_SUAVE,
  });
  const yTabela = tabelaEnxuta(doc, x, TOPO_EXTRATO + 8.5, util, porCarregador);
  desenharFim(doc, rel, v, rel.linhas, yTabela);

  desenharRodapes(doc);
  return doc;
}

/** Um carregador só: capa, resumo, extrato e notas. */
export function gerarPdfDoCarregador(
  rel: RelatorioDoLocal,
  c: CarregadorDoRelatorio,
  v: VisualDaMarca
): jsPDF {
  const p = paletaDaMarca(v.cor);
  const periodoDoCarregador = rel.periodo.escolhido
    ? { de: rel.periodo.de, ate: rel.periodo.ate }
    : { de: c.linhas[0]?.data ?? null, ate: c.linhas[c.linhas.length - 1]?.data ?? null };
  const periodo = periodoEscrito(periodoDoCarregador.de, periodoDoCarregador.ate);
  const doc = novoDocumento(`Relatório financeiro · ${c.nome} · ${rel.nomeDoLocal} · ${periodo}`);

  const endereco =
    rel.local.endereco || [rel.local.cidade, rel.local.estado].filter(Boolean).join('/');
  desenharCapa(doc, v, p, {
    titulo: c.nome,
    detalhes: [
      [rel.nomeDoLocal, `ID ${c.id}`, c.potenciaKw ? `${pct(c.potenciaKw)} kW` : null]
        .filter(Boolean)
        .join(' · '),
      ...(endereco ? [endereco] : []),
    ],
    periodo,
    gerado: geradoNoFuso(rel),
    cidade: cidadeDoFuso(rel.local.fusoRotulo),
  });
  desenharResumo(doc, rel, v, p, { rotulo: c.nome, linhas: c.linhas, ...periodoDoCarregador });
  const y = desenharSecaoDoCarregador(doc, rel, c, p, { tituloDaPagina: 'Extrato Detalhado' });
  desenharFim(doc, rel, v, c.linhas, y);

  desenharRodapes(doc);
  return doc;
}

export const nomeDoArquivoDoCarregador = (rel: RelatorioDoLocal, c: CarregadorDoRelatorio) => {
  const de = rel.periodo.escolhido ? rel.periodo.de : (c.linhas[0]?.data ?? null);
  const ate = rel.periodo.escolhido
    ? rel.periodo.ate
    : (c.linhas[c.linhas.length - 1]?.data ?? null);
  return `${nomeDoArquivoDoLocal(c.nome, de, ate)}.pdf`;
};

/** Um PDF por carregador com recarga no período, num .zip. */
export function gerarZipDosCarregadores(
  rel: RelatorioDoLocal,
  v: VisualDaMarca
): Uint8Array<ArrayBuffer> {
  const arquivos = carregadoresDoRelatorio(rel)
    .filter(c => c.linhas.length > 0)
    .map(c => ({
      nome: nomeDoArquivoDoCarregador(rel, c),
      dados: new Uint8Array(gerarPdfDoCarregador(rel, c, v).output('arraybuffer')),
    }));
  return zipSemCompressao(arquivos);
}
