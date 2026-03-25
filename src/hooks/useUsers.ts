import { useQuery, useMutation } from './useQuery';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { api } from '../lib/api';

type ManagedRole = 'admin' | 'atem' | 'comum' | 'blocked';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: ManagedRole;
  clientId?: string | null;
}

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: ManagedRole;
  phone?: string;
}

/**
 * User management hook. Encapsulates all admin user operations.
 */
export function useUsers() {
  const { data, loading, error, refetch } = useQuery<User[]>('/admin/users');

  const changeRole = useCallback(async (userId: number, newRole: ManagedRole) => {
    const res = await api.put(`/admin/users/${userId}/role`, { newRole });
    if (res.ok) {
      toast.success('Role atualizada!');
      void refetch();
    } else {
      toast.error('Erro ao atualizar role');
    }
  }, [refetch]);

  const createUser = useCallback(async (input: CreateUserInput) => {
    const res = await api.post('/admin/users', input);
    if (res.ok) {
      toast.success('Usuário criado!');
      void refetch();
      return true;
    }
    const err = await res.json();
    toast.error(err?.error || 'Erro ao criar usuário');
    return false;
  }, [refetch]);

  const updatePhone = useCallback(async (userId: number, phone: string | null) => {
    const res = await api.put(`/admin/users/${userId}`, { phone });
    if (res.ok) {
      toast.success('Telefone atualizado!');
      void refetch();
    } else {
      toast.error('Erro ao atualizar telefone');
    }
  }, [refetch]);

  return {
    users: data || [],
    loading,
    error,
    refetch,
    changeRole,
    createUser,
    updatePhone,
  };
}
