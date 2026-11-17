import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
} from '../components/painel/Pagina';
import {
  fmtBRL,
  fmtCompacto,
  fmtInt,
  fmtNum,
  fmtVar,
  variacaoPct,
} from '../components/indicadores/tipos';

/*
 * Indicadores — redesenho de nov/2026 (Figma da Lauriane, frame "Indicadores").
 * Quem vê o relatório mensal (admin e operador da marca) recebe a tela do Figma,
 * com a evolução diária recolhida no pé da página (o Figma não a mostra). Os
 * outros veem só a evolução diária, com o mesmo cabeçalho.
 */

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
  /** Cor do gráfico e do ícone, dos tokens do tema (claro e escuro). */
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
    color: 'var(--primary)',
    icon: 'payments',
    fmt: v => fmtBRL(v, 2),
    fmtEixo: v => `R$ ${fmtCompacto(v)}`,
  },
  sessions: {
    label: 'Recargas',
    resumo: 'soma',
    detalhe: 'sessões iniciadas',
    color: 'var(--color-primary-strong)',
    icon: 'bolt',
    fmt: v => fmtInt(v),
    fmtEixo: v => fmtCompacto(v),
  },
  energy: {
    label: 'Energia',
    resumo: 'soma',
    detalhe: 'entregue no período',
    color: 'var(--color-tom-azul-icone)',
    icon: 'electric_bolt',
    fmt: v => `${fmtNum(v, 1)} kWh`,
    fmtEixo: v => `${fmtCompacto(v)} kWh`,
  },
  users: {
    label: 'Motoristas por dia',
    resumo: 'media',
    detalhe: 'média de pessoas diferentes por dia',
    color: 'var(--color-tom-amarelo-icone)',
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
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: 10,
    color: 'var(--color-foreground)',
  },
  labelStyle: {
    color: 'var(--color-muted-foreground)',
    marginBottom: 4,
    fontSize: 12,
    fontWeight: 600,
  },
};

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return null;
  if (valor === 0)
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        igual
      </span>
    );
  const subiu = valor > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${subiu ? 'bg-estado-livre text-estado-livre-forte' : 'bg-destructive/10 text-destructive'}`}
    >
      <span className="material-symbols-outlined text-[14px] leading-none">
        {subiu ? 'arrow_upward' : 'arrow_downward'}
      </span>
      {fmtVar(Math.abs(valor)).replace('+', '')}
    </span>
  );
}

const TITULO = { rotulo: 'Desempenho da rede', titulo: 'Indicadores' };

/**
 * Receita, recargas, energia e motoristas dia a dia, no período escolhido.
 * `comCabecalho`: a tela inteira (quem não vê o relatório mensal). Sem ele, é
 * a "Evolução diária" do pé do relatório, que busca de novo quando
 * `atualizacao` muda (o "Atualizar" do cabeçalho do relatório).
 */
const EvolucaoDiaria = ({
  comCabecalho = false,
  atualizacao = 0,
}: {
  comCabecalho?: boolean;
  atualizacao?: number;
}) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [anteriores, setAnteriores] = useState<PerformanceData[] | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');
  const [startDate, setStartDate] = useState<string>(trintaDiasAtrasIso());
  const [endDate, setEndDate] = useState<string>(hojeIso());
  const [chartType, setChartType] = useState<ChartType>('area');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  // Período cujos números estão na tela: se a atualização dele falhar, eles ficam.
  const periodoNaTela = useRef<string | null>(null);

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
    const periodo = `${startDate}|${endDate}`;
    const manterSeFalhar = periodoNaTela.current === periodo;
    const falhar = (mensagem: string) => {
      if (manterSeFalhar) {
        setFalhou(true);
      } else {
        periodoNaTela.current = null;
        setPerformanceData([]);
        setAnteriores(null);
        setError(mensagem);
      }
    };
    setLoading(true);
    setError(null);
    try {
      const [atual, antes] = await Promise.all([
        buscar(startDate, endDate),
        buscar(anterior.inicio, anterior.fim).catch(() => null),
      ]);
      if (atual === null) {
        falhar('Não foi possível carregar os dados do período.');
      } else {
        setPerformanceData(atual);
        setAnteriores(antes);
        periodoNaTela.current = periodo;
        setFalhou(false);
        setAtualizadoEm(new Date());
      }
    } catch {
      falhar('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
    // anterior deriva de startDate/endDate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, periodoValido]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // "Atualizar" do cabeçalho do relatório mensal (a primeira busca já veio acima).
  const ultimaAtualizacao = useRef(atualizacao);
  useEffect(() => {
    if (atualizacao === ultimaAtualizacao.current) return;
    ultimaAtualizacao.current = atualizacao;
    void fetchData();
  }, [atualizacao, fetchData]);

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
      tick: { fill: 'var(--color-muted-foreground)', fontSize: 11 },
      axisLine: false,
      tickLine: false,
      minTickGap: 16,
      dy: 6,
    };
    const eixoY = {
      tick: { fill: 'var(--color-muted-foreground)', fontSize: 11 },
      axisLine: false,
      tickLine: false,
      width: 72,
      tickFormatter: (v: number) => config.fmtEixo(Number(v)),
    };
    const grade = {
      stroke: 'var(--color-border)',
      vertical: false as const,
    };
    const dica = {
      ...tooltipStyle,
      itemStyle: { color: 'var(--color-foreground)', fontSize: 13, fontWeight: 600 },
      labelFormatter: (_: unknown, p: Array<{ payload?: { dia: string } }>) =>
        p?.[0]?.payload?.dia
          ? format(dataLocal(p[0].payload.dia), "EEEE, dd 'de' MMMM", { locale: ptBR })
          : '',
      formatter: (value: number) => [config.fmt(Number(value)), config.label] as [string, string],
    };
    const comum = { data: chartData, margin: { top: 10, right: 12, left: 0, bottom: 0 } };
    const pontoAtivo = {
      r: 5,
      stroke: 'var(--color-card)',
      strokeWidth: 2,
      fill: config.color,
    };
    const cursor = { fill: 'var(--color-muted)', fillOpacity: 0.6 };

    if (chartType === 'bar')
      return (
        <BarChart {...comum}>
          <CartesianGrid {...grade} />
          <XAxis {...eixoX} />
          <YAxis {...eixoY} />
          <Tooltip {...dica} cursor={cursor} />
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
            <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
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

  const seletorDoPeriodo = (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      onClear={() => {
        setStartDate(trintaDiasAtrasIso());
        setEndDate(hojeIso());
      }}
      className={`${classeDaPilula} justify-start`}
    />
  );

  const comparacao = anterior && (
    <span className="inline-flex items-center gap-1.5 h-[43px] px-5 rounded-[25px] border border-tom-azul-icone bg-tom-azul/50 text-[#0670b0] dark:text-tom-azul-icone text-[13px] font-medium">
      <span className="material-symbols-outlined text-base">compare_arrows</span>
      {anterior.dias} {anterior.dias === 1 ? 'dia' : 'dias'} · comparado com{' '}
      {dataCurta(anterior.inicio)}–{dataCurta(anterior.fim)}
    </span>
  );

  return (
    <div className="space-y-[25px]">
      {comCabecalho ? (
        <div className="no-print">
          <CabecalhoDaPagina
            rotulo={TITULO.rotulo}
            titulo={TITULO.titulo}
            subtitulo="Receita, recargas, energia e motoristas dia a dia, no período que você escolher"
            detalhe={comparacao && <div className="mt-1">{comparacao}</div>}
            filtros={seletorDoPeriodo}
            acoes={
              <BotaoAtualizar
                aoAtualizar={() => void fetchData()}
                carregando={loading}
                atualizadoEm={atualizadoEm}
                falhou={falhou}
              />
            }
          />
        </div>
      ) : (
        /* Período e comparação (o "Atualizar" é o do cabeçalho do relatório) */
        <div className="no-print flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-[17px]">
          {seletorDoPeriodo}
          {comparacao}
        </div>
      )}

      {!periodoValido && (
        <div className={`${classeDoCartao} p-4 text-sm text-muted-foreground`}>
          Escolha a data inicial e a final para ver os indicadores.
        </div>
      )}

      {error && (
        <div className="rounded-[15px] bg-destructive/10 p-4 text-destructive text-[15px] font-medium">
          {error}
        </div>
      )}

      {/* Indicadores do período (clique para ver no gráfico) */}
      <section aria-label="Indicadores do período" className="space-y-3">
        <h3 className="text-[20px] font-semibold text-foreground">Resumo do período</h3>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-[25px]">
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
                className={`${classeDoCartao} text-left p-4 lg:p-[22px] flex flex-col gap-2 min-w-0 transition-shadow ${
                  ativo ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden="true"
                    className="w-[41px] h-[38px] rounded-[5px] bg-muted flex items-center justify-center shrink-0"
                  >
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ color: cfg.color }}
                    >
                      {cfg.icon}
                    </span>
                  </span>
                  <span className="text-base font-semibold leading-tight text-foreground">
                    {cfg.label}
                  </span>
                </div>
                {loading ? (
                  <span className="h-8 w-3/4 rounded-md bg-muted animate-pulse" />
                ) : (
                  <span className="text-xl sm:text-2xl lg:text-[28px] font-semibold text-foreground tabular-nums leading-tight break-words">
                    {cfg.fmt(total)}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[22px]">
                  {!loading && <Variacao valor={vari} />}
                  <span className="text-xs text-muted-foreground">
                    {!loading && antes !== null ? `antes: ${cfg.fmt(antes)}` : cfg.detalhe}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Gráfico */}
      <section className={`${classeDoCartao} p-[22px] 3xl:p-[26px]`}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h3 className="text-[20px] leading-tight font-semibold text-foreground">
              {config.label} dia a dia
            </h3>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              Escolha um indicador acima para trocar o gráfico.
            </p>
          </div>
          <div className="inline-flex self-start rounded-[25px] bg-muted p-1 no-print">
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
                className={`inline-flex items-center gap-1 h-[35px] px-4 rounded-[25px] text-sm font-medium transition-colors ${
                  chartType === ct.type
                    ? 'bg-card text-primary-strong shadow-pilula'
                    : 'text-muted-foreground hover:text-foreground'
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
            <div className="rounded-[10px] bg-muted/60 px-2.5 sm:px-3 py-2 min-w-0">
              <dt className="text-xs text-muted-foreground">Média por dia</dt>
              <dd className="text-[13px] sm:text-sm font-semibold text-foreground tabular-nums break-words">
                {config.fmt(estatisticas.media)}
              </dd>
            </div>
            <div className="rounded-[10px] bg-muted/60 px-2.5 sm:px-3 py-2 min-w-0">
              <dt className="text-xs text-muted-foreground">Melhor dia</dt>
              <dd className="text-[13px] sm:text-sm font-semibold text-foreground tabular-nums break-words">
                {config.fmt(estatisticas.melhor.valor)}{' '}
                <span className="font-normal text-muted-foreground">
                  <span className="block sm:inline text-xs sm:text-sm">
                    em {estatisticas.melhor.rotulo}
                  </span>
                </span>
              </dd>
            </div>
            <div className="rounded-[10px] bg-muted/60 px-2.5 sm:px-3 py-2 min-w-0">
              <dt className="text-xs text-muted-foreground">Dias com recarga</dt>
              <dd className="text-[13px] sm:text-sm font-semibold text-foreground tabular-nums break-words">
                {estatisticas.comMovimento} de {estatisticas.dias}
              </dd>
            </div>
          </dl>
        )}

        {loading ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground text-sm">Carregando indicadores…</p>
          </div>
        ) : !hasData ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-2 text-center px-4 rounded-[10px] border border-dashed border-border">
            <span
              className="material-symbols-outlined text-muted-foreground"
              style={{ fontSize: 44 }}
            >
              event_busy
            </span>
            <p className="text-foreground font-medium">Nenhuma recarga neste período</p>
            <p className="text-muted-foreground text-sm max-w-sm">
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

export const Indicators = () => {
  const { user } = useAuth();
  const podeVerMensal = user?.role === 'admin' || (user?.role === 'operador' && !!user?.clientId);

  return (
    <div className="pb-12">
      {podeVerMensal ? (
        <RelatorioMensal
          evolucaoDiaria={atualizacao => <EvolucaoDiaria atualizacao={atualizacao} />}
        />
      ) : (
        <EvolucaoDiaria comCabecalho />
      )}
    </div>
  );
};
