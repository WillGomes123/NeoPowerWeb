import { describe, it, expect } from 'vitest';
import {
  LinhaDoLocal,
  EntradaDoRelatorioDoLocal,
  gerarPdfDoLocal,
  gerarXlsxDoLocal,
  montarRelatorioDoLocal,
  nomeDoArquivoDoLocal,
  fimDaRecarga,
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

  it('PDF: tabela e notas numa página, resumo na outra', () => {
    const doc = gerarPdfDoLocal(montarRelatorioDoLocal(entrada()));
    expect(doc.getNumberOfPages()).toBe(2);
    const pdf = doc.output();
    expect(pdf).toContain('Cantina do Papai');
    expect(pdf).toContain('TOTAL');
  });

  it('zip: CRC-32 e letras de coluna', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect([0, 25, 26, 701, 702].map(letraDaColuna)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
  });
});
