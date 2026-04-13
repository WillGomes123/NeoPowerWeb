import { ReactNode, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { UserRole } from '../types';
import { LogOut, Sun, Moon, Search } from 'lucide-react';
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
  const { isDark, toggle: toggleTheme } = useAppTheme(user?.branding);
  const isAdmin = user?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);


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
    { path: '/operacoes', label: 'Operações', icon: 'settings_input_component', roles: ['admin', 'comum'] },
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

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return visibleNavItems.filter(item => 
      item.label.toLowerCase().includes(query)
    );
  }, [searchQuery, visibleNavItems]);

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
      <aside className="fixed left-0 top-0 h-full flex flex-col pt-3 pb-6 overflow-y-auto bg-sidebar border-r border-sidebar-border/15 w-64 z-50">
        {/* Logo */}
        <div className="px-2 mb-3">
          {user?.branding?.logoType === 'image' ? (
            <div className={user?.branding?.companyName ? "flex items-center gap-3" : "flex items-center justify-center w-full"}>
              <img
                src={isDark 
                  ? (user.branding.logoUriDark || user.branding.logoUri || NeoPowerLogo) 
                  : (user.branding.logoUriLight || user.branding.logoUri || NeoPowerLogo)
                }
                alt="Logo"
                className={user?.branding?.companyName 
                  ? "w-8 h-8 rounded-lg object-contain shrink-0 bg-white" 
                  : "max-h-24 w-full object-contain"
                }
              />
              {user?.branding?.companyName && (
                <div>
                  <h2 className="font-headline font-bold text-lg leading-none tracking-tight text-sidebar-foreground">
                    {user.branding.companyName}
                  </h2>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/95 rounded-lg p-2 shadow-xl shadow-white/5 flex items-center justify-center w-fit">
              <img
                src={NeoPowerLogo}
                alt="NeoPower"
                className="h-6 w-auto"
              />
              {user?.branding?.companyName && (
                <span className="ml-3 font-headline font-bold text-lg text-sidebar-foreground">
                  {user.branding.companyName}
                </span>
              )}
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
          <div className="relative w-72 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
            <input
              className={`w-full bg-surface-container-low border border-neutral-200 rounded-lg pl-10 pr-4 py-2 text-sm text-foreground 
                focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-muted-foreground/50 transition-all shadow-sm`}
              placeholder="Buscar no sistema..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            />

            {/* Live Search Dropdown */}
            {isSearchFocused && searchQuery.trim() !== '' && (
              <div className="absolute top-full left-0 w-full mt-2 bg-card border border-neutral-200 rounded-xl shadow-soft py-2 min-w-[300px] z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-3 py-1.5 mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Resultados da Busca</span>
                </div>
                {filteredResults.length > 0 ? (
                  filteredResults.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum resultado para "{searchQuery}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
            title={isDark ? 'Modo Claro' : 'Modo Escuro'}
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
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
