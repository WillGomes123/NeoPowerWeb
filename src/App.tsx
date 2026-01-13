import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import { DashboardLayout } from './components/DashboardLayout';
import { Toaster } from './components/ui/sonner';

// Eager load login (usada imediatamente)
import { Login } from './pages/Login';

// Lazy load outras páginas (carregadas sob demanda)
const Overview = lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })));
const Stations = lazy(() => import('./pages/Stations').then(m => ({ default: m.Stations })));
const Locations = lazy(() => import('./pages/Locations').then(m => ({ default: m.Locations })));
const LocationDetails = lazy(() => import('./pages/LocationDetails').then(m => ({ default: m.LocationDetails })));
const Transactions = lazy(() =>
  import('./pages/Transactions').then(m => ({ default: m.Transactions }))
);
const Indicators = lazy(() => import('./pages/Indicators').then(m => ({ default: m.Indicators })));
const Operations = lazy(() => import('./pages/Operations').then(m => ({ default: m.Operations })));
const FinancialReport = lazy(() =>
  import('./pages/FinancialReport').then(m => ({ default: m.FinancialReport }))
);
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Vouchers = lazy(() => import('./pages/Vouchers').then(m => ({ default: m.Vouchers })));
const Tariffs = lazy(() => import('./pages/Tariffs').then(m => ({ default: m.Tariffs })));
const Wallets = lazy(() => import('./pages/Wallets').then(m => ({ default: m.Wallets })));
const PushNotifications = lazy(() => import('./pages/PushNotifications').then(m => ({ default: m.PushNotifications })));

// Loading Component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Helper para criar rota protegida com Suspense e Layout
const createProtectedRoute = (Component: React.LazyExoticComponent<any>, requireAdmin = false) => (
  <ProtectedRoute requireAdmin={requireAdmin}>
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </DashboardLayout>
  </ProtectedRoute>
);

// App Routes Component
const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      {/* Protected Routes */}
      <Route path="/" element={createProtectedRoute(Overview)} />
      <Route path="/estacoes" element={createProtectedRoute(Stations)} />
      <Route path="/locais" element={createProtectedRoute(Locations)} />
      <Route path="/locais/:id" element={createProtectedRoute(LocationDetails)} />
      <Route path="/transacoes" element={createProtectedRoute(Transactions)} />
      <Route path="/indicadores" element={createProtectedRoute(Indicators)} />

      {/* Admin Only Routes */}
      <Route path="/operacoes" element={createProtectedRoute(Operations, true)} />
      <Route path="/relatorio-financeiro" element={createProtectedRoute(FinancialReport, true)} />
      <Route path="/usuarios" element={createProtectedRoute(Users, true)} />
      <Route path="/vouchers" element={createProtectedRoute(Vouchers, true)} />
      <Route path="/tarifas" element={createProtectedRoute(Tariffs, true)} />
      <Route path="/carteiras" element={createProtectedRoute(Wallets, true)} />
      <Route path="/notificacoes" element={createProtectedRoute(PushNotifications, true)} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App Component
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AuthProvider>
          <Router>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#18181b',
                  color: '#fff',
                  border: '1px solid #27272a',
                },
              }}
            />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
