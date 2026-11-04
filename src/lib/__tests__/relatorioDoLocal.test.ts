import { describe, it, expect } from 'vitest';
import {
  LinhaDoLocal,
  EntradaDoRelatorioDoLocal,
  carregadoresDoRelatorio,
  gerarXlsxDoLocal,
  marcaDaLinha,
  montarRelatorioDoLocal,
  nomeApresentavel,
  nomeDoArquivoDoLocal,
  nomeDoCarregador,
  notasDoValor,
  relatorioDaApi,
  somarLinhas,
  temSplitNoRelatorio,
  fimDaRecarga,
  conferenciaComProblema,
} from '../relatorioDoLocal';
import { crc32, letraDaColuna } from '../xlsx';

/**
 * Relatório de recargas de um local (PDF e Excel para o dono do local). Os
 * números vêm da API; aqui se confere o conteúdo e os arquivos.
 */

const linha = (n: number, extra: Partial<LinhaDoLocal> = {}): LinhaDoLocal => ({
  numero: n,
  carregador: 'CTPP352/CTPP352',
  data: '02/10/2026',
  horaInicio: '09:35',
  horaFim: '10:26',
  dataFim: '02/10/2026',
  duracaoMin: 51,
  cliente: 'Jose B.',
  tipoDeConta: 'Cliente',
  contaInterna: false,
  energiaKwh: 33.89,
  tarifaKwh: 1.55,
  taxaDeDestrava: null,
  valorCobrado: 52.53,
  valorEstornado: 0,
  debitoCarteira: 52.53,
  conferencia: 'OK',
  diferencaCarteira: 0,
  comissao: 2.63,
  repasse: 49.9,
  situacao: 'Concluída',
  ...extra,
});

const subtotal = (quantidade: number, cobrado: number, comissao: number) => ({
  quantidade,
  energiaKwh: 10,
  valorCobrado: cobrado,
  debitoCarteira: cobrado,
  receita: cobrado,
  comissao,
  repasse: Math.round((cobrado - comissao) * 100) / 100,
  conferidas: quantidade,
});

/** Como a API manda: da recarga mais recente para a mais antiga. */
const entrada = (extra: Partial<EntradaDoRelatorioDoLocal> = {}): EntradaDoRelatorioDoLocal => ({
  local: {
    id: 21,
    nome: 'Cantina do Papai',
    endereco: 'Rua Raimundo Nonato de Castro, 352 - Santo Agostinho - Manaus/AM',
    cidade: 'Manaus',
    estado: 'AM',
    marca: 'neopower-default',
    fuso: 'America/Manaus',
    fusoOrigem: 'estado',
    fusoRotulo: 'Manaus (UTC-4)',
    carregadores: [
      { id: 'CTPP352/CTPP352', descricao: 'Carregador', modelo: 'DC', potenciaKw: 40 },
    ],
  },
  linhas: [
    linha(117, {
      data: '05/10/2026',
      horaInicio: '23:26',
      horaFim: '00:18',
      dataFim: '06/10/2026',
      cliente: 'Henrique',
    }),
    linha(95, { cliente: 'Fabio (NeoPower)', tipoDeConta: 'Interna NeoPower', contaInterna: true }),
    linha(92, {
      data: '01/10/2026',
      horaInicio: '16:52',
      horaFim: '16:52',
      dataFim: '01/10/2026',
      duracaoMin: 0,
      energiaKwh: 0,
      tarifaKwh: null,
      valorCobrado: 0,
      debitoCarteira: null,
      comissao: 0,
      repasse: 0,
      situacao: 'Sem energia',
      cliente: 'William (NeoPower)',
      tipoDeConta: 'Interna NeoPower',
      contaInterna: true,
    }),
    linha(86, {
      data: '01/10/2026',
      horaInicio: '10:22',
      horaFim: '10:22',
      dataFim: '01/10/2026',
      tarifaKwh: 2.35,
      valorCobrado: 0.02,
      debitoCarteira: 0.02,
      comissao: 0,
      repasse: 0.02,
      cliente: 'William (NeoPower)',
      tipoDeConta: 'Interna NeoPower',
      contaInterna: true,
    }),
  ],
  subtotais: {
    todas: subtotal(4, 143.23, 5.26),
    clientes: subtotal(1, 52.53, 2.63),
    internas: subtotal(3, 90.7, 2.63),
  },
  comissaoPercent: 5,
  repassePercent: 95,
  criterioContaInterna: 'admin ou operador da NeoPower',
  inicio: '2026-10-01',
  fim: '2026-10-07',
  geradoEm: new Date(2026, 9, 7, 17, 0),
  ...extra,
});

