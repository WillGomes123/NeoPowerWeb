import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { api } from '../lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

// ============================================================================
// Atendimento por WhatsApp (só a plataforma NeoPower).
// Conversas à esquerda, mensagens no meio, chamado e cliente à direita. Ao
// encerrar, o resumo vai por e-mail ao cliente e em cópia interna.
// ============================================================================

type StatusChamado = 'aberto' | 'em_atendimento' | 'resolvido';

interface ConversaResumo {
  id: number;
  wa_id: string;
  nome_perfil: string | null;
  user_id: number | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  usuario_marca: string | null;
  ultima_mensagem_em: string | null;
  ultima_mensagem_preview: string | null;
  nao_lidas: number;
  janela_aberta_ate: string | null;
  chamado_id: number | null;
  protocolo: string | null;
  chamado_status: StatusChamado | null;
  assunto: string | null;
  atendente_nome: string | null;
}

interface Mensagem {
  id: number;
  chamado_id: number | null;
  direcao: 'IN' | 'OUT';
  tipo: string;
  corpo: string | null;
  midia_mime: string | null;
  midia_nome: string | null;
  tem_midia: boolean;
  status: string;
  erro: string | null;
  automatica: boolean;
  criado_em: string;
  enviado_por_nome: string | null;
}

interface RegistroEmail {
  para: string;
  tipo: 'cliente' | 'interno';
  ok: boolean;
  erro?: string;
}

interface Chamado {
  id: number;
  protocolo: string;
  status: StatusChamado;
  assunto: string | null;
  atendente_nome: string | null;
  charge_point_id: string | null;
  transaction_id: number | null;
  aberto_em: string;
  encerrado_em: string | null;
  resumo: string | null;
  email_cliente: string | null;
  email_enviado_em: string | null;
  email_registro: RegistroEmail[] | null;
}

interface DetalheConversa {
  conversa: {
    id: number;
    wa_id: string;
    nome_perfil: string | null;
    user_id: number | null;
    janela_aberta: boolean;
    janela_aberta_ate: string | null;
  };
  mensagens: Mensagem[];
  chamados: Chamado[];
}

interface ContextoCliente {
  usuario: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    client_id: string | null;
    created_at: string;
  };
  saldo: number | null;
  recargas: Array<{
    id: number;
    transaction_id: number | null;
    charge_point_id: string;
    start_timestamp: string;
    kwh_consumed: string | null;
    total_cost: string | null;
    status: string | null;
  }>;
  chamados: Array<{
    id: number;
    protocolo: string;
    status: StatusChamado;
    assunto: string | null;
    aberto_em: string;
  }>;
}

interface UsuarioAchado {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  client_id: string | null;
}

interface StatusSuporte {
  ativo: boolean;
  webhookConfigurado: boolean;
  assinaturaConfigurada: boolean;
  modelo: string;
}

const ROTULO_STATUS: Record<StatusChamado, { texto: string; classe: string }> = {
  aberto: { texto: 'Aberto', classe: 'bg-tertiary/10 text-tertiary' },
  em_atendimento: { texto: 'Em atendimento', classe: 'bg-secondary/10 text-secondary' },
  resolvido: { texto: 'Resolvido', classe: 'bg-primary/10 text-primary' },
};

const ICONE_ENVIO: Record<string, string> = {
  enviando: 'schedule',
  enviado: 'done',
  entregue: 'done_all',
  lido: 'done_all',
  erro: 'error',
};

async function lerDados<T>(r: Response): Promise<T> {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || j?.message || `Erro ${r.status}`);
  return (j?.data ?? j) as T;
}

function dataHora(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}

function horaCurta(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  const hoje = new Date();
  return d.toDateString() === hoje.toDateString()
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function nomeDaConversa(c: {
  usuario_nome?: string | null;
  nome_perfil: string | null;
  wa_id: string;
}): string {
  return c.usuario_nome || c.nome_perfil || `+${c.wa_id}`;
}

function telefoneLegivel(waId: string): string {
  const m = waId.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${waId}`;
}

function Pilula({ status }: { status: StatusChamado | null }) {
  if (!status) return null;
  const r = ROTULO_STATUS[status];
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${r.classe}`}
    >
      {r.texto}
    </span>
  );
}

