/**
 * Gerador mínimo de planilha .xlsx (Office Open XML), sem dependência.
 *
 * O painel não tem biblioteca de planilha, e o .xls em XML do exportToExcel
 * abre no Excel com o aviso de "formato e extensão não coincidem" — ruim
 * para um arquivo que vai para fora (o relatório do dono do local). Aqui sai
 * um .xlsx de verdade: um zip sem compressão (método "store") com o mínimo
 * que o Excel, o LibreOffice e o Google Planilhas exigem.
 *
 * Suporta texto, número com formato, negrito/itálico/cor, fundo, borda fina,
 * alinhamento, quebra de linha, largura de coluna, altura de linha, células
 * mescladas e página em paisagem ajustada à largura.
 */

export interface EstiloXlsx {
  negrito?: boolean;
  italico?: boolean;
  /** Tamanho da fonte em pontos (padrão 11). */
  tamanho?: number;
  /** Cor da fonte, RRGGBB. */
  cor?: string;
  /** Cor de fundo, RRGGBB. */
  fundo?: string;
  borda?: boolean;
  /** Código de formato numérico do Excel, ex.: '#,##0.00'. */
  formato?: string;
  alinhar?: 'left' | 'center' | 'right';
  quebrar?: boolean;
}

export type ValorXlsx = string | number | null | undefined;

export interface CelulaXlsx {
  valor: ValorXlsx;
  estilo?: EstiloXlsx;
}

export interface AbaXlsx {
  /** Até 31 caracteres, sem []:*?/\ (o Excel recusa). */
  nome: string;
  linhas: Array<Array<CelulaXlsx | ValorXlsx>>;
  /** Largura de cada coluna, em caracteres. */
  larguras?: number[];
  /** Intervalos mesclados, ex.: 'A1:O1'. */
  mesclas?: string[];
  /** Altura em pontos por número da linha (1 = primeira). */
  alturas?: Record<number, number>;
  /** Página em paisagem, ajustada à largura (padrão: sim). */
  paisagem?: boolean;
}

// ─── XML ─────────────────────────────────────────────────────────────────────

