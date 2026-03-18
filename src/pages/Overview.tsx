import React, { useEffect, useState, useMemo } from 'react';
import { KPICard } from '../components/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { DollarSign, Zap, Ticket, Receipt, Wifi, WifiOff, RefreshCw, LayoutDashboard, Wallet, TrendingUp } from 'lucide-react';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { api } from '../lib/api';
import { useSocket } from '../lib/hooks/useSocket';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

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
  const { isConnected, chargerStatuses, lastUpdate } = useSocket();

  // Re-fetch quando status de conexão de chargers mudar (não em heartbeats)
  const chargerCountRef = React.useRef(0);
  useEffect(() => {
    const onlineCount = Array.from(chargerStatuses.values()).filter(
      s => s.status !== 'Offline' && s.status !== 'Unavailable'
    ).length;
    if (chargerCountRef.current !== onlineCount && chargerCountRef.current !== 0) {
      void fetchOverview();
    }
    chargerCountRef.current = onlineCount;
  }, [chargerStatuses]);

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
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-emerald-400" />
            Visão Geral
          </h1>
          <p className="text-zinc-400 mt-1">Dashboard principal de monitoramento</p>
        </div>
        {/* Real-time connection indicator */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isConnected
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-zinc-800 border border-zinc-700'
            }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Tempo Real</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-500">Offline</span>
              </>
            )}
          </div>
          {lastUpdate && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <RefreshCw className="w-3 h-3" />
              Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
            </div>
          )}
        </div>
      </div>

      {/* Date Filters */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Período</label>
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
              <div className="text-sm text-zinc-400 pt-5">
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
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">
              {startDate || endDate ? 'Receita (Período Selecionado)' : 'Receita (Últimos 7 Dias)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!data.last7DaysRevenue || data.last7DaysRevenue.length === 0) ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                <DollarSign className="w-12 h-12 text-zinc-700" />
                <p className="text-zinc-500">Sem dados de receita no período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.last7DaysRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" tick={{ fill: '#a1a1aa' }} />
                  <YAxis stroke="#71717a" tick={{ fill: '#a1a1aa' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#a1a1aa' }}
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
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">
              {startDate || endDate ? 'Consumo de Energia (Período Selecionado)' : 'Consumo de Energia (Últimos 7 Dias)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!data.last7DaysKwh || data.last7DaysKwh.length === 0) ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                <Zap className="w-12 h-12 text-zinc-700" />
                <p className="text-zinc-500">Sem dados de energia no período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.last7DaysKwh}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" tick={{ fill: '#a1a1aa' }} />
                  <YAxis stroke="#71717a" tick={{ fill: '#a1a1aa' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#a1a1aa' }}
                    itemStyle={{ color: '#3b82f6' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Chart and Mini Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Status das Estações</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.every(d => d.value === 0) ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                <Zap className="w-12 h-12 text-zinc-700" />
                <p className="text-zinc-500">Nenhuma estação registrada</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData.filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={entry => `${entry.name}: ${entry.value}`}
                    >
                      {statusData.filter(d => d.value > 0).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[entry.name as keyof typeof COLORS]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#a1a1aa' }}
                    />
                    <Legend wrapperStyle={{ color: '#a1a1aa' }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
            )}
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
