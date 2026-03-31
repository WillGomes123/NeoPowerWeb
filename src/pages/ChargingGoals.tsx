import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

interface Goal {
  id: string;
  charger_id: string;
  goal_type: 'energy' | 'cost' | 'time' | 'soc';
  target_value: number;
  enabled: boolean;
  charger_name?: string;
}

interface ChargerOption {
  id: string;
  label: string;
}

const GOAL_CONFIG = {
  energy: { label: 'Energia (kWh)', icon: 'bolt', color: 'text-primary', bg: 'bg-primary/10', unit: 'kWh', min: 1, max: 200, step: 1, default: 30, description: 'Parar recarga ao atingir a energia desejada' },
  cost: { label: 'Custo (R$)', icon: 'payments', color: 'text-secondary', bg: 'bg-secondary/10', unit: 'R$', min: 5, max: 500, step: 5, default: 50, description: 'Limitar o valor máximo por sessão' },
  time: { label: 'Tempo (min)', icon: 'timer', color: 'text-tertiary', bg: 'bg-tertiary/10', unit: 'min', min: 15, max: 480, step: 15, default: 120, description: 'Duração máxima da sessão de recarga' },
  soc: { label: 'SoC (%)', icon: 'battery_charging_full', color: 'text-tertiary-dim', bg: 'bg-tertiary-dim/10', unit: '%', min: 10, max: 100, step: 5, default: 80, description: 'Nível de bateria desejado (requer suporte do veículo)' },
};

type GoalType = keyof typeof GOAL_CONFIG;

