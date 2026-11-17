/**
 * Moldura do painel no redesenho de nov/2026: menu lateral agrupado
 * (Visão Geral, Gestão, Financeiro, Configurações), item ativo marcado,
 * itens da plataforma escondidos das marcas e a conta com "Sair".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { DashboardLayout } from '../DashboardLayout';

const estado = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  logout: vi.fn(),
  navigate: vi.fn(),
  toggleTheme: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: estado.user, logout: estado.logout }),
}));
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...real, useNavigate: () => estado.navigate };
});
vi.mock('../../contexts/TenantContext', () => ({
  useTenant: () => ({
    isDark: false,
    toggleTheme: estado.toggleTheme,
    tenantBranding: { companyName: 'NeoPower', logoType: 'programmatic' },
  }),
}));
vi.mock('../NotificationBell', () => ({
  NotificationBell: () => <button>Notificações do topo</button>,
}));
vi.mock('../KairosPanel', () => ({ KairosPanel: () => <div>Painel do Kairos</div> }));

const plataforma = { id: 1, name: 'Lauriane Macedo', email: 'l@neo.com', role: 'admin' };
const operadorDaMarca = {
  id: 2,
  name: 'Op Vip',
  email: 'op@vip.com',
  role: 'operador',
  clientId: 'vipenergy',
};

const abrir = (rota = '/') =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <DashboardLayout>
        <p>Conteúdo da página</p>
      </DashboardLayout>
    </MemoryRouter>
  );

const menu = () => within(screen.getByRole('navigation', { name: 'Menu principal' }));

describe('DashboardLayout (redesenho)', () => {
  beforeEach(() => {
    estado.user = plataforma;
    estado.logout.mockClear();
    estado.navigate.mockClear();
    estado.toggleTheme.mockClear();
  });

  it('mostra a marca, o conteúdo e a conta com nome e papel', () => {
    abrir();
    expect(screen.getByText('NeoPower')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument();
    expect(screen.getByText('Lauriane Macedo')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('tem os quatro blocos do Figma e marca a Visão Geral como ativa na raiz', () => {
    abrir('/');
    const visao = menu().getByRole('link', { name: 'Visão Geral' });
    expect(visao).toHaveAttribute('aria-current', 'page');
    for (const grupo of ['Gestão', 'Financeiro', 'Configurações']) {
      expect(menu().getByRole('button', { name: grupo })).toBeInTheDocument();
    }
  });

  it('abre o grupo da página atual e marca o item dela', () => {
    abrir('/estacoes');
    expect(menu().getByRole('button', { name: 'Gestão' })).toHaveAttribute('aria-expanded', 'true');
    expect(menu().getByRole('link', { name: 'Estações' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'Visão Geral' })).not.toHaveAttribute('aria-current');
    // Financeiro está fechado: os itens dele não aparecem
    expect(menu().queryByRole('link', { name: 'Transações' })).not.toBeInTheDocument();
  });

  it('abre e fecha um grupo ao clicar', async () => {
    abrir('/');
    const financeiro = menu().getByRole('button', { name: 'Financeiro' });
    await userEvent.click(financeiro);
    expect(menu().getByRole('link', { name: 'Transações' })).toBeInTheDocument();
    await userEvent.click(financeiro);
    expect(menu().queryByRole('link', { name: 'Transações' })).not.toBeInTheDocument();
  });

  it('mostra à plataforma os itens que só ela vê', async () => {
    abrir('/energia');
    expect(menu().getByRole('link', { name: /Energia/ })).toBeInTheDocument();
    await userEvent.click(menu().getByRole('button', { name: 'Configurações' }));
    expect(menu().getByRole('link', { name: 'White Label' })).toBeInTheDocument();
    expect(menu().getByRole('link', { name: 'Usuários' })).toBeInTheDocument();
  });

  it('na Energia, mostra as seções do módulo como subitens e marca a da URL', () => {
    abrir('/energia?aba=rateio');
    const secoes = within(screen.getByRole('list', { name: 'Seções do módulo Energia' }));
    for (const [rotulo, aba] of [
      ['Usinas', 'usinas'],
      ['Pontos consumidores', 'pontos'],
      ['Conexões', 'conexoes'],
      ['Rateio', 'rateio'],
      ['Apuração e Split', 'apuracao'],
      ['Modalidades', 'modalidades'],
    ]) {
      expect(secoes.getByRole('link', { name: rotulo })).toHaveAttribute(
        'href',
        `/energia?aba=${aba}`
      );
    }
    expect(secoes.getByRole('link', { name: 'Rateio' })).toHaveAttribute('aria-current', 'page');
    expect(secoes.getByRole('link', { name: 'Usinas' })).not.toHaveAttribute('aria-current');
    // Com uma seção aberta, a seção é a página atual, e não o "Energia"
    expect(menu().getByRole('link', { name: /Energia/ })).not.toHaveAttribute('aria-current');
  });

  it('na visão geral da Energia, o "Energia" é o item atual e nenhuma seção', () => {
    abrir('/energia');
    expect(menu().getByRole('link', { name: /Energia/ })).toHaveAttribute('aria-current', 'page');
    const secoes = within(screen.getByRole('list', { name: 'Seções do módulo Energia' }));
    expect(secoes.getAllByRole('link')).toHaveLength(6);
    expect(secoes.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });

  it('fora da Energia, as seções do módulo não aparecem', () => {
    abrir('/estacoes');
    expect(menu().queryByRole('link', { name: 'Usinas' })).not.toBeInTheDocument();
  });

  it('as seções da Energia são só de quem vê a Energia (plataforma)', () => {
    estado.user = operadorDaMarca;
    abrir('/energia?aba=usinas');
    expect(menu().queryByRole('link', { name: 'Usinas' })).not.toBeInTheDocument();
  });

  it('esconde do operador de marca os itens da plataforma e os de admin', async () => {
    estado.user = operadorDaMarca;
    abrir('/estacoes');
    expect(menu().getByRole('link', { name: 'Estações' })).toBeInTheDocument();
    expect(menu().queryByRole('link', { name: /Energia/ })).not.toBeInTheDocument();
    expect(menu().queryByRole('link', { name: /Atendimento/ })).not.toBeInTheDocument();
    // Configurações só tem itens de admin: o grupo nem aparece
    expect(menu().queryByRole('button', { name: 'Configurações' })).not.toBeInTheDocument();
  });

  it('a busca do topo leva à página encontrada', async () => {
    abrir('/');
    await userEvent.type(screen.getByLabelText('Pesquisar no painel'), 'tari');
    await userEvent.click(screen.getByRole('button', { name: 'Tarifas' }));
    expect(estado.navigate).toHaveBeenCalledWith('/tarifas');
  });

  it('o botão de tema alterna o tema', async () => {
    abrir('/');
    await userEvent.click(screen.getByRole('button', { name: 'Mudar para o tema escuro' }));
    expect(estado.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('"Sair" encerra a sessão e volta ao login', async () => {
    abrir('/');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu da conta' }));
    await userEvent.click(await screen.findByText('Sair'));
    expect(estado.logout).toHaveBeenCalledTimes(1);
    expect(estado.navigate).toHaveBeenCalledWith('/login');
  });

  it('funciona sem usuário (sessão expirando)', () => {
    estado.user = null;
    abrir('/');
    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument();
  });
});
