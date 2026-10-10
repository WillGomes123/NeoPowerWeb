// Balanceamento de carga de um local (medidor do QGBT + DLB).
//
// O medidor instalado no quadro geral do prédio manda as leituras por fase à
// API; a cada 5 s a API calcula quanto sobra em cada fase e reparte entre os
// carregadores do local. No modo "observar" ela só registra o que mandaria;
// no "ativo", manda os limites (SetChargingProfile) aos carregadores.
import { api } from './api';

export type ModoBalanceamento = 'desligado' | 'observar' | 'ativo';
export type PontoDeMedicao = 'entrada_total' | 'sem_carregadores';
export type FasesDoCarregador = 'L1' | 'L2' | 'L3' | 'L1L2L3';
export type Fase = 'L1' | 'L2' | 'L3';

export interface ConfigBalanceamento {
  salva: boolean;
  modo: ModoBalanceamento;
  medidorId: number | null;
  limitePorFaseA: number | null;
  margemA: number | null;
  margemEfetivaA: number | null;
  limitePotenciaKw: number | null;
  correnteMinimaA: number;
  limiteSeguroA: number;
  intervaloEnvioS: number;
  histereseA: number;
  /** Trava de segurança: sem atualização por este tempo, o carregador cai para o limite seguro. */
  tempoSemAtualizacaoS: number;
  modoAlteradoEm: string | null;
  atualizadoEm: string | null;
}

export interface MedidorDoSite {
  id: number;
  locationRefId: number;
  identificador: string;
  nome: string;
  pontoDeMedicao: PontoDeMedicao;
  fases: number;
  ativo: boolean;
  temToken: boolean;
  tokenGeradoEm: string | null;
  ultimoContatoEm: string | null;
  online: boolean;
  criadoEm: string;
}

export interface CarregadorDoBalanceamento {
  chargePointId: string;
  fabricante: string | null;
  modelo: string | null;
  potenciaKw: number | null;
  status: string | null;
  conectado: boolean;
  doLocal: boolean;
  mapeado: boolean;
  fases: FasesDoCarregador;
  correnteMaxA: number;
  unidade: 'A' | 'W';
  prioridade: number | null;
  participa: boolean;
  /** false = recusou o perfil com o período de segurança (recebe um período só). */
  aceitaPeriodoSeguro: boolean;
}

export interface VisaoDoBalanceamento {
  locationRefId: number;
  config: ConfigBalanceamento;
  medidores: MedidorDoSite[];
  carregadores: CarregadorDoBalanceamento[];
  endpoint: string;
  perfil: { chargingProfileId: number; stackLevel: number; proposito: string };
  permissoes: { podeAtivar: boolean; podeEditarLimites: boolean; podeObservar: boolean };
}

export interface FaseDoStatus {
  medidoA: number;
  evA: number;
  semEvA: number;
  disponivelA: number;
}

export interface CarregadorNoStatus {
  chargePointId: string;
  participa: boolean;
  emSessao: boolean;
  inicioSessao: string | null;
  fases: FasesDoCarregador;
  correnteMaxA: number;
  unidade: 'A' | 'W';
  prioridade: number | null;
  cargaA: Record<Fase, number> | null;
  idadeAmostraS: number | null;
  calculadoA: number | null;
  calculado: number | null;
  /** Limite do período de segurança, na unidade do perfil. */
  calculadoSeguro: number | null;
  motivo: string | null;
  aceitaPeriodoSeguro: boolean;
  enviado: {
    limiteA: number | null;
    limite: number | null;
    unidade: string | null;
    em: string | null;
    status: string | null;
    erro: string | null;
    perfilAtivo: boolean;
    aceitaPeriodoSeguro: boolean;
    falhas: number;
    tentativaEm: string | null;
  } | null;
}

