import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  TrendingUp,
  Zap,
  Activity,
  RefreshCw,
  Download
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';

// Lazy load Recharts
const AreaChart = lazy(() => import('recharts').then(m => ({ default: m.AreaChart })));
const Area = lazy(() => import('recharts').then(m => ({ default: m.Area })));
const XAxis = lazy(() => import('recharts').then(m => ({ default: m.XAxis })));
const YAxis = lazy(() => import('recharts').then(m => ({ default: m.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(m => ({ default: m.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(m => ({ default: m.Tooltip })));
const ResponsiveContainer = lazy(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })));

interface FinancialData {
  totalRevenue: number;
  averageDailyRevenue: number;
  totalSessions: number;
  totalEnergy: number;
  pricePerKwh: number;
  revenueByCharger: {
    chargerId: string;
    chargerName: string;
    revenue: number;
    sessions: number;
    energy: number;
  }[];
  revenueChart: {
    date: string;
    revenue: number;
  }[];
}

interface Props {
  locationId: number;
}

type Period = '7d' | '30d' | '90d';

export function LocationFinancialTab({ locationId }: Props) {
  const [data, setData] = useState<FinancialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/locations/${locationId}/financial?period=${period}`);
      setData(response.data);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setIsLoading(false);
    }
  }, [locationId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!data) return;

    const exportData = data.revenueByCharger.map(c => ({
      'Carregador': c.chargerName || c.chargerId,
      'Sessões': c.sessions,
      'Energia (kWh)': (c.energy / 1000).toFixed(2),
      'Receita (R$)': c.revenue.toFixed(2)
    }));

    const columns = [
      { key: 'Carregador', header: 'Carregador' },
      { key: 'Sessões', header: 'Sessões', format: 'number' as const },
      { key: 'Energia (kWh)', header: 'Energia (kWh)', format: 'number' as const },
      { key: 'Receita (R$)', header: 'Receita (R$)', format: 'currency' as const }
    ];

    const options = {
      filename: `financeiro_local_${locationId}_${period}`,
      title: `Relatório Financeiro - Local ${locationId}`,
      columns,
      data: exportData
    };

    switch (format) {
      case 'csv':
        exportToCSV(options);
        toast.success('Relatório CSV exportado');
        break;
      case 'excel':
        exportToExcel(options);
        toast.success('Relatório Excel exportado');
        break;
      case 'pdf':
        exportToPDF(options);
        toast.success('Relatório PDF gerado');
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Receita Total</p>
                <p className="text-xl font-bold text-emerald-50">
                  R$ {(data?.totalRevenue || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Média Diária</p>
                <p className="text-xl font-bold text-emerald-50">
                  R$ {(data?.averageDailyRevenue || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Sessões</p>
                <p className="text-xl font-bold text-emerald-50">{data?.totalSessions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Energia Total</p>
                <p className="text-xl font-bold text-emerald-50">
                  {((data?.totalEnergy || 0) / 1000).toFixed(1)} kWh
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Preço/kWh</p>
                <p className="text-xl font-bold text-emerald-50">
                  R$ {(data?.pricePerKwh || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Receita */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Receita ao Longo do Tempo
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Seletor de Período */}
              <div className="flex rounded-lg bg-emerald-950/50 p-1">
                {(['7d', '30d', '90d'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      period === p
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-emerald-300/70 hover:text-emerald-300'
                    }`}
                  >
                    {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                  </button>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={fetchData}
                disabled={isLoading}
                className="text-emerald-300 hover:bg-emerald-800/30"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <div className="h-[300px]">
              <Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                </div>
              }>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data?.revenueChart || []}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        color: '#fafafa'
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                    />
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Suspense>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receita por Carregador */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <CardTitle className="text-lg text-emerald-50 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Receita por Carregador
            </span>
            <span className="text-sm font-normal text-emerald-300/70">
              {data?.revenueByCharger?.length || 0} carregadores
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : !data?.revenueByCharger?.length ? (
            <div className="text-center py-12 text-emerald-300/70">
              Nenhum carregador encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-emerald-800/30">
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Carregador</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Sessões</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Energia</th>
                    <th className="text-left py-3 px-4 text-xs text-emerald-400/70 uppercase tracking-wider">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenueByCharger.map((charger) => (
                    <tr key={charger.chargerId} className="border-b border-emerald-800/20 hover:bg-emerald-800/10">
                      <td className="py-3 px-4 text-emerald-50 font-medium">
                        {charger.chargerName || charger.chargerId}
                      </td>
                      <td className="py-3 px-4 text-emerald-300/70">
                        {charger.sessions}
                      </td>
                      <td className="py-3 px-4 text-amber-400 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {(charger.energy / 1000).toFixed(2)} kWh
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-medium">
                        R$ {charger.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões de Exportação */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-emerald-50 font-medium">Exportar Relatório Financeiro</h3>
              <p className="text-sm text-emerald-300/70">Baixe os dados financeiros em diferentes formatos</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                className="border-emerald-700/50 text-emerald-300"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('excel')}
                className="border-emerald-700/50 text-emerald-300"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                className="border-emerald-700/50 text-emerald-300"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LocationFinancialTab;
