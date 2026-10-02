/**
 * Erros do app: a tela lê GET /app/erros e /app/erros/resumo (o cliente `api`
 * já desembrulha o envelope). Os testes conferem o que vai na query, o resumo,
 * a tabela, o detalhe e os avisos de API sem a rota (404) e de acesso negado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ErrosDoApp } from '../ErrosDoApp';
import type { PaginaDeRelatos, RelatoDeErro, ResumoDeErros } from '../../lib/errosDoApp';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockGet = vi.fn();
vi.mock('../../lib/api', () => ({
  api: { get: (endpoint: string) => mockGet(endpoint) },
}));

const MENSAGEM = "TypeError: Cannot read property 'id' of undefined";
const PILHA = 'at ChargingInProgressScreen (index.bundle:1:2345)';

const relato = (over: Partial<RelatoDeErro> = {}): RelatoDeErro => ({
  id: 7,
  criadoEm: '2026-10-02T12:00:00.000Z',
  ocorridoEm: '2026-10-02T09:00:00.000Z',
  tipo: 'js_fatal',
  mensagem: MENSAGEM,
  pilha: PILHA,
  fatal: true,
  tela: 'ChargingInProgress',
  clientId: 'vipenergy',
  appVersao: '1.0.6',
  appBuild: '12',
  updateId: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  canal: 'production',
  runtime: '1.0.6',
  plataforma: 'ios',
  osVersao: '18.1',
  modelo: 'iPhone 13',
  appId: 'com.vipenergy.app',
  embutida: false,
  emergencia: false,
  userId: 42,
  contexto: { codigo: 'E-1A2B3C', execucao: 'lx1-abc' },
  ...over,
});

const PAGINA: PaginaDeRelatos = {
  itens: [
    relato(),
    relato({
      id: 8,
      tipo: 'encerramento_abrupto',
      mensagem: 'O app fechou em primeiro plano sem erro de JS.',
      pilha: null,
      clientId: 'neopower-default',
      plataforma: 'android',
      osVersao: '14',
      userId: null,
      embutida: true,
      updateId: null,
      ocorridoEm: '2026-10-02T11:59:00.000Z',
      tela: 'Home',
      // Encerramento abrupto não tem código: o JS não viu a falha.
      contexto: { execucao: 'lx0-xyz', ultimoSinalDeVida: '2026-10-02T11:59:00.000Z' },
    }),
  ],
  total: 2,
  pagina: 1,
  porPagina: 25,
};

const RESUMO: ResumoDeErros = {
  desde: '2026-09-25T12:00:00.000Z',
  porVersao: [
    { appVersao: '1.0.6', appBuild: '12', plataforma: 'ios', total: 3 },
    { appVersao: '1.0.5', appBuild: '9', plataforma: 'android', total: 1 },
  ],
  porTipo: [
    { tipo: 'js_fatal', total: 3 },
    { tipo: 'encerramento_abrupto', total: 1 },
  ],
};

const resposta = (status: number, corpo: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  });

const configurar = ({
  lista = PAGINA,
  statusDaLista = 200,
  corpoDoErro = { success: false, error: 'Falhou' } as unknown,
  marcas = [{ clientId: 'vipenergy', companyName: 'Vip Energy' }],
}: {
  lista?: PaginaDeRelatos;
  statusDaLista?: number;
  corpoDoErro?: unknown;
  marcas?: Array<{ clientId: string; companyName: string }>;
} = {}) => {
  mockGet.mockImplementation((endpoint: string) => {
    if (endpoint === '/admin/branding') return resposta(200, marcas);
    if (endpoint === '/app/erros/resumo') return resposta(200, RESUMO);
    if (endpoint.startsWith('/app/erros?')) {
      return statusDaLista === 200 ? resposta(200, lista) : resposta(statusDaLista, corpoDoErro);
    }
    return resposta(404, {});
  });
};

const renderizar = (url = '/erros-do-app') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ErrosDoApp />
    </MemoryRouter>
  );

/** Query de cada GET /app/erros feito até agora. */
const consultasDaLista = () =>
  mockGet.mock.calls
    .map(c => String(c[0]))
    .filter(e => e.startsWith('/app/erros?'))
    .map(e => new URLSearchParams(e.slice(e.indexOf('?') + 1)));

