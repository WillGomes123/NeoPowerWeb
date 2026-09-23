import type PptxGenJS from 'pptxgenjs';
import {
  DIAS_SEMANA,
  fmtBRL,
  fmtDataHora,
  fmtInt,
  fmtKwh,
  fmtNum,
  fmtPct,
  fmtVar,
  mesCurto,
  mesPorExtenso,
  nomeDoMes,
  STATUS_META,
  variacaoPct,
  type Carregador,
  type RelatorioMensal,
} from './tipos';

/**
 * Gera a apresentação mensal (.pptx) no navegador, no mesmo roteiro da
 * apresentação de performance feita à mão: visão geral, trajetória, rankings
 * por carregador, ocupação, usuários, bairros, horários, metas, projeção e
 * leituras. Os gráficos são nativos do PowerPoint, então dá para editar depois.
 */

const AZUL = '1B3A52';
const CINZA = '64748B';
const CINZA_CLARO = 'E2E8F0';
const TEXTO = '0F172A';
const VERDE = '16A34A';
const VERMELHO = 'DC2626';
const FONTE = 'Calibri';
const MAX_CARREGADORES = 15;

const corValida = (cor?: string | null) => {
  const hex = String(cor || '')
    .replace('#', '')
    .trim();
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : null;
};

const corVariacao = (v: number | null) => (v === null ? CINZA : v >= 0 ? VERDE : VERMELHO);

