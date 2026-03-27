import { useState, useEffect, useCallback } from 'react';
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
<<<<<<< HEAD
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';
import {
  AreaChart, BarChart, LineChart, Area, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
=======
import { exportToCSV, exportToExcel } from '@/lib/export';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { PerformanceReportTemplate } from '../PerformanceReportTemplate';

import { 
  AreaChart, BarChart, LineChart, Area, Bar, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
>>>>>>> 369f77871143a7d82dc526e4cc33de76d3271c15
} from 'recharts';

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
  locationName?: string;
}

type ChartType = 'area' | 'bar' | 'line';
type Period = '7d' | '15d' | '30d' | '90d';
type MetricType = 'occupancy' | 'utilization' | 'availability';

const metricsConfig = {
  occupancy: { label: 'Taxa de Ocupação', unit: '%', color: '#10b981' },
  utilization: { label: 'Utilização (kWh)', unit: 'kWh', color: '#fbbf24' },
  availability: { label: 'Disponibilidade', unit: '%', color: '#3b82f6' }
};

export function LocationPerformanceTab({ locationId, locationName }: Props) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('occupancy');
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/locations/${locationId}/performance?period=${period}`);
      if (!response.ok) throw new Error('Erro ao carregar performance');
      const result = await response.json();
      setData(result.data || result);
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

  const chartData = data?.dates.map((date, index) => ({
    date,
    occupancy: data.occupancyRate[index],
    utilization: data.utilization[index],
    availability: data.availability[index]
  })) || [];

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!data) return;

    if (format === 'pdf') {
       setPdfLoading(true);
       toast.loading('Gerando relatório de performance profissional...', { id: 'pdf-gen' });

       try {
         await new Promise(resolve => setTimeout(resolve, 1500));

         const element = document.getElementById('performance-report-root');
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

         pdf.save(`performance_local_${locationId}_${period}.pdf`);
         toast.success('Relatório gerado com sucesso!', { id: 'pdf-gen' });
       } catch (error) {
         console.error('Erro ao gerar PDF:', error);
         toast.error('Erro ao gerar relatório PDF', { id: 'pdf-gen' });
       } finally {
         setPdfLoading(false);
       }
       return;
    }


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
      default:
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase">Taxa Ocupação</p>
                <p className="text-xl font-bold text-white">{data?.totals.avgOccupancy || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase">Energia Total</p>
                <p className="text-xl font-bold text-white">{Number(data?.totals.totalEnergy || 0).toFixed(1)} kWh</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase">Disponibilidade</p>
                <p className="text-xl font-bold text-white">{data?.totals.avgAvailability || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase">Sessões</p>
                <p className="text-xl font-bold text-white">{data?.totals.totalSessions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase">Média Diária</p>
                <p className="text-xl font-bold text-white">{Number(data?.totals.avgUtilization || 0).toFixed(1)} kWh</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Performance
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-zinc-800/50 p-1">
                {(Object.keys(metricsConfig) as MetricType[]).map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setSelectedMetric(metric)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      selectedMetric === metric
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    {metricsConfig[metric].label.split(' ')[0]}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg bg-zinc-800/50 p-1">
                {(['7d', '15d', '30d', '90d'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      period === p
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    {p === '7d' ? '7 dias' : p === '15d' ? '15 dias' : p === '30d' ? '30 dias' : '90 dias'}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg bg-zinc-800/50 p-1">
                {(['area', 'bar', 'line'] as ChartType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                      chartType === type
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    {type === 'area' ? 'Área' : type === 'bar' ? 'Barras' : 'Linha'}
                  </button>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={fetchData}
                disabled={isLoading}
                className="text-zinc-300 hover:bg-zinc-700"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-white animate-spin" />
            </div>
          ) : (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-medium">Exportar Relatório</h3>
              <p className="text-sm text-zinc-400">Baixe os dados de performance em diferentes formatos</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                className="border-zinc-700 text-zinc-300"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('excel')}
                className="border-zinc-700 text-zinc-300"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                disabled={pdfLoading}
                className="border-zinc-700 text-zinc-300"
              >
                {pdfLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                PDF Profissional
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        {data && (
          <PerformanceReportTemplate 
            data={{
              locationName: locationName || `Local #${locationId}`,
              totalKwh: data.totals.totalEnergy,
              sessionsCount: data.totals.totalSessions,
              avgOccupancy: data.totals.avgOccupancy,
              avgUtilization: data.totals.avgUtilization,
              avgAvailability: data.totals.avgAvailability,
              chartData: chartData
            }}
            period={period === '7d' ? 'Últimos 7 dias' : period === '15d' ? 'Últimos 15 dias' : period === '30d' ? 'Últimos 30 dias' : 'Últimos 90 dias'}
            generationDate={new Date().toLocaleString('pt-BR')}
          />
        )}
      </div>
    </div>
  );
}

export default LocationPerformanceTab;
