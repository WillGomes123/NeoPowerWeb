import { useState, useEffect } from 'react';
import { ExportButton } from '../components/ExportButton';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { ExportColumn } from '../lib/export';
import { WalletsReportTemplate } from '../components/WalletsReportTemplate';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Search, Filter } from 'lucide-react';

interface WalletData {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface WalletTransaction {
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

// Export column definitions for wallets
const walletExportColumns: ExportColumn[] = [
  { key: 'id', header: 'ID', format: 'number' },
  { key: 'userName', header: 'Usuario', format: 'text' },
  { key: 'userEmail', header: 'Email', format: 'text' },
  { key: 'balance', header: 'Saldo (R$)', format: 'currency' },
  { key: 'updatedAt', header: 'Ultima Atualizacao', format: 'date' },
];

// Export column definitions for transactions
const transactionExportColumns: ExportColumn[] = [
  { key: 'id', header: 'ID', format: 'number' },
  { key: 'userName', header: 'Usuario', format: 'text' },
  { key: 'type', header: 'Tipo', format: 'text' },
  { key: 'amount', header: 'Valor (R$)', format: 'currency' },
  { key: 'balanceBefore', header: 'Saldo Antes', format: 'currency' },
  { key: 'balanceAfter', header: 'Saldo Depois', format: 'currency' },
  { key: 'description', header: 'Descricao', format: 'text' },
  { key: 'createdAt', header: 'Data', format: 'date' },
];

export const Wallets = () => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'wallets' | 'transactions'>('wallets');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [pdfLoading, setPdfLoading] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchWallets(), fetchTransactions()]);
  };

  const fetchWallets = async () => {
    setLoadingWallets(true);
    try {
      const response = await api.get('/admin/wallets');
      if (!response.ok) throw new Error('Falha ao buscar carteiras');
      const data = await response.json();
      setWallets(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingWallets(false);
    }
  };

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const response = await api.get('/admin/wallet-transactions');
      if (!response.ok) throw new Error('Falha ao buscar transacoes');
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const filteredWallets = wallets.filter(w => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return w.userName.toLowerCase().includes(term) || w.userEmail.toLowerCase().includes(term);
  });

  const filteredTransactions = transactions.filter(t => {
    let matchesSearch = true;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      matchesSearch = t.userName.toLowerCase().includes(term) || t.userEmail.toLowerCase().includes(term);
    }
    let matchesType = true;
    if (txTypeFilter !== 'all') {
      matchesType = t.type === txTypeFilter;
    }
    return matchesSearch && matchesType;
  });

  const totalBalance = filteredWallets.reduce((acc, w) => acc + w.balance, 0);
  const totalDeposits = filteredTransactions
    .filter(t => t.type === 'deposit')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalCharges = filteredTransactions
    .filter(t => t.type === 'charge')
    .reduce((acc, t) => acc + t.amount, 0);

  const currentItems = activeTab === 'wallets' ? filteredWallets : filteredTransactions;
  const totalPages = Math.ceil(currentItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return '---';
    return new Date(isoString).toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      deposit: 'Deposito',
      withdrawal: 'Saque',
      charge: 'Cobranca',
      refund: 'Reembolso',
    };
    return labels[type] || type;
  };

  const getTypePill = (type: string) => {
    const styles: Record<string, string> = {
      deposit: 'bg-primary/10 text-primary border-primary/20',
      withdrawal: 'bg-tertiary/10 text-tertiary border-tertiary/20',
      charge: 'bg-error/10 text-error border-error/20',
      refund: 'bg-secondary/10 text-secondary border-secondary/20',
    };
    return styles[type] || 'bg-outline/10 text-on-surface-variant border-outline/20';
  };

  const handleCustomPdfExport = async () => {
    setPdfLoading(true);
    toast.loading('Gerando relatório de carteiras...', { id: 'pdf-gen' });

    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // allow time for template to render completely
      const element = document.getElementById('wallets-report-root');
      if (!element) throw new Error('Template não encontrado');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f0f2f5',
        windowWidth: 794,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio_${activeTab}_neopower.pdf`);
      toast.success('Relatório gerado com sucesso!', { id: 'pdf-gen' });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório PDF', { id: 'pdf-gen' });
    } finally {
      setPdfLoading(false);
    }
  };

  const loading = loadingWallets || loadingTransactions;

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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">DIGITAL WALLETS</span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Carteiras</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => void fetchData()} className="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/10 text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span className="text-xs font-bold font-headline uppercase tracking-wider">Atualizar</span>
          </button>
          <ExportButton
            data={activeTab === 'wallets' ? filteredWallets as unknown as Record<string, unknown>[] : filteredTransactions as unknown as Record<string, unknown>[]}
            columns={activeTab === 'wallets' ? walletExportColumns : transactionExportColumns}
            filename={activeTab === 'wallets' ? 'carteiras_neopower' : 'transacoes_carteira_neopower'}
            title={activeTab === 'wallets' ? 'Carteiras - NeoPower' : 'Transacoes de Carteira - NeoPower'}
            disabled={currentItems.length === 0}
            onCustomPdfExport={handleCustomPdfExport}
            pdfLoading={pdfLoading}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full text-primary bg-primary/10">{filteredWallets.length} carteiras</span>
          </div>
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1">SALDO TOTAL</p>
          <h3 className="text-2xl font-headline font-bold text-on-surface">{formatCurrency(totalBalance)}</h3>
        </div>

        <div className="glass-panel p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
          </div>
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1">TOTAL DEPOSITOS</p>
          <h3 className="text-2xl font-headline font-bold text-primary">{formatCurrency(totalDeposits)}</h3>
        </div>

        <div className="glass-panel p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-error/5 rounded-full blur-2xl group-hover:bg-error/10 transition-all" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error">
              <span className="material-symbols-outlined">trending_down</span>
            </div>
          </div>
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1">TOTAL COBRADO</p>
          <h3 className="text-2xl font-headline font-bold text-error">{formatCurrency(totalCharges)}</h3>
        </div>
      </div>

      {/* Filters and Tabs Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Tab Pills */}
        <div className="bg-surface-container-low p-1 rounded-lg flex items-center border border-outline-variant/10 w-fit shrink-0">
          <button
            onClick={() => { setActiveTab('wallets'); setCurrentPage(1); setSearchTerm(''); setTxTypeFilter('all'); }}
            className={`px-4 py-2 text-xs font-bold font-headline rounded-md transition-all ${
              activeTab === 'wallets'
                ? 'bg-surface-container-highest text-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            CARTEIRAS ({filteredWallets.length})
          </button>
          <button
            onClick={() => { setActiveTab('transactions'); setCurrentPage(1); setSearchTerm(''); }}
            className={`px-4 py-2 text-xs font-bold font-headline rounded-md transition-all ${
              activeTab === 'transactions'
                ? 'bg-surface-container-highest text-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            TRANSACOES ({filteredTransactions.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant"
            />
          </div>
          {activeTab === 'transactions' && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <select
                value={txTypeFilter}
                onChange={(e) => { setTxTypeFilter(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-48 pl-9 pr-8 py-2.5 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Todos os tipos</option>
                <option value="deposit">Depósito</option>
                <option value="withdrawal">Saque</option>
                <option value="charge">Cobrança</option>
                <option value="refund">Reembolso</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-headline font-bold text-on-surface">
              {activeTab === 'wallets' ? 'Carteiras dos Usuarios' : 'Historico de Transacoes'}
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              {activeTab === 'wallets'
                ? `Mostrando ${currentItems.length} carteira(s)`
                : `Mostrando ${currentItems.length} transacao(oes)`}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'wallets' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Saldo</th>
                  <th className="px-6 py-4">Ultima Atualizacao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filteredWallets.slice(startIndex, endIndex).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <span className="material-symbols-outlined text-4xl text-outline mb-3 block">account_balance_wallet</span>
                      <p className="text-sm text-on-surface-variant">Nenhuma carteira encontrada</p>
                    </td>
                  </tr>
                ) : filteredWallets.slice(startIndex, endIndex).map(wallet => (
                  <tr key={wallet.id} className="hover:bg-surface-container-highest/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold">
                        #{wallet.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-sm text-on-surface">
                      {wallet.userName}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {wallet.userEmail}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold font-headline">
                      <span className={wallet.balance > 0 ? 'text-primary' : 'text-on-surface-variant'}>
                        {formatCurrency(wallet.balance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {formatDateTime(wallet.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Saldo Anterior</th>
                  <th className="px-6 py-4">Saldo Atual</th>
                  <th className="px-6 py-4">Descricao</th>
                  <th className="px-6 py-4">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filteredTransactions.slice(startIndex, endIndex).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <span className="material-symbols-outlined text-4xl text-outline mb-3 block">receipt_long</span>
                      <p className="text-sm text-on-surface-variant">Nenhuma transacao encontrada</p>
                    </td>
                  </tr>
                ) : filteredTransactions.slice(startIndex, endIndex).map(tx => (
                  <tr key={tx.id} className="hover:bg-surface-container-highest/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold">
                        #{tx.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-sm text-on-surface">
                      {tx.userName}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border ${getTypePill(tx.type)}`}>
                        {getTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold font-headline">
                      <span className={tx.type === 'deposit' || tx.type === 'refund' ? 'text-primary' : 'text-error'}>
                        {tx.type === 'deposit' || tx.type === 'refund' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {formatCurrency(tx.balanceBefore)}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {formatCurrency(tx.balanceAfter)}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[200px] truncate">
                      {tx.description || '---'}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {formatDateTime(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-outline-variant/10 flex justify-between items-center">
            <p className="text-xs text-on-surface-variant">
              Pagina <span className="font-bold text-on-surface">{currentPage}</span> de <span className="font-bold text-on-surface">{totalPages || 1}</span>
              <span className="ml-2 text-outline">({currentItems.length} itens)</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
              >
                Proxima
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        <WalletsReportTemplate 
          data={{
            walletsCount: filteredWallets.length,
            totalBalance,
            totalDeposits,
            totalCharges,
            activeTab,
            wallets: activeTab === 'wallets' ? filteredWallets : [],
            transactions: activeTab === 'transactions' ? filteredTransactions : [],
          }}
          generationDate={new Date().toLocaleString('pt-BR')}
        />
      </div>

    </div>
  );
};
