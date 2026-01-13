import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Play,
  StopCircle,
  RotateCcw,
  Unlock,
  MessageSquare,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { CommandInputDialog } from '../components/CommandInputDialog';

interface Charger {
  charge_point_id: string;
  address: string | null;
  isConnected: boolean;
  potencia_kw: number | null;
  total_kwh_charged: number;
  total_profit: number;
}

interface CommandLog {
  id: string;
  command: string;
  chargerId: string;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
  message?: string;
}

type Command = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  bgColor: string;
};

export const Operations = () => {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const [selectedCharger, setSelectedCharger] = useState<Charger | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
  const [executing, setExecuting] = useState(false);

  const fetchChargers = useCallback(async () => {
    try {
      const response = await api.get('/chargers');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setChargers(data);
    } catch (err) {
      console.error('Erro ao buscar carregadores:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChargers();
    const intervalId = setInterval(() => void fetchChargers(), 5000);
    return () => clearInterval(intervalId);
  }, [fetchChargers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchChargers();
    setRefreshing(false);
    toast.success('Lista atualizada!');
  };

  const commands: Command[] = [
    {
      id: 'start',
      label: 'Iniciar Transação',
      icon: <Play className="w-5 h-5" />,
      description: 'Iniciar sessão de carregamento remotamente',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
    },
    {
      id: 'stop',
      label: 'Parar Transação',
      icon: <StopCircle className="w-5 h-5" />,
      description: 'Interromper sessão ativa de carregamento',
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
    },
    {
      id: 'reset',
      label: 'Reset Carregador',
      icon: <RotateCcw className="w-5 h-5" />,
      description: 'Reiniciar sistema do carregador',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
    },
    {
      id: 'availability',
      label: 'Disponibilidade',
      icon: <Zap className="w-5 h-5" />,
      description: 'Alterar estado de disponibilidade',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
    },
    {
      id: 'unlock',
      label: 'Destravar Conector',
      icon: <Unlock className="w-5 h-5" />,
      description: 'Liberar conector bloqueado',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
    },
    {
      id: 'triggerMessage',
      label: 'Mensagem OCPP',
      icon: <MessageSquare className="w-5 h-5" />,
      description: 'Enviar mensagem OCPP específica',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
    },
  ];

  const addLog = (command: string, chargerId: string, status: 'success' | 'error' | 'pending', message?: string) => {
    const log: CommandLog = {
      id: Date.now().toString(),
      command,
      chargerId,
      timestamp: new Date(),
      status,
      message,
    };
    setCommandLogs(prev => [log, ...prev].slice(0, 10));
  };

  const executeApiCommand = async (endpoint: string, body: Record<string, unknown>, commandLabel: string) => {
    const chargerId = body.chargerId as string;
    addLog(commandLabel, chargerId, 'pending');

    try {
      const response = await api.post(`/command/${endpoint}`, body);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errData.details || errData.error || 'Erro desconhecido');
      }
      await response.json();
      addLog(commandLabel, chargerId, 'success', 'Comando executado com sucesso');
      toast.success(`Comando '${commandLabel}' enviado com sucesso!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      addLog(commandLabel, chargerId, 'error', errorMessage);
      toast.error(`ERRO: ${errorMessage}`);
    }
  };

  const executeChargerCommand = async (
    commandPath: string,
    body: Record<string, unknown>,
    chargerId: string,
    commandLabel: string
  ) => {
    addLog(commandLabel, chargerId, 'pending');

    try {
      const response = await api.post(`/chargers/${chargerId}/${commandPath}`, body);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errData.details || errData.error || 'Erro desconhecido');
      }
      await response.json();
      addLog(commandLabel, chargerId, 'success', 'Comando executado com sucesso');
      toast.success(`Comando '${commandLabel}' enviado com sucesso!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      addLog(commandLabel, chargerId, 'error', errorMessage);
      toast.error(`ERRO: ${errorMessage}`);
    }
  };

  const handleExecute = () => {
    if (!selectedCommand || !selectedCharger) {
      toast.error('Selecione um comando e um carregador');
      return;
    }
    setShowDialog(true);
  };

  const handleCommandConfirm = async (values: Record<string, string | number>) => {
    if (!selectedCommand || !selectedCharger) return;

    setExecuting(true);
    const charger = selectedCharger;
    const commandInfo = commands.find(c => c.id === selectedCommand);
    const commandLabel = commandInfo?.label || selectedCommand;

    if (selectedCommand === 'start') {
      await executeApiCommand('start', {
        chargerId: charger.charge_point_id,
        idTag: values.idTag as string,
      }, commandLabel);
    } else if (selectedCommand === 'stop') {
      await executeApiCommand('stop', {
        chargerId: charger.charge_point_id,
        transactionId: values.transactionId as number,
      }, commandLabel);
    } else if (selectedCommand === 'reset') {
      await executeChargerCommand('reset', { type: values.type as string }, charger.charge_point_id, commandLabel);
    } else if (selectedCommand === 'availability') {
      await executeChargerCommand('availability', {
        connectorId: values.connectorId as number,
        type: values.type as string,
      }, charger.charge_point_id, commandLabel);
    } else if (selectedCommand === 'unlock') {
      await executeChargerCommand('unlock', { connectorId: values.connectorId as number }, charger.charge_point_id, commandLabel);
    } else if (selectedCommand === 'triggerMessage') {
      await executeChargerCommand('trigger-message', { requestedMessage: values.requestedMessage as string }, charger.charge_point_id, commandLabel);
    }

    setExecuting(false);
    setSelectedCommand(null);
    setSelectedCharger(null);
  };

  const onlineChargers = chargers.filter(c => c.isConnected).length;
  const offlineChargers = chargers.filter(c => !c.isConnected).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-emerald-300/60">Carregando carregadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-emerald-400" />
            Centro de Operações
          </h1>
          <p className="text-emerald-300/60 mt-1">Controle remoto dos carregadores OCPP</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-800/30 rounded-lg text-emerald-300 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <Wifi className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-300/60">Carregadores Online</p>
              <p className="text-2xl font-bold text-emerald-400">{onlineChargers}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-zinc-500/20 rounded-xl">
              <WifiOff className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-300/60">Carregadores Offline</p>
              <p className="text-2xl font-bold text-zinc-400">{offlineChargers}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-300/60">Comandos Executados</p>
              <p className="text-2xl font-bold text-blue-400">{commandLogs.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commands List */}
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
          <CardHeader className="border-b border-emerald-800/30 pb-4">
            <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Comandos OCPP
            </CardTitle>
            <p className="text-sm text-emerald-300/60">Selecione uma ação</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {commands.map(command => {
              const isSelected = selectedCommand === command.id;
              return (
                <button
                  key={command.id}
                  onClick={() => setSelectedCommand(command.id)}
                  className={`w-full p-3 border rounded-xl transition-all text-left group ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-900/20'
                      : 'bg-emerald-950/30 border-emerald-800/30 hover:border-emerald-700/50 hover:bg-emerald-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-emerald-500/30' : command.bgColor}`}>
                      <div className={isSelected ? 'text-emerald-300' : command.color}>{command.icon}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium truncate ${isSelected ? 'text-emerald-100' : 'text-emerald-50'}`}>
                        {command.label}
                      </h3>
                      <p className={`text-xs truncate ${isSelected ? 'text-emerald-200/70' : 'text-emerald-300/50'}`}>
                        {command.description}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-emerald-400 translate-x-1' : 'text-emerald-600 group-hover:translate-x-1'}`} />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Chargers List */}
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
          <CardHeader className="border-b border-emerald-800/30 pb-4">
            <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Carregadores
              <span className="ml-auto text-sm font-normal text-emerald-300/60">
                {onlineChargers} online
              </span>
            </CardTitle>
            <p className="text-sm text-emerald-300/60">Selecione o destino</p>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pt-4 custom-scrollbar">
            {chargers.length === 0 ? (
              <div className="text-center py-8 text-emerald-300/50">
                Nenhum carregador encontrado
              </div>
            ) : (
              chargers.map(charger => {
                const isSelected = selectedCharger?.charge_point_id === charger.charge_point_id;
                return (
                  <button
                    key={charger.charge_point_id}
                    onClick={() => setSelectedCharger(charger)}
                    className={`w-full p-3 border rounded-xl transition-all text-left ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-900/20'
                        : 'bg-emerald-950/30 border-emerald-800/30 hover:border-emerald-700/50 hover:bg-emerald-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${charger.isConnected ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                        {charger.isConnected && (
                          <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate ${isSelected ? 'text-emerald-100' : 'text-emerald-50'}`}>
                          {charger.charge_point_id}
                        </h3>
                        <p className={`text-xs truncate ${isSelected ? 'text-emerald-200/70' : 'text-emerald-300/50'}`}>
                          {charger.address || 'Sem endereço'} • {charger.potencia_kw || '?'} kW
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        charger.isConnected
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {charger.isConnected ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-emerald-700/30 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-emerald-950/50">
                          <p className="text-emerald-300/50">Energia Total</p>
                          <p className="text-emerald-200 font-medium">{parseFloat(charger.total_kwh_charged.toString()).toFixed(1)} kWh</p>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-950/50">
                          <p className="text-emerald-300/50">Lucro Total</p>
                          <p className="text-emerald-200 font-medium">R$ {parseFloat(charger.total_profit.toString()).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Command Log */}
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
          <CardHeader className="border-b border-emerald-800/30 pb-4">
            <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              Histórico de Comandos
            </CardTitle>
            <p className="text-sm text-emerald-300/60">Últimos 10 comandos</p>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pt-4 custom-scrollbar">
            {commandLogs.length === 0 ? (
              <div className="text-center py-8 text-emerald-300/50">
                <Terminal className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Nenhum comando executado</p>
              </div>
            ) : (
              commandLogs.map(log => (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border ${
                    log.status === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : log.status === 'error'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                    ) : log.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-400 animate-pulse mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-emerald-100 truncate">{log.command}</p>
                        <span className="text-xs text-emerald-300/50 whitespace-nowrap">
                          {log.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-300/60 truncate">{log.chargerId}</p>
                      {log.message && (
                        <p className={`text-xs mt-1 ${log.status === 'error' ? 'text-red-400/70' : 'text-emerald-300/50'}`}>
                          {log.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Execute Button */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-950/50 to-transparent rounded-xl border border-emerald-800/30">
        <div className="flex items-center gap-4">
          {selectedCommand && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
              <span className="text-sm text-emerald-300">Comando:</span>
              <span className="text-sm font-medium text-emerald-100">
                {commands.find(c => c.id === selectedCommand)?.label}
              </span>
            </div>
          )}
          {selectedCharger && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <span className="text-sm text-blue-300">Destino:</span>
              <span className="text-sm font-medium text-blue-100">{selectedCharger.charge_point_id}</span>
            </div>
          )}
          {!selectedCommand && !selectedCharger && (
            <p className="text-emerald-300/50 text-sm">Selecione um comando e um carregador para continuar</p>
          )}
        </div>
        <Button
          size="lg"
          onClick={handleExecute}
          disabled={!selectedCommand || !selectedCharger || executing}
          className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30 min-w-[180px]"
        >
          {executing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Executar Comando
            </>
          )}
        </Button>
      </div>

      {/* Command Input Dialog */}
      {selectedCommand && selectedCharger && (
        <CommandInputDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          commandType={selectedCommand}
          chargerName={selectedCharger.charge_point_id}
          onConfirm={handleCommandConfirm}
        />
      )}
    </div>
  );
};
