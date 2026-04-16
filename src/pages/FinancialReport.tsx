import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { exportToCSV, exportToExcel } from '../lib/export';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ReportTemplate } from '../components/ReportTemplate';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface TenantFinancialSummary {
  clientId: string;
  companyName: string;
  transactions: number;
  kWh: number;
  revenue: number;
  fees: number;
  net: number;
}

interface TenantOverviewResponse {
  aggregate: {
    transactions: number;
    kWh: number;
    revenue: number;
    fees: number;
    net: number;
    deposits: { total: number; count: number; mpFee: number };
  };
  byTenant: TenantFinancialSummary[];
}

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
  // Campos NFS-e vindos do backend
  invoice_id?: string;
  invoice_status?: string;
  invoice_pdf_url?: string;
  transaction_id?: number;
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
  const userClientId = user?.branding?.clientId || null;
  // Super admin = admin sem whitelabel específico → vê todos os tenants
  const isSuperAdmin = isAdmin && !userClientId;

  const [searchParams, setSearchParams] = useSearchParams();
  const drillDownClientId = searchParams.get('clientId');
  // Modo overview: só ativa pra super admin sem drill-down selecionado
  const overviewMode = isSuperAdmin && !drillDownClientId;

  const [reportData, setReportData] = useState<FinancialReportItem[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionItem[]>([]);
  const [tenantOverview, setTenantOverview] = useState<TenantOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [submittedFilter, setSubmittedFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userLocationNames, setUserLocationNames] = useState<string[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(isAdmin);
  // NFS-e
  const [nfseFilter, setNfseFilter] = useState<'all' | 'Issued' | 'Pending' | 'Error'>('all');

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
        const names = locs.map((l: any) => l.locationAddress || l.name || '');
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
    // Super admin drill-down: filtra o relatório por whitelabel específico
    if (drillDownClientId) params.append('clientId', drillDownClientId);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    try {
      const response = await api.get(endpoint);
      if (!response.ok) throw new Error('Erro ao buscar relatório');

      const data = await response.json();
      const items = Array.isArray(data) ? data : [];

      if (!isAdmin && userLocationNames.length > 0) {
        const filtered = items.filter((item: FinancialReportItem) => {
          const stationName = item['Estação'] || '';
          return userLocationNames.some(loc => loc && stationName.toLowerCase().includes(loc.toLowerCase()));
        });
        setReportData(filtered);
      } else if (!isAdmin && userLocationNames.length === 0) {
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
  }, [submittedFilter, startDate, endDate, isAdmin, userLocationNames, drillDownClientId]);

  const fetchTenantOverview = useCallback(async () => {
    if (!isSuperAdmin) {
      setTenantOverview(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const qs = params.toString();
      const response = await api.get(`/reports/financial/by-tenant${qs ? `?${qs}` : ''}`);
      if (!response.ok) throw new Error('Erro ao buscar overview');
      const data: TenantOverviewResponse = await response.json();
      setTenantOverview(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar overview por whitelabel');
      setTenantOverview(null);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, startDate, endDate]);

  const fetchWalletTransactions = useCallback(async () => {
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

  useEffect(() => {
    if (!locationsLoaded) return;
    if (overviewMode) {
      void fetchTenantOverview();
    } else {
      void fetchReport();
      void fetchWalletTransactions();
    }
  }, [locationsLoaded, overviewMode, fetchReport, fetchWalletTransactions, fetchTenantOverview]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (overviewMode) {
      await fetchTenantOverview();
    } else {
      await Promise.all([fetchReport(), fetchWalletTransactions()]);
    }
    setRefreshing(false);
    toast.success('Relatório atualizado!');
  };

  const handleBackToOverview = () => {
    setSearchParams({});
  };

  const handleDrillDown = (clientId: string) => {
    setSearchParams({ clientId });
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

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (reportData.length === 0 && format !== 'pdf') {
      toast.error('Nenhum dado para exportar');
      return;
    }

    if (format === 'pdf') {
      setPdfLoading(true);
      toast.loading('Gerando relatório financeiro profissional...', { id: 'pdf-gen' });

      try {
        await new Promise(resolve => setTimeout(resolve, 1500));

        const element = document.getElementById('report-root');
        if (!element) throw new Error('Template não encontrado');

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#f0f2f5',
          windowWidth: 794,
          onclone: (doc) => {
            const allElements = doc.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i] as HTMLElement;
              if (el.style) {
                for (let j = 0; j < el.style.length; j++) {
                  const prop = el.style[j];
                  const val = el.style.getPropertyValue(prop);
                  if (val && val.includes('oklch')) {
                    el.style.setProperty(prop, 'transparent', 'important');
                  }
                }
              }
            }
          }
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

        const dateStr = new Date().toISOString().split('T')[0];
        pdf.save(`relatorio_financeiro_${dateStr}.pdf`);
        toast.success('Relatório gerado com sucesso!', { id: 'pdf-gen' });
      } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        toast.error('Erro ao gerar relatório PDF', { id: 'pdf-gen' });
      } finally {
        setPdfLoading(false);
      }
      return;
    }

    const exportData = reportData.map(row => ({
      'Estação': row['Estação'],
      'Início': row['Início'],
      'Fim': row['Fim'],
      'Recarga (kWh)': row['Recarga (kWh)'],
      'Receita (R$)': row['Receita (R$)'],
      'Taxas (R$)': row['Valor Total de Taxas (R$)'],
      'Recebido (R$)': row['Valor Recebido (R$)'],
      'Pago Cliente (R$)': row['Valor Pago ao Cliente (R$)'],
      'Status': row['Status'],
    }));

    const columns = [
      { key: 'Estação', header: 'Estação' },
      { key: 'Início', header: 'Início' },
      { key: 'Fim', header: 'Fim' },
      { key: 'Recarga (kWh)', header: 'Recarga (kWh)', format: 'number' as const },
      { key: 'Receita (R$)', header: 'Receita (R$)', format: 'number' as const },
      { key: 'Taxas (R$)', header: 'Taxas (R$)', format: 'number' as const },
      { key: 'Recebido (R$)', header: 'Recebido (R$)', format: 'number' as const },
      { key: 'Pago Cliente (R$)', header: 'Pago Cliente (R$)', format: 'number' as const },
      { key: 'Status', header: 'Status' },
    ];

    const options = {
      filename: `relatorio_financeiro_${new Date().toISOString().split('T')[0]}`,
      title: 'Relatório Financeiro',
      columns,
      data: exportData,
    };

    if (format === 'csv') {
      exportToCSV(options);
      toast.success('Relatório CSV exportado');
    } else {
      exportToExcel(options);
      toast.success('Relatório Excel exportado');
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

  const deposits = walletTransactions.filter(t => t.type === 'deposit');
  const withdrawals = walletTransactions.filter(t => t.type === 'withdrawal' || t.type === 'charge');
  const totalDeposits = deposits.reduce((acc, t) => acc + t.amount, 0);
  const totalWithdrawals = withdrawals.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const mercadoPagoFeeDeposits = totalDeposits * 0.01;
  const netDeposits = totalDeposits - mercadoPagoFeeDeposits;

  const grossRevenue = totals.revenue;
  const entradaBrutaTotal = grossRevenue + totalDeposits;
  const taxasRecargas = totals.fees;
  const taxasTotais = taxasRecargas + mercadoPagoFeeDeposits;

  const liquidoRecargas = totals.received;
  const liquidoDepositos = netDeposits;
  const liquidoTotal = liquidoRecargas + liquidoDepositos;

  const valorPagoCliente = liquidoTotal * 0.70;
  const lucroNeoPower = liquidoTotal * 0.20;
  const manutencaoSite = liquidoTotal * 0.10;

  const platformProfit = manutencaoSite + lucroNeoPower;
  // profitMargin calculated for future use: (platformProfit / entradaBrutaTotal) * 100

  // Dados para o ReportTemplate (PDF)
  const reportTemplateData = {
    locationName: isAdmin ? 'Painel Administrativo' : `Estações de ${user?.name || 'Usuário'}`,
    totalKwh: totals.energy,
    totalRevenue: totals.revenue,
    totalFees: totals.fees,
    netReceived: totals.received,
    totalPayout: totals.payout,
    sessionsCount: reportData.length,
    walletDeposits: totalDeposits,
    walletWithdrawals: totalWithdrawals,
    chartData: reportData.slice(0, 30).map((row, i) => ({
      name: row['Início']?.split(' ')[0] || `#${i + 1}`,
      revenue: parseFloat(row['Receita (R$)']) || 0,
      fees: parseFloat(row['Valor Total de Taxas (R$)']) || 0,
    })),
    financialTableData: reportData.map(row => ({
      date: row['Início']?.split(' ')[0] || '-',
      charger: row['Estação'],
      kwh: row['Recarga (kWh)'],
      revenue: row['Receita (R$)'],
      fees: row['Valor Total de Taxas (R$)'],
      net: row['Valor Recebido (R$)'],
    })),
  };

  const periodLabel = startDate && endDate
    ? `${new Date(startDate).toLocaleDateString('pt-BR')} — ${new Date(endDate).toLocaleDateString('pt-BR')}`
    : 'Todo o período';

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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          {status}
        </span>
      );
    }
    if (statusLower.includes('cancel') || statusLower.includes('fail') || statusLower.includes('error')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface-variant text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[#777575]"></span>
        {status}
      </span>
    );
  };

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading && reportData.length === 0 && !tenantOverview) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant">Gerando relatório financeiro...</p>
      </div>
    );
  }

  // ───── OVERVIEW POR WHITELABEL (só super admin sem drill-down) ─────
  if (overviewMode && tenantOverview) {
    const agg = tenantOverview.aggregate;
    const activeTenants = tenantOverview.byTenant.filter(t => t.transactions > 0);
    const topTenants = [...activeTenants].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const totalRevenue = agg.revenue || 1; // evita div por zero
    const margin = agg.revenue > 0 ? (agg.net / agg.revenue) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-headline font-bold text-foreground flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl">insights</span>
              Relatório Financeiro — Visão Geral
            </h1>
            <p className="text-on-surface-variant mt-1">
              Consolidado de todos os whitelabels. Clique num card para abrir o relatório detalhado.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant/15 rounded-2xl text-on-surface-variant transition-all"
            >
              <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
              Atualizar
            </button>
          </div>
        </div>

        {/* Date filter */}
        <div className="glass-card rounded-2xl p-4 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs text-on-surface-variant uppercase tracking-wide font-medium mb-2 block">
              Período
            </label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => { setStartDate(''); setEndDate(''); }}
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant/15 rounded-2xl text-on-surface-variant text-sm transition-all"
            >
              Limpar período
            </button>
          )}
        </div>

        {/* ─── Hero Card: consolidado da plataforma ─── */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">leaderboard</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-widest font-medium">
                Consolidado da plataforma
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-4xl sm:text-5xl font-headline font-bold text-foreground">
                  R$ {fmt(agg.net)}
                </p>
                <p className="text-sm text-on-surface-variant mt-1">
                  receita líquida após taxas • margem {margin.toFixed(1)}%
                </p>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wide">Transações</p>
                  <p className="text-2xl font-bold text-foreground">{agg.transactions}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wide">Energia</p>
                  <p className="text-2xl font-bold text-foreground">{fmt(agg.kWh)} <span className="text-sm text-on-surface-variant">kWh</span></p>
                </div>
              </div>
            </div>

            {/* Barra de composição da receita */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Receita bruta: R$ {fmt(agg.revenue)}</span>
                <span>Taxas: R$ {fmt(agg.fees + agg.deposits.mpFee)}</span>
              </div>
              <div className="h-3 rounded-full bg-surface-container-highest overflow-hidden flex">
                <div
                  className="bg-primary transition-all"
                  style={{ width: `${(agg.net / totalRevenue) * 100}%` }}
                  title={`Líquido: R$ ${fmt(agg.net)}`}
                />
                <div
                  className="bg-red-500/70 transition-all"
                  style={{ width: `${(agg.fees / totalRevenue) * 100}%` }}
                  title={`Taxas operacionais: R$ ${fmt(agg.fees)}`}
                />
              </div>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Líquido
                </span>
                <span className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full bg-red-500/70" />
                  Taxas operacionais
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── KPIs secundários ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">attach_money</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Receita Bruta</p>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {fmt(agg.revenue)}</p>
            <p className="text-xs text-on-surface-variant mt-1">{activeTenants.length} whitelabels ativos</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-red-500">trending_down</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Taxas Totais</p>
            </div>
            <p className="text-2xl font-bold text-red-500">R$ {fmt(agg.fees + agg.deposits.mpFee)}</p>
            <p className="text-xs text-on-surface-variant mt-1">operação + {fmt(agg.deposits.mpFee)} MP</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">savings</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Ticket Médio</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              R$ {fmt(agg.transactions > 0 ? agg.revenue / agg.transactions : 0)}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">por transação</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Depósitos Wallet</p>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {fmt(agg.deposits.total)}</p>
            <p className="text-xs text-on-surface-variant mt-1">{agg.deposits.count} depósitos no período</p>
          </div>
        </div>

        {/* ─── Chart: Top whitelabels por receita ─── */}
        {topTenants.length > 0 && (
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">bar_chart</span>
                Top whitelabels por receita
              </h2>
              <span className="text-xs text-on-surface-variant">Top {topTenants.length}</span>
            </div>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTenants} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `R$ ${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                  <YAxis type="category" dataKey="companyName" stroke="var(--color-muted-foreground)" fontSize={11} width={120} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                    }}
                    formatter={(v: number) => [`R$ ${fmt(v)}`, 'Receita']}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ─── Whitelabel cards ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Por whitelabel</h2>
            <span className="text-xs text-on-surface-variant">
              {activeTenants.length} de {tenantOverview.byTenant.length} com movimento
            </span>
          </div>
          {tenantOverview.byTenant.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant">
              Nenhum whitelabel cadastrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tenantOverview.byTenant.map(t => {
                const hasActivity = t.transactions > 0;
                const shareOfRevenue = agg.revenue > 0 ? (t.revenue / agg.revenue) * 100 : 0;
                return (
                  <button
                    key={t.clientId}
                    onClick={() => handleDrillDown(t.clientId)}
                    className={`glass-card rounded-2xl p-5 text-left transition-all hover:scale-[1.02] hover:shadow-xl hover:border-primary/30 group ${hasActivity ? '' : 'opacity-60'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">{t.clientId}</p>
                        <h3 className="text-lg font-semibold text-foreground truncate">{t.companyName}</h3>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Receita</p>
                        <p className="text-base font-bold text-foreground">R$ {fmt(t.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Líquida</p>
                        <p className="text-base font-bold text-primary">R$ {fmt(t.net)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Taxas</p>
                        <p className="text-sm text-red-500">R$ {fmt(t.fees)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Transações</p>
                        <p className="text-sm text-foreground">{t.transactions}</p>
                      </div>
                    </div>
                    {hasActivity && (
                      <>
                        <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                            style={{ width: `${shareOfRevenue}%` }}
                          />
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1.5">
                          {shareOfRevenue.toFixed(1)}% da receita total
                        </p>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button — só quando super admin fez drill-down num whitelabel */}
      {isSuperAdmin && drillDownClientId && (
        <button
          onClick={handleBackToOverview}
          className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-foreground transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Voltar ao overview
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-foreground flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">payments</span>
            Relatório Financeiro
            {drillDownClientId && (
              <span className="text-base font-normal text-on-surface-variant">— {drillDownClientId}</span>
            )}
          </h1>
          <p className="text-on-surface-variant mt-1">
            {isAdmin ? 'Análise detalhada de receitas, custos e lucros' : `Relatório das suas estações (${userLocationNames.length} local/is)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant/15 rounded-lg text-on-surface-variant transition-all"
          >
            <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
            Atualizar
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant/15 rounded-lg text-on-surface-variant transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant/15 rounded-lg text-on-surface-variant transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">table_view</span>
            Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-black font-medium transition-all disabled:opacity-70"
          >
            {pdfLoading
              ? <span className="material-symbols-outlined text-lg animate-spin">refresh</span>
              : <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
            }
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">
                {isAdmin ? 'Entrada Bruta Total' : 'Receita Bruta'}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                R$ {fmt(isAdmin ? entradaBrutaTotal : grossRevenue)}
              </p>
              <p className="text-xs text-outline mt-1">
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
              <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">Receita Líquida</p>
              <p className="text-2xl font-bold text-primary mt-1">
                R$ {fmt(isAdmin ? liquidoTotal : liquidoRecargas)}
              </p>
              <p className="text-xs text-outline mt-1">Após taxas</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <span className="material-symbols-outlined text-primary text-2xl">trending_up</span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-foreground font-medium uppercase tracking-wide">Total Taxas</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                -R$ {fmt(isAdmin ? taxasTotais : taxasRecargas)}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {isAdmin ? 'Recargas + MP (1%)' : '14.26% sobre recargas'}
              </p>
            </div>
            <div className="p-3 bg-surface-container-highest rounded-xl">
              <span className="material-symbols-outlined text-foreground text-2xl">percent</span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="glass-card rounded-xl p-5 border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground font-medium uppercase tracking-wide">Depósitos Líquidos</p>
                <p className="text-2xl font-bold text-foreground mt-1">R$ {fmt(netDeposits)}</p>
                <p className="text-xs text-on-surface-variant mt-1">{deposits.length} depósito(s)</p>
              </div>
              <div className="p-3 bg-surface-container-highest rounded-xl">
                <span className="material-symbols-outlined text-foreground text-2xl">account_balance_wallet</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Admin Only: Revenue Distribution Cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-5 border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground font-medium uppercase tracking-wide">Cliente (Dono Estação)</p>
                <p className="text-2xl font-bold text-foreground mt-1">R$ {fmt(valorPagoCliente)}</p>
                <p className="text-xs text-on-surface-variant mt-1">70% do líquido</p>
              </div>
              <div className="p-3 bg-surface-container-highest rounded-xl">
                <span className="material-symbols-outlined text-foreground text-2xl">group</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">Lucro NeoPower</p>
                <p className="text-2xl font-bold text-primary mt-1">R$ {fmt(lucroNeoPower)}</p>
                <p className="text-xs text-outline mt-1">20% do líquido</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl">
                <span className="material-symbols-outlined text-primary text-2xl">trending_up</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground font-medium uppercase tracking-wide">Manutenção do Site</p>
                <p className="text-2xl font-bold text-foreground mt-1">R$ {fmt(manutencaoSite)}</p>
                <p className="text-xs text-on-surface-variant mt-1">10% do líquido</p>
              </div>
              <div className="p-3 bg-surface-container-highest rounded-xl">
                <span className="material-symbols-outlined text-foreground text-2xl">bolt</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-admin: Info + resumo */}
      {!isAdmin && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-primary text-xl">info</span>
            <p className="text-sm text-on-surface-variant">
              Exibindo apenas transações das estações vinculadas ao seu perfil.
              {userLocationNames.length > 0 && (
                <span className="text-outline"> Locais: {userLocationNames.join(', ')}</span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-background/50 border border-outline-variant/15">
              <p className="text-xs text-on-surface-variant font-medium uppercase mb-1">Energia Total</p>
              <p className="text-xl font-bold text-foreground">{totals.energy.toFixed(2)} kWh</p>
            </div>
            <div className="p-4 rounded-xl bg-background/50 border border-outline-variant/15">
              <p className="text-xs text-on-surface-variant font-medium uppercase mb-1">Valor Recebido</p>
              <p className="text-xl font-bold text-primary">R$ {fmt(totals.received)}</p>
            </div>
            <div className="p-4 rounded-xl bg-background/50 border border-outline-variant/15">
              <p className="text-xs text-on-surface-variant font-medium uppercase mb-1">Pago ao Cliente</p>
              <p className="text-xl font-bold text-foreground">R$ {fmt(totals.payout)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Only: Depósitos em Carteira */}
      {isAdmin && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-outline-variant/15">
            <h2 className="text-lg font-headline font-semibold text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-foreground">account_balance_wallet</span>
              Depósitos em Carteira
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">Valores depositados pelos usuários (Pix/Cartão) - Taxa Mercado Pago 1%</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                  <p className="text-xs text-foreground font-medium uppercase">Total Depósitos</p>
                </div>
                <p className="text-lg font-bold text-foreground">R$ {fmt(totalDeposits)}</p>
                <p className="text-xs text-outline mt-1">{deposits.length} depósitos</p>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <p className="text-xs text-foreground font-medium uppercase">Taxa Mercado Pago</p>
                </div>
                <p className="text-lg font-bold text-foreground">-R$ {fmt(mercadoPagoFeeDeposits)}</p>
                <p className="text-xs text-outline mt-1">1% sobre depósitos</p>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-primary/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <p className="text-xs text-on-surface-variant font-medium uppercase">Depósitos Líquidos</p>
                </div>
                <p className="text-lg font-bold text-primary">R$ {fmt(netDeposits)}</p>
                <p className="text-xs text-outline mt-1">Valor disponível</p>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <p className="text-xs text-foreground font-medium uppercase">Média por Depósito</p>
                </div>
                <p className="text-lg font-bold text-foreground">
                  R$ {deposits.length > 0 ? fmt(totalDeposits / deposits.length) : '0,00'}
                </p>
                <p className="text-xs text-outline mt-1">Valor médio</p>
              </div>
            </div>

            {deposits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/15">
                      <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Usuário</th>
                      <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Data</th>
                      <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Valor</th>
                      <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Taxa MP</th>
                      <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Líquido</th>
                      <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Referência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.slice(0, 10).map((deposit) => (
                      <tr key={deposit.id} className="border-b border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-foreground">{deposit.userName}</p>
                          <p className="text-xs text-outline">{deposit.userEmail}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-on-surface-variant">{new Date(deposit.createdAt).toLocaleString('pt-BR')}</td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">R$ {fmt(deposit.amount)}</td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-red-600 dark:text-red-400/70">-R$ {fmt(deposit.amount * 0.01)}</td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-primary">R$ {fmt(deposit.amount * 0.99)}</td>
                        <td className="py-3 px-4 text-sm text-on-surface-variant">{deposit.referenceId || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {deposits.length > 10 && (
                  <p className="text-sm text-on-surface-variant mt-4 text-center">Mostrando 10 de {deposits.length} depósitos</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <span className="material-symbols-outlined text-outline-variant text-5xl mb-3">account_balance_wallet</span>
                <p className="text-outline">Nenhum depósito encontrado no período.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Only: Distribuição de Receita */}
      {isAdmin && entradaBrutaTotal > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-outline-variant/15">
            <h2 className="text-lg font-headline font-semibold text-foreground">Distribuição de Receita Total</h2>
            <p className="text-sm text-on-surface-variant mt-1">Depósitos + Recargas - como o dinheiro é distribuído</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-background/50 border border-outline-variant/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <p className="text-xs text-on-surface-variant font-medium uppercase">Entrada Bruta Total</p>
                </div>
                <p className="text-xl font-bold text-foreground">R$ {fmt(entradaBrutaTotal)}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-on-surface-variant"><span>Depósitos:</span><span>R$ {fmt(totalDeposits)}</span></div>
                  <div className="flex justify-between text-on-surface-variant"><span>Recargas:</span><span>R$ {fmt(grossRevenue)}</span></div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <p className="text-xs text-foreground font-medium uppercase">Total Taxas</p>
                </div>
                <p className="text-xl font-bold text-foreground">-R$ {fmt(taxasTotais)}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-on-surface-variant"><span>Taxa MP (1%):</span><span>-R$ {fmt(mercadoPagoFeeDeposits)}</span></div>
                  <div className="flex justify-between text-on-surface-variant"><span>Taxas recargas:</span><span>-R$ {fmt(taxasRecargas)}</span></div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-primary/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <p className="text-xs text-on-surface-variant font-medium uppercase">Receita Líquida Total</p>
                </div>
                <p className="text-xl font-bold text-primary">R$ {fmt(liquidoTotal)}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-on-surface-variant"><span>Depósitos líquidos:</span><span>R$ {fmt(liquidoDepositos)}</span></div>
                  <div className="flex justify-between text-on-surface-variant"><span>Recargas líquidas:</span><span>R$ {fmt(liquidoRecargas)}</span></div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <p className="text-xs text-on-surface-variant mb-2">Distribuição (% do bruto):</p>
              {(() => {
                const percTaxas = entradaBrutaTotal > 0 ? (taxasTotais / entradaBrutaTotal) * 100 : 0;
                const percCliente = entradaBrutaTotal > 0 ? (valorPagoCliente / entradaBrutaTotal) * 100 : 0;
                const percNeoPower = entradaBrutaTotal > 0 ? (lucroNeoPower / entradaBrutaTotal) * 100 : 0;
                const percManutencao = entradaBrutaTotal > 0 ? (manutencaoSite / entradaBrutaTotal) * 100 : 0;
                return (
                  <>
                    <div className="h-6 rounded-full overflow-hidden flex bg-surface-container-highest">
                      <div className="h-full bg-red-500 flex items-center justify-center" style={{ width: `${percTaxas}%` }}>
                        <span className="text-[10px] text-foreground font-medium">{percTaxas.toFixed(1)}%</span>
                      </div>
                      <div className="h-full bg-blue-500 flex items-center justify-center" style={{ width: `${percCliente}%` }}>
                        <span className="text-[10px] text-foreground font-medium">{percCliente.toFixed(1)}%</span>
                      </div>
                      <div className="h-full bg-primary flex items-center justify-center" style={{ width: `${percNeoPower}%` }}>
                        <span className="text-[10px] text-black font-medium">{percNeoPower.toFixed(1)}%</span>
                      </div>
                      <div className="h-full bg-cyan-500 flex items-center justify-center" style={{ width: `${percManutencao}%` }}>
                        <span className="text-[10px] text-foreground font-medium">{percManutencao.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-red-600 dark:text-red-400/70">Taxas</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-blue-600 dark:text-blue-400/70">Cliente</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary"></div><span className="text-on-surface-variant">NeoPower</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div><span className="text-cyan-600 dark:text-cyan-400/70">Manutenção</span></div>
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
            <label className="text-xs text-on-surface-variant font-medium mb-1.5 block">ID da Estação</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
              <input
                type="text"
                placeholder="Filtrar por estação..."
                value={filterId}
                onChange={e => setFilterId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-outline-variant/15 rounded-lg text-sm text-foreground placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant font-medium mb-1.5 block">Período</label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => { setStartDate(''); setEndDate(''); }}
              className="min-w-[280px]"
            />
          </div>
          <button type="submit" className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 rounded-lg text-black font-medium text-sm transition-all">
            <span className="material-symbols-outlined text-lg">search</span>
            Filtrar
          </button>
          {submittedFilter && (
            <button type="button" onClick={handleClearFilters} className="flex items-center gap-2 px-4 py-2.5 border border-outline-variant/15 rounded-lg text-on-surface-variant hover:bg-surface-container-highest text-sm transition-all">
              <span className="material-symbols-outlined text-lg">close</span>
              Limpar
            </button>
          )}
        </form>
      </div>

      {/* ─── Seção NFS-e ──────────────────────────────────────────────────────────── */}
      {isAdmin && (() => {
        // Transações que têm dados de NFS-e
        const notasRows = reportData.filter(r => r.invoice_status && r.invoice_status !== 'NotRequired');
        const emitidas  = notasRows.filter(r => r.invoice_status === 'Issued').length;
        const pendentes = notasRows.filter(r => r.invoice_status === 'Pending').length;
        const erros     = notasRows.filter(r => r.invoice_status === 'Error').length;

        const filtered = nfseFilter === 'all'
          ? notasRows
          : notasRows.filter(r => r.invoice_status === nfseFilter);

        const getNfseStatusBadge = (status: string) => {
          if (status === 'Issued')  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-primary" />Emitida</span>;
          if (status === 'Pending') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Pendente</span>;
          if (status === 'Error')   return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Erro</span>;
          return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface-variant text-xs font-semibold">{status}</span>;
        };

        return (
          <div className="glass-card rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-outline-variant/15 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-headline font-semibold text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">receipt_long</span>
                  Notas Fiscais de Serviço (NFS-e)
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  {notasRows.length} nota(s) no período • Emissão automática por recarga
                </p>
              </div>
              {/* KPI mini cards */}
              <div className="flex items-center gap-3">
                {[
                  { label: 'Emitidas', count: emitidas, color: 'text-primary', bg: 'bg-primary/10' },
                  { label: 'Pendentes', count: pendentes, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                  { label: 'Erros', count: erros, color: 'text-red-500', bg: 'bg-red-500/10' },
                ].map(kpi => (
                  <div key={kpi.label} className={`px-4 py-2 rounded-xl ${kpi.bg} flex flex-col items-center`}>
                    <span className={`text-xl font-bold font-headline ${kpi.color}`}>{kpi.count}</span>
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">{kpi.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filtro por status */}
            <div className="px-6 py-3 border-b border-outline-variant/10 flex items-center gap-2">
              <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wide mr-2">Filtrar:</span>
              {(['all', 'Issued', 'Pending', 'Error'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setNfseFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    nfseFilter === f
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright'
                  }`}
                >
                  {f === 'all' ? 'Todas' : f === 'Issued' ? 'Emitidas' : f === 'Pending' ? 'Pendentes' : 'Com Erro'}
                </button>
              ))}
            </div>

            {/* Tabela de Notas */}
            <div className="overflow-x-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">receipt_long</span>
                  <p className="text-outline">
                    {notasRows.length === 0
                      ? 'Nenhuma emissão de NFS-e no período. Configure o provider no cadastro dos postos.'
                      : `Nenhuma nota com status "${nfseFilter}" no período.`}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/15">
                      <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Número NF</th>
                      <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Estação</th>
                      <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Data/Hora</th>
                      <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Valor (R$)</th>
                      <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Energia</th>
                      <th className="text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Status NF</th>
                      <th className="text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr key={i} className="border-b border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-on-surface bg-surface-container-highest px-2 py-0.5 rounded">
                            {row.invoice_id || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-foreground max-w-[160px] truncate">{row['Estação']}</td>
                        <td className="py-3 px-4 text-sm text-on-surface-variant">{row['Início']}</td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-primary">R$ {row['Receita (R$)']}</td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">{row['Recarga (kWh)']} kWh</td>
                        <td className="py-3 px-4 text-center">{getNfseStatusBadge(row.invoice_status || '')}</td>
                        <td className="py-3 px-4 text-center">
                          {row.invoice_pdf_url ? (
                            <a
                              href={row.invoice_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                              PDF
                            </a>
                          ) : row.invoice_status === 'Issued' ? (
                            <span className="text-xs text-on-surface-variant">N/A</span>
                          ) : (
                            <span className="text-xs text-outline">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-outline-variant/15 bg-surface-container-low/50">
                        <td colSpan={3} className="py-3 px-4 text-xs text-on-surface-variant font-medium">
                          Total: {filtered.length} nota(s)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm font-bold text-primary">
                          R$ {fmt(filtered.reduce((s, r) => s + (parseFloat(r['Receita (R$)']) || 0), 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm font-bold text-foreground">
                          {filtered.reduce((s, r) => s + (parseFloat(r['Recarga (kWh)']) || 0), 0).toFixed(2)} kWh
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {/* Data Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant/15">
          <h2 className="text-lg font-headline font-semibold text-foreground">Detalhamento por Transação</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {reportData.length} {reportData.length === 1 ? 'registro encontrado' : 'registros encontrados'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/15">
                <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Estação</th>
                <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Início</th>
                <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Fim</th>
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Energia</th>
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Receita</th>
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Taxas</th>
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Recebido</th>
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Pago</th>
                <th className="text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length > 0 ? (
                reportData.map((row, index) => (
                  <tr key={index} className="border-b border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{row['Estação']}</td>
                    <td className="py-3 px-4 text-sm text-on-surface-variant">{row['Início']}</td>
                    <td className="py-3 px-4 text-sm text-on-surface-variant">{row['Fim']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-foreground">{row['Recarga (kWh)']} kWh</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-primary">R$ {row['Receita (R$)']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-red-600 dark:text-red-400/70">R$ {row['Valor Total de Taxas (R$)']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-primary/80">R$ {row['Valor Recebido (R$)']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-foreground">R$ {row['Valor Pago ao Cliente (R$)']}</td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(row['Status'])}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-outline-variant text-5xl">description</span>
                      <p className="text-outline">
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

        {reportData.length > 0 && (
          <div className="px-6 py-5 border-t border-outline-variant/15">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Total Transações</p>
                <p className="text-lg font-bold text-foreground">{reportData.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Energia Total</p>
                <p className="text-lg font-bold text-foreground">{totals.energy.toFixed(2)} kWh</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Receita Total</p>
                <p className="text-lg font-bold text-primary">R$ {fmt(totals.revenue)}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Total Taxas</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">R$ {fmt(totals.fees)}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">{isAdmin ? 'Lucro Plataforma' : 'Valor Recebido'}</p>
                <p className={`text-lg font-bold ${isAdmin ? (platformProfit >= 0 ? 'text-primary' : 'text-red-600 dark:text-red-400') : 'text-primary'}`}>
                  R$ {fmt(isAdmin ? platformProfit : totals.received)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Template (off-screen) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        <ReportTemplate
          data={reportTemplateData}
          period={periodLabel}
          generationDate={new Date().toLocaleString('pt-BR')}
        />
      </div>
    </div>
  );
};
