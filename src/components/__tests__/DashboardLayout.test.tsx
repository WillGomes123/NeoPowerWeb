import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { DashboardLayout } from '../DashboardLayout';
import { AuthProvider } from '../../lib/auth';
import { UserRole } from '../../types';

// Mock do useAuth
const mockLogout = vi.fn();
const mockSwitchRole = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../lib/auth', async () => {
  const actual = await vi.importActual('../../lib/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock do ThemeToggle
vi.mock('../ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogout.mockClear();
    mockSwitchRole.mockClear();
    mockNavigate.mockClear();
  });

  const renderWithRouter = (component: React.ReactElement, initialRoute = '/') => {
    return render(<MemoryRouter initialEntries={[initialRoute]}>{component}</MemoryRouter>);
  };

  describe('Renderizacao do Layout', () => {
    it('deve renderizar o layout com sidebar e conteudo principal', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Test Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('NeoPower')).toBeInTheDocument();
      expect(screen.getByText('Gerenciamento de Estações')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('deve renderizar o logo com icone Zap', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      const logo = screen.getByText('NeoPower');
      expect(logo).toBeInTheDocument();
    });

    it('deve renderizar o nome do usuario e role', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'John Doe', email: 'john@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
    });
  });

  describe('Navegacao entre Paginas', () => {
    it('deve renderizar todos os itens de navegacao para admin', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Admin User', email: 'admin@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('Visão Geral')).toBeInTheDocument();
      expect(screen.getByText('Estações')).toBeInTheDocument();
      expect(screen.getByText('Locais')).toBeInTheDocument();
      expect(screen.getByText('Transações')).toBeInTheDocument();
      expect(screen.getByText('Indicadores')).toBeInTheDocument();
      expect(screen.getByText('Operações')).toBeInTheDocument();
      expect(screen.getByText('Relatório Financeiro')).toBeInTheDocument();
      expect(screen.getByText('Usuários')).toBeInTheDocument();
      expect(screen.getByText('Vouchers')).toBeInTheDocument();
    });

    it('deve ocultar itens admin para usuario comum', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Common User', email: 'user@test.com', role: 'comum' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('Visão Geral')).toBeInTheDocument();
      expect(screen.getByText('Estações')).toBeInTheDocument();
      expect(screen.queryByText('Operações')).not.toBeInTheDocument();
      expect(screen.queryByText('Usuários')).not.toBeInTheDocument();
      expect(screen.queryByText('Vouchers')).not.toBeInTheDocument();
    });

    it('deve mostrar itens corretos para usuario ATEM', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'ATEM User', email: 'atem@test.com', role: 'atem' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('Visão Geral')).toBeInTheDocument();
      expect(screen.getByText('Estações')).toBeInTheDocument();
      expect(screen.getByText('Indicadores')).toBeInTheDocument();
      expect(screen.queryByText('Operações')).not.toBeInTheDocument();
      expect(screen.queryByText('Usuários')).not.toBeInTheDocument();
    });

    it('deve destacar o item ativo na navegacao', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
        '/estacoes'
      );

      const activeLink = screen.getByText('Estações').closest('a');
      expect(activeLink).toHaveClass('bg-emerald-500/10', 'text-emerald-400');
    });
  });

  describe('Sidebar', () => {
    it('deve renderizar o ThemeToggle', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    it('deve renderizar menu dropdown do usuario', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      const userMenuTrigger = screen.getByText('Test User').closest('button');
      expect(userMenuTrigger).toBeInTheDocument();
    });
  });

  describe('Logout', () => {
    it('deve chamar logout e redirecionar ao clicar em Sair', async () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      // Abrir dropdown do usuario
      const userMenuTrigger = screen.getByText('Test User').closest('button');
      fireEvent.click(userMenuTrigger!);

      // Aguardar menu abrir e clicar em Sair
      await waitFor(() => {
        const logoutButton = screen.getByText('Sair');
        expect(logoutButton).toBeInTheDocument();
      });

      const logoutButton = screen.getByText('Sair');
      fireEvent.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Alternar Role', () => {
    it('deve alternar de admin para atem', async () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      // Abrir dropdown
      const userMenuTrigger = screen.getByText('Test User').closest('button');
      fireEvent.click(userMenuTrigger!);

      // Aguardar e clicar em alternar role
      await waitFor(() => {
        const switchButton = screen.getByText(/Alternar para ATEM/);
        expect(switchButton).toBeInTheDocument();
      });

      const switchButton = screen.getByText(/Alternar para ATEM/);
      fireEvent.click(switchButton);

      expect(mockSwitchRole).toHaveBeenCalledWith('atem');
    });

    it('deve alternar de atem para comum', async () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'atem' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      const userMenuTrigger = screen.getByText('Test User').closest('button');
      fireEvent.click(userMenuTrigger!);

      await waitFor(() => {
        const switchButton = screen.getByText(/Alternar para Comum/);
        expect(switchButton).toBeInTheDocument();
      });

      const switchButton = screen.getByText(/Alternar para Comum/);
      fireEvent.click(switchButton);

      expect(mockSwitchRole).toHaveBeenCalledWith('comum');
    });

    it('deve alternar de comum para admin', async () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'comum' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      const userMenuTrigger = screen.getByText('Test User').closest('button');
      fireEvent.click(userMenuTrigger!);

      await waitFor(() => {
        const switchButton = screen.getByText(/Alternar para Admin/);
        expect(switchButton).toBeInTheDocument();
      });

      const switchButton = screen.getByText(/Alternar para Admin/);
      fireEvent.click(switchButton);

      expect(mockSwitchRole).toHaveBeenCalledWith('admin');
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar com usuario null', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: null,
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('NeoPower')).toBeInTheDocument();
    });

    it('deve renderizar children corretamente', () => {
      const { useAuth } = require('../../lib/auth');
      useAuth.mockReturnValue({
        user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin' },
        logout: mockLogout,
        switchRole: mockSwitchRole,
      });

      renderWithRouter(
        <DashboardLayout>
          <div data-testid="custom-content">Custom Content Here</div>
        </DashboardLayout>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.getByText('Custom Content Here')).toBeInTheDocument();
    });
  });
});
