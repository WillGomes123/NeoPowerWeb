import { useState, useEffect } from 'react';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { api } from '../lib/api';

interface Campaign {
  id: number;
  title: string;
  message: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  targetAudience: 'all_users' | 'specific_location' | 'specific_users';
  locationId: number | null;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface PushStats {
  activeTokens: number;
  totalCampaigns: number;
  totalSent: number;
  totalFailed: number;
  campaignsByStatus: {
    draft: number;
    scheduled: number;
    sent: number;
    failed: number;
  };
}

interface Location {
  id: number;
  nomeDoLocal: string;
}

const statusConfig: Record<Campaign['status'], { label: string; pillClass: string }> = {
  draft: { label: 'Rascunho', pillClass: 'bg-outline/10 text-on-surface-variant' },
  scheduled: { label: 'Agendada', pillClass: 'bg-tertiary/10 text-tertiary' },
  sending: { label: 'Enviando', pillClass: 'bg-secondary/10 text-secondary' },
  sent: { label: 'Enviada', pillClass: 'bg-primary/10 text-primary' },
  failed: { label: 'Falhou', pillClass: 'bg-error/10 text-error' },
};

const statusDotColor: Record<Campaign['status'], string> = {
  draft: 'bg-on-surface-variant',
  scheduled: 'bg-tertiary',
  sending: 'bg-secondary',
  sent: 'bg-primary',
  failed: 'bg-error',
};

const audienceLabels = {
  all_users: 'Todos os Usuários',
  specific_location: 'Local Específico',
  specific_users: 'Usuários Específicos',
};

export const PushNotifications = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<PushStats | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<string>('all_users');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campaignsRes, statsRes, locationsRes] = await Promise.all([
        api.get('/push/campaigns'),
        api.get('/push/stats'),
        api.get('/locations/all')
      ]);

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Preencha o título e a mensagem');
      return;
    }

    try {
      const payload: any = {
        title: title.trim(),
        message: message.trim(),
        targetAudience,
      };

      if (targetAudience === 'specific_location' && selectedLocation) {
        payload.locationId = parseInt(selectedLocation);
      }

      const response = await api.post('/push/campaigns', payload);

      if (!response.ok) {
        throw new Error('Erro ao criar campanha');
      }

      toast.success('Campanha criada com sucesso!');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast.error('Erro ao criar campanha');
    }
  };

  const handleSendCampaign = async (id: number) => {
    setSending(id);
    try {
      const response = await api.post(`/push/campaigns/${id}/send`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao enviar');
      }

      const data = await response.json();
      toast.success(`Campanha enviada! ${data.sent} enviados, ${data.failed} falharam`);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao enviar campanha:', error);
      toast.error(error.message || 'Erro ao enviar campanha');
    } finally {
      setSending(null);
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) return;

    try {
      const response = await api.delete(`/push/campaigns/${id}`);

      if (!response.ok) {
        throw new Error('Erro ao excluir');
      }

      toast.success('Campanha excluída');
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      toast.error('Erro ao excluir campanha');
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setTargetAudience('all_users');
    setSelectedLocation('');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
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
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-1">MESSAGING CENTER</span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Notificações Push</h1>
          <p className="text-on-surface-variant mt-1">Envie notificações para usuários do aplicativo</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void fetchData()} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-colors font-medium text-sm">
            <span className="material-symbols-outlined text-lg">refresh</span>
            Atualizar
          </button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
                Nova Campanha
              </button>
            </DialogTrigger>
            <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">notifications</span>
                  Nova Campanha de Notificação
                </DialogTitle>
                <DialogDescription className="text-on-surface-variant">
                  Crie uma notificação para enviar aos usuários do aplicativo
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-on-surface-variant text-xs uppercase tracking-widest">Título da Notificação</label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Promoção Especial!"
                    className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                    maxLength={100}
                  />
                  <p className="text-[10px] text-on-surface-variant">{title.length}/100 caracteres</p>
                </div>

                <div className="space-y-2">
                  <label className="text-on-surface-variant text-xs uppercase tracking-widest">Mensagem</label>
                  <Textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Digite a mensagem da notificação..."
                    className="bg-surface-container-low border-outline-variant/20 text-on-surface min-h-[100px]"
                    maxLength={500}
                  />
                  <p className="text-[10px] text-on-surface-variant">{message.length}/500 caracteres</p>
                </div>

                <div className="space-y-2">
                  <label className="text-on-surface-variant text-xs uppercase tracking-widest">Público-Alvo</label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}>
                    <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-container border-outline-variant/20">
                      <SelectItem value="all_users" className="text-on-surface focus:bg-surface-container-highest">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">group</span>
                          Todos os Usuários
                        </div>
                      </SelectItem>
                      <SelectItem value="specific_location" className="text-on-surface focus:bg-surface-container-highest">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">location_on</span>
                          Local Específico
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {targetAudience === 'specific_location' && (
                  <div className="space-y-2">
                    <label className="text-on-surface-variant text-xs uppercase tracking-widest">Selecione o Local</label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                        <SelectValue placeholder="Escolha um local" />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-container border-outline-variant/20">
                        {locations.map(loc => (
                          <SelectItem
                            key={loc.id}
                            value={loc.id.toString()}
                            className="text-on-surface focus:bg-surface-container-highest"
                          >
                            {loc.nomeDoLocal}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Preview */}
                <div className="glass-panel rounded-lg border border-outline-variant/10 p-4 mt-4">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">Preview da Notificação</p>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface text-sm">
                        {title || 'Título da Notificação'}
                      </p>
                      <p className="text-on-surface-variant text-xs mt-0.5 line-clamp-2">
                        {message || 'Mensagem da notificação aparece aqui...'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/10">
                <button
                  onClick={() => setDialogOpen(false)}
                  className="px-6 py-2.5 rounded-full border border-outline-variant/20 text-on-surface-variant font-medium text-sm hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCampaign}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all"
                >
                  Criar Campanha
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SummaryCard icon="devices" label="DISPOSITIVOS ATIVOS" value={String(stats.activeTokens)} />
          <SummaryCard icon="campaign" label="TOTAL DE CAMPANHAS" value={String(stats.totalCampaigns)} color="text-tertiary" />
          <SummaryCard icon="check_circle" label="ENVIADAS COM SUCESSO" value={String(stats.totalSent)} color="text-secondary" />
          <SummaryCard icon="error" label="FALHAS" value={String(stats.totalFailed)} color="text-error" />
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="text-lg font-headline font-bold text-on-surface">Campanhas</h3>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{campaigns.length} registros</span>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-30 block mb-3">campaign</span>
            <p>Nenhuma campanha criada ainda</p>
            <p className="text-sm mt-1 text-on-surface-variant/60">Clique em "Nova Campanha" para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-6 py-4">Título</th>
                  <th className="px-6 py-4">Mensagem</th>
                  <th className="px-6 py-4">Público</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Enviadas</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {campaigns.map(campaign => (
                  <tr key={campaign.id} className="hover:bg-surface-container-highest/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-on-surface">{campaign.title}</span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <span className="text-sm text-on-surface-variant truncate block">{campaign.message}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-on-surface-variant">{audienceLabels[campaign.targetAudience]}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusConfig[campaign.status].pillClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor[campaign.status]}`} />
                        {statusConfig[campaign.status].label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="text-primary font-bold">{campaign.sentCount}</span>
                      {campaign.failedCount > 0 && (
                        <span className="text-error ml-1">/ {campaign.failedCount} falhas</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-on-surface-variant">{formatDate(campaign.sentAt || campaign.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                          <button
                            onClick={() => handleSendCampaign(campaign.id)}
                            disabled={sending === campaign.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary text-xs font-bold shadow-[0_2px_10px_rgba(142,255,113,0.2)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                          >
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                            {sending === campaign.id ? 'Enviando...' : 'Enviar'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          disabled={campaign.status === 'sending'}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error/10 transition-colors disabled:opacity-30"
                        >
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
      <span className="text-3xl font-headline font-bold text-on-surface">{value}</span>
    </div>
  );
}

export default PushNotifications;
