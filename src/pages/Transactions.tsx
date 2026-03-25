import { useState, useEffect, useMemo } from 'react';
import { ExportButton } from '../components/ExportButton';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { ExportColumn } from '../lib/export';

interface Transaction {
  transaction_id: number;
  charge_point_id: string;
  start_timestamp: string;
  stop_timestamp: string | null;
  consumed_wh: number | null;
  total_cost: number | null;
  address: string | null;
  status: string;
}

const exportColumns: ExportColumn[] = [
  { key: 'transaction_id', header: 'ID', format: 'number' },
  { key: 'charge_point_id', header: 'Carregador', format: 'text' },
  { key: 'start_timestamp', header: 'Inicio', format: 'date' },
  { key: 'stop_timestamp', header: 'Fim', format: 'date' },
  { key: 'consumed_kwh', header: 'Energia (kWh)', format: 'number' },
  { key: 'total_cost', header: 'Custo (R$)', format: 'currency' },
  { key: 'address', header: 'Endereco', format: 'text' },
  { key: 'status', header: 'Status', format: 'text' },
];

const fmt = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState<'all' | '30d' | '7d'>('all');
  const itemsPerPage = 10;

  const exportData = transactions.map(tx => ({
    transaction_id: tx.transaction_id,
    charge_point_id: tx.charge_point_id,
    start_timestamp: tx.start_timestamp,
    stop_timestamp: tx.stop_timestamp,
    consumed_kwh: tx.consumed_wh != null ? (tx.consumed_wh / 1000) : 0,
    total_cost: tx.total_cost != null ? parseFloat(tx.total_cost.toString()) : 0,
    address: tx.address || 'N/A',
    status: tx.status,
  }));

  useEffect(() => { void fetchTransactions(); }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/transactions');
      if (!response.ok) throw new Error('Falha ao buscar transações.');
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (timeFilter === 'all') return transactions;
    const days = timeFilter === '30d' ? 30 : 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return transactions.filter(tx => new Date(tx.start_timestamp) >= cutoff);
  }, [transactions, timeFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const current = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Summary metrics
  const totalRevenue = useMemo(() => filtered.reduce((s, tx) => s + (tx.total_cost ? parseFloat(tx.total_cost.toString()) : 0), 0), [filtered]);
  const totalKwh = useMemo(() => filtered.reduce((s, tx) => s + (tx.consumed_wh ? tx.consumed_wh / 1000 : 0), 0), [filtered]);
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0;
  const completedCount = filtered.filter(tx => (tx.status || '').toLowerCase() === 'completed' || tx.status === 'finalizado').length;
  const healthPct = filtered.length > 0 ? (completedCount / filtered.length * 100) : 0;

  const formatDt = (iso: string | null) => {
    if (!iso) return '---';
    return new Date(iso).toLocaleString('pt-BR');
  };

  const statusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'finalizado') return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', dot: 'bg-primary', label: 'Concluído' };
    if (s === 'failed' || s === 'falhou') return { bg: 'bg-error/10', text: 'text-error', border: 'border-error/20', dot: 'bg-error', label: 'Falhou' };
    return { bg: 'bg-tertiary/10', text: 'text-tertiary', border: 'border-tertiary/20', dot: 'bg-tertiary animate-pulse', label: 'Em andamento' };
  };

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

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-xs font-bold text-primary font-headline tracking-[0.2em] uppercase mb-1 block">LIVE ENERGY FEED</span>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Transações</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Time filter pills */}
          <div className="bg-surface-container-low p-1 rounded-lg flex items-center border border-outline-variant/10">
            {(['all', '30d', '7d'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setTimeFilter(f); setCurrentPage(1); }}
                className={`px-4 py-2 text-xs font-bold font-headline rounded-md transition-all ${
                  timeFilter === f
                    ? 'bg-surface-container-highest text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {f === 'all' ? 'TODOS' : f.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={() => void fetchTransactions()} className="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/10 text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span className="text-xs font-bold font-headline uppercase tracking-wider">Atualizar</span>
          </button>
          <ExportButton
            data={exportData}
            columns={exportColumns}
            filename="transacoes_neopower"
            title="Historico de Transacoes - NeoPower"
            disabled={transactions.length === 0}
          />
        </div>
      </div>

      {/* Bento Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <MetricCard icon="payments" iconColor="text-primary" iconBg="bg-primary/10" badge={`${filtered.length} tx`} badgeColor="text-primary bg-primary/10" label="RECEITA TOTAL" value={`R$ ${fmt(totalRevenue)}`} />
        <MetricCard icon="confirmation_number" iconColor="text-tertiary" iconBg="bg-tertiary/10" label="TICKET MÉDIO" value={`R$ ${fmt(avgTicket)}`} />
        <MetricCard icon="bolt" iconColor="text-secondary" iconBg="bg-secondary/10" label="ENERGIA TOTAL" value={`${fmt(totalKwh, 1)} kWh`} />
        {/* Health card */}
        <div className="bg-surface-container-highest p-6 rounded-xl border border-primary/20 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-1 relative z-10">TAXA DE SUCESSO</p>
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-primary shadow-[0_0_10px_#39FF14]" style={{ width: `${healthPct}%` }} />
            </div>
            <span className="text-lg font-headline font-bold text-on-surface">{healthPct.toFixed(1)}%</span>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2 relative z-10">{completedCount} concluídas / {filtered.length - completedCount} outras</p>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="text-lg font-headline font-bold text-on-surface">Atividade Recente</h3>
          <div className="flex items-center gap-4">
            <Legend dot="bg-primary" label="Concluído" />
            <Legend dot="bg-error" label="Falhou" />
            <Legend dot="bg-tertiary animate-pulse" label="Em andamento" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Carregador</th>
                <th className="px-6 py-4">Início</th>
                <th className="px-6 py-4">Fim</th>
                <th className="px-6 py-4">Energia</th>
                <th className="px-6 py-4">Custo</th>
                <th className="px-6 py-4">Endereço</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {current.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline mb-3 block">receipt_long</span>
                    <p className="text-sm text-on-surface-variant">Nenhuma transação encontrada</p>
                  </td>
                </tr>
              ) : current.map(tx => {
                const st = statusStyle(tx.status);
                return (
                  <tr key={tx.transaction_id} className="hover:bg-surface-container-highest/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold">
                        #{tx.transaction_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-sm">{tx.charge_point_id}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDt(tx.start_timestamp)}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDt(tx.stop_timestamp)}</td>
                    <td className="px-6 py-4 text-sm font-bold font-headline">
                      {tx.consumed_wh != null ? fmt(tx.consumed_wh / 1000, 2) : '0,00'} <span className="text-xs font-normal text-on-surface-variant">kWh</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold font-headline">
                      <span className="text-on-surface-variant text-xs">R$</span> {tx.total_cost != null ? fmt(parseFloat(tx.total_cost.toString())) : '0,00'}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[200px] truncate">{tx.address || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-outline-variant/10 flex justify-between items-center">
          <p className="text-xs text-on-surface-variant">
            Página <span className="font-bold text-on-surface">{currentPage}</span> de <span className="font-bold text-on-surface">{totalPages || 1}</span>
            <span className="ml-2 text-outline">({filtered.length} transações)</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
            >
              Próxima
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Sub-components ── */

function MetricCard({ icon, iconColor, iconBg, badge, badgeColor, label, value }: {
  icon: string; iconColor: string; iconBg: string; badge?: string; badgeColor?: string; label: string; value: string;
}) {
  return (
    <div className="glass-card p-6 rounded-xl border border-outline-variant/10 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${badgeColor}`}>{badge}</span>
        )}
      </div>
      <p className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-2xl font-headline font-bold text-on-surface">{value}</h3>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{label}</span>
    </div>
  );
}