const escapar = (t: string) =>
  t
    // Caracteres de controle (fora tab e quebras de linha) não valem em XML 1.0.
    .replace(/[^\t\n\r\u0020-\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 0 → A, 25 → Z, 26 → AA. */
export function letraDaColuna(indice: number): string {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Formatos que o Excel já tem embutidos (não vão para <numFmts>). */
const FORMATOS_EMBUTIDOS: Record<string, number> = {
  '0': 1,
  '0.00': 2,
  '#,##0': 3,
  '#,##0.00': 4,
};

class Estilos {
  private fontes = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
  // As duas primeiras são obrigatórias (none e gray125), nessa ordem.
  private fundos = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  private bordas = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  private formatos: string[] = [];
  private xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private cache = new Map<string, number>();

  private posicao(lista: string[], xml: string): number {
    const i = lista.indexOf(xml);
    if (i >= 0) return i;
    lista.push(xml);
    return lista.length - 1;
  }

  indice(e?: EstiloXlsx): number {
    if (!e) return 0;
    const chave = JSON.stringify(e);
    const existente = this.cache.get(chave);
    if (existente != null) return existente;

    const fonte =
      '<font>' +
      (e.negrito ? '<b/>' : '') +
      (e.italico ? '<i/>' : '') +
      `<sz val="${e.tamanho ?? 11}"/>` +
      (e.cor ? `<color rgb="FF${e.cor}"/>` : '') +
      '<name val="Calibri"/><family val="2"/></font>';
    const fontId = this.posicao(this.fontes, fonte);
    const fillId = e.fundo
      ? this.posicao(
          this.fundos,
          `<fill><patternFill patternType="solid"><fgColor rgb="FF${e.fundo}"/><bgColor indexed="64"/></patternFill></fill>`
        )
      : 0;
    const lado = (nome: string) => `<${nome} style="thin"><color rgb="FFBFBFBF"/></${nome}>`;
    const borderId = e.borda
      ? this.posicao(
          this.bordas,
          `<border>${lado('left')}${lado('right')}${lado('top')}${lado('bottom')}<diagonal/></border>`
        )
      : 0;
    let numFmtId = 0;
    if (e.formato) {
      numFmtId = FORMATOS_EMBUTIDOS[e.formato] ?? 164 + this.posicao(this.formatos, e.formato);
    }
    const alinhamento =
      e.alinhar || e.quebrar
        ? `<alignment${e.alinhar ? ` horizontal="${e.alinhar}"` : ''} vertical="center"${
            e.quebrar ? ' wrapText="1"' : ''
          }/>`
        : '';
    const atributos =
      `numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
      (numFmtId ? ' applyNumberFormat="1"' : '') +
      (fontId ? ' applyFont="1"' : '') +
      (fillId ? ' applyFill="1"' : '') +
      (borderId ? ' applyBorder="1"' : '') +
      (alinhamento ? ' applyAlignment="1"' : '');
    const xf = alinhamento ? `<xf ${atributos}>${alinhamento}</xf>` : `<xf ${atributos}/>`;
    const indice = this.posicao(this.xfs, xf);
    this.cache.set(chave, indice);
    return indice;
  }

  xml(): string {
    const formatos = this.formatos.length
      ? `<numFmts count="${this.formatos.length}">${this.formatos
          .map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escapar(f)}"/>`)
          .join('')}</numFmts>`
      : '';
    return (
      XML +
      `<styleSheet xmlns="${NS_MAIN}">` +
      formatos +
      `<fonts count="${this.fontes.length}">${this.fontes.join('')}</fonts>` +
      `<fills count="${this.fundos.length}">${this.fundos.join('')}</fills>` +
      `<borders count="${this.bordas.length}">${this.bordas.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  }
}

function xmlDaAba(aba: AbaXlsx, estilos: Estilos, primeira: boolean): string {
  const linhas = aba.linhas
    .map((linha, i) => {
      const r = i + 1;
      const celulas = linha
        .map((bruta, c) => {
          const cel: CelulaXlsx =
            bruta != null && typeof bruta === 'object' ? bruta : { valor: bruta };
          const s = estilos.indice(cel.estilo);
          const ref = `${letraDaColuna(c)}${r}`;
          const atributoEstilo = s ? ` s="${s}"` : '';
          const v = cel.valor;
          if (v == null || v === '') return s ? `<c r="${ref}"${atributoEstilo}/>` : '';
          if (typeof v === 'number') {
            return `<c r="${ref}"${atributoEstilo}><v>${Number.isFinite(v) ? v : 0}</v></c>`;
          }
          return `<c r="${ref}"${atributoEstilo} t="inlineStr"><is><t xml:space="preserve">${escapar(
            String(v)
          )}</t></is></c>`;
        })
        .join('');
      const altura = aba.alturas?.[r];
      return `<row r="${r}"${altura ? ` ht="${altura}" customHeight="1"` : ''}>${celulas}</row>`;
    })
    .join('');
  const colunas = aba.larguras?.length
    ? `<cols>${aba.larguras
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';
  const mesclas = aba.mesclas?.length
    ? `<mergeCells count="${aba.mesclas.length}">${aba.mesclas
        .map(m => `<mergeCell ref="${m}"/>`)
        .join('')}</mergeCells>`
    : '';
  const paisagem = aba.paisagem !== false;
  return (
    XML +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<sheetViews><sheetView${primeira ? ' tabSelected="1"' : ''} workbookViewId="0"/></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    colunas +
    `<sheetData>${linhas}</sheetData>` +
    mesclas +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    `<pageSetup paperSize="9" orientation="${paisagem ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>` +
    '</worksheet>'
  );
}

/** Nome de aba aceito pelo Excel. */
function nomeDeAba(nome: string, usados: Set<string>): string {
  let base =
    nome
      .replace(/[[\]:*?/\\]/g, ' ')
      .trim()
      .slice(0, 31) || 'Planilha';
  let n = 2;
  let final = base;
  while (usados.has(final.toLowerCase())) {
    const sufixo = ` (${n++})`;
    base = base.slice(0, 31 - sufixo.length);
    final = base + sufixo;
  }
  usados.add(final.toLowerCase());
  return final;
}

export function gerarXlsx(abas: AbaXlsx[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const estilos = new Estilos();
  const usados = new Set<string>();
  const nomes = abas.map(a => nomeDeAba(a.nome, usados));
  // As abas primeiro: são elas que registram os estilos usados.
  const planilhas = abas.map((aba, i) => xmlDaAba(aba, estilos, i === 0));

  const arquivos: Array<{ nome: string; conteudo: string }> = [
    {
      nome: '[Content_Types].xml',
      conteudo:
        XML +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        planilhas
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    },
    {
      nome: '_rels/.rels',
      conteudo:
        XML +
        `<Relationships xmlns="${NS_PKG}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>',
    },
    {
      nome: 'xl/workbook.xml',
      conteudo:
        XML +
        `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
        '<bookViews><workbookView/></bookViews>' +
        `<sheets>${nomes
          .map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('')}</sheets>` +
        '</workbook>',
    },
    {
      nome: 'xl/_rels/workbook.xml.rels',
      conteudo:
        XML +
        `<Relationships xmlns="${NS_PKG}">` +
        planilhas
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
          )
          .join('') +
        `<Relationship Id="rId${planilhas.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    },
    { nome: 'xl/styles.xml', conteudo: estilos.xml() },
    ...planilhas.map((conteudo, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo })),
  ];
  return zipSemCompressao(arquivos.map(a => ({ nome: a.nome, dados: enc.encode(a.conteudo) })));
}

// ─── Zip (método store) ──────────────────────────────────────────────────────

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipSemCompressao(
  arquivos: Array<{ nome: string; dados: Uint8Array }>,
  quando: Date = new Date()
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const hora =
    (quando.getHours() << 11) | (quando.getMinutes() << 5) | Math.floor(quando.getSeconds() / 2);
  const data =
    ((Math.max(1980, quando.getFullYear()) - 1980) << 9) |
    ((quando.getMonth() + 1) << 5) |
    quando.getDate();

  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;
  for (const arq of arquivos) {
    const nome = enc.encode(arq.nome);
    const crc = crc32(arq.dados);
    const tamanho = arq.dados.length;

    const local = new Uint8Array(30 + nome.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true); // versão necessária
    vl.setUint16(6, 0x0800, true); // nomes em UTF-8
    vl.setUint16(8, 0, true); // store
    vl.setUint16(10, hora, true);
    vl.setUint16(12, data, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, tamanho, true);
    vl.setUint32(22, tamanho, true);
    vl.setUint16(26, nome.length, true);
    vl.setUint16(28, 0, true);
    local.set(nome, 30);

    const cd = new Uint8Array(46 + nome.length);
    const vc = new DataView(cd.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, 0, true);
    vc.setUint16(12, hora, true);
    vc.setUint16(14, data, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, tamanho, true);
    vc.setUint32(24, tamanho, true);
    vc.setUint16(28, nome.length, true);
    vc.setUint32(42, deslocamento, true);
    cd.set(nome, 46);

    partes.push(local, arq.dados);
    central.push(cd);
    deslocamento += local.length + tamanho;
  }
  const tamanhoCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const vf = new DataView(fim.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, arquivos.length, true);
  vf.setUint16(10, arquivos.length, true);
  vf.setUint32(12, tamanhoCentral, true);
  vf.setUint32(16, deslocamento, true);

  const total = deslocamento + tamanhoCentral + fim.length;
  const saida = new Uint8Array(total);
  let p = 0;
  for (const parte of [...partes, ...central, fim]) {
    saida.set(parte, p);
    p += parte.length;
  }
  return saida;
}
