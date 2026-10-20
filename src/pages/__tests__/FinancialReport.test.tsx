/**
 * Relatório financeiro: repasse por recarga (decisão do dono, 06/10/2026,
 * revista no mesmo dia).
 *
 * O dono recebe 95% do consumido em recargas e a NeoPower fica com 5%. A taxa
 * do Mercado Pago não reduz o repasse: a NeoPower a absorve nos 5% dela. O
 * operador da marca vê entrou no caixa, consumido, comissão, repasse e saldo
 * de clientes a consumir; só a plataforma vê a taxa absorvida e o líquido da
 * NeoPower. O card da visão geral usa o mesmo repasse.
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

const SUPER_ADMIN = { id: 1, name: 'Admin', role: 'admin', branding: null };
const ADMIN_DA_VIP = { id: 5, name: 'Vip', role: 'admin', branding: { clientId: 'vipenergy' } };
let usuario: Record<string, unknown> = SUPER_ADMIN;
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: usuario }),
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
const linhasDaVip = (comCusto: boolean) => [
  linha({
    'Receita (R$)': '60.00',
    'Comissão NeoPower (R$)': '3.00',
    'Valor Total de Taxas (R$)': '3.00',
    'Valor Recebido (R$)': '57.00',
    'Repasse ao Dono (R$)': '57.00',
    'Valor Pago ao Cliente (R$)': '57.00',
    ...(comCusto
      ? {
          'Taxa Mercado Pago (%)': '2.99',
          'Taxa Mercado Pago (R$)': '1.79',
          'Líquido NeoPower (R$)': '1.21',
        }
      : {}),
  }),
  linha({
    'Receita (R$)': '50.00',
    'Comissão NeoPower (R$)': '2.50',
    'Valor Total de Taxas (R$)': '2.50',
    'Valor Recebido (R$)': '47.50',
    'Repasse ao Dono (R$)': '47.50',
    'Valor Pago ao Cliente (R$)': '47.50',
    ...(comCusto
      ? { 'Taxa Mercado Pago (%)': '0.00', 'Taxa Mercado Pago (R$)': '0.00', 'Líquido NeoPower (R$)': '2.50' }
      : {}),
    recargaCruzada: true,
    redeDoCliente: 'NeoPower',
  }),
];

const relatorio = (comCusto: boolean) => ({
  items: linhasDaVip(comCusto),
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
    regra: 'repasse-95',
    marca: 'vipenergy',
    comissaoPercent: 5,
    repassePercent: 95,
    recargas: { quantidade: 2, receita: 110, comissao: 5.5, repasse: 104.5 },
    proprias: { quantidade: 1, receita: 60, comissao: 3, repasse: 57 },
    cruzadas: { quantidade: 1, receita: 50, comissao: 2.5, repasse: 47.5 },
    entrada: {
      depositos: 200,
      quantidade: 2,
      creditosSemPagamento: 0,
      estornosDeposito: 0,
      estornosRecargaMp: 0,
      devolucoesVisitante: 0,
      liquido: 200,
      ...(comCusto ? { taxaMp: 5.98, liquidoAposTaxaMp: 194.02 } : {}),
    },
    saldoClientes: {
      aConsumir: 100,
      devedor: 0,
      carteiras: 2,
      em: '2026-10-01T02:59:59.999Z',
      fonte: 'carteiras-no-fim-do-periodo',
    },
    custoMercadoPago: comCusto
      ? {
          percentual: 2.99,
          fonte: 'periodo',
          depositos: 200,
          taxaDosDepositos: 5.98,
          quantidade: 2,
          absorvida: 1.79,
          comissao: 5.5,
          liquidoNeoPower: 3.71,
        }
      : null,
  },
});

const deposito = (comCusto: boolean) => ({
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
  ...(comCusto ? { taxaMp: 4.99 } : {}),
  createdAt: '2026-09-05T12:00:00.000Z',
});

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
  usuario = SUPER_ADMIN;
});

describe('Relatório financeiro — repasse de 95%, taxa MP absorvida pela NeoPower', () => {
  it('super admin: repasse 95% cheio, e a taxa MP absorvida com o líquido da NeoPower', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/reports/financial?')) return resposta(relatorio(true));
      if (endpoint.startsWith('/admin/wallet-transactions')) return resposta([deposito(true)]);
      return resposta({});
    });

    renderizar('/financeiro?clientId=vipenergy');
    const secao = await resumoNaTela();

    await waitFor(() =>
      expect(within(cartao(secao, 'Entrou no caixa')).getByText('R$ 200,00')).toBeInTheDocument()
    );
    expect(cartao(secao, 'Entrou no caixa')).toHaveTextContent('O Mercado Pago reteve R$ 5,98');
    expect(within(cartao(secao, 'Consumido em recargas')).getByText('R$ 110,00')).toBeInTheDocument();
    expect(within(cartao(secao, 'Comissão NeoPower 5%')).getByText('R$ 5,50')).toBeInTheDocument();
    const repasse = cartao(secao, 'Repasse ao dono');
    expect(within(repasse).getByText('R$ 104,50')).toBeInTheDocument();
    expect(repasse).toHaveTextContent('95% do consumido');
    expect(repasse).toHaveTextContent('Inclui R$ 47,50 de clientes de outras redes');
    expect(within(cartao(secao, 'Saldo de clientes a consumir')).getByText('R$ 100,00')).toBeInTheDocument();
    const taxa = cartao(secao, 'Taxa Mercado Pago (absorvida pela NeoPower)');
    expect(within(taxa).getByText('−R$ 1,79')).toBeInTheDocument();
    expect(taxa).toHaveTextContent('2,99% efetiva');
    expect(within(cartao(secao, 'Líquido NeoPower')).getByText('R$ 3,71')).toBeInTheDocument();
    expect(secao).toHaveTextContent(/As taxas do Mercado Pago saem dos\s+5% da NeoPower/);

    // Os depósitos listados são os da marca aberta, não os de todas.
    expect(mockGet).toHaveBeenCalledWith('/admin/wallet-transactions?clientId=vipenergy');
  });

  it('operador da marca: entrou no caixa, consumido, comissão, repasse e saldo — sem a taxa MP', async () => {
    usuario = ADMIN_DA_VIP;
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/reports/financial')) return resposta(relatorio(false));
      if (endpoint.startsWith('/admin/wallet-transactions')) return resposta([deposito(false)]);
      return resposta({});
    });

    renderizar('/financeiro');
    const secao = await resumoNaTela();

    await waitFor(() =>
      expect(within(cartao(secao, 'Entrou no caixa')).getByText('R$ 200,00')).toBeInTheDocument()
    );
    expect(within(cartao(secao, 'Consumido em recargas')).getByText('R$ 110,00')).toBeInTheDocument();
    expect(within(cartao(secao, 'Comissão NeoPower 5%')).getByText('R$ 5,50')).toBeInTheDocument();
    expect(within(cartao(secao, 'Repasse ao dono')).getByText('R$ 104,50')).toBeInTheDocument();
    expect(within(cartao(secao, 'Saldo de clientes a consumir')).getByText('R$ 100,00')).toBeInTheDocument();
    expect(secao).toHaveTextContent(/o saldo parado na carteira é do cliente até ele usar/);

    // Nada da taxa do Mercado Pago nem do líquido da NeoPower na tela inteira.
    expect(screen.queryByText(/Taxa Mercado Pago/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Taxa MP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Líquido NeoPower/)).not.toBeInTheDocument();
    expect(screen.queryByText(/reteve/)).not.toBeInTheDocument();
  });

  it('API antiga (sem o resumo): usa comissão e repasse das linhas, sem inventar taxa', async () => {
    usuario = ADMIN_DA_VIP;
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
      endpoint.startsWith('/reports/financial') ? resposta(semRepasse) : resposta([])
    );

    renderizar('/financeiro');
    const secao = await resumoNaTela();

    await waitFor(() =>
      expect(within(cartao(secao, 'Repasse ao dono')).getByText('R$ 95,00')).toBeInTheDocument()
    );
    expect(within(cartao(secao, 'Comissão NeoPower 5%')).getByText('R$ 5,00')).toBeInTheDocument();
    expect(screen.queryByText(/Taxa Mercado Pago \(absorvida/)).not.toBeInTheDocument();
  });

  it('visão geral: o card da marca mostra o mesmo repasse, com a taxa MP e o líquido', async () => {
    mockGet.mockImplementation((endpoint: string) =>
      endpoint.startsWith('/reports/financial/by-tenant')
        ? resposta({
            aggregate: {
              transactions: 3,
              kWh: 30,
              revenue: 150,
              fees: 7.5,
              net: 142.5,
              mpFee: 2.99,
              liquidoNeoPower: 4.51,
              deposits: { total: 200, count: 2, mpFee: 5.98, devolvidos: 0, liquido: 200, liquidoAposTaxaMp: 194.02 },
            },
            byTenant: [
              {
                clientId: 'vipenergy',
                companyName: 'Vip Energy',
                transactions: 3,
                chargers: 1,
                kWh: 30,
                revenue: 150,
                fees: 7.5,
                net: 142.5,
                comissaoPercent: 5,
                cruzadas: { quantidade: 1, receita: 50, repasse: 47.5 },
                mpFee: 2.99,
                taxaMpPercent: 2.99,
                taxaMpFonte: 'periodo',
                liquidoNeoPower: 4.51,
              },
            ],
          })
        : resposta({})
    );

    renderizar('/financeiro');

    const card = (await screen.findByText('Vip Energy')).closest('button') as HTMLElement;
    expect(within(card).getByText('R$ 142,50')).toBeInTheDocument();
    expect(within(card).getByText('R$ 7,50')).toBeInTheDocument();
    expect(within(card).getByText('Taxa MP 2,99%')).toBeInTheDocument();
    expect(within(card).getByText('R$ 2,99')).toBeInTheDocument();
    expect(within(card).getByText('R$ 4,51')).toBeInTheDocument();
    expect(card).toHaveTextContent('R$ 50,00 de clientes de outras redes');
    expect(screen.getByText('Repasse aos donos')).toBeInTheDocument();
    // KPI do consolidado e linha do card.
    expect(screen.getAllByText('Líquido NeoPower')).toHaveLength(2);
  });
});