export interface StatusDoBalanceamento {
  agora: string;
  modo: ModoBalanceamento;
  estado: 'calculado' | 'limite_seguro' | 'sem_limite';
  motivo: string | null;
  medidor: {
    id: number;
    identificador: string;
    nome: string;
    fases: number;
    pontoDeMedicao: PontoDeMedicao;
    ultimoContatoEm: string | null;
    online: boolean;
  } | null;
  leitura: {
    medidoEm: string;
    recebidoEm: string;
    idadeS: number | null;
    fresca: boolean;
    frescaAteS: number;
    fases: Partial<
      Record<Fase, { correnteA: number; tensaoV: number | null; potenciaW: number | null }>
    >;
    potenciaTotalW: number | null;
    frequenciaHz: number | null;
    device: Record<string, unknown> | null;
  } | null;
  limitePorFaseA: number | null;
  tempoSemAtualizacaoS: number;
  /** Reenvio do limite atual: min(120 s, metade da trava). */
  keepaliveS: number;
  margemA: number | null;
  porFase: Partial<Record<Fase, FaseDoStatus>>;
  potencia: {
    limiteKw: number;
    medidoW: number;
    evW: number;
    semEvW: number;
    disponivelW: number;
  } | null;
  carregadores: CarregadorNoStatus[];
}

export interface CarregadorNaDecisao {
  chargePointId: string;
  emSessao?: boolean;
  limiteA?: number;
  limite?: number;
  /** Valor que foi (ou seria) enviado: o calculado, ou o último aceito num reenvio. */
  limiteEnviado?: number | null;
  limiteSeguro?: number;
  /** O perfil levou o período de segurança? (null = não houve envio real) */
  periodoSeguro?: boolean | null;
  unidade?: 'A' | 'W';
  motivo?: string | null;
  envio: string | null;
  enviado: boolean;
  simulado?: boolean;
  status: string | null;
  erro: string | null;
}

export interface DecisaoDoBalanceamento {
  id: number;
  criadoEm: string;
  modo: string;
  motivo: string | null;
  medidorId: number | null;
  leituraEm: string | null;
  porFase: Partial<Record<Fase, FaseDoStatus>> | null;
  potencia: Record<string, number> | null;
  carregadores: CarregadorNaDecisao[];
  enviado: boolean;
}

export interface TokenGerado {
  medidor: MedidorDoSite;
  token: string;
  endpoint: string;
}

export interface ConfigParaSalvar {
  modo?: ModoBalanceamento;
  medidorId?: number | null;
  limitePorFaseA?: number | null;
  margemA?: number | null;
  limitePotenciaKw?: number | null;
  correnteMinimaA?: number;
  limiteSeguroA?: number;
  intervaloEnvioS?: number;
  histereseA?: number;
  tempoSemAtualizacaoS?: number;
}

export interface MapeamentoParaSalvar {
  chargePointId: string;
  fases: FasesDoCarregador;
  correnteMaxA: number;
  unidade: 'A' | 'W';
  prioridade: number | null;
  participa: boolean;
}

async function mensagemDeErro(r: Response, padrao: string): Promise<string> {
  const corpo = (await r.json().catch(() => null)) as { error?: string; message?: string } | null;
  return corpo?.error || corpo?.message || padrao;
}

async function lerOuFalhar<T>(r: Response, padrao: string): Promise<T> {
  if (!r.ok) throw new Error(await mensagemDeErro(r, padrao));
  return (await r.json()) as T;
}

const base = (locationId: number) => `/locations/${locationId}/balanceamento`;

export async function carregarBalanceamento(locationId: number): Promise<VisaoDoBalanceamento> {
  return lerOuFalhar(await api.get(base(locationId)), 'Não foi possível carregar o balanceamento.');
}

export async function carregarStatus(locationId: number): Promise<StatusDoBalanceamento> {
  return lerOuFalhar(await api.get(`${base(locationId)}/status`), 'Não foi possível ler o status.');
}

export async function carregarDecisoes(
  locationId: number,
  limite = 50
): Promise<DecisaoDoBalanceamento[]> {
  const r = await lerOuFalhar<{ itens: DecisaoDoBalanceamento[] }>(
    await api.get(`${base(locationId)}/decisoes?limite=${limite}`),
    'Não foi possível carregar o registro.'
  );
  return r.itens ?? [];
}

export async function salvarConfig(
  locationId: number,
  config: ConfigParaSalvar
): Promise<ConfigBalanceamento> {
  const r = await lerOuFalhar<{ config: ConfigBalanceamento }>(
    await api.put(base(locationId), config),
    'Não foi possível salvar a configuração.'
  );
  return r.config;
}

