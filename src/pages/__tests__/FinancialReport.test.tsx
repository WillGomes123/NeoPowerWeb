/**
 * Relatório financeiro: repasse por recarga (decisão do dono, 06/10/2026).
 *
 * A visão de uma marca mostra entrou no caixa, consumido, taxa do Mercado
 * Pago proporcional, comissão, repasse ao dono e saldo de clientes a consumir,
 * com os números que a API calculou; o card da visão geral usa o mesmo
 * repasse. Antes a visão da marca repartia os DEPÓSITOS (e, no drill-down do
 * super admin, os depósitos de todas as marcas).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { FinancialReport } from '../FinancialReport';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }));

const mockGet = vi.fn();
vi.mock('../../lib/api', () => ({
  api: { get: (endpoint: string) => mockGet(endpoint) },
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Admin', role: 'admin', branding: null } }),
}));

// Gráficos não têm tamanho no jsdom; não fazem parte da conta.
vi.mock('recharts', () => {
  const Vazio = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Vazio,
    BarChart: Vazio,
    ComposedChart: Vazio,
    AreaChart: Vazio,
    Bar: () => null,
    Area: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    CartesianGrid: () => null,
  };
});

const resposta = (corpo: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(corpo) });

const linha = (over: Record<string, unknown>) => ({
  Estação: 'Vip 1',
  Início: '10/09/2026, 12:00:00',
  Fim: '10/09/2026, 13:00:00',
  'Recarga (kWh)': '10.00',
  Status: 'Completed',
  recargaCruzada: false,
  redeDoCliente: null,
  ...over,
});

/** Mesmos números do teste da API (repassePorRecarga.test.ts). */
const RELATORIO = {
  items: [
    linha({
      'Receita (R$)': '60.00',
      'Taxa Mercado Pago (%)': '2.99',
      'Taxa Mercado Pago (R$)': '1.79',
      'Comissão NeoPower (R$)': '2.91',
      'Valor Total de Taxas (R$)': '4.70',
      'Valor Recebido (R$)': '55.30',
      'Repasse ao Dono (R$)': '55.30',
      'Valor Pago ao Cliente (R$)': '55.30',
    }),
    linha({
      'Receita (R$)': '50.00',
      'Taxa Mercado Pago (%)': '0.00',
      'Taxa Mercado Pago (R$)': '0.00',
      'Comissão NeoPower (R$)': '2.50',
      'Valor Total de Taxas (R$)': '2.50',
      'Valor Recebido (R$)': '47.50',
      'Repasse ao Dono (R$)': '47.50',
      'Valor Pago ao Cliente (R$)': '47.50',
      recargaCruzada: true,
      redeDoCliente: 'NeoPower',
    }),
  ],
  recargasCruzadas: {
    recebidas: {
      quantidade: 1,
      valorBruto: 50,
      valorRepasse: 47.5,
      porRede: [{ clientId: 'neo', nome: 'NeoPower', quantidade: 1, valorBruto: 50 }],
    },
    aRepassar: { quantidade: 0, valorBruto: 0, porRede: [] },
  },
  comissaoPercent: 5,
  repasse: {
    regra: 'por-recarga',
    marca: 'vipenergy',
    comissaoPercent: 5,
    taxaMp: { percentual: 2.99, fonte: 'periodo', depositos: 200, taxa: 5.98, quantidade: 2 },
    recargas: { quantidade: 2, receita: 110, taxaMp: 1.79, base: 108.21, comissao: 5.41, repasse: 102.8 },
    proprias: { quantidade: 1, receita: 60, taxaMp: 1.79, base: 58.21, comissao: 2.91, repasse: 55.3 },
    cruzadas: { quantidade: 1, receita: 50, taxaMp: 0, base: 50, comissao: 2.5, repasse: 47.5 },
    entrada: {
      depositos: 200,
      quantidade: 2,
      creditosSemPagamento: 0,
      estornosDeposito: 0,
      estornosRecargaMp: 0,
      devolucoesVisitante: 0,
      taxaMp: 5.98,
      liquido: 194.02,
    },
    saldoClientes: {
      aConsumir: 100,
      devedor: 0,
      carteiras: 2,
      em: '2026-10-01T02:59:59.999Z',
      fonte: 'carteiras-no-fim-do-periodo',
    },
  },
};

const DEPOSITOS = [
  {
    id: 1,
    userId: 10,
    userName: 'Cliente Vip',
    userEmail: 'c@vip.com',
    type: 'deposit',
    amount: 100,
    balanceBefore: 0,
    balanceAfter: 100,
    description: 'Recarga via cartão de crédito',
    referenceId: '111',
    paymentMethod: 'credito',
    taxaMp: 4.99,
    createdAt: '2026-09-05T12:00:00.000Z',
  },
];

const renderizar = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FinancialReport />
    </MemoryRouter>
  );

/** Seção do resumo do repasse (visão de uma marca). */
const resumoNaTela = async () =>
  (await screen.findByText('Repasse ao dono por recarga')).closest('.glass-card') as HTMLElement;

