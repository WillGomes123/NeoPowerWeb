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
import { ResumoDoCustoDeEnergia } from '../components/ResumoDoCustoDeEnergia';
import { SeletorDeLocal, LocalParaSelecao } from '../components/SeletorDeLocal';
import {
  LinhaDoLocal,
  LocalDoRelatorio,
  SubtotaisDoLocal,
  TIPO_XLSX,
  baixarArquivo,
  carregadoresDoRelatorio,
  conferenciaComProblema,
  gerarXlsxDoLocal,
  montarRelatorioDoLocal,
  reaisOuTraco,
} from '../lib/relatorioDoLocal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart, Line } from 'recharts';
import { X } from 'lucide-react';
import { Icone, IconeSvg } from '../components/painel/Icone';
import {
  BlocoDeIcone,
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
  type Tom,
} from '../components/painel/Pagina';
import {
  BarraDeFiltros,
  CampoDeBusca,
  ChipDeFiltro,
  classeDoBotaoContorno,
} from '../components/painel/Pecas';
import {
  CabecalhoDoCartao,
  CartaoDeIndicador,
  NumeroMiudo,
  SeloDeContorno,
  Vazio,
  classeDaCelula,
  classeDaTabela,
  classeDoTh,
  fundoDaLinha,
} from '../components/financeiro/Pecas';
import { Paginacao, usePagina } from '../components/financeiro/Paginacao';
import iconeDepositos from '../assets/icones/kpi-depositos.svg';

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

/**
 * Linha do relatório. Os campos de LinhaDoLocal (número, horário no fuso do
 * local, cliente abreviado, débito na carteira, conferência...) vêm da API do
 * relatório por local; a API antiga não manda.
 */