export async function exportarApresentacao(
  r: RelatorioMensal,
  opcoes: { empresa: string; corDaMarca?: string | null }
): Promise<void> {
  const { default: Pptx } = await import('pptxgenjs');
  const pptx = new Pptx();
  pptx.layout = 'LAYOUT_WIDE'; // 13,33 x 7,5 pol
  pptx.title = `Performance ${mesPorExtenso(r.mes)} — ${opcoes.empresa}`;
  pptx.company = opcoes.empresa;

  const DESTAQUE = corValida(opcoes.corDaMarca) ?? '22C55E';
  const rotuloMes = mesPorExtenso(r.mes);
  const nomeMesAnterior = nomeDoMes(r.periodoAnterior.ini.slice(0, 7));
  const rodapeTexto = `${opcoes.empresa} · Performance ${rotuloMes}`;
  const fonteTexto = r.fechado
    ? `Fonte: transações ${opcoes.empresa}, ${mesCurto(r.mes).toLowerCase()} (mês fechado)`
    : `Fonte: transações ${opcoes.empresa}, parcial até ${fmtDataHora(r.periodo.fim)} — comparado ao mesmo período de ${nomeMesAnterior}`;
  const refAnterior = r.comparacaoParcial ? `mesmo período de ${nomeMesAnterior}` : nomeMesAnterior;

  const T = (
    s: PptxGenJS.Slide,
    texto: string | PptxGenJS.TextProps[],
    o: PptxGenJS.TextPropsOptions
  ) => s.addText(texto, { fontFace: FONTE, color: TEXTO, margin: 0, ...o });

  const novoSlide = (titulo: string, subtitulo?: string, fonte = fonteTexto) => {
    const s = pptx.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.12,
      h: 7.5,
      fill: { color: DESTAQUE },
      line: { color: DESTAQUE },
    });
    T(s, titulo, { x: 0.6, y: 0.35, w: 12, h: 0.6, fontSize: 28, bold: true, color: AZUL });
    if (subtitulo) T(s, subtitulo, { x: 0.6, y: 0.95, w: 12, h: 0.4, fontSize: 14, color: CINZA });
    if (fonte) T(s, fonte, { x: 0.6, y: 7.05, w: 7.5, h: 0.3, fontSize: 9, color: CINZA });
    T(s, rodapeTexto, {
      x: 8.3,
      y: 7.05,
      w: 4.6,
      h: 0.3,
      fontSize: 9,
      color: CINZA,
      align: 'right',
    });
    return s;
  };

  const kpi = (
    s: PptxGenJS.Slide,
    x: number,
    y: number,
    w: number,
    valor: string,
    rotulo: string,
    variacao?: number | null,
    sufixo = '%'
  ) => {
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w,
      h: 1.25,
      fill: { color: 'F8FAFC' },
      line: { color: CINZA_CLARO },
      rectRadius: 0.08,
    });
    T(s, valor, {
      x: x + 0.2,
      y: y + 0.15,
      w: w - 0.4,
      h: 0.55,
      fontSize: 24,
      bold: true,
      color: AZUL,
      fit: 'shrink',
    });
    T(s, rotulo, { x: x + 0.2, y: y + 0.72, w: w - 0.4, h: 0.3, fontSize: 11, color: CINZA });
    if (variacao !== undefined) {
      T(s, variacao === null ? '—' : `${fmtVar(variacao, sufixo)} vs ${refAnterior}`, {
        x: x + 0.2,
        y: y + 0.97,
        w: w - 0.4,
        h: 0.22,
        fontSize: 9,
        bold: true,
        color: corVariacao(variacao),
      });
    }
  };

  const eixoLimpo: Partial<PptxGenJS.IChartOpts> = {
    valAxisHidden: true,
    valGridLine: { style: 'none' },
    catAxisLabelFontSize: 10,
    catAxisLabelColor: CINZA,
    catAxisLineShow: false,
    showLegend: false,
    showValue: true,
    dataLabelFontSize: 9,
    dataLabelColor: TEXTO,
    dataLabelFontFace: FONTE,
    catAxisLabelFontFace: FONTE,
  };

  // --------------------------------------------------------------- 1. capa
  {
    const s = pptx.addSlide();
    s.background = { color: AZUL };
    s.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 2.35,
      w: 1.2,
      h: 0.08,
      fill: { color: DESTAQUE },
      line: { color: DESTAQUE },
    });
    T(s, `Performance da Rede — ${rotuloMes}`, {
      x: 0.8,
      y: 2.55,
      w: 11.5,
      h: 1,
      fontSize: 40,
      bold: true,
      color: 'FFFFFF',
    });
    T(s, 'Faturamento, recargas, uso dos carregadores e novos motoristas', {
      x: 0.8,
      y: 3.55,
      w: 11.5,
      h: 0.5,
      fontSize: 18,
      color: 'CBD5E1',
    });
    T(
      s,
      r.fechado
        ? `Apresentação interna · ${opcoes.empresa}`
        : `Parcial até ${fmtDataHora(r.periodo.fim)} · ${opcoes.empresa}`,
      {
        x: 0.8,
        y: 6.4,
        w: 11.5,
        h: 0.4,
        fontSize: 14,
        color: 'CBD5E1',
      }
    );
  }

  const { resumo: a, resumoAnterior: b, variacoes: v } = r;

  // --------------------------------------------------------------- 2. visão geral
  {
    const s = novoSlide(
      `Visão geral da rede — ${rotuloMes}`,
      `${a.carregadoresAtivos} carregadores com recarga no período`
    );
    const w = 2.95;
    kpi(s, 0.6, 1.55, w, fmtBRL(a.faturamento), 'Faturamento total', v.faturamento);
    kpi(s, 0.6 + (w + 0.2), 1.55, w, fmtKwh(a.energiaKwh), 'Energia fornecida', v.energiaKwh);
    kpi(s, 0.6 + 2 * (w + 0.2), 1.55, w, fmtInt(a.operacoes), 'Recargas', v.operacoes);
    kpi(
      s,
      0.6 + 3 * (w + 0.2),
      1.55,
      w,
      fmtInt(a.usuariosAtivos),
      'Motoristas atendidos',
      v.usuariosAtivos
    );

    const cab = (t: string, align: 'left' | 'right' = 'right') => ({
      text: t,
      options: { bold: true, color: 'FFFFFF', fill: { color: AZUL }, align },
    });
    const linha = (m: string, ant: string, atu: string, vari: number | null, sufixo = '%') => [
      { text: m, options: { align: 'left' as const } },
      { text: ant, options: { align: 'right' as const } },
      { text: atu, options: { align: 'right' as const, bold: true } },
      {
        text: fmtVar(vari, sufixo),
        options: { align: 'right' as const, bold: true, color: corVariacao(vari) },
      },
    ];
    const tituloAnterior = r.comparacaoParcial ? `${nomeMesAnterior} (parcial)` : nomeMesAnterior;
    s.addTable(
      [
        [
          cab('Métrica', 'left'),
          cab(tituloAnterior.charAt(0).toUpperCase() + tituloAnterior.slice(1)),
          cab(nomeDoMes(r.mes).charAt(0).toUpperCase() + nomeDoMes(r.mes).slice(1)),
          cab('Variação'),
        ],
        linha('Faturamento', fmtBRL(b.faturamento), fmtBRL(a.faturamento), v.faturamento),
        linha('Energia fornecida', fmtKwh(b.energiaKwh), fmtKwh(a.energiaKwh), v.energiaKwh),
        linha('Recargas', fmtInt(b.operacoes), fmtInt(a.operacoes), v.operacoes),
        linha(
          'Motoristas atendidos',
          fmtInt(b.usuariosAtivos),
          fmtInt(a.usuariosAtivos),
          v.usuariosAtivos
        ),
        linha(
          'Novos motoristas',
          fmtInt(b.novosUsuarios),
          fmtInt(a.novosUsuarios),
          v.novosUsuarios
        ),
        linha(
          'Motoristas ativos',
          b.baseAtivaPct === null ? '—' : fmtPct(b.baseAtivaPct),
          a.baseAtivaPct === null ? '—' : fmtPct(a.baseAtivaPct),
          v.baseAtivaPp,
          ' p.p.'
        ),
        linha(
          'Uso dos carregadores',
          fmtPct(b.ocupacaoPct),
          fmtPct(a.ocupacaoPct),
          v.ocupacaoPp,
          ' p.p.'
        ),
        linha(
          'Preço médio (R$/kWh)',
          b.precoMedioKwh === null ? '—' : fmtBRL(b.precoMedioKwh, 2),
          a.precoMedioKwh === null ? '—' : fmtBRL(a.precoMedioKwh, 2),
          v.precoMedioKwh
        ),
        linha(
          'Valor médio por recarga',
          b.ticketMedio === null ? '—' : fmtBRL(b.ticketMedio, 2),
          a.ticketMedio === null ? '—' : fmtBRL(a.ticketMedio, 2),
          v.ticketMedio
        ),
      ],
      {
        x: 0.6,
        y: 3.05,
        w: 8.4,
        colW: [2.8, 1.9, 1.9, 1.8],
        fontFace: FONTE,
        fontSize: 11,
        color: TEXTO,
        rowH: 0.36,
        border: { type: 'solid', color: CINZA_CLARO, pt: 0.75 },
      }
    );

    s.addShape(pptx.ShapeType.roundRect, {
      x: 9.3,
      y: 3.05,
      w: 3.45,
      h: 3.6,
      fill: { color: AZUL },
      line: { color: AZUL },
      rectRadius: 0.1,
    });
    T(s, fmtInt(a.novosUsuarios), {
      x: 9.5,
      y: 3.4,
      w: 3.05,
      h: 0.9,
      fontSize: 48,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
    });
    T(s, `novos motoristas\nconquistados em ${nomeDoMes(r.mes)}`, {
      x: 9.5,
      y: 4.3,
      w: 3.05,
      h: 0.7,
      fontSize: 14,
      color: 'CBD5E1',
      align: 'center',
    });
    T(
      s,
      `Base cresceu de\n${fmtInt(a.baseAcumulada - a.novosUsuarios)} → ${fmtInt(a.baseAcumulada)} motoristas`,
      {
        x: 9.5,
        y: 5.3,
        w: 3.05,
        h: 0.9,
        fontSize: 14,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      }
    );
  }

  // --------------------------------------------------------------- 3. trajetória
  {
    const serie = r.serie;
    const primeiro = serie.find(p => p.operacoes > 0) ?? serie[0];
    const s = novoSlide(
      `A trajetória da ${opcoes.empresa}`,
      `Motoristas, recargas e energia — ${mesCurto(primeiro.mes)} a ${mesCurto(r.mes)}`,
      `Fonte: transações ${opcoes.empresa}, ${mesCurto(serie[0].mes)}–${mesCurto(r.mes)}`
    );
    const totOps = serie.reduce((t, p) => t + p.operacoes, 0);
    const totKwh = serie.reduce((t, p) => t + p.energiaKwh, 0);
    const w = 3.95;
    kpi(s, 0.6, 1.5, w, fmtInt(a.baseAcumulada), `motoristas na base da ${opcoes.empresa}`);
    kpi(s, 0.6 + w + 0.2, 1.5, w, fmtInt(totOps), `recargas nos últimos ${serie.length} meses`);
    kpi(
      s,
      0.6 + 2 * (w + 0.2),
      1.5,
      w,
      fmtKwh(totKwh),
      `energia nos últimos ${serie.length} meses`
    );

    const graficos: Array<{
      titulo: string;
      chave: 'usuariosAtivos' | 'operacoes' | 'energiaKwh';
      vari: number | null;
    }> = [
      { titulo: 'Motoristas no mês', chave: 'usuariosAtivos', vari: v.usuariosAtivos },
      { titulo: 'Recargas no mês', chave: 'operacoes', vari: v.operacoes },
      { titulo: 'Energia fornecida (kWh)', chave: 'energiaKwh', vari: v.energiaKwh },
    ];
    graficos.forEach((g, i) => {
      const x = 0.6 + i * (w + 0.2);
      T(s, g.titulo, { x, y: 3.0, w: w - 1.3, h: 0.35, fontSize: 13, bold: true, color: AZUL });
      T(s, `${fmtVar(g.vari)} ${mesCurto(r.mes).slice(0, 3).toLowerCase()}`, {
        x: x + w - 1.3,
        y: 3.0,
        w: 1.3,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: corVariacao(g.vari),
        align: 'right',
      });
      s.addChart(
        pptx.ChartType.bar,
        [
          {
            name: g.titulo,
            labels: serie.map(p => mesCurto(p.mes)),
            values: serie.map(p => Math.round(p[g.chave])),
          },
        ],
        {
          x,
          y: 3.4,
          w,
          h: 3.5,
          barDir: 'col',
          chartColors: [AZUL],
          ...eixoLimpo,
          dataLabelFontSize: 7,
          catAxisLabelFontSize: 8,
          dataLabelFormatCode: '#,##0',
        }
      );
    });
  }

  // --------------------------------------------------------------- 4-6. rankings
  const ranking = (
    titulo: string,
    subtitulo: string,
    valor: (c: Carregador) => number,
    anterior: (c: Carregador) => number,
    fmt: (n: number) => string,
    formato: string
  ) => {
    const lista = [...r.carregadores].sort((x, y) => valor(y) - valor(x));
    const top = lista.slice(0, MAX_CARREGADORES);
    const s = novoSlide(
      titulo,
      `${subtitulo}${lista.length > MAX_CARREGADORES ? ` · top ${MAX_CARREGADORES} de ${lista.length}` : ''}`
    );
    s.addChart(
      pptx.ChartType.bar,
      [
        {
          name: titulo,
          labels: [...top].reverse().map(c => c.nome),
          values: [...top].reverse().map(valor),
        },
      ],
      {
        x: 0.5,
        y: 1.45,
        w: 7.6,
        h: 5.5,
        barDir: 'bar',
        chartColors: [AZUL],
        ...eixoLimpo,
        dataLabelFormatCode: formato,
        dataLabelPosition: 'outEnd',
      }
    );
    const linhas: PptxGenJS.TableRow[] = [
      [
        { text: 'Carregador', options: { bold: true, color: 'FFFFFF', fill: { color: AZUL } } },
        {
          text: mesCurto(r.mes).slice(0, 3),
          options: { bold: true, color: 'FFFFFF', fill: { color: AZUL }, align: 'right' },
        },
        {
          text: 'vs ant.',
          options: { bold: true, color: 'FFFFFF', fill: { color: AZUL }, align: 'right' },
        },
      ],
      ...top.map(c => {
        const vari = variacaoPct(valor(c), anterior(c));
        return [
          { text: c.nome, options: {} },
          { text: fmt(valor(c)), options: { align: 'right' as const } },
          {
            text: fmtVar(vari),
            options: { align: 'right' as const, bold: true, color: corVariacao(vari) },
          },
        ];
      }),
    ];
    s.addTable(linhas, {
      x: 8.3,
      y: 1.5,
      w: 4.5,
      colW: [2.4, 1.2, 0.9],
      fontFace: FONTE,
      fontSize: top.length > 10 ? 8 : 10,
      color: TEXTO,
      rowH: top.length > 10 ? 0.3 : 0.4,
      border: { type: 'solid', color: CINZA_CLARO, pt: 0.5 },
    });
  };

  ranking(
    'Faturamento por carregador',
    `${rotuloMes} — ranking por receita, com variação vs ${refAnterior}`,
    c => c.faturamento,
    c => c.anterior.faturamento,
    n => fmtBRL(n),
    '"R$ "#,##0'
  );
  ranking(
    'Energia fornecida por carregador',
    `${rotuloMes} — kWh entregues por ponto, com variação vs ${refAnterior}`,
    c => c.energiaKwh,
    c => c.anterior.energiaKwh,
    n => fmtInt(n),
    '#,##0'
  );
  ranking(
    'Recargas por carregador',
    `${rotuloMes} — recargas concluídas, com variação vs ${refAnterior}`,
    c => c.operacoes,
    c => c.anterior.operacoes,
    n => fmtInt(n),
    '#,##0'
  );

  // --------------------------------------------------------------- 7. ocupação
  {
    const lista = [...r.carregadores]
      .sort((x, y) => y.ocupacaoPct - x.ocupacaoPct)
      .slice(0, MAX_CARREGADORES);
    const s = novoSlide(
      'Uso dos carregadores',
      `${rotuloMes} — horas ocupadas ÷ horas disponíveis`
    );
    s.addChart(
      pptx.ChartType.bar,
      [
        {
          name: 'Uso (%)',
          labels: [...lista].reverse().map(c => `${c.nome} (${c.conectores} con.)`),
          values: [...lista].reverse().map(c => c.ocupacaoPct),
        },
      ],
      {
        x: 0.5,
        y: 1.45,
        w: 8,
        h: 5.5,
        barDir: 'bar',
        chartColors: [AZUL],
        ...eixoLimpo,
        dataLabelFormatCode: '0.0"%"',
        dataLabelPosition: 'outEnd',
      }
    );
    const saturados = lista.filter(c => c.ocupacaoPct >= 60);
    s.addShape(pptx.ShapeType.roundRect, {
      x: 8.8,
      y: 1.6,
      w: 4,
      h: 3.9,
      fill: { color: saturados.length ? 'FEF2F2' : 'F0FDF4' },
      line: { color: saturados.length ? 'FCA5A5' : '86EFAC' },
      rectRadius: 0.1,
    });
    T(
      s,
      saturados.length
        ? saturados.length === 1
          ? 'Ponto saturando'
          : 'Pontos saturando'
        : 'Sem saturação',
      {
        x: 9.05,
        y: 1.8,
        w: 3.5,
        h: 0.45,
        fontSize: 18,
        bold: true,
        color: saturados.length ? VERMELHO : VERDE,
      }
    );
    T(
      s,
      saturados.length
        ? `${saturados.map(c => `${c.nome}: ${fmtInt(c.horasOcupadas)}h de ${fmtInt(c.horasDisponiveis)}h (${fmtPct(c.ocupacaoPct)})`).join('\n')}\n\nAcima de 60% já tende a formar fila no pico. Avalie mais conectores ou um ponto próximo.`
        : `Nenhum carregador passou de 60% de uso. Uso médio da rede: ${fmtPct(a.ocupacaoPct)}.`,
      { x: 9.05, y: 2.3, w: 3.5, h: 3.0, fontSize: 12, color: TEXTO, valign: 'top' }
    );
    T(
      s,
      'Base de 24h/dia por conector. Pontos com horário restrito (shopping, loja) têm uso real maior nas horas em que abrem.',
      {
        x: 8.8,
        y: 5.7,
        w: 4,
        h: 0.9,
        fontSize: 10,
        color: CINZA,
        italic: true,
      }
    );
  }

  // --------------------------------------------------------------- 8. usuários
  {
    const lista = [...r.carregadores]
      .sort((x, y) => y.usuarios - x.usuarios)
      .slice(0, MAX_CARREGADORES);
    const s = novoSlide(
      'Motoristas por carregador: total x novos',
      `${rotuloMes} — novos motoristas são quem carregou pela 1ª vez na rede`
    );
    s.addChart(
      pptx.ChartType.bar,
      [
        {
          name: 'Motoristas atendidos',
          labels: [...lista].reverse().map(c => c.nome),
          values: [...lista].reverse().map(c => c.usuarios),
        },
        {
          name: 'Novos motoristas',
          labels: [...lista].reverse().map(c => c.nome),
          values: [...lista].reverse().map(c => c.novosUsuarios),
        },
      ],
      {
        x: 0.5,
        y: 1.45,
        w: 12.3,
        h: 5.5,
        barDir: 'bar',
        barGrouping: 'clustered',
        chartColors: [AZUL, DESTAQUE],
        ...eixoLimpo,
        showLegend: true,
        legendPos: 't',
        legendFontSize: 11,
        dataLabelFormatCode: '#,##0',
        dataLabelPosition: 'outEnd',
      }
    );
  }

  // --------------------------------------------------------------- 9. bairros e horários
  {
    const s = novoSlide(
      'Onde a rede está crescendo',
      `Novos motoristas por bairro e horários de maior uso — ${rotuloMes}`
    );
    const bairros = r.bairros.slice(0, 10);
    if (bairros.length) {
      s.addChart(
        pptx.ChartType.bar,
        [
          {
            name: 'Novos motoristas',
            labels: [...bairros].reverse().map(b => b.bairro),
            values: [...bairros].reverse().map(b => b.novosUsuarios),
          },
        ],
        {
          x: 0.5,
          y: 1.45,
          w: 5.6,
          h: 5.4,
          barDir: 'bar',
          chartColors: [DESTAQUE],
          ...eixoLimpo,
          dataLabelFormatCode: '#,##0',
          dataLabelPosition: 'outEnd',
        }
      );
    }

    T(s, 'Recargas por dia e hora de início', {
      x: 6.4,
      y: 1.45,
      w: 6.4,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: AZUL,
    });
    const max = Math.max(1, ...r.horarios.map(h => h.operacoes));
    const mapa = new Map(r.horarios.map(h => [`${h.dia}-${h.hora}`, h.operacoes]));
    const horas = Array.from({ length: 24 }, (_, h) => h);
    const tabela: PptxGenJS.TableRow[] = [
      [
        { text: '', options: {} },
        ...horas.map(h => ({
          text: h % 3 === 0 ? String(h) : '',
          options: { color: CINZA, align: 'center' as const, fontSize: 7, margin: 0 },
        })),
      ],
      ...DIAS_SEMANA.map((dia, i) => [
        { text: dia, options: { bold: true, color: CINZA } },
        ...horas.map(h => {
          const qtd = mapa.get(`${i + 1}-${h}`) ?? 0;
          const intensidade = qtd / max;
          // Interpola do cinza-claro ao azul da marca conforme o volume.
          const mistura = (c1: number, c2: number) => Math.round(c1 + (c2 - c1) * intensidade);
          const cor = [mistura(0xf1, 0x1b), mistura(0xf5, 0x3a), mistura(0xf9, 0x52)]
            .map(n => n.toString(16).padStart(2, '0'))
            .join('');
          return { text: '', options: { fill: { color: qtd ? cor.toUpperCase() : 'F8FAFC' } } };
        }),
      ]),
    ];
    s.addTable(tabela, {
      x: 6.4,
      y: 1.9,
      w: 6.4,
      colW: [0.64, ...horas.map(() => 0.24)],
      rowH: 0.42,
      fontFace: FONTE,
      fontSize: 8,
      border: { type: 'solid', color: 'FFFFFF', pt: 1 },
    });
    const pico = [...r.horarios].sort((x, y) => y.operacoes - x.operacoes)[0];
    if (pico) {
      T(
        s,
        `Pico: ${DIAS_SEMANA[pico.dia - 1]} às ${pico.hora}h (${fmtInt(pico.operacoes)} recargas iniciadas)`,
        {
          x: 6.4,
          y: 5.4,
          w: 6.4,
          h: 0.35,
          fontSize: 11,
          color: TEXTO,
        }
      );
    }
  }

  // --------------------------------------------------------------- 10. metas
  const numericasDefinidas = r.metas.numericas.filter(n => n.meta !== null);
  if (numericasDefinidas.length || r.metas.itens.length) {
    const s = novoSlide(
      `${rotuloMes} vs. metas`,
      'Como o mês fechou frente ao que a liderança definiu',
      r.fechado ? fonteTexto : `${fonteTexto} · mês em andamento`
    );
    const fmtMeta = (unidade: string, n: number) =>
      unidade === 'R$'
        ? fmtBRL(n)
        : unidade === '%'
          ? fmtPct(n)
          : unidade === 'kWh'
            ? fmtKwh(n)
            : fmtInt(n);
    let y = 1.5;
    if (numericasDefinidas.length) {
      s.addTable(
        [
          ['Indicador', 'Meta', 'Resultado', 'Diferença', 'Situação'].map((t, i) => ({
            text: t,
            options: {
              bold: true,
              color: 'FFFFFF',
              fill: { color: AZUL },
              align: i ? 'right' : 'left',
            },
          })),
          ...numericasDefinidas.map(n => {
            const st = n.avaliacao ? STATUS_META[n.avaliacao.status] : null;
            return [
              { text: n.rotulo, options: {} },
              { text: fmtMeta(n.unidade, n.meta!), options: { align: 'right' as const } },
              {
                text: fmtMeta(n.unidade, n.resultado),
                options: { align: 'right' as const, bold: true },
              },
              {
                text: fmtVar(n.avaliacao?.diferenca ?? null, n.unidade === '%' ? ' p.p.' : '%'),
                options: { align: 'right' as const },
              },
              {
                text: st?.rotulo ?? '—',
                options: { align: 'right' as const, bold: true, color: st?.cor ?? CINZA },
              },
            ];
          }),
        ],
        {
          x: 0.6,
          y,
          w: 12.1,
          colW: [4.3, 2, 2, 1.8, 2],
          fontFace: FONTE,
          fontSize: 12,
          color: TEXTO,
          rowH: 0.38,
          border: { type: 'solid', color: CINZA_CLARO, pt: 0.5 },
        }
      );
      y += 0.38 * (numericasDefinidas.length + 1) + 0.35;
    }
    const itens = r.metas.itens;
    if (itens.length) {
      const cabe = Math.max(3, Math.floor((6.8 - y) / 0.34) - 1);
      s.addTable(
        [
          ['Área', 'Meta', 'Resultado', 'Situação'].map(t => ({
            text: t,
            options: { bold: true, color: 'FFFFFF', fill: { color: AZUL } },
          })),
          ...itens.slice(0, cabe).map(it => [
            { text: it.area, options: { bold: true, color: CINZA } },
            { text: it.descricao, options: {} },
            { text: it.resultado || '—', options: {} },
            {
              text: STATUS_META[it.status].rotulo,
              options: { bold: true, color: STATUS_META[it.status].cor },
            },
          ]),
        ],
        {
          x: 0.6,
          y,
          w: 12.1,
          colW: [2.2, 4.4, 3.9, 1.6],
          fontFace: FONTE,
          fontSize: 10,
          color: TEXTO,
          rowH: 0.34,
          border: { type: 'solid', color: CINZA_CLARO, pt: 0.5 },
        }
      );
      const contagem = (st: string) =>
        itens.filter(i => i.status === st).length +
        numericasDefinidas.filter(n => n.avaliacao?.status === st).length;
      T(
        s,
        `${contagem('bateu')} batidas · ${contagem('nao_bateu')} não batidas · ${contagem('quase')} quase lá · ${contagem('dispensada')} dispensadas${itens.length > cabe ? ` · +${itens.length - cabe} metas não exibidas` : ''}`,
        {
          x: 0.6,
          y: 6.7,
          w: 12.1,
          h: 0.3,
          fontSize: 11,
          bold: true,
          color: AZUL,
        }
      );
    }
  }

  // --------------------------------------------------------------- 11. projeção
  if (r.projecao.base && r.projecao.meses.length) {
    const p = r.projecao;
    const baseMes = r.projecao.base;
    const base = r.serie.find(x => x.mes === baseMes);
    const ultimo = p.meses[p.meses.length - 1];
    const s = novoSlide(
      `Projeção operacional até ${mesCurto(ultimo.mes)}`,
      'Motoristas, recargas e energia — mantendo o ritmo de crescimento observado',
      `Projeção pelo crescimento composto dos últimos meses · ${mesCurto(baseMes)} fechado como base`
    );
    const blocos: Array<{
      chave: 'usuariosAtivos' | 'operacoes' | 'energiaKwh';
      titulo: string;
      rotulo: string;
      fmt: (n: number) => string;
    }> = [
      {
        chave: 'usuariosAtivos',
        titulo: 'Motoristas atendidos',
        rotulo: `motoristas no mês em ${mesCurto(ultimo.mes).toLowerCase()}`,
        fmt: fmtInt,
      },
      {
        chave: 'operacoes',
        titulo: 'Recargas no mês',
        rotulo: `recargas em ${mesCurto(ultimo.mes).toLowerCase()}`,
        fmt: fmtInt,
      },
      {
        chave: 'energiaKwh',
        titulo: 'Energia no mês (kWh)',
        rotulo: `energia no mês em ${mesCurto(ultimo.mes).toLowerCase()}`,
        fmt: n => `${fmtNum(n / 1000, 1)} MWh`,
      },
    ];
    const w = 3.95;
    blocos.forEach((bl, i) => {
      const x = 0.6 + i * (w + 0.2);
      const taxa = p.taxas[bl.chave];
      const final = ultimo[bl.chave];
      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y: 1.5,
        w,
        h: 1.25,
        fill: { color: 'F8FAFC' },
        line: { color: CINZA_CLARO },
        rectRadius: 0.08,
      });
      T(s, final === null ? '—' : bl.fmt(final), {
        x: x + 0.2,
        y: 1.62,
        w: w - 0.4,
        h: 0.55,
        fontSize: 24,
        bold: true,
        color: AZUL,
      });
      T(s, bl.rotulo, { x: x + 0.2, y: 2.17, w: w - 0.4, h: 0.28, fontSize: 11, color: CINZA });
      T(s, taxa === null ? 'sem histórico suficiente' : `${fmtVar(taxa)} ao mês`, {
        x: x + 0.2,
        y: 2.43,
        w: w - 0.4,
        h: 0.25,
        fontSize: 10,
        bold: true,
        color: corVariacao(taxa),
      });
      if (base && final !== null) {
        s.addChart(
          pptx.ChartType.bar,
          [
            {
              name: bl.titulo,
              labels: [mesCurto(baseMes), ...p.meses.map(m => mesCurto(m.mes))],
              values: [
                Math.round(base[bl.chave]),
                ...p.meses.map(m => Math.round(m[bl.chave] ?? 0)),
              ],
            },
          ],
          {
            x,
            y: 3.0,
            w,
            h: 3.9,
            barDir: 'col',
            chartColors: [AZUL],
            ...eixoLimpo,
            dataLabelFormatCode: '#,##0',
            catAxisLabelFontSize: 9,
          }
        );
      }
    });
  }

  // --------------------------------------------------------------- 12. leituras
  if (r.leituras.length) {
    const s = novoSlide(
      'Leituras e próximos passos',
      `O que os dados de ${nomeDoMes(r.mes)} sugerem para o time`,
      'Leituras geradas automaticamente a partir das transações — revise antes de apresentar'
    );
    const cores = { positivo: VERDE, alerta: VERMELHO, info: '0284C7' };
    r.leituras.slice(0, 6).forEach((l, i) => {
      const col = i % 2;
      const lin = Math.floor(i / 2);
      const x = 0.6 + col * 6.15;
      const y = 1.5 + lin * 1.8;
      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 5.95,
        h: 1.6,
        fill: { color: 'F8FAFC' },
        line: { color: CINZA_CLARO },
        rectRadius: 0.08,
      });
      s.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 0.09,
        h: 1.6,
        fill: { color: cores[l.tipo] },
        line: { color: cores[l.tipo] },
      });
      T(s, l.titulo, {
        x: x + 0.3,
        y: y + 0.15,
        w: 5.45,
        h: 0.4,
        fontSize: 15,
        bold: true,
        color: AZUL,
        fit: 'shrink',
      });
      T(s, l.texto, {
        x: x + 0.3,
        y: y + 0.55,
        w: 5.45,
        h: 0.95,
        fontSize: 11,
        color: TEXTO,
        valign: 'top',
        fit: 'shrink',
      });
    });
  }

  const nomeArquivo = `${opcoes.empresa.replace(/[^\w-]+/g, '_')}_Performance_${r.mes}${r.fechado ? '' : '_parcial'}.pptx`;
  await pptx.writeFile({ fileName: nomeArquivo });
}
