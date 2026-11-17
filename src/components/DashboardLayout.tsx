import { Fragment, ReactNode, useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ehAdminDaPlataforma } from '../lib/plataforma';
import type { AbaEnergia } from '../lib/energia';
import { UserRole } from '../types';
import {
  Bug,
  ChartColumn,
  LogOut,
  Mail,
  Menu,
  Palette,
  Receipt,
  Search,
  Tag,
  Ticket,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useTenant } from '../contexts/TenantContext';
import NeoPowerLogo from '../assets/NeoPower.png';
import { KairosPanel } from './KairosPanel';
import { Icone, IconeSvg, type NomeDoIcone } from './painel/Icone';
import iconeConexoes from '../assets/icones/fid-conexoes.svg';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

/*
 * Moldura do painel no redesenho de nov/2026 (Figma da Lauriane, telas de
 * 1920 px): menu lateral branco de 276 px com o item ativo em fundo suave e
 * barra na cor da marca; barra do topo com a busca à esquerda e, à direita,
 * tema, notificações e a conta.
 */

/** Ícone do menu: os do Figma pelo nome; os que o Figma não desenhou, do Lucide (mesmo traço). */
type IconeDoMenu = NomeDoIcone | LucideIcon;

interface ItemDoMenu {
  path: string;
  label: string;
  icone: IconeDoMenu;
  roles: string[];
  somentePlataforma?: boolean;
  novo?: boolean;
}

const TODOS = ['admin', 'operador', 'comum'];

const VISAO_GERAL: ItemDoMenu = {
  path: '/',
  label: 'Visão Geral',
  icone: 'visao-geral',
  roles: TODOS,
};

