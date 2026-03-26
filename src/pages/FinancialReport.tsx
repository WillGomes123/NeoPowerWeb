<<<<<<< HEAD
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth';
=======
import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ReportTemplate } from '../components/ReportTemplate';
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
  Percent,
  Wallet,
  Users
} from 'lucide-react';
>>>>>>> 369f77871143a7d82dc526e4cc33de76d3271c15
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [reportData, setReportData] = useState<FinancialReportItem[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [submittedFilter, setSubmittedFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
<<<<<<< HEAD
  const [userLocationIds, setUserLocationIds] = useState<number[]>([]);
  const [userLocationNames, setUserLocationNames] = useState<string[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(isAdmin); // admin doesn't need to load locations
=======
  const [pdfLoading, setPdfLoading] = useState(false);
>>>>>>> 369f77871143a7d82dc526e4cc33de76d3271c15

  // Fetch user's allowed locations for non-admin users
  useEffect(() => {
    if (isAdmin) {
      setLocationsLoaded(true);
      return;
    }
    if (!user?.id) return;

    api.get(`/users/${user.id}/locations`).then(async (res) => {
      if (res.ok) {
        const locs = await res.json();
        const ids = locs.map((l: any) => l.locationId);
        const names = locs.map((l: any) => l.locationAddress || l.name || '');
        setUserLocationIds(ids);
        setUserLocationNames(names);
      }
    }).catch(() => {}).finally(() => {
      setLocationsLoaded(true);
    });
  }, [isAdmin, user?.id]);

  const fetchReport = useCallback(async () => {
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
      const items = Array.isArray(data) ? data : [];

      // For non-admin users, filter by their allowed locations
      if (!isAdmin && userLocationNames.length > 0) {
        const filtered = items.filter((item: FinancialReportItem) => {
          const stationName = item['Estação'] || '';
          return userLocationNames.some(loc => loc && stationName.toLowerCase().includes(loc.toLowerCase()));
        });
        setReportData(filtered);
      } else if (!isAdmin && userLocationNames.length === 0) {
        // Non-admin with no locations assigned → empty
        setReportData([]);
      } else {
        setReportData(items);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar relatório financeiro');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [submittedFilter, startDate, endDate, isAdmin, userLocationNames]);

  const fetchWalletTransactions = useCallback(async () => {
    // Non-admin users don't see wallet transactions
    if (!isAdmin) {
      setWalletTransactions([]);
      return;
    }
    try {
      const response = await api.get('/admin/wallet-transactions');
      if (response.ok) {
        const data = await response.json();
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
  }, [isAdmin, startDate, endDate]);

  // Only fetch after locations are loaded (race condition fix)
  useEffect(() => {
    if (!locationsLoaded) return;
    void fetchReport();
    void fetchWalletTransactions();
  }, [locationsLoaded, fetchReport, fetchWalletTransactions]);

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

  const handleExportPDF = async () => {
    if (reportData.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    setPdfLoading(true);
    toast.loading('Gerando PDF profissional...', { id: 'pdf-gen' });

    try {
      // Pequeno delay para garantir que os gráficos do template carreguem
      await new Promise(resolve => setTimeout(resolve, 1000));

      const element = document.getElementById('report-root');
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
      
      // Calcular altura proporcional
      // html2canvas captura o elemento inteiro, se houver várias páginas (vários <section>)
      // aqui vamos dividir em páginas se necessário ou apenas uma imagem longa
      // Para o NeoPower v1, vamos gerar uma imagem inteira e caber na folha ou quebrar
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Se for maior que uma página A4 (297mm), vamos adicionar múltiplas páginas
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

      pdf.save(`relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF gerado com sucesso!', { id: 'pdf-gen' });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF', { id: 'pdf-gen' });
    } finally {
      setPdfLoading(false);
    }
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

  // Cálculos de depósitos (somente admin)
  const deposits = walletTransactions.filter(t => t.type === 'deposit');
  const totalDeposits = deposits.reduce((acc, t) => acc + t.amount, 0);
  const mercadoPagoFeeDeposits = totalDeposits * 0.01;
  const netDeposits = totalDeposits - mercadoPagoFeeDeposits;

  const grossRevenue = totals.revenue;
  const entradaBrutaTotal = grossRevenue + totalDeposits;
  const taxasRecargas = totals.fees;
  const taxasDepositos = mercadoPagoFeeDeposits;
  const taxasTotais = taxasRecargas + taxasDepositos;

  const liquidoRecargas = totals.received;
  const liquidoDepositos = netDeposits;
  const liquidoTotal = liquidoRecargas + liquidoDepositos;

  const valorPagoCliente = liquidoTotal * 0.70;
  const lucroNeoPower = liquidoTotal * 0.20;
  const manutencaoSite = liquidoTotal * 0.10;

  const platformProfit = manutencaoSite + lucroNeoPower;
  const profitMargin = entradaBrutaTotal > 0 ? ((platformProfit / entradaBrutaTotal) * 100) : 0;

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('conclu') || statusLower.includes('finish') || statusLower.includes('complet')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          {status}
        </span>
      );
    }
    if (statusLower.includes('pend') || statusLower.includes('process')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          {status}
        </span>
      );
    }
    if (statusLower.includes('cancel') || statusLower.includes('fail') || statusLower.includes('error')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#262626] text-[#adaaaa] text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[#777575]"></span>
        {status}
      </span>
    );
  };

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading && reportData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[#adaaaa]">Gerando relatório financeiro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">payments</span>
            Relatório Financeiro
          </h1>
          <p className="text-[#adaaaa] mt-1">
            {isAdmin ? 'Análise detalhada de receitas, custos e lucros' : `Relatório das suas estações (${userLocationNames.length} local/is)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1919] hover:bg-[#262626] border border-[#494847]/15 rounded-lg text-[#adaaaa] transition-all"
          >
            <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
            Atualizar
          </button>
          <button
            onClick={handleExportPDF}
            disabled={reportData.length === 0 || pdfLoading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 transition-all disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${pdfLoading ? 'animate-spin' : ''}`} />
            {pdfLoading ? 'Gerando...' : 'Exportar PDF'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-black font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#adaaaa] font-medium uppercase tracking-wide">
                {isAdmin ? 'Entrada Bruta Total' : 'Receita Bruta'}
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                R$ {fmt(isAdmin ? entradaBrutaTotal : grossRevenue)}
              </p>
              <p className="text-xs text-[#777575] mt-1">
                {isAdmin ? 'Recargas + Depósitos' : `${reportData.length} transação(ões)`}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <span className="material-symbols-outlined text-primary text-2xl">account_balance</span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#adaaaa] font-medium uppercase tracking-wide">Receita Líquida</p>
              <p className="text-2xl font-bold text-primary mt-1">
                R$ {fmt(isAdmin ? liquidoTotal : liquidoRecargas)}
              </p>
              <p className="text-xs text-[#777575] mt-1">Após taxas</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <span className="material-symbols-outlined text-primary text-2xl">trending_up</span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 border-red-500/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-400/70 font-medium uppercase tracking-wide">Total Taxas</p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                -R$ {fmt(isAdmin ? taxasTotais : taxasRecargas)}
              </p>
              <p className="text-xs text-red-400/40 mt-1">
                {isAdmin ? 'Recargas + MP (1%)' : '14.26% sobre recargas'}
              </p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-xl">
              <span className="material-symbols-outlined text-red-400 text-2xl">percent</span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="glass-card rounded-xl p-5 border-purple-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-400/70 font-medium uppercase tracking-wide">Depósitos Líquidos</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">
                  R$ {fmt(netDeposits)}
                </p>
                <p className="text-xs text-purple-400/40 mt-1">{deposits.length} depósito(s)</p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <span className="material-symbols-outlined text-purple-400 text-2xl">account_balance_wallet</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Admin Only: Revenue Distribution Cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-5 border-blue-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-400/70 font-medium uppercase tracking-wide">Cliente (Dono Estação)</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">R$ {fmt(valorPagoCliente)}</p>
                <p className="text-xs text-blue-400/40 mt-1">70% do líquido</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <span className="material-symbols-outlined text-blue-400 text-2xl">group</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#adaaaa] font-medium uppercase tracking-wide">Lucro NeoPower</p>
                <p className="text-2xl font-bold text-primary mt-1">R$ {fmt(lucroNeoPower)}</p>
                <p className="text-xs text-[#777575] mt-1">20% do líquido</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl">
                <span className="material-symbols-outlined text-primary text-2xl">trending_up</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 border-cyan-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-cyan-400/70 font-medium uppercase tracking-wide">Manutenção do Site</p>
                <p className="text-2xl font-bold text-cyan-400 mt-1">R$ {fmt(manutencaoSite)}</p>
                <p className="text-xs text-cyan-400/40 mt-1">10% do líquido</p>
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-xl">
                <span className="material-symbols-outlined text-cyan-400 text-2xl">bolt</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-admin: Valor Recebido */}
      {!isAdmin && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-primary text-xl">info</span>
            <p className="text-sm text-[#adaaaa]">
              Exibindo apenas transações das estações vinculadas ao seu perfil.
              {userLocationNames.length > 0 && (
                <span className="text-[#777575]"> Locais: {userLocationNames.join(', ')}</span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
              <p className="text-xs text-[#adaaaa] font-medium uppercase mb-1">Energia Total</p>
              <p className="text-xl font-bold text-amber-400">{totals.energy.toFixed(2)} kWh</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
              <p className="text-xs text-[#adaaaa] font-medium uppercase mb-1">Valor Recebido</p>
              <p className="text-xl font-bold text-primary">R$ {fmt(totals.received)}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
              <p className="text-xs text-[#adaaaa] font-medium uppercase mb-1">Pago ao Cliente</p>
              <p className="text-xl font-bold text-blue-400">R$ {fmt(totals.payout)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Only: Depósitos em Carteira */}
      {isAdmin && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-[#494847]/15">
            <h2 className="text-lg font-headline font-semibold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-400">account_balance_wallet</span>
              Depósitos em Carteira
            </h2>
            <p className="text-sm text-[#adaaaa] mt-1">Valores depositados pelos usuários (Pix/Cartão) - Taxa Mercado Pago 1%</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-purple-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                  <p className="text-xs text-purple-400/60 font-medium uppercase">Total Depósitos</p>
                </div>
                <p className="text-lg font-bold text-purple-300">R$ {fmt(totalDeposits)}</p>
                <p className="text-xs text-[#777575] mt-1">{deposits.length} depósitos</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-red-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <p className="text-xs text-red-400/60 font-medium uppercase">Taxa Mercado Pago</p>
                </div>
                <p className="text-lg font-bold text-red-400">-R$ {fmt(mercadoPagoFeeDeposits)}</p>
                <p className="text-xs text-[#777575] mt-1">1% sobre depósitos</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-primary/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <p className="text-xs text-[#adaaaa] font-medium uppercase">Depósitos Líquidos</p>
                </div>
                <p className="text-lg font-bold text-primary">R$ {fmt(netDeposits)}</p>
                <p className="text-xs text-[#777575] mt-1">Valor disponível</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-blue-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <p className="text-xs text-blue-400/60 font-medium uppercase">Média por Depósito</p>
                </div>
                <p className="text-lg font-bold text-blue-400">
                  R$ {deposits.length > 0 ? fmt(totalDeposits / deposits.length) : '0,00'}
                </p>
                <p className="text-xs text-[#777575] mt-1">Valor médio</p>
              </div>
            </div>

            {deposits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#494847]/15">
                      <th className="text-left text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Usuário</th>
                      <th className="text-left text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Data</th>
                      <th className="text-right text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Valor</th>
                      <th className="text-right text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Taxa MP</th>
                      <th className="text-right text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Líquido</th>
                      <th className="text-left text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Referência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.slice(0, 10).map((deposit) => (
                      <tr key={deposit.id} className="border-b border-[#494847]/10 hover:bg-[#262626]/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-white">{deposit.userName}</p>
                          <p className="text-xs text-[#777575]">{deposit.userEmail}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#adaaaa]">
                          {new Date(deposit.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-purple-400">
                          R$ {fmt(deposit.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-red-400/70">
                          -R$ {fmt(deposit.amount * 0.01)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-primary">
                          R$ {fmt(deposit.amount * 0.99)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[#adaaaa]">
                          {deposit.referenceId || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {deposits.length > 10 && (
                  <p className="text-sm text-[#adaaaa] mt-4 text-center">
                    Mostrando 10 de {deposits.length} depósitos
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <span className="material-symbols-outlined text-[#494847] text-5xl mb-3">account_balance_wallet</span>
                <p className="text-[#777575]">Nenhum depósito encontrado no período.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Only: Distribuição de Receita Total */}
      {isAdmin && entradaBrutaTotal > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-[#494847]/15">
            <h2 className="text-lg font-headline font-semibold text-white">Distribuição de Receita Total</h2>
            <p className="text-sm text-[#adaaaa] mt-1">Depósitos + Recargas - como o dinheiro é distribuído</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <p className="text-xs text-[#adaaaa] font-medium uppercase">Entrada Bruta Total</p>
                </div>
                <p className="text-xl font-bold text-white">R$ {fmt(entradaBrutaTotal)}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-[#adaaaa]">
                    <span>Depósitos:</span>
                    <span>R$ {fmt(totalDeposits)}</span>
                  </div>
                  <div className="flex justify-between text-[#adaaaa]">
                    <span>Recargas:</span>
                    <span>R$ {fmt(grossRevenue)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-red-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <p className="text-xs text-red-400/60 font-medium uppercase">Total Taxas</p>
                </div>
                <p className="text-xl font-bold text-red-400">-R$ {fmt(taxasTotais)}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-red-400/60">
                    <span>Taxa MP (1% depósitos):</span>
                    <span>-R$ {fmt(mercadoPagoFeeDeposits)}</span>
                  </div>
                  <div className="flex justify-between text-red-400/60">
                    <span>Taxas recargas (14.26%):</span>
                    <span>-R$ {fmt(taxasRecargas)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-primary/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <p className="text-xs text-[#adaaaa] font-medium uppercase">Receita Líquida Total</p>
                </div>
                <p className="text-xl font-bold text-primary">R$ {fmt(liquidoTotal)}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-[#adaaaa]">
                    <span>Depósitos líquidos:</span>
                    <span>R$ {fmt(liquidoDepositos)}</span>
                  </div>
                  <div className="flex justify-between text-[#adaaaa]">
                    <span>Recargas líquidas:</span>
                    <span>R$ {fmt(liquidoRecargas)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution breakdown */}
            <h4 className="text-sm font-semibold text-[#adaaaa] mb-3 mt-6">Distribuição da Receita Total</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-blue-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <p className="text-xs text-blue-400/60 font-medium uppercase">Dono da Estação</p>
                </div>
                <p className="text-lg font-bold text-blue-400">R$ {fmt(valorPagoCliente)}</p>
                <p className="text-xs text-[#777575] mt-1">70% do líquido</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-primary/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <p className="text-xs text-[#adaaaa] font-medium uppercase">Lucro NeoPower</p>
                </div>
                <p className="text-lg font-bold text-primary">R$ {fmt(lucroNeoPower)}</p>
                <p className="text-xs text-[#777575] mt-1">20% do líquido</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-cyan-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div>
                  <p className="text-xs text-cyan-400/60 font-medium uppercase">Manutenção do Site</p>
                </div>
                <p className="text-lg font-bold text-cyan-400">R$ {fmt(manutencaoSite)}</p>
                <p className="text-xs text-[#777575] mt-1">10% do líquido</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e0e]/50 border border-amber-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <p className="text-xs text-amber-400/60 font-medium uppercase">Margem Total</p>
                </div>
                <p className={`text-lg font-bold ${profitMargin >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {profitMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-[#777575] mt-1">NeoPower + Manutenção / Bruto</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <p className="text-xs text-[#adaaaa] mb-2">Distribuição da Receita Total (% do bruto):</p>
              {(() => {
                const percTaxas = entradaBrutaTotal > 0 ? (taxasTotais / entradaBrutaTotal) * 100 : 0;
                const percCliente = entradaBrutaTotal > 0 ? (valorPagoCliente / entradaBrutaTotal) * 100 : 0;
                const percNeoPower = entradaBrutaTotal > 0 ? (lucroNeoPower / entradaBrutaTotal) * 100 : 0;
                const percManutencao = entradaBrutaTotal > 0 ? (manutencaoSite / entradaBrutaTotal) * 100 : 0;
                return (
                  <>
                    <div className="h-6 rounded-full overflow-hidden flex bg-[#262626]">
                      <div className="h-full bg-red-500 flex items-center justify-center" style={{ width: `${percTaxas}%` }}>
                        <span className="text-[10px] text-white font-medium">{percTaxas.toFixed(1)}%</span>
                      </div>
                      <div className="h-full bg-blue-500 flex items-center justify-center" style={{ width: `${percCliente}%` }}>
                        <span className="text-[10px] text-white font-medium">{percCliente.toFixed(1)}%</span>
                      </div>
                      <div className="h-full bg-primary flex items-center justify-center" style={{ width: `${percNeoPower}%` }}>
                        <span className="text-[10px] text-black font-medium">{percNeoPower.toFixed(1)}%</span>
                      </div>
                      <div className="h-full bg-cyan-500 flex items-center justify-center" style={{ width: `${percManutencao}%` }}>
                        <span className="text-[10px] text-white font-medium">{percManutencao.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-red-400/70">Taxas ({percTaxas.toFixed(1)}%)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-blue-400/70">Cliente ({percCliente.toFixed(1)}%)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-[#adaaaa]">NeoPower ({percNeoPower.toFixed(1)}%)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                        <span className="text-cyan-400/70">Manutenção ({percManutencao.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card rounded-xl p-5">
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-[#adaaaa] font-medium mb-1.5 block">ID da Estação</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#777575] text-lg">search</span>
              <input
                type="text"
                placeholder="Filtrar por estação..."
                value={filterId}
                onChange={e => setFilterId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0e0e0e] border border-[#494847]/15 rounded-lg text-sm text-white placeholder:text-[#777575] focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#adaaaa] font-medium mb-1.5 block">Período</label>
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

          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 rounded-lg text-black font-medium text-sm transition-all"
          >
            <span className="material-symbols-outlined text-lg">search</span>
            Filtrar
          </button>

          {submittedFilter && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#494847]/15 rounded-lg text-[#adaaaa] hover:bg-[#262626] text-sm transition-all"
            >
              <span className="material-symbols-outlined text-lg">close</span>
              Limpar
            </button>
          )}
<<<<<<< HEAD
        </form>
      </div>

      {/* Data Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#494847]/15 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-headline font-semibold text-white">Detalhamento por Transação</h2>
            <p className="text-sm text-[#adaaaa] mt-1">
              {reportData.length} {reportData.length === 1 ? 'registro encontrado' : 'registros encontrados'}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#494847]/15">
                <th className="text-left text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Estação</th>
                <th className="text-left text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Início</th>
                <th className="text-left text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Fim</th>
                <th className="text-right text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Energia</th>
                <th className="text-right text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Receita</th>
                <th className="text-right text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Taxas</th>
                <th className="text-right text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Recebido</th>
                <th className="text-right text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Pago</th>
                <th className="text-center text-xs font-medium text-[#adaaaa] uppercase tracking-wider py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length > 0 ? (
                reportData.map((row, index) => (
                  <tr key={index} className="border-b border-[#494847]/10 hover:bg-[#262626]/50 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-white">{row['Estação']}</td>
                    <td className="py-3 px-4 text-sm text-[#adaaaa]">{row['Início']}</td>
                    <td className="py-3 px-4 text-sm text-[#adaaaa]">{row['Fim']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-amber-400">{row['Recarga (kWh)']} kWh</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-primary">R$ {row['Receita (R$)']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-red-400/70">R$ {row['Valor Total de Taxas (R$)']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-primary/80">R$ {row['Valor Recebido (R$)']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-blue-400">R$ {row['Valor Pago ao Cliente (R$)']}</td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(row['Status'])}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[#494847] text-5xl">description</span>
                      <p className="text-[#777575]">
                        {!isAdmin && userLocationNames.length === 0
                          ? 'Nenhuma estação vinculada ao seu perfil.'
                          : 'Nenhum dado encontrado para os filtros selecionados.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals Footer */}
        {reportData.length > 0 && (
          <div className="px-6 py-5 border-t border-[#494847]/15">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
                <p className="text-xs text-[#adaaaa] mb-1">Total Transações</p>
                <p className="text-lg font-bold text-white">{reportData.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
                <p className="text-xs text-[#adaaaa] mb-1">Energia Total</p>
                <p className="text-lg font-bold text-amber-400">{totals.energy.toFixed(2)} kWh</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
                <p className="text-xs text-[#adaaaa] mb-1">Receita Total</p>
                <p className="text-lg font-bold text-primary">R$ {fmt(totals.revenue)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
                <p className="text-xs text-[#adaaaa] mb-1">Total Taxas</p>
                <p className="text-lg font-bold text-red-400">R$ {fmt(totals.fees)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0e0e0e]/50 border border-[#494847]/15">
                <p className="text-xs text-[#adaaaa] mb-1">{isAdmin ? 'Lucro Plataforma' : 'Valor Recebido'}</p>
                <p className={`text-lg font-bold ${isAdmin ? (platformProfit >= 0 ? 'text-primary' : 'text-red-400') : 'text-primary'}`}>
                  R$ {fmt(isAdmin ? platformProfit : totals.received)}
                </p>
              </div>
            </div>
          </div>
        )}
=======
        </CardContent>
      </Card>

      {/* Hidden Report Template for PDF Generation */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}>
        <ReportTemplate 
          data={{
            locationName: submittedFilter ? `Carregador: ${submittedFilter}` : 'Relatório Consolidado NeoPower',
            totalKwh: totals.energy,
            totalRevenue: totals.revenue,
            totalFees: totals.fees,
            netReceived: totals.received,
            totalPayout: totals.payout,
            sessionsCount: reportData.length,
            walletDeposits: totalDeposits,
            walletWithdrawals: walletTransactions.filter(t => t.type === 'withdraw' || t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0),
            chartData: (() => {
              const grouped: Record<string, { revenue: number, fees: number }> = {};
              reportData.forEach(row => {
                const date = row['Início'].split(',')[0];
                if (!grouped[date]) grouped[date] = { revenue: 0, fees: 0 };
                grouped[date].revenue += parseFloat(row['Receita (R$)']) || 0;
                grouped[date].fees += parseFloat(row['Valor Total de Taxas (R$)']) || 0;
              });
              return Object.entries(grouped).map(([name, vals]) => ({
                name,
                revenue: vals.revenue,
                fees: vals.fees
              })).slice(-15); // Últimos 15 dias de dados
            })(),
            financialTableData: reportData.map(row => ({
              date: row['Início'].split(',')[0],
              charger: row['Estação'],
              kwh: row['Recarga (kWh)'],
              revenue: row['Receita (R$)'],
              fees: row['Valor Total de Taxas (R$)'],
              net: row['Valor Recebido (R$)']
            }))
          }}
          period={startDate && endDate ? `${startDate} a ${endDate}` : 'Período Completo'}
          generationDate={new Date().toLocaleDateString('pt-BR')}
        />
>>>>>>> 369f77871143a7d82dc526e4cc33de76d3271c15
      </div>
    </div>
  );
};
