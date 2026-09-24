import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, subDays, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { cn, dataLocal } from '@/components/ui/utils';
import {
  Activity,
  BatteryCharging,
  CalendarX,
  ChartArea,
  ChartColumn,
  ChartLine,
  Download,
  Gauge,
  RefreshCw,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { exportToCSV, exportToExcel } from '@/lib/export';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { PerformanceReportTemplate } from '../PerformanceReportTemplate';

import {
  AreaChart,
  BarChart,
  LineChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * Contrato de GET /locations/:id/performance. `isoDates` e `period` só vêm da
 * API que aceita startDate/endDate; a antiga responde apenas ao `period`
 * (7d/30d/90d) — nesse caso o painel mostra o período aproximado.
 */
interface PerformanceData {
  dates: string[];
  isoDates?: string[];
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
  period?: { startDate: string; endDate: string; days: number };
}

interface Props {
  locationId: number;
  locationName?: string;
}

interface Periodo {
  start: string;
  end: string;
}

type ChartType = 'area' | 'bar' | 'line';
type MetricType = 'occupancy' | 'utilization' | 'availability';

interface PontoGrafico {
  key: string;
  iso?: string;
  date: string;
  occupancy: number;
  utilization: number;
  availability: number;
}

const METRICAS: Record<MetricType, { rotulo: string; unidade: string; descricao: string }> = {
  occupancy: {
    rotulo: 'Ocupação',
    unidade: '%',
    descricao: 'Horas em uso ÷ capacidade do dia (24h por carregador)',
  },
  utilization: { rotulo: 'Energia', unidade: 'kWh', descricao: 'Energia entregue por dia, em kWh' },
  availability: {
    rotulo: 'Disponibilidade',
    unidade: '%',
    descricao: 'Estimativa diária de disponibilidade dos carregadores',
  },
};

const TIPOS: { tipo: ChartType; rotulo: string; Icone: LucideIcon }[] = [
  { tipo: 'area', rotulo: 'Área', Icone: ChartArea },
  { tipo: 'bar', rotulo: 'Barras', Icone: ChartColumn },
  { tipo: 'line', rotulo: 'Linha', Icone: ChartLine },
];

const ATALHOS = [7, 15, 30, 90];

const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const isoDe = (d: Date) => format(d, 'yyyy-MM-dd');

function ultimosDias(n: number): Periodo {
  const hoje = new Date();
  return { start: isoDe(subDays(hoje, n - 1)), end: isoDe(hoje) };
}

const diasNoPeriodo = (p: Periodo) =>
  differenceInCalendarDays(dataLocal(p.end), dataLocal(p.start)) + 1;

/** `period` aceito pela API antiga (7d, 30d, 90d) mais próximo do intervalo. */
function periodoLegado(p: Periodo): '7d' | '30d' | '90d' {
  const dias = diasNoPeriodo(p);
  if (dias <= 7) return '7d';
  if (dias <= 30) return '30d';
  return '90d';
}

const dataCurta = (iso: string) => format(dataLocal(iso), 'dd/MM/yyyy');

function descreverPeriodo(p: Periodo): string {
  const dias = diasNoPeriodo(p);
  if (p.start === p.end)
    return `${format(dataLocal(p.start), "EEEE, dd 'de' MMMM", { locale: ptBR })}`;
  return `${dataCurta(p.start)} a ${dataCurta(p.end)} · ${dias} dias`;
}

function formatarValor(v: number, unidade: string): string {
  return `${nf1.format(v)}${unidade === '%' ? '%' : ` ${unidade}`}`;
}

interface KpiProps {
  rotulo: string;
  valor: string;
  unidade?: string;
  dica: string;
  Icone: LucideIcon;
  carregando: boolean;
  className?: string;
}

function Kpi({ rotulo, valor, unidade, dica, Icone, carregando, className }: KpiProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-4',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
          {rotulo}
        </span>
        <Icone className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      </div>
      {carregando ? (
        <div className="h-8 w-20 animate-pulse rounded-md bg-surface-container-high" />
      ) : (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1">
          <span className="text-xl font-semibold leading-8 tabular-nums sm:text-2xl text-foreground">
            {valor}
          </span>
          {unidade && <span className="text-sm text-muted-foreground">{unidade}</span>}
        </div>
      )}
      <span className="text-[11px] leading-tight text-muted-foreground/80">{dica}</span>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { value?: number; payload?: PontoGrafico }[];
  unidade: string;
}

function TooltipGrafico({ active, payload, unidade }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload;
  const valor = Number(payload[0].value ?? 0);
  const titulo = ponto?.iso
    ? format(dataLocal(ponto.iso), "EEE, dd 'de' MMM yyyy", { locale: ptBR })
    : ponto?.date;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground first-letter:uppercase">{titulo}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {formatarValor(valor, unidade)}
      </p>
    </div>
  );
}

export function LocationPerformanceTab({ locationId, locationName }: Props) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // `rascunho` acompanha o calendário (pode estar pela metade enquanto o
  // usuário escolhe); `periodo` é o intervalo completo que vai para a API.
  const [rascunho, setRascunho] = useState<Periodo>(() => ultimosDias(30));
  const [periodo, setPeriodo] = useState<Periodo>(() => ultimosDias(30));
  const rascunhoRef = useRef(rascunho);
  const requisicao = useRef(0);
  const [chartType, setChartType] = useState<ChartType>('area');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('occupancy');
  const [pdfLoading, setPdfLoading] = useState(false);

  const alterarPeriodo = useCallback((start: string, end: string) => {
    if (!start && !end) {
      const padrao = ultimosDias(30);
      rascunhoRef.current = padrao;
      setRascunho(padrao);
      setPeriodo(padrao);
      return;
    }
    rascunhoRef.current = { start, end };
    setRascunho({ start, end });
    if (start && end) setPeriodo(start <= end ? { start, end } : { start: end, end: start });
  }, []);

  const fetchData = useCallback(async () => {
    const id = ++requisicao.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: periodo.start,
        endDate: periodo.end,
        // Compatibilidade com a API antiga, que só entende `period`.
        period: periodoLegado(periodo),
      });
      const response = await api.get(`/locations/${locationId}/performance?${params.toString()}`);
      if (!response.ok) throw new Error('Erro ao carregar performance');
      const result = (await response.json()) as PerformanceData;
      if (id === requisicao.current) setData(result);
    } catch (error) {
      console.error('Erro ao carregar performance:', error);
      if (id === requisicao.current) toast.error('Erro ao carregar dados de performance');
    } finally {
      if (id === requisicao.current) setIsLoading(false);
    }
  }, [locationId, periodo]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const chartData = useMemo<PontoGrafico[]>(
    () =>
      data?.dates.map((date, index) => ({
        key: data.isoDates?.[index] ?? `${index}`,
        iso: data.isoDates?.[index],
        date,
        occupancy: data.occupancyRate[index] ?? 0,
        utilization: data.utilization[index] ?? 0,
        availability: data.availability[index] ?? 0,
      })) ?? [],
    [data]
  );

  // Período que os números representam: o devolvido pela API; na API antiga,
  // os últimos N dias do `period` enviado.
  const periodoDosDados = data?.period
    ? { start: data.period.startDate, end: data.period.endDate }
    : null;
  const legado = !!data && !data.period;
  const textoPeriodo = periodoDosDados
    ? descreverPeriodo(periodoDosDados)
    : legado
      ? `Últimos ${periodoLegado(periodo).replace('d', '')} dias (aproximado)`
      : descreverPeriodo(periodo);
  const rotuloArquivo = periodoDosDados
    ? `${periodoDosDados.start}_a_${periodoDosDados.end}`
    : `${periodo.start}_a_${periodo.end}`;

  const semRecargas = !!data && data.totals.totalSessions === 0;
  const hoje = isoDe(new Date());

  const handleExport = async (formato: 'csv' | 'excel' | 'pdf') => {
    if (!data) return;

    if (formato === 'pdf') {
      setPdfLoading(true);
      toast.loading('Gerando relatório de performance...', { id: 'pdf-gen' });

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
          onclone: doc => {
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
          },
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

        pdf.save(`performance_local_${locationId}_${rotuloArquivo}.pdf`);
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
      Data: d.iso ? dataCurta(d.iso) : d.date,
      'Taxa de Ocupação (%)': d.occupancy,
      'Utilização (kWh)': d.utilization,
      'Disponibilidade (%)': d.availability,
    }));

    const columns = [
      { key: 'Data', header: 'Data' },
      { key: 'Taxa de Ocupação (%)', header: 'Taxa de Ocupação (%)', format: 'number' as const },
      { key: 'Utilização (kWh)', header: 'Utilização (kWh)', format: 'number' as const },
      { key: 'Disponibilidade (%)', header: 'Disponibilidade (%)', format: 'number' as const },
    ];

    const options = {
      filename: `performance_local_${locationId}_${rotuloArquivo}`,
      title: `Relatório de Performance - ${locationName || `Local ${locationId}`} (${textoPeriodo})`,
      columns,
      data: exportData,
    };

    if (formato === 'csv') {
      exportToCSV(options);
      toast.success('Relatório CSV exportado');
    } else {
      exportToExcel(options);
      toast.success('Relatório Excel exportado');
    }
  };

  const renderChart = () => {
    const metrica = METRICAS[selectedMetric];
    // Com 1–2 pontos (Hoje, Ontem) área e linha viram um ponto solto.
    const tipo: ChartType = chartData.length < 3 ? 'bar' : chartType;
    const muitosPontos = chartData.length > 45;

    const eixos = (
      <>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="key"
          tickFormatter={(chave: string) =>
            /^\d{4}-\d{2}-\d{2}$/.test(chave)
              ? format(dataLocal(chave), 'dd/MM')
              : (chartData[Number(chave)]?.date ?? '')
          }
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={16}
          tickMargin={8}
        />
        <YAxis
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={44}
          domain={selectedMetric === 'availability' ? [0, 100] : [0, 'auto']}
          tickFormatter={(v: number) =>
            metrica.unidade === '%' ? `${nf0.format(v)}%` : nf0.format(v)
          }
        />
        <Tooltip
          content={<TooltipGrafico unidade={metrica.unidade} />}
          cursor={
            tipo === 'bar'
              ? { fill: 'var(--color-surface-container-high)', opacity: 0.5 }
              : { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' }
          }
        />
      </>
    );

    const margem = { top: 12, right: 8, left: 0, bottom: 0 };

    if (tipo === 'bar') {
      return (
        <BarChart data={chartData} margin={margem}>
          {eixos}
          <Bar
            dataKey={selectedMetric}
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      );
    }
    if (tipo === 'line') {
      return (
        <LineChart data={chartData} margin={margem}>
          {eixos}
          <Line
            type="monotone"
            dataKey={selectedMetric}
            stroke="var(--primary)"
            strokeWidth={2}
            dot={muitosPontos ? false : { r: 3, strokeWidth: 0, fill: 'var(--primary)' }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-card)' }}
          />
        </LineChart>
      );
    }
    return (
      <AreaChart data={chartData} margin={margem}>
        <defs>
          <linearGradient id="performance-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {eixos}
        <Area
          type="monotone"
          dataKey={selectedMetric}
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#performance-area)"
          activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-card)' }}
        />
      </AreaChart>
    );
  };

  const totals = data?.totals;

  return (
    <div className="space-y-5">
      {/* Cabeçalho: período */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">Performance do local</h3>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{textoPeriodo}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div
            className="grid grid-cols-4 rounded-lg bg-surface-container p-1"
            role="group"
            aria-label="Atalhos de período"
          >
            {ATALHOS.map(n => {
              const ativo = periodo.end === hoje && diasNoPeriodo(periodo) === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    const p = ultimosDias(n);
                    alterarPeriodo(p.start, p.end);
                  }}
                  aria-pressed={ativo}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    ativo
                      ? 'bg-primary text-on-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {n} dias
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <DateRangePicker
              startDate={rascunho.start}
              endDate={rascunho.end}
              onStartDateChange={v => alterarPeriodo(v, rascunhoRef.current.end)}
              onEndDateChange={v => alterarPeriodo(rascunhoRef.current.start, v)}
              className="h-9 min-w-0 flex-1 sm:w-[284px] sm:flex-none"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void fetchData()}
              disabled={isLoading}
              className="h-9 w-9 shrink-0 border-border"
              aria-label="Atualizar"
              title="Atualizar"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          rotulo="Ocupação"
          valor={nf1.format(totals?.avgOccupancy ?? 0)}
          unidade="%"
          dica="média do período"
          Icone={Gauge}
          carregando={isLoading && !data}
        />
        <Kpi
          rotulo="Energia total"
          valor={nf1.format(totals?.totalEnergy ?? 0)}
          unidade="kWh"
          dica="entregue no período"
          Icone={Zap}
          carregando={isLoading && !data}
        />
        <Kpi
          rotulo="Disponibilidade"
          valor={nf1.format(totals?.avgAvailability ?? 0)}
          unidade="%"
          dica="online agora"
          Icone={Wifi}
          carregando={isLoading && !data}
        />
        <Kpi
          rotulo="Sessões"
          valor={nf0.format(totals?.totalSessions ?? 0)}
          dica="recargas concluídas"
          Icone={Activity}
          carregando={isLoading && !data}
        />
        <Kpi
          rotulo="Média diária"
          valor={nf1.format(totals?.avgUtilization ?? 0)}
          unidade="kWh"
          dica="energia por dia"
          Icone={BatteryCharging}
          carregando={isLoading && !data}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Gráfico */}
      <Card className="gap-0 overflow-hidden border-border bg-card p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">Evolução diária</h4>
            <p className="text-xs text-muted-foreground">{METRICAS[selectedMetric].descricao}</p>
          </div>

          <div
            className="order-last flex w-full rounded-lg bg-surface-container p-1 sm:order-none sm:w-auto"
            role="tablist"
            aria-label="Métrica do gráfico"
          >
            {(Object.keys(METRICAS) as MetricType[]).map(m => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={selectedMetric === m}
                onClick={() => setSelectedMetric(m)}
                className={cn(
                  'flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-3',
                  selectedMetric === m
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {METRICAS[m].rotulo}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5" role="group" aria-label="Tipo de gráfico">
            {TIPOS.map(({ tipo, rotulo, Icone }) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setChartType(tipo)}
                aria-pressed={chartType === tipo}
                aria-label={rotulo}
                title={rotulo}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  chartType === tipo
                    ? 'bg-surface-container-high text-foreground'
                    : 'text-muted-foreground/70 hover:text-foreground'
                )}
              >
                <Icone className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="px-2 pb-3 pt-5 sm:px-4">
          {isLoading && !data ? (
            <div className="flex h-[300px] items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : semRecargas || chartData.length === 0 ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-full bg-surface-container p-3">
                <CalendarX className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Sem recargas no período</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nenhuma sessão concluída neste intervalo. Escolha outro período no calendário.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={cn('h-[300px] transition-opacity sm:h-[340px]', isLoading && 'opacity-60')}
            >
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Exportação */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Exportar relatório</p>
          <p className="text-xs text-muted-foreground">Dados diários do período selecionado</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport('csv')}
            disabled={!data}
            className="border-border text-foreground/80"
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport('excel')}
            disabled={!data}
            className="border-border text-foreground/80"
          >
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport('pdf')}
            disabled={!data || pdfLoading}
            className="border-border text-foreground/80"
          >
            {pdfLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF
          </Button>
        </div>
      </div>

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
              chartData: chartData,
            }}
            period={textoPeriodo}
            generationDate={new Date().toLocaleString('pt-BR')}
          />
        )}
      </div>
    </div>
  );
}

export default LocationPerformanceTab;