export const ChargingGoals = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [chargers, setChargers] = useState<ChargerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    charger_id: '' as string,
    goal_type: 'energy' as GoalType,
    target_value: 30,
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

    try {
      const goalsRes = await api.get('/goals');
      if (goalsRes.ok) {
        const data = await goalsRes.json();
        const arr = Array.isArray(data) ? data : [];
        setGoals(arr.map((g: any) => ({ ...g, id: String(g.id), charger_name: g.charger_id })));
      } else {
        setGoals([]);
      }
    } catch {
      setGoals([]);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.charger_id) { toast.error('Selecione um carregador'); return; }

    try {
      if (editingId) {
        const res = await api.put(`/goals/${editingId}`, form);
        if (res.ok) {
          toast.success('Meta atualizada');
          void fetchData();
        } else { toast.error('Erro ao atualizar'); }
      } else {
        const res = await api.post('/goals', form);
        if (res.ok) {
          toast.success('Meta criada');
          void fetchData();
        } else { toast.error('Erro ao criar'); }
      }
    } catch {
      toast.error('Erro de conexão');
    }
    resetForm();
  };

  const handleEdit = (goal: Goal) => {
    setForm({ charger_id: goal.charger_id, goal_type: goal.goal_type, target_value: goal.target_value });
    setEditingId(goal.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await api.delete(`/goals/${id}`);
      if (res.ok) {
        toast.success('Meta removida');
        void fetchData();
      } else { toast.error('Erro ao remover'); }
    } catch { toast.error('Erro de conexão'); }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await api.put(`/goals/${id}/toggle`);
      if (res.ok) {
        void fetchData();
      } else { toast.error('Erro ao alternar'); }
    } catch { toast.error('Erro de conexão'); }
  };

  const resetForm = () => {
    setForm({ charger_id: '', goal_type: 'energy', target_value: 30 });
    setShowForm(false);
    setEditingId(null);
  };

  const cfg = GOAL_CONFIG[form.goal_type];

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
          <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">CONTROLE DE SESSÃO</span>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Metas de Recarga</h2>
          <p className="text-on-surface-variant text-sm mt-1">Defina limites automáticos para cada sessão de recarga</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm shadow-[0_8px_20px_color-mix(in_srgb,var(--primary),transparent_80%)] hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          NOVA META
        </button>
      </div>

      {/* Goal Type Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(Object.keys(GOAL_CONFIG) as GoalType[]).map(type => {
          const c = GOAL_CONFIG[type];
          const count = goals.filter(g => g.goal_type === type && g.enabled).length;
          return (
            <div key={type} className="glass-card p-5 rounded-xl border border-outline-variant/10 relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center ${c.color}`}>
                  <span className="material-symbols-outlined">{c.icon}</span>
                </div>
                {count > 0 && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">{count} ativa(s)</span>
                )}
              </div>
              <p className="text-sm font-bold text-on-surface mb-1">{c.label}</p>
              <p className="text-[10px] text-on-surface-variant">{c.description}</p>
            </div>
          );
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-surface-container-low rounded-2xl border border-outline-variant/10 w-[520px] max-w-[95vw] shadow-2xl">
            <div className="flex justify-between items-center px-8 py-6 border-b border-outline-variant/10">
              <div>
                <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">CONFIGURAR</span>
                <h3 className="text-xl font-headline font-bold text-on-surface">{editingId ? 'Editar' : 'Nova'} Meta</h3>
              </div>
              <button onClick={resetForm} className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Charger */}
              <div>
                <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Carregador</label>
                <select value={form.charger_id} onChange={e => setForm(prev => ({ ...prev, charger_id: e.target.value }))} className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50">
                  <option value="">Selecione...</option>
                  {chargers.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {/* Goal Type */}
              <div>
                <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Tipo de Meta</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(GOAL_CONFIG) as GoalType[]).map(type => {
                    const c = GOAL_CONFIG[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setForm(prev => ({ ...prev, goal_type: type, target_value: c.default }))}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all border ${
                          form.goal_type === type
                            ? `${c.bg} ${c.color} border-current/30`
                            : 'bg-surface-container text-on-surface-variant border-outline-variant/20 hover:border-primary/20'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">{c.icon}</span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Value */}
              <div>
                <label className="block text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Valor Alvo</label>
                <div className="bg-surface-container rounded-lg p-6 border border-outline-variant/10">
                  <div className="text-center mb-4">
                    <span className="text-4xl font-headline font-bold text-on-surface">{form.target_value}</span>
                    <span className="text-lg text-on-surface-variant ml-2">{cfg.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={cfg.min}
                    max={cfg.max}
                    step={cfg.step}
                    value={form.target_value}
                    onChange={e => setForm(prev => ({ ...prev, target_value: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-on-surface-variant">
                    <span>{cfg.min} {cfg.unit}</span>
                    <span>{cfg.max} {cfg.unit}</span>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant mt-2">{cfg.description}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button onClick={resetForm} className="flex-1 px-6 py-3 rounded-lg border border-outline-variant/20 text-on-surface-variant font-bold text-sm hover:bg-surface-container-highest transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSubmit} className="flex-1 px-6 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-[0_8px_20px_color-mix(in_srgb,var(--primary),transparent_80%)] hover:scale-[1.02] active:scale-95 transition-all">
                  {editingId ? 'Salvar' : 'Criar Meta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="glass-panel rounded-lg border border-outline-variant/10 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-outline mb-3 block">flag</span>
          <p className="text-on-surface-variant text-sm">Nenhuma meta configurada</p>
          <p className="text-outline text-xs mt-1">Defina metas para controlar automaticamente suas recargas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(goal => {
            const c = GOAL_CONFIG[goal.goal_type];
            return (
              <div key={goal.id} className={`glass-panel rounded-xl border p-6 transition-all ${goal.enabled ? 'border-outline-variant/10' : 'border-outline-variant/5 opacity-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center ${c.color}`}>
                      <span className="material-symbols-outlined">{c.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{goal.charger_id}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase">{c.label}</p>
                    </div>
                  </div>
                  <button onClick={() => handleToggle(goal.id)} className={`w-12 h-6 rounded-full transition-colors relative ${goal.enabled ? 'bg-primary' : 'bg-surface-container-highest'}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${goal.enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Value display */}
                <div className="bg-surface-container rounded-lg p-4 mb-4 text-center">
                  <span className="text-3xl font-headline font-bold text-on-surface">{goal.target_value}</span>
                  <span className="text-sm text-on-surface-variant ml-2">{c.unit}</span>
                  {/* Progress bar visual */}
                  <div className="mt-3 w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(goal.target_value / c.max) * 100}%`, backgroundColor: `var(--${c.color.replace('text-', '')})` }}>
                      <div className="h-full w-full bg-current opacity-60 rounded-full" />
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-on-surface-variant mb-4">{c.description}</p>

                <div className="flex gap-2 pt-4 border-t border-outline-variant/10">
                  <button onClick={() => handleEdit(goal)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-primary text-xs font-bold transition-colors">
                    <span className="material-symbols-outlined text-sm">edit</span> Editar
                  </button>
                  <button onClick={() => handleDelete(goal.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-colors">
                    <span className="material-symbols-outlined text-sm">delete</span> Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