const GRUPOS: { id: string; label: string; icone: NomeDoIcone; items: ItemDoMenu[] }[] = [
  {
    id: 'gestao',
    label: 'Gestão',
    icone: 'gestao',
    items: [
      { path: '/estacoes', label: 'Estações', icone: 'estacao', roles: TODOS },
      { path: '/locais', label: 'Locais', icone: 'local', roles: TODOS },
      // Usinas, rateio e split com a Ecofin são da operação própria: só a NeoPower vê.
      {
        path: '/energia',
        label: 'Energia',
        icone: 'energia',
        roles: ['admin'],
        somentePlataforma: true,
        novo: true,
      },
      { path: '/cameras', label: 'Câmeras', icone: 'cameras', roles: TODOS },
      { path: '/operacoes', label: 'Operações', icone: 'operacoes', roles: TODOS },
      { path: '/indicadores', label: 'Indicadores', icone: 'indicadores', roles: TODOS },
      { path: '/notificacoes', label: 'Notificações', icone: 'notificacoes', roles: TODOS },
      { path: '/alarmes', label: 'Alarmes', icone: 'alarmes', roles: TODOS },
      // Atendimento por WhatsApp do suporte: só a NeoPower vê.
      {
        path: '/atendimento',
        label: 'Atendimento',
        icone: 'atendimento',
        roles: ['admin'],
        somentePlataforma: true,
        novo: true,
      },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icone: 'financeiro',
    items: [
      { path: '/transacoes', label: 'Transações', icone: Receipt, roles: TODOS },
      {
        path: '/relatorio-financeiro',
        label: 'Relatório Financeiro',
        icone: ChartColumn,
        roles: TODOS,
      },
      { path: '/vouchers', label: 'Vouchers', icone: Ticket, roles: TODOS },
      { path: '/tarifas', label: 'Tarifas', icone: Tag, roles: TODOS },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    icone: 'configuracoes',
    items: [
      { path: '/usuarios', label: 'Usuários', icone: Users, roles: ['admin'] },
      { path: '/carteiras', label: 'Carteiras', icone: Wallet, roles: ['admin'] },
      {
        path: '/branding',
        label: 'White Label',
        icone: Palette,
        roles: ['admin'],
        somentePlataforma: true,
      },
      { path: '/email', label: 'Email', icone: Mail, roles: ['admin'], somentePlataforma: true },
      // Relatos de erro dos apps de todas as marcas: só a NeoPower vê.
      {
        path: '/erros-do-app',
        label: 'Erros do app',
        icone: Bug,
        roles: ['admin'],
        somentePlataforma: true,
        novo: true,
      },
    ],
  },
];

/**
 * Seções do módulo Energia, como subitens do item "Energia" (Figma: menu do
 * Frame 18 e o submenu solto ao lado do Frame 14). Levam à aba da página
 * (`/energia?aba=…`). Ícones do Figma; onde ela não desenhou um, os quatro
 * pontinhos da "Visão Geral", como ela fez.
 */
const SECOES_DA_ENERGIA: { aba: AbaEnergia; label: string; icone: ReactNode }[] = [
  { aba: 'usinas', label: 'Usinas', icone: <Icone nome="usinas" tamanho={20} /> },
  {
    aba: 'pontos',
    label: 'Pontos consumidores',
    icone: <Icone nome="pontos-consumidores" tamanho={20} />,
  },
  {
    aba: 'conexoes',
    label: 'Conexões',
    icone: <IconeSvg src={iconeConexoes} tamanho={20} nome="fid-conexoes" />,
  },
  { aba: 'rateio', label: 'Rateio', icone: <Icone nome="visao-geral" tamanho={20} /> },
  {
    aba: 'apuracao',
    label: 'Apuração e Split',
    icone: <Icone nome="visao-geral" tamanho={20} />,
  },
  { aba: 'modalidades', label: 'Modalidades', icone: <Icone nome="visao-geral" tamanho={20} /> },
];

const estaNaRota = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');

function IconeDoItem({ icone, tamanho = 24 }: { icone: IconeDoMenu; tamanho?: number }) {
  if (typeof icone === 'string') return <Icone nome={icone} tamanho={tamanho} />;
  const Lucide = icone;
  return <Lucide aria-hidden="true" size={tamanho} strokeWidth={2} className="shrink-0" />;
}

/** Iniciais da conta no círculo (Figma: "L" de Lauriane). */
const inicial = (nome?: string) => nome?.trim().charAt(0).toUpperCase() || 'U';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme, tenantBranding } = useTenant();

  const activeBranding = user?.branding || tenantBranding;
  // Logo do tema: o de fundo escuro no menu escuro, o de fundo claro no claro.
  // É o logo horizontal, que já traz o nome da marca.
  const logoDoTema = isDark ? activeBranding?.logoUriDark : activeBranding?.logoUriLight;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isKairosOpen, setIsKairosOpen] = useState(false);
  // No celular a lateral vira gaveta: fica fora da tela até ser aberta.
  // A partir de lg ela é fixa e este estado não tem efeito.
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    setIsKairosOpen(false);
    // Navegou: fecha a gaveta, senão o menu cobriria a página recém-aberta.
    setMenuAberto(false);
  }, [location.pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      GRUPOS.map(g => [g.id, g.items.some(item => estaNaRota(location.pathname, item.path))])
    )
  );

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Email e White Label são só da plataforma NeoPower (admin sem marca); admins
  // de marca, operadores e contas comuns não veem.
  const ehPlataforma = ehAdminDaPlataforma(user);
  const podeVerItem = (item: ItemDoMenu) =>
    item.roles.includes(user?.role || 'comum') && (!item.somentePlataforma || ehPlataforma);

  const visibleNavItems = useMemo(
    () => [VISAO_GERAL, ...GRUPOS.flatMap(g => g.items)].filter(podeVerItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.role, ehPlataforma]
  );

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return visibleNavItems.filter(item => item.label.toLowerCase().includes(query));
  }, [searchQuery, visibleNavItems]);

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    operador: 'Operador',
    comum: 'Comum',
  };

  const handleLogout = () => {
    logout();
    void navigate('/login');
  };

  // Seção do módulo Energia aberta (o `?aba=` da página); null = visão geral.
  const secaoDaEnergia = useMemo(() => {
    if (!estaNaRota(location.pathname, '/energia')) return null;
    const aba = new URLSearchParams(location.search).get('aba');
    return SECOES_DA_ENERGIA.find(s => s.aba === aba)?.aba ?? null;
  }, [location.pathname, location.search]);

  // Subitem da Energia: um nível abaixo dos itens do grupo, um pouco menor; o
  // texto alinha com o de "Energia" e cabe numa linha na lateral de 276 px.
  const classeDaSecao = (ativo: boolean) =>
    `relative flex items-center gap-[10px] min-h-[44px] pl-[43px] pr-1 rounded-[5px] text-[15px] font-medium whitespace-nowrap transition-colors duration-200 ${
      ativo
        ? 'bg-primary-soft text-primary-strong'
        : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground'
    }`;

  // Item do menu: fundo suave e barra na cor da marca quando ativo.
  const classeDoItem = (ativo: boolean, sub = false) =>
    `relative flex items-center gap-5 rounded-[5px] transition-colors duration-200 ${
      sub
        ? 'min-h-[48px] pl-[31px] pr-3 gap-[18px] text-base font-medium'
        : 'min-h-[56px] pl-[27px] pr-3 text-base font-semibold'
    } ${
      ativo
        ? 'bg-primary-soft text-primary-strong'
        : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground'
    }`;

  const menuDaConta = (gatilho: ReactNode, rotulo: string, classe = '') => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={rotulo} className={`text-left outline-none ${classe}`}>
        {gatilho}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
        <DropdownMenuLabel className="text-muted-foreground">Minha Conta</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Fundo escurecido da gaveta (só no celular) — tocar fora fecha o menu */}
      {menuAberto && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden="true"
        />
      )}

      {/* Menu lateral */}
      <aside
        className={`fixed left-0 top-0 h-full w-[276px] flex flex-col overflow-y-auto bg-sidebar shadow-[0_4px_4px_rgba(0,0,0,0.25)] z-50
          transition-transform duration-300 lg:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Fechar (só no celular) */}
        <button
          onClick={() => setMenuAberto(false)}
          className="lg:hidden absolute top-3 right-3 w-9 h-9 rounded-[10px] bg-sidebar-accent flex items-center justify-center text-muted-foreground hover:text-primary-strong transition-colors"
          aria-label="Fechar menu"
        >
          <X className="w-[18px] h-[18px]" />
        </button>

        {/* Marca */}
        <div className="px-6 pt-10 pb-[46px]">
          {activeBranding?.logoType === 'image' && logoDoTema ? (
            // Vai largo, sem repetir o nome: o logo horizontal já o traz.
            <div className="flex items-center h-[39px]">
              <img
                src={logoDoTema}
                alt={activeBranding.companyName || 'Logo'}
                className="max-h-10 max-w-full object-contain"
              />
            </div>
          ) : activeBranding?.logoType === 'image' ? (
            <div className="flex items-center gap-3">
              <img
                src={activeBranding.logoUri || NeoPowerLogo}
                alt="Logo"
                className="w-[39px] h-[39px] rounded-full object-contain shrink-0 bg-white"
              />
              {activeBranding?.companyName && (
                <span className="text-2xl font-semibold leading-none text-sidebar-foreground truncate">
                  {activeBranding.companyName}
                </span>
              )}
            </div>
          ) : (
            // Marca desenhada (NeoPower e marcas sem logo): o círculo com o raio do Figma.
            <div className="flex items-center gap-[14px]">
              <span className="w-[39px] h-[39px] rounded-full bg-black/70 dark:bg-primary text-white dark:text-sidebar flex items-center justify-center shrink-0">
                <Icone nome="marca-raio" tamanho={14} altura={20} />
              </span>
              <span className="text-2xl font-semibold leading-none text-sidebar-foreground truncate">
                {activeBranding?.companyName || 'NeoPower'}
              </span>
            </div>
          )}
        </div>

        {/* Navegação */}
        <nav aria-label="Menu principal" className="flex-1 px-[6px] space-y-1">
          {podeVerItem(VISAO_GERAL) &&
            (() => {
              const ativo = location.pathname === '/' && !isKairosOpen;
              return (
                <Link
                  to="/"
                  aria-current={ativo ? 'page' : undefined}
                  onClick={() => setIsKairosOpen(false)}
                  className={classeDoItem(ativo)}
                >
                  {ativo && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 inset-y-0 w-3 rounded-[5px] bg-primary"
                    />
                  )}
                  <IconeDoItem icone={VISAO_GERAL.icone} />
                  <span>{VISAO_GERAL.label}</span>
                </Link>
              );
            })()}

          {GRUPOS.map(group => {
            const groupVisibleItems = group.items.filter(podeVerItem);
            if (groupVisibleItems.length === 0) return null;

            const isGroupActive =
              groupVisibleItems.some(item => estaNaRota(location.pathname, item.path)) &&
              !isKairosOpen;
            const isOpen = openGroups[group.id];

            return (
              <div key={group.id} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className={`w-full text-left ${classeDoItem(false)} ${isGroupActive ? '!text-primary-strong' : ''}`}
                >
                  <IconeDoItem icone={group.icone} />
                  <span className="flex-1">{group.label}</span>
                  <span
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                  >
                    <Icone nome="seta-grupo" tamanho={19} altura={18} />
                  </span>
                </button>

                {isOpen && (
                  <div className="pl-[18px] space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {groupVisibleItems.map(item => {
                      const naRota = estaNaRota(location.pathname, item.path) && !isKairosOpen;
                      // Na Energia, as seções do módulo aparecem embaixo do item;
                      // com uma delas aberta, ela é que fica marcada.
                      const comSecoes = item.path === '/energia' && naRota;
                      const secaoAberta = comSecoes ? secaoDaEnergia : null;
                      const ativo = naRota && !secaoAberta;
                      return (
                        <Fragment key={item.path}>
                          <Link
                            to={item.path}
                            aria-current={ativo ? 'page' : undefined}
                            onClick={() => setIsKairosOpen(false)}
                            className={`${classeDoItem(ativo, true)} ${secaoAberta ? '!text-primary-strong' : ''}`}
                          >
                            <IconeDoItem icone={item.icone} />
                            {/* Rótulo e selo numa linha só: o selo não encolhe e fica
                                a 8 px do rótulo ("Erros do app NOVO" quebrava). */}
                            <span className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="min-w-0 truncate">{item.label}</span>
                              {item.novo && (
                                <span className="ml-auto shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary-strong">
                                  NOVO
                                </span>
                              )}
                            </span>
                          </Link>
                          {comSecoes && (
                            <ul aria-label="Seções do módulo Energia" className="space-y-0.5">
                              {SECOES_DA_ENERGIA.map(secao => {
                                const daVez = secao.aba === secaoAberta;
                                return (
                                  <li key={secao.aba}>
                                    <Link
                                      to={`/energia?aba=${secao.aba}`}
                                      aria-current={daVez ? 'page' : undefined}
                                      onClick={() => {
                                        // Só o ?aba= muda: o fechamento da gaveta
                                        // pela troca de página não acontece.
                                        setIsKairosOpen(false);
                                        setMenuAberto(false);
                                      }}
                                      className={classeDaSecao(daVez)}
                                    >
                                      {secao.icone}
                                      <span className="min-w-0 truncate">{secao.label}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* KAIROS (assistente): fica no pé do menu, no mesmo desenho dos itens */}
        <div className="px-[6px] pt-4 shrink-0">
          <button
            onClick={() => {
              setIsKairosOpen(!isKairosOpen);
              setMenuAberto(false);
            }}
            aria-pressed={isKairosOpen}
            className={`w-full text-left ${classeDoItem(isKairosOpen)}`}
            title="Falar com o KAIROS"
          >
            {isKairosOpen && (
              <span
                aria-hidden="true"
                className="absolute left-0 inset-y-0 w-3 rounded-[5px] bg-primary"
              />
            )}
            <span className="material-symbols-outlined text-2xl leading-none w-6 shrink-0">
              smart_toy
            </span>
            <span>KAIROS IA</span>
          </button>
        </div>

        {/* Conta */}
        <div className="px-6 pt-6 pb-[25px] shrink-0">
          {menuDaConta(
            <div className="flex items-center gap-[14px] min-w-0">
              <span className="w-[50px] h-[50px] rounded-full bg-black/70 dark:bg-white/15 text-white text-2xl font-semibold flex items-center justify-center shrink-0">
                {inicial(user?.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-foreground truncate" title={user?.name}>
                  {user?.name}
                </span>
                <span className="block text-sm font-semibold text-foreground uppercase truncate">
                  {user ? roleLabels[user.role] : ''}
                </span>
              </span>
            </div>,
            'Abrir menu da conta',
            'block w-full'
          )}
        </div>
      </aside>

      {/* Barra do topo */}
      <header className="fixed top-0 right-0 left-0 lg:left-[276px] flex justify-between items-center gap-3 px-4 lg:px-6 h-20 lg:h-24 bg-background z-40">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Abre a gaveta — some a partir de lg, onde a lateral já é fixa */}
          <button
            onClick={() => setMenuAberto(true)}
            className="lg:hidden w-[46px] h-[45px] shrink-0 rounded-[10px] bg-card flex items-center justify-center text-foreground hover:text-primary-strong transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          {/* A busca ocupa a largura toda no celular e competiria com o menu */}
          <div className="relative w-full max-w-[566px] group hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 transition-colors group-focus-within:text-primary-strong" />
            <input
              className="w-full h-[47px] bg-card rounded-[10px] pl-12 pr-4 text-[15px] text-foreground border border-transparent
                focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground transition-all"
              placeholder="Pesquisar"
              aria-label="Pesquisar no painel"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            />

            {/* Resultados da busca */}
            {isSearchFocused && searchQuery.trim() !== '' && (
              <div className="absolute top-full left-0 w-full mt-2 bg-card border border-border rounded-[10px] shadow-cartao py-2 min-w-[300px] z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-3 py-1.5 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Resultados da busca
                  </span>
                </div>
                {filteredResults.length > 0 ? (
                  filteredResults.map(item => (
                    <button
                      key={item.path}
                      onClick={() => {
                        void navigate(item.path);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <span className="w-8 h-8 rounded-[5px] bg-primary-soft flex items-center justify-center text-primary-strong">
                        <IconeDoItem icone={item.icone} tamanho={18} />
                      </span>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum resultado para "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-[29px] shrink-0">
          <button
            onClick={toggleTheme}
            className="w-[46px] h-[45px] rounded-[10px] bg-card flex items-center justify-center text-foreground hover:text-primary-strong transition-colors"
            title={isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
            aria-label={isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
          >
            <Icone nome="tema" />
          </button>
          <div className="w-[46px] h-[45px] rounded-[10px] bg-card flex items-center justify-center text-foreground">
            <NotificationBell />
          </div>
          {menuDaConta(
            <span className="w-[46px] h-[46px] rounded-full bg-[#b9b7b7] dark:bg-white/20 text-white text-lg font-semibold flex items-center justify-center">
              {inicial(user?.name)}
            </span>,
            'Abrir menu da conta (topo)'
          )}
        </div>
      </header>

      {/* Conteúdo */}
      {/* min-w-0 impede que uma tabela larga estique o main e crie rolagem
          horizontal na página inteira — a rolagem fica dentro da tabela. */}
      <main className="pl-0 lg:pl-[276px] pt-20 lg:pt-24 flex-1 min-w-0 min-h-screen overflow-auto">
        <div className="px-4 pb-4 pt-2 lg:px-6 lg:pb-8 max-w-[1640px] mx-auto">{children}</div>
      </main>
      {isKairosOpen && <KairosPanel onClose={() => setIsKairosOpen(false)} />}
    </div>
  );
};
