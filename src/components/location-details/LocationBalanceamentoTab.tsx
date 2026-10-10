import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Activity,
  AlertTriangle,
  Copy,
  Gauge,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DESCRICAO_DO_MODO,
  ROTULO_DAS_FASES,
  ROTULO_DO_MODO,
  ROTULO_DO_PONTO,
  atualizarMedidor,
  cadastrarMedidor,
  carregarBalanceamento,
  carregarDecisoes,
  carregarStatus,
  excluirMedidor,
  formatarA,
  formatarLimite,
  gerarNovoToken,
  haQuanto,
  numeroDoCampo,
  revogarToken,
  salvarConfig,
  salvarMapeamento,
  textoDoEnvio,
  type CarregadorDoBalanceamento,
  type DecisaoDoBalanceamento,
  type Fase,
  type FasesDoCarregador,
  type MedidorDoSite,
  type ModoBalanceamento,
  type PontoDeMedicao,
  type StatusDoBalanceamento,
  type TokenGerado,
  type VisaoDoBalanceamento,
} from '@/lib/balanceamento';

interface Props {
  locationId: number;
}

const ATUALIZAR_STATUS_MS = 5_000;
const ATUALIZAR_REGISTRO_MS = 30_000;
const FASES: Fase[] = ['L1', 'L2', 'L3'];
const MODOS: ModoBalanceamento[] = ['desligado', 'observar', 'ativo'];

const classeDoSelect =
  'w-full bg-background border border-input rounded-md px-3 h-9 text-sm focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-60';

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

const dataHora = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), 'dd/MM HH:mm:ss', { locale: ptBR }) : '—';

/** Executa a ação só com a aba visível (o painel aberto num canto não gasta a cota da API). */
function useIntervaloVisivel(acao: () => Promise<void>, ms: number) {
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void acao();
    }, ms);
    return () => window.clearInterval(id);
  }, [acao, ms]);
}

// ---------------------------------------------------------------------------
// Formulários (texto nos campos, número ao salvar)
// ---------------------------------------------------------------------------

interface FormLimites {
  medidorId: string;
  limitePorFaseA: string;
  margemA: string;
  limitePotenciaKw: string;
  correnteMinimaA: string;
  limiteSeguroA: string;
  intervaloEnvioS: string;
  histereseA: string;
}

const textoDe = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));

function formDaConfig(v: VisaoDoBalanceamento): FormLimites {
  const c = v.config;
  return {
    medidorId: c.medidorId == null ? '' : String(c.medidorId),
    limitePorFaseA: textoDe(c.limitePorFaseA),
    margemA: textoDe(c.margemA),
    limitePotenciaKw: textoDe(c.limitePotenciaKw),
    correnteMinimaA: textoDe(c.correnteMinimaA),
    limiteSeguroA: textoDe(c.limiteSeguroA),
    intervaloEnvioS: textoDe(c.intervaloEnvioS),
    histereseA: textoDe(c.histereseA),
  };
}

interface LinhaMapeamento {
  chargePointId: string;
  participa: boolean;
  fases: FasesDoCarregador;
  correnteMaxA: string;
  unidade: 'A' | 'W';
  prioridade: string;
  carregador: CarregadorDoBalanceamento;
}

