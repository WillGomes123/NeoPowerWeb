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
import { MapPin, Users as UsersIcon, Phone, Check, X, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

type ManagedRole = 'admin' | 'atem' | 'comum' | 'blocked';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: ManagedRole;
  locationIds?: string[];
}

interface Location {
  id: number;
  nomeDoLocal: string;
  address: string;
}

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userLocations, setUserLocations] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState<number | null>(null);
  const [phoneValue, setPhoneValue] = useState('');

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
      const response = await api.get('/locations');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setLocations(data);
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
      setUserLocations(data.map((loc: { locationAddress: string }) => loc.locationAddress));
      setDialogOpen(true);
    } catch (error) {
      console.error('Erro ao buscar locais do usuário:', error);
      toast.error('Erro ao buscar locais do usuário');
    }
  };

  const handleAddLocation = async (locationAddress: string) => {
    if (!selectedUser || !locationAddress) return;
    try {
      const response = await api.post(`/admin/users/${selectedUser.id}/locations`, {
        locationAddress: locationAddress,
      });
      if (!response.ok) throw new Error('Failed to add location');

      // Atualizar lista local
      setUserLocations(prev => [...prev, locationAddress]);
      toast.success('Local adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar local:', error);
      toast.error('Erro ao adicionar local');
    }
  };

  const handleRemoveLocation = async (locationAddress: string) => {
    if (!selectedUser) return;
    try {
      const response = await api.delete(`/admin/users/${selectedUser.id}/locations`, {
        locationAddress: locationAddress,
      });
      if (!response.ok) throw new Error('Failed to remove location');
      setUserLocations(prev => prev.filter(loc => loc !== locationAddress));
      toast.success('Local removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover local:', error);
      toast.error('Erro ao remover local');
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
        <div className="text-emerald-400">Carregando usuários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-emerald-50 flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-emerald-400" />
          Usuários
        </h1>
        <p className="text-emerald-300/60 mt-1">Gerenciamento de usuários e permissões</p>
      </div>

      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
        <CardHeader className="border-b border-emerald-800/30 pb-6">
          <CardTitle className="text-emerald-50 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-emerald-400" />
            Lista de Usuários
          </CardTitle>
          <p className="text-sm text-emerald-300/60">Gerencie funções e acessos</p>
        </CardHeader>
        <CardContent className="pt-6">
          <EnhancedTable striped hoverable>
            <EnhancedTableHeader>
              <EnhancedTableRow hoverable={false}>
                <EnhancedTableHead>Nome</EnhancedTableHead>
                <EnhancedTableHead>Email</EnhancedTableHead>
                <EnhancedTableHead>Telefone</EnhancedTableHead>
                <EnhancedTableHead>Função</EnhancedTableHead>
                <EnhancedTableHead>Locais</EnhancedTableHead>
                <EnhancedTableHead>Ações</EnhancedTableHead>
              </EnhancedTableRow>
            </EnhancedTableHeader>
            <EnhancedTableBody>
              {users.map((user, index) => (
                <EnhancedTableRow key={user.id} index={index}>
                  <EnhancedTableCell className="font-semibold text-emerald-100">
                    {user.name}
                  </EnhancedTableCell>
                  <EnhancedTableCell className="text-sm text-emerald-300/70">
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
                          className="w-36 h-8 bg-emerald-900/40 border-emerald-700/50 text-emerald-50 text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handlePhoneUpdate(user.id)}
                          className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-800/40"
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
                        <Phone className="w-4 h-4 text-emerald-500/60" />
                        <span className="text-sm text-emerald-300/70">
                          {formatPhone(user.phone)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditPhone(user)}
                          className="h-6 w-6 text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-800/40"
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
                        <SelectTrigger className="w-[150px] bg-emerald-900/40 border-emerald-700/50 text-emerald-50 hover:bg-emerald-800/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-emerald-900 border-emerald-700">
                          <SelectItem
                            value="admin"
                            className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                          >
                            Admin
                          </SelectItem>
                          <SelectItem
                            value="atem"
                            className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                          >
                            ATEM
                          </SelectItem>
                          <SelectItem
                            value="comum"
                            className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
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
                      <p className="text-xs text-emerald-300/60">
                        {user.role === 'admin' && 'Acesso total'}
                        {user.role === 'atem' && 'Tema ATEM, acessos limitados'}
                        {user.role === 'comum' && 'Tema NeoPower padrão'}
                        {user.role === 'blocked' && 'Sem acesso ao dashboard'}
                      </p>
                    </div>
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    {user.locationIds ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/30 text-sm font-medium">
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
                          className="inline-flex items-center justify-center gap-2 rounded-md text-sm px-3 py-2 bg-emerald-900/40 border border-emerald-700/50 text-emerald-50 hover:bg-emerald-800/60 hover:border-emerald-600 transition-all shadow-lg shadow-emerald-900/20"
                        >
                          <MapPin className="w-4 h-4" />
                          Gerenciar Locais
                        </DialogTrigger>
                        <DialogContent className="bg-gradient-to-br from-emerald-950/95 to-emerald-900/95 border-emerald-800/50 text-emerald-50 backdrop-blur-xl">
                          <DialogHeader>
                            <DialogTitle className="text-emerald-50">
                              Gerenciar Locais - {user.name}
                            </DialogTitle>
                            <DialogDescription className="text-emerald-300/60">
                              Adicione ou remova locais que este usuário pode acessar
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-emerald-200 text-sm">Adicionar Local</label>
                              <div className="flex gap-2">
                                <Select onValueChange={handleAddLocation}>
                                  <SelectTrigger className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600 flex-1">
                                    <SelectValue placeholder="Selecione um local" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-emerald-900 border-emerald-700">
                                    {locations
                                      .filter(loc => !userLocations.includes(loc.address))
                                      .map(loc => (
                                        <SelectItem
                                          key={loc.id}
                                          value={loc.address}
                                          className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                                        >
                                          {loc.nomeDoLocal} ({loc.address})
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-emerald-200 text-sm">Locais Permitidos:</h3>
                              {userLocations.length === 0 ? (
                                <p className="text-emerald-300/60 text-sm">
                                  Nenhum local atribuído
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {userLocations.map(loc => (
                                    <li
                                      key={loc}
                                      className="flex items-center justify-between p-3 rounded-lg bg-emerald-900/30 border border-emerald-800/40"
                                    >
                                      <span className="text-emerald-100">{loc}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoveLocation(loc)}
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
                          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-800/30">
                            <Button
                              variant="outline"
                              onClick={() => setDialogOpen(false)}
                              className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 hover:bg-emerald-800/60"
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
