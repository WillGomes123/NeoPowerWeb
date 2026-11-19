import { useState, useEffect, useMemo, useRef } from 'react';
import { CircleCheck, Receipt, TrendingUp, Users, Wallet, Zap } from 'lucide-react';
import { ExportButton } from '../components/ExportButton';
import { ChargingCurveDialog } from '../components/ChargingCurveDialog';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { dataLocal } from '../components/ui/utils';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ExportColumn } from '../lib/export';
import { Icone } from '../components/painel/Icone';
import {
  AbasDaPagina,
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
} from '../components/painel/Pagina';
import { classeDoBotaoContorno } from '../components/painel/Pecas';
import {
  CartaoDeIndicador,
  classeDasAcoesComExportar,
  classeDoConteinerDaTabela,
  rotuloDoPeriodo,
} from '../components/financeiro/Pecas';

interface Transaction {
  id: number;
  transaction_id: number;
  charge_point_id: string;
  start_timestamp: string;
  stop_timestamp: string | null;
  consumed_wh: number | null;
  /** Energia apurada pela API (medidor antes de consumed_wh). */
  energia_kwh?: number | null;
  meter_start?: number | null;
  meter_stop?: number | null;
  stop_reason?: string | null;
  total_cost: number | null;
  address: string | null;
  status: string;
  /** Nome do local ("CONDOMÍNIO MORADA DOS PRÍNCIPES"). */
  nomeDoLocal?: string | null;
  /** Nome que o operador deu ao equipamento ("Morada dos Principes 02"). */
  nomeDoCarregador?: string | null;
  /** Posição desta recarga dentro do local — o #id é da rede inteira. */
  sequenciaNoLocal?: number | null;
  recargaCruzada?: boolean;
  redeDoCliente?: string | null;
  /** 'spott' = histórico importado da plataforma anterior (até 11/10/2026), pago lá. */
  origem?: string | null;
  /**
   * Quem carregou. A API só manda para admin e operador (o dono do condomínio
   * não recebe); sem o campo, a coluna Cliente não aparece.
   */
  clienteNome?: string | null;
  clienteCelular?: string | null;
  clienteVisitante?: boolean;
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
  paymentMethod: string | null;
  createdAt: string;
}

