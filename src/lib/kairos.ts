// Camada de dados do KAIROS: conversas, monitores e a chamada ao chat.
//
// As conversas e os monitores ficam na conta do usuário (rotas /kairos/conversas
// e /kairos/monitores, isoladas por usuário na API). Enquanto a API não tiver
// essas rotas (404), cai num armazenamento local isolado por usuário e marca —
// nunca nas chaves fixas antigas, que misturavam contas no mesmo navegador.
import { api, fetchWithAuth } from './api';

export interface KairosMensagem {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

export interface KairosConversaResumo {
  id: string;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
  totalMensagens: number;
}

export interface KairosConversa {
  id: string;
  titulo: string;
  mensagens: KairosMensagem[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface KairosMonitor {
  id: string;
  titulo: string;
  descricao: string;
  ativo: boolean;
  ultimaExecucao: string | null;
  ultimoResultado: string | null;
  criadoEm: string;
}

/** Chaves antigas, compartilhadas por todas as contas do navegador. */
const CHAVES_LEGADAS = ['kairos_sessions', 'kairos_subroutines'];

export const apagarChavesLegadas = () => {
  try {
    CHAVES_LEGADAS.forEach(k => localStorage.removeItem(k));
  } catch {
    /* localStorage indisponível: nada a limpar */
  }
};

/** Erro com a mensagem que a API devolveu (ou uma genérica pelo status). */
export class KairosErro extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const mensagemDoStatus = (status: number) => {
  if (status === 403) return 'Você não tem permissão para usar o KAIROS.';
  if (status === 404) return 'Recurso não encontrado.';
  if (status === 429) return 'Muitas requisições. Aguarde um pouco e tente de novo.';
  if (status >= 500) return 'O servidor do KAIROS está com problemas. Tente de novo em instantes.';
  return `Erro inesperado (HTTP ${status}).`;
};

const lerErro = async (res: Response): Promise<KairosErro> => {
  let msg = '';
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown } | null;
    const e = body?.error ?? body?.message;
    if (typeof e === 'string') msg = e;
    else if (
      e &&
      typeof e === 'object' &&
      typeof (e as { message?: unknown }).message === 'string'
    ) {
      msg = (e as { message: string }).message;
    }
  } catch {
    /* corpo vazio ou não-JSON */
  }
  return new KairosErro(msg || mensagemDoStatus(res.status), res.status);
};

const jsonOuErro = async <T>(res: Response): Promise<T> => {
  if (!res.ok) throw await lerErro(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

// ---------------------------------------------------------------------------
// Armazenamento
// ---------------------------------------------------------------------------

export interface KairosStore {
  modo: 'servidor' | 'local';
  listarConversas(): Promise<KairosConversaResumo[]>;
  obterConversa(id: string): Promise<KairosConversa>;
  criarConversa(dados: { titulo?: string; mensagens?: KairosMensagem[] }): Promise<KairosConversa>;
  atualizarConversa(
    id: string,
    dados: { titulo?: string; mensagens?: KairosMensagem[] }
  ): Promise<KairosConversa>;
  excluirConversa(id: string): Promise<void>;
  listarMonitores(): Promise<KairosMonitor[]>;
  criarMonitor(dados: {
    titulo: string;
    descricao: string;
    ativo?: boolean;
  }): Promise<KairosMonitor>;
  atualizarMonitor(
    id: string,
    dados: Partial<Omit<KairosMonitor, 'id' | 'criadoEm'>>
  ): Promise<KairosMonitor>;
  excluirMonitor(id: string): Promise<void>;
}

export const storeServidor: KairosStore = {
  modo: 'servidor',
  listarConversas: async () => {
    const lista = await jsonOuErro<KairosConversaResumo[]>(await api.get('/kairos/conversas'));
    return Array.isArray(lista) ? lista : [];
  },
  obterConversa: async id => {
    const c = await jsonOuErro<KairosConversa>(
      await api.get(`/kairos/conversas/${encodeURIComponent(id)}`)
    );
    return { ...c, mensagens: Array.isArray(c.mensagens) ? c.mensagens : [] };
  },
  criarConversa: async dados =>
    jsonOuErro<KairosConversa>(await api.post('/kairos/conversas', dados)),
  atualizarConversa: async (id, dados) =>
    jsonOuErro<KairosConversa>(await api.put(`/kairos/conversas/${encodeURIComponent(id)}`, dados)),
  excluirConversa: async id => {
    await jsonOuErro<unknown>(await api.delete(`/kairos/conversas/${encodeURIComponent(id)}`));
  },
  listarMonitores: async () => {
    const lista = await jsonOuErro<KairosMonitor[]>(await api.get('/kairos/monitores'));
    return Array.isArray(lista) ? lista : [];
  },
  criarMonitor: async dados =>
    jsonOuErro<KairosMonitor>(await api.post('/kairos/monitores', dados)),
  atualizarMonitor: async (id, dados) =>
    jsonOuErro<KairosMonitor>(await api.put(`/kairos/monitores/${encodeURIComponent(id)}`, dados)),
  excluirMonitor: async id => {
    await jsonOuErro<unknown>(await api.delete(`/kairos/monitores/${encodeURIComponent(id)}`));
  },
};

/**
 * Armazenamento no navegador, isolado por usuário e marca:
 * `kairos_sessions:<userId>:<clientId|plataforma>`.
 * Sem usuário identificado, fica só em memória (não grava nada).
 */
export const criarStoreLocal = (
  userId: string | number | null | undefined,
  clientId: string | null | undefined
): KairosStore => {
  const escopo = userId != null && userId !== '' ? `${userId}:${clientId || 'plataforma'}` : null;
  const chaveConversas = escopo ? `kairos_sessions:${escopo}` : null;
  const chaveMonitores = escopo ? `kairos_monitores:${escopo}` : null;
  const memoria: Record<string, unknown> = {};

  const ler = <T>(chave: string, padrao: T): T => {
    try {
      const bruto = localStorage.getItem(chave);
      if (!bruto) return padrao;
      const v = JSON.parse(bruto) as T;
      return Array.isArray(padrao) && !Array.isArray(v) ? padrao : v;
    } catch {
      return padrao;
    }
  };
  const gravar = (chave: string, valor: unknown) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* cota cheia / modo privado: segue só em memória */
    }
  };
  // Em memória (sem usuário) cada coleção tem seu próprio slot.
  const conversas = (): KairosConversa[] =>
    chaveConversas
      ? ler<KairosConversa[]>(chaveConversas, [])
      : ((memoria.conversas as KairosConversa[]) ?? []);
  const salvarConversas = (l: KairosConversa[]) =>
    chaveConversas ? gravar(chaveConversas, l) : (memoria.conversas = l);
  const monitores = (): KairosMonitor[] =>
    chaveMonitores
      ? ler<KairosMonitor[]>(chaveMonitores, [])
      : ((memoria.monitores as KairosMonitor[]) ?? []);
  const salvarMonitores = (l: KairosMonitor[]) =>
    chaveMonitores ? gravar(chaveMonitores, l) : (memoria.monitores = l);
  const novoId = (p: string) =>
    `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const agora = () => new Date().toISOString();

  return {
    modo: 'local',
    listarConversas: () =>
      Promise.resolve(
        conversas()
          .map(c => ({
            id: c.id,
            titulo: c.titulo,
            criadoEm: c.criadoEm,
            atualizadoEm: c.atualizadoEm,
            totalMensagens: c.mensagens?.length ?? 0,
          }))
          .sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''))
      ),
    obterConversa: id => {
      const c = conversas().find(x => x.id === id);
      return c
        ? Promise.resolve(c)
        : Promise.reject(new KairosErro('Conversa não encontrada.', 404));
    },
    criarConversa: dados => {
      const c: KairosConversa = {
        id: novoId('conv'),
        titulo: dados.titulo || 'Nova conversa',
        mensagens: dados.mensagens ?? [],
        criadoEm: agora(),
        atualizadoEm: agora(),
      };
      salvarConversas([c, ...conversas()]);
      return Promise.resolve(c);
    },
    atualizarConversa: (id, dados) => {
      const lista = conversas();
      const i = lista.findIndex(x => x.id === id);
      if (i < 0) return Promise.reject(new KairosErro('Conversa não encontrada.', 404));
      const c: KairosConversa = {
        ...lista[i],
        ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
        ...(dados.mensagens !== undefined ? { mensagens: dados.mensagens } : {}),
        atualizadoEm: agora(),
      };
      lista[i] = c;
      salvarConversas(lista);
      return Promise.resolve(c);
    },
    excluirConversa: id => {
      salvarConversas(conversas().filter(x => x.id !== id));
      return Promise.resolve();
    },
    listarMonitores: () => Promise.resolve(monitores()),
    criarMonitor: dados => {
      const m: KairosMonitor = {
        id: novoId('mon'),
        titulo: dados.titulo,
        descricao: dados.descricao,
        ativo: dados.ativo ?? true,
        ultimaExecucao: null,
        ultimoResultado: null,
        criadoEm: agora(),
      };
      salvarMonitores([...monitores(), m]);
      return Promise.resolve(m);
    },
    atualizarMonitor: (id, dados) => {
      const lista = monitores();
      const i = lista.findIndex(x => x.id === id);
      if (i < 0) return Promise.reject(new KairosErro('Monitor não encontrado.', 404));
      lista[i] = { ...lista[i], ...dados };
      salvarMonitores(lista);
      return Promise.resolve(lista[i]);
    },
    excluirMonitor: id => {
      salvarMonitores(monitores().filter(x => x.id !== id));
      return Promise.resolve();
    },
  };
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** Tempo máximo de espera pela resposta (a IA pode rodar ferramentas e chamar o modelo 2x). */
export const KAIROS_TIMEOUT_MS = 90_000;

interface ParteGemini {
  text?: string;
}
interface ConteudoGemini {
  role?: string;
  parts?: ParteGemini[];
}

/**
 * Envia a conversa (só as mensagens de texto) e devolve o texto da resposta.
 *
 * - Sem retry automático: repetir o POST poderia executar de novo uma ação da IA
 *   (ex.: mudar tarifa) — o usuário decide se tenta de novo.
 * - Timeout próprio, com mensagem clara.
 * - Lê `text` do envelope; se vier vazio, procura o último texto do modelo no
 *   `history` (a API às vezes grava `parts: [{ text: undefined }]`).
 */
export const enviarParaKairos = async (mensagens: KairosMensagem[]): Promise<string> => {
  // O Gemini exige que a conversa comece pelo usuário e alterne os papéis.
  const history: ConteudoGemini[] = [];
  for (const m of mensagens) {
    const texto = m.content?.trim();
    if (!texto) continue;
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (history.length === 0 && role !== 'user') continue;
    const ultimo = history[history.length - 1];
    if (ultimo && ultimo.role === role) {
      ultimo.parts = [{ text: `${ultimo.parts?.[0]?.text ?? ''}\n\n${texto}` }];
    } else {
      history.push({ role, parts: [{ text: texto }] });
    }
  }
  if (history.length === 0) throw new KairosErro('Escreva uma pergunta para o KAIROS.', 400);

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), KAIROS_TIMEOUT_MS);
  let res: Response;
  try {
    // retryCount = 3 (o máximo do cliente) desliga o retry automático do fetchWithAuth.
    res = await fetchWithAuth(
      '/kairos/chat',
      { method: 'POST', body: JSON.stringify({ history }), signal: controle.signal },
      3
    );
  } catch (e) {
    if (controle.signal.aborted) {
      throw new KairosErro('O KAIROS demorou demais para responder. Tente de novo.', 408);
    }
    if (e instanceof Error && e.message === 'Unauthorized')
      throw new KairosErro('Sua sessão expirou.', 401);
    throw new KairosErro('Sem conexão com o servidor. Verifique sua internet e tente de novo.', 0);
  } finally {
    clearTimeout(timer);
  }

  const data = await jsonOuErro<{ text?: unknown; history?: ConteudoGemini[] } | null>(res);
  let texto = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!texto && Array.isArray(data?.history)) {
    for (let i = data.history.length - 1; i >= 0 && !texto; i--) {
      const c = data.history[i];
      if (c?.role !== 'model') continue;
      texto = (c.parts ?? [])
        .map(p => (typeof p?.text === 'string' ? p.text : ''))
        .join('')
        .trim();
    }
  }
  if (!texto)
    throw new KairosErro(
      'O KAIROS não devolveu nenhuma resposta. Tente reformular a pergunta.',
      502
    );
  return texto;
};

const PALAVRAS_TITULO: [RegExp, string][] = [
  [/tarifa|preço|valor|dinheiro|receber|kwh/, 'Tarifas e faturamento'],
  [/carregador|posto|estação|eletroposto|cadastrar/, 'Cadastro de posto'],
  [/voucher|cupom|desconto/, 'Cupons e vouchers'],
  [/fluxo|como funciona|operação/, 'Dúvidas de operação'],
  [/erro|alerta|problema/, 'Suporte do sistema'],
];

export const tituloDaPergunta = (texto: string): string => {
  const lower = texto.toLowerCase();
  for (const [re, titulo] of PALAVRAS_TITULO) if (re.test(lower)) return titulo;
  const limpo = texto
    .replace(/[#*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const palavras = limpo.split(' ');
  const t = palavras.length <= 5 ? limpo : `${palavras.slice(0, 5).join(' ')}…`;
  return t.length > 60 ? `${t.slice(0, 59)}…` : t || 'Nova conversa';
};
