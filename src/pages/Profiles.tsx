import { useState, useEffect, useMemo } from 'react';
import { cn } from '../components/ui/utils';
import { BadgeCheck, Pencil, Plus, Star, Trash2, Users as IconeUsuarios } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CustomerProfile } from '../types';
import {
  BotaoAtualizar,
  CabecalhoDaPagina,
  CartaoContador,
} from '../components/painel/Pagina';
import {
  classeDoBotaoContorno,
  classeDoBotaoPrincipal,
} from '../components/painel/Pecas';
import {
  CabecalhoDoCartao,
  CarregandoPagina,
  ConfirmarExclusao,
  EstadoVazio,
  classeDaEtiqueta,
  classeDaTabela,
  classeDoBotaoDeIcone,
  classeDoCartaoDaTabela,
  classeDoTd,
  classeDoTh,
  classeDoBotaoDeIconePerigo,
  classeDoBotaoPrincipalMenor,
  classeDoCampo,
  classeDoDialogo,
  classeDoRotulo,
} from '../components/configuracoes/Pecas';

const PRESET_COLORS = ['#39FF14', '#22D3EE', '#F59E0B', '#A78BFA', '#F472B6', '#60A5FA', '#34D399', '#FB7185'];

const emptyForm = { id: 0, name: '', description: '', color: PRESET_COLORS[0], isDefault: false };

