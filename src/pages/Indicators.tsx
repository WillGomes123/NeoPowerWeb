import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { differenceInCalendarDays, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { RelatorioMensal } from '../components/indicadores/RelatorioMensal';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { dataLocal } from '../components/ui/utils';
import {
  fmtBRL,
  fmtCompacto,
  fmtInt,
  fmtNum,
  fmtVar,
  variacaoPct,
} from '../components/indicadores/tipos';

type MetricType = 'sessions' | 'revenue' | 'energy' | 'users';
type ChartType = 'area' | 'bar' | 'line';

interface PerformanceData {
  date: string;
  sessions: number;
  revenue: number;
  energy: number;
  users: number;
}

interface MetricaConfig {
  label: string;
  /** Como o card resume o período: soma dos dias ou média por dia. */
  resumo: 'soma' | 'media';
  detalhe: string;
  color: string;
  icon: string;
  fmt: (v: number) => string;
  fmtEixo: (v: number) => string;
}

const metricsConfig: Record<MetricType, MetricaConfig> = {
  revenue: {
    label: 'Receita',
    resumo: 'soma',
    detalhe: 'total no período',
    color: '#90f9a3',
    icon: 'payments',
    fmt: v => fmtBRL(v, 2),
    fmtEixo: v => `R$ ${fmtCompacto(v)}`,
  },
  sessions: {
    label: 'Recargas',
    resumo: 'soma',
    detalhe: 'sessões iniciadas',
    color: 'var(--primary)',
    icon: 'bolt',
    fmt: v => fmtInt(v),
    fmtEixo: v => fmtCompacto(v),
  },
  energy: {
    label: 'Energia',
    resumo: 'soma',
    detalhe: 'entregue no período',
    color: '#88f6ff',
    icon: 'electric_bolt',
    fmt: v => `${fmtNum(v, 1)} kWh`,
    fmtEixo: v => `${fmtCompacto(v)} kWh`,
  },
  users: {
    label: 'Motoristas por dia',
    resumo: 'media',
    detalhe: 'média de pessoas diferentes por dia',
    color: '#00deea',
    icon: 'group',
    fmt: v => fmtNum(v, v >= 100 ? 0 : 1),
    fmtEixo: v => fmtCompacto(v),
  },
};

const ORDEM_METRICAS: MetricType[] = ['revenue', 'sessions', 'energy', 'users'];

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const hojeIso = () => iso(new Date());
const trintaDiasAtrasIso = () => iso(subDays(new Date(), 29));
const dataCurta = (s: string) => format(dataLocal(s), 'dd/MM', { locale: ptBR });

/** Período anterior com o mesmo número de dias, terminando na véspera do início. */
function periodoAnterior(inicio: string, fim: string) {
  const ini = dataLocal(inicio);
  const dias = differenceInCalendarDays(dataLocal(fim), ini) + 1;
  return { inicio: iso(subDays(ini, dias)), fim: iso(subDays(ini, 1)), dias };
}

const somaOuMedia = (dados: PerformanceData[], m: MetricType) => {
  if (!dados.length) return 0;
  const soma = dados.reduce((s, d) => s + (Number(d[m]) || 0), 0);
  return metricsConfig[m].resumo === 'media' ? soma / dados.length : soma;
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1a1919',
    border: '1px solid #494847',
    borderRadius: 8,
    padding: 10,
  },
  labelStyle: { color: '#adaaaa', marginBottom: 4, fontSize: 12 },
};

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return null;
  if (valor === 0)
    return (
      <span className="inline-flex items-center rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
        igual
      </span>
    );
  const subiu = valor > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${subiu ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}
    >
      <span className="material-symbols-outlined text-[14px] leading-none">
        {subiu ? 'arrow_upward' : 'arrow_downward'}
      </span>
      {fmtVar(Math.abs(valor)).replace('+', '')}
    </span>
  );
}

