/**
 * Módulo Energia — tipos do que a API devolve em GET /energia/painel e
 * formatadores. A conta (apuração) e as regras de conexão vivem na API; o
 * painel só mostra.
 */

export type Distribuidora = 'AM' | 'RR';
export type Modalidade = 'auto' | 'cons' | 'coop' | 'local';
export type RegraPreco = 'desconto' | 'percentual_usina';
export type Cobranca = 'split' | 'saldo' | 'boleto';
export type StatusConexao = 'ativo' | 'enviado' | 'pendente' | 'cancelado';
export type StatusRateio = 'aprovado' | 'enviado' | 'pendente';

export interface Apuracao {
  tarifa: number;
  compensadoKwh: number;
  bruto: number;
  fioB: number;
  custoFixo: number;
  liquido: number;
  economia: number;
  cobrado: number;
  usina: number;
  neopower: number;
}

export interface Usina {
  id: number;
  nome: string;
  dono: string;
  uc: string;
  distribuidora: Distribuidora;
  potenciaKwp: number;
  potenciaKwac: number;
  grupo: 'A' | 'B';
  geracaoMensalKwh: number;
  creditoAcumuladoKwh: number;
  custoFixoMensal: number;
  custoFixoDescricao: string | null;
  modalidades: Modalidade[];
  status: 'operando' | 'homologacao' | 'desativada';
  rateioStatus: StatusRateio;
  rateioEnviadoEm: string | null;
  alocadoKwh: number;
  livreKwh: number;
  ocupacao: number;
  custoFixoPorKwh: number;
}

export interface Ponto {
  id: number;
  nome: string;
  titular: string;
  uc: string | null;
  distribuidora: Distribuidora;
  grupo: 'A' | 'B';
  ucPropria: boolean;
  consumoMensalKwh: number;
  carregadores: string;
  conexao: { id: number; usinaNome: string; modalidade: Modalidade; status: StatusConexao } | null;
}

export interface Conexao {
  id: number;
  usinaId: number;
  pontoId: number;
  usinaNome: string;
  pontoNome: string;
  modalidade: Modalidade;
  cotaKwh: number;
  regra: RegraPreco;
  valor: number;
  cobranca: Cobranca;
  status: StatusConexao;
  apuracao: Apuracao;
}

export interface Alerta {
  nivel: 'aviso' | 'erro';
  texto: string;
  aba?: AbaEnergia;
}

export interface PainelEnergia {
  parametros: {
    tarifaB: number;
    tarifaA: number;
    fioBParticipacao: number;
    fioBEscalonamento: number;
    taxaNeopower: number;
  };
  usinas: Usina[];
  pontos: Ponto[];
  conexoes: Conexao[];
  kpis: {
    usinasOperando: number;
    usinasEmHomologacao: number;
    pontosComEnergia: number;
    pontosTotal: number;
    compensadoKwh: number;
    geradoKwh: number;
    economia: number;
    repasseUsinas: number;
    neopower: number;
  };
  totaisApuracao: Omit<Apuracao, 'tarifa'>;
  alertas: Alerta[];
  distribuidoras: Record<Distribuidora, string>;
  modalidades: Record<Modalidade, { nome: string; sigla: string; descricao: string }>;
}

export type AbaEnergia =
  | 'visao'
  | 'usinas'
  | 'pontos'
  | 'conexoes'
  | 'rateio'
  | 'apuracao'
  | 'modalidades';

export const ABAS: { id: AbaEnergia; label: string; icon: string }[] = [
  { id: 'visao', label: 'Visão geral', icon: 'dashboard' },
  { id: 'usinas', label: 'Usinas', icon: 'solar_power' },
  { id: 'pontos', label: 'Pontos consumidores', icon: 'ev_station' },
  { id: 'conexoes', label: 'Conexões', icon: 'cable' },
  { id: 'rateio', label: 'Rateio', icon: 'pie_chart' },
  { id: 'apuracao', label: 'Apuração e split', icon: 'receipt_long' },
  { id: 'modalidades', label: 'Modalidades', icon: 'rule' },
];

/** Contas da própria NeoPower. Espelha ehNeoPower da API (utils/permissoes.ts). */
const CLIENT_IDS_NEOPOWER = ['neopower-default', 'neo'];
export const ehNeoPower = (user?: { clientId?: string | null } | null) =>
  !!user && (!user.clientId || CLIENT_IDS_NEOPOWER.includes(user.clientId));

export const brl = (v: number) =>
  `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Tarifa em R$/kWh tem 4 casas na fatura (0,5201): arredondar para centavos esconde a diferença. */
export const tarifa = (v: number) =>
  `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/kWh`;
export const kwh = (v: number) => `${Math.round(v || 0).toLocaleString('pt-BR')} kWh`;
export const pct = (v: number) =>
  `${((v || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const STATUS_CONEXAO: Record<
  StatusConexao,
  { label: string; tom: 'ok' | 'aviso' | 'neutro' }
> = {
  ativo: { label: 'créditos ativos', tom: 'ok' },
  enviado: { label: 'rateio em análise', tom: 'aviso' },
  pendente: { label: 'rateio a enviar', tom: 'aviso' },
  cancelado: { label: 'encerrada', tom: 'neutro' },
};

export const REGRA_LABEL = (c: Pick<Conexao, 'regra' | 'valor'>) =>
  c.regra === 'percentual_usina'
    ? `${pct(c.valor)} do benefício líquido à usina`
    : `${pct(c.valor)} de desconto ao ponto`;

export const COBRANCA_LABEL: Record<Cobranca, string> = {
  split: 'Split da recarga',
  saldo: 'Saldo da carteira',
  boleto: 'Boleto',
};
