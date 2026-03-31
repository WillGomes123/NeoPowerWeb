import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { AlarmSeverity } from '../types';

interface AlarmEntry {
  id: string;
  charger_id: string;
  connector_id: number;
  error_code: string;
  severity: AlarmSeverity;
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  timestamp: string;
  resolved_at?: string;
  location_name?: string;
}

const SEVERITY_CONFIG: Record<AlarmSeverity, { color: string; bg: string; border: string; dot: string; label: string; icon: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-400 animate-pulse', label: 'Crítico', icon: 'warning' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400', label: 'Alto', icon: 'error' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: 'bg-yellow-400', label: 'Médio', icon: 'info' },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-400', label: 'Baixo', icon: 'notifications' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Ativo' },
  acknowledged: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Reconhecido' },
  resolved: { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', label: 'Resolvido' },
};

const ERROR_DESCRIPTIONS: Record<string, string> = {
  ConnectorLockFailure: 'Falha no travamento do conector',
  EVCommunicationError: 'Erro de comunicação com veículo',
  GroundFailure: 'Falha de aterramento',
  HighTemperature: 'Temperatura elevada',
  InternalError: 'Erro interno do carregador',
  OtherError: 'Outro erro',
  OverCurrentFailure: 'Sobrecorrente detectada',
  OverVoltage: 'Sobretensão detectada',
  PowerMeterFailure: 'Falha no medidor de energia',
  PowerSwitchFailure: 'Falha no interruptor de energia',
  ReaderFailure: 'Falha no leitor RFID',
  ResetFailure: 'Falha no reset',
  UnderVoltage: 'Subtensão detectada',
  WeakSignal: 'Sinal fraco de comunicação',
  Offline: 'Carregador offline',
  FirmwareFailed: 'Falha na atualização de firmware',
};

type FilterSeverity = 'all' | AlarmSeverity;
type FilterStatus = 'all' | 'active' | 'acknowledged' | 'resolved';