/** Negrito do WhatsApp (*texto*) no painel. */
function comNegrito(texto: string) {
  return texto
    .split(/(\*[^*\n]+\*)/)
    .map((parte, i) =>
      /^\*[^*\n]+\*$/.test(parte) ? <strong key={i}>{parte.slice(1, -1)}</strong> : parte
    );
}

/** Foto, áudio, vídeo ou documento de uma mensagem (baixado com o login do painel). */
function MidiaDaMensagem({
  mensagem,
  aoCarregar,
}: {
  mensagem: Mensagem;
  aoCarregar?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    let criada: string | null = null;
    api
      .get(`/suporte/mensagens/${mensagem.id}/midia`)
      .then(async r => {
        if (!r.ok) throw new Error();
        criada = URL.createObjectURL(await r.blob());
        if (ativo) setUrl(criada);
      })
      .catch(() => ativo && setFalhou(true));
    return () => {
      ativo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [mensagem.id]);

  if (falhou) return <p className="text-xs text-error">Não foi possível carregar a mídia.</p>;
  if (!url) return <p className="text-xs text-on-surface-variant">Carregando mídia...</p>;
  const mime = mensagem.midia_mime || '';
  if (mime.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt="Imagem enviada pelo cliente"
          className="max-w-[260px] max-h-[320px] rounded-lg"
          onLoad={aoCarregar}
        />
      </a>
    );
  }
  if (mime.startsWith('audio/'))
    return <audio controls src={url} className="max-w-[260px]" onLoadedMetadata={aoCarregar} />;
  if (mime.startsWith('video/'))
    return (
      <video
        controls
        src={url}
        className="max-w-[260px] rounded-lg"
        onLoadedMetadata={aoCarregar}
      />
    );
  return (
    <a
      href={url}
      download={mensagem.midia_nome || `arquivo-${mensagem.id}`}
      className="text-xs text-primary underline"
    >
      Baixar {mensagem.midia_nome || 'arquivo'}
    </a>
  );
}

