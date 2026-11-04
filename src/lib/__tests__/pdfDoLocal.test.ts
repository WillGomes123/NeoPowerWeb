import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  VisualDaMarca,
  gerarPdfDoCarregador,
  gerarPdfDoLocal,
  gerarZipDosCarregadores,
  nomeDoArquivoDoCarregador,
} from '../pdfDoLocal';
import {
  EntradaDoRelatorioDoLocal,
  LinhaDoLocal,
  carregadoresDoRelatorio,
  montarRelatorioDoLocal,
} from '../relatorioDoLocal';

vi.mock('../api', () => ({ api: { get: vi.fn() } }));

/**
 * PDF do relatório do local (capa, resumo, extrato). O texto vai com a fonte
 * embutida, que não aparece legível no arquivo: aqui se confere a estrutura,
 * e o conteúdo é conferido nos testes de relatorioDoLocal.
 */

const VISUAL: VisualDaMarca = { nome: 'Vip Energy', cor: '#2b00ff', logo: null };

const linha = (n: number, extra: Partial<LinhaDoLocal> = {}): LinhaDoLocal => ({
  numero: n,
  carregador: 'A',
  data: '02/10/2026',
  horaInicio: '09:35',
  horaFim: '10:26',
  dataFim: '02/10/2026',
  duracaoMin: 51,
  cliente: 'Jose B.',
  tipoDeConta: 'Cliente',
  contaInterna: false,
  energiaKwh: 10,
  tarifaKwh: 1.5,
  taxaDeDestrava: 3,
  valorCobrado: 18,
  valorEstornado: 0,
  receita: 18,
  debitoCarteira: 18,
  conferencia: 'OK',
  diferencaCarteira: 0,
  comissao: 0.9,
  repasse: 17.1,
  recebidoNoSplit: 0,
  aRepassar: 17.1,
  situacao: 'Concluída',
  ...extra,
});

const subtotal = {
  quantidade: 0,
  energiaKwh: 0,
  valorCobrado: 0,
  debitoCarteira: 0,
  receita: 0,
  comissao: 0,
  repasse: 0,
  conferidas: 0,
};

const entrada = (
  linhas: LinhaDoLocal[],
  extra: Partial<EntradaDoRelatorioDoLocal> = {}
): EntradaDoRelatorioDoLocal => ({
  local: {
    id: 47,
    nome: 'CONDOMÍNIO DIAMOND',
    endereco: 'Rua Jardim Alto do Itaigara, 94 - Itaigara - Salvador/BA',
    cidade: 'Salvador',
    estado: 'BA',
    marca: 'vipenergy',
    fuso: 'America/Bahia',
    fusoOrigem: 'estado',
    fusoRotulo: 'Salvador (UTC-3)',
    carregadores: [
      { id: 'A', descricao: 'DIAMOND 01', modelo: null, potenciaKw: 22 },
      { id: 'B', descricao: 'Carregador DIAMOND 02', modelo: null, potenciaKw: 22 },
      { id: 'C', descricao: 'DIAMOND 03', modelo: null, potenciaKw: 22 },
    ],
  },
  linhas,
  subtotais: { todas: subtotal, clientes: subtotal, internas: subtotal },
  comissaoPercent: 5,
  repassePercent: 95,
  geradoEm: new Date('2026-11-03T15:45:00Z'),
  ...extra,
});

const orientacoes = (doc: jsPDF) => {
  const lista: string[] = [];
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    lista.push(
      doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight() ? 'paisagem' : 'retrato'
    );
  }
  return lista;
};

const titulo = (doc: jsPDF) => {
  const m = /\/Title \(([^)]*)\)/.exec(doc.output());
  return m?.[1] ?? '';
};

describe('PDF com a comissão oculta (operadores de Manaus)', () => {
  it('sai com as mesmas páginas, sem quebrar com menos colunas e cartões', () => {
    const linhas = [linha(1), linha(2, { carregador: 'A' })];
    const visivel = gerarPdfDoLocal(montarRelatorioDoLocal(entrada(linhas)), VISUAL);
    // Como a API manda para essas contas: as linhas vêm sem comissão e repasse.
    const semValores = linhas.map(l => {
      const { comissao: _c, repasse: _r, ...resto } = l;
      return resto as LinhaDoLocal;
    });
    const oculto = gerarPdfDoLocal(
      montarRelatorioDoLocal(entrada(semValores, { comissaoOculta: true })),
      VISUAL
    );
    expect(oculto.getNumberOfPages()).toBe(visivel.getNumberOfPages());
  });
});

