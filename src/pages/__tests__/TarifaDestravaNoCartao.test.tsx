/**
 * Tarifas: a taxa de destrava se edita no próprio cartão do local (Alterar),
 * ao lado do mínimo e do saldo para iniciar. Antes ela só existia em "Nova
 * Tarifa › Opções avançadas", e na Power Link o R$ 1,00 da partida foi parar
 * em "saldo p/ iniciar", que não cobra nada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Tariffs } from '../Tariffs';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin', clientId: null } }),
}));
vi.mock('../Profiles', () => ({ Profiles: () => null }));

const resposta = (corpo: unknown, ok = true) => ({ ok, json: async () => corpo });

let destravaAtual: string | null = null;

const mockGet = vi.fn(async (rota: string) => {
  if (rota === '/locations/all')
    return resposta({ locations: [{ id: 60, nomeDoLocal: 'Power Link', endereco: 'Avenida Castelo Branco' }] });
  if (rota === '/tariffs/all')
    return resposta([
      { id: 1, price_per_kwh: '1.9900', location_address: null, location_id: null, created_at: '2026-10-01T00:00:00Z', is_current: true },
      {
        id: 116,
        price_per_kwh: '1.4900',
        min_price: '0.00',
        connection_fee: destravaAtual,
        saldo_minimo_inicio: '1.00',
        location_address: 'Avenida Castelo Branco',
        location_id: 60,
        created_at: '2026-10-27T20:14:29Z',
        is_current: true,
      },
    ]);
  return resposta([]);
});
const mockPost = vi.fn(async (_rota: string, _corpo: unknown) => resposta({ success: true }));

vi.mock('../../lib/api', () => ({
  api: {
    get: (rota: string) => mockGet(rota),
    post: (rota: string, corpo: unknown) => mockPost(rota, corpo),
    put: vi.fn(async () => resposta({})),
    delete: vi.fn(async () => resposta({})),
  },
}));

const abrirCartaoDaPowerLink = async () => {
  render(
    <MemoryRouter>
      <Tariffs />
    </MemoryRouter>
  );
  const nome = await screen.findByText('Power Link');
  const cartao = nome.closest('div.rounded-2xl, article, li, section') as HTMLElement | null;
  const alvo = cartao ?? (nome.parentElement?.parentElement?.parentElement as HTMLElement);
  await userEvent.click(within(alvo).getByRole('button', { name: /Alterar/ }));
  return screen.getByLabelText('Taxa de destrava') as HTMLInputElement;
};

describe('Tarifas: taxa de destrava no cartão do local', () => {
  beforeEach(() => {
    destravaAtual = null;
    mockGet.mockClear();
    mockPost.mockClear();
  });

  it('digitar a destrava no cartão salva a taxa no mesmo local', async () => {
    const campo = await abrirCartaoDaPowerLink();
    expect(campo.value).toBe('');

    await userEvent.type(campo, '1');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [rota, corpo] = mockPost.mock.calls[0];
    expect(rota).toBe('/tariffs');
    expect(corpo).toMatchObject({ locationId: 60, newPrice: 1.49, connectionFee: 1, saldoMinimoInicio: 1 });
  });

  it('o cartão abre com a destrava atual e a mantém ao mudar só o preço', async () => {
    destravaAtual = '2.99';
    const campo = await abrirCartaoDaPowerLink();
    expect(campo.value).toBe('2.99');

    const preco = screen.getByLabelText('Preço por kWh');
    await userEvent.clear(preco);
    await userEvent.type(preco, '1.59');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(mockPost.mock.calls[0][1]).toMatchObject({ locationId: 60, newPrice: 1.59, connectionFee: 2.99 });
  });

  it('apagar o campo tira a destrava (0), como o mínimo', async () => {
    destravaAtual = '1.00';
    const campo = await abrirCartaoDaPowerLink();
    await userEvent.clear(campo);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(mockPost.mock.calls[0][1]).toMatchObject({ locationId: 60, connectionFee: 0 });
  });
});