export const Alarms = () => {
  const [alarms, setAlarms] = useState<AlarmEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => { void fetchAlarms(); }, []);

  const fetchAlarms = async () => {
    setLoading(true);
    try {
      // Tenta endpoint dedicado de alarmes
      const res = await api.get('/alarms');
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        if (arr.length > 0) {
          setAlarms(arr);
          return;
        }
      }
      // Fallback: gera a partir dos carregadores
      const chargersRes = await api.get('/chargers');
      if (chargersRes.ok) {
        const chargers = await chargersRes.json();
        const generated = generateAlarmsFromChargers(Array.isArray(chargers) ? chargers : []);
        setAlarms(generated);
      } else {
        setAlarms([]);
      }
    } catch {
      setAlarms([]);
    } finally {
      setLoading(false);
    }
  };

  const generateAlarmsFromChargers = (chargers: any[]): AlarmEntry[] => {
    const result: AlarmEntry[] = [];
    for (const cp of chargers) {
      const cpId = cp.charge_point_id || cp.id || 'UNKNOWN';
      const locName = cp.location_name || cp.address || '';

      if (cp.status === 'offline' || cp.is_online === false) {
        result.push({
          id: `${cpId}-offline`,
          charger_id: cpId,
          connector_id: 0,
          error_code: 'Offline',
          severity: 'high',
          status: 'active',
          message: `Carregador ${cpId} está offline. Sem heartbeat recente.`,
          timestamp: cp.last_heartbeat || new Date().toISOString(),
          location_name: locName,
        });
      }

      const connectors = cp.connectors || [];
      for (const conn of connectors) {
        if (conn.status === 'Faulted' || conn.error_code && conn.error_code !== 'NoError') {
          const errCode = conn.error_code || 'InternalError';
          result.push({
            id: `${cpId}-${conn.connector_id}-${errCode}`,
            charger_id: cpId,
            connector_id: conn.connector_id || 1,
            error_code: errCode,
            severity: ['GroundFailure', 'OverCurrentFailure', 'OverVoltage'].includes(errCode) ? 'critical' : ['HighTemperature', 'UnderVoltage', 'PowerSwitchFailure'].includes(errCode) ? 'high' : 'medium',
            status: 'active',
            message: ERROR_DESCRIPTIONS[errCode] || `Erro: ${errCode}`,
            timestamp: conn.timestamp || new Date().toISOString(),
            location_name: locName,
          });
        }
      }
    }

    return result.sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return sevOrder[a.severity] - sevOrder[b.severity] || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  };

  const handleAcknowledge = (alarmId: string) => {
    setAlarms(prev => prev.map(a => a.id === alarmId ? { ...a, status: 'acknowledged' as const } : a));
    toast.success('Alarme reconhecido');
  };

  const handleResolve = (alarmId: string) => {
    setAlarms(prev => prev.map(a => a.id === alarmId ? { ...a, status: 'resolved' as const, resolved_at: new Date().toISOString() } : a));
    toast.success('Alarme resolvido');
  };

  const filtered = useMemo(() => {
    return alarms.filter(a => {
      if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      return true;
    });
  }, [alarms, filterSeverity, filterStatus]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const current = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const activeCount = alarms.filter(a => a.status === 'active').length;
  const criticalCount = alarms.filter(a => a.severity === 'critical' && a.status === 'active').length;
  const acknowledgedCount = alarms.filter(a => a.status === 'acknowledged').length;
  const resolvedCount = alarms.filter(a => a.status === 'resolved').length;

  const formatDt = (iso: string) => new Date(iso).toLocaleString('pt-BR');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">MONITORAMENTO</span>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Alarmes</h2>
          <p className="text-on-surface-variant text-sm mt-1">Alertas e falhas dos carregadores OCPP</p>
        </div>
        <button onClick={() => void fetchAlarms()} className="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/10 text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-sm">refresh</span>
          <span className="text-xs font-bold font-headline uppercase tracking-wider">Atualizar</span>
        </button>
      </div>

      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3 animate-pulse">
          <span className="material-symbols-outlined text-red-400 text-2xl">warning</span>
          <div>
            <p className="text-red-400 font-bold text-sm">{criticalCount} alarme(s) crítico(s) ativo(s)</p>
            <p className="text-red-400/70 text-xs">Ação imediata necessária</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <AlarmKPI icon="notification_important" color="text-red-400" bg="bg-red-500/10" label="ATIVOS" value={activeCount} />
        <AlarmKPI icon="warning" color="text-orange-400" bg="bg-orange-500/10" label="CRÍTICOS" value={criticalCount} />
        <AlarmKPI icon="visibility" color="text-yellow-400" bg="bg-yellow-500/10" label="RECONHECIDOS" value={acknowledgedCount} />
        <AlarmKPI icon="check_circle" color="text-primary" bg="bg-primary/10" label="RESOLVIDOS" value={resolvedCount} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-surface-container-low p-1 rounded-lg flex items-center border border-outline-variant/10">
          {(['all', 'critical', 'high', 'medium', 'low'] as FilterSeverity[]).map(s => (
            <button key={s} onClick={() => { setFilterSeverity(s); setCurrentPage(1); }} className={`px-3 py-1.5 text-xs font-bold font-headline rounded-md transition-all ${filterSeverity === s ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {s === 'all' ? 'TODOS' : SEVERITY_CONFIG[s].label.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="bg-surface-container-low p-1 rounded-lg flex items-center border border-outline-variant/10">
          {(['all', 'active', 'acknowledged', 'resolved'] as FilterStatus[]).map(s => (
            <button key={s} onClick={() => { setFilterStatus(s); setCurrentPage(1); }} className={`px-3 py-1.5 text-xs font-bold font-headline rounded-md transition-all ${filterStatus === s ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {s === 'all' ? 'TODOS' : STATUS_CONFIG[s].label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Alarms Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="text-lg font-headline font-bold text-on-surface">Histórico de Alarmes</h3>
          <span className="text-xs text-on-surface-variant">{filtered.length} alarme(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                <th className="px-6 py-4">Severidade</th>
                <th className="px-6 py-4">Carregador</th>
                <th className="px-6 py-4">Conector</th>
                <th className="px-6 py-4">Erro</th>
                <th className="px-6 py-4">Mensagem</th>
                <th className="px-6 py-4">Local</th>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {current.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline mb-3 block">check_circle</span>
                    <p className="text-sm text-on-surface-variant">Nenhum alarme encontrado</p>
                  </td>
                </tr>
              ) : current.map(alarm => {
                const sev = SEVERITY_CONFIG[alarm.severity];
                const st = STATUS_CONFIG[alarm.status] || STATUS_CONFIG.active;
                return (
                  <tr key={alarm.id} className="hover:bg-surface-container-highest/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${sev.bg} ${sev.color} ${sev.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{alarm.charger_id}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{alarm.connector_id || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2 py-1 rounded">{alarm.error_code}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[240px] truncate">{alarm.message}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{alarm.location_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDt(alarm.timestamp)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.color} ${st.border}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {alarm.status === 'active' && (
                          <button onClick={() => handleAcknowledge(alarm.id)} title="Reconhecer" className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400 hover:bg-yellow-500/20 transition-colors">
                            <span className="material-symbols-outlined text-base">visibility</span>
                          </button>
                        )}
                        {alarm.status !== 'resolved' && (
                          <button onClick={() => handleResolve(alarm.id)} title="Resolver" className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                            <span className="material-symbols-outlined text-base">check_circle</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-outline-variant/10 flex justify-between items-center">
          <p className="text-xs text-on-surface-variant">
            Página <span className="font-bold text-on-surface">{currentPage}</span> de <span className="font-bold text-on-surface">{totalPages || 1}</span>
          </p>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10">
              <span className="material-symbols-outlined text-base">chevron_left</span>Anterior
            </button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10">
              Próxima<span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function AlarmKPI({ icon, color, bg, label, value }: { icon: string; color: string; bg: string; label: string; value: number }) {
  return (
    <div className="glass-card p-6 rounded-xl border border-outline-variant/10 relative overflow-hidden">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center ${color} mb-3`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <p className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-2xl font-headline font-bold text-on-surface">{value}</h3>
    </div>
  );
}