describe('PDF do local inteiro', () => {
  const rel = montarRelatorioDoLocal(
    entrada([
      linha(1),
      linha(2, { carregador: 'A' }),
      linha(3, { carregador: 'B', data: '15/11/2026', dataFim: '15/11/2026' }),
    ])
  );

  it('capa e resumo em retrato; um extrato por carregador com recarga e o total em paisagem', () => {
    const doc = gerarPdfDoLocal(rel, VISUAL);
    // O carregador C não tem recarga: fica só na tabela, sem página vazia.
    expect(orientacoes(doc)).toEqual(['retrato', 'retrato', 'paisagem', 'paisagem', 'paisagem']);
    expect(titulo(doc)).toContain('Condom');
    expect(titulo(doc)).toContain('Diamond');
  });

  it('extrato grande quebra de página sem perder o cabeçalho nem estourar', () => {
    const muitas = Array.from({ length: 120 }, (_, i) => linha(i + 1));
    const doc = gerarPdfDoLocal(montarRelatorioDoLocal(entrada(muitas)), VISUAL);
    expect(doc.getNumberOfPages()).toBeGreaterThan(5);
    expect(orientacoes(doc).slice(0, 2)).toEqual(['retrato', 'retrato']);
    expect(
      orientacoes(doc)
        .slice(2)
        .every(o => o === 'paisagem')
    ).toBe(true);
  });

  it('sem recarga no período ainda sai: capa, resumo e o total', () => {
    const doc = gerarPdfDoLocal(
      montarRelatorioDoLocal(entrada([], { inicio: '2026-10-01', fim: '2026-10-31' })),
      VISUAL
    );
    expect(orientacoes(doc)).toEqual(['retrato', 'retrato', 'paisagem']);
  });

  it('muitos meses e carregadores continuam o resumo em outra página, sem estourar', () => {
    const linhas = Array.from({ length: 12 }, (_, i) => {
      const mes = String(i + 1).padStart(2, '0');
      return linha(i + 1, { data: `05/${mes}/2026`, dataFim: `05/${mes}/2026` });
    });
    const e = entrada(linhas);
    e.local.carregadores = Array.from({ length: 12 }, (_, i) => ({
      id: i === 0 ? 'A' : `CARREGADOR-${i}`,
      descricao: `Carregador ${i}`,
      modelo: null,
      potenciaKw: 22,
    }));
    const doc = gerarPdfDoLocal(montarRelatorioDoLocal(e), VISUAL);
    expect(orientacoes(doc).slice(0, 3)).toEqual(['retrato', 'retrato', 'retrato']);
  });

  it('tudo que pede atenção desenha sem erro: conta interna, pendência, Spott, cor clara, valores altos', () => {
    const rel2 = montarRelatorioDoLocal(
      entrada(
        [
          linha(1, {
            contaInterna: true,
            cliente: 'William (NeoPower)',
            tipoDeConta: 'Interna NeoPower',
          }),
          linha(2, { debitoCarteira: null, conferencia: 'Sem débito' }),
          linha(3, {
            conferencia: 'Spott',
            tarifaKwh: null,
            recargaCruzada: true,
            redeDoCliente: 'NeoPower',
          }),
          linha(4, {
            valorCobrado: 1234567.89,
            receita: 1234567.89,
            repasse: 1172839.5,
            comissao: 61728.39,
          }),
          linha(5, { cliente: 'Maria Antonieta de Souza e Silva Albuquerque Pereira dos Santos' }),
          linha(6, { data: null, horaInicio: null, horaFim: null, dataFim: null }),
        ],
        {
          split: { ativo: true, desde: '2026-10-29T15:06:00Z' },
          criterioContaInterna: 'admin da NeoPower',
        }
      )
    );
    expect(() => gerarPdfDoLocal(rel2, { nome: null, cor: '#fff200', logo: null })).not.toThrow();
    expect(() =>
      gerarPdfDoLocal(rel2, { nome: null, cor: 'qualquer coisa', logo: null })
    ).not.toThrow();
  });
});

describe('PDF de um carregador', () => {
  const rel = montarRelatorioDoLocal(
    entrada([
      linha(1, { data: '30/09/2026', dataFim: '30/09/2026' }),
      linha(2),
      linha(3, { carregador: 'B', data: '15/10/2026', dataFim: '15/10/2026' }),
    ])
  );
  const [a, b] = carregadoresDoRelatorio(rel);

  it('só as recargas dele: capa, resumo e extrato', () => {
    const doc = gerarPdfDoCarregador(rel, a, VISUAL);
    expect(orientacoes(doc).slice(0, 3)).toEqual(['retrato', 'retrato', 'paisagem']);
    expect(titulo(doc)).toContain('Diamond 01');
    expect(titulo(doc)).toContain('30/09/2026 a 02/10/2026');
  });

  it('o nome do arquivo tem o carregador e o período dele', () => {
    expect(nomeDoArquivoDoCarregador(rel, a)).toBe('Relatorio_Diamond_01_30-09_a_02-10-2026.pdf');
    expect(nomeDoArquivoDoCarregador(rel, b)).toBe('Relatorio_Diamond_02_15-10_a_15-10-2026.pdf');
  });

  it('com período escolhido na tela, o arquivo usa o período escolhido', () => {
    const r = montarRelatorioDoLocal(
      entrada([linha(1)], { inicio: '2026-10-01', fim: '2026-10-31' })
    );
    const c = carregadoresDoRelatorio(r)[0];
    expect(nomeDoArquivoDoCarregador(r, c)).toBe('Relatorio_Diamond_01_01-10_a_31-10-2026.pdf');
  });

  it('o .zip traz um PDF por carregador com recarga', () => {
    const zip = gerarZipDosCarregadores(rel, VISUAL);
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const texto = new TextDecoder('latin1').decode(zip);
    expect(texto).toContain('Relatorio_Diamond_01_30-09_a_02-10-2026.pdf');
    expect(texto).toContain('Relatorio_Diamond_02_15-10_a_15-10-2026.pdf');
    expect(texto).not.toContain('Relatorio_Diamond_03');
    expect((texto.match(/%PDF-/g) ?? []).length).toBe(2);
  });
});
