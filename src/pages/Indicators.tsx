import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Zap,
  Users,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

// Lazy load Recharts components
const LineChart = lazy(() => import('recharts').then(mod => ({ default: mod.LineChart })));
const AreaChart = lazy(() => import('recharts').then(mod => ({ default: mod.AreaChart })));
const BarChart = lazy(() => import('recharts').then(mod => ({ default: mod.BarChart })));
const Bar = lazy(() => import('recharts').then(mod => ({ default: mod.Bar })));
const Line = lazy(() => import('recharts').then(mod => ({ default: mod.Line })));
const Area = lazy(() => import('recharts').then(mod => ({ default: mod.Area })));
const XAxis = lazy(() => import('recharts').then(mod => ({ default: mod.XAxis })));
const YAxis = lazy(() => import('recharts').then(mod => ({ default: mod.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(mod => ({ default: mod.Tooltip })));
const Legend = lazy(() => import('recharts').then(mod => ({ default: mod.Legend })));
const ResponsiveContainer = lazy(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })));

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
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
];

export const Indicators = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('30d');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void fetchData();
  }, [selectedPeriod]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [perfResponse, statsResponse] = await Promise.all([
        api.get('/performance-data'),
        api.get('/dashboard-stats')
      ]);

      if (perfResponse.ok) {
        const data = await perfResponse.json();
        // Filter based on selected period
        const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
        const filteredData = data.slice(-days);
        setPerformanceData(filteredData);
      }

      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setDashboardStats(stats);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de performance:', error);
      toast.error('Erro ao buscar dados de performance');
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
      date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
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

    const total = performanceData.reduce((sum, item) => sum + parseFloat(item[metric].toString()), 0);
    const avg = total / performanceData.length;

    // Calculate growth (compare first half vs second half)
    const midPoint = Math.floor(performanceData.length / 2);
    const firstHalf = performanceData.slice(0, midPoint).reduce((sum, item) => sum + parseFloat(item[metric].toString()), 0);
    const secondHalf = performanceData.slice(midPoint).reduce((sum, item) => sum + parseFloat(item[metric].toString()), 0);
    const growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    return { total, avg, growth, trend: growth >= 0 ? 'up' as const : 'down' as const };
  };

  const formatValue = (value: number | undefined | null, metric: MetricType) => {
    const config = metricsConfig[metric];
    const safeValue = value ?? 0;
    if (metric === 'revenue') {
      return `${config.unit} ${safeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (metric === 'energy') {
      return `${safeValue.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${config.unit}`;
    }
    return safeValue.toLocaleString('pt-BR');
  };

  const chartData = getChartData();
  const config = metricsConfig[selectedMetric];

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 }
    };

    const gridAndAxes = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#71717a"
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={{ stroke: '#27272a' }}
        />
        <YAxis
          stroke="#71717a"
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={{ stroke: '#27272a' }}
          tickFormatter={(value) => {
            if (selectedMetric === 'revenue') return `R$${value}`;
            if (selectedMetric === 'energy') return `${value}kWh`;
            return value;
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}
          labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
          itemStyle={{ color: config.color }}
          formatter={(value: number) => [formatValue(value, selectedMetric), config.label]}
        />
      </>
    );

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {gridAndAxes}
            <Bar
              dataKey={selectedMetric}
              fill={config.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
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
              strokeWidth={3}
              dot={{ fill: config.color, r: 4, strokeWidth: 2, stroke: '#18181b' }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#18181b' }}
            />
          </LineChart>
        );
      default:
        return (
          <AreaChart {...commonProps}>
            {gridAndAxes}
            <defs>
              <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.gradient[0]} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={config.gradient[1]} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={selectedMetric}
              stroke={config.color}
              strokeWidth={3}
              fill={`url(#gradient-${selectedMetric})`}
              dot={{ fill: config.color, r: 4, strokeWidth: 2, stroke: '#18181b' }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#18181b' }}
            />
          </AreaChart>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-emerald-300/60">Carregando indicadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-400" />
            Indicadores de Performance
          </h1>
          <p className="text-emerald-300/60 mt-1">Análise detalhada das métricas do sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-800/30 rounded-lg text-emerald-300 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

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
              className={`cursor-pointer transition-all duration-300 ${
                isSelected
                  ? 'bg-gradient-to-br from-emerald-600/30 to-emerald-800/20 border-emerald-500 shadow-lg shadow-emerald-900/30'
                  : 'bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 hover:border-emerald-600/50 hover:shadow-lg hover:shadow-emerald-900/20'
              }`}
              onClick={() => setSelectedMetric(metricKey)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-500/30' : 'bg-emerald-900/50'}`}>
                        <Icon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-sm text-emerald-300/70 font-medium">{metricConfig.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-50">
                      {formatValue(metrics.total, metricKey)}
                    </p>
                    <div className="flex items-center gap-2">
                      {metrics.trend === 'up' ? (
                        <div className="flex items-center gap-1 text-emerald-400">
                          <ArrowUpRight className="w-4 h-4" />
                          <span className="text-sm font-medium">+{Math.abs(metrics.growth).toFixed(1)}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-400">
                          <ArrowDownRight className="w-4 h-4" />
                          <span className="text-sm font-medium">{metrics.growth.toFixed(1)}%</span>
                        </div>
                      )}
                      <span className="text-xs text-emerald-300/50">vs período anterior</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart Section */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl text-emerald-50 flex items-center gap-2">
                <config.icon className="w-5 h-5 text-emerald-400" />
                {config.label} ao Longo do Tempo
              </CardTitle>
              <p className="text-sm text-emerald-300/60 mt-1">
                Média diária: {formatValue(calculateMetrics(selectedMetric).avg, selectedMetric)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="flex items-center gap-1 p-1 bg-emerald-950/50 rounded-lg border border-emerald-800/30">
                {periodOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedPeriod(option.value as PeriodType)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      selectedPeriod === option.value
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-300/70 hover:text-emerald-200'
                    }`}
                  >
                    {option.label.replace('Últimos ', '')}
                  </button>
                ))}
              </div>

              {/* Chart Type Selector */}
              <div className="flex items-center gap-1 p-1 bg-emerald-950/50 rounded-lg border border-emerald-800/30">
                <button
                  onClick={() => setChartType('area')}
                  className={`p-2 rounded-md transition-all ${chartType === 'area' ? 'bg-emerald-600 text-white' : 'text-emerald-300/70 hover:text-emerald-200'}`}
                  title="Área"
                >
                  <Activity className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`p-2 rounded-md transition-all ${chartType === 'bar' ? 'bg-emerald-600 text-white' : 'text-emerald-300/70 hover:text-emerald-200'}`}
                  title="Barras"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`p-2 rounded-md transition-all ${chartType === 'line' ? 'bg-emerald-600 text-white' : 'text-emerald-300/70 hover:text-emerald-200'}`}
                  title="Linha"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Suspense fallback={<div className="h-[400px] bg-emerald-900/20 animate-pulse rounded-lg" />}>
            <ResponsiveContainer width="100%" height={400}>
              {renderChart()}
            </ResponsiveContainer>
          </Suspense>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-300/70">Total de Transações</p>
                  <p className="text-2xl font-bold text-emerald-50 mt-1">
                    {(dashboardStats.totalTransactions ?? 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <Activity className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-300/70">Receita Total</p>
                  <p className="text-2xl font-bold text-emerald-50 mt-1">
                    R$ {(dashboardStats.totalRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-300/70">Energia Fornecida</p>
                  <p className="text-2xl font-bold text-emerald-50 mt-1">
                    {(dashboardStats.totalEnergy ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kWh
                  </p>
                </div>
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <Zap className="w-6 h-6 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
