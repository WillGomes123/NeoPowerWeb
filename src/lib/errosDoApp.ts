/**
 * Erros do app: tipos, rótulos e a montagem das consultas da tela.
 *
 * Contrato da API (só a plataforma):
 * - GET /app/erros?clientId&versao&tipo&desde&pagina&porPagina
 *   → { itens: RelatoDeErro[], total, pagina, porPagina }
 * - GET /app/erros/resumo → { desde, porVersao, porTipo }, últimos 7 dias, todas as marcas
 * O cliente `api` já desembrulha o envelope { success, data }.
 *
 * O `desde` filtra pela hora em que o relato CHEGOU (criadoEm). Quando o app
 * cai, o relato só sai na abertura seguinte, então um crash de ontem pode
 * chegar hoje.
 */

import { dataLocal } from '../components/ui/utils';

export const TIPOS_DE_RELATO = [
  'js_fatal',
  'encerramento_abrupto',
  'boundary',
  'js_erro',
  'updates_log',
] as const;
export type TipoDeRelato = (typeof TIPOS_DE_RELATO)[number];

export interface RelatoDeErro {
  id: number;
  criadoEm: string;
  ocorridoEm: string | null;
  tipo: string;
  mensagem: string | null;
  pilha: string | null;
  fatal: boolean | null;
  tela: string | null;
  clientId: string | null;
  appVersao: string | null;
  appBuild: string | null;
  updateId: string | null;
  canal: string | null;
  runtime: string | null;
  plataforma: string | null;
  osVersao: string | null;
  modelo: string | null;
  appId: string | null;
  embutida: boolean | null;
  emergencia: boolean | null;
  userId: number | null;
  contexto: Record<string, unknown> | null;
}

