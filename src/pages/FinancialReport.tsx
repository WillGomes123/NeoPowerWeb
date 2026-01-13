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
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  FileText,
  DollarSign,
  TrendingUp,
  Zap,
  Download,
  RefreshCw,
  Search,
  X,
  ArrowUpRight,
  Percent,
  Wallet,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { DateRangePicker } from '../components/ui/date-range-picker';

interface FinancialReportItem {
  Estação: string;
  Início: string;
  Fim: string;
  'Recarga (kWh)': string;
  'Receita (R$)': string;
  'Valor Total de Taxas (R$)': string;
  'Valor Recebido (R$)': string;
  'Valor Pago ao Cliente (R$)': string;
  Status: string;
}

interface WalletTransactionItem {
  id: number;
  userId: number | null;
  userName: string;
  userEmail: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  referenceId: string | null;
  createdAt: string;
}

export const FinancialReport = () => {
  const [reportData, setReportData] = useState<FinancialReportItem[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [submittedFilter, setSubmittedFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    void fetchReport();
    void fetchWalletTransactions();
  }, [submittedFilter, startDate, endDate]);

  const fetchReport = async () => {
    setLoading(true);
    let endpoint = '/reports/financial';
    const params = new URLSearchParams();

    if (submittedFilter) params.append('chargerId', submittedFilter);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    try {
      const response = await api.get(endpoint);

      if (!response.ok) {
        throw new Error('Erro ao buscar relatório');
      }

      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar relatório financeiro');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletTransactions = async () => {
    try {
      const response = await api.get('/admin/wallet-transactions');
      if (response.ok) {
        const data = await response.json();
        // Filtrar por período se especificado
        let filtered = data;
        if (startDate) {
          const start = new Date(startDate);
          filtered = filtered.filter((t: WalletTransactionItem) => new Date(t.createdAt) >= start);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filtered = filtered.filter((t: WalletTransactionItem) => new Date(t.createdAt) <= end);
        }
        setWalletTransactions(filtered);
      }
    } catch (error) {
      console.error('Erro ao buscar transações da carteira:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchReport(), fetchWalletTransactions()]);
    setRefreshing(false);
    toast.success('Relatório atualizado!');
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedFilter(filterId);
  };

  const handleClearFilters = () => {
    setFilterId('');
    setSubmittedFilter('');
    setStartDate('');
    setEndDate('');
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = ['Estação', 'Início', 'Fim', 'Recarga (kWh)', 'Receita (R$)', 'Taxas (R$)', 'Recebido (R$)', 'Pago Cliente (R$)', 'Status'];
    const csvContent = [
      headers.join(','),
      ...reportData.map(row => [
        row['Estação'],
        row['Início'],
        row['Fim'],
        row['Recarga (kWh)'],
        row['Receita (R$)'],
        row['Valor Total de Taxas (R$)'],
        row['Valor Recebido (R$)'],
        row['Valor Pago ao Cliente (R$)'],
        row['Status']
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Relatório exportado com sucesso!');
  };

  const totals = reportData.reduce(
    (acc, row) => {
      acc.energy += parseFloat(row['Recarga (kWh)']) || 0;
      acc.revenue += parseFloat(row['Receita (R$)']) || 0;
      acc.fees += parseFloat(row['Valor Total de Taxas (R$)']) || 0;
      acc.received += parseFloat(row['Valor Recebido (R$)']) || 0;
      acc.payout += parseFloat(row['Valor Pago ao Cliente (R$)']) || 0;
      return acc;
    },
    { energy: 0, revenue: 0, fees: 0, received: 0, payout: 0 }
  );

  // Cálculos de depósitos
  const deposits = walletTransactions.filter(t => t.type === 'deposit');
  const totalDeposits = deposits.reduce((acc, t) => acc + t.amount, 0);
  const mercadoPagoFeeDeposits = totalDeposits * 0.01; // 1% taxa Mercado Pago
  const netDeposits = totalDeposits - mercadoPagoFeeDeposits;

  // Cálculos de distribuição de receita
  // Usando os valores já calculados pelo backend
  const grossRevenue = totals.revenue;

  // Distribuição baseada nas taxas do backend:
  // - 14.26% em taxas totais (4% moove + 3.5% cartão + 6.76% imposto) - APENAS para recargas
  // - 1% taxa Mercado Pago - APENAS para depósitos
  // - Do líquido, distribuímos:
  //   - 70% para o dono da estação (cliente)
  //   - 20% para lucro NeoPower
  //   - 10% para manutenção do site/infraestrutura

  // === CÁLCULOS COMBINADOS (Recargas + Depósitos) ===
  const entradaBrutaTotal = grossRevenue + totalDeposits;
  const taxasRecargas = totals.fees; // 14.26% das recargas
  const taxasDepositos = mercadoPagoFeeDeposits; // 1% dos depósitos
  const taxasTotais = taxasRecargas + taxasDepositos;

  // Líquido total (após todas as taxas)
  const liquidoRecargas = totals.received; // Receita - taxas (85.74%)
  const liquidoDepositos = netDeposits; // Depósitos - 1% MP
  const liquidoTotal = liquidoRecargas + liquidoDepositos;

  // Distribuição do líquido total
  const valorPagoCliente = liquidoTotal * 0.70; // 70% do líquido para dono da estação
  const lucroNeoPower = liquidoTotal * 0.20; // 20% do líquido para NeoPower
  const manutencaoSite = liquidoTotal * 0.10; // 10% do líquido para manutenção

  // Lucro total da plataforma (manutenção + lucro = 30%)
  const platformProfit = manutencaoSite + lucroNeoPower;
  const profitMargin = entradaBrutaTotal > 0 ? ((platformProfit / entradaBrutaTotal) * 100) : 0;

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('conclu') || statusLower.includes('finish') || statusLower.includes('complet')) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          {status}
        </span>
      );
    }
    if (statusLower.includes('pend') || statusLower.includes('process')) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium">
          {status}
        </span>
      );
    }
    if (statusLower.includes('cancel') || statusLower.includes('fail') || statusLower.includes('error')) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium">
          {status}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full bg-zinc-500/20 border border-zinc-500/30 text-zinc-400 text-xs font-medium">
        {status}
      </span>
    );
  };

  if (loading && reportData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-emerald-300/60">Gerando relatório financeiro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 flex items-center gap-3">
            <FileText className="w-8 h-8 text-emerald-400" />
            Relatório Financeiro
          </h1>
          <p className="text-emerald-300/60 mt-1">Análise detalhada de receitas, custos e lucros</p>
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
          <button
            onClick={handleExportCSV}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-300/60 font-medium uppercase tracking-wide">Entrada Bruta Total</p>
                <p className="text-xl font-bold text-emerald-50 mt-1">
                  R$ {(grossRevenue + totalDeposits).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-emerald-300/40 mt-1">Recargas + Depósitos</p>
              </div>
              <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-300/60 font-medium uppercase tracking-wide">Receita Líquida</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">
                  R$ {liquidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-emerald-300/40 mt-1">Após taxas (MP + outras)</p>
              </div>
              <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-950/40 to-emerald-900/20 border-red-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-300/60 font-medium uppercase tracking-wide">Total Taxas</p>
                <p className="text-xl font-bold text-red-400 mt-1">
                  -R$ {taxasTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-red-300/40 mt-1">Recargas + MP (1%)</p>
              </div>
              <div className="p-2.5 bg-red-500/20 rounded-lg">
                <Percent className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-950/40 to-emerald-900/20 border-purple-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-300/60 font-medium uppercase tracking-wide">Depósitos Líquidos</p>
                <p className="text-xl font-bold text-purple-400 mt-1">
                  R$ {netDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-purple-300/40 mt-1">{deposits.length} depósito(s)</p>
              </div>
              <div className="p-2.5 bg-purple-500/20 rounded-lg">
                <Wallet className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição de Receita - Cards Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-950/40 to-emerald-900/20 border-blue-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-300/60 font-medium uppercase tracking-wide">Cliente (Dono Estação)</p>
                <p className="text-xl font-bold text-blue-400 mt-1">
                  R$ {valorPagoCliente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-blue-300/40 mt-1">70% do líquido de recargas</p>
              </div>
              <div className="p-2.5 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-300/60 font-medium uppercase tracking-wide">Lucro NeoPower</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">
                  R$ {lucroNeoPower.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-emerald-300/40 mt-1">20% do líquido de recargas</p>
              </div>
              <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-950/40 to-emerald-900/20 border-cyan-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-cyan-300/60 font-medium uppercase tracking-wide">Manutenção do Site</p>
                <p className="text-xl font-bold text-cyan-400 mt-1">
                  R$ {manutencaoSite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-cyan-300/40 mt-1">10% do líquido de recargas</p>
              </div>
              <div className="p-2.5 bg-cyan-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Depósitos em Carteira */}
      <Card className="bg-gradient-to-br from-purple-950/40 to-emerald-900/20 border-purple-800/30">
        <CardHeader className="border-b border-purple-800/30 pb-4">
          <CardTitle className="text-xl text-emerald-50 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            Depósitos em Carteira
          </CardTitle>
          <p className="text-sm text-emerald-300/60 mt-1">Valores depositados pelos usuários (Pix/Cartão) - Taxa Mercado Pago 1%</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-purple-950/30 border border-purple-800/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <p className="text-xs text-purple-300/60 font-medium uppercase">Total Depósitos</p>
              </div>
              <p className="text-lg font-bold text-purple-300">R$ {totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-purple-400/70 mt-1">{deposits.length} depósitos</p>
            </div>

            <div className="p-4 rounded-lg bg-red-950/20 border border-red-800/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <p className="text-xs text-red-300/60 font-medium uppercase">Taxa Mercado Pago</p>
              </div>
              <p className="text-lg font-bold text-red-400">-R$ {mercadoPagoFeeDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-red-400/70 mt-1">1% sobre depósitos</p>
            </div>

            <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                <p className="text-xs text-emerald-300/60 font-medium uppercase">Depósitos Líquidos</p>
              </div>
              <p className="text-lg font-bold text-emerald-400">R$ {netDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-emerald-400/70 mt-1">Valor disponível</p>
            </div>

            <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-800/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <p className="text-xs text-blue-300/60 font-medium uppercase">Média por Depósito</p>
              </div>
              <p className="text-lg font-bold text-blue-400">
                R$ {deposits.length > 0 ? (totalDeposits / deposits.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
              </p>
              <p className="text-xs text-blue-400/70 mt-1">Valor médio</p>
            </div>
          </div>

          {/* Lista de depósitos recentes */}
          {deposits.length > 0 ? (
            <div className="overflow-x-auto">
              <EnhancedTable striped hoverable>
                <EnhancedTableHeader>
                  <EnhancedTableRow hoverable={false}>
                    <EnhancedTableHead>Usuário</EnhancedTableHead>
                    <EnhancedTableHead>Data</EnhancedTableHead>
                    <EnhancedTableHead className="text-right">Valor</EnhancedTableHead>
                    <EnhancedTableHead className="text-right">Taxa MP (1%)</EnhancedTableHead>
                    <EnhancedTableHead className="text-right">Líquido</EnhancedTableHead>
                    <EnhancedTableHead>Referência</EnhancedTableHead>
                  </EnhancedTableRow>
                </EnhancedTableHeader>
                <EnhancedTableBody>
                  {deposits.slice(0, 10).map((deposit, index) => (
                    <EnhancedTableRow key={deposit.id} index={index}>
                      <EnhancedTableCell className="font-medium text-emerald-50">
                        <div>
                          <p>{deposit.userName}</p>
                          <p className="text-xs text-emerald-300/50">{deposit.userEmail}</p>
                        </div>
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-sm text-emerald-300/70">
                        {new Date(deposit.createdAt).toLocaleString('pt-BR')}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-right font-mono text-purple-400">
                        R$ {deposit.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-right font-mono text-red-400/70">
                        -R$ {(deposit.amount * 0.01).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-right font-mono text-emerald-400">
                        R$ {(deposit.amount * 0.99).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-sm text-emerald-300/50">
                        {deposit.referenceId || '-'}
                      </EnhancedTableCell>
                    </EnhancedTableRow>
                  ))}
                </EnhancedTableBody>
              </EnhancedTable>
              {deposits.length > 10 && (
                <p className="text-sm text-emerald-300/50 mt-4 text-center">
                  Mostrando 10 de {deposits.length} depósitos
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Wallet className="w-12 h-12 text-purple-800/50 mb-3" />
              <p className="text-emerald-300/60">Nenhum depósito encontrado no período.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribuição de Receita Total */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <CardTitle className="text-xl text-emerald-50">Distribuição de Receita Total</CardTitle>
          <p className="text-sm text-emerald-300/60 mt-1">Depósitos + Recargas - como o dinheiro é distribuído</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Entrada Bruta */}
            <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <p className="text-xs text-emerald-300/60 font-medium uppercase">Entrada Bruta Total</p>
              </div>
              <p className="text-xl font-bold text-emerald-50">R$ {(grossRevenue + totalDeposits).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between text-emerald-300/70">
                  <span>Depósitos:</span>
                  <span>R$ {totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-emerald-300/70">
                  <span>Recargas:</span>
                  <span>R$ {grossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Taxas Totais */}
            <div className="p-4 rounded-lg bg-red-950/20 border border-red-800/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <p className="text-xs text-red-300/60 font-medium uppercase">Total Taxas Descontadas</p>
              </div>
              <p className="text-xl font-bold text-red-400">-R$ {taxasTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between text-red-300/70">
                  <span>Taxa MP (1% depósitos):</span>
                  <span>-R$ {mercadoPagoFeeDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-red-300/70">
                  <span>Taxas recargas (14.26%):</span>
                  <span>-R$ {taxasRecargas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Valor Líquido Total */}
            <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                <p className="text-xs text-emerald-300/60 font-medium uppercase">Receita Líquida Total</p>
              </div>
              <p className="text-xl font-bold text-emerald-400">R$ {liquidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between text-emerald-300/70">
                  <span>Depósitos líquidos:</span>
                  <span>R$ {liquidoDepositos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-emerald-300/70">
                  <span>Recargas líquidas:</span>
                  <span>R$ {liquidoRecargas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Distribuição do Lucro Total (Recargas + Depósitos) */}
          {entradaBrutaTotal > 0 && (
            <>
              <h4 className="text-sm font-semibold text-emerald-300 mb-3 mt-6">Distribuição da Receita Total</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-800/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <p className="text-xs text-blue-300/60 font-medium uppercase">Dono da Estação (Cliente)</p>
                  </div>
                  <p className="text-lg font-bold text-blue-400">R$ {valorPagoCliente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-blue-400/70 mt-1">70% do líquido (~60% do bruto)</p>
                </div>

                <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                    <p className="text-xs text-emerald-300/60 font-medium uppercase">Lucro NeoPower</p>
                  </div>
                  <p className="text-lg font-bold text-emerald-400">R$ {lucroNeoPower.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-emerald-400/70 mt-1">20% do líquido (~17.1% do bruto)</p>
                </div>

                <div className="p-4 rounded-lg bg-cyan-950/20 border border-cyan-800/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                    <p className="text-xs text-cyan-300/60 font-medium uppercase">Manutenção do Site</p>
                  </div>
                  <p className="text-lg font-bold text-cyan-400">R$ {manutencaoSite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-cyan-400/70 mt-1">10% do líquido (~8.6% do bruto)</p>
                </div>

                <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <p className="text-xs text-amber-300/60 font-medium uppercase">Margem Total</p>
                  </div>
                  <p className={`text-lg font-bold ${profitMargin >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {profitMargin.toFixed(1)}%
                  </p>
                  <p className="text-xs text-amber-400/70 mt-1">NeoPower + Manutenção / Bruto</p>
                </div>
              </div>

              {/* Barra de progresso visual */}
              <div className="mt-6">
                <p className="text-xs text-emerald-300/60 mb-2">Distribuição da Receita Total (% do bruto):</p>
                {(() => {
                  const percTaxas = entradaBrutaTotal > 0 ? (taxasTotais / entradaBrutaTotal) * 100 : 0;
                  const percCliente = entradaBrutaTotal > 0 ? (valorPagoCliente / entradaBrutaTotal) * 100 : 0;
                  const percNeoPower = entradaBrutaTotal > 0 ? (lucroNeoPower / entradaBrutaTotal) * 100 : 0;
                  const percManutencao = entradaBrutaTotal > 0 ? (manutencaoSite / entradaBrutaTotal) * 100 : 0;
                  return (
                    <>
                      <div className="h-6 rounded-full overflow-hidden flex bg-emerald-950/50">
                        <div className="h-full bg-red-500 flex items-center justify-center" style={{ width: `${percTaxas}%` }} title={`Taxas (${percTaxas.toFixed(1)}%)`}>
                          <span className="text-[10px] text-white font-medium">{percTaxas.toFixed(1)}%</span>
                        </div>
                        <div className="h-full bg-blue-500 flex items-center justify-center" style={{ width: `${percCliente}%` }} title={`Cliente (${percCliente.toFixed(1)}%)`}>
                          <span className="text-[10px] text-white font-medium">{percCliente.toFixed(1)}%</span>
                        </div>
                        <div className="h-full bg-emerald-500 flex items-center justify-center" style={{ width: `${percNeoPower}%` }} title={`NeoPower (${percNeoPower.toFixed(1)}%)`}>
                          <span className="text-[10px] text-white font-medium">{percNeoPower.toFixed(1)}%</span>
                        </div>
                        <div className="h-full bg-cyan-500 flex items-center justify-center" style={{ width: `${percManutencao}%` }} title={`Manutenção (${percManutencao.toFixed(1)}%)`}>
                          <span className="text-[10px] text-white font-medium">{percManutencao.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-red-300/70">Taxas ({percTaxas.toFixed(1)}%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-blue-300/70">Cliente ({percCliente.toFixed(1)}%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-emerald-300/70">NeoPower ({percNeoPower.toFixed(1)}%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                          <span className="text-cyan-300/70">Manutenção ({percManutencao.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          )}

          {/* Resumo dos Depósitos */}
          {totalDeposits > 0 && (
            <>
              <h4 className="text-sm font-semibold text-purple-300 mb-3 mt-6">Distribuição dos Depósitos</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-purple-950/20 border border-purple-800/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <p className="text-xs text-purple-300/60 font-medium uppercase">Depósito Bruto</p>
                  </div>
                  <p className="text-lg font-bold text-purple-400">R$ {totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-purple-400/70 mt-1">Valor depositado pelo cliente</p>
                </div>

                <div className="p-4 rounded-lg bg-red-950/20 border border-red-800/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <p className="text-xs text-red-300/60 font-medium uppercase">Taxa Mercado Pago</p>
                  </div>
                  <p className="text-lg font-bold text-red-400">-R$ {mercadoPagoFeeDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-red-400/70 mt-1">1% sobre depósitos</p>
                </div>

                <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                    <p className="text-xs text-emerald-300/60 font-medium uppercase">Depósito Líquido</p>
                  </div>
                  <p className="text-lg font-bold text-emerald-400">R$ {netDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-emerald-400/70 mt-1">Saldo na carteira do cliente</p>
                </div>
              </div>

              {/* Barra de progresso visual depósitos */}
              <div className="mt-4">
                <div className="h-3 rounded-full overflow-hidden flex bg-purple-950/50">
                  <div className="h-full bg-red-500" style={{ width: '1%' }} title="Taxa MP (1%)"></div>
                  <div className="h-full bg-emerald-500" style={{ width: '99%' }} title="Saldo Cliente (99%)"></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-emerald-300/60">
                  <span>Taxa MP (1%)</span>
                  <span>Saldo Cliente (99%)</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardContent className="p-4">
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-emerald-300/60 font-medium mb-1.5 block">ID da Estação</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
                <Input
                  type="text"
                  placeholder="Filtrar por estação..."
                  value={filterId}
                  onChange={e => setFilterId(e.target.value)}
                  className="pl-10 bg-emerald-950/30 border-emerald-800/50 text-emerald-50 placeholder:text-emerald-300/30 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-emerald-300/60 font-medium mb-1.5 block">Período</label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClear={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="min-w-[280px]"
              />
            </div>

            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 h-10"
            >
              <Search className="w-4 h-4 mr-2" />
              Filtrar
            </Button>

            {submittedFilter && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                className="border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/30 h-10"
              >
                <X className="w-4 h-4 mr-2" />
                Limpar Estação
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl text-emerald-50">Detalhamento por Transação</CardTitle>
              <p className="text-sm text-emerald-300/60 mt-1">
                {reportData.length} {reportData.length === 1 ? 'registro encontrado' : 'registros encontrados'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <EnhancedTable striped hoverable>
              <EnhancedTableHeader>
                <EnhancedTableRow hoverable={false}>
                  <EnhancedTableHead>Estação</EnhancedTableHead>
                  <EnhancedTableHead>Início</EnhancedTableHead>
                  <EnhancedTableHead>Fim</EnhancedTableHead>
                  <EnhancedTableHead className="text-right">Energia</EnhancedTableHead>
                  <EnhancedTableHead className="text-right">Receita</EnhancedTableHead>
                  <EnhancedTableHead className="text-right">Taxas</EnhancedTableHead>
                  <EnhancedTableHead className="text-right">Recebido</EnhancedTableHead>
                  <EnhancedTableHead className="text-right">Pago</EnhancedTableHead>
                  <EnhancedTableHead className="text-center">Status</EnhancedTableHead>
                </EnhancedTableRow>
              </EnhancedTableHeader>
              <EnhancedTableBody>
                {reportData.length > 0 ? (
                  reportData.map((row, index) => (
                    <EnhancedTableRow key={index} index={index}>
                      <EnhancedTableCell className="font-medium text-emerald-50">
                        {row['Estação']}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-sm text-emerald-300/70">
                        {row['Início']}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-sm text-emerald-300/70">
                        {row['Fim']}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-right font-mono text-amber-400">
                        {row['Recarga (kWh)']} kWh
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-right font-mono text-emerald-400">
                        R$ {row['Receita (R$)']}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-right font-mono text-red-400/70">
                        R$ {row['Valor Total de Taxas (R$)']}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-right font-mono text-emerald-300">
                        R$ {row['Valor Recebido (R$)']}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-right font-mono text-blue-400">
                        R$ {row['Valor Pago ao Cliente (R$)']}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-center">
                        {getStatusBadge(row['Status'])}
                      </EnhancedTableCell>
                    </EnhancedTableRow>
                  ))
                ) : (
                  <EnhancedTableRow index={0}>
                    <EnhancedTableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="w-12 h-12 text-emerald-800/50" />
                        <p className="text-emerald-300/60">Nenhum dado encontrado para os filtros selecionados.</p>
                      </div>
                    </EnhancedTableCell>
                  </EnhancedTableRow>
                )}
              </EnhancedTableBody>
            </EnhancedTable>
          </div>

          {/* Totals Footer */}
          {reportData.length > 0 && (
            <div className="mt-6 pt-6 border-t border-emerald-800/30">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/20">
                  <p className="text-xs text-emerald-300/60 mb-1">Total Transações</p>
                  <p className="text-lg font-bold text-emerald-50">{reportData.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/20">
                  <p className="text-xs text-emerald-300/60 mb-1">Energia Total</p>
                  <p className="text-lg font-bold text-amber-400">{totals.energy.toFixed(2)} kWh</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/20">
                  <p className="text-xs text-emerald-300/60 mb-1">Receita Total</p>
                  <p className="text-lg font-bold text-emerald-400">R$ {totals.revenue.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/20">
                  <p className="text-xs text-emerald-300/60 mb-1">Total Taxas</p>
                  <p className="text-lg font-bold text-red-400">R$ {totals.fees.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/20">
                  <p className="text-xs text-emerald-300/60 mb-1">Lucro Líquido</p>
                  <p className={`text-lg font-bold ${platformProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    R$ {platformProfit.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
