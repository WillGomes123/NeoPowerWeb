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

interface WalletTx {
  id: number;
  walletId: number;
  userId: number | null;
  userName: string;
  userEmail: string;
  type: 'deposit' | 'withdrawal' | 'charge' | 'refund';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  referenceId: string | null;
  createdAt: string;
}

type TxTab = 'recargas' | 'saldo';

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
  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  // Tab type: charging sessions vs wallet deposits
  const [txTab, setTxTab] = useState<TxTab>('recargas');
  const [walletTxs, setWalletTxs] = useState<WalletTx[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);
  // Refund state for wallet deposits
  const [depositRefundOpen, setDepositRefundOpen] = useState(false);
  const [depositRefundTx, setDepositRefundTx] = useState<WalletTx | null>(null);
  const [depositRefundReason, setDepositRefundReason] = useState('');
  const [depositRefundLoading, setDepositRefundLoading] = useState(false);
  const [depositRefundToMP, setDepositRefundToMP] = useState(false);
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
  useEffect(() => {
    if (txTab === 'saldo' && walletTxs.length === 0 && isAdmin) {
      void fetchWalletTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txTab]);

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

  const fetchWalletTransactions = async () => {
    setLoadingWallet(true);
    try {
      const response = await api.get('/admin/wallet-transactions?type=deposit');
      if (!response.ok) throw new Error('Falha ao buscar depósitos.');
      const data = await response.json();
      setWalletTxs(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar depósitos.');
    } finally {
      setLoadingWallet(false);
    }
  };

  const handleDepositRefund = async () => {
    if (!depositRefundTx) return;
    setDepositRefundLoading(true);
    try {
      const body: { reason?: string; refundToPaymentMethod?: boolean } = {};
      if (depositRefundReason.trim()) body.reason = depositRefundReason.trim();
      if (depositRefundToMP) body.refundToPaymentMethod = true;

      const response = await api.put(`/admin/wallet-transactions/${depositRefundTx.id}/refund`, body);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || data?.error || 'Falha ao estornar depósito.');
      }
      const result = await response.json();
      const method = result?.refund_method === 'mercadopago'
        ? 'Valor devolvido ao meio de pagamento original.'
        : 'Saldo debitado da carteira.';
      toast.success(`Depósito estornado! ${method}`);
      if (result?.mp_error) {
        toast.warning(`Aviso MercadoPago: ${result.mp_error}`);
      }
      setDepositRefundOpen(false);
      setDepositRefundTx(null);
      setDepositRefundReason('');
      setDepositRefundToMP(false);
      void fetchWalletTransactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao estornar depósito.');
    } finally {
      setDepositRefundLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = transactions;

    // Filtro por período rápido
    if (timeFilter !== 'all') {
      const days = timeFilter === '30d' ? 30 : 7;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      list = list.filter(tx => new Date(tx.start_timestamp) >= cutoff);
    }

    // Filtro por texto (carregador, endereço, ID)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(tx =>
        tx.charge_point_id?.toLowerCase().includes(q) ||
        tx.address?.toLowerCase().includes(q) ||
        String(tx.transaction_id).includes(q),
      );
    }

    return list;
  }, [transactions, timeFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const current = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Summary metrics
  const totalRevenue = useMemo(() => filtered.reduce((s, tx) => s + (tx.total_cost ? parseFloat(tx.total_cost.toString()) : 0), 0), [filtered]);
  const totalKwh = useMemo(() => filtered.reduce((s, tx) => s + (tx.consumed_wh ? tx.consumed_wh / 1000 : 0), 0), [filtered]);
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0;
  const completedCount = filtered.filter(tx => (tx.status || '').toLowerCase() === 'completed' || tx.status === 'finalizado').length;
  const healthPct = filtered.length > 0 ? (completedCount / filtered.length * 100) : 0;

  // Wallet deposits filtered & metrics
  const filteredDeposits = useMemo(() => {
    let list = walletTxs;

    if (timeFilter !== 'all') {
      const days = timeFilter === '30d' ? 30 : 7;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      list = list.filter(wt => new Date(wt.createdAt) >= cutoff);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(wt =>
        wt.userName?.toLowerCase().includes(q) ||
        wt.userEmail?.toLowerCase().includes(q) ||
        String(wt.id).includes(q) ||
        wt.referenceId?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [walletTxs, timeFilter, searchQuery]);

  const totalDeposits = useMemo(() => filteredDeposits.reduce((s, wt) => s + wt.amount, 0), [filteredDeposits]);
  const avgDeposit = filteredDeposits.length > 0 ? totalDeposits / filteredDeposits.length : 0;
  const currentDeposits = filteredDeposits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalDepositPages = Math.ceil(filteredDeposits.length / itemsPerPage);

  const formatDt = (iso: string | null) => {
    if (!iso) return '---';
    return new Date(iso).toLocaleString('pt-BR');
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

      {/* Tabs Recargas vs Saldo */}
      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-outline-variant/10">
          <button
            onClick={() => { setTxTab('recargas'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
              txTab === 'recargas'
                ? 'text-primary border-primary'
                : 'text-on-surface-variant border-transparent hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            Recargas (Eletroposto)
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              txTab === 'recargas' ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {transactions.length}
            </span>
          </button>
          <button
            onClick={() => { setTxTab('saldo'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
              txTab === 'saldo'
                ? 'text-primary border-primary'
                : 'text-on-surface-variant border-transparent hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            Recargas de Saldo
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              txTab === 'saldo' ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {walletTxs.length}
            </span>
          </button>
        </div>
      )}

      {/* Bento Summary Metrics */}
      {txTab === 'recargas' ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard icon="account_balance_wallet" badge={`${filteredDeposits.length} dep.`} label="TOTAL DEPÓSITOS" value={`R$ ${fmt(totalDeposits)}`} />
          <MetricCard icon="trending_up" label="DEPÓSITO MÉDIO" value={`R$ ${fmt(avgDeposit)}`} />
          <MetricCard icon="people" label="USUÁRIOS ÚNICOS" value={String(new Set(filteredDeposits.map(d => d.userId)).size)} />
        </div>
      )}

      {/* Transaction Table — Recargas (Eletroposto) */}
      {txTab === 'recargas' && (
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h3 className="text-lg font-headline font-bold text-on-surface">Atividade Recente</h3>
          <div className="flex items-center gap-4 flex-1 md:justify-end">
            <div className="relative flex-1 md:max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar por carregador, endereço ou ID..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container border border-outline-variant/20 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <Legend dot="bg-primary" label="Concluído" />
              <Legend dot="bg-error" label="Falhou" />
              <Legend dot="bg-tertiary animate-pulse" label="Em andamento" />
            </div>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {current.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline mb-3 block">receipt_long</span>
                    <p className="text-sm text-on-surface-variant">Nenhuma transação encontrada</p>
                  </td>
                </tr>
              ) : current.map(tx => {
                const st = statusStyle(tx.status);
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
      )}

      {/* Wallet Deposits Table — Saldo */}
      {txTab === 'saldo' && isAdmin && (
        <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h3 className="text-lg font-headline font-bold text-on-surface">Recargas de Saldo</h3>
            <div className="flex items-center gap-3 flex-1 md:justify-end">
              <div className="relative flex-1 md:max-w-xs">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Buscar por nome, email ou referência..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container border border-outline-variant/20 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <button
                onClick={() => void fetchWalletTransactions()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-primary text-xs font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Atualizar
              </button>
            </div>
          </div>
          {loadingWallet ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4">Saldo após</th>
                      <th className="px-6 py-4">MP Payment</th>
                      <th className="px-6 py-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {currentDeposits.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <span className="material-symbols-outlined text-4xl text-outline mb-3 block">account_balance_wallet</span>
                          <p className="text-sm text-on-surface-variant">Nenhum depósito encontrado</p>
                        </td>
                      </tr>
                    ) : currentDeposits.map(dep => {
                      const isMpPayment = dep.referenceId && /^[0-9]+$/.test(dep.referenceId);
                      return (
                        <tr key={dep.id} className="hover:bg-surface-container-highest/30 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold">
                              #{dep.id}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-foreground">{dep.userName}</p>
                            <p className="text-[11px] text-on-surface-variant">{dep.userEmail}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDt(dep.createdAt)}</td>
                          <td className="px-6 py-4 text-sm font-bold font-headline text-primary">
                            +R$ {fmt(dep.amount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant font-mono">
                            R$ {fmt(dep.balanceAfter)}
                          </td>
                          <td className="px-6 py-4">
                            {isMpPayment ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-tertiary/10 text-tertiary text-[10px] font-mono">
                                <span className="material-symbols-outlined text-xs">credit_card</span>
                                {dep.referenceId}
                              </span>
                            ) : (
                              <span className="text-xs text-on-surface-variant/50">{dep.referenceId || '—'}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                setDepositRefundTx(dep);
                                setDepositRefundReason('');
                                setDepositRefundToMP(false);
                                setDepositRefundOpen(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors text-xs font-bold"
                              title="Estornar depósito"
                            >
                              <span className="material-symbols-outlined text-sm">undo</span>
                              Estornar
                            </button>
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
                  Página <span className="font-bold text-on-surface">{currentPage}</span> de <span className="font-bold text-on-surface">{totalDepositPages || 1}</span>
                  <span className="ml-2 text-outline">({filteredDeposits.length} depósitos)</span>
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
                    onClick={() => setCurrentPage(p => Math.min(totalDepositPages, p + 1))}
                    disabled={currentPage === totalDepositPages || totalDepositPages === 0}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
                  >
                    Próxima
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Charging Curve Dialog */}
      {curveTransaction && (
        <ChargingCurveDialog
          transactionId={curveTransaction.id}
          chargerId={curveTransaction.chargerId}
          open={curveOpen}
          onClose={() => { setCurveOpen(false); setCurveTransaction(null); }}
        />
      )}

      {/* Deposit Refund Dialog */}
      {depositRefundOpen && depositRefundTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDepositRefundOpen(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <div>
                <h3 className="text-lg font-headline font-bold text-foreground">Estornar Depósito</h3>
                <p className="text-xs text-muted-foreground">#{depositRefundTx.id} — {depositRefundTx.userName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Valor do depósito</p>
                <p className="text-2xl font-bold text-foreground">R$ {fmt(depositRefundTx.amount)}</p>
                {depositRefundTx.referenceId && /^[0-9]+$/.test(depositRefundTx.referenceId) && (
                  <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                    MercadoPago Payment ID: {depositRefundTx.referenceId}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Motivo (opcional)</label>
                <textarea
                  value={depositRefundReason}
                  onChange={(e) => setDepositRefundReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  placeholder="Ex: depósito incorreto, valor errado..."
                />
              </div>

              {/* Toggle MercadoPago */}
              {depositRefundTx.referenceId && /^[0-9]+$/.test(depositRefundTx.referenceId) && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setDepositRefundToMP(!depositRefundToMP)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      depositRefundToMP ? 'bg-primary border-primary' : 'border-outline-variant'
                    }`}
                  >
                    {depositRefundToMP && <span className="material-symbols-outlined text-white text-sm">check</span>}
                  </button>
                  <div>
                    <p className="text-sm font-medium text-foreground">Devolver ao meio de pagamento</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      O valor será estornado via MercadoPago de volta ao cartão/Pix do cliente. Caso contrário, apenas debita o saldo da carteira.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDepositRefundOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleDepositRefund()}
                disabled={depositRefundLoading}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {depositRefundLoading ? (
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
