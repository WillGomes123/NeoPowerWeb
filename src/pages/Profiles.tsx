import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CustomerProfile } from '../types';

const PRESET_COLORS = ['#39FF14', '#22D3EE', '#F59E0B', '#A78BFA', '#F472B6', '#60A5FA', '#34D399', '#FB7185'];

const emptyForm = { id: 0, name: '', description: '', color: PRESET_COLORS[0], isDefault: false };

export const Profiles = ({ embedded = false }: { embedded?: boolean }) => {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const r = await api.get('/profiles');
      if (!r.ok) throw new Error();
      setProfiles(await r.json());
    } catch { toast.error('Erro ao buscar perfis'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void fetchProfiles(); }, []);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setIsEdit(false);
    setDialogOpen(true);
  };

  const openEdit = (p: CustomerProfile) => {
    setForm({ id: p.id, name: p.name, description: p.description || '', color: p.color || PRESET_COLORS[0], isDefault: !!p.isDefault });
    setIsEdit(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome do perfil'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        color: form.color,
        isDefault: form.isDefault,
      };
      const r = isEdit
        ? await api.put(`/profiles/${form.id}`, payload)
        : await api.post('/profiles', payload);
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Erro'); }
      toast.success(isEdit ? 'Perfil atualizado!' : 'Perfil criado!');
      setDialogOpen(false);
      void fetchProfiles();
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar perfil'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await api.delete(`/profiles/${deleteTarget.id}`);
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Erro ao excluir'); }
      toast.success('Perfil excluído!');
      setDeleteTarget(null);
      void fetchProfiles();
    } catch (e: any) { toast.error(e.message || 'Erro ao excluir perfil'); }
    finally { setDeleting(false); }
  };

  const totalUsers = useMemo(() => profiles.reduce((sum, p) => sum + (p.userCount || 0), 0), [profiles]);

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
        {!embedded ? (
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-1">SEGMENTAÇÃO</span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Perfis de Cliente</h1>
          <p className="text-on-surface-variant mt-1">Crie segmentos (ex.: Comum, Uber) para tarifas e notificações direcionadas</p>
        </div>
        ) : <div />}
        <div className="flex items-center gap-3">
          <button onClick={() => void fetchProfiles()} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-colors font-medium text-sm">
            <span className="material-symbols-outlined text-lg">refresh</span>
            Atualizar
          </button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button onClick={openCreate} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
                Novo Perfil
              </button>
            </DialogTrigger>
            <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">badge</span>
                  {isEdit ? 'Editar Perfil' : 'Novo Perfil de Cliente'}
                </DialogTitle>
                <DialogDescription className="text-on-surface-variant">
                  Defina um segmento de cliente. A tarifa do perfil é configurada na tela de Tarifas.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Nome</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Uber" className="bg-surface-container-low border-outline-variant/20 text-on-surface" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Descrição</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Motoristas de aplicativo com tarifa diferenciada..." className="bg-surface-container-low border-outline-variant/20 text-on-surface min-h-[72px]" maxLength={500} />
                </div>
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-surface-container ring-on-surface scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer mt-1">
                  <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <span className="text-sm text-on-surface">Perfil padrão para novos usuários</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="px-6 py-2.5 rounded-full border border-outline-variant/20 text-on-surface-variant font-bold text-sm hover:bg-surface-container-high active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : (isEdit ? 'Salvar Alterações' : 'Criar Perfil')}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard icon="badge" label="TOTAL DE PERFIS" value={String(profiles.length)} />
        <SummaryCard icon="group" label="USUÁRIOS SEGMENTADOS" value={String(totalUsers)} color="text-tertiary" />
        <SummaryCard icon="star" label="PERFIL PADRÃO" value={profiles.find(p => p.isDefault)?.name || '—'} color="text-secondary" />
      </div>

      {/* Profiles Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">badge</span>
            Perfis Cadastrados
          </h3>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{profiles.length} registros</span>
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-30 block mb-3">badge</span>
            <p>Nenhum perfil criado ainda</p>
            <p className="text-sm mt-1 text-on-surface-variant/60">Clique em "Novo Perfil" para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-6 py-4">Perfil</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Usuários</th>
                  <th className="px-6 py-4">Padrão</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {profiles.map(p => (
                  <tr key={p.id} className="hover:bg-surface-container-highest/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.color || '#39FF14'}22` }}>
                          <span className="material-symbols-outlined text-lg" style={{ color: p.color || '#39FF14' }}>badge</span>
                        </span>
                        <span className="text-sm font-semibold text-on-surface">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <span className="text-sm text-on-surface-variant truncate block">{p.description || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface border border-outline-variant/10 text-xs font-bold">
                        <span className="material-symbols-outlined text-xs">group</span>
                        {p.userCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {p.isDefault ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          PADRÃO
                        </span>
                      ) : (
                        <span className="text-on-surface-variant text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors" title="Editar">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error/10 transition-colors" title="Excluir">
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-surface-container border-outline-variant/20 font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-on-surface font-headline text-xl">Excluir Perfil</AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant">
              Tem certeza que deseja excluir o perfil <strong>{deleteTarget?.name}</strong>? Não é possível excluir perfis em uso por usuários, tarifas ou campanhas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-6 py-2 rounded-full border border-outline-variant/20 text-on-surface font-bold text-sm hover:bg-surface-container-highest active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-error text-on-error hover:bg-error/90 px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
            >
              {deleting ? 'Aguarde...' : 'Sim, Excluir'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function SummaryCard({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="glass-panel p-6 rounded-lg border border-outline-variant/10 flex flex-col justify-between h-28 hover:border-primary/30 transition-colors">
      <div className="flex justify-between items-start">
        <span className="text-on-surface-variant text-xs uppercase tracking-widest">{label}</span>
        <span className={`material-symbols-outlined text-sm ${color || 'text-primary'}`}>{icon}</span>
      </div>
      <span className="text-3xl font-headline font-bold text-on-surface truncate">{value}</span>
    </div>
  );
}

export default Profiles;