const EvolucaoDiaria = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [anteriores, setAnteriores] = useState<PerformanceData[] | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');
  const [startDate, setStartDate] = useState<string>(trintaDiasAtrasIso());
  const [endDate, setEndDate] = useState<string>(hojeIso());
  const [chartType, setChartType] = useState<ChartType>('area');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodoValido = !!startDate && !!endDate && startDate <= endDate;
  const anterior = periodoValido ? periodoAnterior(startDate, endDate) : null;

  const buscar = async (ini: string, fim: string): Promise<PerformanceData[] | null> => {
    const resp = await api.get(`/performance-data?startDate=${ini}&endDate=${fim}`);
    if (!resp.ok) return null;
    const d = await resp.json();
    return Array.isArray(d) ? d : [];
  };

  const fetchData = useCallback(async () => {
    if (!periodoValido || !anterior) return;
    setLoading(true);
    setError(null);
    try {
      const [atual, antes] = await Promise.all([
        buscar(startDate, endDate),
        buscar(anterior.inicio, anterior.fim).catch(() => null),
      ]);
      if (atual === null) {
        setPerformanceData([]);
        setError('Não foi possível carregar os dados do período.');
      } else {
        setPerformanceData(atual);
      }
      setAnteriores(antes);
    } catch {
      setError('Erro ao conectar com o servidor.');
      setPerformanceData([]);
      setAnteriores(null);
    } finally {
      setLoading(false);
    }
    // anterior deriva de startDate/endDate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, periodoValido]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const atualizar = async () => {
    await fetchData();
    toast.success('Dados atualizados');
  };

  const config = metricsConfig[selectedMetric];

  const chartData = useMemo(
    () =>
      performanceData.map(d => ({
        dia: d.date,
        rotulo: dataCurta(d.date),
        valor: Number(d[selectedMetric]) || 0,
      })),
    [performanceData, selectedMetric]
  );

  const estatisticas = useMemo(() => {
    if (!chartData.length) return null;
    const soma = chartData.reduce((s, d) => s + d.valor, 0);
    const melhor = chartData.reduce((m, d) => (d.valor > m.valor ? d : m), chartData[0]);
    const comMovimento = performanceData.filter(d => d.sessions > 0).length;
    return { media: soma / chartData.length, melhor, comMovimento, dias: chartData.length };
  }, [chartData, performanceData]);

  const hasData = chartData.some(d => d.valor > 0);

  const renderChart = () => {
    const eixoX = {
      dataKey: 'rotulo',
      tick: { fill: '#adaaaa', fontSize: 11 },
      axisLine: false,
      tickLine: false,
      minTickGap: 16,
      dy: 6,
    };
    const eixoY = {
      tick: { fill: '#adaaaa', fontSize: 11 },
      axisLine: false,
      tickLine: false,
      width: 72,
      tickFormatter: (v: number) => config.fmtEixo(Number(v)),
    };
    const grade = {
      strokeDasharray: '3 3',
      stroke: '#494847',
      strokeOpacity: 0.3,
      vertical: false as const,
    };
    const dica = {
      ...tooltipStyle,
      itemStyle: { color: config.color, fontSize: 13 },
      labelFormatter: (_: unknown, p: Array<{ payload?: { dia: string } }>) =>
        p?.[0]?.payload?.dia
          ? format(dataLocal(p[0].payload.dia), "EEEE, dd 'de' MMMM", { locale: ptBR })
          : '',
      formatter: (value: number) => [config.fmt(Number(value)), config.label] as [string, string],
    };
    const comum = { data: chartData, margin: { top: 10, right: 12, left: 0, bottom: 0 } };
    const pontoAtivo = { r: 5, stroke: '#0e0e0e', strokeWidth: 2, fill: config.color };

    if (chartType === 'bar')
      return (
        <BarChart {...comum}>
          <CartesianGrid {...grade} />
          <XAxis {...eixoX} />
          <YAxis {...eixoY} />
          <Tooltip {...dica} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="valor" fill={config.color} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      );

    if (chartType === 'line')
      return (
        <LineChart {...comum}>
          <CartesianGrid {...grade} />
          <XAxis {...eixoX} />
          <YAxis {...eixoY} />
          <Tooltip {...dica} />
          <Line
            type="monotone"
            dataKey="valor"
            stroke={config.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={pontoAtivo}
          />
        </LineChart>
      );

    return (
      <AreaChart {...comum}>
        <defs>
          <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={config.color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={config.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...grade} />
        <XAxis {...eixoX} />
        <YAxis {...eixoY} />
        <Tooltip {...dica} />
        <Area
          type="monotone"
          dataKey="valor"
          stroke={config.color}
          strokeWidth={2.5}
          fill={`url(#grad-${selectedMetric})`}
          dot={false}
          activeDot={pontoAtivo}
        />
      </AreaChart>
    );
  };

  return (
    <div className="space-y-6">
      {/* Período e ações */}
      <div className="space-y-2 no-print">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 sm:flex-none">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => {
                setStartDate(trintaDiasAtrasIso());
                setEndDate(hojeIso());
              }}
              className="h-10 rounded-full w-full sm:w-auto"
            />
          </div>
          {anterior && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">compare_arrows</span>
              {anterior.dias} {anterior.dias === 1 ? 'dia' : 'dias'} · comparado com{' '}
              {dataCurta(anterior.inicio)}–{dataCurta(anterior.fim)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void atualizar()}
            disabled={loading || !periodoValido}
            title="Atualizar dados"
            aria-label="Atualizar dados"
            className="ml-auto h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
        {anterior && (
          <span className="inline-flex sm:hidden items-center gap-1 rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">compare_arrows</span>
            {anterior.dias} {anterior.dias === 1 ? 'dia' : 'dias'} · comparado com{' '}
            {dataCurta(anterior.inicio)}–{dataCurta(anterior.fim)}
          </span>
        )}
      </div>

      {!periodoValido && (
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-high/40 p-4 text-sm text-on-surface-variant">
          Escolha a data inicial e a final para ver os indicadores.
        </div>
      )}

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-4 text-error text-sm">
          {error}
        </div>
      )}

      {/* Indicadores do período (clique para ver no gráfico) */}
      <section aria-label="Indicadores do período" className="space-y-3">
        <h3 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">insights</span>
          Resumo do período
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {ORDEM_METRICAS.map(key => {
            const cfg = metricsConfig[key];
            const total = somaOuMedia(performanceData, key);
            const antes = anteriores ? somaOuMedia(anteriores, key) : null;
            const vari = antes === null ? null : variacaoPct(total, antes);
            const ativo = selectedMetric === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedMetric(key)}
                aria-pressed={ativo}
                className={`glass-panel text-left rounded-xl border p-4 lg:p-5 flex flex-col gap-2 min-w-0 transition-all ${
                  ativo
                    ? 'border-primary/60 ring-2 ring-primary/20 bg-primary/5'
                    : 'border-outline-variant/10 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 text-on-surface-variant min-w-0">
                  <span
                    className="material-symbols-outlined text-lg shrink-0"
                    style={{ color: cfg.color }}
                  >
                    {cfg.icon}
                  </span>
                  <span className="text-sm font-medium leading-tight">{cfg.label}</span>
                </div>
                {loading ? (
                  <span className="h-8 w-3/4 rounded-md bg-surface-container-highest animate-pulse" />
                ) : (
                  <span className="text-xl sm:text-2xl lg:text-[1.7rem] font-headline font-bold text-on-surface tabular-nums leading-tight break-words">
                    {cfg.fmt(total)}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[22px]">
                  {!loading && <Variacao valor={vari} />}
                  <span className="text-xs text-on-surface-variant">
                    {!loading && antes !== null ? `antes: ${cfg.fmt(antes)}` : cfg.detalhe}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Gráfico */}
      <section className="glass-panel rounded-xl border border-outline-variant/10 p-5 lg:p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h3 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">show_chart</span>
              {config.label} dia a dia
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Escolha um indicador acima para trocar o gráfico.
            </p>
          </div>
          <div className="inline-flex self-start rounded-full bg-surface-container-high p-1 no-print">
            {(
              [
                { type: 'area', icon: 'area_chart', label: 'Área' },
                { type: 'bar', icon: 'bar_chart', label: 'Barras' },
                { type: 'line', icon: 'show_chart', label: 'Linha' },
              ] as Array<{ type: ChartType; icon: string; label: string }>
            ).map(ct => (
              <button
                key={ct.type}
                type="button"
                onClick={() => setChartType(ct.type)}
                aria-pressed={chartType === ct.type}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  chartType === ct.type
                    ? 'bg-surface-container-lowest text-primary shadow'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">{ct.icon}</span>
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {estatisticas && hasData && !loading && (
          <dl className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-lg bg-surface-container-high/40 px-2.5 sm:px-3 py-2 min-w-0">
              <dt className="text-xs text-on-surface-variant">Média por dia</dt>
              <dd className="text-[13px] sm:text-sm font-semibold text-on-surface tabular-nums break-words">
                {config.fmt(estatisticas.media)}
              </dd>
            </div>
            <div className="rounded-lg bg-surface-container-high/40 px-2.5 sm:px-3 py-2 min-w-0">
              <dt className="text-xs text-on-surface-variant">Melhor dia</dt>
              <dd className="text-[13px] sm:text-sm font-semibold text-on-surface tabular-nums break-words">
                {config.fmt(estatisticas.melhor.valor)}{' '}
                <span className="font-normal text-on-surface-variant">
                  <span className="block sm:inline text-xs sm:text-sm">
                    em {estatisticas.melhor.rotulo}
                  </span>
                </span>
              </dd>
            </div>
            <div className="rounded-lg bg-surface-container-high/40 px-2.5 sm:px-3 py-2 min-w-0">
              <dt className="text-xs text-on-surface-variant">Dias com recarga</dt>
              <dd className="text-[13px] sm:text-sm font-semibold text-on-surface tabular-nums break-words">
                {estatisticas.comMovimento} de {estatisticas.dias}
              </dd>
            </div>
          </dl>
        )}

        {loading ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-on-surface-variant text-sm">Carregando indicadores…</p>
          </div>
        ) : !hasData ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-2 text-center px-4">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: 44 }}>
              event_busy
            </span>
            <p className="text-on-surface font-medium">Nenhuma recarga neste período</p>
            <p className="text-on-surface-variant text-sm max-w-sm">
              Escolha outro período no calendário acima ou volte depois que houver novas recargas.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {renderChart()}
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
};

type Aba = 'mensal' | 'diario';

export const Indicators = () => {
  const { user } = useAuth();
  const podeVerMensal = user?.role === 'admin' || (user?.role === 'operador' && !!user?.clientId);
  const [aba, setAba] = useState<Aba>(podeVerMensal ? 'mensal' : 'diario');

  const abas: Array<{ id: Aba; rotulo: string; icone: string; descricao: string }> = [
    ...(podeVerMensal
      ? [
          {
            id: 'mensal' as Aba,
            rotulo: 'Relatório mensal',
            icone: 'calendar_month',
            descricao: 'Fechamento do mês, destaques, metas e comparação com o mês anterior.',
          },
        ]
      : []),
    {
      id: 'diario',
      rotulo: 'Evolução diária',
      icone: 'show_chart',
      descricao: 'Receita, recargas, energia e motoristas dia a dia, no período que você escolher.',
    },
  ];
  const atual = abas.find(a => a.id === aba) ?? abas[0];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 no-print">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">
            Desempenho da rede
          </span>
          <h2 className="text-3xl sm:text-4xl font-headline font-bold text-on-surface tracking-tight">
            Indicadores
          </h2>
          <p className="text-sm text-on-surface-variant">{atual.descricao}</p>
        </div>
        {abas.length > 1 && (
          <div
            role="tablist"
            className="grid grid-cols-2 sm:inline-flex rounded-full bg-surface-container-high p-1 self-stretch sm:self-start lg:self-auto"
          >
            {abas.map(a => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  aba === a.id
                    ? 'bg-primary text-on-primary shadow'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{a.icone}</span>
                {a.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>

      {aba === 'mensal' ? <RelatorioMensal /> : <EvolucaoDiaria />}
    </div>
  );
};
