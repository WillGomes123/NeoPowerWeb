import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Zap,
  Clock,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Transaction {
  id: number;
  transactionId: number;
  chargePointId: string;
  idTag: string;
  startTimestamp: string;
  stopTimestamp: string;
  consumedWh: number;
  totalCost: number;
  status: string;
}

interface Props {
  locationId: number;
}

export function LocationTransactionsTab({ locationId }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await api.get(`/locations/${locationId}/transactions?${params}`);
      setTransactions(response.data.transactions || []);
      setTotalPages(response.data.totalPages || 1);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      toast.error('Erro ao carregar transações');
    } finally {
      setIsLoading(false);
    }
  }, [locationId, page, statusFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (start: string, stop: string) => {
    if (!start || !stop) return '-';
    const startDate = new Date(start);
    const stopDate = new Date(stop);
    const diffMs = stopDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed') {
      return <span className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400">Concluída</span>;
    }
    if (statusLower === 'active') {
      return <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">Em andamento</span>;
    }
    if (statusLower === 'failed') {
      return <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">Falhou</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400">{status}</span>;
  };

  const filteredTransactions = searchTerm
    ? transactions.filter(t =>
        t.chargePointId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.idTag?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : transactions;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/50" />
              <Input
                placeholder="Buscar por carregador ou usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-emerald-950/30 border-emerald-700/50 text-emerald-50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-10 px-3 rounded-md bg-emerald-950/30 border border-emerald-700/50 text-emerald-50 text-sm"
            >
              <option value="">Todos os status</option>
              <option value="Completed">Concluídas</option>
              <option value="Active">Em andamento</option>
              <option value="Failed">Falhas</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTransactions}
              disabled={isLoading}
              className="border-emerald-700/50 text-emerald-300"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Transações */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <CardTitle className="text-lg text-emerald-50 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Transações
            </span>
            <span className="text-sm font-normal text-emerald-300/70">
              {total} transações encontradas
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-emerald-300/70">
              Nenhuma transação encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-emerald-800/30">
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">ID</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Carregador</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Início</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Duração</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Energia</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Valor</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="border-b border-emerald-800/20 hover:bg-emerald-800/10">
                      <td className="py-3 px-4 text-emerald-50 font-mono text-sm">#{t.transactionId || t.id}</td>
                      <td className="py-3 px-4 text-emerald-50 text-sm">{t.chargePointId}</td>
                      <td className="py-3 px-4 text-emerald-300/70 text-sm">{formatDate(t.startTimestamp)}</td>
                      <td className="py-3 px-4 text-emerald-300/70 text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(t.startTimestamp, t.stopTimestamp)}
                      </td>
                      <td className="py-3 px-4 text-amber-400 text-sm flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {((t.consumedWh || 0) / 1000).toFixed(2)} kWh
                      </td>
                      <td className="py-3 px-4 text-emerald-400 text-sm flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        R$ {(t.totalCost || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-emerald-800/30">
              <p className="text-sm text-emerald-300/70">
                Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="border-emerald-700/50 text-emerald-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isLoading}
                  className="border-emerald-700/50 text-emerald-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LocationTransactionsTab;
