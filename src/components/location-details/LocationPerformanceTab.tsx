import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  Zap,
  Clock,
  Activity,
  Download,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';

// Lazy load Recharts
const AreaChart = lazy(() => import('recharts').then(m => ({ default: m.AreaChart })));
const BarChart = lazy(() => import('recharts').then(m => ({ default: m.BarChart })));
const LineChart = lazy(() => import('recharts').then(m => ({ default: m.LineChart })));
const Area = lazy(() => import('recharts').then(m => ({ default: m.Area })));
const Bar = lazy(() => import('recharts').then(m => ({ default: m.Bar })));
const Line = lazy(() => import('recharts').then(m => ({ default: m.Line })));
const XAxis = lazy(() => import('recharts').then(m => ({ default: m.XAxis })));
const YAxis = lazy(() => import('recharts').then(m => ({ default: m.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(m => ({ default: m.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(m => ({ default: m.Tooltip })));
const ResponsiveContainer = lazy(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })));

interface PerformanceData {
  dates: string[];
  occupancyRate: number[];
  utilization: number[];
  availability: number[];
  totals: {
    avgOccupancy: number;
    avgUtilization: number;
    avgAvailability: number;
    totalEnergy: number;
    totalSessions: number;
  };
}

interface Props {
  locationId: number;
}

type ChartType = 'area' | 'bar' | 'line';
type Period = '7d' | '30d' | '90d';
type MetricType = 'occupancy' | 'utilization' | 'availability';

const metricsConfig = {
  occupancy: { label: 'Taxa de Ocupação', unit: '%', color: '#10b981' },
  utilization: { label: 'Utilização (kWh)', unit: 'kWh', color: '#fbbf24' },
  availability: { label: 'Disponibilidade', unit: '%', color: '#3b82f6' }
};

export function LocationPerformanceTab({ locationId }: Props) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('occupancy');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/locations/${locationId}/performance?period=${period}`);
      setData(response.data);
    } catch (error) {
      console.error('Erro ao carregar performance:', error);
      toast.error('Erro ao carregar dados de performance');
    } finally {
      setIsLoading(false);
    }
  }, [locationId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Preparar dados para o gráfico
  const chartData = data?.dates.map((date, index) => ({
    date,
    occupancy: data.occupancyRate[index],
    utilization: data.utilization[index],
    availability: data.availability[index]
  })) || [];

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!data) return;

    const exportData = chartData.map(d => ({
      Data: d.date,
      'Taxa de Ocupação (%)': d.occupancy,
      'Utilização (kWh)': d.utilization,
      'Disponibilidade (%)': d.availability
    }));

    const columns = [
      { key: 'Data', header: 'Data' },
      { key: 'Taxa de Ocupação (%)', header: 'Taxa de Ocupação (%)', format: 'number' as const },
      { key: 'Utilização (kWh)', header: 'Utilização (kWh)', format: 'number' as const },
      { key: 'Disponibilidade (%)', header: 'Disponibilidade (%)', format: 'number' as const }
    ];

    const options = {
      filename: `performance_local_${locationId}_${period}`,
      title: `Relatório de Performance - Local ${locationId}`,
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

  const renderChart = () => {
    const config = metricsConfig[selectedMetric];
    const dataKey = selectedMetric === 'occupancy' ? 'occupancy' : selectedMetric === 'utilization' ? 'utilization' : 'availability';

    const chartProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 }
    };

    const commonElements = (
      <>
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
        />
      </>
    );

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...chartProps}>
            {commonElements}
            <Bar dataKey={dataKey} fill={config.color} radius={[4, 4, 0, 0]} maxBarSize={50} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...chartProps}>
            {commonElements}
            <Line type="monotone" dataKey={dataKey} stroke={config.color} strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        );
      default:
        return (
          <AreaChart {...chartProps}>
            {commonElements}
            <defs>
              <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey={dataKey} stroke={config.color} strokeWidth={2} fill={`url(#gradient-${selectedMetric})`} />
          </AreaChart>
        );
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
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Taxa Ocupação</p>
                <p className="text-xl font-bold text-emerald-50">{data?.totals.avgOccupancy || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Energia Total</p>
                <p className="text-xl font-bold text-emerald-50">{data?.totals.totalEnergy.toFixed(1) || 0} kWh</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Disponibilidade</p>
                <p className="text-xl font-bold text-emerald-50">{data?.totals.avgAvailability || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Sessões</p>
                <p className="text-xl font-bold text-emerald-50">{data?.totals.totalSessions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Média Diária</p>
                <p className="text-xl font-bold text-emerald-50">{data?.totals.avgUtilization.toFixed(1) || 0} kWh</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Principal */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Performance
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {/* Seletor de Métrica */}
              <div className="flex rounded-lg bg-emerald-950/50 p-1">
                {(Object.keys(metricsConfig) as MetricType[]).map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setSelectedMetric(metric)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      selectedMetric === metric
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-emerald-300/70 hover:text-emerald-300'
                    }`}
                  >
                    {metricsConfig[metric].label.split(' ')[0]}
                  </button>
                ))}
              </div>

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

              {/* Seletor de Tipo de Gráfico */}
              <div className="flex rounded-lg bg-emerald-950/50 p-1">
                {(['area', 'bar', 'line'] as ChartType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                      chartType === type
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-emerald-300/70 hover:text-emerald-300'
                    }`}
                  >
                    {type === 'area' ? 'Área' : type === 'bar' ? 'Barras' : 'Linha'}
                  </button>
                ))}
              </div>

              {/* Botão Atualizar */}
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
            <div className="h-[400px] flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <div className="h-[400px]">
              <Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                </div>
              }>
                <ResponsiveContainer width="100%" height="100%">
                  {renderChart()}
                </ResponsiveContainer>
              </Suspense>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões de Exportação */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-emerald-50 font-medium">Exportar Relatório</h3>
              <p className="text-sm text-emerald-300/70">Baixe os dados de performance em diferentes formatos</p>
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

export default LocationPerformanceTab;