interface FinancialReportItem extends Partial<LinhaDoLocal> {
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
  // Split: parte do repasse que o dono já recebeu direto na conta dele e o
  // que a NeoPower ainda repassa. A API antiga não manda (tudo a repassar).
  'Já Recebido no Split (R$)'?: string;
  'A Repassar (R$)'?: string;
  recebidoNoSplit?: number;
  aRepassar?: number;
  Status: string;
  recargaCruzada?: boolean;
  redeDoCliente?: string | null;
  /**
   * Nome completo de quem carregou: a API manda só para admin e operador no
   * painel. Sem ele, a tabela usa o `cliente` abreviado do relatório por local.
   */
  clienteNome?: string | null;
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
  /**
   * Split: com a conta do Mercado Pago conectada, o depósito do cliente cai
   * direto na conta do dono. A parte das recargas paga com esse dinheiro ele
   * já recebeu; a NeoPower repassa o resto (`aRepassar`).
   */
  split?: { ativo: boolean; desde: string | null };
  recebidoNoSplit?: ValoresDoRepasse;
  aRepassar?: number;
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

/** Lista vazia fixa: uma nova a cada render voltaria a tabela para a página 1. */
const SEM_LINHAS_DO_LOCAL: LinhaDoLocal[] = [];

/** Usado só até a API responder; o percentual real vem no relatório. */
const COMISSAO_PADRAO_PERCENT = 5;

const ALINHAR = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/** Ícone do Material Symbols no tamanho do bloco de ícone dos cartões. */
const Simbolo = ({ nome }: { nome: string }) => (
  <span aria-hidden="true" className="material-symbols-outlined text-[22px] leading-none">
    {nome}
  </span>
);

/** Botão pequeno em pílula verde (exportação principal de um cartão). */
const classeDoBotaoVerde =
  'h-10 px-5 rounded-[25px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 ' +
  'hover:brightness-105 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * Cartão do resumo do repasse (visão de uma marca), no padrão dos cartões de
 * indicador da Visão geral.
 */
function CartaoDoRepasse({
  icone,
  titulo,
  valor,
  detalhe,
  destaque = false,
  tom,
  cor = 'marca',
  subtitulo,
}: {
  icone: string;
  titulo: string;
  valor: string;
  detalhe?: React.ReactNode;
  destaque?: boolean;
  tom?: 'negativo';
  /** Cor do bloco do ícone. */
  cor?: Tom;
  /** O período (ou o momento) do número. */
  subtitulo?: string;
}) {
  return (
    <CartaoDeIndicador
      tom={cor}
      icone={<Simbolo nome={icone} />}
      titulo={titulo}
      subtitulo={subtitulo}
      valor={valor}
      destaque={destaque}
      negativo={tom === 'negativo'}
    >
      {detalhe}
    </CartaoDeIndicador>
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
  // Relatório por local (?locationId=): as recargas de todos os carregadores
  // do local, para o repasse ao dono do local.
  const localIdParam = searchParams.get('locationId');
  const localId = localIdParam && /^\d+$/.test(localIdParam) ? Number(localIdParam) : null;
  // Modo overview: só ativa pra super admin sem drill-down nem local escolhido
  const overviewMode = isSuperAdmin && !drillDownClientId && localId == null;

  const [reportData, setReportData] = useState<FinancialReportItem[]>([]);
  const [recargasCruzadas, setRecargasCruzadas] = useState<RecargasCruzadasData | null>(null);
  // Comissao da plataforma para esta marca, como a API aplicou. A pagina
  // dividia o liquido com 5% escrito aqui dentro, entao uma marca com
  // percentual diferente lia um repasse que nao era o dela.
  const [comissaoPercent, setComissaoPercent] = useState<number>(COMISSAO_PADRAO_PERCENT);
  // Repasse por recarga como a API calculou (caixa, saldo e, para a
  // plataforma, a taxa do Mercado Pago absorvida).
  const [resumo, setResumo] = useState<ResumoRepasse | null>(null);
  // Operadores de Manaus: a API tira comissão e repasse da resposta
  // (utils/comissaoOculta.ts na API) e a tela mostra só o consumido.
  const [comissaoOculta, setComissaoOculta] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionItem[]>([]);
  const [tenantOverview, setTenantOverview] = useState<TenantOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Botão Atualizar: quando os números chegaram e se a última atualização
  // falhou (os números na tela ficam, com o aviso no botão).
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [submittedFilter, setSubmittedFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userLocationNames, setUserLocationNames] = useState<string[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(!filtraPorLocaisDoUsuario);
  // NFS-e
  const [nfseFilter, setNfseFilter] = useState<'all' | 'Issued' | 'Pending' | 'Error'>('all');
  // Relatório por local: os locais que a conta vê (a API decide o escopo), o
  // cabeçalho do local e os subtotais por tipo de conta, como a API mandou.
  const [locais, setLocais] = useState<LocalParaSelecao[]>([]);
  const [carregandoLocais, setCarregandoLocais] = useState(true);
  const [localDoRelatorio, setLocalDoRelatorio] = useState<LocalDoRelatorio | null>(null);
  const [subtotaisDoLocal, setSubtotaisDoLocal] = useState<SubtotaisDoLocal | null>(null);
  const [criterioContaInterna, setCriterioContaInterna] = useState<string | null>(null);
  // 'pdf', 'xlsx', 'zip' ou o id do carregador cujo PDF está saindo.
  const [exportandoLocal, setExportandoLocal] = useState<string | null>(null);

  // Locais do seletor: /locations/all já vem no escopo da conta (o super
  // admin vê todos, inclusive os da plataforma; o operador, os da marca).
  useEffect(() => {
    if (!user?.id) return;
    let ativo = true;
    setCarregandoLocais(true);
    api
      .get('/locations/all')
      .then(async res => {
        if (!res.ok) return;
        const data = await res.json();
        const lista: Array<{
          id: number;
          nomeDoLocal?: string | null;
          cidade?: string | null;
          estado?: string | null;
          clientId?: string | null;
        }> = Array.isArray(data?.locations) ? data.locations : [];
        if (!ativo) return;
        setLocais(
          lista
            .map(l => ({
              id: l.id,
              nome: l.nomeDoLocal?.trim() || `Local #${l.id}`,
              cidade: l.cidade ?? null,
              estado: l.estado ?? null,
              clientId: l.clientId ?? null,
            }))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        );
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregandoLocais(false);
      });
    return () => {
      ativo = false;
    };
  }, [user?.id]);

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

  // `manterNaFalha`: o Atualizar, com os mesmos filtros. Se a busca falha, os
  // números na tela ficam e o botão avisa. Com filtro novo, a tela esvazia
  // como antes, para não mostrar números de outro recorte.
  const fetchReport = useCallback(async ({ manterNaFalha = false }: { manterNaFalha?: boolean } = {}) => {
    setLoading(true);
    let endpoint = '/reports/financial';
    const params = new URLSearchParams();

    if (submittedFilter) params.append('chargerId', submittedFilter);
    if (localId != null) params.append('locationId', String(localId));
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
      setComissaoOculta(data?.comissaoOculta === true);
      // Só a regra atual (95% ao dono). A 'por-recarga' (taxa dividida, API
      // #95) cai no caminho das linhas, como a API antiga.
      setResumo(data?.repasse?.regra === 'repasse-95' ? data.repasse : null);
      setLocalDoRelatorio(data?.local ?? null);
      setSubtotaisDoLocal(data?.porTipoDeConta ?? null);
      setCriterioContaInterna(data?.criterioContaInterna ?? null);

      // Com um local escolhido, a API já limita ao escopo da conta.
      if (localId != null) {
        setReportData(items);
      } else if (filtraPorLocaisDoUsuario && userLocationNames.length > 0) {
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
      setAtualizadoEm(new Date());
      setFalhou(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar relatório financeiro');
      setFalhou(true);
      if (!manterNaFalha) {
        setReportData([]);
        setRecargasCruzadas(null);
        setResumo(null);
        setLocalDoRelatorio(null);
        setSubtotaisDoLocal(null);
      }
    } finally {
      setLoading(false);
    }
  }, [submittedFilter, localId, startDate, endDate, filtraPorLocaisDoUsuario, userLocationNames, drillDownClientId]);

  const fetchTenantOverview = useCallback(async ({ manterNaFalha = false }: { manterNaFalha?: boolean } = {}) => {
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
      setAtualizadoEm(new Date());
      setFalhou(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar overview por whitelabel');
      setFalhou(true);
      if (!manterNaFalha) setTenantOverview(null);
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

  // A hora (ou o aviso de falha) aparece embaixo do botão Atualizar; o
  // "Relatório atualizado!" de antes saía até quando a busca falhava.
  const handleRefresh = async () => {
    setRefreshing(true);
    if (overviewMode) {
      await fetchTenantOverview({ manterNaFalha: true });
    } else {
      await Promise.all([fetchReport({ manterNaFalha: true }), fetchWalletTransactions()]);
    }
    setRefreshing(false);
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
    if (localId != null) selecionarLocal(null);
  };

  const selecionarLocal = (id: number | null) => {
    const p = new URLSearchParams(searchParams);
    if (id != null) p.set('locationId', String(id));
    else p.delete('locationId');
    setSearchParams(p);
  };

  // No drill-down de uma marca, só os locais dela ('neo' e local sem marca
  // são da plataforma).
  const marcaDoLocal = (cid?: string | null) =>
    !cid || cid === 'neo' || cid === 'neopower-default' ? 'neopower-default' : cid;
  const locaisDoSeletor = drillDownClientId
    ? locais.filter(l => marcaDoLocal(l.clientId) === marcaDoLocal(drillDownClientId))
    : locais;

  // Relatório do local (tela e exportação), montado do que a API mandou.
  const relatorioDoLocal = React.useMemo(() => {
    if (localId == null || !localDoRelatorio || !subtotaisDoLocal) return null;
    const linhas = reportData.filter(
      (r): r is FinancialReportItem & LinhaDoLocal => typeof r.numero === 'number'
    );
    return montarRelatorioDoLocal({
      local: localDoRelatorio,
      linhas,
      subtotais: subtotaisDoLocal,
      comissaoPercent,
      repassePercent: resumo?.repassePercent,
      criterioContaInterna,
      split: resumo?.split ?? null,
      comissaoOculta,
      inicio: startDate || null,
      fim: endDate || null,
    });
  }, [comissaoOculta, localId, localDoRelatorio, subtotaisDoLocal, reportData, comissaoPercent, resumo, criterioContaInterna, startDate, endDate]);
  const carregadoresDoLocal = React.useMemo(
    () => (relatorioDoLocal ? carregadoresDoRelatorio(relatorioDoLocal) : []),
    [relatorioDoLocal]
  );

  const exportarDoLocal = async (formato: 'pdf' | 'xlsx' | 'zip' | { carregador: string }) => {
    if (!relatorioDoLocal) return;
    const chave = typeof formato === 'string' ? formato : formato.carregador;
    setExportandoLocal(chave);
    try {
      if (formato === 'xlsx') {
        baixarArquivo(gerarXlsxDoLocal(relatorioDoLocal), `${relatorioDoLocal.nomeDoArquivo}.xlsx`, TIPO_XLSX);
        toast.success('Relatório do local exportado (Excel)');
        return;
      }
      // As fontes do PDF só carregam quando alguém pede um.
      const pdf = await import('../lib/pdfDoLocal');
      const visual = await pdf.visualDaMarca(relatorioDoLocal.local.marca);
      if (formato === 'pdf') {
        pdf.gerarPdfDoLocal(relatorioDoLocal, visual).save(`${relatorioDoLocal.nomeDoArquivo}.pdf`);
      } else if (formato === 'zip') {
        baixarArquivo(pdf.gerarZipDosCarregadores(relatorioDoLocal, visual), `${relatorioDoLocal.nomeDoArquivo}_por_carregador.zip`, 'application/zip');
      } else {
        const carregador = carregadoresDoLocal.find(c => c.id === formato.carregador);
        if (!carregador) return;
        pdf.gerarPdfDoCarregador(relatorioDoLocal, carregador, visual).save(pdf.nomeDoArquivoDoCarregador(relatorioDoLocal, carregador));
      }
      toast.success('Relatório do local exportado (PDF)');
    } catch (error) {
      console.error('Erro ao gerar o relatório do local:', error);
      toast.error('Erro ao gerar o relatório do local');
    } finally {
      setExportandoLocal(null);
    }
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
        ...(comissaoOculta
          ? {}
          : {
              'Comissão (R$)': valor(v.comissao),
              'Repasse ao dono (R$)': valor(v.repasse),
            }),
        ...(temSplit && !comissaoOculta
          ? {
              'Já recebido no split (R$)': valor(v.recebidoNoSplit),
              'A repassar (R$)': valor(v.aRepassar),
            }
          : {}),
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
      ...(comissaoOculta
        ? []
        : [
            { key: 'Comissão (R$)', header: `Comissão NeoPower ${pct(comissaoPercent)}% (R$)`, format: numerico },
            { key: 'Repasse ao dono (R$)', header: `Repasse ao dono ${pct(percentCliente)}% (R$)`, format: numerico },
          ]),
      ...(temSplit && !comissaoOculta
        ? [
            { key: 'Já recebido no split (R$)', header: 'Já recebido pelo dono no split (R$)', format: numerico },
            { key: 'A repassar (R$)', header: 'A NeoPower repassa (R$)', format: numerico },
          ]
        : []),
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
      rodape: comissaoOculta
        ? [`Período: ${periodLabel}`, `Consumido em recargas: R$ ${fmt(totals.revenue)}`]
        : [
        `Período: ${periodLabel}`,
        `Consumido em recargas: R$ ${fmt(totals.revenue)} | Comissão NeoPower ${pct(comissaoPercent)}%: R$ ${fmt(totals.comissao)} | Repasse ao dono ${pct(percentCliente)}%: R$ ${fmt(totals.repasse)}`,
        ...(temSplit
          ? [
              `Split: já recebido pelo dono direto na conta dele R$ ${fmt(totals.recebidoNoSplit)} | A NeoPower repassa R$ ${fmt(totals.aRepassar)}`,
            ]
          : []),
        ...(veCustoDaPlataforma
          ? [
              `Custo da plataforma: taxa Mercado Pago absorvida R$ ${fmt(totals.taxaMp)} (efetiva ${pct(taxaMpPercent)}%, ${textoDaFonteDaTaxa}) | Líquido NeoPower: R$ ${fmt(totals.liquidoNeoPower)}`,
            ]
          : []),
        temSplit
          ? `Regra: o repasse ao dono é ${pct(percentCliente)}% do consumido em recargas. Com o split, o crédito que o cliente coloca cai direto na conta do dono, já sem a comissão; a NeoPower repassa só as recargas pagas com saldo que ficou na conta da NeoPower (de antes do split ou de clientes de outras redes).`
          : `Regra: o repasse ao dono é ${pct(percentCliente)}% do consumido em recargas. As taxas do Mercado Pago saem dos ${pct(comissaoPercent)}% da NeoPower.`,
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
    // Sem os campos do split (API antiga), a NeoPower repassa tudo.
    const recebidoNoSplit = row.recebidoNoSplit ?? 0;
    const aRepassar = row.aRepassar ?? repasse;
    return { receita, taxaMp, comissao, repasse, recebidoNoSplit, aRepassar, liquidoNeoPower: comissao - taxaMp };
  };

  // Somas em centavos: as linhas já vêm repartidas ao centavo pela API.
  const totals = (() => {
    const c = {
      energy: 0,
      revenue: 0,
      taxaMp: 0,
      comissao: 0,
      repasse: 0,
      recebidoNoSplit: 0,
      aRepassar: 0,
      revenueCruzadas: 0,
      repasseCruzadas: 0,
      aRepassarCruzadas: 0,
    };
    for (const row of reportData) {
      const v = valoresDaLinha(row);
      c.energy += parseFloat(row['Recarga (kWh)']) || 0;
      c.revenue += Math.round(v.receita * 100);
      c.taxaMp += Math.round(v.taxaMp * 100);
      c.comissao += Math.round(v.comissao * 100);
      c.repasse += Math.round(v.repasse * 100);
      c.recebidoNoSplit += Math.round(v.recebidoNoSplit * 100);
      c.aRepassar += Math.round(v.aRepassar * 100);
      if (row.recargaCruzada) {
        c.revenueCruzadas += Math.round(v.receita * 100);
        c.repasseCruzadas += Math.round(v.repasse * 100);
        c.aRepassarCruzadas += Math.round(v.aRepassar * 100);
      }
    }
    return {
      energy: c.energy,
      revenue: c.revenue / 100,
      taxaMp: c.taxaMp / 100,
      comissao: c.comissao / 100,
      repasse: c.repasse / 100,
      recebidoNoSplit: c.recebidoNoSplit / 100,
      aRepassar: c.aRepassar / 100,
      liquidoNeoPower: (c.comissao - c.taxaMp) / 100,
      revenueCruzadas: c.revenueCruzadas / 100,
      repasseCruzadas: c.repasseCruzadas / 100,
      // Cliente do app NeoPower numa rede que recebe o depósito dele direto
      // (Power Link): essa parte a rede já recebeu.
      aRepassarCruzadas: c.aRepassarCruzadas / 100,
    };
  })();
  const qtdCruzadas = reportData.filter(r => r.recargaCruzada).length;
  // Split ligado (ou recargas pagas com dinheiro que já caiu na conta do dono).
  const temSplit = !!resumo?.split?.ativo || totals.recebidoNoSplit > 0;
  const splitDesde = resumo?.split?.desde ? new Date(resumo.split.desde).toLocaleDateString('pt-BR') : null;

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

  // Tabelas em páginas (components/financeiro/Paginacao): com milhares de
  // recargas, desenhar todas travava a tela por quase um minuto.
  const paginaDoDetalhe = usePagina(visibleReportData);
  const paginaDoLocal = usePagina(relatorioDoLocal?.linhas ?? SEM_LINHAS_DO_LOCAL);
  // NFS-e: as recargas com nota e as do status escolhido.
  const notasRows = React.useMemo(
    () => reportData.filter(r => r.invoice_status && r.invoice_status !== 'NotRequired'),
    [reportData]
  );
  const notasDoFiltro = React.useMemo(
    () => (nfseFilter === 'all' ? notasRows : notasRows.filter(r => r.invoice_status === nfseFilter)),
    [notasRows, nfseFilter]
  );
  const paginaDasNotas = usePagina(notasDoFiltro);

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
    comissaoOculta,
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

  // Etiqueta do status da recarga: cor fixa de estado, com a bolinha e o texto.
  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    const etiqueta = (classe: string, bolinha: string) => (
      <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-[25px] text-xs font-semibold whitespace-nowrap ${classe}`}>
        <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${bolinha}`} />
        {status}
      </span>
    );
    if (statusLower.includes('conclu') || statusLower.includes('finish') || statusLower.includes('complet')) {
      return etiqueta('bg-estado-livre text-estado-livre-forte', 'bg-estado-livre-forte');
    }
    if (statusLower.includes('pend') || statusLower.includes('process')) {
      return etiqueta('bg-estado-problema text-estado-problema-forte', 'bg-estado-problema-forte');
    }
    if (statusLower.includes('cancel') || statusLower.includes('fail') || statusLower.includes('error')) {
      return etiqueta('bg-destructive/10 text-destructive', 'bg-destructive');
    }
    return etiqueta('bg-muted text-muted-foreground', 'bg-muted-foreground');
  };

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /** Percentual sem casas inuteis: 5 vira "5", 7,5 vira "7,5". */
  const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  if (loading && reportData.length === 0 && !tenantOverview) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Gerando relatório financeiro...</p>
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
      <div className="space-y-[25px] pb-12">
        <CabecalhoDaPagina
          titulo="Relatório financeiro"
          subtitulo="Consolidado de todos os whitelabels. Clique numa marca para abrir o relatório detalhado."
          detalhe={
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Período: {periodLabel}</span>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="inline-flex items-center gap-1 font-medium text-primary-strong hover:underline"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  Limpar período
                </button>
              )}
            </p>
          }
          filtros={
            <>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClear={() => { setStartDate(''); setEndDate(''); }}
                placeholder="Todo o período"
                className={`${classeDaPilula} justify-start`}
              />
              {/* Relatório de um local (inclusive os da plataforma), recarga a recarga. */}
              <SeletorDeLocal
                locais={locais}
                valor={null}
                onChange={selecionarLocal}
                mostrarMarca
                textoVazio="Relatório por local..."
                carregando={carregandoLocais}
                className={`${classeDaPilula} sm:w-[290px]`}
              />
            </>
          }
          acoes={
            <BotaoAtualizar
              aoAtualizar={() => void handleRefresh()}
              carregando={refreshing}
              atualizadoEm={atualizadoEm}
              falhou={falhou}
            />
          }
        />

        {/* ─── Consolidado da plataforma ─── */}
        <section aria-label="Consolidado da plataforma" className={`${classeDoCartao} p-6 3xl:p-[30px]`}>
          <CabecalhoDoCartao
            icone={<Simbolo nome="leaderboard" />}
            titulo="Consolidado da plataforma"
            subtitulo={periodLabel}
          />
          <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[clamp(2.25rem,3vw,3rem)] leading-none font-semibold tabular-nums text-foreground">
                R$ {fmt(entradaLiquida)}
              </p>
              <p className="text-[15px] font-medium text-muted-foreground mt-2">
                entrou no caixa (depósitos − devoluções)
              </p>
            </div>
            <div className="flex gap-8">
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Recargas</p>
                <p className="text-[28px] leading-tight font-semibold tabular-nums text-foreground">{agg.transactions}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Energia</p>
                <p className="text-[28px] leading-tight font-semibold tabular-nums text-foreground">
                  {fmt(agg.kWh)} <span className="text-base font-medium text-muted-foreground">kWh</span>
                </p>
              </div>
            </div>
          </div>

          {/* Barra de composição da entrada */}
          <div className="mt-6 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
              <span>Depósitos: R$ {fmt(entradaBruta)}</span>
              <span>Taxa Mercado Pago (absorvida pela NeoPower): R$ {fmt(taxaMp)}</span>
            </div>
            <div className="h-2.5 rounded-[5px] bg-muted overflow-hidden flex">
              <div
                className="bg-primary transition-all"
                style={{ width: `${pctNaConta}%` }}
                title={`Na conta: R$ ${fmt(naConta)}`}
              />
              <div
                className="bg-destructive/70 transition-all"
                style={{ width: `${pctTaxaMp}%` }}
                title={`Taxa Mercado Pago: R$ ${fmt(taxaMp)}`}
              />
              <div
                className="bg-estado-problema-forte/70 transition-all"
                style={{ width: `${pctDevolvido}%` }}
                title={`Devolvido: R$ ${fmt(devolvido)}`}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-primary" />
                Na conta ({pctNaConta.toFixed(0)}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-destructive/70" />
                Taxa Mercado Pago ({pctTaxaMp.toFixed(0)}%)
              </span>
              {devolvido > 0 && (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full bg-estado-problema-forte/70" />
                  Devolvido ({pctDevolvido.toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ─── Indicadores do consolidado ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[25px]">
          <CartaoDeIndicador
            tom="amarelo"
            icone={<IconeSvg src={iconeDepositos} tamanho={25} />}
            titulo="Entrada (depósitos)"
            subtitulo={periodLabel}
            valor={`R$ ${fmt(entradaBruta)}`}
          >
            {agg.deposits.count} depósito{agg.deposits.count === 1 ? '' : 's'} pago{agg.deposits.count === 1 ? '' : 's'} no período
          </CartaoDeIndicador>
          <CartaoDeIndicador
            tom="azul"
            icone={<Icone nome="kpi-energia" tamanho={26} />}
            titulo="Consumido em recargas"
            subtitulo={periodLabel}
            valor={`R$ ${fmt(agg.revenue)}`}
          >
            {agg.transactions} recarga{agg.transactions === 1 ? '' : 's'} · ticket R$ {fmt(agg.transactions > 0 ? agg.revenue / agg.transactions : 0)}
          </CartaoDeIndicador>
          <CartaoDeIndicador
            tom="marca"
            icone={<Simbolo nome="handshake" />}
            titulo="Repasse aos donos"
            subtitulo={periodLabel}
            valor={`R$ ${fmt(agg.net)}`}
            destaque
          >
            {pct(100 - comissaoPercent)}% do consumido · {activeTenants.length} marca{activeTenants.length === 1 ? '' : 's'} ativa{activeTenants.length === 1 ? '' : 's'}
          </CartaoDeIndicador>
          <CartaoDeIndicador
            tom="cinza"
            icone={<Simbolo nome="savings" />}
            titulo="Comissão NeoPower"
            subtitulo={periodLabel}
            valor={`R$ ${fmt(agg.fees)}`}
          >
            {pct(comissaoPercent)}% do consumido, bruta
          </CartaoDeIndicador>
          <CartaoDeIndicador
            tom="cinza"
            icone={<Simbolo nome="trending_down" />}
            titulo="Taxa Mercado Pago (absorvida)"
            subtitulo={periodLabel}
            valor={`R$ ${fmt(taxaMpAbsorvidaTotal)}`}
            negativo
          >
            proporcional ao consumo; sai dos {pct(comissaoPercent)}% da NeoPower (depósitos do período: R$ {fmt(taxaMp)})
          </CartaoDeIndicador>
          <CartaoDeIndicador
            tom="marca"
            icone={<Simbolo nome="account_balance" />}
            titulo="Líquido NeoPower"
            subtitulo={periodLabel}
            valor={`R$ ${fmt(liquidoNeoPowerTotal)}`}
            negativo={liquidoNeoPowerTotal < 0}
          >
            comissão − taxa Mercado Pago absorvida
          </CartaoDeIndicador>
        </div>

        {/* ─── Gráfico: top whitelabels por recargas ─── */}
        {topTenants.length > 0 && (
          <section aria-label="Top whitelabels por recargas" className={`${classeDoCartao} p-6 3xl:p-[30px]`}>
            <CabecalhoDoCartao
              icone={<Icone nome="grafico-barras" />}
              titulo="Top whitelabels por recargas"
              subtitulo={periodLabel}
              direita={<SeloDeContorno>Top {topTenants.length}</SeloDeContorno>}
            />
            <div className="w-full h-64 mt-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTenants} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `R$ ${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                  <YAxis type="category" dataKey="companyName" stroke="var(--color-muted-foreground)" fontSize={11} width={120} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px',
                      color: 'var(--color-foreground)',
                    }}
                    formatter={(v: number) => [`R$ ${fmt(v)}`, 'Receita']}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ─── Cartões por whitelabel ─── */}
        <section aria-label="Por whitelabel" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[20px] leading-tight font-semibold text-foreground">Por whitelabel</h2>
            <span className="text-sm text-muted-foreground">
              {activeTenants.length} whitelabels com carregador ou venda
            </span>
          </div>
          {activeTenants.length === 0 ? (
            <div className={classeDoCartao}>
              <Vazio
                titulo="Nenhuma movimentação financeira registrada"
                texto="Todos os whitelabels estão zerados para o período selecionado."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[25px]">
              {activeTenants.map(t => {
                const shareOfRevenue = agg.revenue > 0 ? (t.revenue / agg.revenue) * 100 : 0;
                const liquido = t.liquidoNeoPower ?? t.fees - (t.mpFee ?? 0);
                return (
                  <button
                    key={t.clientId}
                    type="button"
                    onClick={() => handleDrillDown(t.clientId)}
                    className={`${classeDoCartao} p-5 3xl:p-[22px] text-left transition hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <BlocoDeIcone>
                          <Simbolo nome="storefront" />
                        </BlocoDeIcone>
                        <div className="min-w-0">
                          <h3 className="text-[20px] leading-tight font-semibold text-foreground truncate">{t.companyName}</h3>
                          <p className="text-sm font-medium text-muted-foreground truncate">{t.clientId}</p>
                        </div>
                      </div>
                      <span aria-hidden="true" className="material-symbols-outlined text-muted-foreground group-hover:text-primary-strong group-hover:translate-x-1 transition-all">
                        chevron_right
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Consumido</p>
                        <p className="text-lg font-semibold tabular-nums text-foreground">R$ {fmt(t.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Repasse ao dono</p>
                        <p className="text-lg font-semibold tabular-nums text-primary-strong">R$ {fmt(t.net)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Comissão {pct(t.comissaoPercent ?? comissaoPercent)}%</p>
                        <p className="text-sm font-medium tabular-nums text-foreground">R$ {fmt(t.fees)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Taxa MP{t.taxaMpPercent != null ? ` ${pct(t.taxaMpPercent)}%` : ''}
                        </p>
                        <p className="text-sm font-medium tabular-nums text-destructive">R$ {fmt(t.mpFee ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Líquido NeoPower</p>
                        <p className={`text-sm font-medium tabular-nums ${liquido < 0 ? 'text-destructive' : 'text-foreground'}`}>
                          R$ {fmt(liquido)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Transações</p>
                        <p className="text-sm font-medium tabular-nums text-foreground">
                          {t.transactions}
                          {t.chargers != null && (
                            <span className="text-xs font-normal text-muted-foreground"> · {t.chargers} carregador{t.chargers === 1 ? '' : 'es'}</span>
                          )}
                        </p>
                      </div>
                      {/* Recarga cruzada: mesma comissão e repasse, sem taxa MP. */}
                      {(t.cruzadas?.quantidade ?? 0) > 0 && (
                        <p className="col-span-2 text-sm text-estado-problema-forte -mt-1">
                          R$ {fmt(t.cruzadas!.receita)} de clientes de outras redes ({t.cruzadas!.quantidade})
                        </p>
                      )}
                    </div>
                    <div className="h-2 rounded-[5px] bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${shareOfRevenue}%` }} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {shareOfRevenue.toFixed(1)}% do consumido
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Recorte que está na tela, para a linha embaixo do título.
  const temFiltro = !!(submittedFilter || localId != null || startDate || endDate);
  const recorte = [
    `Período: ${periodLabel}`,
    submittedFilter && `Estação: ${submittedFilter}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-[25px] pb-12">
      {/* Voltar — só quando o super admin abriu uma marca ou um local */}
      {isSuperAdmin && (drillDownClientId || localId != null) && (
        <button type="button" onClick={handleBackToOverview} className={classeDoBotaoContorno}>
          <span aria-hidden="true" className="material-symbols-outlined text-base">arrow_back</span>
          Voltar à visão geral das marcas
        </button>
      )}

      <CabecalhoDaPagina
        titulo={
          localId != null && localDoRelatorio
            ? `Relatório financeiro - ${localDoRelatorio.nome}`
            : drillDownClientId
              ? `Relatório financeiro - ${drillDownClientId}`
              : 'Relatório financeiro'
        }
        subtitulo={
          isAdmin
            ? 'Análise detalhada de receitas, custos e lucros'
            : `Relatório das suas estações (${userLocationNames.length} local/is)`
        }
        detalhe={
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{recorte}</span>
            {temFiltro && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 font-medium text-primary-strong hover:underline"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                Limpar filtros
              </button>
            )}
          </p>
        }
        filtros={
          <>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => { setStartDate(''); setEndDate(''); }}
              placeholder="Todo o período"
              className={`${classeDaPilula} justify-start`}
            />
            {/* Local: todas as recargas dos carregadores do local (repasse ao dono do local). */}
            <SeletorDeLocal
              locais={locaisDoSeletor}
              valor={localId}
              onChange={selecionarLocal}
              mostrarMarca={isSuperAdmin}
              carregando={carregandoLocais}
              className={`${classeDaPilula} sm:w-[290px]`}
            />
          </>
        }
        acoes={
          <BotaoAtualizar
            aoAtualizar={() => void handleRefresh()}
            carregando={refreshing}
            atualizadoEm={atualizadoEm}
            falhou={falhou}
          />
        }
      />

      {/* Estação e exportação */}
      <BarraDeFiltros>
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <CampoDeBusca
            placeholder="Filtrar por ID da estação..."
            aria-label="ID da estação"
            value={filterId}
            onChange={e => setFilterId(e.target.value)}
          />
          <button type="submit" className={classeDoBotaoContorno}>
            <span aria-hidden="true" className="material-symbols-outlined text-lg">search</span>
            Filtrar
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={reportData.length === 0}
            className={classeDoBotaoContorno}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">download</span>
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={reportData.length === 0}
            className={classeDoBotaoContorno}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">table_view</span>
            Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={pdfLoading}
            className={classeDoBotaoVerde}
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-lg ${pdfLoading ? 'animate-spin' : ''}`}>
              {pdfLoading ? 'refresh' : 'picture_as_pdf'}
            </span>
            Exportar PDF
          </button>
        </div>
      </BarraDeFiltros>

      {/* API sem o relatório por local: os números abaixo seriam da marca inteira. */}
      {localId != null && !loading && !localDoRelatorio && reportData.length > 0 && (
        <div role="status" className="rounded-[15px] bg-estado-problema text-estado-problema-forte px-5 py-4 text-sm font-medium flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined">warning</span>
          A API ainda não tem o relatório por local: os números abaixo são da marca inteira, não do local escolhido.
        </div>
      )}

      {/* ─── Relatório do local: recarga a recarga, para o repasse ao dono do local ─── */}
      {relatorioDoLocal && (() => {
        const rel = relatorioDoLocal;
        const iEnergia = rel.colunas.findIndex(c => c.chave === 'energia');
        const kwh = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (
          <section aria-label="Relatório do local" className={`${classeDoCartao} overflow-hidden`}>
            <div className="px-6 py-5 border-b border-border">
              <CabecalhoDoCartao
                icone={<Icone nome="recibo" />}
                titulo={rel.titulo}
                subtitulo={rel.cabecalho.map(linha => (
                  <p key={linha}>{linha}</p>
                ))}
                direita={
                  <>
                    <button
                      type="button"
                      onClick={() => exportarDoLocal('pdf')}
                      disabled={exportandoLocal != null}
                      className={classeDoBotaoVerde}
                    >
                      <span aria-hidden="true" className={`material-symbols-outlined text-lg ${exportandoLocal === 'pdf' ? 'animate-spin' : ''}`}>
                        {exportandoLocal === 'pdf' ? 'refresh' : 'picture_as_pdf'}
                      </span>
                      PDF do local
                    </button>
                    <button
                      type="button"
                      onClick={() => exportarDoLocal('xlsx')}
                      disabled={exportandoLocal != null}
                      className={classeDoBotaoContorno}
                    >
                      <span aria-hidden="true" className={`material-symbols-outlined text-lg ${exportandoLocal === 'xlsx' ? 'animate-spin' : ''}`}>
                        {exportandoLocal === 'xlsx' ? 'refresh' : 'table_view'}
                      </span>
                      Excel do local
                    </button>
                  </>
                }
              />
              {!rel.comissaoOculta && (
                <p className="text-sm text-muted-foreground mt-3 max-w-4xl">
                  <strong className="font-semibold text-foreground">Comissão:</strong> {rel.regraDoRepasse}
                </p>
              )}
            </div>
            {carregadoresDoLocal.length > 1 && (
              <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground mr-1">PDF por carregador</span>
                {carregadoresDoLocal.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => exportarDoLocal({ carregador: c.id })}
                    disabled={exportandoLocal != null || c.linhas.length === 0}
                    title={c.linhas.length === 0 ? 'Sem recargas no período' : `${c.id}: ${c.linhas.length} recarga${c.linhas.length === 1 ? '' : 's'}`}
                    className={`${classeDoBotaoContorno} disabled:cursor-not-allowed`}
                  >
                    <span aria-hidden="true" className={`material-symbols-outlined text-base ${exportandoLocal === c.id ? 'animate-spin' : ''}`}>
                      {exportandoLocal === c.id ? 'refresh' : 'picture_as_pdf'}
                    </span>
                    {c.nome}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => exportarDoLocal('zip')}
                  disabled={exportandoLocal != null || rel.linhas.length === 0}
                  className={`${classeDoBotaoContorno} disabled:cursor-not-allowed`}
                >
                  <span aria-hidden="true" className={`material-symbols-outlined text-base ${exportandoLocal === 'zip' ? 'animate-spin' : ''}`}>
                    {exportandoLocal === 'zip' ? 'refresh' : 'folder_zip'}
                  </span>
                  Todos (.zip)
                </button>
              </div>
            )}
            <div className="overflow-x-auto px-4 pb-2">
              <table className={classeDaTabela}>
                <thead>
                  <tr>
                    {rel.colunas.map(c => (
                      <th
                        key={c.chave}
                        className={`${classeDoTh} pt-3 ${ALINHAR[c.alinhar]}`}
                      >
                        {c.titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rel.linhas.length > 0 ? (
                    paginaDoLocal.itens.map(l => (
                      <tr key={l.numero}>
                        {rel.colunas.map(c => (
                          <td
                            key={c.chave}
                            className={`${classeDaCelula} ${
                              // Conta interna (NeoPower) continua em laranja.
                              l.contaInterna ? 'bg-orange-500/15' : fundoDaLinha
                            } tabular-nums whitespace-nowrap ${ALINHAR[c.alinhar]} ${
                              c.chave === 'conferencia' && conferenciaComProblema(l)
                                ? 'text-destructive font-semibold'
                                : 'text-foreground'
                            }`}
                          >
                            {c.texto(l)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={rel.colunas.length} className={`${classeDaCelula} ${fundoDaLinha} text-center py-10 text-muted-foreground`}>
                        Nenhuma recarga neste local no período.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  {rel.subtotais.map(st => {
                    const valores: Record<string, string> = {
                      energia: kwh(st.valores.energiaKwh),
                      cobrado: reaisOuTraco(st.valores.valorCobrado),
                      debito: reaisOuTraco(st.valores.debitoCarteira),
                      conferencia: st.conferencia,
                      comissao: reaisOuTraco(st.valores.comissao),
                      repasse: reaisOuTraco(st.valores.repasse),
                    };
                    return (
                      <tr key={st.rotulo}>
                        <td colSpan={iEnergia} className={`${classeDaCelula} bg-primary/25 font-semibold text-foreground whitespace-nowrap`}>
                          {st.rotulo}
                        </td>
                        {rel.colunas.slice(iEnergia).map(c => (
                          <td
                            key={c.chave}
                            className={`${classeDaCelula} bg-primary/25 font-semibold tabular-nums whitespace-nowrap ${ALINHAR[c.alinhar]} ${
                              c.chave === 'repasse' ? 'text-primary-strong' : 'text-foreground'
                            }`}
                          >
                            {valores[c.chave] ?? ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tfoot>
              </table>
            </div>
            <Paginacao
              pagina={paginaDoLocal.pagina}
              total={paginaDoLocal.total}
              quantidade={rel.linhas.length}
              rotulo="recargas"
              aoMudar={paginaDoLocal.irPara}
            />
            <div className="px-6 py-4 border-t border-border">
              <p className="text-sm font-semibold text-foreground mb-1.5">Notas</p>
              <ul className="space-y-1">
                {rel.notas.map(nota => (
                  <li key={nota} className="text-sm text-muted-foreground">• {nota}</li>
                ))}
              </ul>
            </div>
          </section>
        );
      })()}

      {/* ─── Repasse por recarga ─── */}
      {comissaoOculta ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-[25px]">
          <CartaoDoRepasse
            icone="bolt"
            cor="azul"
            titulo="Consumido em recargas"
            subtitulo={periodLabel}
            valor={`R$ ${fmt(consumido)}`}
            detalhe={`${reportData.length} recarga${reportData.length === 1 ? '' : 's'}`}
          />
        </div>
      ) : (
      <section aria-label="Repasse ao dono por recarga" className="space-y-[18px]">
        <div className="flex items-start gap-4 3xl:gap-[18px]">
          <BlocoDeIcone>
            <Simbolo nome="payments" />
          </BlocoDeIcone>
          <div className="min-w-0">
            <h2 className="text-[20px] leading-tight font-semibold text-foreground">
              Repasse ao dono por recarga
            </h2>
            <p className="text-[15px] text-muted-foreground mt-1 max-w-5xl">
              O repasse ao dono é <strong className="font-semibold text-foreground">{pct(percentCliente)}% do que foi consumido em recargas</strong>: o
              saldo parado na carteira é do cliente até ele usar.{' '}
              {temSplit ? (
                <>
                  Com o split{splitDesde ? ` (desde ${splitDesde})` : ''}, o crédito que o cliente coloca cai direto
                  na conta Mercado Pago do dono, já sem a comissão: a NeoPower repassa só as recargas pagas com saldo
                  que ficou na conta da NeoPower (de antes do split ou de clientes de outras redes).
                </>
              ) : (
                <>As taxas do Mercado Pago saem dos {pct(comissaoPercent)}% da NeoPower.</>
              )}
              {(submittedFilter || localId != null) && mostraCaixa && ' Com o filtro de estação ou de local, "Entrou no caixa" e o saldo continuam sendo da marca inteira.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-[25px]">
          {mostraCaixa && (
            <CartaoDoRepasse
              icone="account_balance"
              cor="amarelo"
              titulo="Entrou no caixa"
              subtitulo={periodLabel}
              valor={`R$ ${fmt(entrouNoCaixa)}`}
              detalhe={
                <>
                  Depósitos R$ {fmt(depositosPagos)} − devoluções R$ {fmt(totalDevolvido)}
                  {veCustoDaPlataforma && (
                    <span className="block">
                      O Mercado Pago reteve R$ {fmt(mercadoPagoFeeDeposits)} desses depósitos (custo da NeoPower)
                    </span>
                  )}
                  {totalCreditosSemPagamento > 0 && (
                    <span className="block">Créditos manuais/migração (R$ {fmt(totalCreditosSemPagamento)}) não são entrada</span>
                  )}
                </>
              }
            />
          )}
          <CartaoDoRepasse
            icone="bolt"
            cor="azul"
            titulo="Consumido em recargas"
            subtitulo={periodLabel}
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
            cor="cinza"
            titulo={`Comissão NeoPower ${pct(comissaoPercent)}%`}
            subtitulo={periodLabel}
            valor={`R$ ${fmt(comissaoNeoPower)}`}
            detalhe={`${pct(comissaoPercent)}% do consumido`}
          />
          <CartaoDoRepasse
            icone="handshake"
            titulo="Repasse ao dono"
            subtitulo={periodLabel}
            valor={`R$ ${fmt(repasseAoDono)}`}
            destaque={!temSplit}
            detalhe={
              <>
                {temSplit ? `${pct(percentCliente)}% do consumido` : `Valor a pagar: ${pct(percentCliente)}% do consumido`}
                {qtdCruzadas > 0 && (
                  <span className="block">
                    Inclui R$ {fmt(totals.repasseCruzadas)} de clientes de outras redes{temSplit ? '' : ' (acerto manual)'}
                  </span>
                )}
              </>
            }
          />
          {temSplit && (
            <CartaoDoRepasse
              icone="call_split"
              cor="azul"
              titulo="Já recebido no split"
              subtitulo={periodLabel}
              valor={`R$ ${fmt(totals.recebidoNoSplit)}`}
              detalhe="Recargas pagas com crédito que caiu direto na conta Mercado Pago do dono. Não entra no repasse."
            />
          )}
          {temSplit && (
            <CartaoDoRepasse
              icone="send_money"
              titulo="A NeoPower repassa"
              subtitulo={periodLabel}
              valor={`R$ ${fmt(totals.aRepassar)}`}
              destaque
              detalhe={
                <>
                  Valor a pagar: recargas pagas com saldo que ficou na conta da NeoPower
                  {totals.aRepassarCruzadas > 0 &&
                    `, R$ ${fmt(totals.aRepassarCruzadas)} delas de clientes de outras redes`}
                </>
              }
            />
          )}
          {mostraCaixa && (
            <CartaoDoRepasse
              icone="account_balance_wallet"
              cor="amarelo"
              titulo="Saldo de clientes a consumir"
              subtitulo={
                saldoClientes
                  ? saldoClientes.fonte === 'carteiras-agora'
                    ? 'Hoje'
                    : `Fim do período (${new Date(saldoClientes.em).toLocaleDateString('pt-BR')})`
                  : undefined
              }
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
                      <span className="block font-medium text-estado-problema-forte">Clientes devendo: R$ {fmt(saldoClientes.devedor)}</span>
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
              cor="cinza"
              titulo="Taxa Mercado Pago (absorvida pela NeoPower)"
              subtitulo={periodLabel}
              valor={`−R$ ${fmt(totals.taxaMp)}`}
              tom="negativo"
              detalhe={
                <>
                  {pct(taxaMpPercent)}% efetiva sobre o consumo · {textoDaFonteDaTaxa}. Não reduz o repasse.
                  {qtdCruzadas > 0 && (
                    <span className="block">Recargas de outras redes ficam sem (a taxa ficou no depósito da rede do cliente)</span>
                  )}
                </>
              }
            />
          )}
          {veCustoDaPlataforma && (
            <CartaoDoRepasse
              icone="account_balance"
              titulo="Líquido NeoPower"
              subtitulo={periodLabel}
              valor={`R$ ${fmt(totals.liquidoNeoPower)}`}
              tom={totals.liquidoNeoPower < 0 ? 'negativo' : undefined}
              detalhe="Comissão − taxa do Mercado Pago absorvida"
            />
          )}
        </div>

        {/* Para onde vai o consumido */}
        {consumido > 0 && (
          <div className={`${classeDoCartao} p-5 3xl:p-[22px]`}>
            <div className="h-2.5 rounded-[5px] bg-muted overflow-hidden flex">
              <div className="bg-tom-azul-icone transition-all" style={{ width: `${(repasseAoDono / consumido) * 100}%` }} title={`Repasse: R$ ${fmt(repasseAoDono)}`} />
              {veCustoDaPlataforma ? (
                <>
                  <div className="bg-primary transition-all" style={{ width: `${(Math.max(0, totals.liquidoNeoPower) / consumido) * 100}%` }} title={`Líquido NeoPower: R$ ${fmt(totals.liquidoNeoPower)}`} />
                  <div className="bg-destructive/70 transition-all" style={{ width: `${(Math.min(totals.taxaMp, comissaoNeoPower) / consumido) * 100}%` }} title={`Taxa MP: R$ ${fmt(totals.taxaMp)}`} />
                </>
              ) : (
                <div className="bg-primary transition-all" style={{ width: `${(comissaoNeoPower / consumido) * 100}%` }} title={`Comissão: R$ ${fmt(comissaoNeoPower)}`} />
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-2 h-2 rounded-full bg-tom-azul-icone" />Dono ({((repasseAoDono / consumido) * 100).toFixed(1)}%)</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-2 h-2 rounded-full bg-primary" />NeoPower ({((comissaoNeoPower / consumido) * 100).toFixed(1)}%)</span>
              {veCustoDaPlataforma && (
                <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-2 h-2 rounded-full bg-destructive/70" />dos quais taxa MP ({((totals.taxaMp / consumido) * 100).toFixed(1)}%)</span>
              )}
            </div>
          </div>
        )}
      </section>
      )}

      {/* ─── Seção Recargas de outras redes (Recarga Cruzada) ─── */}
      {!comissaoOculta && recargasCruzadas && (recargasCruzadas.recebidas.quantidade > 0 || recargasCruzadas.aRepassar.quantidade > 0) && (
        <section aria-label="Recargas de outras redes" className={`${classeDoCartao} p-6 3xl:p-[30px] space-y-5`}>
          <CabecalhoDoCartao
            icone={<Simbolo nome="sync_alt" />}
            titulo="Recargas de outras redes"
            subtitulo="Sessões realizadas de forma cruzada entre marcas parceiras"
            direita={<SeloDeContorno>Recarga Cruzada</SeloDeContorno>}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* A receber */}
            <div className="p-5 rounded-[10px] bg-muted/60 dark:bg-muted/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-foreground">A receber (postos próprios)</p>
                  <p className="text-[28px] leading-tight font-semibold tabular-nums text-primary-strong mt-1">
                    R$ {fmt(recargasCruzadas.recebidas.valorRepasse ?? recargasCruzadas.recebidas.valorBruto * (percentCliente / 100))}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {pct(percentCliente)}% do consumido, após {pct(comissaoPercent)}% NeoPower (Bruto: R$ {fmt(recargasCruzadas.recebidas.valorBruto)})
                  </p>
                </div>
                <span aria-hidden="true" className="w-[41px] h-[38px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">call_received</span>
                </span>
              </div>
              <div className="pt-3 border-t border-border space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">Por rede de origem ({recargasCruzadas.recebidas.quantidade} sessões):</p>
                {recargasCruzadas.recebidas.porRede.length > 0 ? (
                  recargasCruzadas.recebidas.porRede.map(item => (
                    <div key={item.nome ?? item.rede} className="flex justify-between items-center gap-3 text-sm py-1.5 px-3 rounded-[5px] bg-card">
                      <span className="font-medium text-foreground">{item.nome ?? item.rede}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {item.quantidade} {item.quantidade === 1 ? 'sessão' : 'sessões'} · R$ {fmt(item.valorBruto * (percentCliente / 100))} líq.
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma sessão no período.</p>
                )}
              </div>
            </div>

            {/* A repassar */}
            <div className="p-5 rounded-[10px] bg-muted/60 dark:bg-muted/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-foreground">A repassar (postos parceiros)</p>
                  <p className="text-[28px] leading-tight font-semibold tabular-nums text-estado-problema-forte mt-1">
                    R$ {fmt(recargasCruzadas.aRepassar.valorBruto)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Valor a acertar com redes parceiras
                  </p>
                </div>
                <span aria-hidden="true" className="w-[41px] h-[38px] rounded-[5px] bg-estado-problema text-estado-problema-forte flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">call_made</span>
                </span>
              </div>
              <div className="pt-3 border-t border-border space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">Por rede de destino ({recargasCruzadas.aRepassar.quantidade} sessões):</p>
                {recargasCruzadas.aRepassar.porRede.length > 0 ? (
                  recargasCruzadas.aRepassar.porRede.map(item => (
                    <div key={item.nome ?? item.rede} className="flex justify-between items-center gap-3 text-sm py-1.5 px-3 rounded-[5px] bg-card">
                      <span className="font-medium text-foreground">{item.nome ?? item.rede}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {item.quantidade} {item.quantidade === 1 ? 'sessão' : 'sessões'} · R$ {fmt(item.valorBruto)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma sessão no período.</p>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <span aria-hidden="true" className="material-symbols-outlined text-base">info</span>
            Já incluídas no consumido e no repasse acima: comissão de {pct(comissaoPercent)}% e repasse de {pct(percentCliente)}%, como as demais. O acerto entre redes é manual.
          </p>
        </section>
      )}

      {/* Conta de luz do operador. Com filtro de estação, o repasse acima é só de uma. */}
      {!overviewMode && !submittedFilter && (
        <ResumoDoCustoDeEnergia
          inicio={startDate}
          fim={endDate}
          locationId={localId}
          clientId={drillDownClientId}
          repasse={resumo?.recargas?.repasse ?? null}
        />
      )}

      {/* Non-admin: Info + resumo */}
      {!isAdmin && (
        <section aria-label="Suas estações" className={`${classeDoCartao} p-5 3xl:p-[22px] space-y-4`}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="material-symbols-outlined text-primary-strong text-xl">info</span>
            <p className="text-[15px] text-muted-foreground">
              Exibindo apenas transações das estações vinculadas ao seu perfil.
              {userLocationNames.length > 0 && (
                <span> Locais: {userLocationNames.join(', ')}</span>
              )}
            </p>
          </div>
          <div className="max-w-xs">
            <NumeroMiudo rotulo="Energia total" valor={`${totals.energy.toFixed(2)} kWh`} />
          </div>
        </section>
      )}

      {/* Admin Only: Depósitos em Carteira */}
      {isAdmin && (
        <section aria-label="Depósitos em carteira" className={`${classeDoCartao} overflow-hidden`}>
          <div className="px-6 py-5 border-b border-border">
            <CabecalhoDoCartao
              tom="amarelo"
              icone={<IconeSvg src={iconeDepositos} tamanho={25} />}
              titulo="Depósitos em Carteira"
              subtitulo={
                <>
                  Valores depositados pelos clientes da marca (Pix/Cartão)
                  {veCustoDaPlataforma && ' — Taxa Mercado Pago por método (Pix 0,99% · crédito 4,99% · débito 3,99%), absorvida pela NeoPower'}
                </>
              }
            />
          </div>
          <div className="p-6">
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${veCustoDaPlataforma ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-4 mb-6`}>
              <NumeroMiudo
                rotulo="Total de depósitos"
                valor={`R$ ${fmt(depositosPagos)}`}
                detalhe={`${qtdDepositos} depósito${qtdDepositos === 1 ? '' : 's'} pago${qtdDepositos === 1 ? '' : 's'}`}
              />
              {/* Custo da plataforma: só a NeoPower vê a taxa do Mercado Pago. */}
              {veCustoDaPlataforma && (
                <NumeroMiudo
                  rotulo="Taxa Mercado Pago"
                  valor={`-R$ ${fmt(mercadoPagoFeeDeposits)}`}
                  negativo
                  detalhe="por método, absorvida pela NeoPower"
                />
              )}
              <NumeroMiudo
                rotulo="Entrou no caixa"
                valor={`R$ ${fmt(entrouNoCaixa)}`}
                destaque
                detalhe={`Depósitos − devoluções${totalDevolvido > 0 ? ` (R$ ${fmt(totalDevolvido)} devolvidos)` : ''}`}
              />
              <NumeroMiudo
                rotulo="Média por depósito"
                valor={`R$ ${qtdDepositos > 0 ? fmt(depositosPagos / qtdDepositos) : '0,00'}`}
                detalhe="Valor médio"
              />
            </div>
            {totalCreditosSemPagamento > 0 && (
              <p className="text-sm text-muted-foreground -mt-3 mb-4">
                Créditos manuais/migração no período: R$ {fmt(totalCreditosSemPagamento)} (movem saldo, não são entrada).
              </p>
            )}

            {deposits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className={classeDaTabela}>
                  <thead>
                    <tr>
                      <th className={`${classeDoTh} text-left`}>Usuário</th>
                      <th className={`${classeDoTh} text-left`}>Data</th>
                      <th className={`${classeDoTh} text-right`}>Valor</th>
                      {veCustoDaPlataforma && (
                        <>
                          <th className={`${classeDoTh} text-right`}>Taxa MP</th>
                          <th className={`${classeDoTh} text-right`}>Líquido</th>
                        </>
                      )}
                      <th className={`${classeDoTh} text-left`}>Referência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.slice(0, 10).map((deposit) => (
                      <tr key={deposit.id}>
                        <td className={`${classeDaCelula} ${fundoDaLinha}`}>
                          <p className="font-semibold text-foreground">{deposit.userName}</p>
                          <p className="text-xs text-muted-foreground">{deposit.userEmail}</p>
                        </td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-muted-foreground`}>{new Date(deposit.createdAt).toLocaleString('pt-BR')}</td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-foreground`}>R$ {fmt(deposit.amount)}</td>
                        {veCustoDaPlataforma && (
                          <>
                            <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-destructive`}>-R$ {fmt(taxaMpDoDeposito(deposit))}</td>
                            <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-primary-strong`}>R$ {fmt(deposit.amount - taxaMpDoDeposito(deposit))}</td>
                          </>
                        )}
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-muted-foreground`}>{deposit.referenceId || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {deposits.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">Mostrando 10 de {deposits.length} depósitos</p>
                )}
              </div>
            ) : (
              <Vazio titulo="Nenhum depósito encontrado no período." />
            )}
          </div>
        </section>
      )}

      {/* ─── Seção NFS-e ──────────────────────────────────────────────────────────── */}
      {isAdmin && (() => {
        // Transações que têm dados de NFS-e (notasRows e notasDoFiltro, lá em cima)
        const emitidas  = notasRows.filter(r => r.invoice_status === 'Issued').length;
        const pendentes = notasRows.filter(r => r.invoice_status === 'Pending').length;
        const erros     = notasRows.filter(r => r.invoice_status === 'Error').length;

        const filtered = notasDoFiltro;

        // Etiqueta do status da nota: ícone e texto, não só a cor.
        const getNfseStatusBadge = (status: string) => {
          const etiqueta = (classe: string, icone: string, texto: string) => (
            <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-[25px] text-xs font-semibold whitespace-nowrap ${classe}`}>
              <span aria-hidden="true" className="material-symbols-outlined text-sm">{icone}</span>
              {texto}
            </span>
          );
          if (status === 'Issued') return etiqueta('bg-estado-livre text-estado-livre-forte', 'check_circle', 'Emitida');
          if (status === 'Pending') return etiqueta('bg-estado-problema text-estado-problema-forte', 'schedule', 'Pendente');
          if (status === 'Error') return etiqueta('bg-destructive/10 text-destructive', 'error', 'Erro');
          return etiqueta('bg-muted text-muted-foreground', 'help', status);
        };

        return (
          <section aria-label="Notas Fiscais de Serviço (NFS-e)" className={`${classeDoCartao} overflow-hidden`}>
            <div className="px-6 py-5 border-b border-border">
              <CabecalhoDoCartao
                icone={<Icone nome="recibo" />}
                titulo="Notas Fiscais de Serviço (NFS-e)"
                subtitulo={`${notasRows.length} nota(s) no período • Emissão automática por recarga`}
                direita={[
                  { label: 'Emitidas', count: emitidas, classe: 'bg-estado-livre text-estado-livre-forte' },
                  { label: 'Pendentes', count: pendentes, classe: 'bg-estado-problema text-estado-problema-forte' },
                  { label: 'Erros', count: erros, classe: 'bg-destructive/10 text-destructive' },
                ].map(kpi => (
                  <div key={kpi.label} className={`min-w-[84px] px-4 py-2 rounded-[10px] flex flex-col items-center ${kpi.classe}`}>
                    <span className="text-xl font-semibold tabular-nums">{kpi.count}</span>
                    <span className="text-xs font-medium">{kpi.label}</span>
                  </div>
                ))}
              />
            </div>

            {/* Filtro por status */}
            <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground mr-1">Filtrar:</span>
              {(['all', 'Issued', 'Pending', 'Error'] as const).map(f => (
                <ChipDeFiltro key={f} ativo={nfseFilter === f} onClick={() => setNfseFilter(f)}>
                  {f === 'all' ? 'Todas' : f === 'Issued' ? 'Emitidas' : f === 'Pending' ? 'Pendentes' : 'Com Erro'}
                </ChipDeFiltro>
              ))}
            </div>

            {/* Tabela de Notas */}
            <div className="overflow-x-auto px-4 py-2">
              {filtered.length === 0 ? (
                <Vazio
                  titulo={
                    notasRows.length === 0
                      ? 'Nenhuma emissão de NFS-e no período. Configure o provider no cadastro dos postos.'
                      : `Nenhuma nota com status "${nfseFilter}" no período.`
                  }
                />
              ) : (
                <table className={classeDaTabela}>
                  <thead>
                    <tr>
                      <th className={`${classeDoTh} text-left`}>Número NF</th>
                      <th className={`${classeDoTh} text-left`}>Estação</th>
                      <th className={`${classeDoTh} text-left`}>Data/Hora</th>
                      <th className={`${classeDoTh} text-right`}>Valor (R$)</th>
                      <th className={`${classeDoTh} text-right`}>Energia</th>
                      <th className={`${classeDoTh} text-center`}>Status NF</th>
                      <th className={`${classeDoTh} text-center`}>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginaDasNotas.itens.map((row, i) => (
                      <tr key={i}>
                        <td className={`${classeDaCelula} ${fundoDaLinha}`}>
                          <span className="font-mono text-xs text-foreground">
                            {row.invoice_id || '—'}
                          </span>
                        </td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} font-semibold text-foreground max-w-[160px] truncate`}>{row['Estação']}</td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-muted-foreground`}>{row['Início']}</td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-primary-strong`}>R$ {row['Receita (R$)']}</td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-foreground`}>{row['Recarga (kWh)']} kWh</td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-center`}>{getNfseStatusBadge(row.invoice_status || '')}</td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-center`}>
                          {row.invoice_pdf_url ? (
                            <a
                              href={row.invoice_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 h-8 px-3 rounded-[25px] bg-primary-soft text-primary-strong text-xs font-semibold hover:brightness-95 transition"
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-sm">picture_as_pdf</span>
                              PDF
                            </a>
                          ) : row.invoice_status === 'Issued' ? (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} className={`${classeDaCelula} bg-primary/25 text-muted-foreground font-medium`}>
                          Total: {filtered.length} nota(s)
                        </td>
                        <td className={`${classeDaCelula} bg-primary/25 text-right tabular-nums font-semibold text-primary-strong`}>
                          R$ {fmt(filtered.reduce((s, r) => s + (parseFloat(r['Receita (R$)']) || 0), 0))}
                        </td>
                        <td className={`${classeDaCelula} bg-primary/25 text-right tabular-nums font-semibold text-foreground`}>
                          {filtered.reduce((s, r) => s + (parseFloat(r['Recarga (kWh)']) || 0), 0).toFixed(2)} kWh
                        </td>
                        <td colSpan={2} className={`${classeDaCelula} bg-primary/25`} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
            <Paginacao
              pagina={paginaDasNotas.pagina}
              total={paginaDasNotas.total}
              quantidade={filtered.length}
              rotulo="notas"
              aoMudar={paginaDasNotas.irPara}
            />
          </section>
        );
      })()}

      {/* Daily Evolution Chart */}
      {!overviewMode && dailyData.length > 0 && (
        <section aria-label="Evolução diária de receita e consumo" className={`${classeDoCartao} p-6 3xl:p-[30px]`}>
          <CabecalhoDoCartao
            icone={<Icone nome="grafico-linha" />}
            titulo="Evolução Diária de Receita e Consumo"
            subtitulo="Desempenho financeiro e energético ao longo do período selecionado"
          />
          <div className="w-full h-72 mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `${v} kWh`} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    color: 'var(--color-foreground)',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'revenue') return [`R$ ${fmt(Number(value))}`, 'Receita'];
                    return [`${Number(value).toFixed(2)} kWh`, 'Consumo'];
                  }}
                  labelStyle={{ color: 'var(--color-foreground)', fontWeight: 'bold' }}
                />
                <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#colorRevenue)" stroke="var(--primary)" strokeWidth={2} name="revenue" />
                <Line yAxisId="right" type="monotone" dataKey="energy" stroke="var(--tom-azul-icone)" strokeWidth={2} dot={dailyData.length < 30} activeDot={{ r: 6 }} name="energy" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Data Table (com um local escolhido, o relatório do local acima substitui; sem montar a tabela escondida) */}
      {!relatorioDoLocal && (
      <section aria-label="Detalhamento por transação" className={`${classeDoCartao} overflow-hidden`}>
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-[20px] leading-tight font-semibold text-foreground">Detalhamento por Transação</h2>
          <p className="text-[15px] font-medium text-muted-foreground mt-0.5">
            {visibleReportData.length} {visibleReportData.length === 1 ? 'registro encontrado' : 'registros encontrados'}
          </p>
        </div>
        <div className="overflow-x-auto px-4 pb-2">
          <table className={classeDaTabela}>
            <thead>
              <tr>
                <th className={`${classeDoTh} pt-3 text-left`}>Estação</th>
                <th className={`${classeDoTh} pt-3 text-left`}>Cliente</th>
                <th className={`${classeDoTh} pt-3 text-left`}>Início</th>
                <th className={`${classeDoTh} pt-3 text-left`}>Fim</th>
                <th className={`${classeDoTh} pt-3 text-right`}>Energia</th>
                <th className={`${classeDoTh} pt-3 text-right`}>Consumido</th>
                {!comissaoOculta && (
                  <>
                    <th className={`${classeDoTh} pt-3 text-right`}>Comissão</th>
                    <th className={`${classeDoTh} pt-3 text-right`}>Repasse</th>
                  </>
                )}
                {veCustoDaPlataforma && (
                  <>
                    <th className={`${classeDoTh} pt-3 text-right`} title="Taxa do Mercado Pago proporcional ao consumo, absorvida pela NeoPower">Taxa MP</th>
                    <th className={`${classeDoTh} pt-3 text-right`}>Líquido NeoPower</th>
                  </>
                )}
                <th className={`${classeDoTh} pt-3 text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleReportData.length > 0 ? (
                paginaDoDetalhe.itens.map((row, index) => {
                  const v = valoresDaLinha(row);
                  return (
                  <tr key={row.transaction_id ?? row.numero ?? index}>
                    <td className={`${classeDaCelula} ${fundoDaLinha} font-semibold text-foreground`}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{row['Estação']}</span>
                        {row.recargaCruzada && (
                          <span className="px-2 py-0.5 rounded-[25px] text-[11px] font-semibold bg-estado-problema text-estado-problema-forte" title={`Recarga Cruzada - Rede: ${row.redeDoCliente || 'Outra rede'}`}>
                            Cliente {row.redeDoCliente || 'outra rede'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${classeDaCelula} ${fundoDaLinha} text-foreground`}>
                      {row.clienteNome || row.cliente || '—'}
                    </td>
                    <td className={`${classeDaCelula} ${fundoDaLinha} text-muted-foreground whitespace-nowrap`}>{row['Início']}</td>
                    <td className={`${classeDaCelula} ${fundoDaLinha} text-muted-foreground whitespace-nowrap`}>{row['Fim'] || '—'}</td>
                    <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-foreground`}>{row['Recarga (kWh)']} kWh</td>
                    <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums font-medium text-primary-strong`}>R$ {fmt(v.receita)}</td>
                    {!comissaoOculta && (
                      <>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-muted-foreground`}>R$ {fmt(v.comissao)}</td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-foreground`}>R$ {fmt(v.repasse)}</td>
                      </>
                    )}
                    {veCustoDaPlataforma && (
                      <>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-destructive`}>R$ {fmt(v.taxaMp)}</td>
                        <td className={`${classeDaCelula} ${fundoDaLinha} text-right tabular-nums text-muted-foreground`}>R$ {fmt(v.liquidoNeoPower)}</td>
                      </>
                    )}
                    <td className={`${classeDaCelula} ${fundoDaLinha} text-center`}>{getStatusBadge(row['Status'])}</td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7 + (comissaoOculta ? 0 : 2) + (veCustoDaPlataforma ? 2 : 0)} className="pt-2">
                    <Vazio
                      titulo={
                        !isAdmin && userLocationNames.length === 0
                          ? 'Nenhuma estação vinculada ao seu perfil.'
                          : 'Nenhum dado encontrado para os filtros selecionados.'
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Paginacao
          pagina={paginaDoDetalhe.pagina}
          total={paginaDoDetalhe.total}
          quantidade={visibleReportData.length}
          rotulo="recargas"
          aoMudar={paginaDoDetalhe.irPara}
        />

        {visibleReportData.length > 0 && (
          <div className="px-6 py-5 border-t border-border">
            <div className={`grid grid-cols-2 ${veCustoDaPlataforma ? 'md:grid-cols-4 2xl:grid-cols-7' : 'md:grid-cols-5'} gap-4`}>
              <NumeroMiudo rotulo="Total de transações" valor={visibleReportData.length} />
              <NumeroMiudo rotulo="Energia total" valor={`${totals.energy.toFixed(2)} kWh`} />
              <NumeroMiudo rotulo="Consumido" valor={`R$ ${fmt(totals.revenue)}`} destaque />
              {!comissaoOculta && (
                <>
                  <NumeroMiudo rotulo={`Comissão NeoPower (${pct(comissaoPercent)}%)`} valor={`R$ ${fmt(totals.comissao)}`} />
                  <NumeroMiudo
                    rotulo={`Repasse ao dono (${pct(percentCliente)}%)`}
                    valor={`R$ ${fmt(totals.repasse)}`}
                    destaque
                    detalhe={temSplit ? `A NeoPower repassa R$ ${fmt(totals.aRepassar)}` : undefined}
                  />
                </>
              )}
              {veCustoDaPlataforma && (
                <>
                  <NumeroMiudo rotulo={`Taxa MP absorvida (${pct(taxaMpPercent)}%)`} valor={`R$ ${fmt(totals.taxaMp)}`} negativo />
                  <NumeroMiudo
                    rotulo="Líquido NeoPower"
                    valor={`R$ ${fmt(totals.liquidoNeoPower)}`}
                    negativo={totals.liquidoNeoPower < 0}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </section>
      )}

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
