// Contrato de GET /indicators/monthly (OCPP_API indicatorsController) e
// formatadores usados na tela, no PDF e na apresentação exportada.

export type StatusMeta =
  | 'bateu'
  | 'quase'
  | 'nao_bateu'
  | 'em_andamento'
  | 'dispensada'
  | 'pendente';

export interface Resumo {
  faturamento: number;
  energiaKwh: number;
  operacoes: number;
  usuariosAtivos: number;
  novosUsuarios: number;
  baseAcumulada: number;
  baseAtivaPct: number | null;
  ocupacaoPct: number;
  precoMedioKwh: number | null;
  ticketMedio: number | null;
  duracaoMediaMin: number | null;
  carregadoresAtivos: number;
}

export interface Variacoes {
  faturamento: number | null;
  energiaKwh: number | null;
  operacoes: number | null;
  usuariosAtivos: number | null;
  novosUsuarios: number | null;
  baseAcumulada: number | null;
  baseAtivaPp: number | null;
  ocupacaoPp: number | null;
  precoMedioKwh: number | null;
  ticketMedio: number | null;
}

export interface PontoSerie {
  mes: string;
  faturamento: number;
  energiaKwh: number;
  operacoes: number;
  usuariosAtivos: number;
  novosUsuarios: number;
  baseAcumulada: number;
}

export interface Carregador {
  chargePointId: string;
  nome: string;
  local: string | null;
  bairro: string | null;
  cidade: string | null;
  potenciaKw: number | null;
  conectores: number;
  faturamento: number;
  energiaKwh: number;
  operacoes: number;
  usuarios: number;
  novosUsuarios: number;
  horasOcupadas: number;
  horasDisponiveis: number;
  ocupacaoPct: number;
  precoMedioKwh: number | null;
  ticketMedio: number | null;
  duracaoMediaMin: number | null;
  anterior: {
    faturamento: number;
    energiaKwh: number;
    operacoes: number;
    usuarios: number;
    novosUsuarios: number;
    ocupacaoPct: number;
  };
}

export interface Bairro {
  bairro: string;
  carregadores: number;
  novosUsuarios: number;
  faturamento: number;
  energiaKwh: number;
  operacoes: number;
}

export interface Horario {
  dia: number; // 1 = segunda ... 7 = domingo
  hora: number;
  operacoes: number;
  energiaKwh: number;
}

export type MetricaProjetada = 'faturamento' | 'energiaKwh' | 'operacoes' | 'usuariosAtivos';

export interface Projecao {
  base: string | null;
  taxas: Record<MetricaProjetada, number | null>;
  meses: Array<{ mes: string } & Record<MetricaProjetada, number | null>>;
}

export interface MetaNumerica {
  chave:
    | 'faturamento'
    | 'energiaKwh'
    | 'operacoes'
    | 'novosUsuarios'
    | 'baseUsuarios'
    | 'baseAtivaPct';
  rotulo: string;
  unidade: string;
  meta: number | null;
  resultado: number;
  avaliacao: { status: StatusMeta; atingidoPct: number | null; diferenca: number | null } | null;
}

export interface ItemMeta {
  area: string;
  descricao: string;
  resultado: string;
  status: StatusMeta;
}

export interface Leitura {
  tipo: 'positivo' | 'alerta' | 'info';
  titulo: string;
  texto: string;
}

export interface RelatorioMensal {
  mes: string;
  fuso: string;
  geradoEm: string;
  fechado: boolean;
  comparacaoParcial: boolean;
  periodo: { ini: string; fim: string; horas: number };
  periodoAnterior: { ini: string; fim: string; horas: number };
  resumo: Resumo;
  resumoAnterior: Resumo;
  variacoes: Variacoes;
  serie: PontoSerie[];
  carregadores: Carregador[];
  bairros: Bairro[];
  horarios: Horario[];
  projecao: Projecao;
  metas: {
    mes: string;
    definidas: boolean;
    atualizadoEm: string | null;
    numericas: MetaNumerica[];
    itens: ItemMeta[];
  };
  leituras: Leitura[];
}

// ---------------------------------------------------------------------------
// Formatação (pt-BR)
// ---------------------------------------------------------------------------

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export const nomeDoMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
export const mesPorExtenso = (mes: string) => {
  const nome = nomeDoMes(mes);
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${mes.slice(0, 4)}`;
};
export const mesCurto = (mes: string) =>
  `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

export const mesAtualLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const somarMeses = (mes: string, n: number) => {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

export const fmtInt = (v: number | null | undefined) =>
  Math.round(Number(v) || 0).toLocaleString('pt-BR');

export const fmtBRL = (v: number | null | undefined, casas = 0) =>
  `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

export const fmtKwh = (v: number | null | undefined) => `${fmtInt(v)} kWh`;

export const fmtNum = (v: number | null | undefined, casas = 1) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

export const fmtPct = (v: number | null | undefined, casas = 1) => `${fmtNum(v, casas)}%`;

/** "+35,1%" / "-7,3%" / "—" */
export const fmtVar = (v: number | null | undefined, sufixo = '%') =>
  v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${fmtNum(v, 1)}${sufixo}`;

const NBSP = String.fromCharCode(160);

export const fmtCompacto = (v: number) => {
  const abs = Math.abs(v);
  // Espaço inseparável: o recharts quebra rótulo em espaço comum ("75,8" / "mil").
  if (abs >= 1_000_000) return `${fmtNum(v / 1_000_000, 1)}${NBSP}mi`;
  if (abs >= 1_000) return `${fmtNum(v / 1_000, 1)}${NBSP}mil`;
  return fmtInt(v);
};

export const fmtDataHora = (local: string) =>
  `${local.slice(8, 10)}/${local.slice(5, 7)} ${local.slice(11, 16)}`;

export const variacaoPct = (atual: number, anterior: number): number | null =>
  anterior > 0 ? Math.round(((atual - anterior) / anterior) * 1000) / 10 : null;

export const STATUS_META: Record<StatusMeta, { rotulo: string; classe: string; cor: string }> = {
  bateu: {
    rotulo: 'Bateu',
    classe: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    cor: '16A34A',
  },
  quase: {
    rotulo: 'Quase lá',
    classe: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    cor: 'D97706',
  },
  nao_bateu: {
    rotulo: 'Não bateu',
    classe: 'bg-red-500/15 text-red-600 dark:text-red-400',
    cor: 'DC2626',
  },
  em_andamento: {
    rotulo: 'Em andamento',
    classe: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    cor: '0284C7',
  },
  dispensada: {
    rotulo: 'Dispensada',
    classe: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
    cor: '64748B',
  },
  pendente: {
    rotulo: 'Pendente',
    classe: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
    cor: '64748B',
  },
};

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
