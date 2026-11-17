import { useState, useEffect, type ReactNode } from 'react';
import { cn } from '../components/ui/utils';
import { ExportButton } from '../components/ExportButton';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { ExportColumn } from '../lib/export';
import { WalletsReportTemplate } from '../components/WalletsReportTemplate';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ChevronLeft,
  ChevronRight,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  AbasDaPagina,
  BlocoDeIcone,
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDoCartao,
  type Tom,
} from '../components/painel/Pagina';
import {
  BarraDeFiltros,
  CampoDeBusca,
  classeDoBotaoContorno,
} from '../components/painel/Pecas';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  CabecalhoDoCartao,
  CarregandoPagina,
  EstadoVazio,
  classeDaEtiqueta,
  classeDaTabela,
  classeDoCartaoDaTabela,
  classeDoFiltro,
  classeDoTd,
  classeDoTh,
} from '../components/configuracoes/Pecas';

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

/** Filtro de tipo das transações (as opções do select de antes). */
const FILTROS_DE_TIPO: { id: string; rotulo: string }[] = [
  { id: 'all', rotulo: 'Todos os tipos' },
  { id: 'deposit', rotulo: 'Depósito' },
  { id: 'withdrawal', rotulo: 'Saque' },
  { id: 'charge', rotulo: 'Cobrança' },
  { id: 'refund', rotulo: 'Reembolso' },
];

/** Cartão de total (como os da Visão geral): bloco de ícone, rótulo, valor e o detalhe, se houver. */
function CartaoDeTotal({
  icone,
  tom = 'marca',
  rotulo,
  valor,
  detalhe,
}: {
  icone: ReactNode;
  tom?: Tom;
  rotulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <section className={`${classeDoCartao} p-[22px]`} aria-label={rotulo}>
      <div className="flex items-center gap-3 mb-3">
        <BlocoDeIcone tom={tom}>{icone}</BlocoDeIcone>
        <h2 className="text-base leading-tight font-semibold text-foreground">{rotulo}</h2>
      </div>
      <p className="text-[28px] leading-tight font-semibold tabular-nums text-foreground">{valor}</p>
      {detalhe && <p className="text-sm text-muted-foreground mt-1">{detalhe}</p>}
    </section>
  );
}

