/**
 * Cupom de preço por kWh (FulGo, 11/11/2026): "preço de custo para os sócios",
 * R$ 0,72 por kWh. A lista mostra o valor como preço do kWh, e não como
 * desconto em reais.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Vouchers } from '../Vouchers';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const cupons = [
  {
    id: 24,
    code: '202682',
    name: 'Socios T82',
    description: 'Preço de custo para os sócios',
    type: 'preco_kwh',
    value: 0.72,
    is_active: true,
    total_quantity: null,
    used_quantity: 0,
    location_id: 61,
    charger_id: null,
    somente_visitante: false,
  },
];

vi.mock('../../lib/api', () => ({
  api: {
    get: (endpoint: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          endpoint === '/vouchers' ? cupons : endpoint === '/locations/all' ? { locations: [] } : [],
      }),
  },
}));

describe('Cupons — preço por kWh', () => {
  it('mostra o cupom como preço do kWh', async () => {
    render(<Vouchers />);
    expect(await screen.findByText('Socios T82')).toBeInTheDocument();
    expect(screen.getByText('Preço por kWh')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*0,72\s*\/kWh/)).toBeInTheDocument();
  });
});
