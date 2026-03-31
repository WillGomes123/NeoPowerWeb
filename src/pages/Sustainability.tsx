import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/* ── Constantes do mercado brasileiro ── */
const MARKET = {
  GASOLINE_PRICE: 6.00,
  ELECTRICITY_RESIDENTIAL: 0.80,
  ELECTRICITY_PUBLIC: 1.80,
  ICE_KM_PER_LITER: 10,
  EV_KWH_PER_100KM: 15,
  CO2_PER_LITER_GASOLINE: 2.31,
  GRID_EMISSION_FACTOR: 0.0293,
  CO2_PER_TREE_YEAR: 20,
};

const COST_PER_KM_GAS = MARKET.GASOLINE_PRICE / MARKET.ICE_KM_PER_LITER;
const COST_PER_KM_EV_HOME = (MARKET.EV_KWH_PER_100KM / 100) * MARKET.ELECTRICITY_RESIDENTIAL;
const COST_PER_KM_EV_PUBLIC = (MARKET.EV_KWH_PER_100KM / 100) * MARKET.ELECTRICITY_PUBLIC;
const CO2_PER_KM_ICE = MARKET.CO2_PER_LITER_GASOLINE / MARKET.ICE_KM_PER_LITER;
const CO2_PER_KM_EV = (MARKET.EV_KWH_PER_100KM / 100) * MARKET.GRID_EMISSION_FACTOR;

type PeriodType = '7d' | '30d' | '90d' | '365d';

interface PerformanceData {
  date: string;
  energy: number;
  sessions: number;
  revenue: number;
}

