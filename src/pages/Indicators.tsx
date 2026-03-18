import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  TrendingUp,
  Activity,
  DollarSign,
  Zap,
  Users,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  sessions: { label: 'Sessões', unit: '', color: '#10b981', icon: Activity, gradient: ['#10b981', '#059669'] },
  revenue: { label: 'Receita', unit: 'R$', color: '#22c55e', icon: DollarSign, gradient: ['#22c55e', '#16a34a'] },
  energy: { label: 'Energia', unit: 'kWh', color: '#fbbf24', icon: Zap, gradient: ['#fbbf24', '#f59e0b'] },
  users: { label: 'Usuários Ativos', unit: '', color: '#3b82f6', icon: Users, gradient: ['#3b82f6', '#2563eb'] },
};

const periodOptions = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

export const Indicators = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('30d');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchData();
  }, [selectedPeriod]);

  const fetchData = async () => {
    if (!refreshing) setLoading(true);
    setError(null);
    try {
      const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
      const [perfResponse, statsResponse] = await Promise.all([
        api.get(`/performance-data?days=${days}`),
        api.get('/dashboard-stats')
      ]);

      if (perfResponse.ok) {
        const data = await perfResponse.json();
        setPerformanceData(Array.isArray(data) ? data : []);
      } else {
        setPerformanceData([]);
        setError('Falha ao carregar dados de performance');
      }

      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        const kpis = stats.kpis || stats;
        setDashboardStats({
          totalTransactions: kpis.totalTransactions ?? 0,
          totalRevenue: kpis.totalRevenue ?? 0,
          totalEnergy: kpis.totalKwh ?? kpis.totalEnergy ?? 0,
          activeChargers: kpis.onlineStations ?? kpis.activeChargers ?? 0,
          totalUsers: kpis.totalUsers ?? 0,
        });
      }
    } catch (err) {
      console.error('Erro ao buscar dados de performance:', err);
      setError('Erro ao conectar com o servidor');
      setPerformanceData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Dados atualizados!');
  };

  const getChartData = () => {
    return performanceData.map(d => ({
      date: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`,
      sessions: d.sessions,
      revenue: d.revenue,
      energy: d.energy,
      users: d.users,
    }));
  };

  const calculateMetrics = (metric: MetricType) => {
    if (!performanceData || performanceData.length === 0) {
      return { total: 0, avg: 0, growth: 0, trend: 'up' as const };
    }

    const total = performanceData.reduce((sum, item) => sum + (Number(item[metric]) || 0), 0);
    const avg = total / performanceData.length;

    const midPoint = Math.floor(performanceData.length / 2);
    const firstHalf = performanceData.slice(0, midPoint).reduce((sum, item) => sum + (Number(item[metric]) || 0), 0);
    const secondHalf = performanceData.slice(midPoint).reduce((sum, item) => sum + (Number(item[metric]) || 0), 0);
    const growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    return { total, avg, growth, trend: growth >= 0 ? 'up' as const : 'down' as const };
  };

  const formatValue = (value: number | undefined | null, metric: MetricType) => {
    const cfg = metricsConfig[metric];
    const v = value ?? 0;
    if (metric === 'revenue') return `${cfg.unit} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (metric === 'energy') return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${cfg.unit}`;
    return v.toLocaleString('pt-BR');
  };

  const chartData = getChartData();
  const config = metricsConfig[selectedMetric];
  const hasData = chartData.length > 0 && chartData.some(d => (d as any)[selectedMetric] > 0);

  const renderChart = () => {
    if (!hasData) {
      return (
        <div className="h-[400px] flex flex-col items-center justify-center gap-3">
          <BarChart3 className="w-16 h-16 text-zinc-700" />
          <p className="text-zinc-500 text-lg">Sem dados para o período selecionado</p>
          <p className="text-zinc-600 text-sm">Selecione um período diferente ou aguarde novas transações</p>
        </div>
      );
    }

    const commonProps = { data: chartData, margin: { top: 10, right: 30, left: 10, bottom: 0 } };

    const gridAndAxes = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#71717a"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={{ stroke: '#27272a' }}
          tickLine={false}
          interval={chartData.length > 30 ? Math.floor(chartData.length / 10) : undefined}
        />
        <YAxis
          stroke="#71717a"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={65}
          tickFormatter={(value: number) => {
            if (selectedMetric === 'revenue') return `R$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`;
            if (selectedMetric === 'energy') return `${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} kWh`;
            return String(value);
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            padding: '12px',
          }}
          labelStyle={{ color: '#a1a1aa', marginBottom: '6px', fontSize: '12px' }}
          itemStyle={{ color: config.color, fontSize: '13px' }}
          formatter={(value: number) => [formatValue(value, selectedMetric), config.label]}
        />
      </>
    );

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {gridAndAxes}
            <Bar dataKey={selectedMetric} fill={config.color} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps}>
            {gridAndAxes}
            <Line
              type="monotone"
              dataKey={selectedMetric}
              stroke={config.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#18181b', fill: config.color }}
            />
          </LineChart>
        );
      default:
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.gradient[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={config.gradient[1]} stopOpacity={0} />
              </linearGradient>
            </defs>
            {gridAndAxes}
            <Area
              type="monotone"
              dataKey={selectedMetric}
              stroke={config.color}
              strokeWidth={2.5}
              fill={`url(#gradient-${selectedMetric})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#18181b', fill: config.color }}
            />
          </AreaChart>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-zinc-500">Carregando indicadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-emerald-400" />
            Indicadores de Performance
          </h1>
          <p className="text-zinc-400 mt-1">Análise detalhada das métricas do sistema</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 transition-all text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(metricsConfig) as MetricType[]).map(metricKey => {
          const metricConfig = metricsConfig[metricKey];
          const metrics = calculateMetrics(metricKey);
          const Icon = metricConfig.icon;
          const isSelected = selectedMetric === metricKey;

          return (
            <Card
              key={metricKey}
              className={`cursor-pointer transition-all duration-200 ${isSelected
                ? 'bg-zinc-800/80 border-emerald-500/70 shadow-lg shadow-emerald-900/20 ring-1 ring-emerald-500/30'
                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
              }`}
              onClick={() => setSelectedMetric(metricKey)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-zinc-400 font-medium">{metricConfig.label}</span>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${metricConfig.color}20` }}>
                    <Icon className="w-4 h-4" style={{ color: metricConfig.color }} />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-bold text-white">
                    {formatValue(metrics.total, metricKey)}
                  </p>
                  {metrics.trend === 'up' ? (
                    <div className="flex items-center gap-0.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">+{Math.abs(metrics.growth).toFixed(1)}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">{metrics.growth.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart Section */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <config.icon className="w-5 h-5" style={{ color: config.color }} />
                {config.label} ao Longo do Tempo
              </CardTitle>
              <p className="text-sm text-zinc-500 mt-1">
                Média diária: {formatValue(calculateMetrics(selectedMetric).avg, selectedMetric)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Period Selector */}
              <div className="flex items-center gap-0.5 p-1 bg-zinc-800 rounded-lg border border-zinc-700">
                {periodOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedPeriod(option.value as PeriodType)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedPeriod === option.value
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Chart Type Selector */}
              <div className="flex items-center gap-0.5 p-1 bg-zinc-800 rounded-lg border border-zinc-700">
                <button
                  onClick={() => setChartType('area')}
                  className={`p-1.5 rounded-md transition-all ${chartType === 'area' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Área"
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`p-1.5 rounded-md transition-all ${chartType === 'bar' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Barras"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`p-1.5 rounded-md transition-all ${chartType === 'line' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Linha"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-2">
          <ResponsiveContainer width="100%" height={400}>
            {renderChart()}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Transações</p>
                  <p className="text-xl font-bold text-white mt-1">
                    {(dashboardStats.totalTransactions ?? 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Receita Total</p>
                  <p className="text-xl font-bold text-white mt-1">
                    R$ {(dashboardStats.totalRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-2.5 bg-green-500/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Energia</p>
                  <p className="text-xl font-bold text-white mt-1">
                    {(dashboardStats.totalEnergy ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kWh
                  </p>
                </div>
                <div className="p-2.5 bg-amber-500/10 rounded-lg">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Usuários</p>
                  <p className="text-xl font-bold text-white mt-1">
                    {(dashboardStats.totalUsers ?? 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="p-2.5 bg-blue-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
