/**
 * Estado de um carregador como o painel mostra (22/10/2026). Antes era só
 * "online" ou "offline", e o cadastro feito antes de o equipamento ser ligado
 * contava como offline: metade da rede parecia fora do ar.
 *
 * - instalacao: cadastrado e nunca conectado (sem last_seen);
 * - offline: já se conectou e caiu;
 * - indisponivel: conectado, mas fora de serviço (Unavailable);
 * - falha: conectado e com defeito (Faulted);
 * - emUso: carregando;
 * - ativo: conectado e livre.
 */
export type EstadoDoCarregador = 'ativo' | 'emUso' | 'indisponivel' | 'falha' | 'offline' | 'instalacao';

export interface CarregadorParaEstado {
  isConnected: boolean;
  last_seen?: string | null;
  /** Status OCPP: `ocpp_status` do GET /chargers ou o do socket. */
  ocppStatus?: string | null;
}

const EM_USO = new Set(['Charging', 'SuspendedEV', 'SuspendedEVSE']);

export function estadoDoCarregador(c: CarregadorParaEstado): EstadoDoCarregador {
  if (!c.isConnected) return c.last_seen ? 'offline' : 'instalacao';
  if (c.ocppStatus && EM_USO.has(c.ocppStatus)) return 'emUso';
  if (c.ocppStatus === 'Faulted') return 'falha';
  if (c.ocppStatus === 'Unavailable') return 'indisponivel';
  return 'ativo';
}

// Um local mostra o estado mais relevante dos seus carregadores, na ordem do
// mapa de antes: carregando, depois problema, depois disponível.
const PRIORIDADE: EstadoDoCarregador[] = ['emUso', 'falha', 'ativo', 'indisponivel', 'offline', 'instalacao'];

export function estadoDoLocal(estados: EstadoDoCarregador[]): EstadoDoCarregador {
  return PRIORIDADE.find(e => estados.includes(e)) ?? 'instalacao';
}

export const ROTULO_DO_ESTADO: Record<EstadoDoCarregador, string> = {
  ativo: 'Ativo',
  emUso: 'Em uso',
  indisponivel: 'Indisponível',
  falha: 'Com falha',
  offline: 'Offline',
  instalacao: 'Em instalação',
};

/** Cor do marcador no mapa e da bolinha do estado. */
export const COR_DO_ESTADO: Record<EstadoDoCarregador, string> = {
  ativo: '#8eff71',
  emUso: '#88f6ff',
  falha: '#ff7351',
  indisponivel: '#f5b94a',
  offline: '#777575',
  instalacao: '#a78bfa',
};
