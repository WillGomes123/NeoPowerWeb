import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Zap,
  Wifi,
  WifiOff,
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Power,
  Link2Off,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

interface ChargerStatus {
  id: number;
  chargePointId: string;
  description?: string;
  model: string;
  vendor: string;
  powerKw?: number;
  isConnected: boolean;
  isCharging: boolean;
  status: string;
  lastBootTime: string;
  totalKwh: number;
  totalRevenue: number;
  totalSessions: number;
}

interface Props {
  locationId: number;
}

export function LocationMonitoringTab({ locationId }: Props) {
  const [chargers, setChargers] = useState<ChargerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const fetchChargers = useCallback(async () => {
    try {
      const response = await api.get(`/locations/${locationId}/chargers`);
      if (!response.ok) throw new Error('Erro ao carregar carregadores');
      const data = await response.json();
      setChargers(data.chargers || []);
    } catch (error) {
      console.error('Erro ao carregar carregadores:', error);
      toast.error('Erro ao carregar status dos carregadores');
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchChargers();
  }, [fetchChargers]);

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchChargers();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchChargers]);

  const handleUnlinkCharger = async (chargePointId: string) => {
    if (!window.confirm('Tem certeza que deseja desvincular este carregador deste local? Ele ficará disponível para ser associado a outro local.')) {
      return;
    }

    try {
      const response = await api.put(`/chargers/${chargePointId}/assign-location`, {
        locationId: null
      });

      if (!response.ok) throw new Error('Erro ao desvincular carregador');

      toast.success('Carregador desvinculado com sucesso');
      fetchChargers();
    } catch (error) {
      console.error('Erro ao desvincular:', error);
      toast.error('Ocorreu um erro ao desvincular o carregador');
    }
  };

  const getStatusInfo = (status: string) => {
    const statusLower = status?.toLowerCase() || '';

    if (statusLower === 'available' || statusLower === 'online') {
      return {
        icon: CheckCircle,
        color: 'text-primary',
        bg: 'bg-primary/10',
        label: 'Disponível',
        badgeClass: 'bg-primary/10 text-primary'
      };
    }
    if (statusLower === 'charging' || statusLower === 'occupied') {
      return {
        icon: Zap,
        color: 'text-primary',
        bg: 'bg-primary/10',
        label: 'Carregando',
        badgeClass: 'bg-primary/10 text-primary'
      };
    }
    if (statusLower === 'preparing') {
      return {
        icon: Power,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500/20',
        label: 'Preparando',
        badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
      };
    }
    if (statusLower === 'finishing' || statusLower === 'suspendedev' || statusLower === 'suspendedevse') {
      return {
        icon: AlertCircle,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500/20',
        label: 'Finalizando',
        badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
      };
    }
    if (statusLower === 'faulted') {
      return {
        icon: XCircle,
        color: 'text-error',
        bg: 'bg-error/10',
        label: 'Com Falha',
        badgeClass: 'bg-error/10 text-error'
      };
    }
    if (statusLower === 'unavailable' || statusLower === 'offline') {
      return {
        icon: WifiOff,
        color: 'text-gray-400',
        bg: 'bg-gray-500/20',
        label: 'Indisponível',
        badgeClass: 'bg-gray-500/20 text-gray-400'
      };
    }
    return {
      icon: AlertCircle,
      color: 'text-gray-400',
      bg: 'bg-gray-500/20',
      label: status || 'Desconhecido',
      badgeClass: 'bg-gray-500/20 text-gray-400'
    };
  };

  const formatLastHeartbeat = (timestamp: string) => {
    if (!timestamp) return 'Nunca';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
  };

  // Contadores de status
  const statusCounts = {
    online: chargers.filter(c => c.isConnected).length,
    offline: chargers.filter(c => !c.isConnected).length,
    charging: chargers.filter(c => c.isCharging).length,
    faulted: chargers.filter(c => c.status?.toLowerCase() === 'faulted').length
  };

  return (
    <div className="space-y-6">
      {/* Resumo de Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Online</p>
                <p className="text-2xl font-bold text-foreground">{statusCounts.online}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-container-highest rounded-lg">
                <Zap className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Carregando</p>
                <p className="text-2xl font-bold text-foreground">{statusCounts.charging}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500/20 rounded-lg">
                <WifiOff className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Offline</p>
                <p className="text-2xl font-bold text-foreground">{statusCounts.offline}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error/10 rounded-lg">
                <XCircle className="w-5 h-5 text-error" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Com Falha</p>
                <p className="text-2xl font-bold text-foreground">{statusCounts.faulted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Carregadores */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-foreground" />
              Carregadores ({chargers.length})
            </CardTitle>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-border bg-surface-container text-primary focus:ring-primary"
                />
                Auto-atualizar
              </label>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsLoading(true);
                  fetchChargers();
                }}
                disabled={isLoading}
                className="text-foreground/70 hover:bg-surface-container-high"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading && chargers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-foreground/70 animate-spin" />
            </div>
          ) : chargers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum carregador encontrado neste local
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chargers.map((charger) => {
                const statusInfo = getStatusInfo(charger.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <Card
                    key={charger.id}
                    className={`bg-surface-container border-border transition-all hover:border-border`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${statusInfo.bg} rounded-lg`}>
                            <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                          </div>
                          <div>
                            <h4 className="text-foreground font-medium">
                              {charger.description || charger.chargePointId}
                            </h4>
                            {charger.description && (
                              <p className="text-[10px] bg-surface-container text-primary font-mono inline-block px-1 rounded mb-0.5">
                                {charger.chargePointId}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {charger.vendor} {charger.model} {charger.powerKw ? `- ${charger.powerKw}kW` : ''}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-2 mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-[11px] border-primary/20 text-primary hover:bg-primary/10"
                            onClick={() => handleUnlinkCharger(charger.chargePointId)}
                          >
                            <Link2Off className="w-3 h-3 mr-1" />
                            Desvincular
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Último boot
                          </span>
                          <span className="text-foreground">
                            {formatLastHeartbeat(charger.lastBootTime)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Energia total
                          </span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {(charger.totalKwh || 0).toFixed(2)} kWh
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Sessões
                          </span>
                          <span className="text-foreground">
                            {charger.totalSessions || 0}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LocationMonitoringTab;
