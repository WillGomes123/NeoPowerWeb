import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Relatório financeiro com um local escolhido (?locationId=): a tela mostra
 * o relatório do local, recarga a recarga, com os subtotais e os botões de
 * exportar. A API é simulada com o formato do GET /reports/financial.
 */

const chamadas: string[] = [];

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Admin', role: 'admin', branding: { clientId: null } },
  }),
}));

const linha = (numero: number, extra: Record<string, unknown> = {}) => ({
  Estação: 'CTPP352/CTPP352',
  Início: '02/10/2026, 10:35:08',
  Fim: '02/10/2026, 11:26:21',
  'Recarga (kWh)': '33.89',
  'Receita (R$)': '52.53',
  'Valor Total de Taxas (R$)': '2.63',
  'Valor Recebido (R$)': '49.90',
  'Valor Pago ao Cliente (R$)': '49.90',
  'Comissão NeoPower (R$)': '2.63',
  'Repasse ao Dono (R$)': '49.90',
  Status: 'Completed',
  numero,
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
  receita: 52.53,
  debitoCarteira: 52.53,
  conferencia: 'OK',
  diferencaCarteira: 0,
  comissao: 2.63,
  repasse: 49.9,
  situacao: 'Concluída',
  ...extra,
});

const total = (quantidade: number, valor: number, comissao: number) => ({
  quantidade,
  energiaKwh: 33.89 * quantidade,
  valorCobrado: valor,
  debitoCarteira: valor,
  receita: valor,
  comissao,
  repasse: Math.round((valor - comissao) * 100) / 100,
  conferidas: quantidade,
});

const RELATORIO = {
  items: [
    linha(96, {
      cliente: 'William (NeoPower)',
      tipoDeConta: 'Interna NeoPower',
      contaInterna: true,
    }),
    linha(95),
  ],
  recargasCruzadas: null,
  comissaoPercent: 5,
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
    carregadores: [{ id: 'CTPP352/CTPP352', descricao: null, modelo: null, potenciaKw: 40 }],
  },
  porTipoDeConta: {
    todas: total(2, 105.06, 5.26),
    clientes: total(1, 52.53, 2.63),
    internas: total(1, 52.53, 2.63),
  },
  criterioContaInterna: 'admin ou operador da NeoPower',
  repasse: {
    regra: 'repasse-95',
    marca: 'neopower-default',
    comissaoPercent: 5,
    repassePercent: 95,
    arredondamento: 'por-recarga',
    recargas: { quantidade: 2, receita: 105.06, comissao: 5.26, repasse: 99.8 },
    proprias: { quantidade: 2, receita: 105.06, comissao: 5.26, repasse: 99.8 },
    cruzadas: { quantidade: 0, receita: 0, comissao: 0, repasse: 0 },
    entrada: null,
    saldoClientes: null,
    custoMercadoPago: null,
  },
};

const resposta = (corpo: unknown) => ({ ok: true, json: async () => corpo }) as Response;

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(async (endpoint: string) => {
      chamadas.push(endpoint);
      if (endpoint.startsWith('/locations/all')) {
        return resposta({
          locations: [
            {
              id: 21,
              nomeDoLocal: 'Cantina do Papai',
              cidade: 'Manaus',
              estado: 'AM',
              clientId: null,
            },
          ],
          total: 1,
        });
      }
      if (endpoint.startsWith('/reports/financial')) return resposta(RELATORIO);
      return resposta([]);
    }),
  },
}));

beforeAll(() => {
  // O recharts mede o contêiner; o jsdom não tem ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

import { FinancialReport } from '../FinancialReport';

describe('Relatório financeiro por local', () => {
  it('pede o relatório do local e mostra as recargas, os subtotais e a exportação', async () => {
    render(
      <MemoryRouter initialEntries={['/financeiro?locationId=21']}>
        <FinancialReport />
      </MemoryRouter>
    );

    expect(await screen.findByText('Relatório de recargas — Cantina do Papai')).toBeInTheDocument();
    expect(chamadas.some(c => c.startsWith('/reports/financial?locationId=21'))).toBe(true);
    expect(screen.getByText('TOTAL — todas as recargas')).toBeInTheDocument();
    expect(screen.getByText('Só contas internas NeoPower')).toBeInTheDocument();
    expect(screen.getByText('William (NeoPower)')).toBeInTheDocument();
    expect(screen.getByText('2 de 2 OK')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PDF do local/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excel do local/ })).toBeInTheDocument();
    // O seletor mostra o local escolhido.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Local' })).toHaveTextContent('Cantina do Papai')
    );
  });
});
