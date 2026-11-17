/**
 * Coluna Cliente da tela de Transações (pedido do dono em 06/11/2026, para o
 * Henrique, operador do Solutt Car). A API só manda nome e celular para admin e
 * operador; a tela mostra a coluna quando eles vêm e some com ela quando não.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Transactions } from '../Transactions';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ user: { id: 1637, role: 'operador' } }) }));

let recargas: unknown[] = [];
vi.mock('../../lib/api', () => ({
  api: {
    get: (endpoint: string) =>
      Promise.resolve({
        ok: true,
        json: async () => (endpoint === '/transactions' ? recargas : []),
      }),
  },
}));

const agora = new Date().toISOString();
const recarga = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  transaction_id: id,
  charge_point_id: 'ocpp',
  start_timestamp: agora,
  stop_timestamp: agora,
  consumed_wh: 10000,
  energia_kwh: 10,
  total_cost: 20,
  address: 'Brasília/DF',
  status: 'Completed',
  nomeDoLocal: 'Solutt Car',
  nomeDoCarregador: 'Solutt Car 01',
  ...extra,
});

describe('Transações — cliente de cada recarga', () => {
  beforeEach(() => {
    recargas = [];
  });

  it('mostra nome e celular de quem carregou, e "sem celular" quando o cadastro não tem', async () => {
    recargas = [
      recarga(1, {
        clienteNome: 'Maria Souza',
        clienteCelular: '(61) 99999-8888',
        clienteVisitante: false,
      }),
      recarga(2, { clienteNome: 'João Lima', clienteCelular: null, clienteVisitante: false }),
      recarga(3, { clienteNome: null, clienteCelular: null, clienteVisitante: true }),
    ];
    render(<Transactions />);

    expect(await screen.findByRole('columnheader', { name: 'Cliente' })).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('(61) 99999-8888')).toBeInTheDocument();
    expect(screen.getByText('João Lima')).toBeInTheDocument();
    expect(screen.getAllByText('sem celular')).toHaveLength(2);
    expect(screen.getByText('Visitante')).toBeInTheDocument();
  });

  it('busca pelo nome e pelo celular, mesmo digitado sem máscara', async () => {
    recargas = [
      recarga(1, { clienteNome: 'Maria Souza', clienteCelular: '(61) 99999-8888' }),
      recarga(2, { clienteNome: 'João Lima', clienteCelular: '(61) 98888-7777' }),
    ];
    render(<Transactions />);
    const busca = await screen.findByPlaceholderText(/Buscar por cliente/);

    await userEvent.type(busca, 'joão');
    await waitFor(() => expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument());
    expect(screen.getByText('João Lima')).toBeInTheDocument();

    await userEvent.clear(busca);
    await userEvent.type(busca, '999998888');
    await waitFor(() => expect(screen.queryByText('João Lima')).not.toBeInTheDocument());
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
  });

  it('sem o cliente na resposta (dono do condomínio), a coluna não aparece', async () => {
    recargas = [recarga(1)];
    render(<Transactions />);

    expect(await screen.findByText('Solutt Car')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Cliente' })).not.toBeInTheDocument();
  });
});
