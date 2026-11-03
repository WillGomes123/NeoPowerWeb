import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Aba Financeiro do local: o botão PDF sai no mesmo modelo do Relatório
 * Financeiro (e não a tabela impressa de antes), com o período da aba.
 */

const pdf = vi.hoisted(() => {
  const save = vi.fn();
  return {
    save,
    visualDaMarca: vi.fn(async () => ({ nome: 'Vip Energy', cor: '#2b00ff', logo: null })),
    gerarPdfDoLocal: vi.fn((..._a: unknown[]) => ({ save })),
  };
});
vi.mock('@/lib/pdfDoLocal', () => pdf);

const exportar = vi.hoisted(() => ({
  exportToCSV: vi.fn(),
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
}));
vi.mock('@/lib/export', () => exportar);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const chamadas: string[] = [];
const resposta = (corpo: unknown) => ({ ok: true, json: async () => corpo }) as Response;

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
let relatorio: unknown = {
  items: [],
  comissaoPercent: 5,
  local: {
    id: 44,
    nome: 'CONDOMÍNIO DIAMOND',
    endereco: 'Rua A, 1',
    cidade: 'Salvador',
    estado: 'BA',
    marca: 'vipenergy',
    fuso: 'America/Bahia',
    fusoOrigem: 'estado',
    fusoRotulo: 'Salvador (UTC-3)',
    carregadores: [],
  },
  porTipoDeConta: { todas: subtotal, clientes: subtotal, internas: subtotal },
  repasse: { repassePercent: 95, split: { ativo: false, desde: null } },
};

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async (endpoint: string) => {
      chamadas.push(endpoint);
      if (endpoint.startsWith('/reports/financial')) return resposta(relatorio);
      return resposta({
        totalRevenue: 10,
        averageDailyRevenue: 1,
        totalSessions: 1,
        totalEnergy: 1000,
        pricePerKwh: 1,
        revenueByCharger: [],
        revenueChart: [],
      });
    }),
  },
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

import { LocationFinancialTab } from '../LocationFinancialTab';

describe('Aba Financeiro do local', () => {
  it('o PDF busca o relatório do local no período da aba e gera no modelo novo', async () => {
    render(<LocationFinancialTab locationId={44} />);
    const botao = await screen.findByRole('button', { name: /^PDF$/ });
    fireEvent.click(botao);

    await waitFor(() => expect(pdf.save).toHaveBeenCalledTimes(1));
    const chamada = chamadas.find(c => c.startsWith('/reports/financial'));
    expect(chamada).toMatch(
      /^\/reports\/financial\?locationId=44&startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}$/
    );
    // Padrão da aba: 30 dias.
    const [, inicio, fim] = /startDate=([\d-]+)&endDate=([\d-]+)/.exec(chamada!)!;
    expect(Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000)).toBe(30);
    expect(pdf.visualDaMarca).toHaveBeenCalledWith('vipenergy');
    expect(pdf.save.mock.calls[0][0]).toMatch(/^Relatorio_Condominio_Diamond_/);
    expect(exportar.exportToPDF).not.toHaveBeenCalled();
  });

  it('sem o relatório na resposta, avisa em vez de gerar um PDF vazio', async () => {
    relatorio = { items: [], local: null };
    pdf.save.mockClear();
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LocationFinancialTab locationId={44} />);
    const botoes = await screen.findAllByRole('button', { name: /^PDF$/ });
    fireEvent.click(botoes[botoes.length - 1]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao gerar o PDF do local'));
    expect(pdf.save).not.toHaveBeenCalled();
    erro.mockRestore();
  });
});
