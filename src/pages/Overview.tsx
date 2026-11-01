import { useEffect, useState, useMemo, useRef } from 'react';
import { dataLocal } from '../components/ui/utils';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocket } from '../lib/hooks/useSocket';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface ChartPoint {
  date: string;
  value: number;
}

interface LocalDaLista {
  id: number;
  nomeDoLocal?: string;
  location_name?: string;
  endereco?: string;
}

interface OverviewData {
  /** Local a que estes números se referem; null = a rede toda. */
  locationId?: number | null;
  /**
   * Financeiro do local escolhido, pela regra do Relatório Financeiro por local.
   * `taxaMp` e `liquidoNeoPower` só vêm para a plataforma.
   */
  financeiroDoLocal?: {
    recargas: number;
    receita: number;
    comissaoPercent: number;
    comissao: number;
    repasse: number;
    taxaMp?: number;
    liquidoNeoPower?: number;
  } | null;
  revenueToday: number;
  revenueMonth: number;
  revenueTotal: number;
  kwhToday: number;
  kwhMonth: number;
  kwhTotal: number;
  transactionsMonth: number;
  transactionsTotal: number;
  totalDepositsGross: number;
  mercadoPagoFee: number;
  totalDepositsNet: number;
  depositsCount: number;
  last7DaysRevenue: ChartPoint[];
  last7DaysKwh: ChartPoint[];
  chargers: {
    total: number;
    online: number;
    offline: number;
    charging: number;
    /** Cadastrados que nunca se conectaram (API nova); fora do offline. */
    emInstalacao?: number;
  };
  activeVouchers?: number;
}

/** Recarga em andamento (GET /transactions/active), com o consumo do medidor. */
interface RecargaAgora {
  transactionId: number;
  chargerId: string;
  startTimestamp: string;
  energyKwh?: number;
  powerKw?: number | null;
  estimatedCost?: number;
  userName?: string | null;
  locationId?: number | null;
}

/**
 * De quanto em quanto tempo a tela se atualiza sozinha. As recargas em
 * andamento acompanham o medidor (uma leitura por minuto); os totais, que só
 * mudam quando uma recarga é cobrada, vão mais devagar. Com a aba em segundo
 * plano, nada é pedido.
 */
const INTERVALO_DO_AGORA_MS = 15_000;
const INTERVALO_DOS_TOTAIS_MS = 60_000;

