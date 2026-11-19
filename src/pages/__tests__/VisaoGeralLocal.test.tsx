/**
 * Visão geral ao escolher um local (17/11/2026). Na produção a rede toda leva
 * 13 a 17 s para responder; uma busca dela ainda no caminho (o Atualizar, a
 * atualização de cada minuto ou a de quando um carregador muda de status)
 * chegava DEPOIS da do local e trocava os números do local pelos da rede, com
 * o aviso "Servidor ainda não filtra por local". A resposta de um filtro que
 * já não é o da tela agora é descartada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Overview } from '../Overview';

const estado = vi.hoisted(() => ({
  segurarRedeToda: null as Promise<void> | null,
  agora: [] as unknown[],
}));

const rede = {
  locationId: null,
  chargerId: null,
  financeiroDoLocal: null,
  revenueToday: 0,
  revenueMonth: 3000,
  revenueTotal: 90000,
  kwhToday: 0,
  kwhMonth: 2000,
  kwhTotal: 60000,
  transactionsMonth: 300,
  transactionsTotal: 4000,
  totalDepositsGross: 100000,
  mercadoPagoFee: 1000,
  totalDepositsNet: 99000,
  depositsCount: 900,
  last7DaysRevenue: [],
  last7DaysKwh: [],
  chargers: { total: 40, online: 30, offline: 8, charging: 2, emInstalacao: 0 },
  activeVouchers: 0,
};

const doLocal = {
  ...rede,
  locationId: 3,
  revenueTotal: 50,
  financeiroDoLocal: { receita: 50, comissao: 2.5, repasse: 47.5, comissaoPercent: 5 },
  chargers: { total: 1, online: 1, offline: 0, charging: 0, emInstalacao: 0 },
};

const ok = (corpo: unknown) => ({ ok: true, json: async () => corpo });

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url === '/overview-stats') {
        if (estado.segurarRedeToda) await estado.segurarRedeToda;
        return ok(rede);
      }
      if (url.startsWith('/overview-stats?')) return ok(doLocal);
      if (url === '/transactions/active') return ok(estado.agora);
      if (url.startsWith('/locations/all'))
        return ok({
          locations: [{ id: 3, nomeDoLocal: 'Condomínio Residencial Jardim das Américas Torre 2' }],
        });
      if (url === '/chargers') return ok({ data: [] });
      return ok({});
    }),
  },
}));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Plataforma', role: 'admin', branding: null } }),
}));
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

beforeEach(() => {
  estado.segurarRedeToda = null;
});

const receitaLiquida = () => screen.getByRole('region', { name: 'Receita líquida' });

describe('Visão geral — escolher um local', () => {
  it('a resposta atrasada da rede toda não troca os números do local', async () => {
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: 'Visão geral' });
    expect(within(receitaLiquida()).getByText('99.000,00')).toBeInTheDocument();

    // O Atualizar pede a rede toda, que demora.
    let soltar!: () => void;
    estado.segurarRedeToda = new Promise<void>(r => (soltar = r));
    await userEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    // Enquanto isso, escolhe o local: os números passam a ser do local.
    const local = await screen.findByRole('combobox', { name: 'Filtrar por local' });
    await userEvent.click(local);
    await userEvent.click(
      await screen.findByRole('option', {
        name: 'Condomínio Residencial Jardim das Américas Torre 2',
      })
    );
    await waitFor(() => expect(within(receitaLiquida()).getByText('47,50')).toBeInTheDocument());

    // A rede toda chega por último e é descartada.
    await act(async () => {
      soltar();
      await estado.segurarRedeToda;
    });
    await new Promise(r => setTimeout(r, 0));
    expect(within(receitaLiquida()).getByText('47,50')).toBeInTheDocument();
    expect(screen.queryByText(/Servidor ainda não filtra por local/)).not.toBeInTheDocument();
  });

  it('nome comprido de local cabe na pílula, com reticências', async () => {
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    );
    const local = await screen.findByRole('combobox', { name: 'Filtrar por local' });
    await userEvent.click(local);
    await userEvent.click(
      await screen.findByRole('option', {
        name: 'Condomínio Residencial Jardim das Américas Torre 2',
      })
    );
    const valor = local.querySelector('[data-slot="select-value"]')!;
    expect(valor).toHaveTextContent('Condomínio Residencial Jardim das Américas Torre 2');
    // O texto corta com reticências dentro do espaço que sobra ao lado do ícone.
    // (o Radix descarta a classe do SelectValue, por isso o corte fica no span de fora)
    expect(valor.parentElement).toHaveClass('min-w-0', 'truncate');
    expect(valor.parentElement!.parentElement).toHaveClass('flex-1', 'min-w-0');
  });

  it('o bloco "Agora" mostra o local, não o id do carregador', async () => {
    estado.agora = [
      {
        transactionId: 1,
        chargerId: 'A300DAFF',
        startTimestamp: new Date().toISOString(),
        energyKwh: 27.8,
        powerKw: 30.4,
        estimatedCost: 33.36,
        userName: 'Poliana Costa',
        locationId: 3,
        nomeDoLocal: 'Av. das Torres',
        nomeDoCarregador: 'Torres DC',
      },
      // Sem local: o nome do carregador.
      {
        transactionId: 2,
        chargerId: 'gx001',
        startTimestamp: new Date().toISOString(),
        energyKwh: 1.9,
        userName: 'Marcelo Souza',
        locationId: null,
        nomeDoLocal: null,
        nomeDoCarregador: 'Gelux 01',
      },
    ];
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    );
    const torres = await screen.findByText('Av. das Torres');
    expect(torres).toHaveAttribute('title', 'A300DAFF');
    expect(screen.getByText('Gelux 01')).toHaveAttribute('title', 'gx001');
    expect(screen.queryByText('A300DAFF')).not.toBeInTheDocument();
    estado.agora = [];
  });
});
