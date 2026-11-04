import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Operadores de Manaus não veem a comissão da NeoPower (04/11/2026). A API tira
 * comissão e repasse da resposta e manda `comissaoOculta`; a tela não pode
 * calcular os 5% por conta própria, como faz com a API antiga.
 */

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 1865, name: 'Operador St5', role: 'operador', clientId: null, branding: null },
  }),
}));

const linha = {
  Estação: 'Studio 5',
  Início: '02/10/2026, 10:35:08',
  Fim: '02/10/2026, 11:26:21',
  'Recarga (kWh)': '33.89',
  'Receita (R$)': '52.53',
  Status: 'Completed',
  numero: 95,
  carregador: 'Studio 5',
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
  situacao: 'Concluída',
};

const total = {
  quantidade: 1,
  energiaKwh: 33.89,
  valorCobrado: 52.53,
  debitoCarteira: 52.53,
  receita: 52.53,
  conferidas: 1,
};

const RELATORIO = {
  items: [linha],
  recargasCruzadas: null,
  comissaoOculta: true,
  local: {
    id: 13,
    nome: 'Studio 5 Shopping',
    endereco: 'Av. Rodrigo Otávio - Manaus/AM',
    cidade: 'Manaus',
    estado: 'AM',
    marca: 'neopower-default',
    fuso: 'America/Manaus',
    fusoOrigem: 'estado',
    fusoRotulo: 'Manaus (UTC-4)',
    carregadores: [{ id: 'Studio 5', descricao: null, modelo: null, potenciaKw: 120 }],
  },
  porTipoDeConta: { todas: total, clientes: total, internas: { ...total, quantidade: 0 } },
  criterioContaInterna: null,
};

vi.mock('../../lib/pdfDoLocal', () => ({
  visualDaMarca: vi.fn(),
  gerarPdfDoLocal: vi.fn(),
  gerarPdfDoCarregador: vi.fn(),
  gerarZipDosCarregadores: vi.fn(),
  nomeDoArquivoDoCarregador: vi.fn(),
}));

const resposta = (corpo: unknown) => ({ ok: true, json: async () => corpo }) as Response;

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(async (endpoint: string) => {
      if (endpoint.startsWith('/locations/all')) {
        return resposta({
          locations: [
            { id: 13, nomeDoLocal: 'Studio 5 Shopping', cidade: 'Manaus', estado: 'AM', clientId: null },
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
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

import { FinancialReport } from '../FinancialReport';

const SEM_COMISSAO = /comiss|repasse|repassa|\b95\s?%|\b5\s?%/i;

describe('Relatório financeiro com a comissão oculta', () => {
  it('relatório do local: só o consumido, sem comissão, repasse nem percentual', async () => {
    render(
      <MemoryRouter initialEntries={['/financeiro?locationId=13']}>
        <FinancialReport />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Relatório de recargas/)).toBeInTheDocument();
    expect(screen.getAllByText('Consumido em recargas').length).toBeGreaterThan(0);
    expect(screen.getByText('TOTAL — todas as recargas')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(SEM_COMISSAO);
  });

  it('visão geral das estações: também sem nenhum sinal da comissão', async () => {
    render(
      <MemoryRouter initialEntries={['/financeiro']}>
        <FinancialReport />
      </MemoryRouter>
    );
    expect((await screen.findAllByText('Consumido em recargas')).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(SEM_COMISSAO);
  });
});
