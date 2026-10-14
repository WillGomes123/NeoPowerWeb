/**
 * Aba "CRM (HubSpot)" da marca: lê GET /admin/crm/:clientId e /status (o
 * cliente `api` já desembrulha o envelope). Os testes conferem que o token
 * nunca aparece (só o final), o que vai no salvar e no testar, o resultado do
 * teste, a lista de erros e a marca nova (ainda não salva).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CrmDaMarca } from '../branding/CrmDaMarca';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();
vi.mock('../../lib/api', () => ({
  api: {
    get: (endpoint: string) => mockGet(endpoint),
    put: (endpoint: string, corpo: unknown) => mockPut(endpoint, corpo),
    post: (endpoint: string, corpo: unknown) => mockPost(endpoint, corpo),
  },
}));

const ok = (corpo: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => corpo,
});

const CONFIG = {
  clientId: 'fulgo',
  existe: true,
  token: { configurado: true, ultimos4: 'abcd', legivel: true },
  pipelineId: 'pipe-1',
  estagios: { concluida: 'st-ok', cancelada: 'st-cancel', estornada: 'st-estorno' },
  ativo: true,
  enviarDesde: '2026-10-01',
  ultimaSincronizacaoEm: '2026-10-10T12:00:00.000Z',
  atualizadoEm: null,
};

const STATUS = {
  ativo: true,
  ultimaSincronizacaoEm: '2026-10-10T12:00:00.000Z',
  ultimoResumo: {
    contatos: { enviado: 2, retentar: 0, erro: 0, ignorado: 0 },
    negocios: { enviado: 5, retentar: 1, erro: 0, ignorado: 0 },
    associacoes: { ok: 3, pendente: 0, erro: 0 },
    abortado: null,
  },
  ultimoErro: null,
  contagens: { contato: { enviado: 10 }, negocio: { enviado: 40, erro: 1 } },
  associacoes: { ok: 30 },
  ultimosErros: [],
  registrosComErro: [
    {
      objeto: 'negocio',
      neopowerId: '123',
      status: 'erro',
      http: 400,
      erro: 'Property "forma_pagamento" is not a valid option',
      tentativas: 0,
      proximaTentativaEm: null,
      em: '2026-10-10T11:00:00.000Z',
    },
  ],
  chamadas24h: { total: 50, comErro: 1 },
};

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation(async (url: string) =>
    url.endsWith('/status') ? ok(STATUS) : ok(CONFIG)
  );
});

describe('CrmDaMarca', () => {
  it('mostra a situação, os erros e só o final do token', async () => {
    render(<CrmDaMarca clientId="fulgo" />);
    expect(await screen.findByText('Integração ligada')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/admin/crm/fulgo');
    expect(await screen.findByText(/forma_pagamento/)).toBeInTheDocument();
    expect(screen.getByText(/Recarga #123/)).toBeInTheDocument();
    const token = screen.getByPlaceholderText(/Token salvo \(…abcd\)/);
    expect(token).toHaveValue('');
    expect(screen.getByDisplayValue('pipe-1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('st-estorno')).toBeInTheDocument();
  });

  it('salvar sem digitar token mantém o salvo (não manda token)', async () => {
    mockPut.mockResolvedValue(ok(CONFIG));
    render(<CrmDaMarca clientId="fulgo" />);
    await screen.findByText('Integração ligada');
    await userEvent.click(screen.getByRole('button', { name: /Salvar integração/ }));
    await waitFor(() => expect(mockPut).toHaveBeenCalled());
    const [url, corpo] = mockPut.mock.calls[0];
    expect(url).toBe('/admin/crm/fulgo');
    expect(corpo).not.toHaveProperty('token');
    expect(corpo).toMatchObject({
      pipelineId: 'pipe-1',
      estagios: { concluida: 'st-ok', cancelada: 'st-cancel', estornada: 'st-estorno' },
      ativo: true,
      enviarDesde: '2026-10-01',
    });
  });

  it('testar conexão com o token digitado mostra cada verificação', async () => {
    mockPost.mockResolvedValue(
      ok({
        ok: false,
        hubId: 4242,
        verificacoes: [
          {
            nome: 'Escopos do token',
            ok: false,
            http: 200,
            detalhe: 'Faltam no app privado: crm.objects.deals.write.',
          },
          { nome: 'Ler contatos (crm.objects.contacts.read)', ok: true, http: 200, detalhe: 'OK' },
        ],
      })
    );
    render(<CrmDaMarca clientId="fulgo" />);
    await screen.findByText('Integração ligada');
    await userEvent.type(screen.getByPlaceholderText(/Token salvo/), 'pat-na1-novo');
    await userEvent.click(screen.getByRole('button', { name: /Testar conexão/ }));
    expect(await screen.findByText('Conexão com pendências')).toBeInTheDocument();
    expect(screen.getByText(/crm.objects.deals.write/)).toBeInTheDocument();
    expect(screen.getByText(/conta HubSpot 4242/)).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith(
      '/admin/crm/fulgo/testar',
      expect.objectContaining({ token: 'pat-na1-novo', pipelineId: 'pipe-1' })
    );
  });

  it('marca nova (404): pede para salvar a marca primeiro, sem erro', async () => {
    mockGet.mockResolvedValue(ok({ success: false, error: 'Marca não encontrada.' }, 404));
    render(<CrmDaMarca clientId="nova-marca" />);
    expect(await screen.findByText(/Salve a marca primeiro/)).toBeInTheDocument();
  });
});
