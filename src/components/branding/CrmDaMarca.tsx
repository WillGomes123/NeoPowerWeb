import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

/**
 * Integração de dados da marca por webhook (padrão Standard Webhooks): a cada
 * minuto a API manda para o endpoint da marca os eventos de clientes e de
 * recargas, assinados com o segredo combinado com ela. A marca também lê os
 * mesmos eventos pela API de consulta, com uma chave própria.
 *
 * O segredo fica cifrado na API e nunca volta para o painel (aqui aparece só o
 * final dele): o campo é só de escrita e vai no salvar apenas quando alguém
 * digita um novo. A chave da API de consulta aparece uma única vez, quando é
 * gerada, e fica só na memória desta tela.
 */

interface ResumoDoCiclo {
  gerados: number;
  entregues: number;
  retentar: number;
  erros: number;
  pausado: boolean;
}

interface ConfigWebhook {
  clientId: string;
  provider: string;
  existe: boolean;
  webhookUrl: string | null;
  segredo: { configurado: boolean; ultimos4: string | null; legivel: boolean };
  ativo: boolean;
  enviarDesde: string | null;
  chaveApi: { configurada: boolean; prefixo: string | null; criadaEm: string | null };
  ultimaSincronizacaoEm: string | null;
  ultimoResumo: ResumoDoCiclo | null;
  ultimoErro: string | null;
  atualizadoEm: string | null;
}

/** Corpo do PUT: só o que mudou. Nunca segredo e removerSegredo juntos. */
interface AlteracaoDoDestino {
  webhookUrl?: string | null;
  segredo?: string;
  removerSegredo?: boolean;
  ativo?: boolean;
  enviarDesde?: string | null;
}

interface StatusWebhook {
  ativo: boolean;
  ultimaSincronizacaoEm: string | null;
  ultimoResumo: ResumoDoCiclo | null;
  ultimoErro: string | null;
  eventos: Record<string, number>;
  ultimosErros: Array<{
    em: string;
    operacao: string;
    objeto: string | null;
    neopowerId: string | null;
    http: number | null;
    erro: string;
  }>;
  eventosComErro: Array<{
    eventoId: string;
    tipo: string;
    neopowerId: string;
    status: string;
    http: number | null;
    erro: string | null;
    tentativas: number;
    proximaTentativaEm: string | null;
    em: string;
  }>;
  chamadas24h: { total: number; comErro: number };
}

interface ResultadoDoTeste {
  ok: boolean;
  http: number | null;
  ms: number;
  detalhe: string;
}

interface ChaveGerada {
  chave: string;
  prefixo: string;
  aviso: string;
}

const STATUS_DOS_EVENTOS: Array<{ chave: string; rotulo: string }> = [
  { chave: 'pendente', rotulo: 'Na fila' },
  { chave: 'entregue', rotulo: 'Entregues' },
  { chave: 'retentar', rotulo: 'Em nova tentativa' },
  { chave: 'erro', rotulo: 'Com erro' },
  { chave: 'descartado', rotulo: 'Descartados' },
];

const TIPOS_DE_EVENTO = [
  'cliente.cadastrado',
  'cliente.atualizado',
  'cliente.excluido',
  'recarga.concluida',
  'recarga.cancelada',
  'recarga.estornada',
];

const dataHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dataBR = (iso: string) => iso.split('-').reverse().join('/');

const campo = 'bg-surface-container-low border-outline-variant/20 text-on-surface h-10 text-sm';
const rotulo = 'text-on-surface-variant text-xs uppercase tracking-widest';
const titulo = 'text-on-surface-variant text-xs uppercase tracking-widest font-bold';
const botaoPrincipal =
  'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60';
const botaoSecundario =
  'inline-flex items-center gap-2 rounded-lg bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-50';

async function erroDaResposta(resp: Response, padrao: string): Promise<string> {
  const corpo = (await resp.json().catch(() => null)) as {
    error?: string;
    message?: string;
    details?: Array<{ message?: string }>;
  } | null;
  const mensagem = corpo?.error || corpo?.message || padrao;
  // Erro de validação: a mensagem útil vem nos detalhes (ex.: "Use AAAA-MM-DD.").
  const detalhes = (corpo?.details ?? [])
    .map(d => d.message)
    .filter(Boolean)
    .join(' ');
  return detalhes ? `${mensagem}: ${detalhes}` : mensagem;
}

