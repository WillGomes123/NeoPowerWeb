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
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { ExportColumn } from '../lib/export';

interface Transaction {
  transaction_id: number;
  charge_point_id: string;
  start_timestamp: string;
  stop_timestamp: string | null;
  consumed_wh: number | null;
  total_cost: number | null;
  address: string | null;
  status: string;
}

// Export column definitions
const exportColumns: ExportColumn[] = [
  { key: 'transaction_id', header: 'ID', format: 'number' },
  { key: 'charge_point_id', header: 'Carregador', format: 'text' },
  { key: 'start_timestamp', header: 'Inicio', format: 'date' },
  { key: 'stop_timestamp', header: 'Fim', format: 'date' },
  { key: 'consumed_kwh', header: 'Energia (kWh)', format: 'number' },
  { key: 'total_cost', header: 'Custo (R$)', format: 'currency' },
  { key: 'address', header: 'Endereco', format: 'text' },
  { key: 'status', header: 'Status', format: 'text' },
];

export const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Prepare data for export with formatted values
  const exportData = transactions.map(tx => ({
    transaction_id: tx.transaction_id,
    charge_point_id: tx.charge_point_id,
    start_timestamp: tx.start_timestamp,
    stop_timestamp: tx.stop_timestamp,
    consumed_kwh: tx.consumed_wh != null ? (tx.consumed_wh / 1000) : 0,
    total_cost: tx.total_cost != null ? parseFloat(tx.total_cost.toString()) : 0,
    address: tx.address || 'N/A',
    status: tx.status,
  }));

  useEffect(() => {
    void fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/transactions');

      if (!response.ok) {
        throw new Error('Falha ao buscar os dados das transações.');
      }

      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error(err);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  const handlePrevious = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return '---';
    return new Date(isoString).toLocaleString('pt-BR');
  };

  const getStatusFromTransactionStatus = (status: string): 'completed' | 'pending' | 'failed' => {
    const lowerStatus = status?.toLowerCase();
    if (lowerStatus === 'completed' || lowerStatus === 'finalizado') return 'completed';
    if (lowerStatus === 'failed' || lowerStatus === 'falhou') return 'failed';
    return 'pending';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Carregando dados...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Erro: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-emerald-50 flex items-center gap-3">
          <Receipt className="w-8 h-8 text-emerald-400" />
          Histórico de Transações
        </h1>
        <p className="text-emerald-300/60 mt-1">Visualize todas as transações realizadas</p>
      </div>

      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
        <CardHeader className="border-b border-emerald-800/30 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-emerald-50 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                Transacoes
              </CardTitle>
              <p className="text-sm text-emerald-300/60 mt-1">
                Total de {transactions.length} transacoes
              </p>
            </div>
            <ExportButton
              data={exportData}
              columns={exportColumns}
              filename="transacoes_neopower"
              title="Historico de Transacoes - NeoPower"
              disabled={transactions.length === 0}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <EnhancedTable striped hoverable>
            <EnhancedTableHeader>
              <EnhancedTableRow hoverable={false}>
                <EnhancedTableHead>ID</EnhancedTableHead>
                <EnhancedTableHead>Carregador</EnhancedTableHead>
                <EnhancedTableHead>Início</EnhancedTableHead>
                <EnhancedTableHead>Fim</EnhancedTableHead>
                <EnhancedTableHead>Energia (kWh)</EnhancedTableHead>
                <EnhancedTableHead>Custo (R$)</EnhancedTableHead>
                <EnhancedTableHead>Endereço</EnhancedTableHead>
                <EnhancedTableHead>Status</EnhancedTableHead>
              </EnhancedTableRow>
            </EnhancedTableHeader>
            <EnhancedTableBody>
              {currentTransactions.map((tx, index) => (
                <EnhancedTableRow key={tx.transaction_id} index={index}>
                  <EnhancedTableCell className="font-mono">
                    <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      {tx.transaction_id}
                    </span>
                  </EnhancedTableCell>
                  <EnhancedTableCell className="font-medium">
                    {tx.charge_point_id}
                  </EnhancedTableCell>
                  <EnhancedTableCell className="text-sm">
                    {formatDateTime(tx.start_timestamp)}
                  </EnhancedTableCell>
                  <EnhancedTableCell className="text-sm">
                    {formatDateTime(tx.stop_timestamp)}
                  </EnhancedTableCell>
                  <EnhancedTableCell highlight>
                    {tx.consumed_wh != null ? (tx.consumed_wh / 1000).toFixed(2) : '0.00'}
                  </EnhancedTableCell>
                  <EnhancedTableCell highlight>
                    R${' '}
                    {tx.total_cost != null
                      ? parseFloat(tx.total_cost.toString()).toFixed(2)
                      : '0.00'}
                  </EnhancedTableCell>
                  <EnhancedTableCell className="text-sm text-emerald-300/70">
                    {tx.address || 'N/A'}
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    <StatusBadge status={getStatusFromTransactionStatus(tx.status || 'pending')} />
                  </EnhancedTableCell>
                </EnhancedTableRow>
              ))}
            </EnhancedTableBody>
          </EnhancedTable>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-emerald-800/30">
            <div className="text-sm text-emerald-300/70">
              Página {currentPage} de {totalPages} ({transactions.length} transações)
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="bg-emerald-900/40 border-emerald-700/50 text-emerald-100 hover:bg-emerald-800/60 hover:border-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNext}
                disabled={currentPage === totalPages || totalPages === 0}
                className="bg-emerald-900/40 border-emerald-700/50 text-emerald-100 hover:bg-emerald-800/60 hover:border-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Próxima
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
