import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { UserRole } from '../types';
import { LogOut, Sun, Moon } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useAppTheme } from '../hooks/useAppTheme';
import NeoPowerLogo from '../assets/NeoPower.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, logout, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useAppTheme();
  const isAdmin = user?.role === 'admin';


  const navItems = [
    { path: '/', label: 'Visão Geral', icon: 'dashboard', roles: ['admin', 'comum'] },
    { path: '/estacoes', label: 'Estações', icon: 'ev_station', roles: ['admin', 'comum'] },
    { path: '/locais', label: 'Locais', icon: 'location_on', roles: ['admin', 'comum'] },
    { path: '/transacoes', label: 'Transações', icon: 'receipt_long', roles: ['admin', 'comum'] },
    {
      path: '/indicadores',
      label: 'Indicadores',
      icon: 'leaderboard',
      roles: ['admin', 'comum'],
    },
    { path: '/operacoes', label: 'Operações', icon: 'settings_input_component', roles: ['admin'] },
    {
      path: '/relatorio-financeiro',
      label: 'Relatório Financeiro',
      icon: 'payments',
      roles: ['admin', 'comum'],
    },
    { path: '/usuarios', label: 'Usuários', icon: 'group', roles: ['admin'] },
    { path: '/vouchers', label: 'Vouchers', icon: 'confirmation_number', roles: ['admin', 'comum'] },
    { path: '/tarifas', label: 'Tarifas', icon: 'sell', roles: ['admin', 'comum'] },
    { path: '/carteiras', label: 'Carteiras', icon: 'account_balance_wallet', roles: ['admin'] },
    { path: '/notificacoes', label: 'Notificações', icon: 'notifications', roles: ['admin', 'comum'] },
    { path: '/sustentabilidade', label: 'Sustentabilidade', icon: 'eco', roles: ['admin', 'comum'] },
    { path: '/alarmes', label: 'Alarmes', icon: 'notification_important', roles: ['admin', 'comum'] },
    { path: '/agendamentos', label: 'Agendamentos', icon: 'schedule', roles: ['admin'] },
    { path: '/metas', label: 'Metas de Recarga', icon: 'flag', roles: ['admin'] },
    { path: '/branding', label: 'White Label', icon: 'palette', roles: ['admin'] },
    { path: '/email', label: 'Email', icon: 'mail', roles: ['admin'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role || 'comum'));

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    atem: 'Atem',
    comum: 'Comum',
  };

  const roleCycle: UserRole[] = ['admin', 'comum'];
  const currentRole = user?.role || 'comum';
  const nextRole = roleCycle[(roleCycle.indexOf(currentRole) + 1) % roleCycle.length];

  const handleRoleSwitch = () => {
    // APENAS EM DESENVOLVIMENTO - Desabilitado em produção
    if (import.meta.env.MODE !== 'production') {
      switchRole(nextRole);
    } else {
      console.warn('⚠️ Role switching is disabled in production for security reasons');
      alert('Troca de role desabilitada em produção por segurança');
    }
  };

  const handleLogout = () => {
    logout();
    void navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col py-6 overflow-y-auto bg-sidebar border-r border-sidebar-border/15 w-64 z-50">
        {/* Logo */}
        <div className="px-6 mb-6">
          {user?.branding?.logoType === 'image' && user.branding.logoUri ? (
            <div className="flex items-center gap-3">
              <img
                src={user.branding.logoUri}
                alt="Logo"
                className="w-8 h-8 rounded-lg object-contain shrink-0 bg-white"
              />
              <div>
                <h2 className="font-headline font-bold text-lg leading-none tracking-tight text-sidebar-foreground">
                  {user?.branding?.companyName}
                </h2>
              </div>
            </div>
          ) : (
            <div className="bg-white/95 rounded-lg p-2 shadow-xl shadow-white/5 flex items-center justify-center w-fit">
              <img
                src={NeoPowerLogo}
                alt="NeoPower"
                className="h-6 w-auto"
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 text-sm ${
                  isActive
                    ? 'bg-surface-container-highest text-primary border-r-2 border-primary shadow-[inset_0_0_10px_rgba(57,255,20,0.1)] font-medium'
                    : 'text-muted-foreground hover:bg-surface-container-highest hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile at bottom */}
        <div className="px-6 mt-auto border-t border-sidebar-border/15 pt-6">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-primary/15 overflow-hidden flex items-center justify-center shrink-0">
                <span className="text-primary text-base font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate uppercase tracking-wide">
                  {user ? roleLabels[user.role] : ''}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
              <DropdownMenuLabel className="text-muted-foreground">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              {isAdmin && import.meta.env.MODE !== 'production' && (
                <>
                  <DropdownMenuItem
                    onClick={handleRoleSwitch}
                    className="text-muted-foreground focus:bg-accent focus:text-foreground cursor-pointer"
                  >
                    Alternar para {roleLabels[nextRole]}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                </>
              )}
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Top Navbar */}
      <header className="fixed top-0 right-0 left-64 flex justify-between items-center px-8 h-16 bg-background/80 backdrop-blur-xl border-b border-border/15 z-40">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-64 group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
              search
            </span>
            <input
              className="w-full bg-surface-container-low border-none rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50 transition-all"
              placeholder="Buscar no sistema..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              title={isDark ? 'Modo Claro' : 'Modo Escuro'}
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
          )}
          <NotificationBell />
        </div>
      </header>

      {/* Main Content */}
      <main className="pl-64 pt-16 flex-1 min-h-screen overflow-auto">
        <div className="p-8 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
};
