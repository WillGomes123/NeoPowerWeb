import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  EnhancedTable,
  EnhancedTableHeader,
  EnhancedTableBody,
  EnhancedTableRow,
  EnhancedTableHead,
  EnhancedTableCell,
} from '../components/EnhancedTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { MapPin, Users as UsersIcon, Phone, Check, X, Edit2, Plus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

type ManagedRole = 'admin' | 'atem' | 'comum' | 'blocked';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: ManagedRole;
  clientId?: string | null;
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
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'comum' as ManagedRole, phone: '' });

  useEffect(() => {
    void fetchUsers();
    void fetchLocations();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast.error('Erro ao buscar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.get('/locations/all');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
      toast.error('Erro ao buscar locais');
    }
  };

  const handleRoleChange = async (userId: number, newRole: ManagedRole) => {
    try {
      const response = await api.put(`/admin/users/${userId}/role`, { newRole });
      if (!response.ok) throw new Error('Failed to update role');
      toast.success('Role atualizada com sucesso!');
      void fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar a role:', error);
      toast.error('Falha ao atualizar a role.');
    }
  };

  const handleManageLocations = async (user: User) => {
    setSelectedUser(user);
    try {
      const response = await api.get(`/admin/users/${user.id}/locations`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setUserLocations(data.map((loc: { locationId: number; locationAddress: string }) => ({
        locationId: loc.locationId,
        locationAddress: loc.locationAddress,
      })));
      setDialogOpen(true);
    } catch (error) {
      console.error('Erro ao buscar locais do usuário:', error);
      toast.error('Erro ao buscar locais do usuário');
    }
  };

  const handleAddLocation = async (locationIdStr: string) => {
    if (!selectedUser || !locationIdStr) return;
    const locId = parseInt(locationIdStr);
    const loc = locations.find(l => l.id === locId);
    try {
      const response = await api.post(`/admin/users/${selectedUser.id}/locations`, {
        locationId: locId,
      });
      if (!response.ok) throw new Error('Failed to add location');

      setUserLocations(prev => [...prev, { locationId: locId, locationAddress: loc?.endereco || `Local #${locId}` }]);
      toast.success('Local adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar local:', error);
      toast.error('Erro ao adicionar local');
    }
  };

  const handleRemoveLocation = async (locationId: number) => {
    if (!selectedUser) return;
    try {
      const response = await api.delete(`/admin/users/${selectedUser.id}/locations`, {
        locationId,
      });
      if (!response.ok) throw new Error('Failed to remove location');
      setUserLocations(prev => prev.filter(loc => loc.locationId !== locationId));
      toast.success('Local removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover local:', error);
      toast.error('Erro ao remover local');
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Nome, email e senha são obrigatórios');
      return;
    }
    setCreating(true);
    try {
      const response = await api.post('/admin/users', {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        phone: newUser.phone || undefined,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao criar usuário');
      }
      toast.success('Usuário criado com sucesso!');
      setCreateDialogOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'comum', phone: '' });
      void fetchUsers();
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const startEditPhone = (user: User) => {
    setEditingPhone(user.id);
    setPhoneValue(user.phone || '');
  };

  const cancelEditPhone = () => {
    setEditingPhone(null);
    setPhoneValue('');
  };

  const handlePhoneUpdate = async (userId: number) => {
    try {
      const response = await api.put(`/admin/users/${userId}`, { phone: phoneValue || null });
      if (!response.ok) throw new Error('Failed to update phone');
      toast.success('Telefone atualizado com sucesso!');
      setEditingPhone(null);
      setPhoneValue('');
      void fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar telefone:', error);
      toast.error('Erro ao atualizar telefone');
    }
  };

  const formatPhone = (phone: string | null): string => {
    if (!phone) return '-';
    // Format as (XX) XXXXX-XXXX
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Carregando usuários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-emerald-400" />
            Usuários
          </h1>
          <p className="text-zinc-400 mt-1">Gerenciamento de usuários e permissões</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Criar Novo Usuário
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Preencha os dados para criar um novo usuário no sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Nome</Label>
                <Input
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Nome completo"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Email</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Senha</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Função</Label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v as ManagedRole })}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="admin" className="text-white focus:bg-zinc-700 focus:text-white">Admin</SelectItem>
                      <SelectItem value="atem" className="text-white focus:bg-zinc-700 focus:text-white">ATEM</SelectItem>
                      <SelectItem value="comum" className="text-white focus:bg-zinc-700 focus:text-white">Comum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Telefone</Label>
                  <Input
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="(92) 99999-9999"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
                {creating ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-6">
          <CardTitle className="text-white flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-emerald-400" />
            Lista de Usuários
          </CardTitle>
          <p className="text-sm text-zinc-400">Gerencie funções e acessos</p>
        </CardHeader>
        <CardContent className="pt-6">
          <EnhancedTable striped hoverable>
            <EnhancedTableHeader>
              <EnhancedTableRow hoverable={false}>
                <EnhancedTableHead>Nome</EnhancedTableHead>
                <EnhancedTableHead>Email</EnhancedTableHead>
                <EnhancedTableHead>Telefone</EnhancedTableHead>
                <EnhancedTableHead>Função</EnhancedTableHead>
                <EnhancedTableHead>Marca</EnhancedTableHead>
                <EnhancedTableHead>Locais</EnhancedTableHead>
                <EnhancedTableHead>Ações</EnhancedTableHead>
              </EnhancedTableRow>
            </EnhancedTableHeader>
            <EnhancedTableBody>
              {users.map((user, index) => (
                <EnhancedTableRow key={user.id} index={index}>
                  <EnhancedTableCell className="font-semibold text-white">
                    {user.name}
                  </EnhancedTableCell>
                  <EnhancedTableCell className="text-sm text-zinc-400">
                    {user.email}
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    {editingPhone === user.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="tel"
                          value={phoneValue}
                          onChange={e => setPhoneValue(e.target.value)}
                          placeholder="(92) 99999-9999"
                          className="w-36 h-8 bg-zinc-800 border-zinc-700 text-white text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handlePhoneUpdate(user.id)}
                          className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelEditPhone}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-800/20"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm text-zinc-400">
                          {formatPhone(user.phone)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditPhone(user)}
                          className="h-6 w-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    <div className="space-y-2">
                      <Select
                        value={user.role}
                        onValueChange={value => handleRoleChange(user.id, value as ManagedRole)}
                      >
                        <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem
                            value="admin"
                            className="text-white focus:bg-zinc-700 focus:text-white"
                          >
                            Admin
                          </SelectItem>
                          <SelectItem
                            value="atem"
                            className="text-white focus:bg-zinc-700 focus:text-white"
                          >
                            ATEM
                          </SelectItem>
                          <SelectItem
                            value="comum"
                            className="text-white focus:bg-zinc-700 focus:text-white"
                          >
                            Comum
                          </SelectItem>
                          <SelectItem
                            value="blocked"
                            className="text-red-200 focus:bg-red-900/40 focus:text-red-100"
                          >
                            Bloqueado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-zinc-500">
                        {user.role === 'admin' && 'Acesso total'}
                        {user.role === 'atem' && 'Tema ATEM, acessos limitados'}
                        {user.role === 'comum' && 'Tema NeoPower padrão'}
                        {user.role === 'blocked' && 'Sem acesso ao dashboard'}
                      </p>
                    </div>
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    {user.clientId ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-900/30 text-blue-300 border border-blue-700/30 text-xs font-mono">
                        {user.clientId}
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-xs">Padrão</span>
                    )}
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    {user.locationIds ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-sm font-medium">
                        {user.locationIds.length} local(is)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-medium">
                        Todos
                      </span>
                    )}
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    {user.role !== 'admin' && user.role !== 'blocked' && (
                      <Dialog
                        open={dialogOpen && selectedUser?.id === user.id}
                        onOpenChange={open => {
                          setDialogOpen(open);
                          if (!open) setSelectedUser(null);
                        }}
                      >
                        <DialogTrigger
                          onClick={() => handleManageLocations(user)}
                          className="inline-flex items-center justify-center gap-2 rounded-md text-sm px-3 py-2 bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 hover:border-zinc-600 transition-all"
                        >
                          <MapPin className="w-4 h-4" />
                          Gerenciar Locais
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                          <DialogHeader>
                            <DialogTitle className="text-white">
                              Gerenciar Locais - {user.name}
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400">
                              Adicione ou remova locais que este usuário pode acessar
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-zinc-300 text-sm">Adicionar Local</label>
                              <div className="flex gap-2">
                                <Select onValueChange={handleAddLocation}>
                                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 flex-1">
                                    <SelectValue placeholder="Selecione um local" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-zinc-800 border-zinc-700">
                                    {locations
                                      .filter(loc => !userLocations.some(ul => ul.locationId === loc.id))
                                      .map(loc => (
                                        <SelectItem
                                          key={loc.id}
                                          value={loc.id.toString()}
                                          className="text-white focus:bg-zinc-700 focus:text-white"
                                        >
                                          {loc.nomeDoLocal} ({loc.endereco})
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-zinc-300 text-sm">Locais Permitidos:</h3>
                              {userLocations.length === 0 ? (
                                <p className="text-zinc-500 text-sm">
                                  Nenhum local atribuído
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {userLocations.map(ul => (
                                    <li
                                      key={ul.locationId}
                                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700"
                                    >
                                      <span className="text-white">
                                        {locations.find(l => l.id === ul.locationId)?.nomeDoLocal || ul.locationAddress}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoveLocation(ul.locationId)}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                      >
                                        Remover
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                            <Button
                              variant="outline"
                              onClick={() => setDialogOpen(false)}
                              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            >
                              Fechar
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </EnhancedTableCell>
                </EnhancedTableRow>
              ))}
            </EnhancedTableBody>
          </EnhancedTable>
        </CardContent>
      </Card>
    </div>
  );
};
