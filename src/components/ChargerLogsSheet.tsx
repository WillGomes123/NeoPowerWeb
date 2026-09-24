import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { dataLocal } from './ui/utils';

/**
 * Linha do tempo das mensagens OCPP e eventos de conexão de um carregador.
 *
 * Contrato: GET /chargers/:chargePointId/logs?limit&antes&tipo&semHeartbeat
 * → { items: LogItem[], proximoAntes: ISO | null } (dentro do envelope da API,
 * que o cliente `api` já desembrulha). Os ISO vêm em UTC; a exibição usa o fuso
 * do navegador.
 */

type TipoLog = 'ocpp' | 'conexao';
type FiltroTipo = 'todos' | TipoLog;

interface LogItem {
  id: string;
  ts: string;
  tipo: TipoLog;
  direcao: 'recebido' | 'enviado' | null;
  acao: string;
  resumo: string;
  payload: unknown;
}

interface Lista {
  itens: LogItem[];
  proximoAntes: string | null;
}

type Estado = 'carregando' | 'pronto' | 'erro' | 'indisponivel';

type Resultado =
  | { ok: true; pagina: Lista }
  | { ok: false; indisponivel: boolean; mensagem: string };

const LIMITE = 200;
const INTERVALO_MS = 10_000;

const FILTROS: { valor: FiltroTipo; rotulo: string; icone: string }[] = [
  { valor: 'todos', rotulo: 'Todos', icone: 'list' },
  { valor: 'ocpp', rotulo: 'Mensagens OCPP', icone: 'swap_horiz' },
  { valor: 'conexao', rotulo: 'Conexões', icone: 'cable' },
];

