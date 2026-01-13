import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  EnhancedTable,
  EnhancedTableHeader,
  EnhancedTableBody,
  EnhancedTableRow,
  EnhancedTableHead,
  EnhancedTableCell,
} from '../components/EnhancedTable';
import { Button } from '../components/ui/button';
import { StatusBadge } from '../components/StatusBadge';
import { ExportButton } from '../components/ExportButton';
import { ChevronLeft, ChevronRight, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { ExportColumn } from '../lib/export';

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

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalCharges = transactions
    .filter(t => t.type === 'charge')
    .reduce((acc, t) => acc + t.amount, 0);

  const currentItems = activeTab === 'wallets' ? wallets : transactions;
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

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      deposit: 'text-emerald-400',
      withdrawal: 'text-red-400',
      charge: 'text-orange-400',
      refund: 'text-blue-400',
    };
    return colors[type] || 'text-zinc-400';
  };

  const loading = loadingWallets || loadingTransactions;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-emerald-50 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-emerald-400" />
            Carteiras Digitais
          </h1>
          <p className="text-emerald-300/60 mt-1">Gerencie as carteiras e transacoes dos usuarios</p>
        </div>
        <Button
          onClick={fetchData}
          variant="outline"
          className="bg-emerald-900/40 border-emerald-700/50 text-emerald-100 hover:bg-emerald-800/60"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-300/60 text-sm">Saldo Total</p>
                <p className="text-2xl font-bold text-emerald-50">{formatCurrency(totalBalance)}</p>
              </div>
              <Wallet className="w-10 h-10 text-emerald-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-300/60 text-sm">Total Depositos</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalDeposits)}</p>
              </div>
              <ArrowUpCircle className="w-10 h-10 text-emerald-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-300/60 text-sm">Total Cobrado</p>
                <p className="text-2xl font-bold text-orange-400">{formatCurrency(totalCharges)}</p>
              </div>
              <ArrowDownCircle className="w-10 h-10 text-orange-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          onClick={() => { setActiveTab('wallets'); setCurrentPage(1); }}
          variant={activeTab === 'wallets' ? 'default' : 'outline'}
          className={activeTab === 'wallets'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-emerald-900/40 border-emerald-700/50 text-emerald-100 hover:bg-emerald-800/60'}
        >
          <Wallet className="w-4 h-4 mr-2" />
          Carteiras ({wallets.length})
        </Button>
        <Button
          onClick={() => { setActiveTab('transactions'); setCurrentPage(1); }}
          variant={activeTab === 'transactions' ? 'default' : 'outline'}
          className={activeTab === 'transactions'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-emerald-900/40 border-emerald-700/50 text-emerald-100 hover:bg-emerald-800/60'}
        >
          <ArrowUpCircle className="w-4 h-4 mr-2" />
          Transacoes ({transactions.length})
        </Button>
      </div>

      {/* Content */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
        <CardHeader className="border-b border-emerald-800/30 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-emerald-50 flex items-center gap-2">
                {activeTab === 'wallets' ? (
                  <>
                    <Wallet className="w-5 h-5 text-emerald-400" />
                    Carteiras dos Usuarios
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                    Historico de Transacoes
                  </>
                )}
              </CardTitle>
              <p className="text-sm text-emerald-300/60 mt-1">
                {activeTab === 'wallets'
                  ? `${wallets.length} carteiras cadastradas`
                  : `${transactions.length} transacoes realizadas`}
              </p>
            </div>
            <ExportButton
              data={activeTab === 'wallets' ? wallets : transactions}
              columns={activeTab === 'wallets' ? walletExportColumns : transactionExportColumns}
              filename={activeTab === 'wallets' ? 'carteiras_neopower' : 'transacoes_carteira_neopower'}
              title={activeTab === 'wallets' ? 'Carteiras - NeoPower' : 'Transacoes de Carteira - NeoPower'}
              disabled={currentItems.length === 0}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {activeTab === 'wallets' ? (
            <EnhancedTable striped hoverable>
              <EnhancedTableHeader>
                <EnhancedTableRow hoverable={false}>
                  <EnhancedTableHead>ID</EnhancedTableHead>
                  <EnhancedTableHead>Usuario</EnhancedTableHead>
                  <EnhancedTableHead>Email</EnhancedTableHead>
                  <EnhancedTableHead>Saldo</EnhancedTableHead>
                  <EnhancedTableHead>Ultima Atualizacao</EnhancedTableHead>
                </EnhancedTableRow>
              </EnhancedTableHeader>
              <EnhancedTableBody>
                {wallets.slice(startIndex, endIndex).map((wallet, index) => (
                  <EnhancedTableRow key={wallet.id} index={index}>
                    <EnhancedTableCell className="font-mono">
                      <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        {wallet.id}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell className="font-medium">
                      {wallet.userName}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-emerald-300/70">
                      {wallet.userEmail}
                    </EnhancedTableCell>
                    <EnhancedTableCell highlight>
                      <span className={wallet.balance > 0 ? 'text-emerald-400' : 'text-zinc-400'}>
                        {formatCurrency(wallet.balance)}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm">
                      {formatDateTime(wallet.updatedAt)}
                    </EnhancedTableCell>
                  </EnhancedTableRow>
                ))}
              </EnhancedTableBody>
            </EnhancedTable>
          ) : (
            <EnhancedTable striped hoverable>
              <EnhancedTableHeader>
                <EnhancedTableRow hoverable={false}>
                  <EnhancedTableHead>ID</EnhancedTableHead>
                  <EnhancedTableHead>Usuario</EnhancedTableHead>
                  <EnhancedTableHead>Tipo</EnhancedTableHead>
                  <EnhancedTableHead>Valor</EnhancedTableHead>
                  <EnhancedTableHead>Saldo Anterior</EnhancedTableHead>
                  <EnhancedTableHead>Saldo Atual</EnhancedTableHead>
                  <EnhancedTableHead>Descricao</EnhancedTableHead>
                  <EnhancedTableHead>Data</EnhancedTableHead>
                </EnhancedTableRow>
              </EnhancedTableHeader>
              <EnhancedTableBody>
                {transactions.slice(startIndex, endIndex).map((tx, index) => (
                  <EnhancedTableRow key={tx.id} index={index}>
                    <EnhancedTableCell className="font-mono">
                      <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        {tx.id}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell className="font-medium">
                      {tx.userName}
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <span className={`font-medium ${getTypeColor(tx.type)}`}>
                        {getTypeLabel(tx.type)}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell highlight>
                      <span className={tx.type === 'deposit' || tx.type === 'refund' ? 'text-emerald-400' : 'text-orange-400'}>
                        {tx.type === 'deposit' || tx.type === 'refund' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-emerald-300/70">
                      {formatCurrency(tx.balanceBefore)}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-emerald-300/70">
                      {formatCurrency(tx.balanceAfter)}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm text-emerald-300/70 max-w-[200px] truncate">
                      {tx.description || '---'}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm">
                      {formatDateTime(tx.createdAt)}
                    </EnhancedTableCell>
                  </EnhancedTableRow>
                ))}
              </EnhancedTableBody>
            </EnhancedTable>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-emerald-800/30">
            <div className="text-sm text-emerald-300/70">
              Pagina {currentPage} de {totalPages || 1} ({currentItems.length} itens)
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-emerald-900/40 border-emerald-700/50 text-emerald-100 hover:bg-emerald-800/60 hover:border-emerald-600 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="bg-emerald-900/40 border-emerald-700/50 text-emerald-100 hover:bg-emerald-800/60 hover:border-emerald-600 disabled:opacity-30"
              >
                Proxima
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