const ultimaConsulta = () => consultasDaLista().slice(-1)[0];

beforeEach(() => {
  mockGet.mockReset();
});

describe('Erros do app', () => {
  it('mostra os relatos com a marca pelo nome, a versão, a OTA e o usuário', async () => {
    configurar();
    renderizar();

    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText(MENSAGEM)).toBeInTheDocument();
    expect(within(tabela).getByText('Vip Energy')).toBeInTheDocument();
    // neopower-default não está em /admin/branding: aparece como NeoPower.
    expect(within(tabela).getByText('NeoPower')).toBeInTheDocument();
    expect(within(tabela).getByText('OTA a1b2c3d4')).toBeInTheDocument();
    expect(within(tabela).getByText('JS do binário')).toBeInTheDocument();
    expect(within(tabela).getByText('#42')).toBeInTheDocument();
    expect(within(tabela).getByText('sem login')).toBeInTheDocument();
    expect(within(tabela).getByText('ChargingInProgress · E-1A2B3C')).toBeInTheDocument();
    // O crash das 09:00 só chegou ao meio-dia, quando o app abriu de novo.
    expect(within(tabela).getByText('chegou 3 h depois')).toBeInTheDocument();
  });

  it('mostra o resumo dos 7 dias por tipo e por versão', async () => {
    configurar();
    renderizar();

    const fatal = await screen.findByRole('button', { name: /Erro fatal de JS\s*3/ });
    expect(fatal).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Fechou sozinho\s*1/ })).toBeInTheDocument();
    expect(screen.getByText('4 derrubaram o app')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1\.0\.6 \(12\)\s*iOS\s*3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1\.0\.5 \(9\)\s*Android\s*1/ })).toBeInTheDocument();
  });

  it('manda para a API os filtros que vieram na URL', async () => {
    configurar();
    const antes = Date.now();
    renderizar('/erros-do-app?marca=vipenergy&versao=1.0.6&tipo=boundary&periodo=30d&pagina=2');

    await waitFor(() => expect(consultasDaLista().length).toBeGreaterThan(0));
    const q = consultasDaLista()[0];
    expect(q.get('clientId')).toBe('vipenergy');
    expect(q.get('versao')).toBe('1.0.6');
    expect(q.get('tipo')).toBe('boundary');
    expect(q.get('pagina')).toBe('2');
    expect(q.get('porPagina')).toBe('25');
    const desde = Date.parse(q.get('desde') ?? '');
    const trintaDias = 30 * 24 * 60 * 60 * 1000;
    expect(desde).toBeGreaterThanOrEqual(antes - trintaDias - 1000);
    expect(desde).toBeLessThanOrEqual(Date.now() - trintaDias + 1000);
  });

  it('mostra o clientId no filtro de marca quando o nome se repete', async () => {
    // A NeoPower existe como 'neo' (configuração) e 'neopower-default' (build do app).
    configurar({
      marcas: [
        { clientId: 'neo', companyName: 'NeoPower' },
        { clientId: 'neopower-default', companyName: 'NeoPower' },
        { clientId: 'vipenergy', companyName: 'Vip Energy' },
      ],
    });
    renderizar('/erros-do-app?marca=neo');

    const filtro = screen.getByRole('combobox', { name: 'Marca' });
    await waitFor(() => expect(filtro).toHaveTextContent('NeoPower (neo)'));
    await waitFor(() => expect(ultimaConsulta()?.get('clientId')).toBe('neo'));
  });

  it('mostra só o nome no filtro de marca quando ele é único', async () => {
    configurar();
    renderizar('/erros-do-app?marca=vipenergy');

    const filtro = screen.getByRole('combobox', { name: 'Marca' });
    await waitFor(() => expect(filtro).toHaveTextContent('Vip Energy'));
    expect(filtro).not.toHaveTextContent('vipenergy');
  });

  it('filtra pelo tipo ao clicar no resumo e tira o filtro no segundo clique', async () => {
    configurar();
    const user = userEvent.setup();
    renderizar();

    const fechou = await screen.findByRole('button', { name: /Fechou sozinho\s*1/ });
    await screen.findByRole('table');

    await user.click(fechou);
    await waitFor(() => expect(ultimaConsulta().get('tipo')).toBe('encerramento_abrupto'));
    expect(ultimaConsulta().get('pagina')).toBe('1');
    expect(screen.getByRole('button', { name: /Fechou sozinho\s*1/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await user.click(screen.getByRole('button', { name: /Fechou sozinho\s*1/ }));
    await waitFor(() => expect(ultimaConsulta().has('tipo')).toBe(false));
  });

  it('filtra pela versão ao clicar na linha do resumo', async () => {
    configurar();
    const user = userEvent.setup();
    renderizar();

    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /1\.0\.5 \(9\)\s*Android\s*1/ }));
    await waitFor(() => expect(ultimaConsulta().get('versao')).toBe('1.0.5'));
  });

  it('abre o detalhe com a pilha, o contexto e o update ID completo', async () => {
    configurar();
    const user = userEvent.setup();
    renderizar();

    const tabela = await screen.findByRole('table');
    await user.click(within(tabela).getByText(MENSAGEM));

    const detalhe = await screen.findByRole('dialog');
    expect(within(detalhe).getByText(PILHA)).toBeInTheDocument();
    expect(within(detalhe).getByText(/"execucao": "lx1-abc"/)).toBeInTheDocument();
    expect(within(detalhe).getByText('a1b2c3d4-e5f6-7890-abcd-ef0123456789')).toBeInTheDocument();
    expect(within(detalhe).getByText('iPhone 13')).toBeInTheDocument();
    expect(within(detalhe).getByRole('button', { name: /copiar relato/i })).toBeInTheDocument();
  });

  it('explica a falta de pilha no encerramento abrupto', async () => {
    configurar();
    const user = userEvent.setup();
    renderizar();

    const tabela = await screen.findByRole('table');
    await user.click(within(tabela).getByText('O app fechou em primeiro plano sem erro de JS.'));

    const detalhe = await screen.findByRole('dialog');
    expect(within(detalhe).getByText(/o app caiu fora do JS/)).toBeInTheDocument();
  });

  it('pagina pela API', async () => {
    configurar({ lista: { ...PAGINA, total: 60 } });
    const user = userEvent.setup();
    renderizar();

    await screen.findByRole('table');
    expect(screen.getByText(/1–25/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /próxima/i }));
    await waitFor(() => expect(ultimaConsulta().get('pagina')).toBe('2'));
  });

  it('avisa quando a API ainda não tem a rota (404)', async () => {
    configurar({ statusDaLista: 404 });
    renderizar();

    expect(
      await screen.findByText(/ainda não recebe os relatórios de erro do app/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('mostra a mensagem da API quando o acesso é negado (403)', async () => {
    configurar({
      statusDaLista: 403,
      corpoDoErro: {
        success: false,
        error: 'Este módulo está disponível só para a NeoPower por enquanto.',
      },
    });
    renderizar();

    expect(
      await screen.findByText('Este módulo está disponível só para a NeoPower por enquanto.')
    ).toBeInTheDocument();
  });

  it('diz quando não há relato no período', async () => {
    configurar({ lista: { itens: [], total: 0, pagina: 1, porPagina: 25 } });
    renderizar();

    expect(await screen.findByText('Nenhum erro recebido no período')).toBeInTheDocument();
  });
});
