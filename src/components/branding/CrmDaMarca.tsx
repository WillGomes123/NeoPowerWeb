import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';

/**
 * Integração com o CRM (HubSpot) da marca: a cada minuto a API grava no
 * HubSpot do cliente os contatos (clientes do app da marca) e as compras de
 * recarga (negócios no pipeline "Recargas"). O token do app privado do
 * HubSpot fica cifrado na API e nunca volta para o painel — aqui só aparece
 * se há token e o final dele.
 */

type Estagio = 'concluida' | 'cancelada' | 'estornada';

interface ConfigCrm {
  clientId: string;
  existe: boolean;
  token: { configurado: boolean; ultimos4: string | null; legivel: boolean };
  pipelineId: string | null;
  estagios: Record<Estagio, string | null>;
  ativo: boolean;
  enviarDesde: string | null;
  ultimaSincronizacaoEm: string | null;
  atualizadoEm: string | null;
}

interface Contagem {
  enviado?: number;
  retentar?: number;
  erro?: number;
  ignorado?: number;
  pendente?: number;
}

interface ResumoDoCiclo {
  contatos: Contagem;
  negocios: Contagem;
  associacoes: { ok: number; pendente: number; erro: number };
  abortado: string | null;
}

interface StatusCrm {
  ativo: boolean;
  ultimaSincronizacaoEm: string | null;
  ultimoResumo: ResumoDoCiclo | null;
  ultimoErro: string | null;
  contagens: { contato: Contagem; negocio: Contagem };
  associacoes: Record<string, number>;
  ultimosErros: Array<{
    em: string;
    operacao: string;
    objeto: string | null;
    neopowerId: string | null;
    http: number | null;
    erro: string;
  }>;
  registrosComErro: Array<{
    objeto: string;
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
  hubId: number | null;
  verificacoes: Array<{ nome: string; ok: boolean | null; http: number; detalhe: string }>;
}

const ESTAGIOS: Array<{ chave: Estagio; rotulo: string; ajuda: string }> = [
  { chave: 'concluida', rotulo: 'Concluída', ajuda: 'recarga com energia entregue' },
  { chave: 'cancelada', rotulo: 'Cancelada', ajuda: 'encerrada sem energia' },
  { chave: 'estornada', rotulo: 'Estornada', ajuda: 'estorno total ou parcial' },
];

const OPERACOES: Record<string, string> = {
  contatos_upsert: 'Contato',
  negocios_upsert: 'Negócio',
  associacao: 'Associação',
  contato_busca_email: 'Busca por e-mail',
  contato_por_email: 'Contato pelo e-mail',
};

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

const campo = 'bg-surface-container-low border-outline-variant/20 text-on-surface h-10 text-sm';
const rotulo = 'text-on-surface-variant text-xs uppercase tracking-widest';

async function erroDaResposta(resp: Response, padrao: string): Promise<string> {
  const corpo = await resp.json().catch(() => null);
  return (corpo && (corpo.error || corpo.message)) || padrao;
}

export function CrmDaMarca({ clientId }: { clientId: string }) {
  const [cfg, setCfg] = useState<ConfigCrm | null>(null);
  const [status, setStatus] = useState<StatusCrm | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [marcaNaoSalva, setMarcaNaoSalva] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);

  const [token, setToken] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [estagios, setEstagios] = useState<Record<Estagio, string>>({
    concluida: '',
    cancelada: '',
    estornada: '',
  });
  const [ativo, setAtivo] = useState(false);
  const [enviarDesde, setEnviarDesde] = useState('');

  const [reprocDesde, setReprocDesde] = useState('');
  const [reprocAte, setReprocAte] = useState(hojeISO());
  const [reprocessando, setReprocessando] = useState(false);

  const base = `/admin/crm/${encodeURIComponent(clientId)}`;

  const carregarStatus = useCallback(async () => {
    if (!clientId) return;
    try {
      const resp = await api.get(`${base}/status`);
      if (resp.ok) setStatus((await resp.json()) as StatusCrm);
    } catch {
      // o status é complementar: a configuração continua editável
    }
  }, [base, clientId]);

