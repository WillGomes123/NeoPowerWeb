import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FormEvent,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../lib/auth';
import {
  KairosStore,
  KairosMensagem,
  KairosMonitor,
  KairosErro,
  storeServidor,
  criarStoreLocal,
  apagarChavesLegadas,
  enviarParaKairos,
  tituloDaPergunta,
} from '../lib/kairos';
import { KairosMarkdown } from './KairosMarkdown';
import {
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Send,
  Sparkles,
  MessageSquare,
  Pencil,
  RefreshCw,
  X,
  Check,
  Bot,
  Cloud,
  HardDrive,
  Activity,
  RotateCcw,
} from 'lucide-react';

/** Conversa como o painel a mantém: `mensagens` só existe depois de carregada. */
interface ConversaUI {
  id: string;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
  mensagens?: KairosMensagem[];
  /** Ainda não existe no armazenamento — é criada na primeira mensagem. */
  rascunho?: boolean;
}

type VistaMovel = 'conversas' | 'chat' | 'monitores';

const TITULO_PADRAO = 'Nova conversa';

const novoRascunho = (): ConversaUI => {
  const agora = new Date().toISOString();
  return {
    id: `rascunho_${Date.now()}`,
    titulo: TITULO_PADRAO,
    criadoEm: agora,
    atualizadoEm: agora,
    mensagens: [],
    rascunho: true,
  };
};

const msgErro = (e: unknown, padrao: string) =>
  e instanceof Error && e.message ? e.message : padrao;

const formatarQuando = (iso: string | null | undefined) => {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Nunca';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SUGESTOES = [
  {
    label: 'Fluxo para receber dinheiro',
    text: 'Quero receber dinheiro com os carregadores sem ter dor de cabeça com configuração, como funciona?',
  },
  {
    label: 'Como funciona o sistema?',
    text: 'Como funciona o fluxo de recargas e cobranças da plataforma?',
  },
];

const PASSOS_CARREGANDO = [
  'consultando o banco de dados...',
  'analisando dados da plataforma...',
  'executando ferramentas administrativas...',
  'consolidando informações e gerando resposta...',
];

interface KairosPanelProps {
  onClose: () => void;
}

