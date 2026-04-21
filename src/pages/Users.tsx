import { useState, useEffect, useMemo } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/api';

type ManagedRole = 'admin' | 'comum' | 'blocked';
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
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
}

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userLocations, setUserLocations] = useState<{ locationId: number; locationAddress: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState<number | null>(null);
  const [phoneValue, setPhoneValue] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'comum' as ManagedRole, phone: '', platform: 'web' as 'web' | 'app' | 'ambos' });
  const [platformTab, setPlatformTab] = useState<PlatformFilter>('web');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { void fetchUsers(); void fetchLocations(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/users');
      if (!r.ok) throw new Error();
      setUsers(await r.json());
    } catch { toast.error('Erro ao buscar usuários'); }
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
      const r = await api.post('/admin/users', { name: newUser.name, email: normalizedEmail, password: newUser.password, role: newUser.role, phone: newUser.phone || undefined, platform: newUser.platform });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erro'); }
      toast.success('Usuário criado!');
      setCreateDialogOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'comum', phone: '', platform: 'web' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-1">ACCESS CONTROL</span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Usuários</h1>
          <p className="text-on-surface-variant mt-1">Gerenciamento de usuários, funções e permissões de acesso</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void fetchUsers()} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-colors font-medium text-sm">
            <span className="material-symbols-outlined text-lg">refresh</span>
            Atualizar
          </button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
                Novo Usuário
              </button>
            </DialogTrigger>
            <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">person_add</span>
                  Criar Novo Usuário
                </DialogTitle>
                <DialogDescription className="text-on-surface-variant">
                  Preencha os dados para criar um novo usuário no sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Nome</Label>
                  <Input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nome completo" className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
                </div>
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Email</Label>
                  <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@exemplo.com" className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
                </div>
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Senha</Label>
                  <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 8 caracteres" className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Função</Label>
                    <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v as ManagedRole })}>
                      <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-surface-container border-outline-variant/20">
                        <SelectItem value="admin" className="text-on-surface focus:bg-surface-container-highest">Admin</SelectItem>
                        <SelectItem value="comum" className="text-on-surface focus:bg-surface-container-highest">Comum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Acesso do Usuário</Label>
                    <Select value={newUser.platform} onValueChange={v => setNewUser({ ...newUser, platform: v as 'web' | 'app' | 'ambos' })}>
                      <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-surface-container border-outline-variant/20">
                        <SelectItem value="web" className="text-on-surface focus:bg-surface-container-highest">Painel Web</SelectItem>
                        <SelectItem value="app" className="text-on-surface focus:bg-surface-container-highest">App Mobile</SelectItem>
                        <SelectItem value="ambos" className="text-on-surface focus:bg-surface-container-highest">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Telefone</Label>
                  <Input value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} placeholder="(92) 99999-9999" className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-outline-variant/20 text-on-surface-variant rounded-full px-6">Cancelar</Button>
                <button onClick={handleCreateUser} disabled={creating} className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                  {creating ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard icon="group" label="TOTAL USUÁRIOS" value={String(users.length)} />
        <SummaryCard icon="admin_panel_settings" label="ADMINS" value={String(users.filter(u => u.role === 'admin').length)} color="text-primary" />
        <SummaryCard icon="desktop_windows" label="USUÁRIOS WEB" value={String(webUsers.length)} color="text-foreground" />
        <SummaryCard icon="smartphone" label="USUÁRIOS MOBILE" value={String(mobileUsers.length)} color="text-foreground" />
      </div>

      {/* Platform Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant/10">
        <button
          onClick={() => setPlatformTab('web')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
            platformTab === 'web'
              ? 'text-primary border-primary'
              : 'text-on-surface-variant border-transparent hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">desktop_windows</span>
          Painel Web
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            platformTab === 'web' ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
          }`}>
            {webUsers.length}
          </span>
        </button>
        <button
          onClick={() => setPlatformTab('mobile')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
            platformTab === 'mobile'
              ? 'text-primary border-primary'
              : 'text-on-surface-variant border-transparent hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">smartphone</span>
          App Mobile
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            platformTab === 'mobile' ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
          }`}>
            {mobileUsers.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, email ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="px-3 py-2 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-foreground transition-colors text-xs font-bold flex items-center gap-1"
            title="Limpar busca"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Limpar
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">
              {platformTab === 'web' ? 'desktop_windows' : 'smartphone'}
            </span>
            {platformTab === 'web' ? 'Usuários do Painel Web' : 'Usuários do App Mobile'}
          </h3>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{visibleUsers.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Telefone</th>
                <th className="px-6 py-4">Função & Acesso</th>
                <th className="px-6 py-4">Marca</th>
                <th className="px-6 py-4">Locais</th>
                <th className="px-6 py-4">Acesso</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {visibleUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline mb-3 block">
                      {platformTab === 'web' ? 'desktop_windows' : 'smartphone'}
                    </span>
                    <p className="text-sm text-on-surface-variant">
                      {platformTab === 'web'
                        ? 'Nenhum usuário web cadastrado. Crie um pelo botão "Novo Usuário".'
                        : 'Nenhum usuário mobile cadastrado. Os usuários do app aparecem aqui ao se registrarem.'}
                    </p>
                  </td>
                </tr>
              )}
              {visibleUsers.map(user => (
                <tr key={user.id} className="hover:bg-surface-container-highest/30 transition-colors group">
                  {/* Name + Email */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-lg">person</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{user.name}</p>
                        <p className="text-[11px] text-on-surface-variant">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-6 py-4">
                    {editingPhone === user.id ? (
                      <div className="flex items-center gap-2">
                        <Input type="tel" value={phoneValue} onChange={e => setPhoneValue(e.target.value)} placeholder="(92) 99999-9999" className="w-36 h-8 bg-surface-container-low border-outline-variant/20 text-on-surface text-sm" />
                        <button onClick={() => handlePhoneUpdate(user.id)} className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
                          <span className="material-symbols-outlined text-sm">check</span>
                        </button>
                        <button onClick={() => { setEditingPhone(null); setPhoneValue(''); }} className="w-7 h-7 rounded-md bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-colors">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">phone</span>
                        <span className="text-sm text-on-surface-variant">{formatPhone(user.phone)}</span>
                        <button onClick={() => { setEditingPhone(user.id); setPhoneValue(user.phone || ''); }} className="w-6 h-6 rounded-md text-outline hover:text-primary hover:bg-surface-container-highest flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <span className="material-symbols-outlined text-xs">edit</span>
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4">
                    <Select value={user.role} onValueChange={v => handleRoleChange(user.id, v as ManagedRole)}>
                      <SelectTrigger className="w-[130px] bg-surface-container-low border-outline-variant/20 text-on-surface text-sm h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-container border-outline-variant/20">
                        <SelectItem value="admin" className="text-on-surface focus:bg-surface-container-highest">Admin</SelectItem>
                        <SelectItem value="comum" className="text-on-surface focus:bg-surface-container-highest">Comum</SelectItem>
                        <SelectItem value="blocked" className="text-error focus:bg-error/10">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Brand */}
                  <td className="px-6 py-4">
                    {user.clientId ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-[10px] font-bold font-mono uppercase">
                        {user.clientId}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant text-xs">Padrão</span>
                    )}
                  </td>

                  {/* Locations */}
                  <td className="px-6 py-4">
                    {user.locationIds ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface border border-outline-variant/10 text-xs font-bold">
                        <span className="material-symbols-outlined text-xs">location_on</span>
                        {user.locationIds.length}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                        TODOS
                      </span>
                    )}
                  </td>

                  {/* Platform Access */}
                  <td className="px-6 py-4">
                    {user.platform === 'web' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                        <span className="material-symbols-outlined text-xs">desktop_windows</span>
                        WEB
                      </span>
                    )}
                    {user.platform === 'mobile' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-[10px] font-bold">
                        <span className="material-symbols-outlined text-xs">smartphone</span>
                        APP
                      </span>
                    )}
                    {!user.platform && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface-variant border border-outline-variant/10 text-[10px] font-bold">
                        <span className="material-symbols-outlined text-xs">sync_alt</span>
                        AMBOS
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    {user.role !== 'admin' && user.role !== 'blocked' && (
                      <Dialog
                        open={dialogOpen && selectedUser?.id === user.id}
                        onOpenChange={open => { setDialogOpen(open); if (!open) setSelectedUser(null); }}
                      >
                        <DialogTrigger
                          onClick={() => handleManageLocations(user)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface text-xs font-bold hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">location_on</span>
                          Locais
                        </DialogTrigger>
                        <DialogContent className="bg-surface-container border-outline-variant/20 text-on-surface">
                          <DialogHeader>
                            <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
                              <span className="material-symbols-outlined text-primary">location_on</span>
                              Gerenciar Locais — {user.name}
                            </DialogTitle>
                            <DialogDescription className="text-on-surface-variant">
                              Adicione ou remova locais que este usuário pode acessar
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Adicionar Local</label>
                              <Select onValueChange={handleAddLocation}>
                                <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                                  <SelectValue placeholder="Selecione um local" />
                                </SelectTrigger>
                                <SelectContent className="bg-surface-container border-outline-variant/20">
                                  {locations.filter(l => !userLocations.some(ul => ul.locationId === l.id)).map(l => (
                                    <SelectItem key={l.id} value={l.id.toString()} className="text-on-surface focus:bg-surface-container-highest">{l.nomeDoLocal}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Locais Permitidos</label>
                              {userLocations.length === 0 ? (
                                <p className="text-on-surface-variant text-sm py-4 text-center">Nenhum local atribuído</p>
                              ) : (
                                <div className="space-y-2">
                                  {userLocations.map(ul => (
                                    <div key={ul.locationId} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/5">
                                      <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                                        <span className="text-sm text-on-surface">{locations.find(l => l.id === ul.locationId)?.nomeDoLocal || ul.locationAddress}</span>
                                      </div>
                                      <button onClick={() => handleRemoveLocation(ul.locationId)} className="text-error text-xs font-bold hover:bg-error/10 px-2 py-1 rounded transition-colors">
                                        Remover
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end pt-4 border-t border-outline-variant/10">
                            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-outline-variant/20 text-on-surface-variant rounded-full px-6">Fechar</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function SummaryCard({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="glass-panel p-6 rounded-lg border border-outline-variant/10 flex flex-col justify-between h-28 hover:border-primary/30 transition-colors">
      <div className="flex justify-between items-start">
        <span className="text-on-surface-variant text-xs uppercase tracking-widest">{label}</span>
        <span className={`material-symbols-outlined text-sm ${color || 'text-primary'}`}>{icon}</span>
      </div>
      <span className="text-3xl font-headline font-bold text-on-surface">{value}</span>
    </div>
  );
}
