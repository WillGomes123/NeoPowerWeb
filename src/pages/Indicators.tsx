import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type MetricType = 'sessions' | 'revenue' | 'energy' | 'users';
type PeriodType = '7d' | '30d' | '90d';
type ChartType = 'area' | 'bar' | 'line';

interface PerformanceData {
  date: string;
  sessions: number;
  revenue: number;
  energy: number;
  users: number;
}

interface DashboardStats {
  totalTransactions: number;
  totalRevenue: number;
  totalEnergy: number;
  activeChargers: number;
  totalUsers?: number;
}

const metricsConfig = {
  sessions: { label: 'Sessões', unit: '', color: 'var(--primary)', icon: 'bolt', colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  revenue: { label: 'Receita', unit: 'R$', color: '#90f9a3', icon: 'payments', colorClass: 'text-secondary', bgClass: 'bg-secondary/10' },
  energy: { label: 'Energia', unit: 'kWh', color: '#88f6ff', icon: 'electric_bolt', colorClass: 'text-tertiary', bgClass: 'bg-tertiary/10' },
  users: { label: 'Usuários Ativos', unit: '', color: '#00deea', icon: 'group', colorClass: 'text-tertiary-dim', bgClass: 'bg-tertiary-dim/10' },
};

export const Indicators = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('30d');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void fetchData(); }, [selectedPeriod]);

  const fetchData = async () => {
    if (!refreshing) setLoading(true);
    setError(null);
    try {
      const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
      const [perfRes, statsRes] = await Promise.all([
        api.get(`/performance-data?days=${days}`),
        api.get('/dashboard-stats'),
      ]);
      if (perfRes.ok) { const d = await perfRes.json(); setPerformanceData(Array.isArray(d) ? d : []); }
      else { setPerformanceData([]); setError('Falha ao carregar dados'); }
      if (statsRes.ok) {
        const s = await statsRes.json();
        const k = s.kpis || s;
        setDashboardStats({
          totalTransactions: k.totalTransactions ?? 0,
          totalRevenue: k.totalRevenue ?? 0,
          totalEnergy: k.totalKwh ?? k.totalEnergy ?? 0,
          activeChargers: k.onlineStations ?? k.activeChargers ?? 0,
          totalUsers: k.totalUsers ?? 0,
        });
      }
    } catch { setError('Erro ao conectar com o servidor'); setPerformanceData([]); }
    finally { setLoading(false); }
  };

  const handleRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); toast.success('Dados atualizados!'); };

  const chartData = performanceData.map(d => ({
    date: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`,
    sessions: d.sessions, revenue: d.revenue, energy: d.energy, users: d.users,
  }));

  const calculateMetrics = (metric: MetricType) => {
    if (!performanceData.length) return { total: 0, avg: 0, growth: 0 };
    const total = performanceData.reduce((s, i) => s + (Number(i[metric]) || 0), 0);
    const avg = total / performanceData.length;
    const mid = Math.floor(performanceData.length / 2);
    const first = performanceData.slice(0, mid).reduce((s, i) => s + (Number(i[metric]) || 0), 0);
    const second = performanceData.slice(mid).reduce((s, i) => s + (Number(i[metric]) || 0), 0);
    const growth = first > 0 ? ((second - first) / first) * 100 : 0;
    return { total, avg, growth };
  };

  const formatValue = (v: number, metric: MetricType) => {
    if (metric === 'revenue') return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (metric === 'energy') return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`;
    return v.toLocaleString('pt-BR');
  };

  const config = metricsConfig[selectedMetric];
  const hasData = chartData.length > 0 && chartData.some(d => (d as any)[selectedMetric] > 0);

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1a1919', border: '1px solid #494847', borderRadius: '8px', backdropFilter: 'blur(8px)', padding: '12px' },
    labelStyle: { color: '#adaaaa', marginBottom: '6px', fontSize: '12px' },
    itemStyle: { color: config.color, fontSize: '13px' },
  };

  const renderChart = () => {
    if (!hasData) {
      return (
        <div className="h-[320px] flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined text-5xl text-outline">leaderboard</span>
          <p className="text-on-surface-variant">Sem dados para o período selecionado</p>
          <p className="text-outline text-sm">Selecione um período diferente ou aguarde novas transações</p>
        </div>
      );
    }

    const axisProps = {
      xAxis: { dataKey: 'date', stroke: '#777575', tick: { fill: '#adaaaa', fontSize: 10 }, axisLine: false, tickLine: false, dy: 10 },
      yAxis: { stroke: '#777575', tick: { fill: '#adaaaa', fontSize: 10 }, axisLine: false, tickLine: false, width: 65, tickFormatter: (v: number) => selectedMetric === 'revenue' ? `R$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}` : selectedMetric === 'energy' ? `${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} kWh` : String(v) },
      grid: { strokeDasharray: '3 3', stroke: '#494847', strokeOpacity: 0.3, vertical: false as const },
      tooltip: { ...tooltipStyle, formatter: (value: number) => [formatValue(value, selectedMetric), config.label] as [string, string] },
    };

    const common = { data: chartData, margin: { top: 10, right: 30, left: 10, bottom: 0 } };

    if (chartType === 'bar') return (
      <BarChart {...common}>
        <CartesianGrid {...axisProps.grid} />
        <XAxis {...axisProps.xAxis} />
        <YAxis {...axisProps.yAxis} />
        <Tooltip {...axisProps.tooltip} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey={selectedMetric} fill={config.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    );

    if (chartType === 'line') return (
      <LineChart {...common}>
        <CartesianGrid {...axisProps.grid} />
        <XAxis {...axisProps.xAxis} />
        <YAxis {...axisProps.yAxis} />
        <Tooltip {...axisProps.tooltip} />
        <Line type="monotone" dataKey={selectedMetric} stroke={config.color} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: '#0e0e0e', strokeWidth: 2, fill: config.color }} />
      </LineChart>
    );

    return (
      <AreaChart {...common}>
        <defs>
          <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={config.color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={config.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...axisProps.grid} />
        <XAxis {...axisProps.xAxis} />
        <YAxis {...axisProps.yAxis} />
        <Tooltip {...axisProps.tooltip} />
        <Area type="monotone" dataKey={selectedMetric} stroke={config.color} strokeWidth={2.5} fill={`url(#grad-${selectedMetric})`} dot={false} activeDot={{ r: 5, stroke: '#0e0e0e', strokeWidth: 2, fill: config.color }} />
      </AreaChart>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-on-surface-variant text-sm">Carregando indicadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">PERFORMANCE ANALYTICS</span>
        <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Indicadores</h2>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-4 text-error text-sm">{error}</div>
      )}

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {(Object.keys(metricsConfig) as MetricType[]).map(key => {
          const cfg = metricsConfig[key];
          const m = calculateMetrics(key);
          const isSelected = selectedMetric === key;

          return (
            <div
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={`glass-panel p-6 rounded-lg border-2 flex flex-col justify-between h-32 cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20 bg-primary/5'
                  : 'border-transparent hover:border-primary/30'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant text-xs uppercase tracking-widest">{cfg.label}</span>
                <span className={`material-symbols-outlined text-sm ${cfg.colorClass}`}>{cfg.icon}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-headline font-bold text-on-surface">{formatValue(m.total, key)}</span>
                <span className={`text-[10px] font-medium ${m.growth >= 0 ? 'text-primary/70' : 'text-error/70'}`}>
                  {m.growth >= 0 ? '↑' : '↓'} {Math.abs(m.growth).toFixed(1)}% vs período anterior
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Chart: Asymmetric Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart (2/3 width) */}
        <div className="lg:col-span-2 glass-panel rounded-lg border border-outline-variant/10 p-8 overflow-hidden relative">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="font-headline text-lg font-bold text-on-surface uppercase tracking-tight">
                {config.label} ao Longo do Tempo
              </h3>
              <p className="text-on-surface-variant text-xs">
                Média diária: {formatValue(calculateMetrics(selectedMetric).avg, selectedMetric)}
              </p>
            </div>
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as PeriodType[]).map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
                    selectedPeriod === p
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-surface-container-highest text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Type Selector */}
          <div className="flex gap-1 mb-6">
            {([
              { type: 'area' as ChartType, icon: 'area_chart', label: 'Área' },
              { type: 'bar' as ChartType, icon: 'bar_chart', label: 'Barras' },
              { type: 'line' as ChartType, icon: 'show_chart', label: 'Linha' },
            ]).map(ct => (
              <button
                key={ct.type}
                onClick={() => setChartType(ct.type)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  chartType === ct.type
                    ? 'bg-surface-container-highest text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{ct.icon}</span>
                {ct.label}
              </button>
            ))}
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className={`material-symbols-outlined text-sm ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
              Atualizar
            </button>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Side Panel: Summary Stats */}
        <div className="glass-panel rounded-lg border border-outline-variant/10 p-8 flex flex-col justify-between">
          <div>
            <h3 className="font-headline text-lg font-bold text-on-surface uppercase tracking-tight mb-8">Resumo do Sistema</h3>
            <div className="space-y-6">
              <SummaryRow icon="receipt_long" label="Transações" value={(dashboardStats?.totalTransactions ?? 0).toLocaleString('pt-BR')} color="text-primary" />
              <SummaryRow icon="payments" label="Receita Total" value={`R$ ${(dashboardStats?.totalRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-secondary" />
              <SummaryRow icon="bolt" label="Energia Total" value={`${(dashboardStats?.totalEnergy ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kWh`} color="text-tertiary" />
              <SummaryRow icon="group" label="Usuários" value={(dashboardStats?.totalUsers ?? 0).toLocaleString('pt-BR')} color="text-tertiary-dim" />
            </div>
          </div>

          {/* Active chargers indicator */}
          <div className="mt-8 pt-6 border-t border-outline-variant/10">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">ESTAÇÕES ATIVAS</p>
                <p className="text-lg font-headline font-bold">{dashboardStats?.activeChargers ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">PERÍODO</p>
                <p className="text-lg font-headline font-bold">
                  {selectedPeriod === '7d' ? '7 dias' : selectedPeriod === '30d' ? '30 dias' : '90 dias'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function SummaryRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center`}>
          <span className={`material-symbols-outlined text-base ${color}`}>{icon}</span>
        </div>
        <span className="text-xs text-on-surface">{label}</span>
      </div>
      <span className="text-xs font-bold text-on-surface">{value}</span>
    </div>
  );
}
