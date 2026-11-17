import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  BadgeCheck,
  Check,
  MapPin,
  Monitor,
  MoreVertical,
  Pencil,
  Phone,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  UserPlus,
  Users as IconeUsuarios,
  X,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { cn } from '../components/ui/utils';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/api';
import {
  AbasDaPagina,
  BotaoAtualizar,
  CabecalhoDaPagina,
  CartaoContador,
} from '../components/painel/Pagina';
import {
  BarraDeFiltros,
  CampoDeBusca,
  classeDoBotaoContorno,
  classeDoBotaoPrincipal,
} from '../components/painel/Pecas';
import {
  CabecalhoDoCartao,
  CarregandoPagina,
  ConfirmarExclusao,
  EstadoVazio,
  classeDaEtiqueta,
  classeDaTabela,
  classeDoBotaoDeIcone,
  classeDoCartaoDaTabela,
  classeDoTd,
  classeDoTh,
  classeDoBotaoPrincipalMenor,
  classeDoCampo,
  classeDoDialogo,
  classeDoRotulo,
  classeDoSelectPequeno,
} from '../components/configuracoes/Pecas';

type ManagedRole = 'admin' | 'operador' | 'comum' | 'blocked';
type Platform = 'web' | 'mobile' | null;
type PlatformFilter = 'web' | 'mobile';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: ManagedRole;
  clientId?: string | null;
  platform?: Platform;
  locationIds?: string[];
  profileId?: number | null;
  profileName?: string | null;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
}