export const Wallets = () => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

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
    // As duas listas chegaram: guarda a hora; se uma falhou, o erro fica à mostra.
    const [okCarteiras, okTransacoes] = await Promise.all([fetchWallets(), fetchTransactions()]);
    if (okCarteiras && okTransacoes) {
      setError(null);
      setAtualizadoEm(new Date());
    }
  };

  const fetchWallets = async (): Promise<boolean> => {
    setLoadingWallets(true);
    try {
      const response = await api.get('/admin/wallets');
      if (!response.ok) throw new Error('Falha ao buscar carteiras');
      const data = await response.json();
      setWallets(Array.isArray(data) ? data : []);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoadingWallets(false);
    }
  };

  const fetchTransactions = async (): Promise<boolean> => {
    setLoadingTransactions(true);
    try {
      const response = await api.get('/admin/wallet-transactions');
      if (!response.ok) throw new Error('Falha ao buscar transacoes');
      const data = await response.json();
      setTransactions(Array.isArray(data) ? data : []);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
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
    // Number() defensivo: se um saldo/valor vier null/undefined ou string, o
    // toLocaleString direto quebraria a linha inteira (ErrorBoundary global).
    const n = Number(value);
    return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      deposit: 'Depósito',
      withdrawal: 'Saque',
      charge: 'Cobrança',
      refund: 'Reembolso',
    };
    return labels[type] || type;
  };

  // Tons fixos (não a cor da marca), legíveis no claro e no escuro.
  const getTypePill = (type: string) => {
    const styles: Record<string, string> = {
      deposit: 'bg-estado-livre text-estado-livre-forte',
      withdrawal: 'bg-estado-problema text-estado-problema-forte',
      charge: 'bg-tom-cinza text-foreground',
      refund: 'bg-estado-uso text-estado-uso-forte',
    };
    return styles[type] || 'bg-muted text-muted-foreground';
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
  const semDados = wallets.length === 0 && transactions.length === 0;

  // Só a primeira carga troca a tela pelo carregando; depois, o "Atualizar" mostra.
  if (loading && !atualizadoEm && semDados && !error) {
    return <CarregandoPagina />;
  }

  // Erro sem nenhum dado na tela: diz o que houve e deixa tentar de novo.
  if (error && !atualizadoEm && semDados) {
    return (
      <div className="space-y-[25px] pb-12">
        <CabecalhoDaPagina
          rotulo="Carteiras digitais"
          titulo="Carteiras"
          acoes={
            <BotaoAtualizar aoAtualizar={() => void fetchData()} carregando={loading} atualizadoEm={null} falhou />
          }
        />
        <section className={classeDoCartao}>
          <EstadoVazio icone={<Wallet className="w-10 h-10" />}>
            <span className="text-destructive">{error}</span>
          </EstadoVazio>
        </section>
      </div>
    );
  }

  const mudarDeAba = (aba: 'wallets' | 'transactions') => {
    setActiveTab(aba);
    setCurrentPage(1);
    setSearchTerm('');
    if (aba === 'wallets') setTxTypeFilter('all');
  };

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        rotulo="Carteiras digitais"
        titulo="Carteiras"
        acoes={
          <>
            {/* O botão de exportar é comum a outras telas: aqui ganha o formato de pílula. */}
            <div className="[&>button]:h-12 [&>button]:rounded-[25px] [&>button]:px-6 [&>button]:text-[15px] [&>button]:bg-card [&>button]:border-foreground/70 dark:[&>button]:border-primary dark:[&>button]:text-primary-strong">
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
            <BotaoAtualizar
              aoAtualizar={() => void fetchData()}
              carregando={loading}
              atualizadoEm={atualizadoEm}
              falhou={!!error}
            />
          </>
        }
      />

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[25px]">
        <CartaoDeTotal
          icone={<Wallet className="w-5 h-5" />}
          rotulo="Saldo total"
          valor={formatCurrency(totalBalance)}
          detalhe={`${filteredWallets.length} ${filteredWallets.length === 1 ? 'carteira' : 'carteiras'}`}
        />
        <CartaoDeTotal
          icone={<TrendingUp className="w-5 h-5" />}
          tom="azul"
          rotulo="Total de depósitos"
          valor={formatCurrency(totalDeposits)}
        />
        <CartaoDeTotal
          icone={<TrendingDown className="w-5 h-5" />}
          tom="amarelo"
          rotulo="Total cobrado"
          valor={formatCurrency(totalCharges)}
        />
      </div>

      <AbasDaPagina
        rotulo="Carteiras e transações"
        ativa={activeTab}
        aoMudar={mudarDeAba}
        abas={[
          { id: 'wallets', rotulo: 'Carteiras', icone: <Wallet className="w-5 h-5" aria-hidden="true" />, contador: filteredWallets.length },
          { id: 'transactions', rotulo: 'Transações', icone: <Receipt className="w-5 h-5" aria-hidden="true" />, contador: filteredTransactions.length },
        ]}
      />

      <BarraDeFiltros>
        <CampoDeBusca
          placeholder="Buscar por nome ou email..."
          aria-label="Buscar por nome ou email"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
        />
        {activeTab === 'transactions' && (
          <Select value={txTypeFilter} onValueChange={v => { setTxTypeFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className={classeDoFiltro} aria-label="Tipo de transação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTROS_DE_TIPO.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </BarraDeFiltros>

      {/* Tabela (linhas verdes arredondadas, como Notificações e Alarmes no Figma) */}
      <section className={classeDoCartaoDaTabela} aria-label={activeTab === 'wallets' ? 'Carteiras dos usuários' : 'Histórico de transações'}>
        <CabecalhoDoCartao
          titulo={activeTab === 'wallets' ? 'Carteiras dos usuários' : 'Histórico de transações'}
          detalhe={
            activeTab === 'wallets'
              ? `Mostrando ${currentItems.length} carteira(s)`
              : `Mostrando ${currentItems.length} transação(ões)`
          }
        />

        <div className="overflow-x-auto">
          {activeTab === 'wallets' ? (
            filteredWallets.slice(startIndex, endIndex).length === 0 ? (
              <EstadoVazio icone={<Wallet className="w-10 h-10" />} titulo="Nenhuma carteira encontrada" />
            ) : (
            <table className={classeDaTabela}>
              <thead>
                <tr>
                  <th className={classeDoTh}>ID</th>
                  <th className={classeDoTh}>Usuário</th>
                  <th className={classeDoTh}>Email</th>
                  <th className={cn(classeDoTh, 'text-right')}>Saldo</th>
                  <th className={classeDoTh}>Última atualização</th>
                </tr>
              </thead>
              <tbody>
                {filteredWallets.slice(startIndex, endIndex).map(wallet => (
                  <tr key={wallet.id}>
                    <td className={classeDoTd}>
                      <span className="text-xs font-mono font-semibold text-muted-foreground">#{wallet.id}</span>
                    </td>
                    <td className={`${classeDoTd} font-semibold`}>
                      {wallet.userName}
                    </td>
                    <td className={`${classeDoTd} text-muted-foreground`}>
                      {wallet.userEmail}
                    </td>
                    <td className={`${classeDoTd} font-semibold tabular-nums text-right whitespace-nowrap`}>
                      {formatCurrency(wallet.balance)}
                    </td>
                    <td className={`${classeDoTd} text-muted-foreground whitespace-nowrap`}>
                      {formatDateTime(wallet.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )
          ) : filteredTransactions.slice(startIndex, endIndex).length === 0 ? (
            <EstadoVazio icone={<Receipt className="w-10 h-10" />} titulo="Nenhuma transação encontrada" />
          ) : (
            <table className={classeDaTabela}>
              <thead>
                <tr>
                  <th className={classeDoTh}>ID</th>
                  <th className={classeDoTh}>Usuário</th>
                  <th className={classeDoTh}>Tipo</th>
                  <th className={cn(classeDoTh, 'text-right')}>Valor</th>
                  <th className={cn(classeDoTh, 'text-right')}>Saldo anterior</th>
                  <th className={cn(classeDoTh, 'text-right')}>Saldo atual</th>
                  <th className={classeDoTh}>Descrição</th>
                  <th className={classeDoTh}>Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.slice(startIndex, endIndex).map(tx => {
                  const entra = tx.type === 'deposit' || tx.type === 'refund';
                  return (
                  <tr key={tx.id}>
                    <td className={classeDoTd}>
                      <span className="text-xs font-mono font-semibold text-muted-foreground">#{tx.id}</span>
                    </td>
                    <td className={`${classeDoTd} font-semibold min-w-[150px]`}>
                      {tx.userName}
                    </td>
                    <td className={classeDoTd}>
                      <span className={`${classeDaEtiqueta} ${getTypePill(tx.type)}`}>
                        {getTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td className={`${classeDoTd} font-semibold tabular-nums text-right whitespace-nowrap`}>
                      {/* Sinal e cor: entrada em verde, saída em vermelho */}
                      <span className={entra ? 'text-estado-livre-forte' : 'text-destructive'}>
                        {/* O sinal vem daqui: o valor da cobrança já chega negativo e aparecia "--R$". */}
                        {entra ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)))}
                      </span>
                    </td>
                    <td className={`${classeDoTd} tabular-nums text-right text-muted-foreground whitespace-nowrap`}>
                      {formatCurrency(tx.balanceBefore)}
                    </td>
                    <td className={`${classeDoTd} tabular-nums text-right text-muted-foreground whitespace-nowrap`}>
                      {formatCurrency(tx.balanceAfter)}
                    </td>
                    <td className={`${classeDoTd} text-muted-foreground max-w-[160px] 3xl:max-w-[220px] truncate`} title={tx.description || undefined}>
                      {tx.description || '---'}
                    </td>
                    <td className={`${classeDoTd} text-muted-foreground whitespace-nowrap`}>
                      {formatDateTime(tx.createdAt)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-3 3xl:px-5 pt-2 pb-1 flex flex-wrap justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{totalPages || 1}</span>
              <span className="ml-2">({currentItems.length} itens)</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={classeDoBotaoContorno}
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={classeDoBotaoContorno}
              >
                Próxima
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>

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
