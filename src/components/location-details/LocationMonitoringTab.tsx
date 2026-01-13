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
  Power
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ChargerStatus {
  id: number;
  chargePointId: string;
  name: string;
  status: string;
  lastHeartbeat: string;
  connectorStatus: string;
  currentTransaction: {
    id: number;
    startTime: string;
    meterValue: number;
  } | null;
  uptime: number;
}

interface Props {
  locationId: number;
}

export function LocationMonitoringTab({ locationId }: Props) {
  const [chargers, setChargers] = useState<ChargerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchChargers = useCallback(async () => {
    try {
      const response = await api.get(`/locations/${locationId}/chargers`);
      setChargers(response.data || []);
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

  const getStatusInfo = (status: string) => {
    const statusLower = status?.toLowerCase() || '';

    if (statusLower === 'available' || statusLower === 'online') {
      return {
        icon: CheckCircle,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/20',
        label: 'Disponível',
        badgeClass: 'bg-emerald-500/20 text-emerald-400'
      };
    }
    if (statusLower === 'charging' || statusLower === 'occupied') {
      return {
        icon: Zap,
        color: 'text-blue-400',
        bg: 'bg-blue-500/20',
        label: 'Carregando',
        badgeClass: 'bg-blue-500/20 text-blue-400'
      };
    }
    if (statusLower === 'preparing') {
      return {
        icon: Power,
        color: 'text-amber-400',
        bg: 'bg-amber-500/20',
        label: 'Preparando',
        badgeClass: 'bg-amber-500/20 text-amber-400'
      };
    }
    if (statusLower === 'finishing' || statusLower === 'suspendedev' || statusLower === 'suspendedevse') {
      return {
        icon: AlertCircle,
        color: 'text-amber-400',
        bg: 'bg-amber-500/20',
        label: 'Finalizando',
        badgeClass: 'bg-amber-500/20 text-amber-400'
      };
    }
    if (statusLower === 'faulted') {
      return {
        icon: XCircle,
        color: 'text-red-400',
        bg: 'bg-red-500/20',
        label: 'Com Falha',
        badgeClass: 'bg-red-500/20 text-red-400'
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

  const formatUptime = (uptime: number) => {
    if (!uptime || uptime < 0) return '-';
    return `${uptime.toFixed(1)}%`;
  };

  const formatChargingTime = (startTime: string) => {
    if (!startTime) return '-';

    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  // Contadores de status
  const statusCounts = {
    online: chargers.filter(c => ['available', 'online', 'charging', 'occupied', 'preparing'].includes(c.status?.toLowerCase() || '')).length,
    offline: chargers.filter(c => ['unavailable', 'offline'].includes(c.status?.toLowerCase() || '')).length,
    charging: chargers.filter(c => ['charging', 'occupied'].includes(c.status?.toLowerCase() || '')).length,
    faulted: chargers.filter(c => c.status?.toLowerCase() === 'faulted').length
  };

  return (
    <div className="space-y-6">
      {/* Resumo de Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Wifi className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Online</p>
                <p className="text-2xl font-bold text-emerald-50">{statusCounts.online}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Carregando</p>
                <p className="text-2xl font-bold text-emerald-50">{statusCounts.charging}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500/20 rounded-lg">
                <WifiOff className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Offline</p>
                <p className="text-2xl font-bold text-emerald-50">{statusCounts.offline}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/60 uppercase">Com Falha</p>
                <p className="text-2xl font-bold text-emerald-50">{statusCounts.faulted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Carregadores */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Carregadores ({chargers.length})
            </CardTitle>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-emerald-300/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-emerald-700 bg-emerald-950/50 text-emerald-500 focus:ring-emerald-500"
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
                className="text-emerald-300 hover:bg-emerald-800/30"
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
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : chargers.length === 0 ? (
            <div className="text-center py-12 text-emerald-300/70">
              Nenhum carregador encontrado neste local
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chargers.map((charger) => {
                const statusInfo = getStatusInfo(charger.connectorStatus || charger.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <Card
                    key={charger.id}
                    className={`bg-gradient-to-br from-emerald-950/60 to-emerald-900/30 border-emerald-800/40 transition-all hover:border-emerald-700/50`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${statusInfo.bg} rounded-lg`}>
                            <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                          </div>
                          <div>
                            <h4 className="text-emerald-50 font-medium">
                              {charger.name || charger.chargePointId}
                            </h4>
                            <p className="text-xs text-emerald-300/50 font-mono">
                              {charger.chargePointId}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-300/70 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Último heartbeat
                          </span>
                          <span className="text-emerald-50">
                            {formatLastHeartbeat(charger.lastHeartbeat)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-emerald-300/70 flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Uptime
                          </span>
                          <span className="text-emerald-50">
                            {formatUptime(charger.uptime)}
                          </span>
                        </div>

                        {charger.currentTransaction && (
                          <>
                            <div className="border-t border-emerald-800/30 pt-2 mt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-blue-400 flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  Carregando
                                </span>
                                <span className="text-blue-300">
                                  {formatChargingTime(charger.currentTransaction.startTime)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-emerald-300/70">Energia</span>
                                <span className="text-amber-400">
                                  {((charger.currentTransaction.meterValue || 0) / 1000).toFixed(2)} kWh
                                </span>
                              </div>
                            </div>
                          </>
                        )}
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
