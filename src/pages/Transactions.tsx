import { useState, useEffect, useMemo } from 'react';
import { ExportButton } from '../components/ExportButton';
import { ChargingCurveDialog } from '../components/ChargingCurveDialog';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ExportColumn } from '../lib/export';

interface Transaction {
  id: number;
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState<'all' | '30d' | '7d'>('all');
  const [curveOpen, setCurveOpen] = useState(false);
  const [curveTransaction, setCurveTransaction] = useState<{ id: number; chargerId: string } | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundToMP, setRefundToMP] = useState(false);
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

  const handleRefund = async () => {
    if (!refundTx) return;
    setRefundLoading(true);
    try {
      const body: { reason?: string; amount?: number; refundToPaymentMethod?: boolean } = {};
      if (refundReason.trim()) body.reason = refundReason.trim();
      const amt = parseFloat(refundAmount);
      if (!isNaN(amt) && amt > 0) body.amount = amt;
      if (refundToMP) body.refundToPaymentMethod = true;

      const response = await api.put(`/transactions/${refundTx.id}/refund`, body);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || data?.error || 'Falha ao realizar estorno.');
      }
      const result = await response.json();
      const method = result?.refund_method === 'mercadopago'
        ? 'Valor devolvido ao meio de pagamento original.'
        : 'Valor creditado na carteira do cliente.';
      toast.success(`Estorno realizado! ${method}`);
      if (result?.mp_error) {
        toast.warning(`Aviso: ${result.mp_error}. Valor creditado na carteira.`);
      }
      setRefundOpen(false);
      setRefundTx(null);
      setRefundAmount('');
      setRefundReason('');
      setRefundToMP(false);
      void fetchTransactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao realizar estorno.');
    } finally {
      setRefundLoading(false);
    }
  };

  const statusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'finalizado') return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', dot: 'bg-primary', label: 'Concluído' };
    if (s === 'refunded') return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500', label: 'Estornado' };
    if (s === 'partialrefund') return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500', label: 'Estorno Parcial' };
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
        <MetricCard icon="payments" badge={`${filtered.length} tx`} label="RECEITA TOTAL" value={`R$ ${fmt(totalRevenue)}`} />
        <MetricCard icon="confirmation_number" label="TICKET MÉDIO" value={`R$ ${fmt(avgTicket)}`} />
        <MetricCard icon="bolt" label="ENERGIA TOTAL" value={`${fmt(totalKwh, 1)} kWh`} />
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
            <Legend dot="bg-amber-500" label="Estornado" />
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
                <th className="px-6 py-4">Curva</th>
                {isAdmin && <th className="px-6 py-4">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {current.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline mb-3 block">receipt_long</span>
                    <p className="text-sm text-on-surface-variant">Nenhuma transação encontrada</p>
                  </td>
                </tr>
              ) : current.map(tx => {
                const st = statusStyle(tx.status);
                const canRefund = isAdmin && tx.status?.toLowerCase() === 'completed';
                return (
                  <tr key={tx.transaction_id} onClick={() => { setCurveTransaction({ id: tx.transaction_id, chargerId: tx.charge_point_id }); setCurveOpen(true); }} className="hover:bg-surface-container-highest/30 transition-colors group cursor-pointer">
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
                    <td className="px-6 py-4">
                      <span className="material-symbols-outlined text-base text-on-surface-variant group-hover:text-primary transition-colors">show_chart</span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        {canRefund ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRefundTx(tx);
                              setRefundAmount(tx.total_cost != null ? parseFloat(tx.total_cost.toString()).toFixed(2) : '0');
                              setRefundReason('');
                              setRefundOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors text-xs font-bold"
                            title="Realizar estorno"
                          >
                            <span className="material-symbols-outlined text-sm">undo</span>
                            Estornar
                          </button>
                        ) : (
                          <span className="text-xs text-on-surface-variant/50">—</span>
                        )}
                      </td>
                    )}
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
      {/* Charging Curve Dialog */}
      {curveTransaction && (
        <ChargingCurveDialog
          transactionId={curveTransaction.id}
          chargerId={curveTransaction.chargerId}
          open={curveOpen}
          onClose={() => { setCurveOpen(false); setCurveTransaction(null); }}
        />
      )}

      {/* Refund Dialog */}
      {refundOpen && refundTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setRefundOpen(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <span className="material-symbols-outlined">undo</span>
              </div>
              <div>
                <h3 className="text-lg font-headline font-bold text-foreground">Estornar Transação</h3>
                <p className="text-xs text-muted-foreground">#{refundTx.transaction_id} — {refundTx.charge_point_id}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Valor do Estorno (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={refundTx.total_cost != null ? parseFloat(refundTx.total_cost.toString()) : undefined}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="0,00"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Valor original: R$ {refundTx.total_cost != null ? fmt(parseFloat(refundTx.total_cost.toString())) : '0,00'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Motivo (opcional)</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  placeholder="Descreva o motivo do estorno..."
                />
              </div>

              {/* Opção de devolver ao meio de pagamento original */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setRefundToMP(!refundToMP)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    refundToMP ? 'bg-primary border-primary' : 'border-outline-variant'
                  }`}
                >
                  {refundToMP && <span className="material-symbols-outlined text-white text-sm">check</span>}
                </button>
                <div>
                  <p className="text-sm font-medium text-foreground">Devolver ao meio de pagamento</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    O valor será estornado via MercadoPago (cartão/Pix). Se não for possível, será creditado na carteira.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setRefundOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleRefund()}
                disabled={refundLoading || !refundAmount || parseFloat(refundAmount) <= 0}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {refundLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <span className="material-symbols-outlined text-sm">undo</span>
                )}
                Confirmar Estorno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Sub-components ── */

function MetricCard({ icon, badge, label, value }: {
  icon: string; badge?: string; label: string; value: string;
}) {
  return (
    <div className="glass-card p-6 rounded-xl border border-outline-variant/10 relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-foreground">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full text-muted-foreground bg-surface-container-highest">{badge}</span>
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