export async function salvarMapeamento(
  locationId: number,
  carregadores: MapeamentoParaSalvar[]
): Promise<void> {
  await lerOuFalhar(
    await api.put(`${base(locationId)}/carregadores`, { carregadores }),
    'Não foi possível salvar os carregadores.'
  );
}

export async function cadastrarMedidor(
  locationId: number,
  dados: { identificador: string; nome?: string; pontoDeMedicao: PontoDeMedicao; fases: 1 | 3 }
): Promise<TokenGerado> {
  return lerOuFalhar(
    await api.post(`/locations/${locationId}/site-meters`, dados),
    'Não foi possível cadastrar o medidor.'
  );
}

export async function atualizarMedidor(
  medidorId: number,
  dados: Partial<{ nome: string; pontoDeMedicao: PontoDeMedicao; fases: 1 | 3; ativo: boolean }>
): Promise<MedidorDoSite> {
  const r = await lerOuFalhar<{ medidor: MedidorDoSite }>(
    await api.put(`/site-meters/${medidorId}`, dados),
    'Não foi possível salvar o medidor.'
  );
  return r.medidor;
}

export async function gerarNovoToken(medidorId: number): Promise<TokenGerado> {
  return lerOuFalhar(
    await api.post(`/site-meters/${medidorId}/token`, {}),
    'Não foi possível gerar o token.'
  );
}

export async function revogarToken(medidorId: number): Promise<void> {
  await lerOuFalhar(
    await api.delete(`/site-meters/${medidorId}/token`),
    'Não foi possível revogar o token.'
  );
}

export async function excluirMedidor(medidorId: number): Promise<void> {
  await lerOuFalhar(
    await api.delete(`/site-meters/${medidorId}`),
    'Não foi possível excluir o medidor.'
  );
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** Trava de segurança: faixa aceita pela API. */
export const TEMPO_SEM_ATUALIZACAO_MIN_S = 60;
export const TEMPO_SEM_ATUALIZACAO_MAX_S = 3600;

export const AVISO_SEM_PERIODO_SEGURO =
  'Este carregador não aceita o período de segurança: se a internet cair, ele fica no último limite';

export const ROTULO_DO_MODO: Record<ModoBalanceamento, string> = {
  desligado: 'Desligado',
  observar: 'Observar',
  ativo: 'Ativo',
};

export const DESCRICAO_DO_MODO: Record<ModoBalanceamento, string> = {
  desligado: 'Nada é calculado nem enviado.',
  observar: 'Calcula e registra o que mandaria aos carregadores, sem mandar nada.',
  ativo: 'Manda os limites aos carregadores a cada mudança.',
};

export const ROTULO_DO_PONTO: Record<PontoDeMedicao, string> = {
  entrada_total: 'Entrada do prédio (inclui os carregadores)',
  sem_carregadores: 'Só a carga do prédio (sem os carregadores)',
};

export const ROTULO_DAS_FASES: Record<FasesDoCarregador, string> = {
  L1L2L3: 'Trifásico (L1, L2, L3)',
  L1: 'Monofásico em L1',
  L2: 'Monofásico em L2',
  L3: 'Monofásico em L3',
};

/** "há 3 s", "há 2 min", "há 1 h". */
export function haQuanto(iso: string | null | undefined, agora: number = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export function formatarLimite(
  valor: number | null | undefined,
  unidade: string | null | undefined
) {
  if (valor == null) return '—';
  if (unidade === 'W') {
    return valor >= 1000
      ? `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kW`
      : `${valor} W`;
  }
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} A`;
}

export function formatarA(valor: number | null | undefined): string {
  if (valor == null) return '—';
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} A`;
}

/** Texto do envio de um carregador numa decisão. */
export function textoDoEnvio(c: CarregadorNaDecisao): string {
  if (c.envio === 'limpeza')
    return c.enviado ? 'perfil removido' : `remoção falhou (${c.status ?? 'erro'})`;
  if (!c.envio) return 'sem envio';
  if (c.simulado) return 'seria enviado';
  if (c.enviado) return 'enviado';
  return c.status === 'erro' ? 'falhou' : `recusado (${c.status ?? '?'})`;
}

/** Converte o texto de um campo numérico do formulário (vírgula ou ponto). Vazio = null. */
export function numeroDoCampo(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