export const Profiles = ({ embedded = false }: { embedded?: boolean }) => {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);
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
      const d = await r.json();
      setProfiles(Array.isArray(d) ? d : []);
      setAtualizadoEm(new Date());
      setFalhou(false);
    } catch {
      setFalhou(true);
      toast.error('Erro ao buscar perfis');
    }
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
  const perfilPadrao = profiles.find(p => p.isDefault)?.name;

  // Só a primeira carga troca a tela pelo carregando; depois, o "Atualizar" mostra.
  if (loading && !atualizadoEm && profiles.length === 0) {
    return <CarregandoPagina />;
  }

  const acoes = (
    <>
      <button type="button" onClick={openCreate} className={classeDoBotaoPrincipal}>
        <Plus className="w-5 h-5" aria-hidden="true" />
        Novo perfil
      </button>
      <BotaoAtualizar
        aoAtualizar={() => void fetchProfiles()}
        carregando={loading}
        atualizadoEm={atualizadoEm}
        falhou={falhou}
      />
    </>
  );

  return (
    <div className="space-y-[25px] pb-12">
      {/* Dentro de Tarifas (aba Perfis) a página já tem título: aqui só as ações. */}
      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:justify-end items-stretch sm:items-start gap-4">{acoes}</div>
      ) : (
        <CabecalhoDaPagina
          rotulo="Segmentação"
          titulo="Perfis de cliente"
          subtitulo="Crie segmentos (ex.: Comum, Uber) para tarifas e notificações direcionadas"
          acoes={acoes}
        />
      )}

      {/* Contadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[25px]">
        <CartaoContador icone={<BadgeCheck className="w-7 h-7" />} rotulo="Total de perfis" valor={profiles.length} />
        <CartaoContador
          icone={<IconeUsuarios className="w-7 h-7" />}
          rotulo="Usuários segmentados"
          valor={totalUsers}
          fundoDoIcone="bg-tom-azul text-tom-azul-icone"
        />
        <CartaoContador
          icone={<Star className="w-7 h-7" />}
          rotulo="Perfil padrão"
          valor={
            <span className="block truncate text-[28px]" title={perfilPadrao}>
              {perfilPadrao || '—'}
            </span>
          }
          fundoDoIcone="bg-tom-amarelo text-tom-amarelo-icone"
        />
      </div>

      {/* Tabela (linhas verdes arredondadas, como Notificações e Alarmes no Figma) */}
      <section className={classeDoCartaoDaTabela} aria-label="Perfis cadastrados">
        <CabecalhoDoCartao titulo="Perfis cadastrados" detalhe={`${profiles.length} registros`} />

        {profiles.length === 0 ? (
          <EstadoVazio icone={<BadgeCheck className="w-10 h-10" />} titulo="Nenhum perfil criado ainda">
            Clique em "Novo perfil" para começar
          </EstadoVazio>
        ) : (
          <div className="overflow-x-auto">
            <table className={classeDaTabela}>
              <thead>
                <tr>
                  <th className={classeDoTh}>Perfil</th>
                  <th className={classeDoTh}>Descrição</th>
                  <th className={classeDoTh}>Usuários</th>
                  <th className={classeDoTh}>Padrão</th>
                  <th className={cn(classeDoTh, 'text-right')}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id}>
                    <td className={classeDoTd}>
                      <div className="flex items-center gap-3">
                        {/* A cor é do perfil (escolhida pelo operador), não do tema. */}
                        <span
                          className="w-9 h-9 rounded-[5px] flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${p.color || '#39FF14'}22`, color: p.color || '#39FF14' }}
                          aria-hidden="true"
                        >
                          <BadgeCheck className="w-5 h-5" />
                        </span>
                        <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      </div>
                    </td>
                    <td className={`${classeDoTd} max-w-xs`}>
                      <span className="text-sm text-muted-foreground truncate block" title={p.description || undefined}>
                        {p.description || '—'}
                      </span>
                    </td>
                    <td className={classeDoTd}>
                      <span className={`${classeDaEtiqueta} bg-card text-foreground`}>
                        <IconeUsuarios className="w-3.5 h-3.5" aria-hidden="true" />
                        {p.userCount || 0}
                      </span>
                    </td>
                    <td className={classeDoTd}>
                      {p.isDefault ? (
                        <span className={`${classeDaEtiqueta} bg-primary-soft text-primary-strong`}>
                          <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                          Padrão
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className={classeDoTd}>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openEdit(p)} className={classeDoBotaoDeIcone} title="Editar" aria-label={`Editar o perfil ${p.name}`}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(p)} className={classeDoBotaoDeIconePerigo} title="Excluir" aria-label={`Excluir o perfil ${p.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Novo / editar perfil */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${classeDoDialogo} sm:max-w-[480px]`}>
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-foreground flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-primary-strong" aria-hidden="true" />
              {isEdit ? 'Editar perfil' : 'Novo perfil de cliente'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Defina um segmento de cliente. A tarifa do perfil é configurada na tela de Tarifas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="perfil-nome" className={classeDoRotulo}>Nome</Label>
              <Input id="perfil-nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Uber" className={classeDoCampo} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perfil-descricao" className={classeDoRotulo}>Descrição</Label>
              <Textarea id="perfil-descricao" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Motoristas de aplicativo com tarifa diferenciada..." className="rounded-[10px] bg-card border-border text-foreground min-h-[72px]" maxLength={500} />
            </div>
            <div className="space-y-2">
              <p className={classeDoRotulo}>Cor</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    aria-pressed={form.color === c}
                    className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer mt-1">
              <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} className="w-4 h-4 accent-primary" />
              <span className="text-sm text-foreground">Perfil padrão para novos usuários</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setDialogOpen(false)} className={classeDoBotaoContorno}>
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className={classeDoBotaoPrincipalMenor}>
              {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar perfil')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir perfil: diz o que acontece antes */}
      <ConfirmarExclusao
        aberto={!!deleteTarget}
        aoMudar={o => !o && setDeleteTarget(null)}
        titulo="Excluir perfil"
        rotuloDoBotao="Sim, excluir"
        carregando={deleting}
        aoConfirmar={() => void handleDelete()}
      >
        <p>
          Tem certeza que deseja excluir o perfil <strong className="text-foreground">{deleteTarget?.name}</strong>? Não é possível excluir perfis em uso por usuários, tarifas ou campanhas.
        </p>
      </ConfirmarExclusao>
    </div>
  );
};

export default Profiles;
