import type { User } from '../types';

// Marcas mestras: são a própria NeoPower (mesma regra do tenantFilter da API).
const MARCAS_DA_PLATAFORMA = ['neopower-default', 'neo'];

const ehMarcaDaPlataforma = (clientId?: string | null) =>
  !clientId || MARCAS_DA_PLATAFORMA.includes(clientId);

/**
 * Admin da plataforma NeoPower: admin sem marca de cliente vinculada. É quem vê
 * Email e White Label; admins de marca, operadores e contas comuns não veem.
 */
export const ehAdminDaPlataforma = (user?: User | null): boolean =>
  user?.role === 'admin' &&
  ehMarcaDaPlataforma(user?.clientId) &&
  ehMarcaDaPlataforma(user?.branding?.clientId);