function mapeamentoDaVisao(v: VisaoDoBalanceamento): LinhaMapeamento[] {
  return v.carregadores.map(c => ({
    chargePointId: c.chargePointId,
    participa: c.mapeado ? c.participa : false,
    fases: c.fases,
    correnteMaxA: textoDe(c.correnteMaxA),
    unidade: c.unidade,
    prioridade: textoDe(c.prioridade),
    carregador: c,
  }));
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function LocationBalanceamentoTab({ locationId }: Props) {
  const [visao, setVisao] = useState<VisaoDoBalanceamento | null>(null);
  const [status, setStatus] = useState<StatusDoBalanceamento | null>(null);
  const [decisoes, setDecisoes] = useState<DecisaoDoBalanceamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<FormLimites | null>(null);
  const [mapeamento, setMapeamento] = useState<LinhaMapeamento[]>([]);
  const [salvando, setSalvando] = useState<'config' | 'mapa' | 'modo' | 'medidor' | null>(null);

  const [novoMedidor, setNovoMedidor] = useState({
    identificador: '',
    nome: '',
    pontoDeMedicao: 'entrada_total' as PontoDeMedicao,
    fases: 3 as 1 | 3,
  });
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [tokenGerado, setTokenGerado] = useState<TokenGerado | null>(null);
  const [confirmarModo, setConfirmarModo] = useState<ModoBalanceamento | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<MedidorDoSite | null>(null);
  const [agora, setAgora] = useState(Date.now());

  const podeEditar = !!visao?.permissoes.podeEditarLimites;
  const podeAtivar = !!visao?.permissoes.podeAtivar;

  const carregarTudo = useCallback(async () => {
    try {
      const [v, s, d] = await Promise.all([
        carregarBalanceamento(locationId),
        carregarStatus(locationId),
        carregarDecisoes(locationId),
      ]);
      setVisao(v);
      setStatus(s);
      setDecisoes(d);
      setForm(formDaConfig(v));
      setMapeamento(mapeamentoDaVisao(v));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o balanceamento.');
    } finally {
      setCarregando(false);
    }
  }, [locationId]);

  const atualizarStatus = useCallback(async () => {
    try {
      setStatus(await carregarStatus(locationId));
      setAgora(Date.now());
    } catch {
      // Falha passageira: o próximo ciclo tenta de novo.
    }
  }, [locationId]);

  const atualizarRegistro = useCallback(async () => {
    try {
      setDecisoes(await carregarDecisoes(locationId));
    } catch {
      // idem
    }
  }, [locationId]);

  useEffect(() => {
    void carregarTudo();
  }, [carregarTudo]);
  useIntervaloVisivel(atualizarStatus, ATUALIZAR_STATUS_MS);
  useIntervaloVisivel(atualizarRegistro, ATUALIZAR_REGISTRO_MS);

  // Só recarrega a visão (sem perder o que está sendo digitado nos outros formulários).
  const recarregarVisao = useCallback(async () => {
    const v = await carregarBalanceamento(locationId);
    setVisao(v);
    return v;
  }, [locationId]);

  // ---------------- modo ----------------

  const pedirModo = (modo: ModoBalanceamento) => {
    if (!visao || modo === visao.config.modo) return;
    if (modo === 'ativo' || visao.config.modo === 'ativo') setConfirmarModo(modo);
    else void trocarModo(modo);
  };

  const trocarModo = async (modo: ModoBalanceamento) => {
    setSalvando('modo');
    try {
      await salvarConfig(locationId, { modo });
      toast.success(`Balanceamento: modo ${ROTULO_DO_MODO[modo].toLowerCase()}`);
      await recarregarVisao();
      await Promise.all([atualizarStatus(), atualizarRegistro()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível trocar o modo.');
    } finally {
      setSalvando(null);
      setConfirmarModo(null);
    }
  };

  // ---------------- limites ----------------

  const salvarLimites = async () => {
    if (!form) return;
    const numeros = {
      limitePorFaseA: numeroDoCampo(form.limitePorFaseA),
      margemA: numeroDoCampo(form.margemA),
      limitePotenciaKw: numeroDoCampo(form.limitePotenciaKw),
      correnteMinimaA: numeroDoCampo(form.correnteMinimaA),
      limiteSeguroA: numeroDoCampo(form.limiteSeguroA),
      intervaloEnvioS: numeroDoCampo(form.intervaloEnvioS),
      histereseA: numeroDoCampo(form.histereseA),
    };
    if (Object.values(numeros).some(n => Number.isNaN(n))) {
      toast.error('Confira os números: use só dígitos e vírgula.');
      return;
    }
    if (
      numeros.correnteMinimaA == null ||
      numeros.limiteSeguroA == null ||
      numeros.intervaloEnvioS == null ||
      numeros.histereseA == null
    ) {
      toast.error('Corrente mínima, limite seguro, intervalo e histerese são obrigatórios.');
      return;
    }
    setSalvando('config');
    try {
      await salvarConfig(locationId, {
        medidorId: form.medidorId ? Number(form.medidorId) : null,
        limitePorFaseA: numeros.limitePorFaseA,
        margemA: numeros.margemA,
        limitePotenciaKw: numeros.limitePotenciaKw,
        correnteMinimaA: numeros.correnteMinimaA,
        limiteSeguroA: numeros.limiteSeguroA,
        intervaloEnvioS: numeros.intervaloEnvioS,
        histereseA: numeros.histereseA,
      });
      toast.success('Limites salvos');
      const v = await recarregarVisao();
      setForm(formDaConfig(v));
      await atualizarStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar os limites.');
    } finally {
      setSalvando(null);
    }
  };

  // ---------------- mapeamento ----------------

  const salvarCarregadores = async () => {
    const itens = mapeamento.filter(m => m.participa || m.carregador.mapeado);
    const lista = [];
    for (const m of itens) {
      const corrente = numeroDoCampo(m.correnteMaxA);
      const prioridade = numeroDoCampo(m.prioridade);
      if (corrente == null || Number.isNaN(corrente) || corrente <= 0) {
        toast.error(`${m.chargePointId}: informe a corrente máxima (A por fase).`);
        return;
      }
      if (Number.isNaN(prioridade) || (prioridade != null && !Number.isInteger(prioridade))) {
        toast.error(`${m.chargePointId}: a prioridade é um número inteiro (ou vazia).`);
        return;
      }
      lista.push({
        chargePointId: m.chargePointId,
        fases: m.fases,
        correnteMaxA: corrente,
        unidade: m.unidade,
        prioridade,
        participa: m.participa,
      });
    }
    setSalvando('mapa');
    try {
      await salvarMapeamento(locationId, lista);
      toast.success('Ligação dos carregadores salva');
      const v = await recarregarVisao();
      setMapeamento(mapeamentoDaVisao(v));
      await atualizarStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar os carregadores.');
    } finally {
      setSalvando(null);
    }
  };

  const mudarLinha = (cp: string, mudanca: Partial<LinhaMapeamento>) =>
    setMapeamento(linhas => linhas.map(l => (l.chargePointId === cp ? { ...l, ...mudanca } : l)));

  // ---------------- medidores ----------------

  const cadastrar = async () => {
    const identificador = novoMedidor.identificador.trim();
    if (!/^[A-Za-z0-9._:-]{1,64}$/.test(identificador)) {
      toast.error('Identificador: até 64 caracteres, só letras, números e . _ : - (ex.: QGBT-01).');
      return;
    }
    setSalvando('medidor');
    try {
      const r = await cadastrarMedidor(locationId, {
        identificador,
        nome: novoMedidor.nome.trim() || undefined,
        pontoDeMedicao: novoMedidor.pontoDeMedicao,
        fases: novoMedidor.fases,
      });
      setTokenGerado(r);
      setMostrarCadastro(false);
      setNovoMedidor({ identificador: '', nome: '', pontoDeMedicao: 'entrada_total', fases: 3 });
      const v = await recarregarVisao();
      setForm(formDaConfig(v));
      await atualizarStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível cadastrar o medidor.');
    } finally {
      setSalvando(null);
    }
  };

  const novoToken = async (m: MedidorDoSite) => {
    if (
      m.temToken &&
      !window.confirm(
        `Gerar outro token para ${m.identificador}? O token atual para de funcionar na hora e o medidor só volta a enviar com o novo.`
      )
    ) {
      return;
    }
    try {
      setTokenGerado(await gerarNovoToken(m.id));
      await recarregarVisao();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o token.');
    }
  };

  const revogar = async (m: MedidorDoSite) => {
    if (
      !window.confirm(
        `Revogar o token de ${m.identificador}? O medidor passa a receber 401 e, sem leituras, o local fica no limite seguro.`
      )
    ) {
      return;
    }
    try {
      await revogarToken(m.id);
      toast.success('Token revogado');
      await recarregarVisao();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível revogar o token.');
    }
  };

  const alternarAtivo = async (m: MedidorDoSite) => {
    try {
      await atualizarMedidor(m.id, { ativo: !m.ativo });
      toast.success(m.ativo ? 'Medidor desativado' : 'Medidor ativado');
      await recarregarVisao();
      await atualizarStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível alterar o medidor.');
    }
  };

  const excluir = async (m: MedidorDoSite) => {
    try {
      await excluirMedidor(m.id);
      toast.success('Medidor excluído');
      const v = await recarregarVisao();
      setForm(formDaConfig(v));
      await atualizarStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir o medidor.');
    } finally {
      setConfirmarExclusao(null);
    }
  };

  // ---------------- derivados ----------------

  const fasesMostradas: Fase[] = useMemo(
    () => (status?.medidor?.fases === 1 ? ['L1'] : FASES),
    [status?.medidor?.fases]
  );
  const participantes = mapeamento.filter(m => m.participa).length;

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (erro || !visao || !form) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-foreground font-medium">{erro ?? 'Não foi possível carregar.'}</p>
          <Button variant="outline" onClick={() => void carregarTudo()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const modo = visao.config.modo;
  const corDoModo =
    modo === 'ativo'
      ? 'bg-emerald-500'
      : modo === 'observar'
        ? 'bg-sky-500'
        : 'bg-muted-foreground/40';
  const leitura = status?.leitura ?? null;

  return (
    <div className="space-y-6">
      {/* ===================== Situação e modo ===================== */}
      <Card className="bg-card border-border overflow-hidden">
        <div className={`h-1.5 w-full ${corDoModo}`} />
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gauge className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Balanceamento de carga</CardTitle>
                <CardDescription className="max-w-2xl">
                  O medidor do quadro geral (QGBT) informa a corrente de cada fase. A cada 5 s a
                  plataforma calcula quanto sobra e reparte entre os carregadores do local.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-1 min-w-[280px]">
              <div className="inline-flex rounded-lg border border-border p-1 bg-background">
                {MODOS.map(m => {
                  const bloqueado =
                    salvando === 'modo' || (!podeAtivar && (m === 'ativo' || modo === 'ativo'));
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={bloqueado}
                      onClick={() => pedirModo(m)}
                      title={
                        !podeAtivar && m === 'ativo'
                          ? 'Só o admin da plataforma liga o modo ativo'
                          : DESCRICAO_DO_MODO[m]
                      }
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all disabled:cursor-not-allowed ${
                        modo === m
                          ? m === 'ativo'
                            ? 'bg-emerald-500 text-white'
                            : m === 'observar'
                              ? 'bg-sky-500 text-white'
                              : 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50'
                      }`}
                    >
                      {ROTULO_DO_MODO[m]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{DESCRICAO_DO_MODO[modo]}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {status?.medidor ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
                  status.medidor.online
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                }`}
              >
                {status.medidor.online ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5" />
                )}
                {status.medidor.identificador} {status.medidor.online ? 'online' : 'offline'} ·
                contato {haQuanto(status.medidor.ultimoContatoEm, agora)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Nenhum medidor vinculado
              </span>
            )}
            {leitura && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
                  leitura.fresca
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
                title={`Leituras com mais de ${leitura.frescaAteS} s não entram no controle`}
              >
                <Activity className="w-3.5 h-3.5" />
                Última leitura {leitura.idadeS != null ? `há ${Math.round(leitura.idadeS)} s` : '—'}
                {leitura.fresca ? '' : ' (velha demais para controlar)'}
              </span>
            )}
            {status?.estado === 'limite_seguro' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Carregadores no limite seguro ({formatarA(visao.config.limiteSeguroA)})
              </span>
            )}
            {status?.motivo && status.estado !== 'limite_seguro' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {status.motivo}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===================== Fases ao vivo ===================== */}
      <div
        className={`grid grid-cols-1 gap-4 ${fasesMostradas.length === 3 ? 'md:grid-cols-3' : ''}`}
      >
        {fasesMostradas.map(f => {
          const pf = status?.porFase?.[f];
          const lida = leitura?.fases?.[f];
          const limite = status?.limitePorFaseA ?? null;
          const ocupado = pf ? pf.semEvA + pf.evA : (lida?.correnteA ?? 0);
          const pct = limite ? Math.min(100, Math.max(0, (ocupado / limite) * 100)) : 0;
          const corBarra = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <Card key={f} className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-muted-foreground tracking-wider">
                    FASE {f}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {lida?.tensaoV != null ? `${lida.tensaoV.toLocaleString('pt-BR')} V` : ''}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disponível para os carregadores</p>
                  <p
                    className={`text-3xl font-bold ${
                      pf && pf.disponivelA < (visao.config.correnteMinimaA ?? 6)
                        ? 'text-red-500'
                        : 'text-foreground'
                    }`}
                  >
                    {pf ? formatarA(pf.disponivelA) : '—'}
                  </p>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${corBarra} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Medido</dt>
                  <dd className="text-right font-medium text-foreground">
                    {formatarA(pf?.medidoA ?? lida?.correnteA ?? null)}
                  </dd>
                  <dt className="text-muted-foreground">Carregadores</dt>
                  <dd className="text-right font-medium text-foreground">
                    {formatarA(pf?.evA ?? null)}
                  </dd>
                  <dt className="text-muted-foreground">Prédio (sem carregadores)</dt>
                  <dd className="text-right font-medium text-foreground">
                    {formatarA(pf?.semEvA ?? null)}
                  </dd>
                  <dt className="text-muted-foreground">Limite − margem</dt>
                  <dd className="text-right font-medium text-foreground">
                    {limite != null && status?.margemA != null
                      ? `${formatarA(limite)} − ${formatarA(status.margemA)}`
                      : '—'}
                  </dd>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {status?.potencia && (
        <Card className="bg-card border-border">
          <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Demanda contratada</p>
              <p className="text-lg font-bold text-foreground">
                {status.potencia.limiteKw.toLocaleString('pt-BR')} kW
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Medido agora</p>
              <p className="text-lg font-bold text-foreground">
                {formatarLimite(status.potencia.medidoW, 'W')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prédio (sem carregadores)</p>
              <p className="text-lg font-bold text-foreground">
                {formatarLimite(status.potencia.semEvW, 'W')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disponível para os carregadores</p>
              <p className="text-lg font-bold text-foreground">
                {formatarLimite(Math.max(0, status.potencia.disponivelW), 'W')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================== Carregadores ao vivo ===================== */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Carregadores agora</CardTitle>
            <CardDescription>
              Limite calculado neste instante e o último que foi aceito por cada carregador.
              {modo !== 'ativo' && ' Fora do modo ativo nada é enviado.'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void atualizarStatus()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {(status?.carregadores.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum carregador no balanceamento. Marque os participantes em "Ligação dos
              carregadores", abaixo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carregador</TableHead>
                    <TableHead>Ligação</TableHead>
                    <TableHead>Sessão</TableHead>
                    <TableHead className="text-right">Consumo agora</TableHead>
                    <TableHead className="text-right">Calculado</TableHead>
                    <TableHead>Último aceito</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status!.carregadores.map(c => {
                    const consumo = c.cargaA
                      ? (c.fases === 'L1L2L3' ? FASES : [c.fases as Fase])
                          .map(f =>
                            c.cargaA![f].toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                          )
                          .join(' / ') + ' A'
                      : c.emSessao
                        ? 'sem leitura'
                        : '—';
                    return (
                      <TableRow key={c.chargePointId} className={c.participa ? '' : 'opacity-50'}>
                        <TableCell className="font-medium">{c.chargePointId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.fases === 'L1L2L3' ? 'Trifásico' : `Mono ${c.fases}`} · até{' '}
                          {formatarA(c.correnteMaxA)}
                          {c.unidade === 'W' ? ' · em W' : ''}
                        </TableCell>
                        <TableCell>
                          {c.emSessao ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Carregando
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Livre</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{consumo}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {c.participa ? formatarLimite(c.calculado, c.unidade) : 'não participa'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.enviado?.limite != null ? (
                            <span title={c.enviado.em ? dataHora(c.enviado.em) : undefined}>
                              {formatarLimite(c.enviado.limite, c.enviado.unidade)}{' '}
                              <span className="text-xs text-muted-foreground">
                                {haQuanto(c.enviado.em, agora)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {c.enviado && c.enviado.falhas > 0 && (
                            <p className="text-xs text-red-500" title={c.enviado.erro ?? undefined}>
                              {c.enviado.status === 'erro'
                                ? 'falhou'
                                : `recusou (${c.enviado.status})`}{' '}
                              · {c.enviado.falhas}× seguidas
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                          {c.motivo ?? (c.participa ? 'ok' : '')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================== Medidor ===================== */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Medidor do QGBT</CardTitle>
            <CardDescription>
              O medidor manda as leituras para o endereço abaixo, com o token no cabeçalho{' '}
              <code className="text-xs">Authorization: Bearer &lt;token&gt;</code>.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setMostrarCadastro(v => !v)}>
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar medidor
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <code className="text-xs flex-1 break-all text-foreground">POST {visao.endpoint}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copiar(visao.endpoint, 'Endereço copiado')}
              title="Copiar endereço"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          {mostrarCadastro && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="med-id">Identificador (meter_id)</Label>
                  <Input
                    id="med-id"
                    placeholder="QGBT-01"
                    value={novoMedidor.identificador}
                    onChange={e => setNovoMedidor(m => ({ ...m, identificador: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="med-nome">Nome</Label>
                  <Input
                    id="med-nome"
                    placeholder="Quadro geral"
                    value={novoMedidor.nome}
                    onChange={e => setNovoMedidor(m => ({ ...m, nome: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="med-ponto">O que o medidor vê</Label>
                  <select
                    id="med-ponto"
                    className={classeDoSelect}
                    value={novoMedidor.pontoDeMedicao}
                    onChange={e =>
                      setNovoMedidor(m => ({
                        ...m,
                        pontoDeMedicao: e.target.value as PontoDeMedicao,
                      }))
                    }
                  >
                    <option value="entrada_total">{ROTULO_DO_PONTO.entrada_total}</option>
                    <option value="sem_carregadores">{ROTULO_DO_PONTO.sem_carregadores}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="med-fases">Fases</Label>
                  <select
                    id="med-fases"
                    className={classeDoSelect}
                    value={novoMedidor.fases}
                    onChange={e =>
                      setNovoMedidor(m => ({ ...m, fases: Number(e.target.value) as 1 | 3 }))
                    }
                  >
                    <option value={3}>Trifásico (L1, L2, L3)</option>
                    <option value={1}>Monofásico (só L1)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMostrarCadastro(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => void cadastrar()} disabled={salvando === 'medidor'}>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Cadastrar e gerar token
                </Button>
              </div>
            </div>
          )}

          {visao.medidores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum medidor cadastrado neste local.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medidor</TableHead>
                    <TableHead>O que vê</TableHead>
                    <TableHead>Fases</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visao.medidores.map(m => (
                    <TableRow key={m.id} className={m.ativo ? '' : 'opacity-60'}>
                      <TableCell>
                        <p className="font-medium text-foreground">{m.identificador}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.nome}
                          {visao.config.medidorId === m.id ? ' · vinculado ao balanceamento' : ''}
                          {!m.ativo ? ' · desativado' : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">{ROTULO_DO_PONTO[m.pontoDeMedicao]}</TableCell>
                      <TableCell>{m.fases === 1 ? 'Mono' : 'Tri'}</TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={
                            m.online
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {m.online ? 'online' : 'offline'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {' '}
                          · {haQuanto(m.ultimoContatoEm, agora)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.temToken ? (
                          <span
                            title={
                              m.tokenGeradoEm ? `Gerado em ${dataHora(m.tokenGeradoEm)}` : undefined
                            }
                          >
                            ativo
                          </span>
                        ) : (
                          <span className="text-red-500">revogado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => void novoToken(m)}>
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                            {m.temToken ? 'Novo token' : 'Gerar token'}
                          </Button>
                          {m.temToken && (
                            <Button variant="outline" size="sm" onClick={() => void revogar(m)}>
                              Revogar
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => void alternarAtivo(m)}>
                            {m.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setConfirmarExclusao(m)}
                            title="Excluir medidor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================== Limites ===================== */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Limites do local</CardTitle>
          <CardDescription>
            {podeEditar
              ? 'Use o disjuntor geral ou o limite contratado com a distribuidora, o que for menor.'
              : 'Só o admin da plataforma altera os limites.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <CampoNumero
              id="lim-fase"
              rotulo="Limite por fase (A)"
              ajuda="Disjuntor geral ou contrato, em A por fase"
              valor={form.limitePorFaseA}
              aoMudar={v => setForm(f => f && { ...f, limitePorFaseA: v })}
              desabilitado={!podeEditar}
            />
            <CampoNumero
              id="lim-margem"
              rotulo="Margem (A)"
              ajuda={`Vazio = 10% do limite, no mínimo 2 A${
                visao.config.margemEfetivaA != null
                  ? ` (hoje ${formatarA(visao.config.margemEfetivaA)})`
                  : ''
              }`}
              valor={form.margemA}
              aoMudar={v => setForm(f => f && { ...f, margemA: v })}
              desabilitado={!podeEditar}
            />
            <CampoNumero
              id="lim-kw"
              rotulo="Demanda contratada (kW)"
              ajuda="Opcional: limita também a potência total"
              valor={form.limitePotenciaKw}
              aoMudar={v => setForm(f => f && { ...f, limitePotenciaKw: v })}
              desabilitado={!podeEditar}
            />
            <div className="space-y-1.5">
              <Label htmlFor="lim-medidor">Medidor usado</Label>
              <select
                id="lim-medidor"
                className={classeDoSelect}
                value={form.medidorId}
                disabled={!podeEditar}
                onChange={e => setForm(f => f && { ...f, medidorId: e.target.value })}
              >
                <option value="">Nenhum</option>
                {visao.medidores.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.identificador}
                  </option>
                ))}
              </select>
            </div>
            <CampoNumero
              id="lim-min"
              rotulo="Corrente mínima (A)"
              ajuda="Abaixo disto o carregador é pausado (0 A)"
              valor={form.correnteMinimaA}
              aoMudar={v => setForm(f => f && { ...f, correnteMinimaA: v })}
              desabilitado={!podeEditar}
            />
            <CampoNumero
              id="lim-seguro"
              rotulo="Limite seguro (A)"
              ajuda="Por carregador, enquanto o medidor estiver sem dados (0 = pausar)"
              valor={form.limiteSeguroA}
              aoMudar={v => setForm(f => f && { ...f, limiteSeguroA: v })}
              desabilitado={!podeEditar}
            />
            <CampoNumero
              id="lim-intervalo"
              rotulo="Intervalo de aumento (s)"
              ajuda="Reduções vão na hora; aumentos, no máximo a cada este tempo"
              valor={form.intervaloEnvioS}
              aoMudar={v => setForm(f => f && { ...f, intervaloEnvioS: v })}
              desabilitado={!podeEditar}
            />
            <CampoNumero
              id="lim-histerese"
              rotulo="Histerese (A)"
              ajuda="Variação menor que esta não é enviada"
              valor={form.histereseA}
              aoMudar={v => setForm(f => f && { ...f, histereseA: v })}
              desabilitado={!podeEditar}
            />
          </div>
          {podeEditar && (
            <div className="flex justify-end">
              <Button onClick={() => void salvarLimites()} disabled={salvando === 'config'}>
                <Save className="w-4 h-4 mr-2" />
                Salvar limites
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================== Ligação dos carregadores ===================== */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Ligação dos carregadores</CardTitle>
          <CardDescription>
            Em que fase do quadro cada carregador está e quanto ele aguenta por fase. Inclua na
            corrente máxima qualquer limite fixo que o carregador já tenha. Prioridade: maior número
            = mais importante (na falta de corrente, pausa primeiro a menor).
            {!podeEditar && ' Só o admin da plataforma altera esta ligação.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mapeamento.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum carregador neste local.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participa</TableHead>
                    <TableHead>Carregador</TableHead>
                    <TableHead className="min-w-[190px]">Fases</TableHead>
                    <TableHead className="min-w-[110px]">Corrente máx. (A/fase)</TableHead>
                    <TableHead className="min-w-[150px]">Perfil em</TableHead>
                    <TableHead className="min-w-[100px]">Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapeamento.map(l => (
                    <TableRow key={l.chargePointId}>
                      <TableCell>
                        <Switch
                          checked={l.participa}
                          disabled={!podeEditar}
                          onCheckedChange={v => mudarLinha(l.chargePointId, { participa: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{l.chargePointId}</p>
                        <p className="text-xs text-muted-foreground">
                          {[l.carregador.fabricante, l.carregador.modelo]
                            .filter(Boolean)
                            .join(' ') || '—'}
                          {l.carregador.potenciaKw ? ` · ${l.carregador.potenciaKw} kW` : ''}
                          {!l.carregador.doLocal ? ' · não está mais neste local' : ''}
                        </p>
                      </TableCell>
                      <TableCell>
                        <select
                          className={classeDoSelect}
                          value={l.fases}
                          disabled={!podeEditar}
                          onChange={e =>
                            mudarLinha(l.chargePointId, {
                              fases: e.target.value as FasesDoCarregador,
                            })
                          }
                        >
                          {(Object.keys(ROTULO_DAS_FASES) as FasesDoCarregador[]).map(f => (
                            <option key={f} value={f}>
                              {ROTULO_DAS_FASES[f]}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-9"
                          inputMode="decimal"
                          value={l.correnteMaxA}
                          disabled={!podeEditar}
                          onChange={e =>
                            mudarLinha(l.chargePointId, { correnteMaxA: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className={classeDoSelect}
                          value={l.unidade}
                          disabled={!podeEditar}
                          onChange={e =>
                            mudarLinha(l.chargePointId, { unidade: e.target.value as 'A' | 'W' })
                          }
                        >
                          <option value="A">Ampères (AC)</option>
                          <option value="W">Watts (DC)</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-9"
                          inputMode="numeric"
                          placeholder="0"
                          value={l.prioridade}
                          disabled={!podeEditar}
                          onChange={e =>
                            mudarLinha(l.chargePointId, { prioridade: e.target.value })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {podeEditar && mapeamento.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {participantes} carregador(es) participando. Perfil enviado: ChargePointMaxProfile,
                id {visao.perfil.chargingProfileId}, conector 0.
              </p>
              <Button onClick={() => void salvarCarregadores()} disabled={salvando === 'mapa'}>
                <Save className="w-4 h-4 mr-2" />
                Salvar ligação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================== Registro ===================== */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Registro do balanceamento</CardTitle>
            <CardDescription>
              Uma linha quando algo é enviado (ou, no modo observar, seria) ou a situação muda.
              Guardado por 30 dias.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void atualizarRegistro()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {decisoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Disponível (A)</TableHead>
                    <TableHead>Carregadores</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisoes.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {dataHora(d.criadoEm)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span
                          className={
                            d.modo === 'ativo'
                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'text-muted-foreground'
                          }
                        >
                          {d.modo}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {d.porFase && Object.keys(d.porFase).length > 0
                          ? (Object.keys(d.porFase) as Fase[])
                              .map(
                                f => `${f} ${d.porFase![f]!.disponivelA.toLocaleString('pt-BR')}`
                              )
                              .join(' · ')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5">
                          {d.carregadores.map(c => (
                            <span key={c.chargePointId}>
                              <span className="font-medium text-foreground">{c.chargePointId}</span>
                              {c.limite != null && ` ${formatarLimite(c.limite, c.unidade)}`}
                              <span
                                className={
                                  c.envio && !c.simulado && !c.enviado
                                    ? 'text-red-500'
                                    : 'text-muted-foreground'
                                }
                              >
                                {' '}
                                · {textoDoEnvio(c)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                        {d.motivo ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================== Token gerado (uma vez só) ===================== */}
      <Dialog open={!!tokenGerado} onOpenChange={aberto => !aberto && setTokenGerado(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Token do medidor {tokenGerado?.medidor.identificador}
            </DialogTitle>
            <DialogDescription>
              Este token aparece só agora: a plataforma guarda apenas uma assinatura dele. Copie e
              entregue ao responsável pelo medidor. Se perder, gere outro.
            </DialogDescription>
          </DialogHeader>
          {tokenGerado && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Token</Label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <code className="text-xs flex-1 break-all text-foreground">
                    {tokenGerado.token}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copiar(tokenGerado.token, 'Token copiado')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Endereço</Label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <code className="text-xs flex-1 break-all text-foreground">
                    POST {tokenGerado.endpoint}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copiar(tokenGerado.endpoint, 'Endereço copiado')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p>
                  Cabeçalhos: <code>Authorization: Bearer &lt;token&gt;</code> e{' '}
                  <code>Content-Type: application/json</code>.
                </p>
                <p>
                  Em cada leitura, <code>meter_id</code> deve ser exatamente{' '}
                  <code>{tokenGerado.medidor.identificador}</code>.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                tokenGerado &&
                copiar(
                  `Endereço: POST ${tokenGerado.endpoint}\nAuthorization: Bearer ${tokenGerado.token}\nmeter_id: ${tokenGerado.medidor.identificador}`,
                  'Dados do medidor copiados'
                )
              }
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar tudo
            </Button>
            <Button onClick={() => setTokenGerado(null)}>Já guardei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Confirmação do modo ativo ===================== */}
      <AlertDialog
        open={!!confirmarModo}
        onOpenChange={aberto => !aberto && setConfirmarModo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              {confirmarModo === 'ativo' ? 'Ativar o balanceamento?' : 'Sair do modo ativo?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {confirmarModo === 'ativo' ? (
                  <>
                    <p>
                      A plataforma vai mandar limites de corrente (SetChargingProfile) aos{' '}
                      <strong>{participantes}</strong> carregador(es) participantes, a cada mudança
                      da carga do prédio.
                    </p>
                    <p>
                      Confira antes: limite por fase de{' '}
                      <strong>{formatarA(visao.config.limitePorFaseA)}</strong>, margem de{' '}
                      <strong>{formatarA(visao.config.margemEfetivaA)}</strong> e a ligação de cada
                      carregador. Se o medidor parar de mandar leituras, cada carregador fica em{' '}
                      <strong>{formatarA(visao.config.limiteSeguroA)}</strong>.
                    </p>
                  </>
                ) : (
                  <p>
                    O perfil do balanceamento será removido dos carregadores (ClearChargingProfile)
                    e eles voltam ao limite próprio de cada um.
                    {confirmarModo === 'observar' &&
                      ' O cálculo continua sendo registrado, sem envio.'}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmarModo && void trocarModo(confirmarModo)}
              className={
                confirmarModo === 'ativo' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
              }
            >
              {confirmarModo === 'ativo' ? 'Ativar e enviar limites' : 'Sair do modo ativo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===================== Exclusão do medidor ===================== */}
      <AlertDialog
        open={!!confirmarExclusao}
        onOpenChange={aberto => !aberto && setConfirmarExclusao(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir o medidor {confirmarExclusao?.identificador}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              As leituras dele também são apagadas. Sem medidor, o local fica no limite seguro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmarExclusao && void excluir(confirmarExclusao)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CampoNumero({
  id,
  rotulo,
  ajuda,
  valor,
  aoMudar,
  desabilitado,
}: {
  id: string;
  rotulo: string;
  ajuda: string;
  valor: string;
  aoMudar: (v: string) => void;
  desabilitado: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={valor}
        disabled={desabilitado}
        onChange={e => aoMudar(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{ajuda}</p>
    </div>
  );
}

export default LocationBalanceamentoTab;