/**
 * Base da API como a marca a chama: a mesma que o painel usa (VITE_API_URL,
 * ver lib/api.ts). Relativa ('/api' no dev, atrás do proxy do Vite), vale a
 * origem da página.
 */
function baseDaApi(): string {
  const api = String(import.meta.env?.VITE_API_URL ?? '/api')
    .trim()
    .replace(/\/+$/, '');
  if (/^https?:\/\//i.test(api)) return api;
  return `${window.location.origin}${api.startsWith('/') ? api : `/${api}`}`;
}

function copiar(texto: string, aviso: string) {
  // Sem HTTPS (ou sem permissão) o navegador não expõe a área de transferência.
  if (!navigator.clipboard) {
    toast.error('Não foi possível copiar');
    return;
  }
  navigator.clipboard
    .writeText(texto)
    .then(() => toast.success(aviso))
    .catch(() => toast.error('Não foi possível copiar'));
}

export function CrmDaMarca({ clientId }: { clientId: string }) {
  const [cfg, setCfg] = useState<ConfigWebhook | null>(null);
  const [status, setStatus] = useState<StatusWebhook | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [marcaNaoSalva, setMarcaNaoSalva] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);
  const [mexendoNaChave, setMexendoNaChave] = useState(false);
  const [chaveNova, setChaveNova] = useState<ChaveGerada | null>(null);

  const [url, setUrl] = useState('');
  const [segredo, setSegredo] = useState('');
  const [ativo, setAtivo] = useState(false);
  const [enviarDesde, setEnviarDesde] = useState('');

  const [reprocDesde, setReprocDesde] = useState('');
  const [reprocAte, setReprocAte] = useState(hojeISO());
  const [reprocessando, setReprocessando] = useState(false);

  const base = `/admin/crm/${encodeURIComponent(clientId)}`;

  /** Formulário igual ao salvo. O segredo nunca volta: o campo fica vazio. */
  const aplicar = useCallback((dados: ConfigWebhook) => {
    setCfg(dados);
    setUrl(dados.webhookUrl ?? '');
    setSegredo('');
    setAtivo(dados.ativo);
    setEnviarDesde(dados.enviarDesde ?? '');
  }, []);

  const carregarStatus = useCallback(async () => {
    if (!clientId) return;
    setAtualizando(true);
    try {
      const resp = await api.get(`${base}/status`);
      if (resp.ok) setStatus((await resp.json()) as StatusWebhook);
    } catch {
      // o status é complementar: a configuração continua editável
    } finally {
      setAtualizando(false);
    }
  }, [base, clientId]);

  const carregar = useCallback(async () => {
    if (!clientId) return;
    setCarregando(true);
    // Outra marca (ou nova tentativa): nada da anterior fica na tela, nem a chave.
    setStatus(null);
    setTeste(null);
    setChaveNova(null);
    try {
      const resp = await api.get(base);
      // 404: marca nova, ainda não salva na aba Identidade
      setMarcaNaoSalva(resp.status === 404);
      if (resp.status === 404) {
        setCfg(null);
        return;
      }
      if (!resp.ok)
        throw new Error(await erroDaResposta(resp, 'Não foi possível carregar a integração'));
      const dados = (await resp.json()) as ConfigWebhook;
      aplicar(dados);
      setReprocDesde(dados.enviarDesde ?? '');
      void carregarStatus();
    } catch (e) {
      toast.error((e as Error).message);
      setCfg(null);
    } finally {
      setCarregando(false);
    }
  }, [aplicar, base, carregarStatus, clientId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Só o que mudou em relação ao salvo; o segredo, só quando alguém digitou um novo. */
  const alteracoes = (salvo: ConfigWebhook): AlteracaoDoDestino => {
    const corpo: AlteracaoDoDestino = {};
    const urlNova = url.trim();
    if (urlNova !== (salvo.webhookUrl ?? '')) corpo.webhookUrl = urlNova || null;
    const segredoNovo = segredo.trim();
    if (segredoNovo) corpo.segredo = segredoNovo;
    if (ativo !== salvo.ativo) corpo.ativo = ativo;
    if (enviarDesde !== (salvo.enviarDesde ?? '')) corpo.enviarDesde = enviarDesde || null;
    return corpo;
  };

  const salvar = async () => {
    if (!cfg) return;
    const corpo = alteracoes(cfg);
    if (Object.keys(corpo).length === 0) {
      toast.info('Nada mudou para salvar.');
      return;
    }
    setSalvando(true);
    try {
      const resp = await api.put(base, corpo);
      if (!resp.ok) throw new Error(await erroDaResposta(resp, 'Não foi possível salvar'));
      const dados = (await resp.json()) as ConfigWebhook & { aviso?: string | null };
      aplicar(dados);
      setTeste(null);
      toast.success('Integração salva');
      if (dados.aviso) toast.warning(dados.aviso, { duration: 10000 });
      void carregarStatus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const removerSegredo = async () => {
    if (
      !window.confirm(
        'Remover o segredo da assinatura? A integração é desligada e nenhum evento sai até cadastrar outro segredo.'
      )
    )
      return;
    setSalvando(true);
    try {
      // Só o pedido de remoção: um segredo digitado não vai junto.
      const resp = await api.put(base, { removerSegredo: true } satisfies AlteracaoDoDestino);
      if (!resp.ok)
        throw new Error(await erroDaResposta(resp, 'Não foi possível remover o segredo'));
      const dados = (await resp.json()) as ConfigWebhook;
      // Mantém a URL e a data que estiverem sendo editadas; só o salvo muda.
      setCfg(dados);
      setAtivo(dados.ativo);
      setSegredo('');
      setTeste(null);
      toast.success('Segredo removido. A integração foi desligada.');
      void carregarStatus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    setTestando(true);
    setTeste(null);
    try {
      // Sem URL ou segredo no corpo, a API usa os salvos.
      const corpo: { webhookUrl?: string; segredo?: string } = {};
      if (url.trim()) corpo.webhookUrl = url.trim();
      if (segredo.trim()) corpo.segredo = segredo.trim();
      const resp = await api.post(`${base}/testar`, corpo);
      if (!resp.ok) throw new Error(await erroDaResposta(resp, 'Não foi possível enviar o teste'));
      const r = (await resp.json()) as ResultadoDoTeste;
      setTeste(r);
      if (r.ok) toast.success('Teste entregue');
      else toast.error('O destino não aceitou o teste: veja o resultado');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTestando(false);
    }
  };

  const gerarChave = async () => {
    if (
      cfg?.chaveApi.configurada &&
      !window.confirm(
        'Trocar a chave da API de consulta? A chave atual deixa de valer na hora: a marca precisa passar a usar a nova.'
      )
    )
      return;
    setMexendoNaChave(true);
    try {
      const resp = await api.post(`${base}/chave-api`, {});
      if (!resp.ok) throw new Error(await erroDaResposta(resp, 'Não foi possível gerar a chave'));
      const r = (await resp.json()) as ChaveGerada;
      setChaveNova(r);
      setCfg(c =>
        c
          ? {
              ...c,
              chaveApi: {
                configurada: true,
                prefixo: r.prefixo,
                criadaEm: new Date().toISOString(),
              },
            }
          : c
      );
      toast.success('Chave gerada');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMexendoNaChave(false);
    }
  };

  const revogarChave = async () => {
    if (
      !window.confirm(
        'Revogar a chave da API de consulta? A marca perde o acesso à consulta até receber uma chave nova.'
      )
    )
      return;
    setMexendoNaChave(true);
    try {
      const resp = await api.delete(`${base}/chave-api`);
      if (!resp.ok) throw new Error(await erroDaResposta(resp, 'Não foi possível revogar a chave'));
      setChaveNova(null);
      setCfg(c =>
        c ? { ...c, chaveApi: { configurada: false, prefixo: null, criadaEm: null } } : c
      );
      toast.success('Chave revogada');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMexendoNaChave(false);
    }
  };

  const reprocessar = async () => {
    if (!reprocDesde || !reprocAte) {
      toast.error('Informe o período.');
      return;
    }
    if (reprocDesde > reprocAte) {
      toast.error('A data inicial deve ser antes da final.');
      return;
    }
    if (
      !window.confirm(
        `Gerar de novo os eventos dos clientes e das recargas de ${dataBR(reprocDesde)} a ${dataBR(reprocAte)}? Cada evento traz o registro completo: o destino atualiza pelo id do registro.`
      )
    )
      return;
    setReprocessando(true);
    try {
      const resp = await api.post(`${base}/reprocessar`, { desde: reprocDesde, ate: reprocAte });
      if (!resp.ok) throw new Error(await erroDaResposta(resp, 'Não foi possível reprocessar'));
      const r = (await resp.json()) as { negocios: number; contatos: number; aviso: string };
      toast.success(`${r.negocios} recarga(s) e ${r.contatos} cliente(s) na fila. ${r.aviso}`);
      await carregarStatus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReprocessando(false);
    }
  };

  if (!clientId || marcaNaoSalva) {
    return (
      <p className="text-sm text-on-surface-variant">
        Salve a marca primeiro para configurar a integração de dados.
      </p>
    );
  }
  if (carregando && !cfg) {
    return <p className="text-sm text-on-surface-variant">Carregando…</p>;
  }
  if (!cfg) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-on-surface-variant">
          Não foi possível carregar a integração desta marca.
        </p>
        <button type="button" onClick={() => void carregar()} className={botaoSecundario}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const segredoSalvo = cfg.segredo.configurado;
  const acompanhamento = status ?? cfg;
  const resumo = acompanhamento.ultimoResumo;
  const ultimoErro = acompanhamento.ultimoErro;
  const apiBase = baseDaApi();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className={titulo}>Integração de dados (webhook)</p>
        <p className="text-xs text-on-surface-variant leading-relaxed max-w-[620px]">
          A cada minuto, os cadastros de clientes do app desta marca e as recargas encerradas vão
          como <b>eventos assinados</b> para o endereço da marca (padrão Standard Webhooks). A marca
          também consulta os mesmos eventos pela <b>API de consulta</b>, com uma chave própria.
          Clientes de outras marcas (recarga cruzada) e visitantes do QR Code não vão como cliente:
          a recarga vai sem dados pessoais (LGPD). Recarga em andamento não vai.
        </p>
      </div>

      {/* 1. Destino */}
      <section className="space-y-4">
        <p className={titulo}>Destino</p>

        <div className="space-y-1.5 max-w-[520px]">
          <Label htmlFor="webhookUrl" className={rotulo}>
            URL do webhook
          </Label>
          <Input
            id="webhookUrl"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className={`${campo} font-mono`}
          />
          <p className="text-on-surface-variant text-xs leading-relaxed">
            Endereço https da marca que recebe os eventos. Trocar de endereço (ex.: homologação →
            produção) recomeça o envio do zero a partir da data de início e descarta o que estava na
            fila para o endereço anterior.
          </p>
        </div>

        <div className="space-y-1.5 max-w-[520px]">
          <Label htmlFor="webhookSegredo" className={rotulo}>
            Segredo da assinatura
          </Label>
          <Input
            id="webhookSegredo"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            placeholder="whsec_..."
            value={segredo}
            onChange={e => setSegredo(e.target.value)}
            className={`${campo} font-mono`}
          />
          <p className="text-xs">
            {!segredoSalvo ? (
              <span className="text-on-surface-variant">Não configurado</span>
            ) : !cfg.segredo.legivel ? (
              <span className="text-error">
                Ilegível (a chave de cifra mudou), cadastre de novo
              </span>
            ) : (
              <span className="text-on-surface">Configurado · final {cfg.segredo.ultimos4}</span>
            )}
          </p>
          <p className="text-on-surface-variant text-xs leading-relaxed">
            “whsec_” seguido de base64, combinado com a marca por canal seguro. Depois de salvo, não
            é exibido de novo: deixe vazio para manter o atual. Trocar o segredo põe de volta na
            fila o que o destino recusou por assinatura (401/403).
            {segredoSalvo && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => void removerSegredo()}
                  disabled={salvando}
                  className="font-semibold text-error hover:underline disabled:opacity-50"
                >
                  Remover segredo
                </button>
              </>
            )}
          </p>
        </div>

        <div className="space-y-1.5 max-w-[220px]">
          <Label htmlFor="webhookDesde" className={rotulo}>
            Enviar desde
          </Label>
          <Input
            id="webhookDesde"
            type="date"
            value={enviarDesde}
            onChange={e => setEnviarDesde(e.target.value)}
            className={campo}
          />
        </div>
        <p className="text-on-surface-variant text-xs leading-relaxed max-w-[620px] -mt-2">
          Cadastros e recargas encerradas a partir desta data. Use a data em que os eletropostos da
          marca entraram em operação, para não mandar recargas de teste.
        </p>

        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20 max-w-[520px]">
          <Switch id="webhookAtivo" checked={ativo} onCheckedChange={v => setAtivo(v)} />
          <div className="space-y-1">
            <label
              htmlFor="webhookAtivo"
              className="text-sm font-bold leading-none text-on-surface cursor-pointer"
            >
              Ativo
            </label>
            <p className="text-on-surface-variant text-xs">
              Envia os eventos desta marca. Para ligar, informe a URL, o segredo e a data de início.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className={botaoPrincipal}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              save
            </span>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => void testar()}
            disabled={testando || !url.trim()}
            className={botaoSecundario}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              send
            </span>
            {testando ? 'Enviando…' : 'Enviar teste'}
          </button>
        </div>

        {teste && (
          <div
            className={`rounded-lg border p-3 space-y-1 max-w-[620px] ${
              teste.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-error/30 bg-error/5'
            }`}
          >
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-on-surface">
              <span
                className={`material-symbols-outlined text-base ${teste.ok ? 'text-emerald-500' : 'text-error'}`}
                aria-hidden="true"
              >
                {teste.ok ? 'check_circle' : 'cancel'}
              </span>
              {teste.ok ? 'Teste entregue' : 'Teste falhou'}
              <span className="font-normal text-on-surface-variant">
                HTTP {teste.http ?? '—'} · {teste.ms} ms
              </span>
            </p>
            <p className="text-xs text-on-surface break-words">{teste.detalhe}</p>
            <p className="text-[11px] text-on-surface-variant">
              O teste manda um evento “teste.ping” assinado, sem gravar nada. Usa a URL e o segredo
              digitados agora ou, sem segredo digitado, o salvo.
            </p>
          </div>
        )}
      </section>

      {/* 2. API de consulta */}
      <section className="space-y-3 border-t border-outline-variant/10 pt-5">
        <p className={titulo}>API de consulta</p>
        <p className="text-xs text-on-surface-variant leading-relaxed max-w-[620px]">
          A marca lê os eventos de um período (para conferir ou recuperar o que perdeu) com uma
          chave própria, no mesmo formato do webhook.
        </p>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-high/40 p-4">
          <span
            className={`material-symbols-outlined text-xl ${cfg.chaveApi.configurada ? 'text-emerald-500' : 'text-on-surface-variant'}`}
            aria-hidden="true"
          >
            key
          </span>
          <div className="text-sm flex-1 min-w-[200px]">
            {cfg.chaveApi.configurada ? (
              <>
                <p className="font-semibold text-on-surface">Chave ativa</p>
                <p className="text-on-surface-variant">
                  Começa com <code className="font-mono">{cfg.chaveApi.prefixo}…</code> · criada em{' '}
                  {dataHora(cfg.chaveApi.criadaEm)}
                </p>
              </>
            ) : (
              <p className="font-semibold text-on-surface">Nenhuma chave gerada</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void gerarChave()}
              disabled={mexendoNaChave}
              className={botaoSecundario}
            >
              {cfg.chaveApi.configurada ? 'Trocar chave' : 'Gerar chave'}
            </button>
            {cfg.chaveApi.configurada && (
              <button
                type="button"
                onClick={() => void revogarChave()}
                disabled={mexendoNaChave}
                className="text-xs font-semibold text-error hover:underline disabled:opacity-50"
              >
                Revogar
              </button>
            )}
          </div>
        </div>

        {chaveNova && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 max-w-[620px]">
            <p className="text-xs font-semibold text-on-surface">{chaveNova.aviso}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs text-on-surface font-mono break-all flex-1 min-w-[240px]">
                {chaveNova.chave}
              </code>
              <button
                type="button"
                onClick={() => copiar(chaveNova.chave, 'Chave copiada')}
                className="rounded-md bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-on-surface"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => setChaveNova(null)}
                className="rounded-md bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-on-surface"
              >
                Já guardei
              </button>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-surface-container-high p-3 space-y-2 text-xs text-on-surface-variant leading-relaxed max-w-[620px]">
          <code className="block font-mono text-on-surface break-all">
            GET {apiBase}/integracao/v1/clientes
          </code>
          <code className="block font-mono text-on-surface break-all">
            GET {apiBase}/integracao/v1/recargas
          </code>
          <p>
            Parâmetros: <code className="font-mono">?desde=&amp;ate=&amp;apos=&amp;limite=</code>.
            “desde” (obrigatório) e “ate” em ISO 8601, data sozinha em UTC (sem “ate”, até agora);
            “apos” é o “proximo” da página anterior; “limite” de 1 a 500 (padrão 100).
          </p>
          <p>
            Cabeçalho: <code className="font-mono">Authorization: Bearer npk_...</code>
          </p>
          <p>
            Resposta:{' '}
            <code className="font-mono">
              {'{ dados: [{ id, type, timestamp, data }], proximo }'}
            </code>
            . “proximo” vem preenchido quando há mais páginas.
          </p>
        </div>
      </section>

      {/* 3. Acompanhamento */}
      <section className="space-y-4 border-t border-outline-variant/10 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className={titulo}>Acompanhamento</p>
          <button
            type="button"
            onClick={() => void carregarStatus()}
            disabled={atualizando}
            className="rounded-md bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-on-surface disabled:opacity-50"
          >
            {atualizando ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            ultimoErro
              ? 'border-amber-500/30 bg-amber-500/5'
              : cfg.ativo
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-outline-variant/20 bg-surface-container-high/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`material-symbols-outlined text-xl ${
                ultimoErro
                  ? 'text-amber-500'
                  : cfg.ativo
                    ? 'text-emerald-500'
                    : 'text-on-surface-variant'
              }`}
              aria-hidden="true"
            >
              {ultimoErro ? 'warning' : cfg.ativo ? 'sync' : 'sync_disabled'}
            </span>
            <div className="text-sm flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-on-surface">
                {cfg.ativo ? 'Integração ligada' : 'Integração desligada'}
              </p>
              <p className="text-on-surface-variant">
                Última sincronização: {dataHora(acompanhamento.ultimaSincronizacaoEm)}
              </p>
              {resumo && (
                <p className="text-on-surface-variant">
                  Último ciclo: {resumo.gerados} gerado(s), {resumo.entregues} entregue(s),{' '}
                  {resumo.retentar} em nova tentativa, {resumo.erros} com erro
                  {resumo.pausado && ' · pausado por falhas seguidas (segue no próximo ciclo)'}
                </p>
              )}
              {ultimoErro && (
                <p className="text-amber-600 dark:text-amber-400 break-words">
                  Último erro: {ultimoErro}
                </p>
              )}
              {status && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-xs text-on-surface-variant">
                  {STATUS_DOS_EVENTOS.map(s => (
                    <span key={s.chave}>
                      {s.rotulo}: {status.eventos[s.chave] ?? 0}
                    </span>
                  ))}
                  <span>
                    Chamadas nas últimas 24 h: {status.chamadas24h.total}
                    {status.chamadas24h.comErro > 0 && ` (${status.chamadas24h.comErro} com erro)`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-on-surface">
            Eventos com erro ou em nova tentativa
          </p>
          {!status || status.eventosComErro.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Nenhum evento com erro.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
              <table className="w-full text-xs">
                <thead className="bg-surface-container-high text-on-surface-variant">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Evento</th>
                    <th className="text-left px-3 py-2 font-semibold">Situação</th>
                    <th className="text-left px-3 py-2 font-semibold">HTTP</th>
                    <th className="text-left px-3 py-2 font-semibold">Erro</th>
                    <th className="text-left px-3 py-2 font-semibold">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {status.eventosComErro.map(ev => (
                    <tr key={ev.eventoId} className="border-t border-outline-variant/10 align-top">
                      <td className="px-3 py-2 text-on-surface whitespace-nowrap">
                        {ev.tipo} #{ev.neopowerId}
                        <span className="block font-mono text-[10px] text-on-surface-variant">
                          {ev.eventoId}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant whitespace-nowrap">
                        {ev.status === 'retentar'
                          ? `nova tentativa ${dataHora(ev.proximaTentativaEm)}`
                          : 'erro, sem nova tentativa'}
                        <span className="block text-[10px]">{ev.tentativas} tentativa(s)</span>
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant">{ev.http ?? '—'}</td>
                      <td className="px-3 py-2 text-on-surface break-words max-w-[320px]">
                        {ev.erro ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant whitespace-nowrap">
                        {dataHora(ev.em)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {status && status.ultimosErros.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-on-surface-variant font-semibold">
                Erros recentes de chamada ({status.ultimosErros.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {status.ultimosErros.map((e, i) => (
                  <li key={i} className="text-on-surface-variant break-words">
                    {dataHora(e.em)} · {e.operacao.replace(/^webhook:/, '')}
                    {e.neopowerId ? ` #${e.neopowerId}` : ''} · HTTP {e.http ?? '—'} ·{' '}
                    <span className="text-on-surface">{e.erro}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-on-surface">Reprocessar período</p>
          <p className="text-xs text-on-surface-variant leading-relaxed max-w-[620px]">
            Gera de novo os eventos das recargas encerradas no período e dos clientes da marca
            (cadastrados no período ou donos dessas recargas). Use depois de corrigir uma falha do
            lado da marca.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="reprocDesde" className={rotulo}>
                De
              </Label>
              <Input
                id="reprocDesde"
                type="date"
                value={reprocDesde}
                onChange={e => setReprocDesde(e.target.value)}
                className={`${campo} w-[170px]`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reprocAte" className={rotulo}>
                Até
              </Label>
              <Input
                id="reprocAte"
                type="date"
                value={reprocAte}
                onChange={e => setReprocAte(e.target.value)}
                className={`${campo} w-[170px]`}
              />
            </div>
            <button
              type="button"
              onClick={() => void reprocessar()}
              disabled={reprocessando || !cfg.existe}
              className={`${botaoSecundario} h-10 py-0`}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                replay
              </span>
              {reprocessando ? 'Enfileirando…' : 'Reprocessar'}
            </button>
          </div>
        </div>
      </section>

      {/* 4. Ajuda */}
      <section className="space-y-2 border-t border-outline-variant/10 pt-5">
        <p className={titulo}>Ajuda</p>
        <ul className="text-xs text-on-surface-variant leading-relaxed list-disc pl-5 space-y-1 max-w-[620px]">
          <li>
            <b>Eventos:</b>{' '}
            {TIPOS_DE_EVENTO.map((t, i) => (
              <span key={t}>
                {i > 0 && ', '}
                <code className="font-mono">{t}</code>
              </span>
            ))}
            .
          </li>
          <li>
            <b>Cabeçalhos:</b> <code className="font-mono">webhook-id</code> (o mesmo em todas as
            tentativas: serve para descartar repetidos),{' '}
            <code className="font-mono">webhook-timestamp</code> (segundos) e{' '}
            <code className="font-mono">webhook-signature</code> (
            <code className="font-mono">v1,</code> + HMAC-SHA256 em base64 de{' '}
            <code className="font-mono">id.timestamp.corpo</code>).
          </li>
          <li>
            <b>Tentativas:</b> 2xx é entrega. 408, 429, 5xx ou sem resposta tentam de novo em 1 min,
            5 min, 30 min, 2 h, 6 h, 12 h, 24 h e 24 h. Os demais 4xx são recusa definitiva, sem
            repetir: corrija e use “Reprocessar período”.
          </li>
          <li>
            <b>Tempo limite:</b> 15 s por chamada.
          </li>
        </ul>
      </section>
    </div>
  );
}
