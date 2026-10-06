import React, { useState, useEffect, useCallback } from 'react';
import { dataLocal } from '../components/ui/utils';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { exportToCSV, exportToExcel } from '../lib/export';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ReportTemplate } from '../components/ReportTemplate';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart, Line } from 'recharts';

interface TenantFinancialSummary {
  clientId: string;
  companyName: string;
  transactions: number;
  /** Carregadores da marca (a API manda desde a correção do overview por marca). */
  chargers?: number;
  kWh: number;
  /** Consumido em recargas nos carregadores da marca. */
  revenue: number;
  /** Comissão NeoPower, bruta (receita × comissão%). */
  fees: number;
  /** Repasse ao dono: 95% do consumido (o mesmo da visão da marca). */
  net: number;
  comissaoPercent?: number;
  cruzadas?: { quantidade: number; receita: number; repasse: number };
  // Só para a plataforma: taxa do Mercado Pago absorvida e o que sobra da comissão.
  mpFee?: number;
  taxaMpPercent?: number;
  taxaMpFonte?: FonteDaTaxaMp;
  liquidoNeoPower?: number;
}

interface TenantOverviewResponse {
  aggregate: {
    transactions: number;
    kWh: number;
    revenue: number;
    fees: number;
    net: number;
    /** Taxa do Mercado Pago proporcional ao consumo, absorvida pela NeoPower. */
    mpFee?: number;
    liquidoNeoPower?: number;
    deposits: {
      total: number;
      count: number;
      /** Taxa do Mercado Pago dos depósitos (custo da NeoPower). */
      mpFee?: number;
      devolvidos?: number;
      /** Depósitos − devoluções. Na API #95 ainda vinha sem a taxa MP. */
      liquido?: number;
      liquidoAposTaxaMp?: number;
      creditosSemPagamento?: number;
    };
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
  // Repasse por recarga: comissão e repasse em todas as linhas.
  'Comissão NeoPower (R$)'?: string;
  'Repasse ao Dono (R$)'?: string;
  // Custo da plataforma: a API só manda para a NeoPower.
  'Taxa Mercado Pago (%)'?: string;
  'Taxa Mercado Pago (R$)'?: string;
  'Líquido NeoPower (R$)'?: string;
  Status: string;
  recargaCruzada?: boolean;
  redeDoCliente?: string | null;
  // Campos NFS-e vindos do backend
  invoice_id?: string;
  invoice_status?: string;
  invoice_pdf_url?: string;
  transaction_id?: number;
}

/**
 * De onde saiu a taxa efetiva do Mercado Pago: depósitos do período, dos 90
 * dias até o fim dele (sem depósito pago no período) ou nenhum (0%).
 */
type FonteDaTaxaMp = 'periodo' | 'ultimos-90-dias' | 'sem-depositos';

interface ValoresDoRepasse {
  quantidade: number;
  receita: number;
  comissao: number;
  repasse: number;
}

/**
 * Resumo do repasse por recarga, calculado na API (utils/repasse.ts): o dono
 * recebe 95% do consumido e a NeoPower absorve a taxa do Mercado Pago nos 5%.
 */
interface ResumoRepasse {
  regra: 'repasse-95';
  marca: string;
  comissaoPercent: number;
  repassePercent: number;
  recargas: ValoresDoRepasse;
  proprias: ValoresDoRepasse;
  cruzadas: ValoresDoRepasse;
  /** Só para quem gerencia a marca. */
  entrada: {
    depositos: number;
    quantidade: number;
    creditosSemPagamento: number;
    estornosDeposito: number;
    estornosRecargaMp: number;
    devolucoesVisitante: number;
    /** Depósitos − devoluções. */
    liquido: number;
    /** Só para a plataforma. */
    taxaMp?: number;
    liquidoAposTaxaMp?: number;
  } | null;
  saldoClientes: {
    aConsumir: number;
    devedor: number;
    carteiras: number;
    em: string;
    fonte: 'carteiras-no-fim-do-periodo' | 'carteiras-agora';
  } | null;
  /** Só para a plataforma: a taxa do Mercado Pago que a NeoPower absorve. */
  custoMercadoPago: {
    percentual: number;
    fonte: FonteDaTaxaMp;
    depositos: number;
    taxaDosDepositos: number;
    quantidade: number;
    absorvida: number;
    comissao: number;
    liquidoNeoPower: number;
  } | null;
}

interface RecargaCruzadaRedeItem {
  /** A API manda `nome`; `rede` ficou do formato antigo. */
  nome?: string;
  rede?: string;
  quantidade: number;
  valorBruto: number;
}

interface RecargasCruzadasData {
  recebidas: {
    quantidade: number;
    valorBruto: number;
    /** Repasse dessas recargas (95%, a comissão descontada). */
    valorRepasse?: number;
    porRede: RecargaCruzadaRedeItem[];
  };
  aRepassar: {
    quantidade: number;
    valorBruto: number;
    porRede: RecargaCruzadaRedeItem[];
  };
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
  paymentMethod: string | null;
  /** Taxa do Mercado Pago do depósito (só para a plataforma: custo da NeoPower). */
  taxaMp?: number;
  createdAt: string;
}

/**
 * Taxa real do Mercado Pago por método (tabela de set/2026): Pix 0,99%,
 * crédito à vista 4,99%, débito 3,99%, boleto R$3,49 fixo. Antes o relatório
 * usava 1% fixo para todos, o que subestimava o desconto do cartão.
 *
 * A regra vive na API (utils/repasse.ts), que manda a taxa de cada depósito
 * e o resumo do repasse. Esta cópia só cobre a API antiga, sem esses campos.
 */
const TAXA_MP_METODO: Record<string, number> = {
  pix: 0.0099,
  credito: 0.0499,
  debito: 0.0399,
  saldo: 0,
};
function taxaMpDoDeposito(t: { amount: number; paymentMethod: string | null; taxaMp?: number }): number {
  if (typeof t.taxaMp === 'number') return t.taxaMp;
  const m = (t.paymentMethod || 'pix').toLowerCase();
  if (m === 'boleto') return 3.49; // valor fixo por boleto
  return t.amount * (TAXA_MP_METODO[m] ?? TAXA_MP_METODO.pix);
}

/** Usado só até a API responder; o percentual real vem no relatório. */
const COMISSAO_PADRAO_PERCENT = 5;

/** Cartão do resumo do repasse (visão de uma marca). */
function CartaoDoRepasse({
  icone,
  titulo,
  valor,
  detalhe,
  destaque = false,
  tom,
}: {
  icone: string;
  titulo: string;
  valor: string;
  detalhe?: React.ReactNode;
  destaque?: boolean;
  tom?: 'negativo';
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        destaque ? 'bg-primary/10 border-primary/30' : 'bg-background/50 border-outline-variant/15'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`material-symbols-outlined text-lg ${destaque ? 'text-primary' : 'text-on-surface-variant'}`}>
          {icone}
        </span>
        <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">{titulo}</p>
      </div>
      <p
        className={`text-2xl font-bold ${
          destaque ? 'text-primary' : tom === 'negativo' ? 'text-red-600 dark:text-red-400' : 'text-foreground'
        }`}
      >
        {valor}
      </p>
      {detalhe && <p className="text-xs text-on-surface-variant mt-1">{detalhe}</p>}
    </div>
  );
}

