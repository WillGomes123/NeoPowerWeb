import React, { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { KPICard } from '../components/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { DollarSign, Zap, Ticket, Receipt, Wifi, WifiOff, RefreshCw, LayoutDashboard, Wallet, TrendingUp } from 'lucide-react';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { api } from '../lib/api';
import { useRealtimeStats } from '../lib/hooks/useSocket';
import { toast } from 'sonner';

// Lazy load Recharts components
const LineChart = lazy(() => import('recharts').then(mod => ({ default: mod.LineChart })));
const Line = lazy(() => import('recharts').then(mod => ({ default: mod.Line })));
const BarChart = lazy(() => import('recharts').then(mod => ({ default: mod.BarChart })));
const Bar = lazy(() => import('recharts').then(mod => ({ default: mod.Bar })));
const PieChart = lazy(() => import('recharts').then(mod => ({ default: mod.PieChart })));
const Pie = lazy(() => import('recharts').then(mod => ({ default: mod.Pie })));
const Cell = lazy(() => import('recharts').then(mod => ({ default: mod.Cell })));
const XAxis = lazy(() => import('recharts').then(mod => ({ default: mod.XAxis })));
const YAxis = lazy(() => import('recharts').then(mod => ({ default: mod.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(mod => ({ default: mod.Tooltip })));
const ResponsiveContainer = lazy(() =>
  import('recharts').then(mod => ({ default: mod.ResponsiveContainer }))
);
const Legend = lazy(() => import('recharts').then(mod => ({ default: mod.Legend })));

interface ChartPoint {
  date: string;
  value: number;
}

interface OverviewData {
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
  };
  activeVouchers?: number;
}

export const Overview = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previousData, setPreviousData] = useState<OverviewData | null>(null);

  // Real-time stats from WebSocket
  const { isConnected, onlineChargers, activeTransactions, lastUpdate } = useRealtimeStats();

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = '/overview-stats';
      const params = new URLSearchParams();

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const response = await api.get(endpoint);
      if (!response.ok) {
        throw new Error('Falha ao buscar dados da visão geral.');
      }
      const overviewData = await response.json();

      // Store previous data for comparison
      if (data) {
        setPreviousData(data);
      }

      setData(overviewData);
    } catch (err: any) {
      console.error('Erro ao buscar dados da visão geral:', err);
      setError(err.message || 'Erro ao buscar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOverview();
  }, [startDate, endDate]);

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  // Calculate real percentage changes
  const calculateChange = (current: number, previous: number | undefined): number | undefined => {
    if (!previous || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const statusCounts = useMemo(() => {
    if (!data?.chargers) return { online: 0, offline: 0, charging: 0 };
    return {
      online: data.chargers.online,
      offline: data.chargers.offline,
      charging: data.chargers.charging,
    };
  }, [data]);

  const activeVouchers = useMemo(() => {
    return data?.activeVouchers ?? 0;
  }, [data]);

  const statusData = [
    { name: 'Online', value: statusCounts.online },
    { name: 'Offline', value: statusCounts.offline },
    { name: 'Carregando', value: statusCounts.charging },
  ];

  const COLORS = {
    Online: '#10b981',
    Offline: '#71717a',
    Carregando: '#3b82f6',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-emerald-400" />
            Visão Geral
          </h1>
          <p className="text-emerald-300/60 mt-1">Dashboard principal de monitoramento</p>
        </div>
        {/* Real-time connection indicator */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isConnected
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-emerald-900/30 border border-emerald-800/30'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Tempo Real</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-emerald-500/50" />
                <span className="text-sm text-emerald-500/50">Offline</span>
              </>
            )}
          </div>
          {lastUpdate && (
            <div className="flex items-center gap-2 text-xs text-emerald-300/50">
              <RefreshCw className="w-3 h-3" />
              Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
            </div>
          )}
        </div>
      </div>

      {/* Date Filters */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs text-emerald-300/60 font-medium mb-1.5 block">Período</label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClear={handleClearFilters}
                className="min-w-[280px]"
              />
            </div>

            {(startDate || endDate) && (
              <div className="text-sm text-emerald-300/60 pt-5">
                Exibindo: {startDate ? new Date(startDate).toLocaleDateString('pt-BR') : 'Início'} até {endDate ? new Date(endDate).toLocaleDateString('pt-BR') : 'Hoje'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - Resumo Total */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receita Líquida Total"
          value={`R$ ${((data.revenueTotal || 0) + (data.totalDepositsNet || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          change={calculateChange(data.revenueTotal, previousData?.revenueTotal)}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KPICard
          title="Depósitos Líquidos"
          value={`R$ ${(data.totalDepositsNet || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<Wallet className="w-4 h-4" />}
        />
        <KPICard
          title="Taxa MP Descontada"
          value={`R$ ${(data.mercadoPagoFee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <KPICard
          title="Depósitos Brutos"
          value={`R$ ${(data.totalDepositsGross || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<Receipt className="w-4 h-4" />}
        />
      </div>

      {/* KPI Cards - Período */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={startDate || endDate ? "Receita (Período)" : "Receita (Hoje)"}
          value={`R$ ${data.revenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          change={calculateChange(data.revenueToday, previousData?.revenueToday)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <KPICard
          title="Receita (Mês)"
          value={`R$ ${data.revenueMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          change={calculateChange(data.revenueMonth, previousData?.revenueMonth)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <KPICard
          title={startDate || endDate ? "Energia (Período)" : "Energia (Hoje)"}
          value={`${data.kwhToday.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kWh`}
          change={calculateChange(data.kwhToday, previousData?.kwhToday)}
          icon={<Zap className="w-4 h-4" />}
        />
        <KPICard
          title="Energia (Mês)"
          value={`${data.kwhMonth.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kWh`}
          change={calculateChange(data.kwhMonth, previousData?.kwhMonth)}
          icon={<Zap className="w-4 h-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardHeader>
            <CardTitle className="text-emerald-50">Receita (Últimos 7 Dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-96 bg-emerald-900/30 animate-pulse rounded-lg" />}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.last7DaysRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#064e3b33" />
                  <XAxis dataKey="date" stroke="#6ee7b7" />
                  <YAxis stroke="#6ee7b7" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#022c22',
                      border: '1px solid #065f46',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#6ee7b7' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Suspense>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardHeader>
            <CardTitle className="text-emerald-50">Consumo de Energia (Últimos 7 Dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-96 bg-emerald-900/30 animate-pulse rounded-lg" />}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.last7DaysKwh}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#064e3b33" />
                  <XAxis dataKey="date" stroke="#6ee7b7" />
                  <YAxis stroke="#6ee7b7" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#022c22',
                      border: '1px solid #065f46',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#6ee7b7' }}
                    itemStyle={{ color: '#3b82f6' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* Status Chart and Mini Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-emerald-50">Status das Estações</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-96 bg-emerald-900/30 animate-pulse rounded-lg" />}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={entry => `${entry.name}: ${entry.value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[entry.name as keyof typeof COLORS]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#022c22',
                      border: '1px solid #065f46',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#6ee7b7' }}
                  />
                  <Legend wrapperStyle={{ color: '#6ee7b7' }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </Suspense>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <KPICard
            title="Vouchers Ativos"
            value={activeVouchers}
            icon={<Ticket className="w-4 h-4" />}
          />
          <KPICard
            title="Transações (Mês)"
            value={data.transactionsMonth}
            icon={<Receipt className="w-4 h-4" />}
          />
          <KPICard
            title="Estações Totais"
            value={data.chargers.total}
            icon={<Zap className="w-4 h-4" />}
          />
        </div>
      </div>
    </div>
  );
};
