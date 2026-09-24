import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';

interface MeterPoint {
  timestamp: string;
  power_kw: number;
  current_a: number;
  voltage_v: number;
  soc_percent: number | null;
  /** Energia da recarga até esta leitura (a API já desconta o medidor inicial). */
  energy_kwh: number;
}

/** Números da própria transação: valem mesmo sem leituras intermediárias. */
export interface ResumoRecarga {
  inicio: string;
  fim: string | null;
  energiaKwh: number;
  medidorInicialWh: number | null;
  medidorFinalWh: number | null;
  custo: number;
  emAndamento: boolean;
}

interface Props {
  transactionId: number;
  chargerId: string;
  resumo?: ResumoRecarga;
  open: boolean;
  onClose: () => void;
}

const num = (v: number, casas = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function duracao(inicio: string, fim: string | null): { minutos: number; texto: string } {
  const ms = (fim ? new Date(fim).getTime() : Date.now()) - new Date(inicio).getTime();
  const minutos = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return { minutos, texto: h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min` };
}

export const ChargingCurveDialog = ({ transactionId, chargerId, resumo, open, onClose }: Props) => {
  const [data, setData] = useState<MeterPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  // Só leituras reais do medidor. Antes, sem leituras (ou com erro na API), a
  // tela desenhava uma curva INVENTADA — 60 min a 7,4 kW, tensão aleatória e
  // SoC fictício — e o operador via "Energia total" de uma recarga que não
  // tinha dado nenhum.
  const buscarLeituras = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const res = await api.get(`/chargers/${encodeURIComponent(chargerId)}/transactions/${transactionId}/meter-values`);
      if (!res.ok) {
        setErro(true);
        setData([]);
        return;
      }
      const raw: unknown = await res.json();
      setData(Array.isArray(raw) ? (raw as MeterPoint[]) : []);
    } catch {
      setErro(true);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [chargerId, transactionId]);

  useEffect(() => {
    if (!open) return;
    void buscarLeituras();
  }, [open, buscarLeituras]);

  if (!open) return null;

  const temCurva = data.length > 1;
  const hasSoc = data.some(d => d.soc_percent != null && d.soc_percent > 0);
  const picoPotencia = temCurva ? Math.max(...data.map(d => d.power_kw || 0)) : 0;
  const picoCorrente = temCurva ? Math.max(...data.map(d => d.current_a || 0)) : 0;
  const tensoes = data.map(d => d.voltage_v).filter(v => v > 0);
  const tensaoMedia = tensoes.length ? tensoes.reduce((a, b) => a + b, 0) / tensoes.length : 0;

  // Energia: a da transação (medidor do início e do fim) é a oficial; sem ela,
  // a última leitura da curva.
  const energia = resumo?.energiaKwh ?? (data.length ? data[data.length - 1].energy_kwh : 0);
  const dur = resumo ? duracao(resumo.inicio, resumo.fim) : null;
  const potenciaMedia = dur && dur.minutos > 0 ? energia / (dur.minutos / 60) : 0;

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1a1919', border: '1px solid #494847', borderRadius: '8px', padding: '12px' },
    labelStyle: { color: '#adaaaa', marginBottom: '6px', fontSize: '12px' },
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-low rounded-2xl border border-outline-variant/10 w-[900px] max-w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex justify-between items-start gap-4 px-5 sm:px-8 py-5 sm:py-6 border-b border-outline-variant/10">
          <div className="min-w-0">
            <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">Apuração da recarga</span>
            <h3 className="text-xl sm:text-2xl font-headline font-bold text-on-surface">Transação #{transactionId}</h3>
            <p className="text-sm text-on-surface-variant mt-1 truncate">
              {chargerId}
              {resumo ? ` · ${dataHora(resumo.inicio)}${resumo.fim ? ` até ${hora(resumo.fim)}` : ' · em andamento'}` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Números da transação */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-5 sm:px-8 pt-5 sm:pt-6">
          <MiniKPI icon="bolt" label="Energia entregue" value={`${num(energia, 3)} kWh`} color="text-primary" destaque />
          {dur && <MiniKPI icon="schedule" label="Duração" value={dur.texto} color="text-secondary" />}
          {dur && <MiniKPI icon="avg_pace" label="Potência média" value={potenciaMedia > 0 ? `${num(potenciaMedia, 1)} kW` : '—'} color="text-secondary" />}
          {resumo && <MiniKPI icon="payments" label={resumo.emAndamento ? 'Custo parcial' : 'Custo'} value={`R$ ${num(resumo.custo)}`} color="text-tertiary" />}
          {resumo && resumo.medidorInicialWh != null && (
            <MiniKPI
              icon="speed"
              label="Medidor (kWh)"
              value={`${num(resumo.medidorInicialWh / 1000, 3)} → ${resumo.medidorFinalWh != null ? num(resumo.medidorFinalWh / 1000, 3) : '…'}`}
              color="text-on-surface-variant"
              pequeno
            />
          )}
        </div>

        {/* Curva */}
        <div className="px-5 sm:px-8 py-5 sm:py-6">
          <div className="glass-panel rounded-lg border border-outline-variant/10 p-4 sm:p-6">
            {loading ? (
              <div className="h-[260px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !temCurva ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-center gap-2 px-4">
                <span className="material-symbols-outlined text-3xl text-outline">{erro ? 'cloud_off' : 'show_chart'}</span>
                <p className="text-sm font-medium text-on-surface">
                  {erro ? 'Não foi possível carregar as leituras agora' : 'Sem leituras do medidor durante esta recarga'}
                </p>
                <p className="text-xs text-on-surface-variant max-w-md">
                  {erro
                    ? 'Tente abrir de novo em instantes.'
                    : 'O carregador não enviou medições intermediárias. A energia acima vem das leituras do medidor no início e no fim da recarga.'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
                  <ChartLegend color="bg-[#22c55e]" label="Potência (kW)" />
                  {hasSoc && <ChartLegend color="bg-[#3b82f6]" label="SoC (%)" dashed />}
                  <ChartLegend color="bg-[#f59e0b]" label="Energia acumulada (kWh)" />
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest sm:ml-auto">
                    Pico {num(picoPotencia, 1)} kW · {num(picoCorrente, 1)} A{tensaoMedia > 0 ? ` · ${num(tensaoMedia, 0)} V` : ''}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#494847" strokeOpacity={0.3} vertical={false} />
                    <XAxis dataKey="timestamp" stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} tickFormatter={hora} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis yAxisId="power" stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => `${v} kW`} />
                    <YAxis yAxisId="energia" orientation="right" stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} width={hasSoc ? 0 : 56} hide={hasSoc} tickFormatter={(v: number) => `${v} kWh`} />
                    {hasSoc && (
                      <YAxis yAxisId="soc" orientation="right" stroke="#777575" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} width={44} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    )}
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(label: string) => `Horário: ${hora(label)}`}
                      formatter={(value: number, name: string) => {
                        if (name === 'power_kw') return [`${num(value, 2)} kW`, 'Potência'];
                        if (name === 'soc_percent') return [`${num(value, 1)}%`, 'SoC'];
                        if (name === 'energy_kwh') return [`${num(value, 3)} kWh`, 'Energia acumulada'];
                        return [value, name];
                      }}
                    />
                    <Area yAxisId="power" type="monotone" dataKey="power_kw" fill="url(#powerGrad)" stroke="#22c55e" strokeWidth={2.5} dot={false} activeDot={{ r: 4, stroke: '#0e0e0e', strokeWidth: 2, fill: '#22c55e' }} />
                    {hasSoc && (
                      <Line yAxisId="soc" type="monotone" dataKey="soc_percent" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                    )}
                    <Line yAxisId="energia" type="monotone" dataKey="energy_kwh" stroke="#f59e0b" strokeWidth={1.5} dot={false} opacity={0.8} />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function MiniKPI({ icon, label, value, color, destaque, pequeno }: {
  icon: string; label: string; value: string; color: string; destaque?: boolean; pequeno?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 sm:p-4 border ${destaque ? 'bg-primary/5 border-primary/20' : 'bg-surface-container border-outline-variant/10'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`material-symbols-outlined text-base ${color}`}>{icon}</span>
        <span className="text-[10px] text-on-surface-variant uppercase tracking-widest leading-tight">{label}</span>
      </div>
      <p className={`${pequeno ? 'text-sm' : 'text-lg'} font-headline font-bold text-on-surface break-words`}>{value}</p>
    </div>
  );
}

function ChartLegend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-4 h-0.5 ${color} ${dashed ? 'border-t-2 border-dashed border-current bg-transparent' : ''}`} style={dashed ? { borderColor: color.replace('bg-[', '').replace(']', '') } : {}} />
      <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">{label}</span>
    </div>
  );
}