  const carregar = useCallback(async () => {
    if (!clientId) return;
    setCarregando(true);
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
      const dados = (await resp.json()) as ConfigCrm;
      setCfg(dados);
      setToken('');
      setPipelineId(dados.pipelineId ?? '');
      setEstagios({
        concluida: dados.estagios.concluida ?? '',
        cancelada: dados.estagios.cancelada ?? '',
        estornada: dados.estagios.estornada ?? '',
      });
      setAtivo(dados.ativo);
      setEnviarDesde(dados.enviarDesde ?? '');
      setReprocDesde(prev => prev || dados.enviarDesde || '');
    } catch (e) {
      toast.error((e as Error).message);
      setCfg(null);
    } finally {
      setCarregando(false);
    }
  }, [base, clientId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (cfg) void carregarStatus();
  }, [cfg, carregarStatus]);

  const salvar = async (extra: Record<string, unknown> = {}) => {
    setSalvando(true);
    try {
      const resp = await api.put(base, {
        ...(token.trim() ? { token: token.trim() } : {}),
        pipelineId: pipelineId.trim() || null,
        estagios: {
          concluida: estagios.concluida.trim() || null,
          cancelada: estagios.cancelada.trim() || null,
          estornada: estagios.estornada.trim() || null,
        },
        ativo,
        enviarDesde: enviarDesde || null,
        ...extra,
      });
      if (!resp.ok) throw new Error(await erroDaResposta(resp, 'Não foi possível salvar'));
      toast.success('Integração salva');
      setTeste(null);
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const removerToken = async () => {
    if (
      !window.confirm(
        'Remover o token desta marca? A integração é desligada e nada mais vai para o HubSpot até cadastrar outro.'
      )
    )
      return;
    setAtivo(false);
    await salvar({ removerToken: true, ativo: false });
  };

  const testar = async () => {
    setTestando(true);
    setTeste(null);
    try {
      const resp = await api.post(`${base}/testar`, {
        ...(token.trim() ? { token: token.trim() } : {}),
        pipelineId: pipelineId.trim() || null,
        estagios: {
          concluida: estagios.concluida.trim() || null,
          cancelada: estagios.cancelada.trim() || null,
          estornada: estagios.estornada.trim() || null,
        },
      });
      if (!resp.ok) throw new Error(await erroDaResposta(resp, 'Não foi possível testar'));
      const r = (await resp.json()) as ResultadoDoTeste;
      setTeste(r);
      if (r.ok) toast.success('Conexão com o HubSpot ok');
      else toast.error('A conexão tem pendências: veja o resultado do teste');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTestando(false);
    }
  };

  const reprocessar = async () => {
    if (!reprocDesde || !reprocAte) {
      toast.error('Informe o período.');
      return;
    }
    if (
      !window.confirm(
        `Reenviar ao HubSpot todos os clientes e compras de ${reprocDesde.split('-').reverse().join('/')} a ${reprocAte.split('-').reverse().join('/')}? O envio é por upsert: nada é duplicado.`
      )
    )
      return;
    setReprocessando(true);
    try {
      const resp = await api.post(`${base}/reprocessar`, { desde: reprocDesde, ate: reprocAte });
      if (!resp.ok) throw new Error(await erroDaResposta(resp, 'Não foi possível reprocessar'));
      const r = (await resp.json()) as { negocios: number; contatos: number; aviso: string };
      toast.success(`${r.negocios} compra(s) e ${r.contatos} cliente(s) na fila. ${r.aviso}`);
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
        Salve a marca primeiro para configurar a integração com o CRM.
      </p>
    );
  }
  if (carregando && !cfg) {
    return <p className="text-sm text-on-surface-variant">Carregando…</p>;
  }

  const tokenSalvo = !!cfg?.token.configurado;
  const resumo = status?.ultimoResumo ?? null;
  const erroGeral = status?.ultimoErro ?? null;
  const conta = (c: Contagem | undefined, k: keyof Contagem) => c?.[k] ?? 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">
          Integração com o CRM (HubSpot)
        </p>
        <p className="text-xs text-on-surface-variant leading-relaxed max-w-[620px]">
          A cada minuto, os clientes do app desta marca vão como <b>contatos</b> e cada recarga
          encerrada vai como <b>negócio</b> no pipeline “Recargas”, associado ao contato. Clientes
          de outras marcas (recarga cruzada) e visitantes do QR Code vão só como negócio, sem dados
          pessoais (LGPD). Recarga em andamento não vai.
        </p>
      </div>

      {/* Situação */}
      <div
        className={`rounded-xl border p-4 ${
          erroGeral
            ? 'border-amber-500/30 bg-amber-500/5'
            : cfg?.ativo
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-outline-variant/20 bg-surface-container-high/40'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`material-symbols-outlined text-xl ${
              erroGeral
                ? 'text-amber-500'
                : cfg?.ativo
                  ? 'text-emerald-500'
                  : 'text-on-surface-variant'
            }`}
          >
            {erroGeral ? 'warning' : cfg?.ativo ? 'sync' : 'sync_disabled'}
          </span>
          <div className="text-sm flex-1 min-w-0 space-y-1">
            <p className="font-semibold text-on-surface">
              {cfg?.ativo ? 'Integração ligada' : 'Integração desligada'}
            </p>
            <p className="text-on-surface-variant">
              Última sincronização: {dataHora(status?.ultimaSincronizacaoEm ?? null)}
              {resumo && (
                <>
                  {' '}
                  · {conta(resumo.contatos, 'enviado')} contato(s) e{' '}
                  {conta(resumo.negocios, 'enviado')} negócio(s) enviados
                  {conta(resumo.contatos, 'retentar') + conta(resumo.negocios, 'retentar') > 0 &&
                    `, ${conta(resumo.contatos, 'retentar') + conta(resumo.negocios, 'retentar')} para nova tentativa`}
                </>
              )}
            </p>
            {erroGeral && (
              <p className="text-amber-600 dark:text-amber-400 break-words">{erroGeral}</p>
            )}
            {status && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-xs text-on-surface-variant">
                <span>
                  Contatos:{' '}
                  <b className="text-on-surface">{conta(status.contagens.contato, 'enviado')}</b> no
                  HubSpot
                  {conta(status.contagens.contato, 'erro') > 0 &&
                    ` · ${conta(status.contagens.contato, 'erro')} com erro`}
                </span>
                <span>
                  Negócios:{' '}
                  <b className="text-on-surface">{conta(status.contagens.negocio, 'enviado')}</b> no
                  HubSpot
                  {conta(status.contagens.negocio, 'erro') > 0 &&
                    ` · ${conta(status.contagens.negocio, 'erro')} com erro`}
                  {conta(status.contagens.negocio, 'retentar') > 0 &&
                    ` · ${conta(status.contagens.negocio, 'retentar')} aguardando nova tentativa`}
                </span>
                <span>
                  Chamadas nas últimas 24 h: {status.chamadas24h.total}
                  {status.chamadas24h.comErro > 0 && ` (${status.chamadas24h.comErro} com erro)`}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void carregarStatus()}
            className="rounded-md bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-on-surface shrink-0"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Configuração */}
      <div className="space-y-4">
        <div className="space-y-1.5 max-w-[460px]">
          <Label className={rotulo}>Token do app privado</Label>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={
              tokenSalvo
                ? `Token salvo (…${cfg?.token.ultimos4 ?? ''}). Deixe vazio para manter`
                : 'pat-na1-…'
            }
            value={token}
            onChange={e => setToken(e.target.value)}
            className={`${campo} font-mono`}
          />
          {cfg && !cfg.token.legivel && (
            <p className="text-xs text-error">
              O token salvo não pode ser lido (a chave de cifra mudou). Cadastre o token de novo.
            </p>
          )}
          <p className="text-on-surface-variant text-xs leading-relaxed">
            Criado pela marca no HubSpot (Configurações › Integrações › Apps privados) com os
            escopos <code>crm.objects.contacts.read/write</code> e{' '}
            <code>crm.objects.deals.read/write</code>. Recebido por canal seguro; depois de salvo,
            não é exibido de novo.
            {tokenSalvo && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => void removerToken()}
                  disabled={salvando}
                  className="font-semibold text-error hover:underline"
                >
                  Remover token
                </button>
              </>
            )}
          </p>
        </div>

        <div className="space-y-1.5 max-w-[300px]">
          <Label className={rotulo}>ID do pipeline “Recargas”</Label>
          <Input
            placeholder="ex.: 123456789"
            value={pipelineId}
            onChange={e => setPipelineId(e.target.value)}
            className={`${campo} font-mono`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ESTAGIOS.map(e => (
            <div key={e.chave} className="space-y-1.5">
              <Label className={rotulo}>Estágio {e.rotulo}</Label>
              <Input
                placeholder="ID do estágio"
                value={estagios[e.chave]}
                onChange={ev => setEstagios({ ...estagios, [e.chave]: ev.target.value })}
                className={`${campo} font-mono`}
              />
              <p className="text-on-surface-variant text-[11px]">{e.ajuda}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 max-w-[220px]">
          <Label className={rotulo}>Enviar a partir de</Label>
          <Input
            type="date"
            value={enviarDesde}
            onChange={e => setEnviarDesde(e.target.value)}
            className={campo}
          />
        </div>
        <p className="text-on-surface-variant text-xs leading-relaxed max-w-[620px] -mt-2">
          Início da carga histórica: recargas encerradas e cadastros a partir desta data. Use a data
          em que os eletropostos da marca entraram em operação, para não mandar recargas de teste.
        </p>

        <div className="flex items-center space-x-3 p-4 bg-primary/5 rounded-xl border border-primary/20 max-w-[460px]">
          <Checkbox
            id="crmAtivo"
            checked={ativo}
            onCheckedChange={v => setAtivo(!!v)}
            className="data-[state=checked]:bg-primary data-[state=checked]:text-on-primary"
          />
          <label
            htmlFor="crmAtivo"
            className="text-sm font-bold leading-none text-on-surface cursor-pointer"
          >
            Enviar para o HubSpot desta marca
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {salvando ? 'Salvando…' : 'Salvar integração'}
          </button>
          <button
            type="button"
            onClick={() => void testar()}
            disabled={testando || (!token.trim() && !tokenSalvo)}
            className="inline-flex items-center gap-2 rounded-lg bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">network_check</span>
            {testando ? 'Testando…' : 'Testar conexão'}
          </button>
        </div>

        {teste && (
          <div className="rounded-lg bg-surface-container-high p-3 space-y-2 max-w-[620px]">
            <p className="text-sm font-semibold text-on-surface">
              {teste.ok ? 'Conexão ok' : 'Conexão com pendências'}
              {teste.hubId != null && (
                <span className="font-normal text-on-surface-variant">
                  {' '}
                  · conta HubSpot {teste.hubId}
                </span>
              )}
            </p>
            <ul className="space-y-1.5">
              {teste.verificacoes.map(v => (
                <li key={v.nome} className="flex items-start gap-2 text-xs">
                  <span
                    className={`material-symbols-outlined text-base ${
                      v.ok === true
                        ? 'text-emerald-500'
                        : v.ok === false
                          ? 'text-error'
                          : 'text-on-surface-variant'
                    }`}
                  >
                    {v.ok === true ? 'check_circle' : v.ok === false ? 'cancel' : 'help'}
                  </span>
                  <span className="text-on-surface">
                    <b>{v.nome}</b>
                    <span className="text-on-surface-variant"> — {v.detalhe}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-on-surface-variant">
              O teste só lê: nada é gravado no HubSpot. Ele usa o token digitado agora ou, vazio, o
              salvo.
            </p>
          </div>
        )}
      </div>

      {/* Reprocessar */}
      <div className="space-y-2 border-t border-outline-variant/10 pt-5">
        <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">
          Reprocessar período
        </p>
        <p className="text-xs text-on-surface-variant leading-relaxed max-w-[620px]">
          Reenvia todas as compras encerradas no período e os clientes da marca (cadastrados no
          período ou donos dessas compras). Use depois de corrigir uma falha. O envio é por upsert:
          reenviar atualiza, não duplica.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className={rotulo}>De</Label>
            <Input
              type="date"
              value={reprocDesde}
              onChange={e => setReprocDesde(e.target.value)}
              className={`${campo} w-[170px]`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={rotulo}>Até</Label>
            <Input
              type="date"
              value={reprocAte}
              onChange={e => setReprocAte(e.target.value)}
              className={`${campo} w-[170px]`}
            />
          </div>
          <button
            type="button"
            onClick={() => void reprocessar()}
            disabled={reprocessando || !cfg?.existe}
            className="inline-flex items-center gap-2 rounded-lg bg-surface-container-highest px-4 h-10 text-sm font-semibold text-on-surface disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">replay</span>
            {reprocessando ? 'Enfileirando…' : 'Reprocessar'}
          </button>
        </div>
      </div>

      {/* Erros */}
      <div className="space-y-3 border-t border-outline-variant/10 pt-5">
        <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">
          Registros com erro
        </p>
        {!status || status.registrosComErro.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhum registro com erro.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
            <table className="w-full text-xs">
              <thead className="bg-surface-container-high text-on-surface-variant">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Registro</th>
                  <th className="text-left px-3 py-2 font-semibold">Situação</th>
                  <th className="text-left px-3 py-2 font-semibold">HTTP</th>
                  <th className="text-left px-3 py-2 font-semibold">Erro</th>
                  <th className="text-left px-3 py-2 font-semibold">Quando</th>
                </tr>
              </thead>
              <tbody>
                {status.registrosComErro.map(r => (
                  <tr
                    key={`${r.objeto}-${r.neopowerId}`}
                    className="border-t border-outline-variant/10 align-top"
                  >
                    <td className="px-3 py-2 text-on-surface whitespace-nowrap">
                      {r.objeto === 'contato' ? 'Cliente' : 'Recarga'} #{r.neopowerId}
                    </td>
                    <td className="px-3 py-2 text-on-surface-variant whitespace-nowrap">
                      {r.status === 'retentar'
                        ? `nova tentativa ${dataHora(r.proximaTentativaEm)}`
                        : r.status === 'erro'
                          ? 'erro (sem nova tentativa)'
                          : 'associação com erro'}
                    </td>
                    <td className="px-3 py-2 text-on-surface-variant">{r.http ?? '—'}</td>
                    <td className="px-3 py-2 text-on-surface break-words max-w-[320px]">
                      {r.erro ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-on-surface-variant whitespace-nowrap">
                      {dataHora(r.em)}
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
              Últimas chamadas com erro ({status.ultimosErros.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {status.ultimosErros.map((e, i) => (
                <li key={i} className="text-on-surface-variant">
                  {dataHora(e.em)} · {OPERACOES[e.operacao] ?? e.operacao}
                  {e.neopowerId ? ` #${e.neopowerId}` : ''} · HTTP {e.http ?? '—'} ·{' '}
                  <span className="text-on-surface">{e.erro}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="text-[11px] text-on-surface-variant max-w-[620px]">
          Limite de uso e HubSpot fora do ar são repetidos sozinhos, com espera crescente. Os demais
          erros (campo inválido, token sem permissão) ficam aqui e por e-mail, sem repetir: corrija
          e use “Reprocessar período”. Trocar o token reenvia o que parou por permissão.
        </p>
      </div>
    </div>
  );
}