interface ProfileOption {
  id: number;
  name: string;
  color?: string | null;
}

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userLocations, setUserLocations] = useState<{ locationId: number; locationAddress: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState<number | null>(null);
  const [phoneValue, setPhoneValue] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'comum' as ManagedRole, phone: '', platform: 'web' as 'web' | 'app' | 'ambos', profileId: '' as string });
  const [platformTab, setPlatformTab] = useState<PlatformFilter>('web');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUserData, setEditUserData] = useState({ id: 0, name: '', email: '', role: 'comum' as ManagedRole, phone: '', platform: 'web' as 'web' | 'app' | 'ambos', password: '', profileId: '' as string });

  useEffect(() => { void fetchUsers(); void fetchLocations(); void fetchProfiles(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/users');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setUsers(Array.isArray(d) ? d : []);
      setAtualizadoEm(new Date());
      setFalhou(false);
    } catch {
      setFalhou(true);
      toast.error('Erro ao buscar usuários');
    }
    finally { setLoading(false); }
  };

  const fetchLocations = async () => {
    try {
      const r = await api.get('/locations/all');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setLocations(d.locations || []);
    } catch { toast.error('Erro ao buscar locais'); }
  };

  const fetchProfiles = async () => {
    try {
      const r = await api.get('/profiles');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setProfiles(Array.isArray(d) ? d : []);
    } catch { /* perfis são opcionais — silencioso */ }
  };

  const handleRoleChange = async (userId: number, newRole: ManagedRole) => {
    try {
      const r = await api.put(`/admin/users/${userId}/role`, { newRole });
      if (!r.ok) throw new Error();
      toast.success('Role atualizada!');
      void fetchUsers();
    } catch { toast.error('Falha ao atualizar role'); }
  };

  const handleManageLocations = async (user: User) => {
    setSelectedUser(user);
    try {
      const r = await api.get(`/admin/users/${user.id}/locations`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setUserLocations(d.map((l: any) => ({ locationId: l.locationId, locationAddress: l.locationAddress })));
      setDialogOpen(true);
    } catch { toast.error('Erro ao buscar locais do usuário'); }
  };

  const handleAddLocation = async (locIdStr: string) => {
    if (!selectedUser || !locIdStr) return;
    const locId = parseInt(locIdStr);
    const loc = locations.find(l => l.id === locId);
    try {
      const r = await api.post(`/admin/users/${selectedUser.id}/locations`, { locationId: locId });
      if (!r.ok) throw new Error();
      setUserLocations(p => [...p, { locationId: locId, locationAddress: loc?.endereco || `Local #${locId}` }]);
      toast.success('Local adicionado!');
    } catch { toast.error('Erro ao adicionar local'); }
  };

  const handleRemoveLocation = async (locationId: number) => {
    if (!selectedUser) return;
    try {
      const r = await api.delete(`/admin/users/${selectedUser.id}/locations`, { locationId });
      if (!r.ok) throw new Error();
      setUserLocations(p => p.filter(l => l.locationId !== locationId));
      toast.success('Local removido!');
    } catch { toast.error('Erro ao remover local'); }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) { toast.error('Nome, email e senha são obrigatórios'); return; }
    setCreating(true);
    try {
      // Email é case-insensitive — normaliza antes de enviar
      const normalizedEmail = newUser.email.trim().toLowerCase();
      const r = await api.post('/admin/users', { name: newUser.name, email: normalizedEmail, password: newUser.password, role: newUser.role, phone: newUser.phone || undefined, platform: newUser.platform, profileId: newUser.profileId ? parseInt(newUser.profileId) : null });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erro'); }
      toast.success('Usuário criado!');
      setCreateDialogOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'comum', phone: '', platform: 'web', profileId: '' });
      void fetchUsers();
    } catch (e: any) { toast.error(e.message || 'Erro ao criar usuário'); }
    finally { setCreating(false); }
  };

  const handlePhoneUpdate = async (userId: number) => {
    try {
      const r = await api.put(`/admin/users/${userId}`, { phone: phoneValue || null });
      if (!r.ok) throw new Error();
      toast.success('Telefone atualizado!');
      setEditingPhone(null);
      void fetchUsers();
    } catch { toast.error('Erro ao atualizar telefone'); }
  };

  const handlePlatformAccessChange = async (userId: number, newPlatform: 'web' | 'mobile' | null) => {
    try {
      const r = await api.put(`/admin/users/${userId}`, { platform: newPlatform });
      if (!r.ok) throw new Error();
      toast.success('Acesso atualizado com sucesso!');
      void fetchUsers();
    } catch {
      toast.error('Erro ao atualizar acesso');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    try {
      const r = await api.delete(`/admin/users/${selectedUser.id}`);
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erro ao excluir'); }
      toast.success('Usuário excluído!');
      setDeleteUserDialogOpen(false);
      void fetchUsers();
    } catch (e: any) { toast.error(e.message || 'Erro interno ao excluir'); }
    finally { setDeleting(false); }
  };

  const handleEditUser = async () => {
    if (!editUserData.name || !editUserData.email) return toast.error('Nome e email obrigatórios');
    setEditing(true);
    try {
      const normalizedEmail = editUserData.email.trim().toLowerCase();
      const payload: any = { name: editUserData.name, email: normalizedEmail, role: editUserData.role, phone: editUserData.phone || undefined, platform: editUserData.platform, profileId: editUserData.profileId ? parseInt(editUserData.profileId) : null };
      if (editUserData.password) payload.password = editUserData.password;

      const r = await api.put(`/admin/users/${editUserData.id}`, payload);
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erro'); }
      toast.success('Usuário atualizado!');
      setEditUserDialogOpen(false);
      void fetchUsers();
    } catch (e: any) { toast.error(e.message || 'Erro ao editar usuário'); }
    finally { setEditing(false); }
  };

  const openEditModal = (user: User) => {
    const plat = user.platform === 'mobile' ? 'app' : user.platform === null ? 'ambos' : 'web';
    setEditUserData({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone || '', platform: plat as any, password: '', profileId: user.profileId ? String(user.profileId) : '' });
    setEditUserDialogOpen(true);
  };

  // Separa usuários por plataforma. NULL é tratado como 'web' (legado)
  const webUsers = useMemo(
    () => users.filter(u => u.platform === 'web' || u.platform == null),
    [users]
  );
  const mobileUsers = useMemo(
    () => users.filter(u => u.platform === 'mobile' || u.platform == null),
    [users]
  );

  const visibleUsers = useMemo(() => {
    const base = platformTab === 'web' ? webUsers : mobileUsers;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toLowerCase();
    return base.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q),
    );
  }, [platformTab, webUsers, mobileUsers, searchQuery]);

  const formatPhone = (phone: string | null) => {
    if (!phone) return '—';
    const c = phone.replace(/\D/g, '');
    if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
    if (c.length === 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
    return phone;
  };

  // Só a primeira carga troca a tela pelo carregando; depois, o "Atualizar" mostra.
  if (loading && !atualizadoEm && users.length === 0) {
    return <CarregandoPagina />;
  }

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        rotulo="Controle de acesso"
        titulo="Usuários"
        subtitulo="Gerenciamento de usuários, funções e permissões de acesso"
        acoes={
          <>
            <button type="button" onClick={() => setCreateDialogOpen(true)} className={classeDoBotaoPrincipal}>
              <UserPlus className="w-5 h-5" aria-hidden="true" />
              Novo usuário
            </button>
            <BotaoAtualizar
              aoAtualizar={() => void fetchUsers()}
              carregando={loading}
              atualizadoEm={atualizadoEm}
              falhou={falhou}
            />
          </>
        }
      />

      {/* Contadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[25px]">
        <CartaoContador icone={<IconeUsuarios className="w-7 h-7" />} rotulo="Usuários" valor={users.length} />
        <CartaoContador icone={<ShieldCheck className="w-7 h-7" />} rotulo="Admins" valor={users.filter(u => u.role === 'admin').length} />
        <CartaoContador
          icone={<Monitor className="w-7 h-7" />}
          rotulo="Painel web"
          valor={webUsers.length}
          fundoDoIcone="bg-tom-azul text-tom-azul-icone"
        />
        <CartaoContador
          icone={<Smartphone className="w-7 h-7" />}
          rotulo="App mobile"
          valor={mobileUsers.length}
          fundoDoIcone="bg-tom-amarelo text-tom-amarelo-icone"
        />
      </div>

      <AbasDaPagina
        rotulo="Usuários por plataforma"
        ativa={platformTab}
        aoMudar={setPlatformTab}
        abas={[
          { id: 'web', rotulo: 'Painel web', icone: <Monitor className="w-5 h-5" aria-hidden="true" />, contador: webUsers.length },
          { id: 'mobile', rotulo: 'App mobile', icone: <Smartphone className="w-5 h-5" aria-hidden="true" />, contador: mobileUsers.length },
        ]}
      />

      <BarraDeFiltros>
        <CampoDeBusca
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, email ou telefone..."
          aria-label="Buscar por nome, email ou telefone"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} className={classeDoBotaoContorno}>
            <X className="w-4 h-4" aria-hidden="true" />
            Limpar
          </button>
        )}
      </BarraDeFiltros>

      {/* Tabela (linhas verdes arredondadas, como Notificações e Alarmes no Figma) */}
      <section className={classeDoCartaoDaTabela} aria-label="Lista de usuários">
        <CabecalhoDoCartao
          titulo={platformTab === 'web' ? 'Usuários do painel web' : 'Usuários do app mobile'}
          detalhe={`${visibleUsers.length} registros`}
        />
        {visibleUsers.length === 0 ? (
          <EstadoVazio icone={platformTab === 'web' ? <Monitor className="w-10 h-10" /> : <Smartphone className="w-10 h-10" />}>
            {platformTab === 'web'
              ? 'Nenhum usuário web cadastrado. Crie um pelo botão "Novo usuário".'
              : 'Nenhum usuário mobile cadastrado. Os usuários do app aparecem aqui ao se registrarem.'}
          </EstadoVazio>
        ) : (
          <div className="overflow-x-auto">
            <table className={classeDaTabela}>
              <thead>
                <tr>
                  <th className={classeDoTh}>Usuário</th>
                  <th className={classeDoTh}>Telefone</th>
                  <th className={classeDoTh}>Função</th>
                  <th className={classeDoTh}>Perfil</th>
                  <th className={classeDoTh}>Marca</th>
                  <th className={classeDoTh}>Locais</th>
                  <th className={cn(classeDoTh, 'text-right')}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map(user => (
                  <tr key={user.id} className="group">
                    {/* Nome e e-mail */}
                    <td className={classeDoTd}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-9 h-9 rounded-full bg-card text-muted-foreground flex items-center justify-center shrink-0"
                          aria-hidden="true"
                        >
                          <User className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Telefone */}
                    <td className={classeDoTd}>
                      {editingPhone === user.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="tel"
                            value={phoneValue}
                            onChange={e => setPhoneValue(e.target.value)}
                            placeholder="(92) 99999-9999"
                            aria-label={`Telefone de ${user.name}`}
                            className="w-40 h-9 rounded-[25px] bg-card border-border text-foreground text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handlePhoneUpdate(user.id)}
                            className="w-8 h-8 rounded-full bg-primary-soft text-primary-strong flex items-center justify-center hover:brightness-95 transition"
                            aria-label="Salvar telefone"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingPhone(null); setPhoneValue(''); }}
                            className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:text-foreground transition"
                            aria-label="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Phone className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                          <span className="text-sm text-foreground">{formatPhone(user.phone)}</span>
                          <button
                            type="button"
                            onClick={() => { setEditingPhone(user.id); setPhoneValue(user.phone || ''); }}
                            className={cn(classeDoBotaoDeIcone, 'w-7 h-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
                            aria-label={`Editar telefone de ${user.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Função */}
                    <td className={classeDoTd}>
                      <Select value={user.role} onValueChange={v => handleRoleChange(user.id, v as ManagedRole)}>
                        <SelectTrigger className={`w-[140px] ${classeDoSelectPequeno}`} aria-label={`Função de ${user.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operador">Operador</SelectItem>
                          <SelectItem value="comum">Comum</SelectItem>
                          <SelectItem value="blocked" className="text-destructive focus:text-destructive">Bloqueado</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Perfil (segmento de cliente) */}
                    <td className={classeDoTd}>
                      {user.profileName ? (
                        <span className={`${classeDaEtiqueta} bg-primary-soft text-primary-strong`}>
                          <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          {user.profileName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>

                    {/* Marca */}
                    <td className={classeDoTd}>
                      {user.clientId ? (
                        <span className={`${classeDaEtiqueta} bg-tom-azul text-tom-azul-icone font-mono`}>
                          {user.clientId}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Padrão</span>
                      )}
                    </td>

                    {/* Locais */}
                    <td className={classeDoTd}>
                      {user.locationIds ? (
                        <span className={`${classeDaEtiqueta} bg-card text-foreground`}>
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                          {user.locationIds.length}
                        </span>
                      ) : (
                        <span className={`${classeDaEtiqueta} bg-primary-soft text-primary-strong`}>Todos</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className={`${classeDoTd} text-right`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className={classeDoBotaoDeIcone} aria-label={`Ações de ${user.name}`}>
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-[10px]">
                          {user.role !== 'admin' && user.role !== 'blocked' && (
                            <DropdownMenuItem
                              onClick={() => handleManageLocations(user)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <MapPin className="w-4 h-4" aria-hidden="true" />
                              Gerenciar locais
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => openEditModal(user)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                            Editar usuário
                          </DropdownMenuItem>

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                              <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
                              Alterar acesso
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-44 rounded-[10px]">
                              <DropdownMenuItem
                                onClick={() => handlePlatformAccessChange(user.id, 'web')}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Monitor className="w-4 h-4" aria-hidden="true" />
                                Painel web
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePlatformAccessChange(user.id, 'mobile')}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Smartphone className="w-4 h-4" aria-hidden="true" />
                                App
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePlatformAccessChange(user.id, null)}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
                                Ambos
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          {/* Excluir fica separado e em vermelho */}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => { setSelectedUser(user); setDeleteUserDialogOpen(true); }}
                            className="flex items-center gap-2 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Excluir usuário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Novo usuário */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className={`${classeDoDialogo} sm:max-w-[520px]`}>
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-foreground flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary-strong" aria-hidden="true" />
              Criar novo usuário
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Preencha os dados para criar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="novo-nome" className={classeDoRotulo}>Nome</Label>
              <Input id="novo-nome" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nome completo" className={classeDoCampo} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-email" className={classeDoRotulo}>Email</Label>
              <Input id="novo-email" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@exemplo.com" className={classeDoCampo} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-senha" className={classeDoRotulo}>Senha</Label>
              <Input id="novo-senha" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 8 caracteres" className={classeDoCampo} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={classeDoRotulo}>Função</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v as ManagedRole })}>
                  <SelectTrigger className={classeDoCampo} aria-label="Função"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="comum">Comum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className={classeDoRotulo}>Acesso do usuário</Label>
                <Select value={newUser.platform} onValueChange={v => setNewUser({ ...newUser, platform: v as 'web' | 'app' | 'ambos' })}>
                  <SelectTrigger className={classeDoCampo} aria-label="Acesso do usuário"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Painel web</SelectItem>
                    <SelectItem value="app">App mobile</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="novo-telefone" className={classeDoRotulo}>Telefone</Label>
                <Input id="novo-telefone" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} placeholder="(92) 99999-9999" className={classeDoCampo} />
              </div>
              <div className="space-y-2">
                <Label className={classeDoRotulo}>Perfil de cliente</Label>
                <Select value={newUser.profileId || 'none'} onValueChange={v => setNewUser({ ...newUser, profileId: v === 'none' ? '' : v })}>
                  <SelectTrigger className={classeDoCampo} aria-label="Perfil de cliente"><SelectValue placeholder="Sem perfil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-muted-foreground">Sem perfil (tarifa global)</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateDialogOpen(false)} className={classeDoBotaoContorno}>Cancelar</button>
            <button type="button" onClick={handleCreateUser} disabled={creating} className={classeDoBotaoPrincipalMenor}>
              {creating ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gerenciar locais */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={classeDoDialogo}>
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-strong" aria-hidden="true" />
              Gerenciar locais — {selectedUser?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Adicione ou remova locais que este usuário pode acessar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className={classeDoRotulo}>Adicionar local</Label>
              <Select onValueChange={handleAddLocation}>
                <SelectTrigger className={classeDoCampo} aria-label="Adicionar local">
                  <SelectValue placeholder="Selecione um local" />
                </SelectTrigger>
                <SelectContent>
                  {locations.filter(l => !userLocations.some(ul => ul.locationId === l.id)).map(l => (
                    <SelectItem key={l.id} value={l.id.toString()}>{l.nomeDoLocal}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className={classeDoRotulo}>Locais permitidos</p>
              {userLocations.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Nenhum local atribuído</p>
              ) : (
                <ul className="space-y-2">
                  {userLocations.map(ul => (
                    <li key={ul.locationId} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-[10px] bg-muted/60">
                      <span className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-4 h-4 text-primary-strong shrink-0" aria-hidden="true" />
                        <span className="text-sm text-foreground truncate">{locations.find(l => l.id === ul.locationId)?.nomeDoLocal || ul.locationAddress}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(ul.locationId)}
                        className="text-destructive text-sm font-medium hover:bg-destructive/10 px-3 h-8 rounded-[25px] transition-colors shrink-0"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => setDialogOpen(false)} className={classeDoBotaoContorno}>Fechar</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar usuário */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className={`${classeDoDialogo} sm:max-w-[520px]`}>
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-foreground flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary-strong" aria-hidden="true" />
              Editar usuário
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Atualize as informações principais do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editar-nome" className={classeDoRotulo}>Nome</Label>
                <Input id="editar-nome" value={editUserData.name} onChange={e => setEditUserData({ ...editUserData, name: e.target.value })} className={classeDoCampo} />
              </div>
              <div className="space-y-2">
                <Label className={classeDoRotulo}>Função</Label>
                <Select value={editUserData.role} onValueChange={v => setEditUserData({ ...editUserData, role: v as ManagedRole })}>
                  <SelectTrigger className={classeDoCampo} aria-label="Função"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="comum">Comum</SelectItem>
                    <SelectItem value="blocked" className="text-destructive focus:text-destructive">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editar-email" className={classeDoRotulo}>Email</Label>
              <Input id="editar-email" type="email" value={editUserData.email} onChange={e => setEditUserData({ ...editUserData, email: e.target.value })} className={classeDoCampo} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={classeDoRotulo}>Acesso do usuário</Label>
                <Select value={editUserData.platform} onValueChange={v => setEditUserData({ ...editUserData, platform: v as any })}>
                  <SelectTrigger className={classeDoCampo} aria-label="Acesso do usuário"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Painel web</SelectItem>
                    <SelectItem value="app">App mobile</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editar-senha" className={classeDoRotulo}>Nova senha</Label>
                <Input id="editar-senha" type="password" placeholder="Deixe em branco p/ manter" value={editUserData.password} onChange={e => setEditUserData({ ...editUserData, password: e.target.value })} className={classeDoCampo} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editar-telefone" className={classeDoRotulo}>Telefone</Label>
                <Input id="editar-telefone" value={editUserData.phone} onChange={e => setEditUserData({ ...editUserData, phone: e.target.value })} className={classeDoCampo} />
              </div>
              <div className="space-y-2">
                <Label className={classeDoRotulo}>Perfil de cliente</Label>
                <Select value={editUserData.profileId || 'none'} onValueChange={v => setEditUserData({ ...editUserData, profileId: v === 'none' ? '' : v })}>
                  <SelectTrigger className={classeDoCampo} aria-label="Perfil de cliente"><SelectValue placeholder="Sem perfil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-muted-foreground">Sem perfil (tarifa global)</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditUserDialogOpen(false)} className={classeDoBotaoContorno}>Cancelar</button>
            <button type="button" onClick={handleEditUser} disabled={editing} className={classeDoBotaoPrincipalMenor}>
              {editing ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir usuário: diz o que acontece antes */}
      <ConfirmarExclusao
        aberto={deleteUserDialogOpen}
        aoMudar={setDeleteUserDialogOpen}
        titulo="Excluir usuário"
        rotuloDoBotao="Sim, excluir"
        carregando={deleting}
        aoConfirmar={() => void handleDeleteUser()}
      >
        <p>
          Tem certeza que deseja excluir o usuário <strong className="text-foreground">{selectedUser?.name}</strong>? Esta ação removerá o acesso dele ao sistema permanentemente.
        </p>
      </ConfirmarExclusao>
    </div>
  );
};