export const Atendimento = () => {
  const [status, setStatus] = useState<StatusSuporte | null>(null);
  const [aba, setAba] = useState<'conversas' | 'chamados'>('conversas');
  const [filtro, setFiltro] = useState<'abertos' | 'todos' | 'resolvidos'>('abertos');
  const [busca, setBusca] = useState('');
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheConversa | null>(null);
  const [contexto, setContexto] = useState<ContextoCliente | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [dialogoEncerrar, setDialogoEncerrar] = useState(false);
  const [dialogoNova, setDialogoNova] = useState(false);
  const caixaMensagens = useRef<HTMLDivElement>(null);
  const abertaEm = useRef(0);
  const selecionadaRef = useRef<number | null>(null);
  selecionadaRef.current = selecionada;

  const carregarLista = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (busca.trim()) qs.set('busca', busca.trim());
      if (filtro !== 'todos') qs.set('status', filtro);
      setConversas(await lerDados<ConversaResumo[]>(await api.get(`/suporte/conversas?${qs}`)));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCarregandoLista(false);
    }
  }, [busca, filtro]);

  const carregarConversa = useCallback(async (id: number) => {
    try {
      const d = await lerDados<DetalheConversa>(
        await api.get(`/suporte/conversas/${id}/mensagens`)
      );
      if (selecionadaRef.current !== id) return;
      setDetalhe(d);
      if (d.conversa.user_id) {
        lerDados<ContextoCliente>(await api.get(`/suporte/clientes/${d.conversa.user_id}/contexto`))
          .then(c => selecionadaRef.current === id && setContexto(c))
          .catch(() => setContexto(null));
      } else {
        setContexto(null);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    api
      .get('/suporte/status')
      .then(r => lerDados<StatusSuporte>(r))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregarLista(), 250);
    return () => clearTimeout(t);
  }, [carregarLista]);

  // Tempo real (socket) com uma consulta de reserva a cada 30 s.
  useEffect(() => {
    const token = localStorage.getItem('token');
    const apiUrl: string = import.meta.env?.VITE_API_URL || '';
    const wsUrl = apiUrl.startsWith('http') ? apiUrl.replace('/api', '') : window.location.origin;
    const socket = io(wsUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('suporte:atualizacao', (e: { conversaId?: number }) => {
      void carregarLista();
      if (e?.conversaId && e.conversaId === selecionadaRef.current)
        void carregarConversa(e.conversaId);
    });
    const reserva = setInterval(() => {
      void carregarLista();
      if (selecionadaRef.current) void carregarConversa(selecionadaRef.current);
    }, 30000);
    return () => {
      clearInterval(reserva);
      socket.disconnect();
    };
  }, [carregarLista, carregarConversa]);

  // Rola a caixa de mensagens (não a página) até o fim: logo depois de abrir a
  // conversa, ou quando o atendente já está perto do fim. Fotos que terminam de
  // carregar depois também chamam isso.
  const rolarParaFim = useCallback(() => {
    const el = caixaMensagens.current;
    if (!el) return;
    const perto = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (perto || Date.now() - abertaEm.current < 5000) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (!selecionada) return;
    abertaEm.current = Date.now();
    setDetalhe(null);
    setContexto(null);
    void carregarConversa(selecionada);
    void api.post(`/suporte/conversas/${selecionada}/lida`).then(() => carregarLista());
  }, [selecionada]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rolarParaFim();
  }, [detalhe?.mensagens.length, rolarParaFim]);

  const chamadoAtual = useMemo(
    () => detalhe?.chamados.find(c => c.status !== 'resolvido') ?? detalhe?.chamados[0] ?? null,
    [detalhe]
  );

  const enviar = async () => {
    if (!selecionada || !texto.trim()) return;
    setEnviando(true);
    try {
      await lerDados(
        await api.post(`/suporte/conversas/${selecionada}/mensagens`, { texto: texto.trim() })
      );
      setTexto('');
      await carregarConversa(selecionada);
      void carregarLista();
    } catch (e) {
      toast.error((e as Error).message);
      await carregarConversa(selecionada);
    } finally {
      setEnviando(false);
    }
  };

  const enviarModelo = async () => {
    if (!selecionada) return;
    if (!confirm('Enviar o modelo aprovado para reabrir a conversa com o cliente?')) return;
    try {
      await lerDados(await api.post(`/suporte/conversas/${selecionada}/modelo`));
      toast.success('Modelo enviado. Quando o cliente responder, a conversa reabre.');
      await carregarConversa(selecionada);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const conversaAtual = conversas.find(c => c.id === selecionada);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-primary font-headline tracking-[0.2em] uppercase mb-1 block">
            SUPORTE
          </span>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">
            Atendimento
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            WhatsApp do suporte NeoPower. Tudo fica registrado, e o resumo vai por e-mail ao
            encerrar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-outline-variant/20 overflow-hidden">
            {(['conversas', 'chamados'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAba(a)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                  aba === a
                    ? 'bg-primary/15 text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {a === 'conversas' ? 'Conversas' : 'Histórico de chamados'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDialogoNova(true)}
            disabled={!status?.ativo}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-xs uppercase tracking-wider disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">add_comment</span>
            Nova conversa
          </button>
        </div>
      </div>

      {status && !status.ativo && (
        <div className="rounded-xl border border-tertiary/30 bg-tertiary/10 p-4 text-sm text-on-surface">
          <strong>WhatsApp de suporte ainda não configurado.</strong> Falta cadastrar o número na
          Meta e definir as variáveis <code>WHATSAPP_SUPORTE_*</code> na API. O histórico abaixo
          continua disponível.
        </div>
      )}
      {status?.ativo && !status.assinaturaConfigurada && (
        <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-on-surface">
          Falta <code>WHATSAPP_SUPORTE_APP_SECRET</code>: sem ele a API recusa as mensagens
          recebidas.
        </div>
      )}

      {aba === 'chamados' ? (
        <HistoricoDeChamados
          abrirConversa={id => {
            setAba('conversas');
            setFiltro('todos');
            setSelecionada(id);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_340px] gap-4 xl:h-[calc(100vh-17rem)] min-h-[600px]">
          {/* Lista */}
          <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 flex flex-col overflow-hidden">
            <div className="p-3 space-y-2 border-b border-outline-variant/10">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-on-surface-variant">
                  search
                </span>
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Nome, telefone, e-mail ou protocolo"
                  className="w-full bg-surface-container border border-outline-variant/20 rounded-lg pl-10 pr-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div className="flex gap-1">
                {(['abertos', 'todos', 'resolvidos'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                      filtro === f
                        ? 'bg-primary/15 text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-outline-variant/5">
              {carregandoLista ? (
                <p className="p-6 text-center text-sm text-on-surface-variant">Carregando...</p>
              ) : conversas.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-5xl text-outline">forum</span>
                  <p className="text-sm text-on-surface-variant mt-2">Nenhuma conversa aqui.</p>
                </div>
              ) : (
                conversas.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelecionada(c.id)}
                    className={`w-full text-left p-3 hover:bg-surface-container transition-colors ${
                      selecionada === c.id ? 'bg-surface-container-highest' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm font-semibold text-on-surface truncate">
                        {nomeDaConversa(c)}
                      </span>
                      <span className="text-[10px] text-on-surface-variant shrink-0">
                        {horaCurta(c.ultima_mensagem_em)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-0.5">
                      <span className="text-xs text-on-surface-variant truncate">
                        {c.ultima_mensagem_preview || '—'}
                      </span>
                      {c.nao_lidas > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.nao_lidas}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Pilula status={c.chamado_status} />
                      {c.protocolo && (
                        <span className="text-[10px] text-on-surface-variant">#{c.protocolo}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Conversa */}
          <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 flex flex-col overflow-hidden">
            {!selecionada ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <span className="material-symbols-outlined text-6xl text-outline">
                  support_agent
                </span>
                <p className="text-on-surface-variant mt-2">Escolha uma conversa.</p>
              </div>
            ) : !detalhe ? (
              <p className="p-8 text-center text-sm text-on-surface-variant">
                Carregando conversa...
              </p>
            ) : (
              <>
                <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-headline font-bold text-on-surface truncate">
                      {conversaAtual
                        ? nomeDaConversa(conversaAtual)
                        : detalhe.conversa.nome_perfil || `+${detalhe.conversa.wa_id}`}
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      {telefoneLegivel(detalhe.conversa.wa_id)}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      detalhe.conversa.janela_aberta
                        ? 'bg-primary/10 text-primary'
                        : 'bg-error/10 text-error'
                    }`}
                    title="A Meta só permite texto livre até 24 h depois da última mensagem do cliente."
                  >
                    {detalhe.conversa.janela_aberta
                      ? `Janela aberta até ${horaCurta(detalhe.conversa.janela_aberta_ate)}`
                      : 'Janela de 24 h fechada'}
                  </span>
                </div>

                <div ref={caixaMensagens} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2">
                  {detalhe.mensagens.map((m, i) => {
                    const anterior = detalhe.mensagens[i - 1];
                    const novoChamado = m.chamado_id && m.chamado_id !== anterior?.chamado_id;
                    const ch = novoChamado
                      ? detalhe.chamados.find(c => c.id === m.chamado_id)
                      : null;
                    // Com a mídia na tela, o rótulo "[imagem]" sobra; fica só a legenda.
                    const legenda = m.tem_midia
                      ? (m.corpo ?? '').replace(/^\[[^\]]+\]\s*/, '')
                      : (m.corpo ?? '');
                    return (
                      <div key={m.id}>
                        {ch && (
                          <div className="flex items-center gap-2 my-3 text-[10px] uppercase tracking-widest text-on-surface-variant">
                            <div className="flex-1 h-px bg-outline-variant/20" />
                            Protocolo {ch.protocolo}
                            <div className="flex-1 h-px bg-outline-variant/20" />
                          </div>
                        )}
                        <div
                          className={`flex ${m.direcao === 'OUT' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                              m.direcao === 'OUT'
                                ? m.automatica
                                  ? 'bg-surface-container-highest text-on-surface-variant italic'
                                  : 'bg-primary/15 text-on-surface'
                                : 'bg-surface-container text-on-surface'
                            }`}
                          >
                            {m.tem_midia && (
                              <MidiaDaMensagem mensagem={m} aoCarregar={rolarParaFim} />
                            )}
                            {legenda && <div>{comNegrito(legenda)}</div>}
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-on-surface-variant not-italic">
                              {m.direcao === 'OUT' &&
                                (m.automatica
                                  ? 'Automática · '
                                  : m.enviado_por_nome
                                    ? `${m.enviado_por_nome} · `
                                    : '')}
                              {dataHora(m.criado_em)}
                              {m.direcao === 'OUT' && (
                                <span
                                  className={`material-symbols-outlined text-[14px] ${
                                    m.status === 'lido'
                                      ? 'text-primary'
                                      : m.status === 'erro'
                                        ? 'text-error'
                                        : ''
                                  }`}
                                  title={m.status}
                                >
                                  {ICONE_ENVIO[m.status] ?? 'done'}
                                </span>
                              )}
                            </div>
                            {m.erro && (
                              <div className="text-[11px] text-error mt-1 not-italic">{m.erro}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 border-t border-outline-variant/10">
                  {detalhe.conversa.janela_aberta ? (
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void enviar();
                          }
                        }}
                        rows={2}
                        maxLength={4096}
                        placeholder="Escreva a resposta (Enter envia, Shift+Enter quebra linha)"
                        className="flex-1 resize-none bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <button
                        onClick={() => void enviar()}
                        disabled={enviando || !texto.trim()}
                        className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary flex items-center justify-center disabled:opacity-40"
                        title="Enviar"
                      >
                        <span className="material-symbols-outlined text-lg">send</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-on-surface-variant">
                        O cliente não escreve há mais de 24 h. Pela regra da Meta, só dá para enviar
                        o modelo aprovado.
                      </span>
                      <button
                        onClick={() => void enviarModelo()}
                        className="shrink-0 px-4 py-2 rounded-full bg-surface-container-highest text-primary text-xs font-bold uppercase tracking-wider"
                      >
                        Enviar modelo
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Chamado e cliente */}
          <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-y-auto min-h-0">
            {detalhe && chamadoAtual ? (
              <PainelLateral
                key={`${detalhe.conversa.id}-${chamadoAtual.id}`}
                conversaId={detalhe.conversa.id}
                chamado={chamadoAtual}
                chamados={detalhe.chamados}
                contexto={contexto}
                aoAlterar={() => {
                  void carregarConversa(detalhe.conversa.id);
                  void carregarLista();
                }}
                aoEncerrar={() => setDialogoEncerrar(true)}
              />
            ) : (
              <p className="p-6 text-sm text-on-surface-variant">
                O chamado e os dados do cliente aparecem aqui.
              </p>
            )}
          </div>
        </div>
      )}

      {detalhe && chamadoAtual && chamadoAtual.status !== 'resolvido' && (
        <DialogoEncerrar
          aberto={dialogoEncerrar}
          fechar={() => setDialogoEncerrar(false)}
          chamado={chamadoAtual}
          emailSugerido={contexto?.usuario.email ?? ''}
          janelaAberta={detalhe.conversa.janela_aberta}
          aoEncerrar={() => {
            setDialogoEncerrar(false);
            void carregarConversa(detalhe.conversa.id);
            void carregarLista();
          }}
        />
      )}

      <DialogoNovaConversa
        aberto={dialogoNova}
        fechar={() => setDialogoNova(false)}
        aoCriar={id => {
          setDialogoNova(false);
          setFiltro('abertos');
          setSelecionada(id);
          void carregarLista();
        }}
      />
    </div>
  );
};

function PainelLateral({
  conversaId,
  chamado,
  chamados,
  contexto,
  aoAlterar,
  aoEncerrar,
}: {
  conversaId: number;
  chamado: Chamado;
  chamados: Chamado[];
  contexto: ContextoCliente | null;
  aoAlterar: () => void;
  aoEncerrar: () => void;
}) {
  const [assunto, setAssunto] = useState(chamado.assunto ?? '');
  const [carregador, setCarregador] = useState(chamado.charge_point_id ?? '');
  const [transacao, setTransacao] = useState(
    chamado.transaction_id != null ? String(chamado.transaction_id) : ''
  );
  const [salvando, setSalvando] = useState(false);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [achados, setAchados] = useState<UsuarioAchado[]>([]);
  const encerrado = chamado.status === 'resolvido';

  useEffect(() => {
    if (buscaUsuario.trim().length < 2) {
      setAchados([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .get(`/suporte/usuarios?busca=${encodeURIComponent(buscaUsuario.trim())}`)
        .then(r => lerDados<UsuarioAchado[]>(r))
        .then(setAchados)
        .catch(() => setAchados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [buscaUsuario]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await lerDados(
        await api.patch(`/suporte/chamados/${chamado.id}`, {
          assunto,
          chargePointId: carregador.trim() || null,
          transactionId: transacao.trim() || null,
        })
      );
      toast.success('Chamado atualizado.');
      aoAlterar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const vincular = async (userId: number | null) => {
    try {
      await lerDados(await api.patch(`/suporte/conversas/${conversaId}/usuario`, { userId }));
      setBuscaUsuario('');
      setAchados([]);
      aoAlterar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const campo =
    'w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60';

  return (
    <div className="p-4 space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Chamado
          </h4>
          <Pilula status={chamado.status} />
        </div>
        <p className="text-lg font-headline font-bold text-on-surface">#{chamado.protocolo}</p>
        <p className="text-xs text-on-surface-variant">
          Aberto {dataHora(chamado.aberto_em)}
          {chamado.atendente_nome ? ` · ${chamado.atendente_nome}` : ''}
          {chamado.encerrado_em ? ` · encerrado ${dataHora(chamado.encerrado_em)}` : ''}
        </p>
        <input
          className={campo}
          value={assunto}
          onChange={e => setAssunto(e.target.value)}
          placeholder="Assunto"
          disabled={encerrado}
          maxLength={200}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={campo}
            value={carregador}
            onChange={e => setCarregador(e.target.value)}
            placeholder="Carregador"
            disabled={encerrado}
          />
          <input
            className={campo}
            value={transacao}
            onChange={e => setTransacao(e.target.value.replace(/\D/g, ''))}
            placeholder="Transação"
            disabled={encerrado}
          />
        </div>
        {encerrado ? (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Resumo enviado
            </p>
            <p className="text-sm text-on-surface whitespace-pre-wrap bg-surface-container rounded-lg p-3">
              {chamado.resumo}
            </p>
            {(chamado.email_registro ?? []).map((r, i) => (
              <p key={i} className={`text-xs ${r.ok ? 'text-primary' : 'text-error'}`}>
                {r.tipo === 'cliente' ? 'Cliente' : 'Cópia interna'}: {r.para} —{' '}
                {r.ok ? 'enviado' : `falhou (${r.erro ?? ''})`}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => void salvar()}
              disabled={salvando}
              className="flex-1 py-2 rounded-lg bg-surface-container-highest text-on-surface text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              onClick={aoEncerrar}
              className="flex-1 py-2 rounded-lg bg-gradient-to-tr from-primary to-secondary text-on-primary text-xs font-bold uppercase tracking-wider"
            >
              Encerrar chamado
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Cliente
        </h4>
        {contexto ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-on-surface">{contexto.usuario.name || 'Sem nome'}</p>
            <p className="text-on-surface-variant text-xs">
              {contexto.usuario.email || 'sem e-mail'}
            </p>
            <p className="text-on-surface-variant text-xs">
              {contexto.usuario.phone || 'sem telefone'} · marca{' '}
              {contexto.usuario.client_id || 'NeoPower'} · desde{' '}
              {new Date(contexto.usuario.created_at).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-on-surface">
              Saldo:{' '}
              <strong>
                {contexto.saldo != null ? `R$ ${contexto.saldo.toFixed(2).replace('.', ',')}` : '—'}
              </strong>
            </p>
            <button onClick={() => void vincular(null)} className="text-xs text-error underline">
              Desvincular este cadastro
            </button>
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                Últimas recargas
              </p>
              {contexto.recargas.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Nenhuma.</p>
              ) : (
                <ul className="space-y-1">
                  {contexto.recargas.map(r => (
                    <li
                      key={r.id}
                      className="text-xs text-on-surface-variant flex justify-between gap-2"
                    >
                      <span className="truncate">
                        #{r.transaction_id ?? r.id} · {r.charge_point_id} ·{' '}
                        {dataHora(r.start_timestamp)}
                      </span>
                      <span className="shrink-0">
                        {r.kwh_consumed ? `${Number(r.kwh_consumed).toFixed(2)} kWh` : '-'} ·{' '}
                        {r.total_cost ? `R$ ${Number(r.total_cost).toFixed(2)}` : '-'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-on-surface-variant">
              Conversa sem cadastro vinculado. Procure o cliente para ver saldo e recargas.
            </p>
            <input
              className={campo}
              value={buscaUsuario}
              onChange={e => setBuscaUsuario(e.target.value)}
              placeholder="Nome, e-mail ou telefone"
            />
            {achados.map(u => (
              <button
                key={u.id}
                onClick={() => void vincular(u.id)}
                className="w-full text-left p-2 rounded-lg hover:bg-surface-container text-xs"
              >
                <span className="font-semibold text-on-surface">{u.name || 'Sem nome'}</span>
                <span className="block text-on-surface-variant">
                  {u.email || '-'} · {u.phone || '-'} · {u.client_id || 'NeoPower'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {chamados.length > 1 && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Chamados desta conversa
          </h4>
          {chamados.map(c => (
            <div key={c.id} className="flex items-center justify-between text-xs">
              <span className="text-on-surface">
                #{c.protocolo}{' '}
                <span className="text-on-surface-variant">{c.assunto ? `· ${c.assunto}` : ''}</span>
              </span>
              <Pilula status={c.status} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function DialogoEncerrar({
  aberto,
  fechar,
  chamado,
  emailSugerido,
  janelaAberta,
  aoEncerrar,
}: {
  aberto: boolean;
  fechar: () => void;
  chamado: Chamado;
  emailSugerido: string;
  janelaAberta: boolean;
  aoEncerrar: () => void;
}) {
  const [resumo, setResumo] = useState('');
  const [email, setEmail] = useState(emailSugerido);
  const [mandarEmail, setMandarEmail] = useState(true);
  const [avisar, setAvisar] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  useEffect(() => {
    if (aberto) setEmail(emailSugerido);
  }, [aberto, emailSugerido]);

  const gerar = async () => {
    setGerando(true);
    try {
      const r = await lerDados<{ resumo: string | null; ia: boolean }>(
        await api.post(`/suporte/chamados/${chamado.id}/resumo`)
      );
      if (r.resumo) setResumo(r.resumo);
      else toast.info('A IA não está disponível agora. Escreva o resumo.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerando(false);
    }
  };

  const encerrar = async () => {
    setEncerrando(true);
    try {
      const r = await lerDados<{ emails: RegistroEmail[] }>(
        await api.post(`/suporte/chamados/${chamado.id}/encerrar`, {
          resumo,
          emailCliente: email.trim() || null,
          enviarEmailCliente: mandarEmail,
          avisarNoWhatsapp: avisar,
        })
      );
      const falhas = r.emails.filter(e => !e.ok);
      if (falhas.length)
        toast.warning(
          `Chamado encerrado, mas ${falhas.length} e-mail(s) falharam. Veja no chamado.`
        );
      else toast.success(`Chamado ${chamado.protocolo} encerrado e resumo enviado.`);
      setResumo('');
      aoEncerrar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEncerrando(false);
    }
  };

  const campo =
    'w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50';

  return (
    <Dialog open={aberto} onOpenChange={o => !o && fechar()}>
      <DialogContent className="bg-surface-container border-outline-variant/20 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-on-surface">
            Encerrar chamado #{chamado.protocolo}
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            O resumo vai por e-mail ao cliente e em cópia interna, com a conversa completa anexada.
            Isso não tem volta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              O que foi tratado
            </label>
            <button
              onClick={() => void gerar()}
              disabled={gerando}
              className="flex items-center gap-1 text-xs font-bold text-primary disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              {gerando ? 'Gerando...' : 'Rascunho com IA'}
            </button>
          </div>
          <textarea
            value={resumo}
            onChange={e => setResumo(e.target.value)}
            rows={8}
            maxLength={8000}
            placeholder={
              '- Solicitação do cliente\n- O que foi verificado ou feito\n- Resultado e o que foi combinado\n- Pendências'
            }
            className={`${campo} resize-y`}
          />
          <p className="text-[11px] text-on-surface-variant">
            Revise o texto: é o que o cliente vai receber.
          </p>
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input
              type="checkbox"
              checked={mandarEmail}
              onChange={e => setMandarEmail(e.target.checked)}
            />
            Enviar o resumo ao cliente
          </label>
          {mandarEmail && (
            <input
              className={campo}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-mail do cliente (sem e-mail, vai só a cópia interna)"
              type="email"
            />
          )}
          <label
            className={`flex items-center gap-2 text-sm ${janelaAberta ? 'text-on-surface' : 'text-on-surface-variant'}`}
          >
            <input
              type="checkbox"
              checked={avisar && janelaAberta}
              disabled={!janelaAberta}
              onChange={e => setAvisar(e.target.checked)}
            />
            Avisar o encerramento no WhatsApp {janelaAberta ? '' : '(janela de 24 h fechada)'}
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={fechar} className="px-4 py-2 rounded-lg text-sm text-on-surface-variant">
            Cancelar
          </button>
          <button
            onClick={() => void encerrar()}
            disabled={encerrando || resumo.trim().length < 10}
            className="px-5 py-2 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary text-xs font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {encerrando ? 'Encerrando...' : 'Encerrar e enviar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoNovaConversa({
  aberto,
  fechar,
  aoCriar,
}: {
  aberto: boolean;
  fechar: () => void;
  aoCriar: (conversaId: number) => void;
}) {
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [criando, setCriando] = useState(false);

  const criar = async () => {
    setCriando(true);
    try {
      const r = await lerDados<{ conversaId: number; protocolo: string }>(
        await api.post('/suporte/conversas', { telefone, nome: nome.trim() || undefined })
      );
      toast.success(`Modelo enviado. Protocolo ${r.protocolo}.`);
      setTelefone('');
      setNome('');
      aoCriar(r.conversaId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCriando(false);
    }
  };

  const campo =
    'w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50';

  return (
    <Dialog open={aberto} onOpenChange={o => !o && fechar()}>
      <DialogContent className="bg-surface-container border-outline-variant/20">
        <DialogHeader>
          <DialogTitle className="text-on-surface">Nova conversa</DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            A Meta só deixa a empresa falar primeiro com o modelo aprovado. Quando o cliente
            responder, a conversa fica livre por 24 h.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input
            className={campo}
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder="Telefone com DDD, ex.: (71) 99999-9999"
          />
          <input
            className={campo}
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome (opcional)"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={fechar} className="px-4 py-2 rounded-lg text-sm text-on-surface-variant">
            Cancelar
          </button>
          <button
            onClick={() => void criar()}
            disabled={criando || telefone.replace(/\D/g, '').length < 10}
            className="px-5 py-2 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary text-xs font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {criando ? 'Enviando...' : 'Enviar modelo'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ChamadoDoHistorico {
  id: number;
  protocolo: string;
  status: StatusChamado;
  assunto: string | null;
  aberto_em: string;
  encerrado_em: string | null;
  email_enviado_em: string | null;
  conversa_id: number;
  wa_id: string;
  nome_perfil: string | null;
  usuario_nome: string | null;
  atendente_nome: string | null;
}

function HistoricoDeChamados({ abrirConversa }: { abrirConversa: (conversaId: number) => void }) {
  const [status, setStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [chamados, setChamados] = useState<ChamadoDoHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (busca.trim()) qs.set('busca', busca.trim());
      api
        .get(`/suporte/chamados?${qs}`)
        .then(r => lerDados<ChamadoDoHistorico[]>(r))
        .then(setChamados)
        .catch(e => toast.error((e as Error).message))
        .finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [status, busca]);

  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="p-4 flex flex-col md:flex-row gap-3 border-b border-outline-variant/10">
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Protocolo, cliente, telefone ou assunto"
          className="flex-1 bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface"
        >
          <option value="">Todos os status</option>
          <option value="aberto">Aberto</option>
          <option value="em_atendimento">Em atendimento</option>
          <option value="resolvido">Resolvido</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
              <th className="px-4 py-3">Protocolo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Assunto</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Atendente</th>
              <th className="px-4 py-3">Aberto</th>
              <th className="px-4 py-3">Encerrado</th>
              <th className="px-4 py-3">E-mail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {carregando ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-sm text-on-surface-variant">
                  Carregando...
                </td>
              </tr>
            ) : chamados.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-sm text-on-surface-variant">
                  Nenhum chamado.
                </td>
              </tr>
            ) : (
              chamados.map(c => (
                <tr
                  key={c.id}
                  onClick={() => abrirConversa(c.conversa_id)}
                  className="hover:bg-surface-container-highest/30 cursor-pointer text-sm"
                >
                  <td className="px-4 py-3 font-semibold text-on-surface">#{c.protocolo}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {c.usuario_nome || c.nome_perfil || `+${c.wa_id}`}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{c.assunto || '-'}</td>
                  <td className="px-4 py-3">
                    <Pilula status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{c.atendente_nome || '-'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{dataHora(c.aberto_em)}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{dataHora(c.encerrado_em)}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {c.email_enviado_em ? 'Enviado' : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Atendimento;