/** Cartão do resumo com este título. */
const cartao = (secao: HTMLElement, titulo: string) =>
  within(secao).getByText(titulo, { selector: 'p' }).closest('div.p-4') as HTMLElement;

beforeEach(() => {
  mockGet.mockReset();
});

describe('Relatório financeiro — repasse por recarga', () => {
  it('visão da marca: caixa, consumo, taxa MP proporcional, comissão, repasse e saldo', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/reports/financial?')) return resposta(RELATORIO);
      if (endpoint.startsWith('/admin/wallet-transactions')) return resposta(DEPOSITOS);
      return resposta({});
    });

    renderizar('/financeiro?clientId=vipenergy');
    const secao = await resumoNaTela();

    await waitFor(() =>
      expect(within(cartao(secao, 'Entrou no caixa')).getByText('R$ 194,02')).toBeInTheDocument()
    );
    expect(within(cartao(secao, 'Consumido em recargas')).getByText('R$ 110,00')).toBeInTheDocument();
    const taxa = cartao(secao, 'Taxa Mercado Pago (proporcional)');
    expect(within(taxa).getByText('−R$ 1,79')).toBeInTheDocument();
    expect(taxa).toHaveTextContent('2,99% efetiva');
    expect(within(cartao(secao, 'Comissão NeoPower 5%')).getByText('−R$ 5,41')).toBeInTheDocument();
    const repasse = cartao(secao, 'Repasse ao dono');
    expect(within(repasse).getByText('R$ 102,80')).toBeInTheDocument();
    expect(repasse).toHaveTextContent('Inclui R$ 47,50 de clientes de outras redes');
    expect(within(cartao(secao, 'Saldo de clientes a consumir')).getByText('R$ 100,00')).toBeInTheDocument();
    expect(secao).toHaveTextContent(/o saldo parado na carteira é do\s+cliente até ele usar/);

    // Os depósitos listados são os da marca aberta, não os de todas.
    expect(mockGet).toHaveBeenCalledWith('/admin/wallet-transactions?clientId=vipenergy');
    // A rede de origem da recarga cruzada aparece pelo nome.
    expect(screen.getAllByText('NeoPower').length).toBeGreaterThan(0);
  });

  it('API antiga (sem o repasse): cai em receita − comissão, sem inventar taxa', async () => {
    const semRepasse = {
      items: [
        linha({
          'Receita (R$)': '100.00',
          'Valor Total de Taxas (R$)': '5.00',
          'Valor Recebido (R$)': '95.00',
          'Valor Pago ao Cliente (R$)': '95.00',
        }),
      ],
      recargasCruzadas: null,
      comissaoPercent: 5,
    };
    mockGet.mockImplementation((endpoint: string) =>
      endpoint.startsWith('/reports/financial?') ? resposta(semRepasse) : resposta([])
    );

    renderizar('/financeiro?clientId=vipenergy');
    const secao = await resumoNaTela();

    await waitFor(() =>
      expect(within(cartao(secao, 'Repasse ao dono')).getByText('R$ 95,00')).toBeInTheDocument()
    );
    expect(within(cartao(secao, 'Taxa Mercado Pago (proporcional)')).getByText('−R$ 0,00')).toBeInTheDocument();
    expect(within(cartao(secao, 'Comissão NeoPower 5%')).getByText('−R$ 5,00')).toBeInTheDocument();
  });

  it('visão geral: o card da marca mostra o mesmo repasse, com a taxa MP', async () => {
    mockGet.mockImplementation((endpoint: string) =>
      endpoint.startsWith('/reports/financial/by-tenant')
        ? resposta({
            aggregate: {
              transactions: 3,
              kWh: 30,
              revenue: 150,
              mpFee: 2.99,
              fees: 7.35,
              net: 139.66,
              deposits: { total: 200, count: 2, mpFee: 5.98, devolvidos: 0, liquido: 194.02 },
            },
            byTenant: [
              {
                clientId: 'vipenergy',
                companyName: 'Vip Energy',
                transactions: 3,
                chargers: 1,
                kWh: 30,
                revenue: 150,
                mpFee: 2.99,
                taxaMpPercent: 2.99,
                taxaMpFonte: 'periodo',
                fees: 7.35,
                net: 139.66,
                comissaoPercent: 5,
                cruzadas: { quantidade: 1, receita: 50, repasse: 47.5 },
              },
            ],
          })
        : resposta({})
    );

    renderizar('/financeiro');

    const card = (await screen.findByText('Vip Energy')).closest('button') as HTMLElement;
    expect(within(card).getByText('R$ 139,66')).toBeInTheDocument();
    expect(within(card).getByText('Taxa MP 2,99%')).toBeInTheDocument();
    expect(within(card).getByText('R$ 2,99')).toBeInTheDocument();
    expect(card).toHaveTextContent('R$ 50,00 de clientes de outras redes');
    expect(screen.getByText('Repasse aos donos')).toBeInTheDocument();
  });
});