const fmt = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const Sustainability = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('30d');
  const [monthlyKm, setMonthlyKm] = useState(1500);

  useEffect(() => { void fetchData(); }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const res = await api.get(`/performance-data?days=${days}`);
      if (res.ok) {
        const d = await res.json();
        setPerformanceData(Array.isArray(d) ? d : []);
      } else {
        setPerformanceData([]);
      }
    } catch {
      setPerformanceData([]);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  /* ── Cálculos ── */
  const totalKwh = useMemo(() => performanceData.reduce((s, d) => s + (Number(d.energy) || 0), 0), [performanceData]);
  const kmEquivalent = totalKwh / (MARKET.EV_KWH_PER_100KM / 100);
  const co2SavedKg = kmEquivalent * (CO2_PER_KM_ICE - CO2_PER_KM_EV);
  const treesEquivalent = co2SavedKg / MARKET.CO2_PER_TREE_YEAR;
  const savingsVsGas = kmEquivalent * (COST_PER_KM_GAS - COST_PER_KM_EV_PUBLIC);
  const savingsPct = COST_PER_KM_GAS > 0 ? ((COST_PER_KM_GAS - COST_PER_KM_EV_PUBLIC) / COST_PER_KM_GAS * 100) : 0;

  /* ── Dados dos gráficos ── */
  const economyComparison = [
    { label: 'Gasolina', costPerKm: COST_PER_KM_GAS, monthlyCost: monthlyKm * COST_PER_KM_GAS, color: '#ef4444' },
    { label: 'EV (Residencial)', costPerKm: COST_PER_KM_EV_HOME, monthlyCost: monthlyKm * COST_PER_KM_EV_HOME, color: '#22c55e' },
    { label: 'EV (Público)', costPerKm: COST_PER_KM_EV_PUBLIC, monthlyCost: monthlyKm * COST_PER_KM_EV_PUBLIC, color: '#3b82f6' },
  ];

  const co2Comparison = [
    { label: 'Veículo a Gasolina', value: kmEquivalent * CO2_PER_KM_ICE, color: '#ef4444' },
    { label: 'Veículo Elétrico', value: kmEquivalent * CO2_PER_KM_EV, color: '#22c55e' },
  ];

  const co2TimelineData = performanceData.map(d => {
    const kwh = Number(d.energy) || 0;
    const km = kwh / (MARKET.EV_KWH_PER_100KM / 100);
    return {
      date: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`,
      co2_saved: Math.round(km * (CO2_PER_KM_ICE - CO2_PER_KM_EV) * 100) / 100,
      trees: Math.round((km * (CO2_PER_KM_ICE - CO2_PER_KM_EV)) / MARKET.CO2_PER_TREE_YEAR * 1000) / 1000,
      economy: Math.round(km * (COST_PER_KM_GAS - COST_PER_KM_EV_PUBLIC) * 100) / 100,
    };
  });

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1a1919', border: '1px solid #494847', borderRadius: '8px', padding: '12px' },
    labelStyle: { color: '#adaaaa', marginBottom: '6px', fontSize: '12px' },
  };

  const treeIcons = Math.min(Math.ceil(treesEquivalent), 50);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">IMPACTO AMBIENTAL</span>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Sustentabilidade</h2>
          <p className="text-on-surface-variant text-sm mt-1">Economia e redução de emissões com recarga elétrica</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-surface-container-low p-1 rounded-lg flex items-center border border-outline-variant/10">
            {(['7d', '30d', '90d', '365d'] as PeriodType[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-bold font-headline rounded-md transition-all ${
                  period === p ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {p === '365d' ? '1 ANO' : p.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={() => void fetchData()} className="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/10 text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span className="text-xs font-bold font-headline uppercase tracking-wider">Atualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard icon="savings" color="text-primary" label="ECONOMIA TOTAL" value={`R$ ${fmt(savingsVsGas)}`} sub={`${savingsPct.toFixed(0)}% mais barato que gasolina`} highlight />
        <KPICard icon="eco" color="text-secondary" label="CO2 EVITADO" value={`${fmt(co2SavedKg, 1)} kg`} sub={`vs. veículo a gasolina`} />
        <KPICard icon="park" color="text-tertiary" label="ÁRVORES EQUIVALENTES" value={fmt(treesEquivalent, 1)} sub={`árvores plantadas/ano`} />
        <KPICard icon="electric_bolt" color="text-tertiary-dim" label="ENERGIA TOTAL" value={`${fmt(totalKwh, 1)} kWh`} sub={`≈ ${fmt(kmEquivalent, 0)} km percorridos`} />
      </div>

      {/* Economy Comparison Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-lg border border-outline-variant/10 p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="font-headline text-lg font-bold text-on-surface uppercase tracking-tight">Custo Mensal: EV vs Gasolina</h3>
              <p className="text-on-surface-variant text-xs mt-1">Baseado em {monthlyKm.toLocaleString('pt-BR')} km/mês</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">km/mês:</span>
              <input
                type="number"
                value={monthlyKm}
                onChange={(e) => setMonthlyKm(Number(e.target.value) || 1000)}
                className="w-24 bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-1.5 text-sm text-on-surface text-right focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={economyComparison} layout="vertical" margin={{ top: 0, right: 40, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#494847" strokeOpacity={0.3} horizontal={false} />
              <XAxis type="number" stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `R$ ${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <YAxis type="category" dataKey="label" stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 12 }} axisLine={false} tickLine={false} width={130} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number) => [`R$ ${fmt(value)}`, 'Custo Mensal']}
              />
              <Bar dataKey="monthlyCost" radius={[0, 6, 6, 0]} maxBarSize={40}>
                {economyComparison.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost per km comparison */}
        <div className="glass-panel rounded-lg border border-outline-variant/10 p-8 flex flex-col justify-between">
          <div>
            <h3 className="font-headline text-lg font-bold text-on-surface uppercase tracking-tight mb-6">Custo por km</h3>
            <div className="space-y-5">
              {economyComparison.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-on-surface-variant">{item.label}</span>
                    <span className="text-sm font-bold font-headline text-on-surface">R$ {item.costPerKm.toFixed(2)}/km</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(item.costPerKm / COST_PER_KM_GAS) * 100}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-outline-variant/10">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-xs text-on-surface-variant">Economia anual estimada</p>
              <p className="text-2xl font-headline font-bold text-primary">R$ {fmt(savingsVsGas * 12 / (period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365) * 365)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CO2 Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CO2 Timeline */}
        <div className="lg:col-span-2 glass-panel rounded-lg border border-outline-variant/10 p-8">
          <h3 className="font-headline text-lg font-bold text-on-surface uppercase tracking-tight mb-2">Redução de CO2 ao Longo do Tempo</h3>
          <p className="text-on-surface-variant text-xs mb-8">kg de CO2 evitados por dia comparado com veículo a gasolina</p>
          {co2TimelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={co2TimelineData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#494847" strokeOpacity={0.3} vertical={false} />
                <XAxis dataKey="date" stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} width={65} tickFormatter={(v: number) => `${v} kg`} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number, name: string) => {
                    if (name === 'co2_saved') return [`${value.toFixed(2)} kg`, 'CO2 Evitado'];
                    return [value, name];
                  }}
                />
                <Area type="monotone" dataKey="co2_saved" stroke="#22c55e" strokeWidth={2.5} fill="url(#co2Grad)" dot={false} activeDot={{ r: 5, stroke: '#0e0e0e', strokeWidth: 2, fill: '#22c55e' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-5xl text-outline">eco</span>
              <p className="text-on-surface-variant">Sem dados para o período selecionado</p>
            </div>
          )}
        </div>

        {/* Tree visualization + CO2 pie */}
        <div className="glass-panel rounded-lg border border-outline-variant/10 p-8 flex flex-col">
          <h3 className="font-headline text-lg font-bold text-on-surface uppercase tracking-tight mb-6">Impacto Ambiental</h3>

          {/* Tree grid */}
          <div className="bg-surface-container rounded-lg p-4 mb-6">
            <div className="flex flex-wrap gap-1 justify-center mb-3">
              {Array.from({ length: treeIcons }).map((_, i) => (
                <span key={i} className="material-symbols-outlined text-lg text-primary" style={{ opacity: 0.4 + (i / treeIcons) * 0.6 }}>park</span>
              ))}
              {treeIcons === 0 && <span className="material-symbols-outlined text-4xl text-outline">park</span>}
            </div>
            <p className="text-center text-sm text-on-surface">
              Equivalente a <span className="font-bold text-primary">{fmt(treesEquivalent, 1)}</span> árvores plantadas
            </p>
            <p className="text-center text-[10px] text-on-surface-variant mt-1">
              Baseado em 20 kg CO2/árvore/ano (média tropical)
            </p>
          </div>

          {/* CO2 Pie */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-4 text-center">Emissões CO2 Comparadas</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={co2Comparison}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {co2Comparison.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number) => [`${fmt(value, 1)} kg CO2`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              {co2Comparison.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-on-surface-variant">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Economy Timeline */}
      <div className="glass-panel rounded-lg border border-outline-variant/10 p-8">
        <h3 className="font-headline text-lg font-bold text-on-surface uppercase tracking-tight mb-2">Economia Acumulada por Dia</h3>
        <p className="text-on-surface-variant text-xs mb-8">R$ economizados por dia comparado com veículo a gasolina</p>
        {co2TimelineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={co2TimelineData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="economyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#90f9a3" stopOpacity={1} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#494847" strokeOpacity={0.3} vertical={false} />
              <XAxis dataKey="date" stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} width={65} tickFormatter={(v: number) => `R$ ${v}`} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [`R$ ${fmt(value)}`, 'Economia']} />
              <Bar dataKey="economy" fill="url(#economyGrad)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-5xl text-outline">savings</span>
            <p className="text-on-surface-variant">Sem dados para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Reference values */}
      <div className="glass-panel rounded-lg border border-outline-variant/10 p-6">
        <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-4">Valores de Referência</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-on-surface-variant">
          <RefItem label="Gasolina" value={`R$ ${MARKET.GASOLINE_PRICE.toFixed(2)}/L`} />
          <RefItem label="Eletricidade (residencial)" value={`R$ ${MARKET.ELECTRICITY_RESIDENTIAL.toFixed(2)}/kWh`} />
          <RefItem label="Consumo médio gasolina" value={`${MARKET.ICE_KM_PER_LITER} km/L`} />
          <RefItem label="Consumo médio EV" value={`${MARKET.EV_KWH_PER_100KM} kWh/100km`} />
          <RefItem label="CO2 por litro gasolina" value={`${MARKET.CO2_PER_LITER_GASOLINE} kg`} />
          <RefItem label="Fator emissão rede BR" value={`${MARKET.GRID_EMISSION_FACTOR} kg CO2/kWh`} />
          <RefItem label="CO2 por árvore/ano" value={`${MARKET.CO2_PER_TREE_YEAR} kg`} />
          <RefItem label="Fonte" value="ANP, ANEEL, MCTI, IPCC" />
        </div>
      </div>
    </div>
  );
};

function KPICard({ icon, color, label, value, sub, highlight }: { icon: string; color: string; label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-xl border relative overflow-hidden ${
      highlight
        ? 'bg-surface-container-highest border-primary/20'
        : 'glass-card border-outline-variant/10'
    }`}>
      {highlight && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />}
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <span className={`material-symbols-outlined text-xl ${color}`}>{icon}</span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">{label}</span>
        </div>
        <p className="text-2xl font-headline font-bold text-on-surface">{value}</p>
        <p className="text-[10px] text-on-surface-variant mt-1">{sub}</p>
      </div>
    </div>
  );
}

function RefItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-outline">{label}</p>
      <p className="text-on-surface font-bold">{value}</p>
    </div>
  );
}