describe('nome do arquivo', () => {
  it('Relatorio_<Local>_<dd-mm>_a_<dd-mm-aaaa>', () => {
    expect(nomeDoArquivoDoLocal('Cantina do Papai', '01/10/2026', '07/10/2026')).toBe(
      'Relatorio_Cantina_do_Papai_01-10_a_07-10-2026'
    );
    expect(nomeDoArquivoDoLocal('São José / Bloco B', '01/10/2026', '07/10/2026')).toBe(
      'Relatorio_Sao_Jose_Bloco_B_01-10_a_07-10-2026'
    );
  });

  it('anos diferentes levam o ano nas duas pontas', () => {
    expect(nomeDoArquivoDoLocal('Cantina', '15/12/2026', '10/01/2027')).toBe(
      'Relatorio_Cantina_15-12-2026_a_10-01-2027'
    );
  });
});

describe('montarRelatorioDoLocal', () => {
  it('título, cabeçalho com endereço, carregador, período e fuso', () => {
    const rel = montarRelatorioDoLocal(entrada());
    expect(rel.titulo).toBe('Relatório de recargas — Cantina do Papai');
    expect(rel.cabecalho).toEqual([
      'Rua Raimundo Nonato de Castro, 352 - Santo Agostinho - Manaus/AM · Carregador CTPP352/CTPP352 (40 kW)',
      'Período: 01/10/2026 a 07/10/2026 · horários de Manaus (UTC-4) · gerado em 07/10/2026',
    ]);
    expect(rel.regraDoRepasse).toContain('5% da NeoPower');
    expect(rel.regraDoRepasse).toContain('Repasse ao local = valor cobrado - comissão (95%');
    expect(rel.nomeDoArquivo).toBe('Relatorio_Cantina_do_Papai_01-10_a_07-10-2026');
    expect(rel.tituloDoResumo).toBe('Resumo — Cantina do Papai (01/10 a 07/10/2026)');
  });

  it('recargas da primeira para a última e as colunas do modelo', () => {
    const rel = montarRelatorioDoLocal(entrada());
    expect(rel.linhas.map(l => l.numero)).toEqual([86, 92, 95, 117]);
    expect(rel.colunas.map(c => c.titulo)).toEqual([
      'Nº recarga',
      'Data',
      'Início',
      'Fim',
      'Duração (min)',
      'Cliente',
      'Tipo de conta',
      'Energia (kWh)',
      'Tarifa (R$/kWh)',
      'Valor cobrado (R$)',
      'Débito na carteira (R$)',
      'Conferência',
      'Comissão NeoPower (R$)',
      'Repasse ao local (R$)',
      'Situação',
    ]);
    const texto = (n: number) => {
      const l = rel.linhas.find(x => x.numero === n)!;
      return Object.fromEntries(rel.colunas.map(c => [c.chave, c.texto(l)]));
    };
    expect(texto(92)).toMatchObject({
      energia: '0,00',
      tarifa: '-',
      cobrado: '-',
      debito: '-',
      conferencia: 'OK',
      comissao: '-',
      repasse: '-',
      situacao: 'Sem energia',
    });
    expect(texto(86)).toMatchObject({ comissao: '-', repasse: 'R$ 0,02', tarifa: 'R$ 2,35' });
    expect(texto(117).fim).toBe('00:18 (06/10)');
  });

  it('com mais de um carregador, entra a coluna Carregador', () => {
    const e = entrada();
    e.local.carregadores.push({ id: 'CP2', descricao: null, modelo: null, potenciaKw: null });
    const rel = montarRelatorioDoLocal(e);
    expect(rel.colunas.map(c => c.chave)).toContain('carregador');
    expect(rel.cabecalho[0]).toContain('Carregadores CTPP352/CTPP352 (40 kW), CP2');
  });

  it('subtotais: todas, só clientes e só internas', () => {
    const rel = montarRelatorioDoLocal(entrada());
    expect(rel.subtotais.map(s => [s.rotulo, s.conferencia])).toEqual([
      ['TOTAL — todas as recargas', '4 de 4 OK'],
      ['Só clientes', '1 recarga'],
      ['Só contas internas NeoPower', '3 recargas'],
    ]);
  });

  it('notas: valor × débito, tarifas do período, contas internas, sem energia e LGPD', () => {
    const rel = montarRelatorioDoLocal(entrada());
    expect(rel.notas[0]).toMatch(/^Valor cobrado: o que o sistema cobrou/);
    expect(rel.notas).toContain('Tarifa: R$ 2,35/kWh em 01/10; R$ 1,55/kWh de 02/10 a 05/10.');
    expect(rel.notas.some(n => n.startsWith('Contas internas NeoPower (linhas em laranja)'))).toBe(
      true
    );
    expect(rel.notas.some(n => n.includes('critério: admin ou operador da NeoPower'))).toBe(true);
    expect(rel.notas).toContain('Recargas sem energia (0 kWh) não têm cobrança.');
    expect(rel.notas[rel.notas.length - 1]).toContain('(LGPD)');
    // Conferência toda OK: sem o aviso.
    expect(rel.notas.some(n => n.startsWith('Atenção'))).toBe(false);
  });

  it('avisa quando o débito na carteira não bate com o valor cobrado', () => {
    const e = entrada();
    e.linhas[0] = { ...e.linhas[0], debitoCarteira: null, conferencia: 'Sem débito' };
    const rel = montarRelatorioDoLocal(e);
    expect(rel.notas).toContain(
      'Atenção: 1 recarga sem débito na carteira ou com diferença (coluna Conferência). Confira antes de pagar o repasse.'
    );
  });

  it('recarga da Spott (histórico importado) não é pendência: vira nota própria', () => {
    const e = entrada();
    e.linhas[0] = { ...e.linhas[0], debitoCarteira: null, conferencia: 'Spott' };
    const rel = montarRelatorioDoLocal(e);
    expect(rel.notas.some(n => n.startsWith('Atenção'))).toBe(false);
    expect(rel.notas.some(n => n.startsWith('Spott: 1 recarga do histórico'))).toBe(true);
    expect(conferenciaComProblema({ conferencia: 'Spott' })).toBe(false);
    expect(conferenciaComProblema({ conferencia: 'Sem débito' })).toBe(true);
  });

  it('sem período escolhido, usa as datas das recargas', () => {
    const rel = montarRelatorioDoLocal(entrada({ inicio: null, fim: null }));
    expect(rel.periodo).toEqual({ de: '01/10/2026', ate: '05/10/2026', escolhido: false });
    expect(rel.cabecalho[1]).toMatch(/^Todo o período: 01\/10\/2026 a 05\/10\/2026/);
    expect(rel.nomeDoArquivo).toBe('Relatorio_Cantina_do_Papai_01-10_a_05-10-2026');
  });

  it('fim no mesmo dia não repete a data', () => {
    expect(fimDaRecarga(linha(1))).toBe('10:26');
  });
});