export const FinancialReport = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userClientId = user?.branding?.clientId || null;
  // Super admin = admin sem whitelabel específico → vê todos os tenants
  const isSuperAdmin = isAdmin && !userClientId;
  // A API já limita o relatório à marca. O filtro extra pelos locais atribuídos
  // é só do comum; o operador vê a marca inteira, como o admin da marca.
  const filtraPorLocaisDoUsuario = user?.role === 'comum';

  const [searchParams, setSearchParams] = useSearchParams();
  const drillDownClientId = searchParams.get('clientId');
  // Modo overview: só ativa pra super admin sem drill-down selecionado
  const overviewMode = isSuperAdmin && !drillDownClientId;

  const [reportData, setReportData] = useState<FinancialReportItem[]>([]);
  const [recargasCruzadas, setRecargasCruzadas] = useState<RecargasCruzadasData | null>(null);
  // Comissao da plataforma para esta marca, como a API aplicou. A pagina
  // dividia o liquido com 5% escrito aqui dentro, entao uma marca com
  // percentual diferente lia um repasse que nao era o dela.
  const [comissaoPercent, setComissaoPercent] = useState<number>(COMISSAO_PADRAO_PERCENT);
  // Repasse por recarga como a API calculou (caixa, saldo e, para a
  // plataforma, a taxa do Mercado Pago absorvida).
  const [resumo, setResumo] = useState<ResumoRepasse | null>(null);
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
  const [locationsLoaded, setLocationsLoaded] = useState(!filtraPorLocaisDoUsuario);
  // NFS-e
  const [nfseFilter, setNfseFilter] = useState<'all' | 'Issued' | 'Pending' | 'Error'>('all');

  // Fetch user's allowed locations for non-admin users
  useEffect(() => {
    if (!filtraPorLocaisDoUsuario) {
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
  }, [filtraPorLocaisDoUsuario, user?.id]);

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
      const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      setRecargasCruzadas(data?.recargasCruzadas || null);
      if (typeof data?.comissaoPercent === 'number') setComissaoPercent(data.comissaoPercent);
      // Só a regra atual (95% ao dono). A 'por-recarga' (taxa dividida, API
      // #95) cai no caminho das linhas, como a API antiga.
      setResumo(data?.repasse?.regra === 'repasse-95' ? data.repasse : null);

      if (filtraPorLocaisDoUsuario && userLocationNames.length > 0) {
        const filtered = items.filter((item: FinancialReportItem) => {
          const stationName = item['Estação'] || '';
          return userLocationNames.some(loc => loc && stationName.toLowerCase().includes(loc.toLowerCase()));
        });
        setReportData(filtered);
      } else if (filtraPorLocaisDoUsuario && userLocationNames.length === 0) {
        setReportData([]);
      } else {
        setReportData(items);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar relatório financeiro');
      setReportData([]);
      setRecargasCruzadas(null);
      setResumo(null);
    } finally {
      setLoading(false);
    }
  }, [submittedFilter, startDate, endDate, filtraPorLocaisDoUsuario, userLocationNames, drillDownClientId]);

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
      // No drill-down do super admin, só os clientes da marca aberta: antes a
      // visão da Vip listava (e somava) os depósitos de todas as marcas.
      const marca = drillDownClientId ? `?clientId=${encodeURIComponent(drillDownClientId)}` : '';
      const response = await api.get(`/admin/wallet-transactions${marca}`);
      if (response.ok) {
        const data = await response.json();
        let filtered = data;
        if (startDate) {
          const start = dataLocal(startDate);
          filtered = filtered.filter((t: WalletTransactionItem) => new Date(t.createdAt) >= start);
        }
        if (endDate) {
          const end = dataLocal(endDate);
          end.setHours(23, 59, 59, 999);
          filtered = filtered.filter((t: WalletTransactionItem) => new Date(t.createdAt) <= end);
        }
        setWalletTransactions(filtered);
      }
    } catch (error) {
      console.error('Erro ao buscar transações da carteira:', error);
    }
  }, [isAdmin, startDate, endDate, drillDownClientId]);

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

    // CSV em texto pt-BR (vírgula decimal, como o Excel brasileiro lê com ';');
    // Excel com número de verdade. Antes as colunas iam como texto com formato
    // 'number' e o Excel exportava tudo 0.
    //
    // A taxa do Mercado Pago e o líquido da NeoPower são custo interno da
    // plataforma: só entram na exportação de quem a API mandou esses números
    // (a NeoPower). O operador da marca exporta consumo, comissão e repasse.
    const emTexto = format === 'csv';
    const valor = (n: number) => (emTexto ? fmt(n) : Math.round(n * 100) / 100);
    const exportData = reportData.map(row => {
      const v = valoresDaLinha(row);
      return {
        'Estação': row['Estação'],
        'Início': row['Início'],
        'Fim': row['Fim'],
        'Recarga (kWh)': valor(parseFloat(row['Recarga (kWh)']) || 0),
        'Receita (R$)': valor(v.receita),
        'Comissão (R$)': valor(v.comissao),
        'Repasse ao dono (R$)': valor(v.repasse),
        ...(veCustoDaPlataforma
          ? {
              'Taxa MP (R$)': valor(v.taxaMp),
              'Líquido NeoPower (R$)': valor(v.liquidoNeoPower),
            }
          : {}),
        'Cliente de outra rede': row.recargaCruzada ? row.redeDoCliente || 'sim' : '',
        'Status': row['Status'],
      };
    });

    const numerico = emTexto ? undefined : ('currency' as const);
    const columns = [
      { key: 'Estação', header: 'Estação' },
      { key: 'Início', header: 'Início' },
      { key: 'Fim', header: 'Fim' },
      { key: 'Recarga (kWh)', header: 'Recarga (kWh)', format: emTexto ? undefined : ('number' as const) },
      { key: 'Receita (R$)', header: 'Consumido (R$)', format: numerico },
      { key: 'Comissão (R$)', header: `Comissão NeoPower ${pct(comissaoPercent)}% (R$)`, format: numerico },
      { key: 'Repasse ao dono (R$)', header: `Repasse ao dono ${pct(percentCliente)}% (R$)`, format: numerico },
      ...(veCustoDaPlataforma
        ? [
            { key: 'Taxa MP (R$)', header: 'Custo da plataforma: taxa Mercado Pago absorvida (R$)', format: numerico },
            { key: 'Líquido NeoPower (R$)', header: 'Custo da plataforma: líquido NeoPower (R$)', format: numerico },
          ]
        : []),
      { key: 'Cliente de outra rede', header: 'Cliente de outra rede' },
      { key: 'Status', header: 'Status' },
    ];

    const options = {
      filename: `relatorio_financeiro_${new Date().toISOString().split('T')[0]}`,
      title: `Relatório Financeiro — ${periodLabel}`,
      columns,
      data: exportData,
      // Rodapé com os totais e a regra; o custo da plataforma só para a NeoPower.
      rodape: [
        `Período: ${periodLabel}`,
        `Consumido em recargas: R$ ${fmt(totals.revenue)} | Comissão NeoPower ${pct(comissaoPercent)}%: R$ ${fmt(totals.comissao)} | Repasse ao dono ${pct(percentCliente)}%: R$ ${fmt(totals.repasse)}`,
        ...(veCustoDaPlataforma
          ? [
              `Custo da plataforma: taxa Mercado Pago absorvida R$ ${fmt(totals.taxaMp)} (efetiva ${pct(taxaMpPercent)}%, ${textoDaFonteDaTaxa}) | Líquido NeoPower: R$ ${fmt(totals.liquidoNeoPower)}`,
            ]
          : []),
        `Regra: o repasse ao dono é ${pct(percentCliente)}% do consumido em recargas. As taxas do Mercado Pago saem dos ${pct(comissaoPercent)}% da NeoPower.`,
      ],
    };

    if (format === 'csv') {
      exportToCSV(options);
      toast.success('Relatório CSV exportado');
    } else {
      exportToExcel(options);
      toast.success('Relatório Excel exportado');
    }
  };

  /**
   * Valores de uma recarga como a API repartiu (comissão e repasse; a soma das
   * linhas bate com o resumo). A taxa do Mercado Pago só vem para a
   * plataforma; sem ela, o líquido da NeoPower é a comissão.
   */
  const valoresDaLinha = (row: FinancialReportItem) => {
    const n = (v: string | undefined) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
    const receita = n(row['Receita (R$)']);
    const taxaMp = n(row['Taxa Mercado Pago (R$)']);
    const comissao =
      row['Comissão NeoPower (R$)'] != null
        ? n(row['Comissão NeoPower (R$)'])
        : n(row['Valor Total de Taxas (R$)']);
    const repasse = n(row['Repasse ao Dono (R$)'] ?? row['Valor Pago ao Cliente (R$)']);
    return { receita, taxaMp, comissao, repasse, liquidoNeoPower: comissao - taxaMp };
  };

  // Somas em centavos: as linhas já vêm repartidas ao centavo pela API.
  const totals = (() => {
    const c = {
      energy: 0,
      revenue: 0,
      taxaMp: 0,
      comissao: 0,
      repasse: 0,
      revenueCruzadas: 0,
      repasseCruzadas: 0,
    };
    for (const row of reportData) {
      const v = valoresDaLinha(row);
      c.energy += parseFloat(row['Recarga (kWh)']) || 0;
      c.revenue += Math.round(v.receita * 100);
      c.taxaMp += Math.round(v.taxaMp * 100);
      c.comissao += Math.round(v.comissao * 100);
      c.repasse += Math.round(v.repasse * 100);
      if (row.recargaCruzada) {
        c.revenueCruzadas += Math.round(v.receita * 100);
        c.repasseCruzadas += Math.round(v.repasse * 100);
      }
    }
    return {
      energy: c.energy,
      revenue: c.revenue / 100,
      taxaMp: c.taxaMp / 100,
      comissao: c.comissao / 100,
      repasse: c.repasse / 100,
      liquidoNeoPower: (c.comissao - c.taxaMp) / 100,
      revenueCruzadas: c.revenueCruzadas / 100,
      repasseCruzadas: c.repasseCruzadas / 100,
    };
  })();
  const qtdCruzadas = reportData.filter(r => r.recargaCruzada).length;

  // Custo da plataforma (taxa do Mercado Pago absorvida e líquido NeoPower):
  // a API só manda para a NeoPower. Sem o resumo (API antiga), só o super
  // admin vê o que vier nas linhas.
  const custo = resumo?.custoMercadoPago ?? null;
  const veCustoDaPlataforma = resumo ? !!custo : isSuperAdmin;
  const taxaMpPercent = custo?.percentual ?? 0;
  const fonteDaTaxa: FonteDaTaxaMp | null = custo?.fonte ?? null;
  const textoDaFonteDaTaxa =
    fonteDaTaxa === 'periodo'
      ? 'depósitos pagos da marca no período'
      : fonteDaTaxa === 'ultimos-90-dias'
        ? 'sem depósito pago no período: últimos 90 dias da marca'
        : fonteDaTaxa === 'sem-depositos'
          ? 'sem depósito pago nos últimos 90 dias'
          : 'API sem o repasse por recarga';

  // Só é ENTRADA o que veio de um pagamento de verdade (Mercado Pago). Crédito
  // manual do admin e migração de saldo movem saldo sem dinheiro entrar — um
  // "Crédito manual" de teste de R$ 200.000 fazia a entrada estourar.
  const ehCreditoSemPagamento = (t: WalletTransactionItem) =>
    !t.referenceId ||
    t.referenceId.startsWith('migration_') ||
    /^cr[eé]dito manual/i.test(t.description || '');
  const deposits = walletTransactions.filter(t => t.type === 'deposit' && !ehCreditoSemPagamento(t));
  const creditosSemPagamento = walletTransactions.filter(
    t => t.type === 'deposit' && ehCreditoSemPagamento(t)
  );
  // Estorno de depósito (refund-deposit-<id>) devolve dinheiro: sai da entrada.
  const estornosDeposito = walletTransactions.filter(
    t => t.type === 'refund' && (t.referenceId || '').startsWith('refund-deposit-')
  );
  // Estorno de RECARGA devolvido pelo Mercado Pago (mp-refund-tx-<id>): o
  // dinheiro voltou para o cartão/Pix do cliente, então saiu do caixa. O
  // estorno creditado na carteira (refund-tx-<id>) NÃO entra aqui: o saldo
  // continua com o cliente, dentro de casa.
  const estornosRecargaMp = walletTransactions.filter(
    t => (t.referenceId || '').startsWith('mp-refund-tx-')
  );
  // Devolução ao VISITANTE (GUEST_REFUND_<sessão>): o pague-e-carregue lança o
  // valor pago como depósito e, no fim, devolve a sobra.
  const devolucoesVisitante = walletTransactions.filter(t =>
    (t.referenceId || '').startsWith('GUEST_REFUND_')
  );
  const somaAbs = (lista: WalletTransactionItem[]) => lista.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const withdrawals = walletTransactions.filter(t => t.type === 'withdrawal' || t.type === 'charge');
  const totalWithdrawals = somaAbs(withdrawals);
  // Depósito estornado fica fora da taxa: o Mercado Pago devolve a tarifa
  // junto com o valor.
  const idsDepositoEstornado = new Set(
    estornosDeposito.map(t => (t.referenceId || '').replace('refund-deposit-', ''))
  );

  // "Entrou no caixa" = depósitos − devoluções: a conta é da API (a mesma do
  // card da visão geral). Com a API antiga, sai dos lançamentos da carteira.
  const entrada = resumo?.entrada ?? null;
  const totalCreditosSemPagamento = entrada
    ? entrada.creditosSemPagamento
    : creditosSemPagamento.reduce((acc, t) => acc + t.amount, 0);
  const totalDevolvido = entrada
    ? entrada.estornosDeposito + entrada.estornosRecargaMp + entrada.devolucoesVisitante
    : somaAbs(estornosDeposito) + somaAbs(estornosRecargaMp) + somaAbs(devolucoesVisitante);
  const depositosPagos = entrada ? entrada.depositos : deposits.reduce((acc, t) => acc + t.amount, 0);
  const qtdDepositos = entrada ? entrada.quantidade : deposits.length;
  const entrouNoCaixa = entrada ? entrada.liquido : depositosPagos - totalDevolvido;
  // Taxa do Mercado Pago dos depósitos: custo da NeoPower, só para a plataforma.
  const mercadoPagoFeeDeposits =
    entrada?.taxaMp ??
    deposits
      .filter(t => !idsDepositoEstornado.has(String(t.id)))
      .reduce((acc, t) => acc + taxaMpDoDeposito(t), 0);
  const saldoClientes = resumo?.saldoClientes ?? null;
  // Caixa e saldo são da marca: só para quem a gerencia (a API decide).
  const mostraCaixa = !!entrada || isAdmin;

  // Repasse por recarga: o dono recebe (100% − comissão) do consumido.
  const consumido = totals.revenue;
  const percentCliente = resumo?.repassePercent ?? 100 - comissaoPercent;
  const repasseAoDono = totals.repasse;
  const comissaoNeoPower = totals.comissao;

  const visibleReportData = React.useMemo(() => {
    return reportData.filter(row => {
      const revenue = parseFloat(row['Receita (R$)']?.replace(',', '.')) || 0;
      const energy = parseFloat(row['Recarga (kWh)']?.replace(',', '.')) || 0;
      return revenue > 0 || energy > 0;
    });
  }, [reportData]);

  const dailyData = React.useMemo(() => {
    const groups: { [date: string]: { date: string; revenue: number; energy: number } } = {};
    
    const sortedReport = [...reportData].sort((a, b) => {
      const parseDate = (dStr: string) => {
        if (!dStr) return 0;
        const parts = dStr.split(' ');
        if (parts[0]?.includes('/')) {
          const dParts = parts[0].split('/');
          const tParts = parts[1] ? parts[1].split(':') : ['0','0','0'];
          return new Date(
            parseInt(dParts[2]), 
            parseInt(dParts[1]) - 1, 
            parseInt(dParts[0]),
            tParts[0] ? parseInt(tParts[0]) : 0,
            tParts[1] ? parseInt(tParts[1]) : 0,
            tParts[2] ? parseInt(tParts[2]) : 0
          ).getTime();
        }
        return new Date(dStr).getTime();
      };
      return parseDate(a['Início']) - parseDate(b['Início']);
    });

    sortedReport.forEach((row) => {
      const dateStr = row['Início']?.split(' ')[0] || 'Outro';
      const revenue = parseFloat(row['Receita (R$)']?.replace(',', '.')) || 0;
      const energy = parseFloat(row['Recarga (kWh)']?.replace(',', '.')) || 0;
      
      if (!groups[dateStr]) {
        groups[dateStr] = { date: dateStr, revenue: 0, energy: 0 };
      }
      groups[dateStr].revenue += revenue;
      groups[dateStr].energy += energy;
    });

    return Object.values(groups);
  }, [reportData]);

  // Dados para o ReportTemplate (PDF)
  const reportTemplateData = {
    locationName: isAdmin ? 'Painel Administrativo' : `Estações de ${user?.name || 'Usuário'}`,
    totalKwh: totals.energy,
    totalRevenue: totals.revenue,
    totalComissao: totals.comissao,
    totalRepasse: totals.repasse,
    comissaoPercent,
    repassePercent: percentCliente,
    // Custo da plataforma: só no PDF de quem a API mandou o custo (NeoPower).
    custo: veCustoDaPlataforma
      ? {
          taxaMp: totals.taxaMp,
          taxaMpPercent,
          taxaMpFonte: textoDaFonteDaTaxa,
          liquidoNeoPower: totals.liquidoNeoPower,
        }
      : null,
    sessionsCount: reportData.length,
    entrouNoCaixa: mostraCaixa ? entrouNoCaixa : null,
    saldoClientes: saldoClientes ? saldoClientes.aConsumir : null,
    walletDeposits: depositosPagos - totalDevolvido,
    walletWithdrawals: totalWithdrawals,
    chartData: reportData.slice(0, 30).map((row, i) => {
      const v = valoresDaLinha(row);
      return {
        name: row['Início']?.split(' ')[0] || `#${i + 1}`,
        revenue: v.receita,
        fees: v.comissao,
      };
    }),
    financialTableData: reportData.map(row => {
      const v = valoresDaLinha(row);
      return {
        date: row['Início']?.split(' ')[0] || '-',
        charger: row['Estação'],
        kwh: row['Recarga (kWh)'],
        revenue: v.receita.toFixed(2),
        comissao: v.comissao.toFixed(2),
        repasse: v.repasse.toFixed(2),
      };
    }),
  };

  const periodLabel = startDate && endDate
    ? `${dataLocal(startDate).toLocaleDateString('pt-BR')} — ${dataLocal(endDate).toLocaleDateString('pt-BR')}`
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
  /** Percentual sem casas inuteis: 5 vira "5", 7,5 vira "7,5". */
  const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

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
    // Marca com carregador e ainda sem venda também aparece (com zero) — antes
    // sumia, e a Vip Energy, com 10 carregadores, não aparecia no overview.
    const activeTenants = tenantOverview.byTenant.filter(
      t => t.transactions > 0 || (t.chargers ?? 0) > 0
    );
    // No gráfico de receita, só quem teve receita.
    const topTenants = [...activeTenants]
      .filter(t => t.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
    // Mesma regra do relatório por operador: ENTRADA de dinheiro = depósitos (o
    // visitante também entra como depósito) menos o que voltou ao cliente.
    // Recarga é consumo do saldo já depositado e aparece à parte. A taxa do
    // Mercado Pago é custo da NeoPower (sai dos 5% dela).
    const entradaBruta = agg.deposits.total;
    const taxaMp = agg.deposits.mpFee ?? 0;
    // Devolvido ao cliente (estornos e sobra do visitante).
    const devolvido = agg.deposits.devolvidos ?? 0;
    const entradaLiquida = entradaBruta - devolvido;
    // O que ficou na conta depois da taxa do Mercado Pago.
    const naConta = agg.deposits.liquidoAposTaxaMp ?? entradaLiquida - taxaMp;
    const baseEntrada = entradaBruta || 1;
    const pctNaConta = entradaBruta > 0 ? (naConta / baseEntrada) * 100 : 0;
    const pctTaxaMp = entradaBruta > 0 ? (taxaMp / baseEntrada) * 100 : 0;
    const pctDevolvido = entradaBruta > 0 ? (devolvido / baseEntrada) * 100 : 0;
    // Taxa do Mercado Pago absorvida sobre o consumo e o que sobra da comissão
    // (soma dos cards por marca).
    const taxaMpAbsorvidaTotal = agg.mpFee ?? 0;
    const liquidoNeoPowerTotal = agg.liquidoNeoPower ?? agg.fees - taxaMpAbsorvidaTotal;

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
                  R$ {fmt(entradaLiquida)}
                </p>
                <p className="text-sm text-on-surface-variant mt-1">
                  entrou no caixa (depósitos − devoluções)
                </p>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wide">Recargas</p>
                  <p className="text-2xl font-bold text-foreground">{agg.transactions}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wide">Energia</p>
                  <p className="text-2xl font-bold text-foreground">{fmt(agg.kWh)} <span className="text-sm text-on-surface-variant">kWh</span></p>
                </div>
              </div>
            </div>

            {/* Barra de composição da entrada */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Depósitos: R$ {fmt(entradaBruta)}</span>
                <span>Taxa Mercado Pago (absorvida pela NeoPower): R$ {fmt(taxaMp)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden flex">
                <div
                  className="bg-primary/70 transition-all"
                  style={{ width: `${pctNaConta}%` }}
                  title={`Na conta: R$ ${fmt(naConta)}`}
                />
                <div
                  className="bg-red-500/40 transition-all"
                  style={{ width: `${pctTaxaMp}%` }}
                  title={`Taxa Mercado Pago: R$ ${fmt(taxaMp)}`}
                />
                <div
                  className="bg-amber-500/40 transition-all"
                  style={{ width: `${pctDevolvido}%` }}
                  title={`Devolvido: R$ ${fmt(devolvido)}`}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-[10px] font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                  Na conta ({pctNaConta.toFixed(0)}%)
                </span>
                <span className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/40" />
                  Taxa Mercado Pago ({pctTaxaMp.toFixed(0)}%)
                </span>
                {devolvido > 0 && (
                  <span className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/40" />
                    Devolvido ({pctDevolvido.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── KPIs secundários ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Entrada (depósitos)</p>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {fmt(entradaBruta)}</p>
            <p className="text-xs text-on-surface-variant mt-1">{agg.deposits.count} depósito{agg.deposits.count === 1 ? '' : 's'} pago{agg.deposits.count === 1 ? '' : 's'} no período</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">ev_station</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Consumido em recargas</p>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {fmt(agg.revenue)}</p>
            <p className="text-xs text-on-surface-variant mt-1">
              {agg.transactions} recarga{agg.transactions === 1 ? '' : 's'} · ticket R$ {fmt(agg.transactions > 0 ? agg.revenue / agg.transactions : 0)}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">payments</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Repasse aos donos</p>
            </div>
            <p className="text-2xl font-bold text-primary">R$ {fmt(agg.net)}</p>
            <p className="text-xs text-on-surface-variant mt-1">
              {pct(100 - comissaoPercent)}% do consumido · {activeTenants.length} marca{activeTenants.length === 1 ? '' : 's'} ativa{activeTenants.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">savings</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Comissão NeoPower</p>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {fmt(agg.fees)}</p>
            <p className="text-xs text-on-surface-variant mt-1">{pct(comissaoPercent)}% do consumido, bruta</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-red-500">trending_down</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Taxa Mercado Pago (absorvida)</p>
            </div>
            <p className="text-2xl font-bold text-red-500">R$ {fmt(taxaMpAbsorvidaTotal)}</p>
            <p className="text-xs text-on-surface-variant mt-1">
              proporcional ao consumo; sai dos {pct(comissaoPercent)}% da NeoPower (depósitos do período: R$ {fmt(taxaMp)})
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">account_balance</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Líquido NeoPower</p>
            </div>
            <p className={`text-2xl font-bold ${liquidoNeoPowerTotal < 0 ? 'text-red-500' : 'text-foreground'}`}>
              R$ {fmt(liquidoNeoPowerTotal)}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">comissão − taxa Mercado Pago absorvida</p>
          </div>
        </div>

        {/* ─── Chart: Top whitelabels por recargas ─── */}
        {topTenants.length > 0 && (
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">bar_chart</span>
                Top whitelabels por recargas
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
              {activeTenants.length} whitelabels com carregador ou venda
            </span>
          </div>
          {activeTenants.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-outline-variant text-5xl mb-2">payments</span>
              <p className="text-sm font-semibold">Nenhuma movimentação financeira registrada</p>
              <p className="text-xs text-outline">Todos os whitelabels estão zerados para o período selecionado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTenants.map(t => {
                const shareOfRevenue = agg.revenue > 0 ? (t.revenue / agg.revenue) * 100 : 0;
                return (
                  <button
                    key={t.clientId}
                    onClick={() => handleDrillDown(t.clientId)}
                    className="glass-card rounded-2xl p-5 text-left transition-all hover:scale-[1.02] hover:shadow-xl hover:border-primary/30 group"
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
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Consumido</p>
                        <p className="text-base font-bold text-foreground">R$ {fmt(t.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Repasse ao dono</p>
                        <p className="text-base font-bold text-primary">R$ {fmt(t.net)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Comissão {pct(t.comissaoPercent ?? comissaoPercent)}%</p>
                        <p className="text-sm text-foreground">R$ {fmt(t.fees)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">
                          Taxa MP{t.taxaMpPercent != null ? ` ${pct(t.taxaMpPercent)}%` : ''}
                        </p>
                        <p className="text-sm text-red-500">R$ {fmt(t.mpFee ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Líquido NeoPower</p>
                        <p className={`text-sm ${(t.liquidoNeoPower ?? t.fees - (t.mpFee ?? 0)) < 0 ? 'text-red-500' : 'text-foreground'}`}>
                          R$ {fmt(t.liquidoNeoPower ?? t.fees - (t.mpFee ?? 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-wide">Transações</p>
                        <p className="text-sm text-foreground">
                          {t.transactions}
                          {t.chargers != null && (
                            <span className="text-xs text-outline"> · {t.chargers} carregador{t.chargers === 1 ? '' : 'es'}</span>
                          )}
                        </p>
                      </div>
                      {/* Recarga cruzada: mesma comissão e repasse, sem taxa MP. */}
                      {(t.cruzadas?.quantidade ?? 0) > 0 && (
                        <p className="col-span-2 text-xs text-amber-500 -mt-1">
                          R$ {fmt(t.cruzadas!.receita)} de clientes de outras redes ({t.cruzadas!.quantidade})
                        </p>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                        style={{ width: `${shareOfRevenue}%` }}
                      />
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1.5">
                      {shareOfRevenue.toFixed(1)}% do consumido
                    </p>
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

      {/* ─── Repasse por recarga ─── */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-headline font-semibold text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">payments</span>
            Repasse ao dono por recarga
          </h2>
          <p className="text-sm text-on-surface-variant mt-1 max-w-3xl">
            O repasse ao dono é <strong>{pct(percentCliente)}% do que foi consumido em recargas</strong>: o
            saldo parado na carteira é do cliente até ele usar. As taxas do Mercado Pago saem dos{' '}
            {pct(comissaoPercent)}% da NeoPower.
            {submittedFilter && mostraCaixa && ' Com o filtro de estação, "Entrou no caixa" e o saldo continuam sendo da marca inteira.'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mostraCaixa && (
            <CartaoDoRepasse
              icone="account_balance"
              titulo="Entrou no caixa"
              valor={`R$ ${fmt(entrouNoCaixa)}`}
              detalhe={
                <>
                  Depósitos R$ {fmt(depositosPagos)} − devoluções R$ {fmt(totalDevolvido)}
                  {veCustoDaPlataforma && (
                    <span className="block text-outline">
                      O Mercado Pago reteve R$ {fmt(mercadoPagoFeeDeposits)} desses depósitos (custo da NeoPower)
                    </span>
                  )}
                  {totalCreditosSemPagamento > 0 && (
                    <span className="block text-outline">Créditos manuais/migração (R$ {fmt(totalCreditosSemPagamento)}) não são entrada</span>
                  )}
                </>
              }
            />
          )}
          <CartaoDoRepasse
            icone="bolt"
            titulo="Consumido em recargas"
            valor={`R$ ${fmt(consumido)}`}
            detalhe={
              <>
                {reportData.length} recarga{reportData.length === 1 ? '' : 's'}
                {qtdCruzadas > 0 && ` · R$ ${fmt(totals.revenueCruzadas)} de clientes de outras redes`}
              </>
            }
          />
          <CartaoDoRepasse
            icone="savings"
            titulo={`Comissão NeoPower ${pct(comissaoPercent)}%`}
            valor={`R$ ${fmt(comissaoNeoPower)}`}
            detalhe={`${pct(comissaoPercent)}% do consumido`}
          />
          <CartaoDoRepasse
            icone="handshake"
            titulo="Repasse ao dono"
            valor={`R$ ${fmt(repasseAoDono)}`}
            destaque
            detalhe={
              <>
                Valor a pagar: {pct(percentCliente)}% do consumido
                {qtdCruzadas > 0 && (
                  <span className="block">Inclui R$ {fmt(totals.repasseCruzadas)} de clientes de outras redes (acerto manual)</span>
                )}
              </>
            }
          />
          {mostraCaixa && (
            <CartaoDoRepasse
              icone="account_balance_wallet"
              titulo="Saldo de clientes a consumir"
              valor={saldoClientes ? `R$ ${fmt(saldoClientes.aConsumir)}` : '—'}
              detalhe={
                saldoClientes ? (
                  <>
                    Soma das carteiras dos clientes da marca{' '}
                    {saldoClientes.fonte === 'carteiras-agora'
                      ? 'hoje'
                      : `no fim do período (${new Date(saldoClientes.em).toLocaleDateString('pt-BR')})`}
                    {' '}· {saldoClientes.carteiras} carteira{saldoClientes.carteiras === 1 ? '' : 's'}. Entrou e ainda não virou recarga.
                    {saldoClientes.devedor > 0 && (
                      <span className="block text-amber-500">Clientes devendo: R$ {fmt(saldoClientes.devedor)}</span>
                    )}
                  </>
                ) : (
                  'Disponível quando a API do repasse por recarga estiver no ar'
                )
              }
            />
          )}
          {/* Custo da plataforma: só a NeoPower vê (a API não manda ao operador). */}
          {veCustoDaPlataforma && (
            <CartaoDoRepasse
              icone="percent"
              titulo="Taxa Mercado Pago (absorvida pela NeoPower)"
              valor={`−R$ ${fmt(totals.taxaMp)}`}
              tom="negativo"
              detalhe={
                <>
                  {pct(taxaMpPercent)}% efetiva sobre o consumo · {textoDaFonteDaTaxa}. Não reduz o repasse.
                  {qtdCruzadas > 0 && (
                    <span className="block text-outline">Recargas de outras redes ficam sem (a taxa ficou no depósito da rede do cliente)</span>
                  )}
                </>
              }
            />
          )}
          {veCustoDaPlataforma && (
            <CartaoDoRepasse
              icone="account_balance"
              titulo="Líquido NeoPower"
              valor={`R$ ${fmt(totals.liquidoNeoPower)}`}
              tom={totals.liquidoNeoPower < 0 ? 'negativo' : undefined}
              detalhe="Comissão − taxa do Mercado Pago absorvida"
            />
          )}
        </div>

        {/* Para onde vai o consumido */}
        {consumido > 0 && (
          <div>
            <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden flex">
              <div className="bg-blue-500/50 transition-all" style={{ width: `${(repasseAoDono / consumido) * 100}%` }} title={`Repasse: R$ ${fmt(repasseAoDono)}`} />
              {veCustoDaPlataforma ? (
                <>
                  <div className="bg-primary/70 transition-all" style={{ width: `${(Math.max(0, totals.liquidoNeoPower) / consumido) * 100}%` }} title={`Líquido NeoPower: R$ ${fmt(totals.liquidoNeoPower)}`} />
                  <div className="bg-red-500/40 transition-all" style={{ width: `${(Math.min(totals.taxaMp, comissaoNeoPower) / consumido) * 100}%` }} title={`Taxa MP: R$ ${fmt(totals.taxaMp)}`} />
                </>
              ) : (
                <div className="bg-primary/70 transition-all" style={{ width: `${(comissaoNeoPower / consumido) * 100}%` }} title={`Comissão: R$ ${fmt(comissaoNeoPower)}`} />
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />Dono ({((repasseAoDono / consumido) * 100).toFixed(1)}%)</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/70" />NeoPower ({((comissaoNeoPower / consumido) * 100).toFixed(1)}%)</span>
              {veCustoDaPlataforma && (
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500/40" />dos quais taxa MP ({((totals.taxaMp / consumido) * 100).toFixed(1)}%)</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Seção Recargas de outras redes (Recarga Cruzada) ─── */}
      {recargasCruzadas && (recargasCruzadas.recebidas.quantidade > 0 || recargasCruzadas.aRepassar.quantidade > 0) && (
        <div className="glass-card rounded-xl p-6 border border-outline-variant/15 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">sync_alt</span>
              <div>
                <h2 className="text-lg font-headline font-semibold text-foreground">Recargas de outras redes</h2>
                <p className="text-xs text-on-surface-variant">Sessões realizadas de forma cruzada entre marcas parceiras</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              Recarga Cruzada
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* A receber */}
            <div className="p-4 rounded-xl bg-surface-container/60 border border-outline-variant/15 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">A receber (postos próprios)</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    R$ {fmt(recargasCruzadas.recebidas.valorRepasse ?? recargasCruzadas.recebidas.valorBruto * (percentCliente / 100))}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {pct(percentCliente)}% do consumido, após {pct(comissaoPercent)}% NeoPower (Bruto: R$ {fmt(recargasCruzadas.recebidas.valorBruto)})
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">call_received</span>
                </div>
              </div>
              <div className="pt-2 border-t border-outline-variant/10 space-y-1.5">
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase">Por rede de origem ({recargasCruzadas.recebidas.quantidade} sessões):</p>
                {recargasCruzadas.recebidas.porRede.length > 0 ? (
                  recargasCruzadas.recebidas.porRede.map(item => (
                    <div key={item.nome ?? item.rede} className="flex justify-between items-center text-xs py-1 px-2 rounded bg-surface-container-highest/40">
                      <span className="font-medium text-foreground">{item.nome ?? item.rede}</span>
                      <span className="text-on-surface-variant">
                        {item.quantidade} {item.quantidade === 1 ? 'sessão' : 'sessões'} · R$ {fmt(item.valorBruto * (percentCliente / 100))} líq.
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant italic">Nenhuma sessão no período.</p>
                )}
              </div>
            </div>

            {/* A repassar */}
            <div className="p-4 rounded-xl bg-surface-container/60 border border-outline-variant/15 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">A repassar (postos parceiros)</p>
                  <p className="text-2xl font-bold text-amber-500 mt-1">
                    R$ {fmt(recargasCruzadas.aRepassar.valorBruto)}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Valor a acertar com redes parceiras
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <span className="material-symbols-outlined">call_made</span>
                </div>
              </div>
              <div className="pt-2 border-t border-outline-variant/10 space-y-1.5">
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase">Por rede de destino ({recargasCruzadas.aRepassar.quantidade} sessões):</p>
                {recargasCruzadas.aRepassar.porRede.length > 0 ? (
                  recargasCruzadas.aRepassar.porRede.map(item => (
                    <div key={item.nome ?? item.rede} className="flex justify-between items-center text-xs py-1 px-2 rounded bg-surface-container-highest/40">
                      <span className="font-medium text-foreground">{item.nome ?? item.rede}</span>
                      <span className="text-on-surface-variant">
                        {item.quantidade} {item.quantidade === 1 ? 'sessão' : 'sessões'} · R$ {fmt(item.valorBruto)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant italic">Nenhuma sessão no período.</p>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant italic flex items-center gap-1.5 pt-1">
            <span className="material-symbols-outlined text-sm text-outline">info</span>
            Já incluídas no consumido e no repasse acima: comissão de {pct(comissaoPercent)}% e repasse de {pct(percentCliente)}%, como as demais. O acerto entre redes é manual.
          </p>
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
          <div className="p-4 rounded-xl bg-background/50 border border-outline-variant/15 max-w-xs">
            <p className="text-xs text-on-surface-variant font-medium uppercase mb-1">Energia Total</p>
            <p className="text-xl font-bold text-foreground">{totals.energy.toFixed(2)} kWh</p>
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
            <p className="text-sm text-on-surface-variant mt-1">
              Valores depositados pelos clientes da marca (Pix/Cartão)
              {veCustoDaPlataforma && ' — Taxa Mercado Pago por método (Pix 0,99% · crédito 4,99% · débito 3,99%), absorvida pela NeoPower'}
            </p>
          </div>
          <div className="p-6">
            <div className={`grid grid-cols-1 ${veCustoDaPlataforma ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-6`}>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                  <p className="text-xs text-foreground font-medium uppercase">Total Depósitos</p>
                </div>
                <p className="text-lg font-bold text-foreground">R$ {fmt(depositosPagos)}</p>
                <p className="text-xs text-outline mt-1">{qtdDepositos} depósito{qtdDepositos === 1 ? '' : 's'} pago{qtdDepositos === 1 ? '' : 's'}</p>
              </div>
              {/* Custo da plataforma: só a NeoPower vê a taxa do Mercado Pago. */}
              {veCustoDaPlataforma && (
                <div className="p-4 rounded-xl bg-background/50 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <p className="text-xs text-foreground font-medium uppercase">Taxa Mercado Pago</p>
                  </div>
                  <p className="text-lg font-bold text-foreground">-R$ {fmt(mercadoPagoFeeDeposits)}</p>
                  <p className="text-xs text-outline mt-1">por método, absorvida pela NeoPower</p>
                </div>
              )}
              <div className="p-4 rounded-xl bg-background/50 border border-primary/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <p className="text-xs text-on-surface-variant font-medium uppercase">Entrou no caixa</p>
                </div>
                <p className="text-lg font-bold text-primary">R$ {fmt(entrouNoCaixa)}</p>
                <p className="text-xs text-outline mt-1">
                  Depósitos − devoluções
                  {totalDevolvido > 0 && ` (R$ ${fmt(totalDevolvido)} devolvidos)`}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <p className="text-xs text-foreground font-medium uppercase">Média por Depósito</p>
                </div>
                <p className="text-lg font-bold text-foreground">
                  R$ {qtdDepositos > 0 ? fmt(depositosPagos / qtdDepositos) : '0,00'}
                </p>
                <p className="text-xs text-outline mt-1">Valor médio</p>
              </div>
            </div>
            {totalCreditosSemPagamento > 0 && (
              <p className="text-xs text-outline -mt-3 mb-4">
                Créditos manuais/migração no período: R$ {fmt(totalCreditosSemPagamento)} (movem saldo, não são entrada).
              </p>
            )}

            {deposits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/15">
                      <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Usuário</th>
                      <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Data</th>
                      <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Valor</th>
                      {veCustoDaPlataforma && (
                        <>
                          <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Taxa MP</th>
                          <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Líquido</th>
                        </>
                      )}
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
                        {veCustoDaPlataforma && (
                          <>
                            <td className="py-3 px-4 text-right font-mono text-sm text-red-600 dark:text-red-400/70">-R$ {fmt(taxaMpDoDeposito(deposit))}</td>
                            <td className="py-3 px-4 text-right font-mono text-sm text-primary">R$ {fmt(deposit.amount - taxaMpDoDeposito(deposit))}</td>
                          </>
                        )}
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

      {/* Daily Evolution Chart */}
      {!overviewMode && dailyData.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-headline font-semibold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">show_chart</span>
                Evolução Diária de Receita e Consumo
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Desempenho financeiro e energético ao longo do período selecionado
              </p>
            </div>
          </div>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.15} />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `${v} kWh`} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'revenue') return [`R$ ${fmt(Number(value))}`, 'Receita'];
                    return [`${Number(value).toFixed(2)} kWh`, 'Consumo'];
                  }}
                  labelStyle={{ color: 'var(--color-foreground)', fontWeight: 'bold' }}
                />
                <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#colorRevenue)" stroke="var(--primary)" strokeWidth={2} name="revenue" />
                <Line yAxisId="right" type="monotone" dataKey="energy" stroke="#00d2ff" strokeWidth={2} dot={dailyData.length < 30} activeDot={{ r: 6 }} name="energy" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant/15">
          <h2 className="text-lg font-headline font-semibold text-foreground">Detalhamento por Transação</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {visibleReportData.length} {visibleReportData.length === 1 ? 'registro encontrado' : 'registros encontrados'}
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
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Consumido</th>
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Comissão</th>
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Repasse</th>
                {veCustoDaPlataforma && (
                  <>
                    <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4" title="Taxa do Mercado Pago proporcional ao consumo, absorvida pela NeoPower">Taxa MP</th>
                    <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Líquido NeoPower</th>
                  </>
                )}
                <th className="text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleReportData.length > 0 ? (
                visibleReportData.map((row, index) => {
                  const v = valoresDaLinha(row);
                  return (
                  <tr key={index} className="border-b border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{row['Estação']}</span>
                        {row.recargaCruzada && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title={`Recarga Cruzada - Rede: ${row.redeDoCliente || 'Outra rede'}`}>
                            Cliente {row.redeDoCliente || 'outra rede'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-on-surface-variant">{row['Início']}</td>
                    <td className="py-3 px-4 text-sm text-on-surface-variant">{row['Fim']}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-foreground">{row['Recarga (kWh)']} kWh</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-primary">R$ {fmt(v.receita)}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-on-surface-variant">R$ {fmt(v.comissao)}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-foreground">R$ {fmt(v.repasse)}</td>
                    {veCustoDaPlataforma && (
                      <>
                        <td className="py-3 px-4 text-right font-mono text-sm text-red-600 dark:text-red-400/70">R$ {fmt(v.taxaMp)}</td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-on-surface-variant">R$ {fmt(v.liquidoNeoPower)}</td>
                      </>
                    )}
                    <td className="py-3 px-4 text-center">{getStatusBadge(row['Status'])}</td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={veCustoDaPlataforma ? 10 : 8} className="text-center py-16">
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

        {visibleReportData.length > 0 && (
          <div className="px-6 py-5 border-t border-outline-variant/15">
            <div className={`grid grid-cols-2 ${veCustoDaPlataforma ? 'md:grid-cols-7' : 'md:grid-cols-5'} gap-4`}>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Total Transações</p>
                <p className="text-lg font-bold text-foreground">{visibleReportData.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Energia Total</p>
                <p className="text-lg font-bold text-foreground">{totals.energy.toFixed(2)} kWh</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Consumido</p>
                <p className="text-lg font-bold text-primary">R$ {fmt(totals.revenue)}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Comissão NeoPower ({pct(comissaoPercent)}%)</p>
                <p className="text-lg font-bold text-foreground">R$ {fmt(totals.comissao)}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                <p className="text-xs text-on-surface-variant mb-1">Repasse ao dono ({pct(percentCliente)}%)</p>
                <p className="text-lg font-bold text-primary">R$ {fmt(totals.repasse)}</p>
              </div>
              {veCustoDaPlataforma && (
                <>
                  <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                    <p className="text-xs text-on-surface-variant mb-1">Taxa MP absorvida ({pct(taxaMpPercent)}%)</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">R$ {fmt(totals.taxaMp)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-background/50 border border-outline-variant/15">
                    <p className="text-xs text-on-surface-variant mb-1">Líquido NeoPower</p>
                    <p className={`text-lg font-bold ${totals.liquidoNeoPower < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>R$ {fmt(totals.liquidoNeoPower)}</p>
                  </div>
                </>
              )}
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