/** Badge do método de pagamento do depósito (Pix / Crédito / Débito / ...). */
function metodoDeposito(dep: { paymentMethod?: string | null; description?: string | null }): {
  label: string;
  cls: string;
  icon: string;
} {
  let m = (dep.paymentMethod || '').toLowerCase();
  if (!m) {
    // Fallback para registros antigos sem payment_method: lê da descrição.
    const d = (dep.description || '').toLowerCase();
    if (d.includes('crédito') || d.includes('credito')) m = 'credito';
    else if (d.includes('débito') || d.includes('debito')) m = 'debito';
    else if (d.includes('boleto')) m = 'boleto';
    else if (d.includes('pix')) m = 'pix';
  }
  switch (m) {
    case 'pix':
      return { label: 'Pix', cls: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20', icon: 'bolt' };
    case 'credito':
      return { label: 'Crédito', cls: 'bg-amber-500/10 text-amber-500 border border-amber-500/20', icon: 'credit_card' };
    case 'debito':
      return { label: 'Débito', cls: 'bg-blue-500/10 text-blue-500 border border-blue-500/20', icon: 'credit_card' };
    case 'boleto':
      return { label: 'Boleto', cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20', icon: 'receipt_long' };
    case 'saldo':
      return { label: 'Saldo MP', cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20', icon: 'account_balance_wallet' };
    default:
      return { label: 'Mercado Pago', cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20', icon: 'payments' };
  }
}

type TxTab = 'recargas' | 'saldo';

/** Recarga em andamento, com consumo lido do medidor a cada ciclo. */
interface SessaoAtiva {
  transactionId: number;
  energyKwh: number;
  powerKw: number | null;
  estimatedCost: number;
  userName: string | null;
  visitante: boolean;
  paidAmount: number | null;
  remaining: number | null;
}

/** De quanto em quanto tempo a tela busca as recargas em andamento. */
const INTERVALO_AO_VIVO_MS = 10_000;

/**
 * Período da tela na busca de GET /transactions: o começo do primeiro dia e o
 * fim do último, no relógio de quem vê. Sem isso a API mandava todas as
 * recargas (6 MB para a plataforma) a cada 10 s e o navegador filtrava.
 */
function buscaDoPeriodo(inicio: string, fim: string): string {
  const p = new URLSearchParams();
  if (inicio) {
    const d = dataLocal(inicio);
    d.setHours(0, 0, 0, 0);
    p.set('inicio', d.toISOString());
  }
  if (fim) {
    const d = dataLocal(fim);
    d.setHours(23, 59, 59, 999);
    p.set('fim', d.toISOString());
  }
  return p.toString();
}

const exportColumns: ExportColumn[] = [
  { key: 'sequenciaNoLocal', header: 'No. no local', format: 'number' },
  { key: 'nomeDoLocal', header: 'Local', format: 'text' },
  { key: 'nomeDoCarregador', header: 'Carregador', format: 'text' },
  { key: 'charge_point_id', header: 'ID do carregador', format: 'text' },
  { key: 'start_timestamp', header: 'Inicio', format: 'date' },
  { key: 'stop_timestamp', header: 'Fim', format: 'date' },
  { key: 'consumed_kwh', header: 'Energia (kWh)', format: 'number' },
  { key: 'total_cost', header: 'Custo (R$)', format: 'currency' },
  { key: 'address', header: 'Endereco', format: 'text' },
  { key: 'status', header: 'Status', format: 'text' },
  // O id interno fecha a planilha: nao ocupa espaco na tela e e por ele que o
  // suporte acha a linha no banco.
  { key: 'transaction_id', header: 'ID interno', format: 'number' },
];

/** Colunas do cliente, logo depois do carregador, quando a API manda o cliente. */
const exportColunasCliente: ExportColumn[] = [
  { key: 'cliente', header: 'Cliente', format: 'text' },
  { key: 'celular', header: 'Celular', format: 'text' },
];

/** Nome que vai na linha: o cadastro, "Visitante" (pague e carregue) ou nada. */
const nomeDoCliente = (tx: Transaction) =>
  tx.clienteVisitante ? 'Visitante' : (tx.clienteNome?.trim() || '');

const exportDepositColumns: ExportColumn[] = [
  { key: 'cliente', header: 'Cliente', format: 'text' },
  { key: 'email', header: 'Email', format: 'text' },
  { key: 'data', header: 'Data', format: 'date' },
  { key: 'valor', header: 'Valor (R$)', format: 'currency' },
  { key: 'saldoApos', header: 'Saldo apos (R$)', format: 'currency' },
  { key: 'metodo', header: 'Metodo', format: 'text' },
  { key: 'referencia', header: 'Referencia', format: 'text' },
  { key: 'id', header: 'ID interno', format: 'number' },
];

/**
 * Energia da recarga: o valor apurado pela API (leitura do medidor) e, se a API
 * ainda não mandar o campo, consumed_wh.
 */
const energiaApurada = (tx: Transaction) => {
  const apurada = tx.energia_kwh != null ? Number(tx.energia_kwh) : NaN;
  if (Number.isFinite(apurada)) return apurada;
  return tx.consumed_wh ? Number(tx.consumed_wh) / 1000 : 0;
};

const fmt = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const Transactions = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ativas, setAtivas] = useState<Record<number, SessaoAtiva>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [endDate, setEndDate] = useState<string>(getTodayString());
  const [curveOpen, setCurveOpen] = useState(false);
  const [curveTransaction, setCurveTransaction] = useState<Transaction | null>(null);
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
  // Botão Atualizar: quando os números chegaram e se a última busca falhou
  // (os números na tela ficam, com o aviso no botão).
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const itemsPerPage = 10;

  const fetchAtivas = async () => {
    try {
      const response = await api.get('/transactions/active');
      if (!response.ok) return;
      const data = await response.json();
      const lista: SessaoAtiva[] = Array.isArray(data) ? data : (data?.data ?? []);
      setAtivas(Object.fromEntries(lista.map(s => [s.transactionId, s])));
    } catch {
      /* uma falha de rede não pode derrubar a tela; tenta no próximo ciclo */
    }
  };

  useEffect(() => {
    void fetchAtivas();
  }, []);
  // Período novo: busca de novo, só aquele recorte.
  useEffect(() => {
    void fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // A recarga em andamento é acompanhada sozinha: sem isso, só recarregando a
  // página dava para ver o consumo crescer.
  useEffect(() => {
    if (txTab !== 'recargas') return;
    const t = setInterval(() => {
      if (document.hidden) return;
      void fetchAtivas();
      void fetchTransactions({ silencioso: true });
    }, INTERVALO_AO_VIVO_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txTab, startDate, endDate]);
  // As recargas de saldo também acompanham sozinhas: o operador (ex.: Vip
  // Energy) vê o depósito do cliente cair sem precisar recarregar a página.
  useEffect(() => {
    if (txTab !== 'saldo' || !isAdmin) return;
    if (walletTxs.length === 0) void fetchWalletTransactions();
    const t = setInterval(() => {
      if (document.hidden) return;
      void fetchWalletTransactions({ silencioso: true });
    }, INTERVALO_AO_VIVO_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txTab]);

  // Período que a tela mostra agora: a resposta de um período anterior, que
  // chega atrasada, é descartada.
  const periodoDaTela = useRef('');
  periodoDaTela.current = buscaDoPeriodo(startDate, endDate);

  const fetchTransactions = async ({ silencioso = false }: { silencioso?: boolean } = {}) => {
    if (!silencioso) setLoading(true);
    setError(null);
    const periodo = buscaDoPeriodo(startDate, endDate);
    try {
      const response = await api.get(periodo ? `/transactions?${periodo}` : '/transactions');
      if (!response.ok) throw new Error('Falha ao buscar transações.');
      const data = await response.json();
      if (periodo !== periodoDaTela.current) return;
      setTransactions(Array.isArray(data) ? data : []);
      setAtualizadoEm(new Date());
      setFalhou(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setFalhou(true);
      if (!silencioso) {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  const fetchWalletTransactions = async ({ silencioso = false }: { silencioso?: boolean } = {}) => {
    if (!silencioso) setLoadingWallet(true);
    try {
      const response = await api.get('/admin/wallet-transactions?type=deposit');
      if (!response.ok) throw new Error('Falha ao buscar depósitos.');
      const data = await response.json();
      setWalletTxs(data);
      setAtualizadoEm(new Date());
      setFalhou(false);
    } catch (err) {
      // No ciclo silencioso uma falha de rede não vira toast; tenta no próximo.
      setFalhou(true);
      if (!silencioso) toast.error(err instanceof Error ? err.message : 'Erro ao buscar depósitos.');
    } finally {
      if (!silencioso) setLoadingWallet(false);
    }
  };

  /**
   * Botão Atualizar do cabeçalho: busca a aba aberta sem trocar a tela pelo
   * carregando; se falhar, os números ficam e o botão avisa.
   */
  const atualizar = async () => {
    setAtualizando(true);
    try {
      if (txTab === 'saldo' && isAdmin) await fetchWalletTransactions({ silencioso: true });
      else await Promise.all([fetchTransactions({ silencioso: true }), fetchAtivas()]);
    } finally {
      setAtualizando(false);
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
    // Recarga em andamento fica visível mesmo fora do período: sem isso, a que
    // começou ontem sumia da tela (filtro padrão = hoje) depois da meia-noite.
    const emAndamento = (tx: Transaction) => !tx.stop_timestamp || tx.transaction_id in ativas;

    if (startDate) {
      const start = dataLocal(startDate);
      start.setHours(0, 0, 0, 0);
      list = list.filter(tx => emAndamento(tx) || new Date(tx.start_timestamp) >= start);
    }
    if (endDate) {
      const end = dataLocal(endDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter(tx => emAndamento(tx) || new Date(tx.start_timestamp) <= end);
    }

    // Filtro por texto (carregador, endereço, ID e, quando vem, o cliente)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const digitos = q.replace(/\D/g, '');
      list = list.filter(tx =>
        tx.charge_point_id?.toLowerCase().includes(q) ||
        tx.address?.toLowerCase().includes(q) ||
        String(tx.transaction_id).includes(q) ||
        nomeDoCliente(tx).toLowerCase().includes(q) ||
        (digitos.length >= 4 && (tx.clienteCelular ?? '').replace(/\D/g, '').includes(digitos)),
      );
    }

    return list;
  }, [transactions, ativas, startDate, endDate, searchQuery]);

  // Exporta o que está na tela (período + busca), não o histórico inteiro.
  const ehSaldo = txTab === 'saldo';

  // A API decide quem vê o cliente; a tela só mostra a coluna quando ele vem.
  const mostraCliente = transactions.some(tx => 'clienteNome' in tx);
  const colunasDaExportacao = mostraCliente
    ? [...exportColumns.slice(0, 3), ...exportColunasCliente, ...exportColumns.slice(3)]
    : exportColumns;

  const exportData = filtered.map(tx => ({
    transaction_id: tx.transaction_id,
    sequenciaNoLocal: tx.sequenciaNoLocal ?? '',
    nomeDoLocal: tx.nomeDoLocal ?? '',
    nomeDoCarregador: tx.nomeDoCarregador ?? tx.charge_point_id,
    cliente: nomeDoCliente(tx),
    celular: tx.clienteCelular ?? '',
    charge_point_id: tx.charge_point_id,
    start_timestamp: tx.start_timestamp,
    stop_timestamp: tx.stop_timestamp,
    consumed_kwh: energiaApurada(tx),
    total_cost: tx.total_cost != null ? parseFloat(tx.total_cost.toString()) : 0,
    address: tx.address || 'N/A',
    status: tx.status,
  }));

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const current = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Summary metrics
  /** Recarga aberta: o valor vem do medidor, não da coluna (só preenchida no fim). */
  const aoVivo = (tx: Transaction) => (tx.stop_timestamp ? null : (ativas[tx.transaction_id] ?? null));

  /**
   * Quem tem hora de fim acabou — mesmo que o status tenha ficado para trás.
   *
   * Três serviços escrevem na mesma linha (API, CSMS e o encerramento pelo
   * app) e só o `stop_timestamp` é gravado por todos. Uma sessão com fim na
   * tela e status 'Active'/NULL aparecia "Em andamento" para sempre e entrava
   * em "Não Concluídas". A API acerta o status na reconciliação; aqui a tela
   * não depende disso para mostrar a verdade que já está na linha.
   */
  const concluida = (tx: Transaction) => {
    const s = (tx.status || '').toLowerCase();
    if (s === 'failed' || s === 'falhou') return false;
    return s === 'completed' || s === 'finalizado' || s === 'refunded' || s === 'partialrefund' || Boolean(tx.stop_timestamp);
  };

  const custoDe = (tx: Transaction) =>
    aoVivo(tx)?.estimatedCost ?? (tx.total_cost ? parseFloat(tx.total_cost.toString()) : 0);
  const kwhDe = (tx: Transaction) => aoVivo(tx)?.energyKwh ?? energiaApurada(tx);

  // A apuração aberta segue a linha mais nova da lista (atualizada a cada
  // ciclo): a recarga que termina com a janela aberta passa a "encerrada", com
  // o medidor final, sem precisar fechar e abrir de novo.
  const txDaCurva = curveTransaction
    ? (transactions.find(t => t.id === curveTransaction.id) ?? curveTransaction)
    : null;

  const totalRevenue = useMemo(
    () => filtered.reduce((s, tx) => s + custoDe(tx), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, ativas]
  );
  const totalKwh = useMemo(
    () => filtered.reduce((s, tx) => s + kwhDe(tx), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, ativas]
  );
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0;
  const completedCount = filtered.filter(concluida).length;

  // Wallet deposits filtered & metrics
  const filteredDeposits = useMemo(() => {
    let list = walletTxs;

    if (startDate) {
      const start = dataLocal(startDate);
      start.setHours(0, 0, 0, 0);
      list = list.filter(wt => new Date(wt.createdAt) >= start);
    }
    if (endDate) {
      const end = dataLocal(endDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter(wt => new Date(wt.createdAt) <= end);
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
  }, [walletTxs, startDate, endDate, searchQuery]);

  // Exporta o que esta na tela, igual a aba de recargas.
  const exportDeposits = filteredDeposits.map(dep => ({
    cliente: dep.userName,
    email: dep.userEmail,
    data: dep.createdAt,
    valor: dep.amount,
    saldoApos: dep.balanceAfter,
    metodo: metodoDeposito(dep).label,
    referencia: dep.referenceId || '',
    id: dep.id,
  }));

  const totalDeposits = useMemo(() => filteredDeposits.reduce((s, wt) => s + wt.amount, 0), [filteredDeposits]);
  const avgDeposit = filteredDeposits.length > 0 ? totalDeposits / filteredDeposits.length : 0;
  const currentDeposits = filteredDeposits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalDepositPages = Math.ceil(filteredDeposits.length / itemsPerPage);

  const formatDt = (iso: string | null) => {
    if (!iso) return '---';
    return new Date(iso).toLocaleString('pt-BR');
  };

  const statusStyle = (tx: Transaction) => {
    if (tx.origem === 'spott') return { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-500', label: 'Spott' };
    const s = (tx.status || '').toLowerCase();
    if (s === 'refunded') return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500', label: 'Estornado' };
    if (s === 'partialrefund') return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500', label: 'Estorno Parcial' };
    if (s === 'invalid' || s === 'cancelled') return { bg: 'bg-surface-container-highest', text: 'text-on-surface-variant', border: 'border-outline-variant/20', dot: 'bg-outline', label: 'Interrompida' };
    if (s === 'failed' || s === 'falhou') return { bg: 'bg-error/10', text: 'text-error', border: 'border-error/20', dot: 'bg-error', label: 'Falhou' };
    if (concluida(tx)) return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', dot: 'bg-primary', label: 'Concluído' };
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
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  const periodo = rotuloDoPeriodo(startDate, endDate);

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        titulo="Transações"
        subtitulo={
          isAdmin
            ? 'Recargas nos carregadores e recargas de saldo dos clientes.'
            : 'Recargas feitas nos carregadores da sua rede.'
        }
        filtros={
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(d) => { setStartDate(d); setCurrentPage(1); }}
            onEndDateChange={(d) => { setEndDate(d); setCurrentPage(1); }}
            onClear={() => {
              setStartDate(getTodayString());
              setEndDate(getTodayString());
              setCurrentPage(1);
            }}
            placeholder="Todo o período"
            className={`${classeDaPilula} sm:w-[300px] justify-start`}
          />
        }
        acoes={<div className={classeDasAcoesComExportar}>
          {/*
            Na aba de Saldo o botao baixava as RECARGAS, nao os depositos, e
            ficava habilitado pela contagem da outra aba.
          */}
          <ExportButton
            data={ehSaldo ? exportDeposits : exportData}
            columns={ehSaldo ? exportDepositColumns : colunasDaExportacao}
            filename={ehSaldo ? 'recargas_de_saldo_neopower' : 'transacoes_neopower'}
            title={ehSaldo ? 'Recargas de Saldo - NeoPower' : 'Historico de Transacoes - NeoPower'}
            disabled={(ehSaldo ? filteredDeposits : filtered).length === 0}
          />
          <BotaoAtualizar
            aoAtualizar={() => void atualizar()}
            carregando={atualizando}
            atualizadoEm={atualizadoEm}
            falhou={falhou}
          />
        </div>}
      />

      {/* Abas Recargas vs Saldo. A contagem é a do período filtrado: antes era
          o total da base, e com o filtro em um único dia a aba dizia 61 e a
          tabela listava 4. */}
      {isAdmin && (
        <AbasDaPagina
          rotulo="Tipo de transação"
          abas={[
            {
              id: 'recargas' as const,
              rotulo: 'Recargas (Eletroposto)',
              icone: <Zap aria-hidden="true" className="w-6 h-6" />,
              contador: filtered.length,
            },
            {
              id: 'saldo' as const,
              rotulo: 'Recargas de saldo',
              icone: <Wallet aria-hidden="true" className="w-6 h-6" />,
              contador: filteredDeposits.length,
            },
          ]}
          ativa={txTab}
          aoMudar={aba => { setTxTab(aba); setCurrentPage(1); }}
        />
      )}

      {/* Resumo do período */}
      {txTab === 'recargas' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[25px]">
          <CartaoDeIndicador
            tom="marca"
            icone={<Icone nome="kpi-receita-liquida" tamanho={27} />}
            titulo="Receita total"
            subtitulo={periodo}
            valor={`R$ ${fmt(totalRevenue)}`}
          >
            {filtered.length} {filtered.length === 1 ? 'transação' : 'transações'}
          </CartaoDeIndicador>
          <CartaoDeIndicador
            tom="azul"
            icone={<Receipt aria-hidden="true" className="w-6 h-6" />}
            titulo="Ticket médio"
            subtitulo={periodo}
            valor={`R$ ${fmt(avgTicket)}`}
          />
          <CartaoDeIndicador
            tom="amarelo"
            icone={<Icone nome="kpi-energia" tamanho={26} />}
            titulo="Energia total"
            subtitulo={periodo}
            valor={`${fmt(totalKwh, 1)} kWh`}
          />
          <CartaoDeIndicador
            tom="cinza"
            icone={<CircleCheck aria-hidden="true" className="w-6 h-6" />}
            titulo="Concluídas"
            subtitulo={periodo}
            valor={String(completedCount)}
          >
            <span className="text-destructive font-medium">Não concluídas</span>{' '}
            <span className="font-semibold tabular-nums text-foreground">{filtered.length - completedCount}</span>
          </CartaoDeIndicador>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[25px]">
          <CartaoDeIndicador
            tom="marca"
            icone={<Wallet aria-hidden="true" className="w-6 h-6" />}
            titulo="Total de depósitos"
            subtitulo={periodo}
            valor={`R$ ${fmt(totalDeposits)}`}
          >
            {filteredDeposits.length} depósito{filteredDeposits.length === 1 ? '' : 's'}
          </CartaoDeIndicador>
          <CartaoDeIndicador
            tom="azul"
            icone={<TrendingUp aria-hidden="true" className="w-6 h-6" />}
            titulo="Depósito médio"
            subtitulo={periodo}
            valor={`R$ ${fmt(avgDeposit)}`}
          />
          <CartaoDeIndicador
            tom="cinza"
            icone={<Users aria-hidden="true" className="w-6 h-6" />}
            titulo="Usuários únicos"
            subtitulo={periodo}
            valor={String(new Set(filteredDeposits.map(d => d.userId)).size)}
          />
        </div>
      )}

      {/* Transaction Table — Recargas (Eletroposto) */}
      {txTab === 'recargas' && (
      <div className={`${classeDoCartao} overflow-hidden`}>
        <div className="px-6 py-5 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h3 className="text-[20px] leading-tight font-semibold text-foreground">Atividade recente</h3>
          <div className="flex items-center gap-4 flex-1 md:justify-end">
            <div className="relative flex-1 md:max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder={mostraCliente ? 'Buscar por cliente, celular, carregador ou ID...' : 'Buscar por carregador, endereço ou ID...'}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container border border-outline-variant/20 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <Legend dot="bg-primary" label="Concluído" />
              <Legend dot="bg-error" label="Falhou" />
              <Legend dot="bg-tertiary animate-pulse" label="Em andamento" />
              <span className="text-[10px] text-on-surface-variant">Atualiza sozinha a cada 10s</span>
            </div>
          </div>
        </div>
        <div className={classeDoConteinerDaTabela}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                <th className="px-6 py-4">Nº</th>
                <th className="px-6 py-4">Local e carregador</th>
                {mostraCliente && <th className="px-6 py-4">Cliente</th>}
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
                  <td colSpan={mostraCliente ? 10 : 9} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline mb-3 block">receipt_long</span>
                    <p className="text-sm text-on-surface-variant">Nenhuma transação encontrada</p>
                  </td>
                </tr>
              ) : current.map(tx => {
                const st = statusStyle(tx);
                const vivo = aoVivo(tx);
                return (
                  <tr key={tx.transaction_id} onClick={() => { setCurveTransaction(tx); setCurveOpen(true); }} title={`Transação #${tx.transaction_id}`} className="hover:bg-surface-container-highest/30 transition-colors group cursor-pointer">
                    {/*
                      O #id da transação é sequencial na rede inteira e serve ao
                      back end, não a quem lê a tela: ele fica no tooltip da linha,
                      no topo da janela da curva e na exportação. Aqui vai o número
                      da recarga DENTRO do local, que é o que o condomínio confere.
                    */}
                    <td className="px-6 py-4">
                      {tx.sequenciaNoLocal != null ? (
                        <span className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold">
                          {tx.sequenciaNoLocal}ª
                        </span>
                      ) : (
                        <span className="text-xs text-on-surface-variant/50">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-sm">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* O nome do local é o que a pessoa reconhece; o id do
                            equipamento, sozinho, não diz nada a ninguém. */}
                        <span>{tx.nomeDoLocal || tx.nomeDoCarregador || tx.charge_point_id}</span>
                        {tx.recargaCruzada && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title={`Recarga Cruzada - Rede do cliente: ${tx.redeDoCliente || 'Outra rede'}`}>
                            Cliente {tx.redeDoCliente || 'outra rede'}
                          </span>
                        )}
                      </div>
                      {tx.nomeDoLocal && (
                        <span className="block mt-0.5 text-[11px] font-normal text-on-surface-variant">
                          {tx.nomeDoCarregador || tx.charge_point_id}
                        </span>
                      )}
                    </td>
                    {mostraCliente && (
                      <td className="px-6 py-4 text-sm">
                        <span className="block font-medium text-foreground">{nomeDoCliente(tx) || '—'}</span>
                        {/* Muita conta antiga não tem celular: o app só passou a
                            pedir em algumas marcas. */}
                        <span className="block mt-0.5 text-[11px] text-on-surface-variant whitespace-nowrap">
                          {tx.clienteCelular || 'sem celular'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDt(tx.start_timestamp)}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDt(tx.stop_timestamp)}</td>
                    <td className="px-6 py-4 text-sm font-bold font-headline">
                      {fmt(kwhDe(tx), 2)} <span className="text-on-surface-variant text-xs">kWh</span>
                      {vivo?.powerKw ? (
                        <span className="block text-[10px] font-normal text-tertiary">{fmt(vivo.powerKw, 1)} kW agora</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold font-headline">
                      <span className="text-on-surface-variant text-xs">R$</span> {fmt(custoDe(tx))}
                      {vivo ? (
                        <span className="block text-[10px] font-normal text-on-surface-variant">parcial</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[200px] truncate">{tx.address || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      {vivo ? (
                        <span className="block mt-1 text-[10px] text-on-surface-variant">
                          {vivo.visitante ? 'Visitante' : (vivo.userName ?? 'Motorista')}
                          {vivo.remaining != null ? ` · resta R$ ${fmt(vivo.remaining)}` : ''}
                        </span>
                      ) : null}
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
        <div className="px-6 py-4 border-t border-border flex flex-wrap gap-3 justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{totalPages || 1}</span>
            <span className="ml-2">({filtered.length} transações)</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={classeDoBotaoContorno}
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={classeDoBotaoContorno}
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
        <div className={`${classeDoCartao} overflow-hidden`}>
          <div className="px-6 py-5 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h3 className="text-[20px] leading-tight font-semibold text-foreground">Recargas de saldo</h3>
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
            </div>
          </div>
          {loadingWallet ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className={classeDoConteinerDaTabela}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4">Saldo após</th>
                      <th className="px-6 py-4">Método</th>
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
                      const metodo = metodoDeposito(dep);
                      // Sem coluna de id: ele e do back end. Fica no tooltip da
                      // linha e na exportacao.
                      return (
                        <tr key={dep.id} title={`Depósito #${dep.id}`} className="hover:bg-surface-container-highest/30 transition-colors group">
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
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${metodo.cls}`}>
                              <span className="material-symbols-outlined text-sm">{metodo.icon}</span>
                              {metodo.label}
                            </span>
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
              <div className="px-6 py-4 border-t border-border flex flex-wrap gap-3 justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{totalDepositPages || 1}</span>
                  <span className="ml-2">({filteredDeposits.length} depósitos)</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={classeDoBotaoContorno}
                  >
                    <span className="material-symbols-outlined text-base">chevron_left</span>
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalDepositPages, p + 1))}
                    disabled={currentPage === totalDepositPages || totalDepositPages === 0}
                    className={classeDoBotaoContorno}
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
      {txDaCurva && (
        <ChargingCurveDialog
          transactionId={txDaCurva.transaction_id}
          chargerId={txDaCurva.charge_point_id}
          resumo={{
            inicio: txDaCurva.start_timestamp,
            fim: txDaCurva.stop_timestamp,
            energiaKwh: kwhDe(txDaCurva),
            medidorInicialWh: txDaCurva.meter_start ?? null,
            medidorFinalWh: txDaCurva.meter_stop ?? null,
            custo: custoDe(txDaCurva),
            emAndamento: !txDaCurva.stop_timestamp,
            potenciaKw: aoVivo(txDaCurva)?.powerKw ?? null,
          }}
          open={curveOpen}
          onClose={() => { setCurveOpen(false); setCurveTransaction(null); }}
        />
      )}

      {/* Deposit Refund Dialog */}
      {depositRefundOpen && depositRefundTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDepositRefundOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-estorno"
            className="bg-card text-card-foreground rounded-[15px] shadow-2xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-6">
              <span aria-hidden="true" className="w-[41px] h-[38px] rounded-[5px] bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">undo</span>
              </span>
              <div>
                <h3 id="titulo-estorno" className="text-[20px] leading-tight font-semibold text-foreground">Estornar depósito</h3>
                <p className="text-sm text-muted-foreground">#{depositRefundTx.id} — {depositRefundTx.userName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="px-4 py-3 rounded-[10px] bg-muted/60 dark:bg-muted/40">
                <p className="text-sm font-medium text-muted-foreground mb-1">Valor do depósito</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">R$ {fmt(depositRefundTx.amount)}</p>
                {depositRefundTx.referenceId && /^[0-9]+$/.test(depositRefundTx.referenceId) && (
                  <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                    MercadoPago Payment ID: {depositRefundTx.referenceId}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="motivo-estorno" className="block text-sm font-medium text-muted-foreground mb-1.5">Motivo (opcional)</label>
                <textarea
                  id="motivo-estorno"
                  value={depositRefundReason}
                  onChange={(e) => setDepositRefundReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-[10px] bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  placeholder="Ex: depósito incorreto, valor errado..."
                />
              </div>

              {/* Toggle MercadoPago */}
              {depositRefundTx.referenceId && /^[0-9]+$/.test(depositRefundTx.referenceId) && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-[10px] bg-muted/60 dark:bg-muted/40">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={depositRefundToMP}
                    aria-label="Devolver ao meio de pagamento"
                    onClick={() => setDepositRefundToMP(!depositRefundToMP)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      depositRefundToMP ? 'bg-primary border-primary' : 'border-muted-foreground'
                    }`}
                  >
                    {depositRefundToMP && <span className="material-symbols-outlined text-primary-foreground text-sm">check</span>}
                  </button>
                  <div>
                    <p className="text-sm font-medium text-foreground">Devolver ao meio de pagamento</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      O valor será estornado via MercadoPago de volta ao cartão/Pix do cliente. Caso contrário, apenas debita o saldo da carteira.
                    </p>
                  </div>
                </div>
              )}

              {/* O que acontece ao confirmar, dito antes do clique. */}
              <p className="text-sm text-destructive font-medium">
                {depositRefundToMP
                  ? `Ao confirmar, o Mercado Pago devolve R$ ${fmt(depositRefundTx.amount)} ao cartão ou Pix de ${depositRefundTx.userName}.`
                  : `Ao confirmar, R$ ${fmt(depositRefundTx.amount)} saem do saldo da carteira de ${depositRefundTx.userName}.`}
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button
                onClick={() => setDepositRefundOpen(false)}
                className="h-10 px-5 rounded-[25px] bg-[#d9d9d9] dark:bg-muted text-foreground text-sm font-medium inline-flex items-center justify-center hover:brightness-95 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleDepositRefund()}
                disabled={depositRefundLoading}
                className="h-10 px-5 rounded-[25px] bg-destructive text-white text-sm font-semibold inline-flex items-center gap-2 hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {depositRefundLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <span className="material-symbols-outlined text-sm">undo</span>
                )}
                Confirmar estorno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Sub-components ── */

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{label}</span>
    </div>
  );
}