describe('nomes no relatório', () => {
  it('nome todo em maiúsculas fica legível; o resto é respeitado', () => {
    expect(nomeApresentavel('CONDOMÍNIO MORADA DOS PRÍNCIPES')).toBe('Condomínio Morada dos Príncipes');
    expect(nomeApresentavel('POSTO BR 01')).toBe('Posto BR 01');
    expect(nomeApresentavel('ArtVille 01')).toBe('ArtVille 01');
    expect(nomeApresentavel('  Cantina   do Papai ')).toBe('Cantina do Papai');
  });

  it('carregador: tira "Carregador" da frente e, sem descrição, usa o ID', () => {
    expect(nomeDoCarregador('X', 'Carregador DIAMOND 04')).toBe('Diamond 04');
    expect(nomeDoCarregador('X', 'CARPE DIEM 02')).toBe('Carpe Diem 02');
    expect(nomeDoCarregador('CTPP352', 'Carregador')).toBe('CTPP352');
    expect(nomeDoCarregador('CTPP352', null)).toBe('CTPP352');
  });

  it('o arquivo sai com o nome legível do local', () => {
    const e = entrada();
    e.local.nome = 'CONDOMÍNIO DIAMOND';
    const rel = montarRelatorioDoLocal(e);
    expect(rel.nomeDoLocal).toBe('Condomínio Diamond');
    expect(rel.nomeDoArquivo).toBe('Relatorio_Condominio_Diamond_01-10_a_07-10-2026');
  });
});

