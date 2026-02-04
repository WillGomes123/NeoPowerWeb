import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Trash2,
  Save,
  X,
  Shield,
  Check
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface UserPermission {
  userId: number;
  userName: string;
  userEmail: string;
  permissions: {
    transactions: boolean;
    performance: boolean;
    financial: boolean;
    monitoring: boolean;
    info: boolean;
  };
}

interface User {
  id: number;
  nome: string;
  email: string;
}

interface Props {
  locationId: number;
}

const permissionLabels = {
  info: 'Informações',
  transactions: 'Transações',
  performance: 'Performance',
  financial: 'Financeiro',
  monitoring: 'Monitoramento'
};

export function LocationPermissionsTab({ locationId }: Props) {
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newUserPermissions, setNewUserPermissions] = useState({
    transactions: false,
    performance: false,
    financial: false,
    monitoring: false,
    info: true
  });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/locations/${locationId}/users`);
      setUsers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar permissões');
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const response = await api.get('/admin/users');
      // Filtrar usuários que já têm permissão
      const existingUserIds = users.map(u => u.userId);
      const available = (response.data || []).filter(
        (u: User) => !existingUserIds.includes(u.id)
      );
      setAvailableUsers(available);
    } catch (error) {
      console.error('Erro ao carregar usuários disponíveis:', error);
    }
  }, [users]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (showAddUser) {
      fetchAvailableUsers();
    }
  }, [showAddUser, fetchAvailableUsers]);

  const handleTogglePermission = async (
    userId: number,
    permission: keyof UserPermission['permissions']
  ) => {
    const user = users.find(u => u.userId === userId);
    if (!user) return;

    const newPermissions = {
      ...user.permissions,
      [permission]: !user.permissions[permission]
    };

    setIsSaving(userId);
    try {
      await api.put(`/locations/${locationId}/users/${userId}`, {
        permissions: newPermissions
      });

      setUsers(prev =>
        prev.map(u =>
          u.userId === userId ? { ...u, permissions: newPermissions } : u
        )
      );

      toast.success('Permissão atualizada');
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      toast.error('Erro ao atualizar permissão');
    } finally {
      setIsSaving(null);
    }
  };

  const handleAddUser = async () => {
    if (!selectedUserId) {
      toast.error('Selecione um usuário');
      return;
    }

    setIsSaving(-1);
    try {
      await api.post(`/locations/${locationId}/users`, {
        userId: selectedUserId,
        permissions: newUserPermissions
      });

      toast.success('Usuário adicionado com sucesso');
      setShowAddUser(false);
      setSelectedUserId(null);
      setNewUserPermissions({
        transactions: false,
        performance: false,
        financial: false,
        monitoring: false,
        info: true
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao adicionar usuário:', error);
      toast.error(error.response?.data?.message || 'Erro ao adicionar usuário');
    } finally {
      setIsSaving(null);
    }
  };

  const handleRemoveUser = async (userId: number, userName: string) => {
    if (!confirm(`Remover acesso de "${userName}" a este local?`)) return;

    setIsSaving(userId);
    try {
      await api.delete(`/locations/${locationId}/users/${userId}`);
      setUsers(prev => prev.filter(u => u.userId !== userId));
      toast.success('Usuário removido');
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast.error('Erro ao remover usuário');
    } finally {
      setIsSaving(null);
    }
  };

  const filteredUsers = searchTerm
    ? users.filter(
        u =>
          u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : users;

  return (
    <div className="space-y-6">
      {/* Header e Ações */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/50" />
              <Input
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-emerald-950/30 border-emerald-700/50 text-emerald-50"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                disabled={isLoading}
                className="border-emerald-700/50 text-emerald-300"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddUser(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Usuário
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Adicionar Usuário */}
      {showAddUser && (
        <Card className="bg-gradient-to-br from-emerald-950/60 to-emerald-900/40 border-emerald-600/50">
          <CardHeader className="border-b border-emerald-800/30 pb-4">
            <CardTitle className="text-lg text-emerald-50 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Adicionar Novo Usuário
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddUser(false)}
                className="text-emerald-300 hover:bg-emerald-800/30"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-emerald-300/70 mb-2 block">
                  Selecione o usuário
                </label>
                <select
                  value={selectedUserId || ''}
                  onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
                  className="w-full h-10 px-3 rounded-md bg-emerald-950/30 border border-emerald-700/50 text-emerald-50 text-sm"
                >
                  <option value="">Selecione...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.nome} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-emerald-300/70 mb-3 block">
                  Permissões
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {(Object.keys(permissionLabels) as Array<keyof typeof permissionLabels>).map(
                    (key) => (
                      <label
                        key={key}
                        className={`
                          flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all
                          ${newUserPermissions[key]
                            ? 'bg-emerald-500/20 border border-emerald-500/50'
                            : 'bg-emerald-950/30 border border-emerald-800/30 hover:border-emerald-700/50'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={newUserPermissions[key]}
                          onChange={() =>
                            setNewUserPermissions((prev) => ({
                              ...prev,
                              [key]: !prev[key]
                            }))
                          }
                          className="hidden"
                        />
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center ${
                            newUserPermissions[key]
                              ? 'bg-emerald-500 text-white'
                              : 'bg-emerald-950/50 border border-emerald-700/50'
                          }`}
                        >
                          {newUserPermissions[key] && <Check className="w-3 h-3" />}
                        </div>
                        <span className="text-sm text-emerald-50">
                          {permissionLabels[key]}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAddUser(false)}
                  className="border-emerald-700/50 text-emerald-300"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddUser}
                  disabled={!selectedUserId || isSaving === -1}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSaving === -1 ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Usuários */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <CardTitle className="text-lg text-emerald-50 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Usuários com Acesso
            </span>
            <span className="text-sm font-normal text-emerald-300/70">
              {users.length} usuário(s)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
              <p className="text-emerald-300/70">
                {searchTerm
                  ? 'Nenhum usuário encontrado'
                  : 'Nenhum usuário tem acesso a este local'}
              </p>
              {!searchTerm && (
                <Button
                  size="sm"
                  onClick={() => setShowAddUser(true)}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar Primeiro Usuário
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-emerald-800/30">
              {filteredUsers.map((user) => (
                <div
                  key={user.userId}
                  className="p-4 hover:bg-emerald-800/10 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <span className="text-emerald-400 font-medium">
                          {user.userName?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-emerald-50 font-medium">{user.userName}</h4>
                        <p className="text-sm text-emerald-300/70">{user.userEmail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(user.userId, user.userName)}
                        disabled={isSaving === user.userId}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Permissões do usuário */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(Object.keys(permissionLabels) as Array<keyof typeof permissionLabels>).map(
                      (key) => (
                        <button
                          key={key}
                          onClick={() => handleTogglePermission(user.userId, key)}
                          disabled={isSaving === user.userId}
                          className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                            ${user.permissions[key]
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-emerald-950/30 text-emerald-300/50 border border-emerald-800/30 hover:border-emerald-700/50'
                            }
                            ${isSaving === user.userId ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          {user.permissions[key] && <Check className="w-3 h-3" />}
                          {permissionLabels[key]}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LocationPermissionsTab;
