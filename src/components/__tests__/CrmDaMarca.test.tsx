/**
 * Aba "Integração" da marca (dados por webhook): lê GET /admin/crm/:clientId e
 * /status (o cliente `api` já desembrulha o envelope). Os testes conferem que o
 * segredo nunca aparece (só o final), que o salvar manda só o que mudou e nunca
 * um segredo vazio, a remoção do segredo, o teste de envio, a chave da API de
 * consulta (mostrada uma vez, com confirmação para trocar) e a marca nova.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CrmDaMarca } from '../branding/CrmDaMarca';

const avisos = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: avisos }));

const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../lib/api', () => ({
  api: {
    get: (endpoint: string) => mockGet(endpoint),
    put: (endpoint: string, corpo: unknown) => mockPut(endpoint, corpo),
    post: (endpoint: string, corpo: unknown) => mockPost(endpoint, corpo),
    delete: (endpoint: string) => mockDelete(endpoint),
  },
}));

const ok = (corpo: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => corpo,
});

const CONFIG = {
  clientId: 'fulgo',
  provider: 'webhook',
  existe: true,
  webhookUrl: 'https://fulgo.example/webhooks',
  segredo: { configurado: true, ultimos4: 'abcd', legivel: true },
  ativo: true,
  enviarDesde: '2026-10-01',
  chaveApi: { configurada: true, prefixo: 'npk_AbCdEfGh', criadaEm: '2026-10-15T13:00:00.000Z' },
  ultimaSincronizacaoEm: '2026-10-20T12:00:00.000Z',
  ultimoResumo: null,
  ultimoErro: null,
  atualizadoEm: '2026-10-15T13:00:00.000Z',
};

const STATUS = {
  ativo: true,
  ultimaSincronizacaoEm: '2026-10-20T12:00:00.000Z',
  ultimoResumo: {
    gerados: 3,
    porTipo: { 'recarga.concluida': 3 },
    entregues: 2,
    retentar: 1,
    erros: 0,
    pausado: true,
    novosErros: [],
  },
  ultimoErro: null,
  eventos: { entregue: 40, retentar: 1, erro: 1 },
  ultimosErros: [
    {
      em: '2026-10-20T11:30:00.000Z',
      operacao: 'webhook:recarga.concluida',
      objeto: 'negocio',
      neopowerId: '124',
      http: 503,
      erro: 'HTTP 503: Service Unavailable',
    },
  ],
  eventosComErro: [
    {
      eventoId: 'evt_1',
      tipo: 'recarga.concluida',
      neopowerId: '123',
      status: 'erro',
      http: 400,
      erro: 'HTTP 400: campo "valor" inválido',
      tentativas: 1,
      proximaTentativaEm: null,
      em: '2026-10-20T11:00:00.000Z',
    },
  ],
  chamadas24h: { total: 50, comErro: 2 },
};

const CHAVE_NOVA = {
  chave: 'npk_chaveNovaQueSoApareceUmaVez123',
  prefixo: 'npk_chaveNov',
  aviso:
    'Guarde a chave agora: ela não será mostrada de novo. A anterior, se havia, deixou de valer.',
};

const carregado = () => screen.findByDisplayValue('https://fulgo.example/webhooks');
const campoDoSegredo = () => screen.getByLabelText('Segredo da assinatura');

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockReset();
  mockPut.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
  mockGet.mockImplementation(async (url: string) =>
    url.endsWith('/status') ? ok(STATUS) : ok(CONFIG)
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CrmDaMarca (integração de dados por webhook)', () => {
  it('carrega e mostra o estado, sem o segredo', async () => {
    render(<CrmDaMarca clientId="fulgo" />);
    await carregado();
    expect(mockGet).toHaveBeenCalledWith('/admin/crm/fulgo');
    expect(screen.getByText('Configurado · final abcd')).toBeInTheDocument();
    expect(campoDoSegredo()).toHaveValue('');
    expect(campoDoSegredo()).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Enviar desde')).toHaveValue('2026-10-01');
    expect(screen.getByRole('switch', { name: 'Ativo' })).toHaveAttribute('aria-checked', 'true');

    // API de consulta: só o prefixo da chave e a URL completa dos endpoints
    expect(screen.getByText('npk_AbCdEfGh…')).toBeInTheDocument();
    expect(screen.getByText(/^GET .+\/integracao\/v1\/clientes$/)).toBeInTheDocument();
    expect(screen.getByText(/^GET .+\/integracao\/v1\/recargas$/)).toBeInTheDocument();

    // Acompanhamento
    expect(await screen.findByText('Entregues: 40')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/admin/crm/fulgo/status');
    expect(screen.getByText('Na fila: 0')).toBeInTheDocument();
    expect(screen.getByText('Com erro: 1')).toBeInTheDocument();
    expect(
      screen.getByText(/3 gerado\(s\), 2 entregue\(s\), 1 em nova tentativa, 0 com erro/)
    ).toBeInTheDocument();
    expect(screen.getByText(/pausado por falhas seguidas/)).toBeInTheDocument();
    expect(screen.getByText(/campo "valor" inválido/)).toBeInTheDocument();
    expect(screen.getByText(/recarga\.concluida #123/)).toBeInTheDocument();
    expect(screen.getByText('HTTP 503: Service Unavailable')).toBeInTheDocument();
  });

  it('segredo ilegível pede para cadastrar de novo', async () => {
    mockGet.mockImplementation(async (url: string) =>
      url.endsWith('/status')
        ? ok(STATUS)
        : ok({ ...CONFIG, segredo: { configurado: true, ultimos4: null, legivel: false } })
    );
    render(<CrmDaMarca clientId="fulgo" />);
    expect(await screen.findByText(/Ilegível.*cadastre de novo/)).toBeInTheDocument();
  });

  it('salvar manda só o que mudou e nunca manda segredo vazio', async () => {
    mockPut.mockResolvedValue(
      ok({
        ...CONFIG,
        webhookUrl: 'https://fulgo.example/v2',
        aviso: 'Destino novo: o envio recomeça do zero a partir da data de início.',
      })
    );
    render(<CrmDaMarca clientId="fulgo" />);
    const campoDaUrl = await carregado();

    // Nada mudou: não chama a API.
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(mockPut).not.toHaveBeenCalled();
    expect(avisos.info).toHaveBeenCalled();

    // Segredo só com espaços não é segredo novo.
    await userEvent.type(campoDoSegredo(), '   ');
    await userEvent.clear(campoDaUrl);
    await userEvent.type(campoDaUrl, 'https://fulgo.example/v2');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut).toHaveBeenCalledWith('/admin/crm/fulgo', {
      webhookUrl: 'https://fulgo.example/v2',
    });
    await waitFor(() =>
      expect(avisos.warning).toHaveBeenCalledWith(
        expect.stringContaining('Destino novo'),
        expect.anything()
      )
    );
  });

  it('segredo digitado vai no salvar e o campo é limpo depois', async () => {
    mockPut.mockResolvedValue(
      ok({
        ...CONFIG,
        segredo: { configurado: true, ultimos4: 'WXYZ', legivel: true },
        enviarDesde: '2026-10-05',
        aviso: null,
      })
    );
    render(<CrmDaMarca clientId="fulgo" />);
    await carregado();

    await userEvent.type(campoDoSegredo(), 'whsec_novoSegredoWXYZ');
    fireEvent.change(screen.getByLabelText('Enviar desde'), { target: { value: '2026-10-05' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut.mock.calls[0][1]).toEqual({
      segredo: 'whsec_novoSegredoWXYZ',
      enviarDesde: '2026-10-05',
    });
    await waitFor(() => expect(campoDoSegredo()).toHaveValue(''));
    expect(screen.getByText('Configurado · final WXYZ')).toBeInTheDocument();
    expect(avisos.warning).not.toHaveBeenCalled();
  });

  it('remover segredo pede confirmação e manda só removerSegredo', async () => {
    const confirmar = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    mockPut.mockResolvedValue(
      ok({
        ...CONFIG,
        ativo: false,
        segredo: { configurado: false, ultimos4: null, legivel: true },
        aviso: null,
      })
    );
    render(<CrmDaMarca clientId="fulgo" />);
    await carregado();
    await userEvent.type(campoDoSegredo(), 'whsec_digitadoAgora');

    // Cancelou: nada vai.
    await userEvent.click(screen.getByRole('button', { name: 'Remover segredo' }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(mockPut).not.toHaveBeenCalled();

    // Confirmou: só o pedido de remoção, sem o segredo digitado.
    await userEvent.click(screen.getByRole('button', { name: 'Remover segredo' }));
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut).toHaveBeenCalledWith('/admin/crm/fulgo', { removerSegredo: true });
    expect(await screen.findByText('Não configurado')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Ativo' })).toHaveAttribute('aria-checked', 'false');
    expect(campoDoSegredo()).toHaveValue('');
  });

  it('enviar teste usa o que foi digitado e mostra o resultado', async () => {
    mockPost
      .mockResolvedValueOnce(
        ok({ ok: true, http: 200, ms: 85, detalhe: 'Recebido (HTTP 200) em 85 ms.' })
      )
      .mockResolvedValueOnce(
        ok({ ok: false, http: 401, ms: 120, detalhe: 'HTTP 401: assinatura inválida' })
      );
    render(<CrmDaMarca clientId="fulgo" />);
    await carregado();

    // Sem segredo digitado: a API usa o salvo.
    await userEvent.click(screen.getByRole('button', { name: 'Enviar teste' }));
    expect(await screen.findByText('Teste entregue')).toBeInTheDocument();
    expect(screen.getByText('HTTP 200 · 85 ms')).toBeInTheDocument();
    expect(mockPost).toHaveBeenLastCalledWith('/admin/crm/fulgo/testar', {
      webhookUrl: 'https://fulgo.example/webhooks',
    });

    await userEvent.type(campoDoSegredo(), 'whsec_digitado');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar teste' }));
    expect(await screen.findByText('Teste falhou')).toBeInTheDocument();
    expect(screen.getByText('HTTP 401 · 120 ms')).toBeInTheDocument();
    expect(screen.getByText('HTTP 401: assinatura inválida')).toBeInTheDocument();
    expect(mockPost).toHaveBeenLastCalledWith('/admin/crm/fulgo/testar', {
      webhookUrl: 'https://fulgo.example/webhooks',
      segredo: 'whsec_digitado',
    });
  });

  it('trocar a chave pede confirmação e mostra a nova uma vez só', async () => {
    const confirmar = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const gravar = vi.spyOn(Storage.prototype, 'setItem');
    mockPost.mockResolvedValue(ok(CHAVE_NOVA));
    render(<CrmDaMarca clientId="fulgo" />);
    await carregado();

    await userEvent.click(screen.getByRole('button', { name: 'Trocar chave' }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Trocar chave' }));
    expect(await screen.findByText(CHAVE_NOVA.chave)).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/crm/fulgo/chave-api', {});
    expect(screen.getByText(/Guarde a chave agora/)).toBeInTheDocument();
    expect(screen.getByText('npk_chaveNov…')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Já guardei' }));
    expect(screen.queryByText(CHAVE_NOVA.chave)).not.toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();
  });

  it('sem chave, gerar não pede confirmação', async () => {
    mockGet.mockImplementation(async (url: string) =>
      url.endsWith('/status')
        ? ok(STATUS)
        : ok({ ...CONFIG, chaveApi: { configurada: false, prefixo: null, criadaEm: null } })
    );
    const confirmar = vi.spyOn(window, 'confirm');
    mockPost.mockResolvedValue(ok(CHAVE_NOVA));
    render(<CrmDaMarca clientId="fulgo" />);
    expect(await screen.findByText('Nenhuma chave gerada')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    expect(await screen.findByText(CHAVE_NOVA.chave)).toBeInTheDocument();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('revogar a chave pede confirmação e manda DELETE', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockDelete.mockResolvedValue(ok({ revogada: true }));
    render(<CrmDaMarca clientId="fulgo" />);
    await carregado();

    await userEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/admin/crm/fulgo/chave-api'));
    expect(await screen.findByText('Nenhuma chave gerada')).toBeInTheDocument();
  });

  it('marca nova (404): pede para salvar a marca primeiro, sem erro', async () => {
    mockGet.mockResolvedValue(ok({ success: false, error: 'Marca não encontrada.' }, 404));
    render(<CrmDaMarca clientId="nova-marca" />);
    expect(await screen.findByText(/Salve a marca primeiro/)).toBeInTheDocument();
    expect(avisos.error).not.toHaveBeenCalled();
  });
});
