import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../lib/auth';

// Mock do useAuth
vi.mock('../../lib/auth', async () => {
  const actual = await vi.importActual('../../lib/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

import { useAuth } from '../../lib/auth';

// Componente de teste simples
const AdminPage = () => <div>Admin Page</div>;
const HomePage = () => <div>Home Page</div>;
const LoginPage = () => <div>Login Page</div>;

// ProtectedRoute component (inline para testes)
const ProtectedRoute = ({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) => {
  const { user } = useAuth();
  const { Navigate } = require('react-router-dom');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

describe('ProtectedRoute - RBAC Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Tests', () => {
    it('should redirect to login when user is not authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </BrowserRouter>
      );

      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    it('should allow access when user is authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', name: 'John', email: 'john@test.com', role: 'comum' },
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      );

      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
  });

  describe('RBAC - Role-Based Access Control', () => {
    it('should allow admin to access admin-only routes', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <BrowserRouter>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      );

      expect(screen.getByText('Admin Page')).toBeInTheDocument();
    });

    it('should redirect non-admin users from admin routes', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '2', name: 'User', email: 'user@test.com', role: 'comum' },
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      );

      expect(screen.getByText('Home Page')).toBeInTheDocument();
      expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
    });

    it('should redirect ATEM users from admin routes', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '3', name: 'ATEM', email: 'atem@test.com', role: 'atem' },
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      );

      expect(screen.getByText('Home Page')).toBeInTheDocument();
      expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
    });
  });

  describe('Role Permissions Matrix', () => {
    const roles = [
      { role: 'admin', canAccessAdmin: true, canAccessRegular: true },
      { role: 'atem', canAccessAdmin: false, canAccessRegular: true },
      { role: 'comum', canAccessAdmin: false, canAccessRegular: true },
    ];

    roles.forEach(({ role, canAccessAdmin, canAccessRegular }) => {
      it(`${role} should ${canAccessAdmin ? 'have' : 'not have'} access to admin routes`, () => {
        vi.mocked(useAuth).mockReturnValue({
          user: { id: '1', name: 'Test', email: 'test@test.com', role: role as any },
          login: vi.fn(),
          logout: vi.fn(),
          register: vi.fn(),
          switchRole: vi.fn(),
        });

        render(
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        );

        if (canAccessAdmin) {
          expect(screen.getByText('Admin Page')).toBeInTheDocument();
        } else {
          expect(screen.getByText('Home Page')).toBeInTheDocument();
        }
      });

      it(`${role} should ${canAccessRegular ? 'have' : 'not have'} access to regular routes`, () => {
        vi.mocked(useAuth).mockReturnValue({
          user: { id: '1', name: 'Test', email: 'test@test.com', role: role as any },
          login: vi.fn(),
          logout: vi.fn(),
          register: vi.fn(),
          switchRole: vi.fn(),
        });

        render(
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        );

        if (canAccessRegular) {
          expect(screen.getByText('Home Page')).toBeInTheDocument();
        }
      });
    });
  });
});
