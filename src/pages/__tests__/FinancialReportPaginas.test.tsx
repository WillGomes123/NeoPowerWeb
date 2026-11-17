/**
 * Relatório financeiro com o volume da produção (17/11/2026): a marca
 * NeoPower em "todo o período" passa de 4 mil recargas, e a tabela desenhava
 * todas de uma vez — a tela travava por quase um minuto até aparecer. Agora a
 * tabela vem em páginas de 50, e cada linha diz quem carregou (Cliente) e
 * quando a recarga começou e terminou.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { FinancialReport } from '../FinancialReport';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }));

const mockGet = vi.fn();
vi.mock('../../lib/api', () => ({
  api: { get: (endpoint: string) => mockGet(endpoint) },
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 5, name: 'Vip', role: 'admin', branding: { clientId: 'vipenergy' } },
  }),
}));

// Gráficos não têm tamanho no jsdom.
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

/** Recarga nº n: a primeira com nome completo, a segunda só com o abreviado. */
const recarga = (n: number) => ({
  Estação: `Posto ${n}`,
  Início: `10/11/2026, 12:${String(n % 60).padStart(2, '0')}:00`,
  Fim: `10/11/2026, 13:${String(n % 60).padStart(2, '0')}:00`,
  'Recarga (kWh)': '10.00',
  'Receita (R$)': '20.00',
  'Comissão NeoPower (R$)': '1.00',
  'Repasse ao Dono (R$)': '19.00',
  'Valor Pago ao Cliente (R$)': '19.00',
  Status: 'Completed',
  transaction_id: n,
  numero: n,
  cliente: n === 2 ? 'João S.' : `Cliente ${n}`,
  clienteNome: n === 1 ? 'Maria Souza Lima' : n === 2 ? null : `Cliente Número ${n}`,
});

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation((endpoint: string) => {
    if (endpoint.startsWith('/reports/financial')) {
      return resposta({
        items: Array.from({ length: 120 }, (_, i) => recarga(i + 1)),
        comissaoPercent: 5,
      });
    }
    if (endpoint.startsWith('/admin/wallet-transactions')) return resposta([]);
    return resposta({});
  });
});

const tabela = async () => {
  const secao = await screen.findByRole('region', { name: 'Detalhamento por transação' });
  await within(secao).findByText('Maria Souza Lima');
  return secao;
};

describe('Relatório financeiro — detalhamento em páginas, com o cliente', () => {
  it('desenha só 50 recargas por vez e anda pelas páginas', async () => {
    renderizar();
    const secao = await tabela();

    // Cabeçalho + 50 linhas, e não as 120.
    expect(within(secao).getAllByRole('row')).toHaveLength(51);
    const paginas = within(secao).getByRole('navigation', { name: 'Páginas de recargas' });
    expect(paginas).toHaveTextContent('Página 1 de 3');
    expect(paginas).toHaveTextContent('(120 recargas)');
    expect(within(paginas).getByRole('button', { name: /Anterior/ })).toBeDisabled();

    await userEvent.click(within(paginas).getByRole('button', { name: /Próxima/ }));
    expect(paginas).toHaveTextContent('Página 2 de 3');
    expect(within(secao).getByText('Posto 51')).toBeInTheDocument();
    expect(within(secao).queryByText('Posto 1')).not.toBeInTheDocument();

    await userEvent.click(within(paginas).getByRole('button', { name: /Próxima/ }));
    expect(paginas).toHaveTextContent('Página 3 de 3');
    expect(within(secao).getAllByRole('row')).toHaveLength(21);
    expect(within(paginas).getByRole('button', { name: /Próxima/ })).toBeDisabled();

    // Os totais continuam sendo das 120, não da página.
    expect(secao).toHaveTextContent('Total de transações');
    expect(secao).toHaveTextContent('120');
  });

  it('mostra quem carregou (nome completo; sem ele, o abreviado) e quando terminou', async () => {
    renderizar();
    const secao = await tabela();

    const cabecalho = within(secao)
      .getAllByRole('columnheader')
      .map(th => th.textContent);
    expect(cabecalho.slice(0, 4)).toEqual(['Estação', 'Cliente', 'Início', 'Fim']);

    const primeira = within(secao).getByText('Maria Souza Lima').closest('tr')!;
    expect(primeira).toHaveTextContent('10/11/2026, 12:01:00');
    expect(primeira).toHaveTextContent('10/11/2026, 13:01:00');
    expect(within(secao).getByText('João S.')).toBeInTheDocument();
  });
});

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/relatorio-financeiro']}>
      <FinancialReport />
    </MemoryRouter>
  );
}
