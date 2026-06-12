import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';

type SourceType = 'static' | 'api';

interface Promotion {
  id: number;
  clientId: string | null;
  sourceType: SourceType;
  apiUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  actionType: 'none' | 'external_link';
  actionUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm = {
  id: 0,
  sourceType: 'static' as SourceType,
  title: '',
  description: '',
  imageUrl: '',
  link: '',
  apiUrl: '',
  isActive: true,
  sortOrder: 0,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
}

export const PromotionsDialog = ({ open, onOpenChange, clientId, clientName }: Props) => {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/promotions?clientId=${encodeURIComponent(clientId)}`);
      if (r.ok) setPromos(await r.json());
    } catch { toast.error('Erro ao carregar promoções'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (open && clientId) { void fetchPromos(); setShowForm(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const openCreate = () => { setForm({ ...emptyForm }); setEditing(false); setShowForm(true); };
  const openEdit = (p: Promotion) => {
    setForm({
      id: p.id,
      sourceType: p.sourceType || 'static',
      title: p.title || '',
      description: p.description || '',
      imageUrl: p.imageUrl || '',
      link: p.actionUrl || '',
      apiUrl: p.apiUrl || '',
      isActive: p.isActive,
      sortOrder: p.sortOrder || 0,
    });
    setEditing(true);
    setShowForm(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('files', file);
    try {
      const r = await api.post('/admin/branding/upload', fd);
      if (r.ok) {
        const data = await r.json();
        const url = data.url || data.payload?.url || data.secure_url;
        if (url) { setForm(f => ({ ...f, imageUrl: url })); toast.success('Imagem enviada!'); }
        else toast.error('URL não retornada');
      } else toast.error('Erro no upload');
    } catch { toast.error('Erro no upload'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleSave = async () => {
    if (form.sourceType === 'static' && !form.imageUrl && !form.title.trim()) {
      toast.error('Informe ao menos uma imagem ou título');
      return;
    }
    if (form.sourceType === 'api' && !form.apiUrl.trim()) {
      toast.error('Informe a URL da API do parceiro');
      return;
    }
    setSaving(true);
    try {
      const payload = form.sourceType === 'api'
        ? {
            clientId,
            sourceType: 'api' as const,
            apiUrl: form.apiUrl.trim(),
            // conteúdo (imagem/título/link) vem da API; campos estáticos ficam nulos
            imageUrl: null, title: null, description: null,
            actionType: 'none' as const, actionUrl: null,
            isActive: form.isActive,
            sortOrder: Number(form.sortOrder) || 0,
          }
        : {
            clientId,
            sourceType: 'static' as const,
            apiUrl: null,
            title: form.title.trim() || null,
            description: form.description.trim() || null,
            imageUrl: form.imageUrl || null,
            actionType: (form.link.trim() ? 'external_link' : 'none') as 'none' | 'external_link',
            actionUrl: form.link.trim() || null,
            isActive: form.isActive,
            sortOrder: Number(form.sortOrder) || 0,
          };
      const r = editing
        ? await api.put(`/admin/promotions/${form.id}`, payload)
        : await api.post('/admin/promotions', payload);
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Erro'); }
      toast.success(editing ? 'Promoção atualizada!' : 'Promoção criada!');
      setShowForm(false);
      void fetchPromos();
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p: Promotion) => {
    if (!confirm(`Excluir esta promoção?`)) return;
    try {
      const r = await api.delete(`/admin/promotions/${p.id}`);
      if (r.ok) { toast.success('Promoção excluída'); void fetchPromos(); }
      else toast.error('Erro ao excluir');
    } catch { toast.error('Erro ao excluir'); }
  };

  const typeLabel = (p: Promotion) => p.sourceType === 'api' ? 'API de parceiro' : 'Imagem + link';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">campaign</span>
            Promoções — {clientName || clientId}
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            Banners exibidos na Home do app deste cliente — imagem com link, ou conteúdo de uma API de parceiro.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">
          {/* Lista */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
            </div>
          ) : promos.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl opacity-30 block mb-2">image</span>
              <p className="text-sm">Nenhuma promoção cadastrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {promos.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                  {p.sourceType === 'api' ? (
                    <div className="w-16 h-12 rounded-md bg-surface-container flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-primary">api</span></div>
                  ) : p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-16 h-12 rounded-md object-cover bg-surface-container shrink-0" />
                  ) : (
                    <div className="w-16 h-12 rounded-md bg-surface-container flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-on-surface-variant">image</span></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{p.sourceType === 'api' ? (p.apiUrl || 'API de parceiro') : (p.title || '(sem título)')}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{typeLabel(p)}{p.sourceType === 'static' && p.actionUrl ? ` · ${p.actionUrl}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.isActive ? 'bg-primary/10 text-primary' : 'bg-outline/10 text-on-surface-variant'}`}>
                    {p.isActive ? 'ATIVA' : 'INATIVA'}
                  </span>
                  <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 shrink-0" title="Editar">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button onClick={() => handleDelete(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error/10 shrink-0" title="Excluir">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form inline */}
          {showForm && (
            <div className="space-y-4 p-4 rounded-xl bg-surface-container-low border border-primary/20">
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">{editing ? 'Editar promoção' : 'Nova promoção'}</p>

              {/* Tipo de origem */}
              <div className="space-y-1.5">
                <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Tipo de promoção</Label>
                <Select value={form.sourceType} onValueChange={(v) => setForm({ ...form, sourceType: v as SourceType })}>
                  <SelectTrigger className="bg-surface-container border-outline-variant/20 text-on-surface h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-surface-container border-outline-variant/20">
                    <SelectItem value="static" className="text-on-surface focus:bg-surface-container-highest">Imagem + link</SelectItem>
                    <SelectItem value="api" className="text-on-surface focus:bg-surface-container-highest">API de parceiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.sourceType === 'static' ? (
                <>
                  {/* Imagem */}
                  <div className="space-y-2">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Imagem do banner</Label>
                    <div className="flex items-center gap-3">
                      {form.imageUrl
                        ? <img src={form.imageUrl} alt="" className="w-24 h-14 rounded-md object-cover bg-surface-container" />
                        : <div className="w-24 h-14 rounded-md bg-surface-container flex items-center justify-center"><span className="material-symbols-outlined text-on-surface-variant">image</span></div>}
                      <div className="relative">
                        <input type="file" id="promo-upload" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
                        <button type="button" onClick={() => document.getElementById('promo-upload')?.click()} disabled={uploading}
                          className="h-10 px-4 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2 text-sm">
                          {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" /> : <span className="material-symbols-outlined text-lg">upload</span>}
                          Enviar imagem
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Título</Label>
                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={120} className="bg-surface-container border-outline-variant/20 text-on-surface h-10 text-sm" placeholder="Ex: 5% de cashback" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Descrição</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={2000} className="bg-surface-container border-outline-variant/20 text-on-surface min-h-[60px] text-sm" placeholder="Texto curto opcional" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Link externo (opcional)</Label>
                    <Input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} maxLength={512} className="bg-surface-container border-outline-variant/20 text-on-surface h-10 text-sm" placeholder="https://..." />
                    <p className="text-[11px] text-on-surface-variant">Ao tocar no banner, abre este link. Deixe vazio para apenas exibir.</p>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">URL da API do parceiro</Label>
                  <Input value={form.apiUrl} onChange={e => setForm({ ...form, apiUrl: e.target.value })} maxLength={512} className="bg-surface-container border-outline-variant/20 text-on-surface h-10 text-sm" placeholder="https://parceiro.com/api/promocoes" />
                  <div className="bg-surface-container-high border border-outline-variant/30 rounded-lg p-3 flex items-start gap-2 mt-2">
                    <span className="material-symbols-outlined text-sm text-muted-foreground mt-0.5">info</span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      A API deve retornar JSON: um array (ou {`{ promotions: [...] }`}) com itens contendo
                      <code className="text-primary"> imageUrl</code>, e opcionalmente <code className="text-primary">title</code>,
                      <code className="text-primary"> description</code> e <code className="text-primary">link</code>. O conteúdo é buscado e cacheado por ~5 min.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1.5">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Ordem</Label>
                  <Input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} className="bg-surface-container border-outline-variant/20 text-on-surface h-10 text-sm" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer mt-5">
                  <Checkbox checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: !!c })} className="data-[state=checked]:bg-primary data-[state=checked]:text-on-primary" />
                  <span className="text-sm text-on-surface">Ativa (visível no app)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-full border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high text-sm font-medium">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-full bg-primary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                  {saving ? 'Salvando...' : (editing ? 'Salvar' : 'Criar promoção')}
                </button>
              </div>
            </div>
          )}
        </div>

        {!showForm && (
          <div className="shrink-0 border-t border-outline-variant/10 pt-4 flex justify-end">
            <button onClick={openCreate} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
              Nova Promoção
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PromotionsDialog;