describe('por carregador', () => {
  const comDois = () => {
    const e = entrada();
    e.local.carregadores = [
      { id: 'B', descricao: 'Carregador DIAMOND 10', modelo: null, potenciaKw: 22 },
      { id: 'A', descricao: 'DIAMOND 02', modelo: null, potenciaKw: 22 },
      { id: 'VAZIO', descricao: 'DIAMOND 03', modelo: null, potenciaKw: 22 },
    ];
    e.linhas = [
      linha(1, { carregador: 'B' }),
      linha(2, { carregador: 'A', receita: 10, comissao: 0.5, repasse: 9.5, recebidoNoSplit: 4, aRepassar: 5.5 }),
      linha(3, { carregador: 'A', receita: 20.01, comissao: 1, repasse: 19.01 }),
      linha(4, { carregador: 'SAIU' }),
    ];
    return montarRelatorioDoLocal(e);
  };

  it('ordena pelo número do nome e cada recarga fica em um carregador só', () => {
    const lista = carregadoresDoRelatorio(comDois());
    expect(lista.map(c => c.nome)).toEqual(['Diamond 02', 'Diamond 03', 'Diamond 10', 'SAIU']);
    expect(lista.map(c => c.linhas.length)).toEqual([2, 0, 1, 1]);
  });

  it('soma as linhas; sem split, a NeoPower repassa tudo', () => {
    const a = carregadoresDoRelatorio(comDois())[0];
    expect(somarLinhas(a.linhas)).toMatchObject({
      quantidade: 2,
      receita: 30.01,
      comissao: 1.5,
      repasse: 28.51,
      recebidoNoSplit: 4,
      aRepassar: 24.51,
    });
  });
});

describe('marca da linha (por que o valor não é kWh × tarifa)', () => {
  const m = (extra: Partial<LinhaDoLocal>) =>
    marcaDaLinha(linha(1, { energiaKwh: 10, tarifaKwh: 1.5, taxaDeDestrava: 3, ...extra }));

  it('conta exata não tem marca', () => {
    expect(m({ valorCobrado: 18 })).toBe('');
    expect(m({ valorCobrado: 18.05 })).toBe('');
  });
  it('S: energia sem cobrança; 0 kWh sem cobrança não tem marca', () => {
    expect(m({ valorCobrado: 0 })).toBe('S');
    expect(m({ valorCobrado: 0, energiaKwh: 0 })).toBe('');
  });
  it('C: continuação, sem a destrava', () => {
    expect(m({ valorCobrado: 15 })).toBe('C');
  });
  it('M: valor redondo acima da conta (mínimo por recarga)', () => {
    expect(m({ energiaKwh: 0.5, valorCobrado: 30 })).toBe('M');
  });
  it('P: preço diferente do mostrado na tarifa', () => {
    expect(m({ valorCobrado: 25.37 })).toBe('P');
  });
  it('sem tarifa (histórico da Spott) não há o que comparar', () => {
    expect(m({ tarifaKwh: null, valorCobrado: 40 })).toBe('');
  });
});

describe('notas do PDF', () => {
  it('só explica o que aparece nas recargas do arquivo', () => {
    const rel = montarRelatorioDoLocal(entrada());
    const simples = notasDoValor(rel, [linha(1, { valorCobrado: 52.53 })], null);
    expect(simples.join(' ')).not.toMatch(/\*\*(M|P|C|S):\*\*/);
    expect(simples.join(' ')).not.toContain('Já no split');
    const comMarcas = notasDoValor(
      rel,
      [linha(1, { energiaKwh: 0.5, tarifaKwh: 1.5, valorCobrado: 30 }), linha(2, { valorCobrado: 0 })],
      null
    );
    expect(comMarcas.some(n => n.startsWith('**M:**'))).toBe(true);
    expect(comMarcas.some(n => n.startsWith('**S:**'))).toBe(true);
    expect(comMarcas.some(n => n.startsWith('**P:**'))).toBe(false);
  });

  it('com split ativo, diz de quem é a conta e desde quando', () => {
    const rel = montarRelatorioDoLocal(entrada({ split: { ativo: true, desde: '2026-10-29T15:06:00Z' } }));
    expect(temSplitNoRelatorio(rel)).toBe(true);
    const nota = notasDoValor(rel, rel.linhas, 'Vip Energy').find(n => n.startsWith('**Já no split'));
    expect(nota).toContain('conta Mercado Pago da Vip Energy (split ativo desde 29/10/2026)');
  });

  it('contas internas, pendência e Spott continuam avisados', () => {
    const rel = montarRelatorioDoLocal(entrada());
    const notas = notasDoValor(
      rel,
      [
        linha(1, { contaInterna: true }),
        linha(2, { debitoCarteira: null, conferencia: 'Sem débito' }),
        linha(3, { conferencia: 'Spott' }),
      ],
      null
    );
    expect(notas.some(n => n.includes('Contas internas NeoPower (linhas em laranja)'))).toBe(true);
    expect(notas.some(n => n.startsWith('**Atenção:** 1 recarga sem débito'))).toBe(true);
    expect(notas.some(n => n.startsWith('**Spott:** 1 recarga'))).toBe(true);
  });
});