export interface PaginaDeRelatos {
  itens: RelatoDeErro[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface LinhaPorVersao {
  appVersao: string | null;
  appBuild: string | null;
  plataforma: string | null;
  total: number;
}

export interface LinhaPorTipo {
  tipo: string;
  total: number;
}

export interface ResumoDeErros {
  desde: string | null;
  porVersao: LinhaPorVersao[];
  porTipo: LinhaPorTipo[];
}

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------

/** Gravidade do tipo: decide a cor do selo (sempre com ícone e rótulo). */
export type Tom = 'critico' | 'alerta' | 'aviso' | 'neutro';

export interface InfoDoTipo {
  rotulo: string;
  descricao: string;
  icone: string;
  tom: Tom;
}

export const INFO_DOS_TIPOS: Record<TipoDeRelato, InfoDoTipo> = {
  js_fatal: {
    rotulo: 'Erro fatal de JS',
    descricao: 'Erro de JavaScript não tratado que derrubou o app.',
    icone: 'dangerous',
    tom: 'critico',
  },
  encerramento_abrupto: {
    rotulo: 'Fechou sozinho',
    descricao:
      'O app fechou na frente da pessoa sem erro de JS: crash nativo, travamento ou o sistema encerrou. A hora é a do último sinal de vida.',
    icone: 'power_settings_new',
    tom: 'critico',
  },
  boundary: {
    rotulo: 'Tela de erro',
    descricao: 'Uma tela quebrou e o app mostrou a tela de erro no lugar dela.',
    icone: 'broken_image',
    tom: 'alerta',
  },
  js_erro: {
    rotulo: 'Erro de JS',
    descricao: 'Erro de JavaScript não tratado que não derrubou o app.',
    icone: 'error',
    tom: 'aviso',
  },
  updates_log: {
    rotulo: 'Atualização (OTA)',
    descricao:
      'Registro do expo-updates: OTA que não abriu e voltou ao JS do binário (abertura de emergência) ou erro que ele registrou.',
    icone: 'system_update',
    tom: 'neutro',
  },
};

/** Tipo que esta versão do painel ainda não conhece: mostra o código cru. */
export function infoDoTipo(tipo: string): InfoDoTipo {
  return (
    (INFO_DOS_TIPOS as Record<string, InfoDoTipo | undefined>)[tipo] ?? {
      rotulo: tipo,
      descricao: 'Tipo de relato que esta versão do painel não conhece.',
      icone: 'help',
      tom: 'neutro',
    }
  );
}

export const ehTipoDeRelato = (valor: unknown): valor is TipoDeRelato =>
  typeof valor === 'string' && (TIPOS_DE_RELATO as readonly string[]).includes(valor);

/** Classes do selo por gravidade, legíveis no tema claro e no escuro. */
export const CLASSES_DO_TOM: Record<Tom, string> = {
  critico: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  alerta: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  aviso: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  neutro: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
};

/** Sem o campo, vale o tipo: só o js_fatal derrubou o app com certeza (regra da API). */
export const ehFatal = (r: Pick<RelatoDeErro, 'fatal' | 'tipo'>): boolean =>
  r.fatal ?? r.tipo === 'js_fatal';

export function rotuloDaPlataforma(plataforma: string | null | undefined): string {
  if (!plataforma) return '—';
  const p = plataforma.toLowerCase();
  if (p === 'ios') return 'iOS';
  if (p === 'android') return 'Android';
  if (p === 'web') return 'Web';
  return plataforma;
}

export function iconeDaPlataforma(plataforma: string | null | undefined): string {
  const p = (plataforma ?? '').toLowerCase();
  if (p === 'ios') return 'phone_iphone';
  if (p === 'android') return 'phone_android';
  if (p === 'web') return 'language';
  return 'devices';
}

/** "1.0.6 (42)": versão da loja com o build entre parênteses. */
export function versaoComBuild(appVersao: string | null, appBuild: string | null): string {
  if (!appVersao && !appBuild) return '—';
  if (!appBuild) return appVersao ?? '—';
  return `${appVersao ?? '?'} (${appBuild})`;
}

/**
 * O JS que estava rodando: a OTA (início do updateId) ou o que veio no binário.
 * Null quando o app não disse.
 */
export function jsEmUso(r: Pick<RelatoDeErro, 'embutida' | 'updateId'>): string | null {
  if (r.embutida === true) return 'JS do binário';
  if (r.updateId) return `OTA ${r.updateId.slice(0, 8)}`;
  return null;
}

/** Código curto que o app mostra na tela de erro (E-XXXXXX), quando há. */
export function codigoDoRelato(r: Pick<RelatoDeErro, 'contexto'>): string | null {
  const codigo = r.contexto?.codigo;
  return typeof codigo === 'string' && codigo ? codigo : null;
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;
export const DIA_MS = 24 * HORA_MS;

const FORMATO_CURTO = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** dd/MM HH:mm no fuso do navegador. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = dataLocal(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p: Record<string, string> = {};
  for (const parte of FORMATO_CURTO.formatToParts(d)) p[parte.type] = parte.value;
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

export function dataHoraCompleta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = dataLocal(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { timeZoneName: 'short' });
}

/** Quando o erro aconteceu: a hora do aparelho; sem ela, a da chegada. */
export const momentoDoRelato = (r: Pick<RelatoDeErro, 'ocorridoEm' | 'criadoEm'>): string =>
  r.ocorridoEm ?? r.criadoEm;

/**
 * Quanto depois do erro o relato chegou ("3 h"), se passou de 2 min. Quando o
 * app cai, o relato só sai na abertura seguinte, então pode chegar horas depois.
 */
export function atrasoDaChegada(r: Pick<RelatoDeErro, 'ocorridoEm' | 'criadoEm'>): string | null {
  if (!r.ocorridoEm) return null;
  const atraso = dataLocal(r.criadoEm).getTime() - dataLocal(r.ocorridoEm).getTime();
  if (!Number.isFinite(atraso) || atraso < 2 * MINUTO_MS) return null;
  if (atraso < HORA_MS) return `${Math.round(atraso / MINUTO_MS)} min`;
  if (atraso < 2 * DIA_MS) return `${Math.round(atraso / HORA_MS)} h`;
  return `${Math.round(atraso / DIA_MS)} dias`;
}

// ---------------------------------------------------------------------------
// Filtros (guardados na URL, para dar para mandar o link)
// ---------------------------------------------------------------------------

export const PERIODOS = [
  { id: '24h', rotulo: 'Últimas 24 horas', dias: 1 },
  { id: '7d', rotulo: 'Últimos 7 dias', dias: 7 },
  { id: '30d', rotulo: 'Últimos 30 dias', dias: 30 },
  // A API guarda os relatos por 90 dias: este é o histórico inteiro.
  { id: '90d', rotulo: 'Últimos 90 dias', dias: 90 },
] as const;
export type Periodo = (typeof PERIODOS)[number]['id'];
export const PERIODO_PADRAO: Periodo = '7d';

export const POR_PAGINA = 25;

export interface FiltrosDeErros {
  /** clientId da marca (o X-Client-Id do build). */
  marca: string | null;
  versao: string | null;
  tipo: TipoDeRelato | null;
  periodo: Periodo;
}

export const FILTROS_PADRAO: FiltrosDeErros = {
  marca: null,
  versao: null,
  tipo: null,
  periodo: PERIODO_PADRAO,
};

const ehPeriodo = (valor: string | null): valor is Periodo => PERIODOS.some(p => p.id === valor);

/** Lê os filtros e a página da URL, ignorando valor que não existe. */
export function lerFiltros(params: URLSearchParams): {
  filtros: FiltrosDeErros;
  pagina: number;
} {
  const texto = (chave: string) => params.get(chave)?.trim() || null;
  const tipo = texto('tipo');
  const periodo = texto('periodo');
  const pagina = Number(texto('pagina'));
  return {
    filtros: {
      marca: texto('marca'),
      versao: texto('versao'),
      tipo: ehTipoDeRelato(tipo) ? tipo : null,
      periodo: ehPeriodo(periodo) ? periodo : PERIODO_PADRAO,
    },
    pagina: Number.isSafeInteger(pagina) && pagina > 1 ? pagina : 1,
  };
}

/** O inverso de lerFiltros: só vai para a URL o que não é o padrão. */
export function paramsDosFiltros(filtros: FiltrosDeErros, pagina: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (filtros.marca) params.marca = filtros.marca;
  if (filtros.versao) params.versao = filtros.versao;
  if (filtros.tipo) params.tipo = filtros.tipo;
  if (filtros.periodo !== PERIODO_PADRAO) params.periodo = filtros.periodo;
  if (pagina > 1) params.pagina = String(pagina);
  return params;
}

export const temFiltroAtivo = (f: FiltrosDeErros): boolean =>
  !!f.marca || !!f.versao || !!f.tipo || f.periodo !== PERIODO_PADRAO;

/** Query de GET /app/erros. O `desde` é calculado na hora de cada consulta. */
export function consultaDosErros(
  filtros: FiltrosDeErros,
  pagina: number,
  agora: number = Date.now()
): string {
  const dias = PERIODOS.find(p => p.id === filtros.periodo)?.dias ?? 7;
  const q = new URLSearchParams();
  if (filtros.marca) q.set('clientId', filtros.marca);
  if (filtros.versao) q.set('versao', filtros.versao);
  if (filtros.tipo) q.set('tipo', filtros.tipo);
  q.set('desde', new Date(agora - dias * DIA_MS).toISOString());
  q.set('pagina', String(pagina));
  q.set('porPagina', String(POR_PAGINA));
  return q.toString();
}

// ---------------------------------------------------------------------------
// Respostas da API
// ---------------------------------------------------------------------------

const numero = (v: unknown, padrao: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : padrao;

export function normalizarPagina(d: unknown): PaginaDeRelatos {
  const o = (d ?? {}) as Record<string, unknown>;
  return {
    itens: Array.isArray(o.itens) ? (o.itens as RelatoDeErro[]) : [],
    total: numero(o.total, 0),
    pagina: numero(o.pagina, 1),
    porPagina: numero(o.porPagina, POR_PAGINA),
  };
}

export function normalizarResumo(d: unknown): ResumoDeErros {
  const o = (d ?? {}) as Record<string, unknown>;
  return {
    desde: typeof o.desde === 'string' ? o.desde : null,
    porVersao: Array.isArray(o.porVersao) ? (o.porVersao as LinhaPorVersao[]) : [],
    porTipo: Array.isArray(o.porTipo) ? (o.porTipo as LinhaPorTipo[]) : [],
  };
}

/** Mensagem de erro da API: { error } (às vezes { error: { message } }) ou { message }. */
export function mensagemDeErro(corpo: unknown, status: number): string {
  const c = (corpo ?? {}) as { error?: unknown; message?: unknown };
  if (typeof c.error === 'string' && c.error) return c.error;
  if (c.error && typeof c.error === 'object' && 'message' in c.error) {
    const m = (c.error as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  if (typeof c.message === 'string' && c.message) return c.message;
  return `Erro ${status} ao buscar os erros do app`;
}

/** Ordem de versão: 1.0.10 vem depois de 1.0.9, o que a ordem alfabética erra. */
export function compararVersoes(a: string, b: string): number {
  const pa = a.split(/[.\-+]/);
  const pb = b.split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    if (x === y) continue;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) - Number(y);
    return x.localeCompare(y);
  }
  return 0;
}

/** Versões que aparecem no resumo, da mais nova para a mais antiga. */
export function versoesDoResumo(resumo: ResumoDeErros | null): string[] {
  const versoes = new Set<string>();
  for (const l of resumo?.porVersao ?? []) if (l.appVersao) versoes.add(l.appVersao);
  return [...versoes].sort((a, b) => compararVersoes(b, a));
}

/** Texto do relato para colar numa conversa ou num chamado. */
export function textoDoRelato(r: RelatoDeErro, nomeDaMarca: string): string {
  const sistema = [rotuloDaPlataforma(r.plataforma), r.osVersao].filter(Boolean).join(' ');
  const linhas = [
    `Relato #${r.id}: ${infoDoTipo(r.tipo).rotulo} (${r.tipo})${ehFatal(r) ? ', fatal' : ''}`,
    `Mensagem: ${r.mensagem ?? '—'}`,
    `Ocorreu em: ${dataHoraCompleta(r.ocorridoEm)}`,
    `Recebido em: ${dataHoraCompleta(r.criadoEm)}`,
    `Marca: ${nomeDaMarca}${r.clientId ? ` (${r.clientId})` : ''}`,
    `App: ${versaoComBuild(r.appVersao, r.appBuild)}, ${jsEmUso(r) ?? 'JS não informado'}`,
    `OTA: ${r.updateId ?? '—'} | canal ${r.canal ?? '—'} | runtime ${r.runtime ?? '—'}${
      r.emergencia ? ' | ABERTURA DE EMERGÊNCIA' : ''
    }`,
    `Aparelho: ${sistema}, ${r.modelo ?? 'modelo —'}, ${r.appId ?? 'appId —'}`,
    `Usuário: ${r.userId != null ? `#${r.userId}` : 'sem login'}`,
    `Tela: ${r.tela ?? '—'}`,
  ];
  const codigo = codigoDoRelato(r);
  if (codigo) linhas.push(`Código: ${codigo}`);
  linhas.push('', 'Pilha:', r.pilha ?? '(sem pilha)');
  linhas.push('', 'Contexto:', r.contexto ? JSON.stringify(r.contexto, null, 2) : '(sem contexto)');
  return linhas.join('\n');
}
