/**
 * Visão geral no redesenho de nov/2026, à risca do Figma (Frame 14): os
 * cartões com os números da API e sem rodapé, os textos dos gráficos, o
 * "Atualizar" com a hora e o aviso de falha, o bloco Offline que leva aos
 * carregadores offline e o filtro por estação (sem a linha de escopo nem o
 * "Limpar filtros", que o Figma não tem).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Overview } from '../Overview';

const estado = vi.hoisted(() => ({
  user: { id: 1, name: 'Plataforma', role: 'admin', branding: null } as Record<string, unknown>,
  pedidos: [] as string[],
  falharOverview: false,
}));

const visao = {
  locationId: null,
  chargerId: null,
  financeiroDoLocal: null,
  revenueToday: 10,
  revenueMonth: 120.5,
  revenueTotal: 900,
  kwhToday: 3,
  kwhMonth: 40.2,
  kwhTotal: 500,
  transactionsMonth: 12,
  transactionsTotal: 80,
  totalDepositsGross: 1000,
  mercadoPagoFee: 10,
  totalDepositsNet: 990,
  depositsCount: 4,
  last7DaysRevenue: [],
  last7DaysKwh: [],
  chargers: { total: 27, online: 12, offline: 10, charging: 5, emInstalacao: 0 },
  activeVouchers: 7,
};

const ok = (corpo: unknown) => ({ ok: true, json: async () => corpo });

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      estado.pedidos.push(url);
      if (url.startsWith('/overview-stats')) {
        if (estado.falharOverview) throw new Error('rede');
        const chargerId = new URLSearchParams(url.split('?')[1] ?? '').get('chargerId');
        return ok({ ...visao, chargerId });
      }
      if (url === '/transactions/active') return ok([]);
      if (url.startsWith('/locations/all'))
        return ok({ locations: [{ id: 3, nomeDoLocal: 'Posto Centro' }] });
      if (url === '/chargers')
        return ok({
          data: [{ charge_point_id: 'CP-1', description: 'Carregador da entrada', locationId: 3 }],
        });
      return ok({});
    }),
  },
}));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ user: estado.user }) }));
vi.mock('../../lib/hooks/useSocket', () => ({
  useSocket: () => ({ isConnected: true, chargerStatuses: new Map(), lastUpdate: null }),
}));

// O Select do Radix usa captura de ponteiro e scrollIntoView, que o jsdom não tem.
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  scrollIntoView: () => {},
});

const abrir = () =>
  render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>
  );

beforeEach(() => {
  estado.user = { id: 1, name: 'Plataforma', role: 'admin', branding: null };
  estado.pedidos = [];
  estado.falharOverview = false;
});

describe('Visão geral (redesenho)', () => {
  it('mostra o título, os quatro cartões da plataforma e a hora da atualização', async () => {
    abrir();
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument();
    for (const titulo of [
      'Receita líquida',
      'Receita operacional',
      'Depósitos recebidos',
      'Energia consumida',
    ]) {
      expect(screen.getByRole('region', { name: titulo })).toBeInTheDocument();
    }
    // Plataforma na rede toda: receita líquida = depósito líquido
    expect(
      within(screen.getByRole('region', { name: 'Receita líquida' })).getByText('990,00')
    ).toBeInTheDocument();
    expect(screen.getByText(/Última atualização hoje às/)).toBeInTheDocument();
    // Como no Figma: sem a linha de escopo no cabeçalho e sem rodapé nos cartões
    expect(screen.queryByText(/Período: todo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ao vivo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Taxa Mercado Pago')).not.toBeInTheDocument();
    expect(screen.queryByText('Recargas (consumo)')).not.toBeInTheDocument();
  });

  it('a marca não vê o cartão de depósitos', async () => {
    estado.user = { id: 2, name: 'Op', role: 'operador', branding: { clientId: 'vipenergy' } };
    abrir();
    await screen.findByRole('heading', { name: 'Visão geral' });
    expect(screen.queryByRole('region', { name: 'Depósitos recebidos' })).not.toBeInTheDocument();
  });

  it('os gráficos têm os subtítulos e os selos do Figma', async () => {
    abrir();
    const receita = await screen.findByRole('region', { name: 'Análise da receita' });
    expect(
      within(receita).getByText('Evolução da receita no período selecionado')
    ).toBeInTheDocument();
    expect(within(receita).getByText('Receita líquida')).toBeInTheDocument();
    // O Figma repetiu o subtítulo da receita no de energia; aqui fala do consumo.
    const energia = screen.getByRole('region', { name: 'Consumo de energia' });
    expect(
      within(energia).getByText('Evolução do consumo no período selecionado')
    ).toBeInTheDocument();
    expect(within(energia).getByText('Diária')).toBeInTheDocument();
  });

  it('status dos carregadores: conectados, por estado e atalho para os offline', async () => {
    abrir();
    const status = await screen.findByRole('region', { name: 'Status dos carregadores' });
    expect(within(status).getByText('63% conectados')).toBeInTheDocument();
    expect(within(status).getByText('Livres')).toBeInTheDocument();
    expect(within(status).getByText('Em uso')).toBeInTheDocument();
    const offline = within(status).getByTitle('Ver os carregadores offline');
    expect(offline).toHaveAttribute('href', '/estacoes?estado=offline');
    // A frase "N carregadores sem conexão. Ver quais →" não está no Figma.
    expect(within(status).queryByText(/sem conexão/)).not.toBeInTheDocument();
  });

  it('atualização que falha mantém os números e avisa', async () => {
    abrir();
    await screen.findByRole('heading', { name: 'Visão geral' });
    estado.falharOverview = true;
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByText(/Não foi possível atualizar/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Receita operacional' })).toBeInTheDocument();
  });

  it('escolher uma estação filtra a API, e "Todas as estações" volta à rede toda', async () => {
    abrir();
    await screen.findByRole('heading', { name: 'Visão geral' });
    // O Figma não tem "Limpar filtros": cada pílula volta ao "todos" sozinha.
    expect(screen.queryByRole('button', { name: /Limpar filtros/ })).not.toBeInTheDocument();

    const estacao = await screen.findByRole('combobox', { name: 'Filtrar por estação' });
    await userEvent.click(estacao);
    await userEvent.click(await screen.findByRole('option', { name: 'Carregador da entrada' }));

    await waitFor(() => expect(estado.pedidos.some(u => u.includes('chargerId=CP-1'))).toBe(true));
    expect(estacao).toHaveTextContent('Carregador da entrada');
    expect(screen.queryByRole('button', { name: /Limpar filtros/ })).not.toBeInTheDocument();

    estado.pedidos = [];
    await userEvent.click(estacao);
    await userEvent.click(await screen.findByRole('option', { name: 'Todas as estações' }));
    const pedidosDaVisao = () => estado.pedidos.filter(u => u.startsWith('/overview-stats'));
    await waitFor(() => expect(pedidosDaVisao().length).toBeGreaterThan(0));
    expect(pedidosDaVisao().some(u => u.includes('chargerId'))).toBe(false);
    expect(estacao).toHaveTextContent('Todas as estações');
  });
});