describe('relatorioDaApi', () => {
  it('sem o local na resposta (API antiga), não há relatório', () => {
    expect(relatorioDaApi({ items: [] }, null, null)).toBeNull();
  });
  it('fica só com as linhas de recarga e guarda o split', () => {
    const e = entrada();
    const rel = relatorioDaApi(
      {
        items: [...e.linhas, { Estação: 'sem número' }],
        local: e.local,
        porTipoDeConta: e.subtotais,
        comissaoPercent: 5,
        repasse: { repassePercent: 95, split: { ativo: true, desde: null } },
      },
      '2026-10-01',
      '2026-10-07'
    );
    expect(rel?.linhas).toHaveLength(4);
    expect(rel?.split).toEqual({ ativo: true, desde: null });
    expect(rel?.periodo.escolhido).toBe(true);
  });
});

describe('comissão oculta (operadores de Manaus)', () => {
  const SINAIS = /comiss|repasse|repassa|\b95\s?%|\b5\s?%/i;
  const oculto = () => montarRelatorioDoLocal(entrada({ comissaoOculta: true }));

  it('sem as colunas de comissão e repasse', () => {
    const chaves = oculto().colunas.map(c => c.chave);
    expect(chaves).toContain('cobrado');
    expect(chaves).not.toContain('comissao');
    expect(chaves).not.toContain('repasse');
  });

  it('sem nenhum texto que entregue o percentual', () => {
    const r = oculto();
    const textos = [
      r.regraDoRepasse,
      ...r.cabecalho,
      ...r.explicacoes,
      ...r.notas,
      ...r.notasDoResumo,
      ...notasDoValor(r, r.linhas, null),
      ...r.colunas.map(c => c.titulo),
    ];
    expect(textos.join(' | ')).not.toMatch(SINAIS);
  });

  it('o Excel sai sem comissão e repasse', () => {
    const texto = new TextDecoder().decode(gerarXlsxDoLocal(oculto()));
    expect(texto).toContain('TOTAL — todas as recargas');
    expect(texto).not.toMatch(/comiss|repasse/i);
  });

  it('quem vê a comissão não muda', () => {
    const chaves = montarRelatorioDoLocal(entrada()).colunas.map(c => c.chave);
    expect(chaves).toContain('comissao');
    expect(chaves).toContain('repasse');
  });

  it('a marca da API chega ao relatório', () => {
    const r = relatorioDaApi(
      {
        comissaoOculta: true,
        local: entrada().local,
        items: entrada().linhas,
        porTipoDeConta: entrada().subtotais,
      },
      '2026-10-01',
      '2026-10-07'
    );
    expect(r?.comissaoOculta).toBe(true);
    expect(r?.colunas.map(c => c.chave)).not.toContain('comissao');
  });
});

describe('arquivos', () => {
  it('Excel: .xlsx de verdade, com as duas abas e números somáveis', () => {
    const bytes = gerarXlsxDoLocal(montarRelatorioDoLocal(entrada()));
    // Zip ("PK\x03\x04") sem compressão: o XML aparece em texto.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const texto = new TextDecoder().decode(bytes);
    expect(texto).toContain('[Content_Types].xml');
    expect(texto).toContain('<sheet name="Recargas" sheetId="1" r:id="rId1"/>');
    expect(texto).toContain('<sheet name="Resumo" sheetId="2" r:id="rId2"/>');
    expect(texto).toContain('Relatório de recargas — Cantina do Papai');
    expect(texto).toContain('TOTAL — todas as recargas');
    expect(texto).toContain('<v>143.23</v>');
    expect(texto).toContain(
      'formatCode="&quot;R$&quot; #,##0.00;-&quot;R$&quot; #,##0.00;&quot;-&quot;"'
    );
    // Linha interna com fundo laranja.
    expect(texto).toContain('<fgColor rgb="FFFCE4D6"/>');
  });

  it('zip: CRC-32 e letras de coluna', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect([0, 25, 26, 701, 702].map(letraDaColuna)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
  });
});
