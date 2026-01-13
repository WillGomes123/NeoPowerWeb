import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
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
import {
  EnhancedTable,
  EnhancedTableHeader,
  EnhancedTableBody,
  EnhancedTableRow,
  EnhancedTableHead,
  EnhancedTableCell,
} from '../components/EnhancedTable';
import {
  Bell,
  Send,
  Plus,
  Trash2,
  Users,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Megaphone
} from 'lucide-react';
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

const statusConfig = {
  draft: { label: 'Rascunho', color: 'bg-zinc-500', icon: Clock },
  scheduled: { label: 'Agendada', color: 'bg-blue-500', icon: Clock },
  sending: { label: 'Enviando', color: 'bg-yellow-500', icon: AlertCircle },
  sent: { label: 'Enviada', color: 'bg-emerald-500', icon: CheckCircle },
  failed: { label: 'Falhou', color: 'bg-red-500', icon: XCircle },
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
        api.get('/locations')
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
        setLocations(data || []);
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
        <div className="text-emerald-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-emerald-50 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-emerald-400" />
            Push Notifications
          </h1>
          <p className="text-emerald-300/60 mt-1">
            Envie notificações para usuários do aplicativo
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gradient-to-br from-emerald-950/95 to-emerald-900/95 border-emerald-800/50 text-emerald-50 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-emerald-50 flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-400" />
                Nova Campanha de Notificação
              </DialogTitle>
              <DialogDescription className="text-emerald-300/60">
                Crie uma notificação para enviar aos usuários do aplicativo
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm text-emerald-200">Título da Notificação</label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Promoção Especial!"
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50"
                  maxLength={100}
                />
                <p className="text-xs text-emerald-400/60">{title.length}/100 caracteres</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-emerald-200">Mensagem</label>
                <Textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Digite a mensagem da notificação..."
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-emerald-400/60">{message.length}/500 caracteres</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-emerald-200">Público-Alvo</label>
                <Select value={targetAudience} onValueChange={setTargetAudience}>
                  <SelectTrigger className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-emerald-900 border-emerald-700">
                    <SelectItem value="all_users" className="text-emerald-50 focus:bg-emerald-800">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Todos os Usuários
                      </div>
                    </SelectItem>
                    <SelectItem value="specific_location" className="text-emerald-50 focus:bg-emerald-800">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Local Específico
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetAudience === 'specific_location' && (
                <div className="space-y-2">
                  <label className="text-sm text-emerald-200">Selecione o Local</label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50">
                      <SelectValue placeholder="Escolha um local" />
                    </SelectTrigger>
                    <SelectContent className="bg-emerald-900 border-emerald-700">
                      {locations.map(loc => (
                        <SelectItem
                          key={loc.id}
                          value={loc.id.toString()}
                          className="text-emerald-50 focus:bg-emerald-800"
                        >
                          {loc.nomeDoLocal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Preview */}
              <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                <p className="text-xs text-zinc-400 mb-2">Preview da Notificação:</p>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">
                      {title || 'Título da Notificação'}
                    </p>
                    <p className="text-zinc-400 text-xs mt-0.5 line-clamp-2">
                      {message || 'Mensagem da notificação aparece aqui...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-emerald-800/30">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 hover:bg-emerald-800/60"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCampaign}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Criar Campanha
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-50">{stats.activeTokens}</p>
                  <p className="text-sm text-emerald-300/60">Dispositivos Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Megaphone className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-50">{stats.totalCampaigns}</p>
                  <p className="text-sm text-emerald-300/60">Total de Campanhas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-50">{stats.totalSent}</p>
                  <p className="text-sm text-emerald-300/60">Enviadas com Sucesso</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-50">{stats.totalFailed}</p>
                  <p className="text-sm text-emerald-300/60">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Campaigns Table */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-6">
          <CardTitle className="text-emerald-50 flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            Campanhas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-emerald-300/60">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma campanha criada ainda</p>
              <p className="text-sm mt-1">Clique em "Nova Campanha" para começar</p>
            </div>
          ) : (
            <EnhancedTable striped hoverable>
              <EnhancedTableHeader>
                <EnhancedTableRow hoverable={false}>
                  <EnhancedTableHead>Título</EnhancedTableHead>
                  <EnhancedTableHead>Mensagem</EnhancedTableHead>
                  <EnhancedTableHead>Público</EnhancedTableHead>
                  <EnhancedTableHead>Status</EnhancedTableHead>
                  <EnhancedTableHead>Enviadas</EnhancedTableHead>
                  <EnhancedTableHead>Data</EnhancedTableHead>
                  <EnhancedTableHead>Ações</EnhancedTableHead>
                </EnhancedTableRow>
              </EnhancedTableHeader>
              <EnhancedTableBody>
                {campaigns.map((campaign, index) => {
                  const StatusIcon = statusConfig[campaign.status].icon;
                  return (
                    <EnhancedTableRow key={campaign.id} index={index}>
                      <EnhancedTableCell className="font-semibold text-emerald-100">
                        {campaign.title}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-sm text-emerald-300/70 max-w-xs truncate">
                        {campaign.message}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-sm text-emerald-300/70">
                        {audienceLabels[campaign.targetAudience]}
                      </EnhancedTableCell>
                      <EnhancedTableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white ${statusConfig[campaign.status].color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[campaign.status].label}
                        </span>
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-sm">
                        <span className="text-emerald-400">{campaign.sentCount}</span>
                        {campaign.failedCount > 0 && (
                          <span className="text-red-400 ml-1">/ {campaign.failedCount} falhas</span>
                        )}
                      </EnhancedTableCell>
                      <EnhancedTableCell className="text-sm text-emerald-300/70">
                        {formatDate(campaign.sentAt || campaign.createdAt)}
                      </EnhancedTableCell>
                      <EnhancedTableCell>
                        <div className="flex items-center gap-2">
                          {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                            <Button
                              size="sm"
                              onClick={() => handleSendCampaign(campaign.id)}
                              disabled={sending === campaign.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              {sending === campaign.id ? 'Enviando...' : 'Enviar'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCampaign(campaign.id)}
                            disabled={campaign.status === 'sending'}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 px-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </EnhancedTableCell>
                    </EnhancedTableRow>
                  );
                })}
              </EnhancedTableBody>
            </EnhancedTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PushNotifications;