const fmt = (v: number, decimals = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Um número do bloco "Agora". */
function NumeroDoAgora({ icone, rotulo, valor, destaque }: { icone: string; rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${destaque ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-low border-outline-variant/10'}`}>
      <div className="flex items-center gap-1.5 text-on-surface-variant">
        <span className={`material-symbols-outlined text-base ${destaque ? 'text-primary' : ''}`}>{icone}</span>
        <span className="text-[10px] font-bold tracking-widest uppercase">{rotulo}</span>
      </div>
      <p className="mt-1 text-xl font-headline font-bold text-on-surface tabular-nums">{valor}</p>
    </div>
  );
}

export const Overview = () => {
  const { user } = useAuth();
  // A API só manda os depósitos para o super admin (carteiras são globais);
  // para operador/admin da marca eles vêm zerados, então o card fica oculto.
  const isSuperAdmin = user?.role === 'admin' && !user?.branding?.clientId;
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // '' = a rede toda. Guardado como texto porque é o que o Select devolve.
  const [locationId, setLocationId] = useState('');
  const [locais, setLocais] = useState<LocalDaLista[]>([]);
  const [previousData, setPreviousData] = useState<OverviewData | null>(null);

  const { isConnected, chargerStatuses, lastUpdate } = useSocket();

  const chargerCountRef = useRef(0);
  useEffect(() => {
    const onlineCount = Array.from(chargerStatuses.values()).filter(
      s => s.status !== 'Offline' && s.status !== 'Unavailable'
    ).length;
    if (chargerCountRef.current !== onlineCount && chargerCountRef.current !== 0) {
      void fetchOverview(true, true);
    }
    chargerCountRef.current = onlineCount;
  }, [chargerStatuses]);

  // `mesmoEscopo = false` quando o local ou o período mudou: comparar o local
  // novo com os números da rede dava "-100%" num cartão que não caiu nada.
  // `silencioso`: atualização automática — sem o carregando, que apagava a
  // tela inteira, sem mexer na comparação e sem trocar os números por um erro
  // passageiro (tenta de novo no próximo ciclo).
  const fetchOverview = async (mesmoEscopo = true, silencioso = false) => {
    if (!silencioso) {
      setLoading(true);
      setError(null);
    }
    try {
      let endpoint = '/overview-stats';
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (locationId) params.append('locationId', locationId);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const response = await api.get(endpoint);
      if (!response.ok) throw new Error('Falha ao buscar dados.');
      const overviewData = await response.json();
      if (!silencioso) setPreviousData(mesmoEscopo && data ? data : null);
      setData(overviewData);
    } catch (err: any) {
      if (!silencioso) setError(err.message || 'Erro ao buscar dados.');
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => { void fetchOverview(false); }, [startDate, endDate, locationId]);

  // Os totais se atualizam sozinhos: uma recarga cobrada entra na receita e no
  // kWh sem precisar recarregar a página.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      void fetchOverview(true, true);
    }, INTERVALO_DOS_TOTAIS_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, locationId]);

  // Recargas em andamento, com o consumo do medidor. Os totais acima só contam
  // a recarga depois de cobrada; aqui o operador vê o que está entrando agora.
  const [agora, setAgora] = useState<RecargaAgora[] | null>(null);
  useEffect(() => {
    const buscar = async () => {
      try {
        const res = await api.get('/transactions/active');
        if (!res.ok) return;
        const corpo = await res.json();
        const lista = Array.isArray(corpo) ? corpo : (corpo?.data ?? []);
        setAgora(Array.isArray(lista) ? lista : []);
      } catch {
        /* falha de rede: fica o último retrato e tenta no próximo ciclo */
      }
    };
    void buscar();
    const t = setInterval(() => {
      if (document.hidden) return;
      void buscar();
    }, INTERVALO_DO_AGORA_MS);
    return () => clearInterval(t);
  }, []);

  // Lista do seletor: dos locais que este usuário pode ver, só os que já
  // renderam alguma recarga. A lista inteira tem dezenas de cadastros antigos,
  // de teste e de marca que ainda não opera — escolher um deles só abriria uma
  // tela de zeros. Um local novo entra aqui sozinho na primeira recarga cobrada.
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get('/locations/all?comReceita=true');
        if (!res.ok) return;
        const corpo = await res.json();
        const lista = corpo.locations || corpo.data?.locations || corpo.data || corpo || [];
        setLocais(Array.isArray(lista) ? lista : []);
      } catch {
        // Sem a lista o seletor não aparece; o resto da tela continua de pé.
      }
    })();
  }, []);

  const handleClearFilters = () => { setStartDate(''); setEndDate(''); };

  const calculateChange = (current: number, previous: number | undefined): number | undefined => {
    if (!previous || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const statusCounts = useMemo(() => {
    if (!data?.chargers) return { online: 0, offline: 0, charging: 0, emInstalacao: 0 };
    return {
      online: data.chargers.online,
      offline: data.chargers.offline,
      charging: data.chargers.charging,
      emInstalacao: data.chargers.emInstalacao ?? 0,
    };
  }, [data]);

  // Os três estados são disjuntos (a API desconta os carregando dos online) e
  // somam os carregadores instalados. O cadastrado que nunca ligou fica à parte
  // (emInstalacao): contado como offline, metade da rede parecia fora do ar.
  const statusTotal = statusCounts.online + statusCounts.charging + statusCounts.offline;
  const statusConectados = statusCounts.online + statusCounts.charging;
  const statusPct = (n: number) => (statusTotal > 0 ? Math.round((n / statusTotal) * 100) : 0);
  const statusItens = [
    { label: 'Livres', value: statusCounts.online, icone: 'check_circle', texto: 'text-primary', barra: 'bg-primary' },
    { label: 'Em uso', value: statusCounts.charging, icone: 'bolt', texto: 'text-tertiary', barra: 'bg-tertiary' },
    { label: 'Offline', value: statusCounts.offline, icone: 'wifi_off', texto: 'text-muted-foreground', barra: 'bg-outline' },
  ];

  // Recarga é paga com saldo da carteira: é consumo do dinheiro que já entrou
  // como depósito. Somar recargas + depósitos contava o mesmo real duas vezes.
  // Com depósitos (super admin), a receita é o depósito líquido; sem eles
  // (operador), fica a receita das recargas, como já era.
  // Com um local escolhido não há depósito a mostrar (depósito é da carteira do
  // cliente, não do local): o líquido do local é o repasse — a receita das
  // recargas menos a comissão da NeoPower, a mesma conta do relatório por local.
  const receitaDe = (d: OverviewData | null) =>
    d?.financeiroDoLocal
      ? d.financeiroDoLocal.repasse
      : d?.locationId != null
        ? // Servidor ainda sem o financeiro do local: ao menos a receita das
          // recargas dele, nunca o zero dos depósitos.
          d?.revenueTotal || 0
        : isSuperAdmin
          ? d?.totalDepositsNet || 0
          : d?.revenueTotal || 0;
  const doLocal = data?.financeiroDoLocal ?? null;
  const netRevenue = receitaDe(data);
  const grossDeposits = data?.totalDepositsGross || 0;
  const depositQuota = grossDeposits > 0 ? Math.min((grossDeposits / (grossDeposits * 1.02)) * 100, 100) : 0;
  const revenueChange = calculateChange(
    netRevenue,
    previousData ? receitaDe(previousData) : undefined
  );
  // A API devolve o período em revenueToday/kwhToday quando há filtro; o "Month"
  // é sempre o mês atual. Os cards mostram o período quando ele está filtrado.
  const filtrado = !!(startDate || endDate);
  // Com período escolhido, todos os cartões falam da mesma janela (o servidor
  // recorta tudo por ela). O rótulo diz qual é, para ninguém somar meses
  // diferentes achando que são o mesmo número.
  const rotuloDoPeriodo = `${startDate ? dataLocal(startDate).toLocaleDateString('pt-BR') : 'Início'} — ${endDate ? dataLocal(endDate).toLocaleDateString('pt-BR') : 'Hoje'}`;
  const nomeDoLocal = (l: LocalDaLista) => l.nomeDoLocal || l.location_name || `Local ${l.id}`;
  const localEscolhido = locais.find(l => String(l.id) === locationId);
  // A API devolve o escopo que de fato aplicou. Enquanto ela não estiver
  // atualizada, o número é da rede toda — e dizer "Local: X" em cima disso seria
  // mentira. Melhor avisar do que mostrar um total que não é daquele posto.
  const escopoConfirmado = !locationId || String(data?.locationId ?? '') === locationId;

  // Recargas em andamento no escopo da tela. O local de cada uma vem da API;
  // a que ainda não o manda fica com a rede toda, em vez de esconder tudo.
  const agoraTemLocal = (agora ?? []).some(r => r.locationId !== undefined);
  const agoraNoEscopo = (agora ?? []).filter(
    r => !locationId || !agoraTemLocal || String(r.locationId ?? '') === locationId
  );
  const somaAgora = agoraNoEscopo.reduce(
    (s, r) => ({
      kwh: s.kwh + (r.energyKwh || 0),
      kw: s.kw + (r.powerKw || 0),
      valor: s.valor + (r.estimatedCost || 0),
    }),
    { kwh: 0, kw: 0, valor: 0 }
  );
  const LINHAS_DO_AGORA = 8;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-error">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Visão Geral</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-on-surface-variant font-medium text-sm">
              {startDate || endDate
                ? `Período: ${startDate ? dataLocal(startDate).toLocaleDateString('pt-BR') : 'Início'} — ${endDate ? dataLocal(endDate).toLocaleDateString('pt-BR') : 'Hoje'}`
                : `Período: ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
            </p>
            <p className={`font-medium text-sm ${escopoConfirmado ? 'text-on-surface-variant' : 'text-amber-500'}`}>
              {!localEscolhido
                ? 'Todos os locais'
                : escopoConfirmado
                  ? `Local: ${nomeDoLocal(localEscolhido)}`
                  : 'Servidor ainda não filtra por local — números da rede toda'}
            </p>
            {/* Real-time indicator */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${
              isConnected
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-surface-container-highest text-on-surface-variant border border-outline-variant/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-primary animate-pulse' : 'bg-outline'}`} />
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {locais.length > 0 && (
            <Select value={locationId || 'todos'} onValueChange={v => setLocationId(v === 'todos' ? '' : v)}>
              <SelectTrigger className="min-w-[200px] bg-surface-container-low border-outline-variant/20 text-on-surface">
                <SelectValue placeholder="Todos os locais" />
              </SelectTrigger>
              <SelectContent className="bg-surface-container border-outline-variant/20">
                <SelectItem value="todos" className="text-on-surface focus:bg-surface-container-highest">
                  Todos os locais
                </SelectItem>
                {locais.map(l => (
                  <SelectItem
                    key={l.id}
                    value={String(l.id)}
                    className="text-on-surface focus:bg-surface-container-highest"
                  >
                    {nomeDoLocal(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClear={handleClearFilters}
          />
          <button
            onClick={() => void fetchOverview()}
            className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm shadow-[0_8px_20px_color-mix(in srgb,var(--primary),transparent_80%)] hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base align-middle mr-1">refresh</span>
            ATUALIZAR
          </button>
        </div>
      </div>

      {/* Agora: recargas em andamento, pelo medidor */}
      {agora !== null && (
        <div className="bg-card p-6 rounded-2xl border border-neutral-200 shadow-soft">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`w-2 h-2 rounded-full ${agoraNoEscopo.length ? 'bg-tertiary animate-pulse' : 'bg-outline'}`} />
            <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Agora</span>
            <span className="text-[10px] text-outline">· recargas em andamento, atualiza a cada 15 s</span>
            {locationId && !agoraTemLocal && (
              <span className="text-[10px] text-amber-500">· servidor ainda não separa por local — rede toda</span>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <NumeroDoAgora icone="ev_station" rotulo="Em andamento" valor={String(agoraNoEscopo.length)} />
            <NumeroDoAgora icone="bolt" rotulo="Energia até agora" valor={`${fmt(somaAgora.kwh, 1)} kWh`} destaque />
            <NumeroDoAgora icone="speed" rotulo="Potência agora" valor={`${fmt(somaAgora.kw, 1)} kW`} />
            <NumeroDoAgora icone="payments" rotulo="Valor estimado" valor={`R$ ${fmt(somaAgora.valor)}`} />
          </div>
          {agoraNoEscopo.length > 0 && (
            <div className="mt-5 divide-y divide-outline-variant/10 border-t border-outline-variant/10">
              {agoraNoEscopo.slice(0, LINHAS_DO_AGORA).map(r => (
                <div key={r.transactionId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="font-semibold text-on-surface min-w-[120px]">{r.chargerId}</span>
                  <span className="text-on-surface-variant basis-full sm:basis-auto sm:flex-1 min-w-0 truncate">
                    {r.userName || `#${r.transactionId}`}
                    <span className="text-outline">
                      {' · desde '}
                      {new Date(r.startTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <span className="text-on-surface tabular-nums">{fmt(r.energyKwh || 0, 2)} kWh</span>
                  <span className="text-on-surface-variant tabular-nums w-[72px] text-right">
                    {r.powerKw != null ? `${fmt(r.powerKw, 1)} kW` : '—'}
                  </span>
                  <span className="font-semibold text-tertiary tabular-nums w-[90px] text-right">
                    R$ {fmt(r.estimatedCost || 0)}
                  </span>
                </div>
              ))}
              {agoraNoEscopo.length > LINHAS_DO_AGORA && (
                <p className="pt-2.5 text-xs text-outline">
                  + {agoraNoEscopo.length - LINHAS_DO_AGORA} em Transações
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Section: Bento Style (4 Consolidated Cards) */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isSuperAdmin && !locationId ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
        {/* Card 1: Receita Líquida */}
        <div className="bg-card p-6 rounded-2xl border border-neutral-200 shadow-soft relative overflow-hidden group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Receita Líquida</span>
                <p className="text-[10px] text-outline">{filtrado ? rotuloDoPeriodo : 'Todo o histórico'}</p>
                {doLocal && (
                  <p className="text-[10px] text-outline">Repasse ao dono ({100 - doLocal.comissaoPercent}%)</p>
                )}
              </div>
              {revenueChange !== undefined && (
                <div className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${revenueChange >= 0 ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                  <span className="material-symbols-outlined text-sm mr-0.5">{revenueChange >= 0 ? 'trending_up' : 'trending_down'}</span>
                  {Math.abs(revenueChange).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-on-surface-variant text-sm font-medium">R$</span>
              <span className="text-3xl font-headline font-bold text-foreground">{fmt(netRevenue)}</span>
            </div>
          </div>
          {doLocal ? (
            // De onde sai o número de cima: receita − comissão = repasse.
            <div className="mt-4 pt-4 border-t border-outline-variant/10 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Recargas ({doLocal.recargas})</span>
                <span className="font-semibold text-on-surface">R$ {fmt(doLocal.receita)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Comissão NeoPower ({doLocal.comissaoPercent}%)</span>
                <span className="font-semibold text-on-surface">− R$ {fmt(doLocal.comissao)}</span>
              </div>
              {doLocal.liquidoNeoPower !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Líquido NeoPower</span>
                  <span className="font-semibold text-primary">R$ {fmt(doLocal.liquidoNeoPower)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center text-xs">
              {/* Recargas à parte: consumo do saldo, não soma na receita */}
              <span className="text-on-surface-variant">{isSuperAdmin ? 'Recargas (consumo)' : 'Transações'}</span>
              <span className="font-semibold text-on-surface">
                {isSuperAdmin ? `R$ ${fmt(data.revenueTotal || 0)}` : String(data.transactionsTotal || 0)}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
        </div>

        {/* Card 2: Receita Operacional */}
        <div className="bg-card p-6 rounded-2xl border border-neutral-200 shadow-soft relative overflow-hidden group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Receita Operacional</span>
                <p className="text-[10px] text-outline">{filtrado ? rotuloDoPeriodo : 'Mês atual'}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-on-surface-variant text-sm font-medium">R$</span>
              <span className="text-3xl font-headline font-bold text-foreground">{fmt(filtrado ? data.revenueToday : data.revenueMonth)}</span>
            </div>
          </div>
          {!filtrado && (
            <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant">Hoje</span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </div>
              <span className="font-semibold text-on-surface">R$ {fmt(data.revenueToday)}</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
        </div>

        {/* Card 3: Depósitos & Taxas — só super admin (a API não manda depósitos do
            operador) e só na visão da rede: depósito entra na carteira do cliente,
            não num local, então ao lado dos números de um posto ele enganaria. */}
        {isSuperAdmin && !locationId && (
          <div className="bg-card p-6 rounded-2xl border border-primary/20 shadow-soft relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Depósitos Brutos</span>
                  <p className="text-[10px] text-outline">{filtrado ? rotuloDoPeriodo : 'Todo o histórico'}</p>
                </div>
                <span className="px-2 py-0.5 bg-primary/15 text-primary text-[10px] font-extrabold rounded">
                  {data.depositsCount || 0} DEP.
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-primary/70 text-sm font-medium">R$</span>
                <span className="text-3xl font-headline font-bold text-primary">{fmt(grossDeposits)}</span>
              </div>

              <div className="w-full bg-surface/50 h-1.5 rounded-full mt-4">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${depositQuota}%`, boxShadow: '0 0 8px var(--primary)' }}
                />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-outline-variant/10 flex justify-between items-center text-xs relative z-10">
              <span className="text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-error">trending_down</span>
                Taxa Mercado Pago
              </span>
              <span className="font-semibold text-error">- R$ {fmt(data.mercadoPagoFee || 0)}</span>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] rounded-full pointer-events-none" />
          </div>
        )}

        {/* Card 4: Energia Consumida */}
        <div className="bg-card p-6 rounded-2xl border border-neutral-200 shadow-soft relative overflow-hidden group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Energia Consumida</span>
                <p className="text-[10px] text-outline">{filtrado ? rotuloDoPeriodo : 'Mês atual'}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary text-lg">bolt</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-headline font-bold text-foreground">{fmt(filtrado ? data.kwhToday : data.kwhMonth, 1)}</span>
              <span className="text-on-surface-variant text-sm font-medium">kWh</span>
            </div>
          </div>
          {!filtrado && (
            <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant">Hoje</span>
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              </div>
              <span className="font-semibold text-on-surface">{fmt(data.kwhToday, 1)} kWh</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-tertiary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
        </div>
      </div>

      {/* Charts Section: Asymmetric Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-7 bg-card p-8 rounded-2xl border border-neutral-200 shadow-soft">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="font-headline text-lg font-bold">Análise de Receita</h3>
              <p className="text-xs text-on-surface-variant">
                {startDate || endDate ? 'Período selecionado' : 'Últimos 7 dias'}
              </p>
            </div>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant">
                <span className="w-2 h-2 rounded-full bg-primary" /> RECEITA
              </span>
            </div>
          </div>
          {(!data.last7DaysRevenue || data.last7DaysRevenue.length === 0) ? (
            <div className="h-[220px] flex flex-col items-center justify-center gap-3 bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant/30 p-6">
              <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-muted-foreground shadow-sm">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-on-surface">Nenhum faturamento registrado</p>
                <p className="text-xs text-on-surface-variant mt-1">Não houve transações com receita neste período.</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.last7DaysRevenue}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="date" stroke="var(--color-outline)" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis stroke="var(--color-outline)" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} dx={-10} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-muted-foreground)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--primary)', fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" activeDot={{ r: 5, fill: 'var(--primary)', stroke: 'var(--color-background)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Energy Consumption */}
        <div className="lg:col-span-5 bg-card p-8 rounded-2xl border border-neutral-200 shadow-soft">
          <h3 className="font-headline text-lg font-bold mb-10">Consumo de Energia</h3>
          {(!data.last7DaysKwh || data.last7DaysKwh.length === 0) ? (
            <div className="h-[220px] flex flex-col items-center justify-center gap-3 bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant/30 p-6">
              <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-muted-foreground shadow-sm">
                <span className="material-symbols-outlined text-2xl">bolt</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-on-surface">Nenhum consumo de energia</p>
                <p className="text-xs text-on-surface-variant mt-1">Não houve recargas efetuadas neste período.</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.last7DaysKwh} barSize={24}>
                <defs>
                  <linearGradient id="kwhGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#88f6ff" stopOpacity={1} />
                    <stop offset="100%" stopColor="#00deea" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="date" stroke="var(--color-outline)" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis stroke="var(--color-outline)" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} dx={-10} tickFormatter={(v) => `${v} kW`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-muted-foreground)', fontWeight: 600 }}
                  itemStyle={{ color: '#88f6ff', fontWeight: 700 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="value" fill="url(#kwhGrad)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Section: Station Status + Side Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Station Status */}
        <div className="bg-card rounded-2xl border border-neutral-200 shadow-soft overflow-hidden">
          <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
            <h3 className="font-headline font-bold">Status das Estações</h3>
            <span className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full ${
              statusConectados > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConectados > 0 ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
              {statusConectados} ONLINE
            </span>
          </div>
          {statusTotal === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-4xl text-outline">ev_station</span>
              <p className="text-sm text-on-surface-variant">Nenhuma estação registrada</p>
            </div>
          ) : (
            // Indicador direto no lugar do gráfico de rosca: com poucos
            // carregadores a rosca virava um anel de uma cor só e não se lia nada.
            <div className="p-6 space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-headline font-bold tracking-tight">
                    {statusConectados}
                    <span className="text-lg text-on-surface-variant font-medium"> de {statusTotal}</span>
                  </p>
                  <p className="text-sm text-on-surface-variant mt-1">carregadores conectados</p>
                </div>
                <p className={`text-2xl font-headline font-bold ${statusConectados > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {statusPct(statusConectados)}%
                </p>
              </div>

              {/* Barra segmentada: proporção de cada estado */}
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container-highest" role="img"
                aria-label={statusItens.map(d => `${d.label}: ${d.value}`).join(', ')}>
                {statusItens.filter(d => d.value > 0).map(d => (
                  <div key={d.label} className={`h-full ${d.barra}`} style={{ width: `${(d.value / statusTotal) * 100}%` }} title={`${d.label}: ${d.value}`} />
                ))}
              </div>

              <div className={`grid gap-3 ${statusCounts.emInstalacao > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                {statusItens.map(d => (
                  <div key={d.label} className="min-w-0 rounded-xl border border-outline-variant/20 bg-background/50 p-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`material-symbols-outlined text-lg leading-none ${d.texto}`} style={{ fontVariationSettings: "'FILL' 1" }}>{d.icone}</span>
                      <span className="w-full truncate text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{d.label}</span>
                    </div>
                    <p className="text-2xl font-headline font-bold mt-2">{d.value}</p>
                    <p className="text-[11px] text-on-surface-variant">{statusPct(d.value)}% da rede</p>
                  </div>
                ))}
                {statusCounts.emInstalacao > 0 && (
                  <div className="min-w-0 rounded-xl border border-dashed border-outline-variant/40 bg-background/50 p-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className="material-symbols-outlined text-lg leading-none text-on-surface-variant">construction</span>
                      <span className="w-full truncate text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Em instalação</span>
                    </div>
                    <p className="text-2xl font-headline font-bold mt-2">{statusCounts.emInstalacao}</p>
                    <p className="text-[11px] text-on-surface-variant">ainda não ligado{statusCounts.emInstalacao === 1 ? '' : 's'}</p>
                  </div>
                )}
              </div>

              {statusCounts.offline > 0 && (
                <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">info</span>
                  {statusCounts.offline === statusTotal
                    ? 'Todos os carregadores estão offline. Verifique a conexão deles.'
                    : `${statusCounts.offline} carregador${statusCounts.offline === 1 ? '' : 'es'} sem conexão.`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Side Cards */}
        <div className="space-y-6">
          <SideMetric icon="confirmation_number" label="VOUCHERS ATIVOS" value={String(data.activeVouchers ?? 0)} accent />
          <SideMetric icon="receipt_long" label={filtrado ? 'TRANSAÇÕES (PERÍODO)' : 'TRANSAÇÕES (MÊS)'} value={String(data.transactionsMonth)} />
          <SideMetric icon="ev_station" label="ESTAÇÕES TOTAIS" value={String(data.chargers.total)} />
          {lastUpdate && (
            <div className="flex items-center gap-2 text-xs text-on-surface-variant px-1">
              <span className="material-symbols-outlined text-sm">schedule</span>
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Sub-components ── */

function SideMetric({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-6 rounded-2xl border shadow-soft relative overflow-hidden group ${
      accent
        ? 'bg-card border-primary/20'
        : 'bg-card border-neutral-200'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${accent ? 'bg-primary/10' : 'bg-surface-container'}`}>
          <span className={`material-symbols-outlined text-2xl ${accent ? 'text-primary' : 'text-on-surface-variant'}`}>{icon}</span>
        </div>
        <div>
          <p className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">{label}</p>
          <span className={`text-3xl font-headline font-bold ${accent ? 'text-primary' : ''}`}>{value}</span>
        </div>
      </div>
      {accent && <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-[40px] rounded-full" />}
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/15 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
    </div>
  );
}