export const KairosPanel = ({ onClose }: KairosPanelProps) => {
  // Marca do operador (white-label): a IA nunca deve se apresentar como "NeoPower".
  const { tenantBranding } = useTenant();
  const { user } = useAuth();
  const brandName: string | undefined = tenantBranding?.companyName || undefined;
  const saudacao = brandName
    ? `Olá! Sou o **KAIROS**, o assistente inteligente da ${brandName}. Você pode me perguntar sobre postos, tarifas ou configurar novos alertas!`
    : 'Olá! Sou o **KAIROS**, o seu assistente inteligente. Você pode me perguntar sobre postos, tarifas ou configurar novos alertas!';

  const userId = user?.id ?? null;
  const clientId = user?.clientId ?? null;
  const storeLocal = useMemo(() => criarStoreLocal(userId, clientId), [userId, clientId]);

  // ---------------------------------------------------------------- conversas
  const [store, setStore] = useState<KairosStore | null>(null);
  const [conversas, setConversas] = useState<ConversaUI[]>([]);
  const conversasRef = useRef<ConversaUI[]>([]);
  conversasRef.current = conversas;
  const [ativaId, setAtivaId] = useState('');
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [carregandoConversa, setCarregandoConversa] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  // Envio: `enviando` trava o formulário até a conversa ser salva;
  // `aguardandoIA` é só o tempo de espera pela resposta (indicador de digitação).
  const [enviando, setEnviando] = useState<string | null>(null);
  const [aguardandoIA, setAguardandoIA] = useState<string | null>(null);
  const [falha, setFalha] = useState<{ conversaId: string; erro: string } | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [passo, setPasso] = useState(0);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tituloEditado, setTituloEditado] = useState('');
  const [vistaMovel, setVistaMovel] = useState<VistaMovel>('chat');
  const [monitoresAbertos, setMonitoresAbertos] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---------------------------------------------------------------- monitores
  const [storeMon, setStoreMon] = useState<KairosStore | null>(null);
  const [monitores, setMonitores] = useState<KairosMonitor[]>([]);
  const [novoMonitorTexto, setNovoMonitorTexto] = useState('');
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

  const atualizarConversaLocal = useCallback((id: string, mudancas: Partial<ConversaUI>) => {
    setConversas(prev => prev.map(c => (c.id === id ? { ...c, ...mudancas } : c)));
  }, []);

  // Carrega as conversas: servidor primeiro; 404 = API ainda sem as rotas → local isolado.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      setErroLista(null);
      let escolhido: KairosStore = storeServidor;
      let lista: ConversaUI[] = [];
      try {
        lista = await storeServidor.listarConversas();
        // A conta passou a guardar as conversas: as chaves antigas (compartilhadas
        // entre contas do navegador) não são importadas — só apagadas.
        apagarChavesLegadas();
      } catch (e) {
        if (e instanceof KairosErro && e.status === 404) {
          escolhido = storeLocal;
          lista = await storeLocal.listarConversas();
        } else if (!cancelado) {
          setErroLista(msgErro(e, 'Não foi possível carregar suas conversas.'));
        }
      }
      if (cancelado) return;
      const inicial = lista.length > 0 ? lista : [novoRascunho()];
      setStore(escolhido);
      setConversas(inicial);
      setAtivaId(inicial[0].id);
    })();
    return () => {
      cancelado = true;
    };
  }, [storeLocal, recarregar]);

  // Carrega os monitores (mesma regra de fallback).
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const lista = await storeServidor.listarMonitores();
        if (cancelado) return;
        setStoreMon(storeServidor);
        setMonitores(lista);
      } catch (e) {
        if (cancelado) return;
        if (e instanceof KairosErro && e.status === 404) {
          setStoreMon(storeLocal);
          setMonitores(await storeLocal.listarMonitores());
        } else {
          setStoreMon(storeServidor);
          toast.error(msgErro(e, 'Não foi possível carregar os monitores.'));
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [storeLocal]);

  const ativa = conversas.find(c => c.id === ativaId);

  // Mensagens da conversa aberta são carregadas sob demanda.
  const precisaCarregar = !!ativa && ativa.mensagens === undefined && !ativa.rascunho;
  useEffect(() => {
    if (!store || !precisaCarregar) return;
    let cancelado = false;
    const id = ativaId;
    setCarregandoConversa(id);
    store
      .obterConversa(id)
      .then(c => {
        if (!cancelado)
          atualizarConversaLocal(id, {
            mensagens: c.mensagens ?? [],
            titulo: c.titulo || TITULO_PADRAO,
          });
      })
      .catch(e => {
        if (!cancelado) toast.error(msgErro(e, 'Não foi possível abrir a conversa.'));
      })
      .finally(() => {
        if (!cancelado) setCarregandoConversa(prev => (prev === id ? null : prev));
      });
    return () => {
      cancelado = true;
    };
  }, [store, ativaId, precisaCarregar, atualizarConversaLocal]);

  // Texto do "KAIROS está ..." enquanto espera.
  useEffect(() => {
    if (!aguardandoIA) {
      setPasso(0);
      return;
    }
    const t = setInterval(() => setPasso(p => p + 1), 1800);
    return () => clearInterval(t);
  }, [aguardandoIA]);

  // Rola até o fim ao trocar de conversa ou chegar mensagem.
  const totalMsgs = ativa?.mensagens?.length ?? 0;
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [ativaId, totalMsgs, aguardandoIA, falha]);

  // ------------------------------------------------------------------ ações
  const abrirConversa = (id: string) => {
    setAtivaId(id);
    setVistaMovel('chat');
  };

  const handleNovaConversa = () => {
    const vazia = conversasRef.current.find(c => c.rascunho && (c.mensagens?.length ?? 0) === 0);
    if (vazia) {
      abrirConversa(vazia.id);
    } else {
      const r = novoRascunho();
      setConversas(prev => [r, ...prev]);
      abrirConversa(r.id);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleExcluirConversa = async (id: string) => {
    const alvo = conversasRef.current.find(c => c.id === id);
    if (!alvo || enviando === id) return;
    if (!alvo.rascunho && store) {
      try {
        await store.excluirConversa(id);
      } catch (e) {
        toast.error(msgErro(e, 'Não foi possível excluir a conversa.'));
        return;
      }
    }
    const restantes = conversasRef.current.filter(c => c.id !== id);
    const lista = restantes.length > 0 ? restantes : [novoRascunho()];
    setConversas(lista);
    if (ativaId === id) setAtivaId(lista[0].id);
    if (falha?.conversaId === id) setFalha(null);
    if (!alvo.rascunho) toast.success('Conversa excluída.');
  };

  const salvarTitulo = async (id: string) => {
    const titulo = tituloEditado.trim();
    setEditandoId(null);
    const alvo = conversasRef.current.find(c => c.id === id);
    if (!alvo || !titulo || titulo === alvo.titulo) return;
    const anterior = alvo.titulo;
    atualizarConversaLocal(id, { titulo });
    if (alvo.rascunho || !store) return;
    try {
      await store.atualizarConversa(id, { titulo });
    } catch (e) {
      atualizarConversaLocal(id, { titulo: anterior });
      toast.error(msgErro(e, 'Não foi possível renomear a conversa.'));
    }
  };

  /**
   * Envia uma pergunta. Com `reenviar`, repete a última pergunta sem resposta
   * (depois de uma falha) sem duplicá-la.
   */
  const enviar = async (texto: string, reenviar = false) => {
    const conv = conversasRef.current.find(c => c.id === ativaId);
    if (enviando || !store || !conv || conv.mensagens === undefined) return;
    const pergunta = texto.trim();
    if (!reenviar && !pergunta) return;

    const primeira = !conv.mensagens.some(m => m.role === 'user');
    const titulo =
      primeira && conv.titulo === TITULO_PADRAO ? tituloDaPergunta(pergunta) : conv.titulo;
    const base: KairosMensagem[] = reenviar
      ? conv.mensagens
      : [...conv.mensagens, { role: 'user', content: pergunta, ts: new Date().toISOString() }];

    // A pergunta entra na conversa antes da chamada: se a API falhar, ela continua lá.
    atualizarConversaLocal(conv.id, { mensagens: base, titulo });
    if (!reenviar) setInputMessage('');
    setFalha(null);
    setEnviando(conv.id);
    setAguardandoIA(conv.id);

    let resposta: string;
    try {
      resposta = await enviarParaKairos(base);
    } catch (e) {
      setFalha({ conversaId: conv.id, erro: msgErro(e, 'Falha ao obter resposta do KAIROS.') });
      setAguardandoIA(null);
      setEnviando(null);
      return;
    }
    setAguardandoIA(null);

    const agora = new Date().toISOString();
    const mensagens: KairosMensagem[] = [
      ...base,
      { role: 'assistant', content: resposta, ts: agora },
    ];
    atualizarConversaLocal(conv.id, { mensagens, atualizadoEm: agora });

    // Salva a troca na conta (cria a conversa na primeira mensagem).
    try {
      const atual = conversasRef.current.find(c => c.id === conv.id);
      const tituloFinal = atual?.titulo || titulo;
      if (conv.rascunho) {
        const criada = await store.criarConversa({ titulo: tituloFinal, mensagens });
        setConversas(prev =>
          prev.map(c =>
            c.id === conv.id
              ? {
                  ...c,
                  id: criada.id,
                  rascunho: false,
                  criadoEm: criada.criadoEm || c.criadoEm,
                  atualizadoEm: criada.atualizadoEm || agora,
                }
              : c
          )
        );
        setAtivaId(prev => (prev === conv.id ? criada.id : prev));
      } else {
        await store.atualizarConversa(
          conv.id,
          primeira ? { titulo: tituloFinal, mensagens } : { mensagens }
        );
      }
    } catch (e) {
      toast.error('A resposta chegou, mas não foi possível salvar a conversa.', {
        description: msgErro(e, ''),
      });
    } finally {
      setEnviando(null);
    }
  };

  // --------------------------------------------------------------- monitores
  const handleCriarMonitor = async (e: FormEvent) => {
    e.preventDefault();
    const descricao = novoMonitorTexto.trim();
    if (!descricao || !storeMon) return;
    try {
      const m = await storeMon.criarMonitor({
        titulo: 'Monitor customizado',
        descricao,
        ativo: true,
      });
      setMonitores(prev => [...prev, m]);
      setNovoMonitorTexto('');
      toast.success('Monitor criado.');
    } catch (err) {
      toast.error(msgErro(err, 'Não foi possível criar o monitor.'));
    }
  };

  const handleAlternarMonitor = async (m: KairosMonitor) => {
    if (!storeMon) return;
    const ativo = !m.ativo;
    setMonitores(prev => prev.map(x => (x.id === m.id ? { ...x, ativo } : x)));
    try {
      await storeMon.atualizarMonitor(m.id, { ativo });
    } catch (err) {
      setMonitores(prev => prev.map(x => (x.id === m.id ? { ...x, ativo: m.ativo } : x)));
      toast.error(msgErro(err, 'Não foi possível alterar o monitor.'));
    }
  };

  const handleExcluirMonitor = async (id: string) => {
    if (!storeMon) return;
    try {
      await storeMon.excluirMonitor(id);
      setMonitores(prev => prev.filter(x => x.id !== id));
      toast.success('Monitor excluído.');
    } catch (err) {
      toast.error(msgErro(err, 'Não foi possível excluir o monitor.'));
    }
  };

  // Varredura simulada (sem execução automática): registra a execução nos monitores ativos.
  const handleSimularVarredura = () => {
    if (scanning || !storeMon) return;
    setScanning(true);
    setScanLogs([]);
    const hora = new Date().toLocaleTimeString('pt-BR');
    const ativos = monitores.filter(m => m.ativo);
    const logs = [
      `[${hora}] 🔍 Iniciando varredura de sub-rotinas de IA...`,
      `[${hora}] ⚡ Monitorando ociosidade nos pontos de recarga...`,
      `[${hora}] ✔️ Analisados carregadores ativos. Nenhum ocioso > 48h.`,
      ...ativos.map(m => `[${hora}] ⚙️ Executando monitor customizado: "${m.descricao}"... OK.`),
      `[${hora}] 🎉 Varredura finalizada. Resultados salvos nos alertas.`,
    ];
    logs.forEach((l, i) => {
      setTimeout(() => {
        setScanLogs(prev => [...prev, l]);
        if (i < logs.length - 1) return;
        const quando = new Date().toISOString();
        const resultado = 'Status OK';
        setMonitores(prev =>
          prev.map(m =>
            m.ativo ? { ...m, ultimaExecucao: quando, ultimoResultado: resultado } : m
          )
        );
        void Promise.allSettled(
          ativos.map(m =>
            storeMon.atualizarMonitor(m.id, { ultimaExecucao: quando, ultimoResultado: resultado })
          )
        ).then(r => {
          if (r.some(x => x.status === 'rejected'))
            toast.error('Não foi possível registrar a varredura em todos os monitores.');
        });
        setScanning(false);
        toast.success('Varredura concluída sem alertas ativos.');
      }, i * 700);
    });
  };

  // ------------------------------------------------------------------ render
  const mensagens = ativa?.mensagens;
  const esperandoAqui = aguardandoIA === ativaId;
  const falhaAqui = falha?.conversaId === ativaId ? falha : null;
  const podeEnviar = !!store && !enviando && mensagens !== undefined;
  const modoLocal = store?.modo === 'local';

  const abaMovel = (v: VistaMovel, rotulo: string) => (
    <button
      key={v}
      onClick={() => setVistaMovel(v)}
      className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
        vistaMovel === v
          ? 'bg-primary text-on-primary'
          : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="fixed inset-y-0 right-0 left-0 lg:left-64 z-50 bg-background/95 lg:border-l border-sidebar-border/10 backdrop-blur-xl animate-in fade-in slide-in-from-right duration-300 flex flex-col p-3 sm:p-5 xl:p-6 font-sans overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center gap-3 pb-3 sm:pb-4 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(142,255,113,0.15)] shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-headline font-black text-lg text-on-surface tracking-wide leading-none">
              KAIROS IA
            </h2>
            <span className="text-[10px] text-on-surface-variant/80 mt-1 block truncate">
              {brandName
                ? `Painel Avançado e Assistente Virtual da ${brandName}`
                : 'Painel Avançado e Assistente Virtual'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Entre md e xl os monitores ficam numa gaveta */}
          <button
            onClick={() => setMonitoresAbertos(v => !v)}
            className={`hidden md:flex xl:hidden items-center gap-1.5 h-10 px-3 rounded-full border text-[11px] font-bold transition-colors ${
              monitoresAbertos
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-highest border-outline-variant/10 text-on-surface-variant hover:text-on-surface'
            }`}
            title="Monitores & Alertas"
          >
            <Activity className="w-4 h-4" />
            Monitores
            {monitores.some(m => m.ativo) && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-primary/20 text-[9px] flex items-center justify-center">
                {monitores.filter(m => m.ativo).length}
              </span>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant/10 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:scale-105 active:scale-95 transition-all"
            title="Fechar Painel KAIROS"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Abas do celular: uma coluna por vez */}
      <div className="md:hidden flex gap-1 p-1 mt-3 rounded-xl bg-surface-container/60 border border-outline-variant/10 shrink-0">
        {abaMovel('conversas', 'Conversas')}
        {abaMovel('chat', 'Chat')}
        {abaMovel('monitores', 'Monitores')}
      </div>

      {/* Colunas */}
      <div className="relative flex-1 min-h-0 flex gap-4 mt-3 sm:mt-4">
        {/* 1. Conversas */}
        <aside
          className={`${
            vistaMovel === 'conversas' ? 'flex' : 'hidden'
          } md:flex w-full md:w-56 xl:w-60 shrink-0 bg-surface-container/40 border border-outline-variant/10 rounded-2xl p-3 flex-col min-h-0`}
        >
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface-variant">
              Conversas recentes
            </h3>
            <button
              onClick={handleNovaConversa}
              className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
              title="Nova conversa"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 overflow-y-auto flex-1 min-h-0 -mr-1 pr-1">
            {!store && !erroLista && (
              <div className="flex items-center gap-2 text-[11px] text-on-surface-variant/60 p-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
              </div>
            )}
            {erroLista && (
              <div className="p-2.5 rounded-xl bg-error/10 border border-error/20 text-[11px] text-error space-y-2">
                <p>{erroLista}</p>
                <button
                  onClick={() => setRecarregar(n => n + 1)}
                  className="flex items-center gap-1 font-bold underline"
                >
                  <RotateCcw className="w-3 h-3" /> Tentar de novo
                </button>
              </div>
            )}
            {conversas.map(c => {
              const ativaItem = c.id === ativaId;
              const editando = c.id === editandoId;
              return (
                <div
                  key={c.id}
                  onClick={() => !editando && abrirConversa(c.id)}
                  className={`group p-2.5 rounded-xl border flex items-center justify-between gap-1 cursor-pointer transition-all ${
                    ativaItem
                      ? 'bg-surface-container-highest border-primary/30 text-primary'
                      : 'bg-transparent border-transparent text-on-surface-variant hover:bg-surface-container-highest/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {enviando === c.id ? (
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <MessageSquare
                        className={`w-4 h-4 shrink-0 ${ativaItem ? 'text-primary' : 'text-on-surface-variant/70'}`}
                      />
                    )}
                    {editando ? (
                      <input
                        type="text"
                        value={tituloEditado}
                        onChange={e => setTituloEditado(e.target.value)}
                        onBlur={() => void salvarTitulo(c.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void salvarTitulo(c.id);
                          if (e.key === 'Escape') setEditandoId(null);
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        maxLength={120}
                        className="bg-surface-container-low border border-primary/30 rounded px-1.5 py-0.5 text-xs text-on-surface focus:outline-none w-full"
                      />
                    ) : (
                      <span className="text-xs truncate font-semibold" title={c.titulo}>
                        {c.titulo}
                      </span>
                    )}
                  </div>
                  {!editando && (
                    <div className="flex items-center gap-0.5 shrink-0 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditandoId(c.id);
                          setTituloEditado(c.titulo);
                        }}
                        className="p-1 rounded text-on-surface-variant hover:text-foreground hover:bg-surface-container-highest"
                        title="Renomear"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          void handleExcluirConversa(c.id);
                        }}
                        className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error/15"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="text-[10px] text-center border-t border-outline-variant/5 pt-2.5 mt-2 shrink-0 flex items-center justify-center gap-1.5"
            title={
              modoLocal
                ? 'A sincronização com a sua conta ainda não está disponível. Estas conversas ficam salvas só neste navegador.'
                : 'As conversas ficam salvas na sua conta e só você as vê.'
            }
          >
            {modoLocal ? (
              <span className="flex items-center gap-1.5 text-amber-500/80">
                <HardDrive className="w-3 h-3" /> Salvas só neste navegador
              </span>
            ) : store ? (
              <span className="flex items-center gap-1.5 text-on-surface-variant/50">
                <Cloud className="w-3 h-3" /> Salvo na sua conta
              </span>
            ) : null}
          </div>
        </aside>

        {/* 2. Chat — coluna principal, nunca espremida */}
        <section
          className={`${
            vistaMovel === 'chat' ? 'flex' : 'hidden'
          } md:flex flex-1 min-w-0 md:min-w-[360px] bg-surface-container/40 border border-outline-variant/10 rounded-2xl flex-col min-h-0 overflow-hidden`}
        >
          <div className="px-4 py-2.5 border-b border-outline-variant/10 text-xs font-semibold text-on-surface truncate shrink-0">
            {ativa?.titulo || TITULO_PADRAO}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4">
            {carregandoConversa === ativaId && mensagens === undefined ? (
              <div className="flex items-center justify-center gap-2 text-xs text-on-surface-variant/60 py-10">
                <Loader2 className="w-4 h-4 animate-spin" /> Abrindo conversa...
              </div>
            ) : (
              <>
                {/* Saudação (não faz parte do histórico enviado à IA) */}
                {mensagens !== undefined && mensagens.length === 0 && (
                  <BolhaIA>
                    <KairosMarkdown texto={saudacao} />
                  </BolhaIA>
                )}

                {mensagens?.map((m, i) =>
                  m.role === 'assistant' ? (
                    <BolhaIA key={`${m.ts}-${i}`}>
                      <KairosMarkdown texto={m.content} />
                    </BolhaIA>
                  ) : (
                    <div
                      key={`${m.ts}-${i}`}
                      className="flex justify-end animate-in fade-in duration-200"
                    >
                      <div className="max-w-[88%] sm:max-w-[80%] p-3 rounded-2xl rounded-tr-none text-xs leading-relaxed whitespace-pre-wrap break-words bg-primary text-on-primary font-medium shadow-md shadow-primary/5">
                        {m.content}
                      </div>
                    </div>
                  )
                )}

                {esperandoAqui && (
                  <div className="flex justify-start animate-in fade-in duration-200">
                    <div className="flex gap-2.5 max-w-[88%]">
                      <AvatarIA pulsando />
                      <div className="flex flex-col">
                        <div className="bg-surface-container-highest border border-outline-variant/10 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: '150ms' }}
                          />
                          <span
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                        <span className="text-[10px] text-on-surface-variant/70 animate-pulse font-mono block mt-1 px-1">
                          KAIROS está {PASSOS_CARREGANDO[passo % PASSOS_CARREGANDO.length]}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {falhaAqui && (
                  <div className="flex justify-start animate-in fade-in duration-200">
                    <div className="flex gap-2.5 max-w-[88%]">
                      <div className="w-8 h-8 rounded-full bg-error/10 border border-error/20 flex items-center justify-center text-error shrink-0 self-end mb-1">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="p-3 rounded-2xl rounded-tl-none text-xs leading-relaxed bg-error/10 border border-error/20 text-on-surface space-y-2">
                        <p>
                          <strong className="font-bold">Não consegui responder.</strong>{' '}
                          {falhaAqui.erro}
                        </p>
                        <button
                          onClick={() => void enviar('', true)}
                          disabled={!!enviando}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/20 font-bold text-[11px] hover:border-primary/40 hover:text-primary disabled:opacity-40"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Tentar de novo
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={fimRef} />
          </div>

          {/* Sugestões */}
          {mensagens !== undefined && mensagens.length === 0 && !enviando && (
            <div className="px-3 sm:px-4 pt-3 pb-1 border-t border-outline-variant/5 shrink-0">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mb-2 px-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Perguntas frequentes
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGESTOES.map(s => (
                  <button
                    key={s.label}
                    onClick={() => void enviar(s.text)}
                    disabled={!podeEnviar}
                    className="px-3 py-2 rounded-xl bg-surface-container-highest/60 border border-outline-variant/10 text-[11px] text-on-surface-variant hover:text-primary hover:border-primary/20 transition-all text-left truncate disabled:opacity-40"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Campo de mensagem */}
          <form
            onSubmit={e => {
              e.preventDefault();
              void enviar(inputMessage);
            }}
            className="p-3 sm:p-4 border-t border-outline-variant/10 flex items-end gap-2 shrink-0"
          >
            <textarea
              ref={inputRef}
              rows={1}
              title="Enter envia · Shift+Enter quebra a linha"
              placeholder={
                enviando ? 'Aguardando a resposta do KAIROS...' : 'Pergunte ao KAIROS...'
              }
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void enviar(inputMessage);
                }
              }}
              disabled={!podeEnviar}
              maxLength={4000}
              className="flex-1 min-w-0 px-4 py-3 max-h-32 resize-none bg-surface-container-low border border-outline-variant/20 rounded-xl text-base sm:text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant/40 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || !podeEnviar}
              className="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-md shadow-primary/10 shrink-0"
              title="Enviar"
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </section>

        {/* Fundo da gaveta de monitores (md até xl) */}
        {monitoresAbertos && (
          <div
            className="hidden md:block xl:hidden absolute inset-0 z-10 rounded-2xl bg-black/40"
            onClick={() => setMonitoresAbertos(false)}
            aria-hidden="true"
          />
        )}

        {/* 3. Monitores: coluna no xl, gaveta entre md e xl, aba no celular */}
        <aside
          className={[
            'bg-surface-container xl:bg-surface-container/40 border border-outline-variant/10 rounded-2xl p-4 flex-col min-h-0 overflow-y-auto',
            vistaMovel === 'monitores' ? 'flex w-full' : 'hidden',
            monitoresAbertos
              ? 'md:flex md:absolute md:inset-y-0 md:right-0 md:w-80 md:z-20 md:shadow-2xl'
              : 'md:hidden',
            'xl:flex xl:static xl:w-72 xl:shrink-0 xl:shadow-none xl:z-auto',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface-variant">
                Monitores & Alertas
              </h3>
              <p className="text-[10px] text-on-surface-variant/70 mt-1 leading-normal">
                Rotinas que o KAIROS verifica quando você pede uma varredura.
              </p>
            </div>
            <button
              onClick={() => setMonitoresAbertos(false)}
              className="hidden md:block xl:hidden p-1 rounded text-on-surface-variant hover:text-on-surface"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5 mt-4">
            {monitores.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-6 px-4 border border-dashed border-outline-variant/10 rounded-xl">
                <Bot className="w-8 h-8 text-on-surface-variant/30 mb-2" />
                <p className="text-[10px] text-on-surface-variant/60 leading-normal">
                  {storeMon
                    ? 'Nenhum monitor ainda. Sugira uma rotina abaixo para começar.'
                    : 'Carregando monitores...'}
                </p>
              </div>
            ) : (
              monitores.map(m => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                    m.ativo
                      ? 'bg-surface-container-high/40 border-outline-variant/10'
                      : 'border-transparent opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-on-surface leading-none">{m.titulo}</h4>
                      <p className="text-[10px] text-on-surface-variant/75 mt-1.5 leading-normal break-words">
                        {m.descricao}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => void handleAlternarMonitor(m)}
                        className={`w-7 h-4 rounded-full p-0.5 transition-colors ${m.ativo ? 'bg-primary' : 'bg-surface-container-highest'}`}
                        title={m.ativo ? 'Desativar' : 'Ativar'}
                        role="switch"
                        aria-checked={m.ativo}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-zinc-950 transition-transform ${m.ativo ? 'translate-x-3' : 'translate-x-0'}`}
                        />
                      </button>
                      <button
                        onClick={() => void handleExcluirMonitor(m.id)}
                        className="p-1 rounded hover:bg-error/15 text-on-surface-variant hover:text-error transition-colors"
                        title="Remover monitor"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {m.ativo && (
                    <div className="pt-1.5 border-t border-outline-variant/5 flex items-center justify-between gap-2 text-[9px]">
                      <span className="text-on-surface-variant/60 font-medium">
                        Última: {formatarQuando(m.ultimaExecucao)}
                      </span>
                      {m.ultimoResultado ? (
                        <span className="flex items-center gap-1 font-bold text-emerald-400 truncate">
                          <Check className="w-2.5 h-2.5 shrink-0" /> {m.ultimoResultado}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/50 font-bold">
                          Aguardando varredura
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={e => void handleCriarMonitor(e)}
            className="pt-3 mt-3 border-t border-outline-variant/5 space-y-1.5"
          >
            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Sugerir rotina à IA
            </span>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Ex.: alerta se uma recarga falhar à noite"
                value={novoMonitorTexto}
                onChange={e => setNovoMonitorTexto(e.target.value)}
                maxLength={300}
                className="flex-1 min-w-0 px-2.5 py-1.5 bg-surface-container-low border border-outline-variant/15 rounded-lg text-[11px] text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant/40"
              />
              <button
                type="submit"
                disabled={!novoMonitorTexto.trim() || !storeMon}
                className="px-2.5 py-1.5 bg-primary text-on-primary font-bold rounded-lg flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 transition-all shrink-0"
                title="Criar monitor"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          <div className="space-y-2 mt-auto pt-3">
            <button
              onClick={handleSimularVarredura}
              disabled={scanning || !storeMon}
              className="w-full bg-primary text-on-primary py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Executando varredura...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" /> Simular Varredura de IA
                </>
              )}
            </button>
            {scanLogs.length > 0 && (
              <div className="p-2.5 bg-zinc-950/80 border border-outline-variant/10 rounded-lg max-h-28 overflow-y-auto font-mono text-[9px] text-zinc-300 space-y-0.5">
                {scanLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`leading-relaxed ${log.includes('✔️') ? 'text-emerald-400' : ''}`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            )}
            {storeMon?.modo === 'local' && (
              <p className="text-[9px] text-amber-500/80 text-center flex items-center justify-center gap-1">
                <HardDrive className="w-3 h-3" /> Monitores salvos só neste navegador
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

const AvatarIA = ({ pulsando = false }: { pulsando?: boolean }) => (
  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 self-end mb-1">
    <Bot className={`w-4 h-4 ${pulsando ? 'animate-pulse' : ''}`} />
  </div>
);

const BolhaIA = ({ children }: { children: ReactNode }) => (
  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
    <div className="flex gap-2.5 max-w-[92%] sm:max-w-[85%] min-w-0">
      <AvatarIA />
      <div className="min-w-0 p-3 rounded-2xl rounded-tl-none text-xs leading-relaxed bg-surface-container-highest text-on-surface border border-outline-variant/10">
        {children}
      </div>
    </div>
  </div>
);
