/**
 * Melhores clientes nos Indicadores (pedido do dono, 19/11/2026): quem mais
 * gastou, carregou e recarregou no período, para premiar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MelhoresClientes } from '../indicadores/MelhoresClientes';

const pedidos: string[] = [];
vi.mock('../../lib/api', () => ({
  api: {
    get: (endpoint: string) => {
      pedidos.push(endpoint);
      const busca = new URLSearchParams(endpoint.split('?')[1]);
      const limite = Number(busca.get('limite'));
      const clientes = Array.from({ length: Math.min(limite, 12) }, (_, i) => ({
        posicao: i + 1,
        userId: 100 + i,
        nome: i === 0 ? 'Ana Souza' : `Cliente ${i + 1}`,
        celular: i === 0 ? '(61) 99999-8888' : null,
        recargas: 20 - i,
        kwh: 300 - i * 10,
        consumido: 450 - i * 15,
        ticketMedio: 22.5,
        ultimaRecarga: '2026-11-18T20:00:00.000Z',
      }));
      return Promise.resolve({
        ok: true,
        json: async () => ({
          periodo: { inicio: busca.get('startDate'), fim: busca.get('endDate') },
          ordem: busca.get('ordem'),
          clientes,
          totais: { clientes: 12, recargas: 174, kwh: 2940, consumido: 4410 },
        }),
      });
    },
  },
}));

const exportToCSV = vi.fn();
vi.mock('../../lib/export', () => ({ exportToCSV: (o: unknown) => exportToCSV(o) }));

const busca = (i: number) => new URLSearchParams(pedidos[i].split('?')[1]);

beforeEach(() => {
  pedidos.length = 0;
  exportToCSV.mockClear();
});

describe('Melhores clientes', () => {
  it('mostra o ranking do mês, com o 1º em destaque, nome e celular', async () => {
    render(
      <MelhoresClientes inicio="2026-11-01" fim="2026-11-30" rotuloDoPeriodo="Novembro de 2026" />
    );

    const cartao = await screen.findByRole('region', { name: 'Melhores clientes' });
    expect(await within(cartao).findByText('Ana Souza')).toBeInTheDocument();
    expect(cartao).toHaveTextContent('em Novembro de 2026');
    expect(busca(0).get('startDate')).toBe('2026-11-01');
    expect(busca(0).get('endDate')).toBe('2026-11-30');
    expect(busca(0).get('ordem')).toBe('consumido');
    expect(busca(0).get('limite')).toBe('10');

    const primeira = within(cartao).getByText('Ana Souza').closest('tr')!;
    expect(primeira).toHaveTextContent('1º');
    expect(primeira).toHaveTextContent('(61) 99999-8888');
    expect(primeira).toHaveTextContent('R$ 450,00');
    expect(within(cartao).getByText('Cliente 2').closest('tr')).toHaveTextContent('sem celular');
    expect(cartao).toHaveTextContent('12 clientes no período');
    expect(cartao).toHaveTextContent('Visitantes e contas da equipe ficam fora');
  });

  it('troca a ordem e mostra mais clientes', async () => {
    render(<MelhoresClientes inicio="2026-11-01" fim="2026-11-30" />);
    const cartao = await screen.findByRole('region', { name: 'Melhores clientes' });
    await within(cartao).findByText('Ana Souza');

    await userEvent.click(within(cartao).getByRole('button', { name: 'Quem mais carregou (kWh)' }));
    await waitFor(() => expect(busca(pedidos.length - 1).get('ordem')).toBe('kwh'));

    await userEvent.click(within(cartao).getByRole('button', { name: 'Quem mais recarregou' }));
    await waitFor(() => expect(busca(pedidos.length - 1).get('ordem')).toBe('recargas'));

    await userEvent.click(within(cartao).getByRole('button', { name: 'Ver os 12 primeiros' }));
    await waitFor(() => expect(busca(pedidos.length - 1).get('limite')).toBe('50'));
    expect(await within(cartao).findByText('Cliente 12')).toBeInTheDocument();
  });

  it('exporta a lista com celular, para entrar em contato com o premiado', async () => {
    render(<MelhoresClientes inicio="2026-11-01" fim="2026-11-30" />);
    const cartao = await screen.findByRole('region', { name: 'Melhores clientes' });
    await within(cartao).findByText('Ana Souza');

    await userEvent.click(within(cartao).getByRole('button', { name: /Exportar/ }));
    const [opcoes] = exportToCSV.mock.calls[0];
    expect(opcoes.filename).toBe('melhores_clientes_2026-11-01_a_2026-11-30');
    expect(opcoes.data[0]).toMatchObject({
      posicao: 1,
      nome: 'Ana Souza',
      celular: '(61) 99999-8888',
    });
  });

  it('sem período fixo, pede os últimos 30 dias', async () => {
    render(<MelhoresClientes />);
    await screen.findByRole('region', { name: 'Melhores clientes' });
    await waitFor(() => expect(pedidos.length).toBeGreaterThan(0));
    const de = new Date(`${busca(0).get('startDate')}T00:00:00`);
    const ate = new Date(`${busca(0).get('endDate')}T00:00:00`);
    expect(Math.round((ate.getTime() - de.getTime()) / 86_400_000)).toBe(29);
  });
});
