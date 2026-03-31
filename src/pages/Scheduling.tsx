import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

interface Schedule {
  id: string;
  charger_id: string;
  connector_id: number;
  schedule_type: 'once' | 'recurring';
  start_time: string;
  end_time: string;
  days_of_week: number[];
  max_rate_kw: number;
  id_tag: string;
  enabled: boolean;
  charger_name?: string;
}

interface ChargerOption {
  id: string;
  label: string;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const Scheduling = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [chargers, setChargers] = useState<ChargerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    charger_id: '',
    connector_id: 1,
    schedule_type: 'recurring' as 'once' | 'recurring',
    start_time: '22:00',
    end_time: '06:00',
    days_of_week: [1, 2, 3, 4, 5] as number[],
    max_rate_kw: 7.4,
    id_tag: '',
    date: '',
  });

  useEffect(() => { void fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/chargers');
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setChargers(arr.map((c: any) => ({
          id: c.charge_point_id || c.id,
          label: c.charge_point_id || c.id,
        })));
      }
    } catch { /* ignore */ }

    // Busca agendamentos da API
    try {
      const schedRes = await api.get('/schedules');
      if (schedRes.ok) {
        const data = await schedRes.json();
        const arr = Array.isArray(data) ? data : [];
        setSchedules(arr.map((s: any) => ({ ...s, id: String(s.id), charger_name: s.charger_id })));
      } else {
        setSchedules([]);
      }
    } catch {
      setSchedules([]);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.charger_id) { toast.error('Selecione um carregador'); return; }
    if (!form.id_tag) { toast.error('Informe o ID Tag'); return; }

    try {
      if (editingId) {
        const res = await api.put(`/schedules/${editingId}`, form);
        if (res.ok) {
          toast.success('Agendamento atualizado');
          void fetchData();
        } else { toast.error('Erro ao atualizar'); }
      } else {
        const res = await api.post('/schedules', form);
        if (res.ok) {
          toast.success('Agendamento criado');
          void fetchData();
        } else { toast.error('Erro ao criar'); }
      }
    } catch {
      toast.error('Erro de conexão');
    }

    resetForm();
  };

  const handleEdit = (schedule: Schedule) => {
    setForm({
      charger_id: schedule.charger_id,
      connector_id: schedule.connector_id,
      schedule_type: schedule.schedule_type,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      days_of_week: schedule.days_of_week,
      max_rate_kw: schedule.max_rate_kw,
      id_tag: schedule.id_tag,
      date: '',
    });
    setEditingId(schedule.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await api.delete(`/schedules/${id}`);
      if (res.ok) {
        toast.success('Agendamento removido');
        void fetchData();
      } else { toast.error('Erro ao remover'); }
    } catch { toast.error('Erro de conexão'); }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await api.put(`/schedules/${id}/toggle`);
      if (res.ok) {
        void fetchData();
      } else { toast.error('Erro ao alternar'); }
    } catch { toast.error('Erro de conexão'); }
  };

  const resetForm = () => {
    setForm({ charger_id: '', connector_id: 1, schedule_type: 'recurring', start_time: '22:00', end_time: '06:00', days_of_week: [1, 2, 3, 4, 5], max_rate_kw: 7.4, id_tag: '', date: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

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
          <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">AUTOMAÇÃO</span>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Agendamentos</h2>
          <p className="text-on-surface-variant text-sm mt-1">Programe início e fim de recargas automaticamente</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm shadow-[0_8px_20px_color-mix(in_srgb,var(--primary),transparent_80%)] hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          NOVO AGENDAMENTO
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-surface-container-low rounded-2xl border border-outline-variant/10 w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center px-8 py-6 border-b border-outline-variant/10">
              <div>
                <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">CONFIGURAR</span>
                <h3 className="text-xl font-headline font-bold text-on-surface">{editingId ? 'Editar' : 'Novo'} Agendamento</h3>
              </div>
              <button onClick={resetForm} className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Charger + Connector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Carregador</label>
                  <select value={form.charger_id} onChange={e => setForm(prev => ({ ...prev, charger_id: e.target.value }))} className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50">
                    <option value="">Selecione...</option>
                    {chargers.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Conector</label>
                  <input type="number" min={1} max={4} value={form.connector_id} onChange={e => setForm(prev => ({ ...prev, connector_id: Number(e.target.value) }))} className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50" />
                </div>
              </div>

              {/* ID Tag */}
              <div>
                <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">ID Tag (autorização)</label>
                <input type="text" value={form.id_tag} onChange={e => setForm(prev => ({ ...prev, id_tag: e.target.value }))} placeholder="Ex: USER001" className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50" />
              </div>

              {/* Schedule Type */}
              <div>
                <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Tipo</label>
                <div className="flex gap-2">
                  {(['recurring', 'once'] as const).map(t => (
                    <button key={t} onClick={() => setForm(prev => ({ ...prev, schedule_type: t }))} className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all border ${form.schedule_type === t ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface-container text-on-surface-variant border-outline-variant/20 hover:border-primary/20'}`}>
                      <span className="material-symbols-outlined text-base align-middle mr-2">{t === 'recurring' ? 'repeat' : 'event'}</span>
                      {t === 'recurring' ? 'Recorrente' : 'Uma vez'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Days of week (recurring only) */}
              {form.schedule_type === 'recurring' && (
                <div>
                  <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Dias da Semana</label>
                  <div className="flex gap-2">
                    {DAYS.map((day, i) => (
                      <button key={i} onClick={() => toggleDay(i)} className={`w-10 h-10 rounded-lg text-xs font-bold transition-all border ${form.days_of_week.includes(i) ? 'bg-primary/20 text-primary border-primary/30' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date (once only) */}
              {form.schedule_type === 'once' && (
                <div>
                  <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Data</label>
                  <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50" />
                </div>
              )}

              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Início</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))} className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Fim</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(prev => ({ ...prev, end_time: e.target.value }))} className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50" />
                </div>
              </div>

              {/* Max Rate */}
              <div>
                <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Potência Máxima (kW)</label>
                <div className="flex items-center gap-4">
                  <input type="range" min={1} max={150} step={0.1} value={form.max_rate_kw} onChange={e => setForm(prev => ({ ...prev, max_rate_kw: Number(e.target.value) }))} className="flex-1 accent-primary" />
                  <span className="text-sm font-bold font-headline text-on-surface w-20 text-right">{form.max_rate_kw.toFixed(1)} kW</span>
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-on-surface-variant">
                  <span>1 kW</span>
                  <span>150 kW</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button onClick={resetForm} className="flex-1 px-6 py-3 rounded-lg border border-outline-variant/20 text-on-surface-variant font-bold text-sm hover:bg-surface-container-highest transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSubmit} className="flex-1 px-6 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-[0_8px_20px_color-mix(in_srgb,var(--primary),transparent_80%)] hover:scale-[1.02] active:scale-95 transition-all">
                  {editingId ? 'Salvar Alterações' : 'Criar Agendamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Cards */}
      {schedules.length === 0 ? (
        <div className="glass-panel rounded-lg border border-outline-variant/10 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-outline mb-3 block">schedule</span>
          <p className="text-on-surface-variant text-sm">Nenhum agendamento configurado</p>
          <p className="text-outline text-xs mt-1">Clique em "Novo Agendamento" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map(schedule => (
            <div key={schedule.id} className={`glass-panel rounded-xl border p-6 transition-all ${schedule.enabled ? 'border-outline-variant/10' : 'border-outline-variant/5 opacity-50'}`}>
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${schedule.enabled ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined">{schedule.schedule_type === 'recurring' ? 'repeat' : 'event'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{schedule.charger_id}</p>
                    <p className="text-[10px] text-on-surface-variant">Conector {schedule.connector_id}</p>
                  </div>
                </div>
                {/* Toggle */}
                <button onClick={() => handleToggle(schedule.id)} className={`w-12 h-6 rounded-full transition-colors relative ${schedule.enabled ? 'bg-primary' : 'bg-surface-container-highest'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${schedule.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Time */}
              <div className="bg-surface-container rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-headline font-bold text-on-surface">{schedule.start_time}</span>
                  <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
                  <span className="text-2xl font-headline font-bold text-on-surface">{schedule.end_time}</span>
                </div>
              </div>

              {/* Days */}
              {schedule.schedule_type === 'recurring' && (
                <div className="flex gap-1 mb-4 justify-center">
                  {DAYS.map((day, i) => (
                    <span key={i} className={`w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center ${schedule.days_of_week.includes(i) ? 'bg-primary/20 text-primary' : 'bg-surface-container text-outline'}`}>
                      {day[0]}
                    </span>
                  ))}
                </div>
              )}

              {/* Details */}
              <div className="space-y-2 text-xs text-on-surface-variant mb-4">
                <div className="flex justify-between">
                  <span>Potência máx.</span>
                  <span className="font-bold text-on-surface">{schedule.max_rate_kw} kW</span>
                </div>
                <div className="flex justify-between">
                  <span>ID Tag</span>
                  <span className="font-mono text-on-surface">{schedule.id_tag}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tipo</span>
                  <span className="font-bold text-on-surface">{schedule.schedule_type === 'recurring' ? 'Recorrente' : 'Uma vez'}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-outline-variant/10">
                <button onClick={() => handleEdit(schedule)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-primary text-xs font-bold transition-colors">
                  <span className="material-symbols-outlined text-sm">edit</span> Editar
                </button>
                <button onClick={() => handleDelete(schedule.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-colors">
                  <span className="material-symbols-outlined text-sm">delete</span> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
