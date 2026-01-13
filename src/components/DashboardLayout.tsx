import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { UserRole } from '../types';
import {
  LayoutDashboard,
  Zap,
  MapPin,
  Receipt,
  BarChart3,
  Settings,
  DollarSign,
  Users,
  Ticket,
  LogOut,
  UserCircle,
  Tag,
  Wallet,
  Megaphone,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ThemeToggle } from './ThemeToggle';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, logout, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Visão Geral', icon: LayoutDashboard, roles: ['admin', 'atem', 'comum'] },
    { path: '/estacoes', label: 'Estações', icon: Zap, roles: ['admin', 'atem', 'comum'] },
    { path: '/locais', label: 'Locais', icon: MapPin, roles: ['admin', 'atem', 'comum'] },
    { path: '/transacoes', label: 'Transações', icon: Receipt, roles: ['admin', 'atem', 'comum'] },
    {
      path: '/indicadores',
      label: 'Indicadores',
      icon: BarChart3,
      roles: ['admin', 'atem', 'comum'],
    },
    { path: '/operacoes', label: 'Operações', icon: Settings, roles: ['admin'] },
    {
      path: '/relatorio-financeiro',
      label: 'Relatório Financeiro',
      icon: DollarSign,
      roles: ['admin'],
    },
    { path: '/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
    { path: '/vouchers', label: 'Vouchers', icon: Ticket, roles: ['admin'] },
    { path: '/tarifas', label: 'Tarifas', icon: Tag, roles: ['admin'] },
    { path: '/carteiras', label: 'Carteiras', icon: Wallet, roles: ['admin'] },
    { path: '/notificacoes', label: 'Notificações', icon: Megaphone, roles: ['admin'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role || 'comum'));

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    atem: 'ATEM',
    comum: 'Comum',
  };

  const roleCycle: UserRole[] = ['admin', 'atem', 'comum'];
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
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-500" />
            NeoPower
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Gerenciamento de Estações</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800 space-y-3">
          {/* Theme Toggle & Notifications */}
          <div className="flex items-center justify-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center justify-start gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors">
              <UserCircle className="w-5 h-5" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">{user?.name}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">
                  {user ? roleLabels[user.role] : ''}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800">
              <DropdownMenuLabel className="text-zinc-400">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={handleRoleSwitch}
                className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
              >
                Alternar para {roleLabels[nextRole]}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};