const FORMATO_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** dd/MM HH:mm:ss no fuso do navegador. */
function formatarHora(iso: string): string {
  const d = dataLocal(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p: Record<string, string> = {};
  for (const parte of FORMATO_HORA.formatToParts(d)) p[parte.type] = parte.value;
  return `${p.day}/${p.month} ${p.hour}:${p.minute}:${p.second}`;
}

function dataCompleta(iso: string): string {
  const d = dataLocal(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { timeZoneName: 'short' });
}

function normalizarPagina(d: unknown): Lista {
  if (Array.isArray(d)) return { itens: d as LogItem[], proximoAntes: null };
  const obj = (d ?? {}) as { items?: unknown; proximoAntes?: unknown };
  return {
    itens: Array.isArray(obj.items) ? (obj.items as LogItem[]) : [],
    proximoAntes: typeof obj.proximoAntes === 'string' ? obj.proximoAntes : null,
  };
}

function mensagemDeErro(corpo: unknown, status: number): string {
  const c = (corpo ?? {}) as { error?: unknown; message?: unknown };
  if (typeof c.error === 'string') return c.error;
  if (c.error && typeof c.error === 'object' && 'message' in c.error) {
    const m = (c.error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof c.message === 'string') return c.message;
  return `Erro ${status} ao buscar os logs`;
}

function instante(iso: string): number {
  const t = dataLocal(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Junta a página nova com o que já está na tela, sem duplicar, do mais novo ao mais antigo. */
function mesclar(novos: LogItem[], antigos: LogItem[]): LogItem[] {
  const vistos = new Set<string>();
  const todos: LogItem[] = [];
  for (const i of [...novos, ...antigos]) {
    if (vistos.has(i.id)) continue;
    vistos.add(i.id);
    todos.push(i);
  }
  return todos.sort((a, b) => instante(b.ts) - instante(a.ts));
}

function estilo(item: LogItem) {
  if (item.tipo === 'conexao') {
    const a = (item.acao ?? '').toLowerCase();
    if (/recus|refus|reject|bloque/.test(a)) {
      return {
        icone: 'block',
        cor: 'text-error',
        fundo: 'bg-error/10',
        borda: 'border-error/30',
        rotulo: 'Conexão',
      };
    }
    if (/descon|disconn|closed|fech|caiu/.test(a)) {
      return {
        icone: 'link_off',
        cor: 'text-amber-400',
        fundo: 'bg-amber-400/10',
        borda: 'border-amber-400/30',
        rotulo: 'Conexão',
      };
    }
    return {
      icone: 'link',
      cor: 'text-amber-400',
      fundo: 'bg-amber-400/10',
      borda: 'border-amber-400/30',
      rotulo: 'Conexão',
    };
  }
  if (item.direcao === 'enviado') {
    return {
      icone: 'call_made',
      cor: 'text-tertiary',
      fundo: 'bg-tertiary/10',
      borda: 'border-tertiary/30',
      rotulo: 'Enviado ao carregador',
    };
  }
  return {
    icone: 'call_received',
    cor: 'text-primary',
    fundo: 'bg-primary/10',
    borda: 'border-primary/30',
    rotulo: 'Recebido do carregador',
  };
}

interface ChargerLogsSheetProps {
  chargePointId: string | null;
  nome?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChargerLogsSheet = ({
  chargePointId,
  nome,
  open,
  onOpenChange,
}: ChargerLogsSheetProps) => {
  const [tipo, setTipo] = useState<FiltroTipo>('todos');
  const [semHeartbeat, setSemHeartbeat] = useState(true);
  const [busca, setBusca] = useState('');
  const [autoAtualizar, setAutoAtualizar] = useState(true);

  const [estado, setEstado] = useState<Estado>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [lista, setLista] = useState<Lista>({ itens: [], proximoAntes: null });
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // Cada (re)carga completa ganha um número; respostas de uma geração anterior
  // (filtro trocado, painel fechado, outro carregador) são descartadas.
  const geracao = useRef(0);
  const atualizandoRef = useRef(false);

  const buscarPagina = useCallback(
    async (antes?: string): Promise<Resultado> => {
      if (!chargePointId) return { ok: false, indisponivel: true, mensagem: '' };
      const params = new URLSearchParams({
        limit: String(LIMITE),
        tipo,
        semHeartbeat: String(semHeartbeat),
      });
      if (antes) params.set('antes', antes);
      try {
        const r = await api.get(
          `/chargers/${encodeURIComponent(chargePointId)}/logs?${params.toString()}`
        );
        if (r.status === 404) return { ok: false, indisponivel: true, mensagem: '' };
        if (!r.ok) {
          const corpo: unknown = await r.json().catch(() => null);
          return { ok: false, indisponivel: false, mensagem: mensagemDeErro(corpo, r.status) };
        }
        return { ok: true, pagina: normalizarPagina(await r.json()) };
      } catch (e) {
        return {
          ok: false,
          indisponivel: false,
          mensagem: e instanceof Error && e.message ? e.message : 'Falha de rede ao buscar os logs',
        };
      }
    },
    [chargePointId, tipo, semHeartbeat]
  );

  const carregar = useCallback(async () => {
    const g = ++geracao.current;
    setEstado('carregando');
    setErro(null);
    setLista({ itens: [], proximoAntes: null });
    setExpandidos(new Set());
    setCarregandoMais(false);
    const res = await buscarPagina();
    if (g !== geracao.current) return;
    if (res.ok) {
      setLista(res.pagina);
      setEstado('pronto');
    } else if (res.indisponivel) {
      setEstado('indisponivel');
    } else {
      setErro(res.mensagem);
      setEstado('erro');
    }
  }, [buscarPagina]);

  useEffect(() => {
    if (open && chargePointId) {
      void carregar();
    } else {
      geracao.current++;
    }
  }, [open, chargePointId, carregar]);

  const carregarMais = async () => {
    if (!lista.proximoAntes || carregandoMais) return;
    const g = geracao.current;
    setCarregandoMais(true);
    const res = await buscarPagina(lista.proximoAntes);
    if (g !== geracao.current) return;
    setCarregandoMais(false);
    if (res.ok) {
      setLista(prev => ({
        itens: mesclar(res.pagina.itens, prev.itens),
        proximoAntes: res.pagina.proximoAntes,
      }));
    } else if (res.indisponivel) {
      setEstado('indisponivel');
    } else {
      toast.error(res.mensagem);
    }
  };

  // Atualização: busca a página mais recente e junta com o que já está na tela,
  // preservando as páginas antigas carregadas por "Carregar mais".
  const atualizar = useCallback(async () => {
    if (estado !== 'pronto' || atualizandoRef.current) return;
    const g = geracao.current;
    atualizandoRef.current = true;
    setAtualizando(true);
    try {
      const res = await buscarPagina();
      if (g !== geracao.current || !res.ok) return; // falha pontual: tenta de novo no próximo ciclo
      setLista(prev => ({
        itens: mesclar(res.pagina.itens, prev.itens),
        proximoAntes: prev.itens.length ? prev.proximoAntes : res.pagina.proximoAntes,
      }));
    } finally {
      atualizandoRef.current = false;
      setAtualizando(false);
    }
  }, [estado, buscarPagina]);

  const atualizarRef = useRef(atualizar);
  useEffect(() => {
    atualizarRef.current = atualizar;
  }, [atualizar]);

  // A cada 10 s, só com a aba visível. Ao voltar para a aba, atualiza na hora.
  useEffect(() => {
    if (!open || !autoAtualizar) return;
    const t = setInterval(() => {
      if (!document.hidden) void atualizarRef.current();
    }, INTERVALO_MS);
    const aoMudarVisibilidade = () => {
      if (!document.hidden) void atualizarRef.current();
    };
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [open, autoAtualizar]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.itens.filter(i => {
      if (tipo !== 'todos' && i.tipo !== tipo) return false;
      if (semHeartbeat && i.acao === 'Heartbeat') return false;
      if (!q) return true;
      return (i.acao ?? '').toLowerCase().includes(q) || (i.resumo ?? '').toLowerCase().includes(q);
    });
  }, [lista.itens, tipo, semHeartbeat, busca]);

  const alternar = (id: string) =>
    setExpandidos(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const copiar = (payload: unknown) => {
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => toast.success('Payload copiado'))
      .catch(() => toast.error('Não foi possível copiar'));
  };

  const titulo = nome || chargePointId || '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-surface-container border-outline-variant/20 w-full sm:max-w-2xl p-0 gap-0"
      >
        <SheetHeader className="shrink-0 px-6 pt-6 pb-4 pr-12 border-b border-outline-variant/10">
          <SheetTitle className="text-on-surface font-headline flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
            </div>
            <span className="truncate">Logs — {titulo}</span>
          </SheetTitle>
          <SheetDescription className="text-on-surface-variant font-mono text-xs">
            {chargePointId}
          </SheetDescription>
        </SheetHeader>

        {/* Filtros */}
        <div className="shrink-0 px-6 py-4 space-y-3 border-b border-outline-variant/10">
          <div className="flex flex-wrap gap-2">
            {FILTROS.map(f => (
              <button
                key={f.valor}
                onClick={() => setTipo(f.valor)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  tipo === f.valor
                    ? 'bg-primary text-on-primary border-transparent'
                    : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10 hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{f.icone}</span>
                {f.rotulo}
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="material-symbols-outlined text-base text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por ação ou resumo"
              className="pl-9 bg-surface-container-low border-outline-variant/20 text-on-surface"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
              <Switch checked={semHeartbeat} onCheckedChange={setSemHeartbeat} />
              Esconder Heartbeat
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoAtualizar(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  autoAtualizar
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10'
                }`}
                title={
                  autoAtualizar ? 'Pausar atualização automática' : 'Retomar atualização automática'
                }
              >
                <span className="material-symbols-outlined text-sm">
                  {autoAtualizar ? 'pause' : 'play_arrow'}
                </span>
                {autoAtualizar ? 'Ao vivo (10 s)' : 'Pausado'}
              </button>
              <button
                onClick={() => void (estado === 'pronto' ? atualizar() : carregar())}
                disabled={estado === 'carregando' || atualizando}
                className="p-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/10 hover:bg-surface-variant transition-all disabled:opacity-30 flex items-center justify-center"
                title="Atualizar agora"
              >
                <span
                  className={`material-symbols-outlined text-base ${atualizando ? 'animate-spin' : ''}`}
                >
                  refresh
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Linha do tempo */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {estado === 'carregando' ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : estado === 'indisponivel' ? (
            <EstadoVazio icone="cloud_off" texto="Logs indisponíveis para este carregador" />
          ) : estado === 'erro' ? (
            <div className="flex flex-col items-center text-center py-16 gap-3">
              <span className="material-symbols-outlined text-4xl text-error">error</span>
              <p className="text-sm text-on-surface">Não foi possível carregar os logs</p>
              {erro && (
                <p className="text-xs text-on-surface-variant max-w-sm break-words">{erro}</p>
              )}
              <button
                onClick={() => void carregar()}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/20 text-on-surface text-sm font-bold hover:bg-surface-container-highest transition-all"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                Tentar de novo
              </button>
            </div>
          ) : lista.itens.length === 0 ? (
            <EstadoVazio
              icone="history"
              texto="Nenhum log ainda — os logs começam a ser gravados a partir desta atualização"
              detalhe={
                tipo !== 'todos' || semHeartbeat
                  ? 'Há filtros ativos (tipo ou Heartbeat oculto); mude-os para ver tudo.'
                  : undefined
              }
            />
          ) : (
            <>
              {visiveis.length === 0 ? (
                <EstadoVazio icone="search_off" texto="Nenhum log corresponde aos filtros" />
              ) : (
                <ol className="relative border-l border-outline-variant/20 ml-3 space-y-2">
                  {visiveis.map(item => {
                    const s = estilo(item);
                    const aberto = expandidos.has(item.id);
                    const temPayload = item.payload !== null && item.payload !== undefined;
                    return (
                      <li key={item.id} className="relative pl-6">
                        <span
                          className={`absolute -left-3 top-2.5 w-6 h-6 rounded-full border flex items-center justify-center bg-surface-container ${s.borda}`}
                          title={s.rotulo}
                        >
                          <span className={`material-symbols-outlined text-sm ${s.cor}`}>
                            {s.icone}
                          </span>
                        </span>
                        <div
                          className={`rounded-lg border border-outline-variant/10 bg-surface-container-low transition-colors ${
                            temPayload ? 'hover:border-outline-variant/30' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => temPayload && alternar(item.id)}
                            className={`w-full text-left px-3 py-2.5 ${temPayload ? 'cursor-pointer' : 'cursor-default'}`}
                            aria-expanded={temPayload ? aberto : undefined}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="font-mono text-[11px] text-on-surface-variant shrink-0"
                                title={dataCompleta(item.ts)}
                              >
                                {formatarHora(item.ts)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.fundo} ${s.cor} ${s.borda}`}
                              >
                                {s.rotulo}
                              </span>
                              <span className="font-headline font-bold text-sm text-on-surface break-all">
                                {item.acao}
                              </span>
                              {temPayload && (
                                <span className="material-symbols-outlined text-base text-on-surface-variant ml-auto">
                                  {aberto ? 'expand_less' : 'expand_more'}
                                </span>
                              )}
                            </div>
                            {item.resumo && (
                              <p className="text-xs text-on-surface-variant mt-1 break-words">
                                {item.resumo}
                              </p>
                            )}
                          </button>
                          {aberto && temPayload && (
                            <div className="border-t border-outline-variant/10 px-3 py-2.5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                                  Payload
                                </span>
                                <button
                                  onClick={() => copiar(item.payload)}
                                  className="flex items-center gap-1 text-primary text-[10px] font-bold uppercase tracking-widest hover:underline"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    content_copy
                                  </span>
                                  Copiar
                                </button>
                              </div>
                              <pre className="text-[11px] font-mono text-on-surface bg-surface-container-lowest/60 rounded-md p-3 overflow-x-auto max-h-80 whitespace-pre">
                                {JSON.stringify(item.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <div className="flex flex-col items-center gap-1 pt-4">
                {lista.proximoAntes ? (
                  <button
                    onClick={() => void carregarMais()}
                    disabled={carregandoMais}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/20 text-on-surface text-xs font-bold hover:bg-surface-container-highest transition-all disabled:opacity-50"
                  >
                    <span
                      className={`material-symbols-outlined text-base ${carregandoMais ? 'animate-spin' : ''}`}
                    >
                      {carregandoMais ? 'progress_activity' : 'expand_more'}
                    </span>
                    {carregandoMais ? 'Carregando…' : 'Carregar mais'}
                  </button>
                ) : (
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                    Fim do histórico
                  </span>
                )}
                <span className="text-[10px] text-on-surface-variant">
                  {visiveis.length} de {lista.itens.length} carregados
                </span>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

function EstadoVazio({
  icone,
  texto,
  detalhe,
}: {
  icone: string;
  texto: string;
  detalhe?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center py-16 gap-2 text-on-surface-variant">
      <span className="material-symbols-outlined text-4xl text-outline">{icone}</span>
      <p className="text-sm max-w-sm">{texto}</p>
      {detalhe && <p className="text-xs max-w-sm">{detalhe}</p>}
    </div>
  );
}

export default ChargerLogsSheet;
