import { useEffect, useState, useMemo, useRef } from 'react';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { api } from '../lib/api';
import { useSocket } from '../lib/hooks/useSocket';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

const fmt = (v: number, decimals = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const Overview = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previousData, setPreviousData] = useState<OverviewData | null>(null);

  const { isConnected, chargerStatuses, lastUpdate } = useSocket();

  const chargerCountRef = useRef(0);
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
      if (params.toString()) endpoint += `?${params.toString()}`;

      const response = await api.get(endpoint);
      if (!response.ok) throw new Error('Falha ao buscar dados.');
      const overviewData = await response.json();
      if (data) setPreviousData(data);
      setData(overviewData);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchOverview(); }, [startDate, endDate]);

  const handleClearFilters = () => { setStartDate(''); setEndDate(''); };

  const calculateChange = (current: number, previous: number | undefined): number | undefined => {
    if (!previous || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const statusCounts = useMemo(() => {
    if (!data?.chargers) return { online: 0, offline: 0, charging: 0 };
    return { online: data.chargers.online, offline: data.chargers.offline, charging: data.chargers.charging };
  }, [data]);

  const statusData = [
    { name: 'Online', value: statusCounts.online, color: 'var(--color-primary)' },
    { name: 'Offline', value: statusCounts.offline, color: 'var(--color-outline)' },
    { name: 'Carregando', value: statusCounts.charging, color: 'var(--color-tertiary)' },
  ];

  const netRevenue = (data?.revenueTotal || 0) + (data?.totalDepositsNet || 0);
  const grossDeposits = data?.totalDepositsGross || 0;
  const depositQuota = grossDeposits > 0 ? Math.min((grossDeposits / (grossDeposits * 1.02)) * 100, 100) : 0;
  const revenueChange = calculateChange(data?.revenueTotal || 0, previousData?.revenueTotal);

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
                ? `Período: ${startDate ? new Date(startDate).toLocaleDateString('pt-BR') : 'Início'} — ${endDate ? new Date(endDate).toLocaleDateString('pt-BR') : 'Hoje'}`
                : `Período: ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
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

      {/* KPI Section: Bento Style (4 Consolidated Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Receita Líquida */}
        <div className="bg-card p-6 rounded-2xl border border-neutral-200 shadow-soft relative overflow-hidden group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Receita Líquida</span>
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
          <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center text-xs">
            <span className="text-on-surface-variant">Depósitos Líquidos</span>
            <span className="font-semibold text-on-surface">R$ {fmt(data.totalDepositsNet || 0)}</span>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
        </div>

        {/* Card 2: Receita Operacional */}
        <div className="bg-card p-6 rounded-2xl border border-neutral-200 shadow-soft relative overflow-hidden group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Receita Operacional</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-on-surface-variant text-sm font-medium">R$</span>
              <span className="text-3xl font-headline font-bold text-foreground">{fmt(data.revenueMonth)}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-on-surface-variant">{startDate || endDate ? 'No Período' : 'Hoje'}</span>
              {!startDate && !endDate && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
            </div>
            <span className="font-semibold text-on-surface">R$ {fmt(data.revenueToday)}</span>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
        </div>

        {/* Card 3: Depósitos & Taxas */}
        <div className="bg-card p-6 rounded-2xl border border-primary/20 shadow-soft relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Depósitos Brutos</span>
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

        {/* Card 4: Energia Consumida */}
        <div className="bg-card p-6 rounded-2xl border border-neutral-200 shadow-soft relative overflow-hidden group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Energia Consumida</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary text-lg">bolt</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-headline font-bold text-foreground">{fmt(data.kwhMonth, 1)}</span>
              <span className="text-on-surface-variant text-sm font-medium">kWh</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-on-surface-variant">{startDate || endDate ? 'No Período' : 'Hoje'}</span>
              {!startDate && !endDate && <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />}
            </div>
            <span className="font-semibold text-on-surface">{fmt(data.kwhToday, 1)} kWh</span>
          </div>
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
              statusCounts.online > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCounts.online > 0 ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
              {statusCounts.online} ONLINE
            </span>
          </div>
          {statusData.every(d => d.value === 0) ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-4xl text-outline">ev_station</span>
              <p className="text-sm text-on-surface-variant">Nenhuma estação registrada</p>
            </div>
          ) : statusCounts.online === 0 && statusCounts.charging === 0 ? (
            /* Todas offline — mostrar status detalhado sem gráfico vazio */
            <div className="p-8 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-[10px] border-muted flex items-center justify-center">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-3xl text-muted-foreground">wifi_off</span>
                    <p className="text-2xl font-headline font-bold text-muted-foreground mt-1">{statusCounts.offline}</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Todas as estações estão offline</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Verifique a conexão dos carregadores</p>
              </div>
              <div className="flex justify-center gap-6">
                {statusData.map(d => (
                  <span key={d.name} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}: <span className="font-bold text-on-surface">{d.value}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {statusData.filter(d => d.value > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex justify-center gap-6 mt-4">
                {statusData.filter(d => d.value > 0).map(d => (
                  <span key={d.name} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}: <span className="font-bold text-on-surface">{d.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side Cards */}
        <div className="space-y-6">
          <SideMetric icon="confirmation_number" label="VOUCHERS ATIVOS" value={String(data.activeVouchers ?? 0)} accent />
          <SideMetric icon="receipt_long" label="TRANSAÇÕES (MÊS)" value={String(data.transactionsMonth)} />
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
