import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { UserRole } from '../types';
import {
  LogOut,
} from 'lucide-react';
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

  const navItems = [
    { path: '/', label: 'Visão Geral', icon: 'dashboard', roles: ['admin', 'atem', 'comum'] },
    { path: '/estacoes', label: 'Estações', icon: 'ev_station', roles: ['admin', 'atem', 'comum'] },
    { path: '/locais', label: 'Locais', icon: 'location_on', roles: ['admin', 'atem', 'comum'] },
    { path: '/transacoes', label: 'Transações', icon: 'receipt_long', roles: ['admin', 'atem', 'comum'] },
    {
      path: '/indicadores',
      label: 'Indicadores',
      icon: 'leaderboard',
      roles: ['admin', 'atem', 'comum'],
    },
    { path: '/operacoes', label: 'Operações', icon: 'settings_input_component', roles: ['admin'] },
    {
      path: '/relatorio-financeiro',
      label: 'Relatório Financeiro',
      icon: 'payments',
      roles: ['admin'],
    },
    { path: '/usuarios', label: 'Usuários', icon: 'group', roles: ['admin'] },
    { path: '/vouchers', label: 'Vouchers', icon: 'confirmation_number', roles: ['admin', 'atem', 'comum'] },
    { path: '/tarifas', label: 'Tarifas', icon: 'sell', roles: ['admin', 'atem', 'comum'] },
    { path: '/carteiras', label: 'Carteiras', icon: 'account_balance_wallet', roles: ['admin'] },
    { path: '/notificacoes', label: 'Notificações', icon: 'notifications', roles: ['admin', 'atem', 'comum'] },
    { path: '/branding', label: 'White Label', icon: 'palette', roles: ['admin'] },
    { path: '/email', label: 'Email', icon: 'mail', roles: ['admin'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role || 'comum'));

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    atem: 'ATEM',
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
    <div className="flex h-screen bg-[#0e0e0e]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col py-6 overflow-y-auto bg-[#131313] border-r border-[#494847]/15 w-64 z-50">
        {/* Logo */}
        <div className="px-6 mb-10 flex items-center gap-3">
          {user?.branding?.logoType === 'image' && user.branding.logoUri ? (
            <img
              src={user.branding.logoUri}
              alt="Logo"
              className="w-8 h-8 rounded-lg object-contain shrink-0 bg-white"
            />
          ) : (
            <div className="w-8 h-8 bg-[#8eff71] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(142,255,113,0.4)]">
              <span
                className="material-symbols-outlined text-[#0d6100] text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                bolt
              </span>
            </div>
          )}
          <div>
            <h2 className="font-headline font-bold text-lg leading-none tracking-tight text-white">
              {user?.branding?.companyName || 'NeoPower'}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#adaaaa] font-medium">
              Command Deck
            </p>
          </div>
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
                    ? 'bg-[#262626] text-[#39FF14] border-r-2 border-[#39FF14] shadow-[inset_0_0_10px_rgba(57,255,20,0.1)] font-medium'
                    : 'text-[#adaaaa] hover:bg-[#262626] hover:text-[#39FF14]'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile at bottom */}
        <div className="px-6 mt-auto border-t border-[#494847]/15 pt-6">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-[#262626] overflow-hidden flex items-center justify-center">
                <span className="material-symbols-outlined text-[#adaaaa] text-xl">person</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-[#adaaaa] truncate uppercase tracking-wide">
                  {user ? roleLabels[user.role] : ''}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#1a1919] border-[#494847]/15">
              <DropdownMenuLabel className="text-[#adaaaa]">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#494847]/15" />
              <DropdownMenuItem
                onClick={handleRoleSwitch}
                className="text-[#adaaaa] focus:bg-[#262626] focus:text-white cursor-pointer"
              >
                Alternar para {roleLabels[nextRole]}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#494847]/15" />
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
      <header className="fixed top-0 right-0 left-64 flex justify-between items-center px-8 h-16 bg-[#0e0e0e]/80 backdrop-blur-xl border-b border-[#494847]/15 z-40">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-64 group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-lg">
              search
            </span>
            <input
              className="w-full bg-[#131313] border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-[#8eff71]/50 placeholder:text-[#adaaaa]/50 transition-all"
              placeholder="Buscar no sistema..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-[#adaaaa] hover:text-[#8eff71] transition-colors">
            <span className="material-symbols-outlined">bolt</span>
          </button>
          <div className="relative">
            <button className="text-[#adaaaa] hover:text-[#8eff71] transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#8eff71] rounded-full shadow-[0_0_15px_rgba(57,255,20,0.15)]"></span>
          </div>
          <button className="text-[#adaaaa] hover:text-[#8eff71] transition-colors">
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pl-64 pt-16 flex-1 min-h-screen overflow-auto">
        <div className="p-8 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
};
