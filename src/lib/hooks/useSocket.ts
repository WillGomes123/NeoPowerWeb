import { useState, useEffect, useCallback, useRef } from 'react';

// WebSocket URL for notifications (base_ocpp uses /notifications path)
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env?.VITE_WS_HOST ?? window.location.host;
  return `${protocol}//${host}/notifications`;
};

// Types for charger events
interface ChargerStatusEvent {
  chargerId: string;
  status: string;
  connectorId?: number;
  errorCode?: string;
  timestamp: string;
}

interface TransactionEvent {
  chargerId: string;
  transactionId: number;
  meterValue?: number;
  status: 'started' | 'updated' | 'stopped';
  timestamp: string;
}

interface MeterValueEvent {
  chargerId: string;
  transactionId: number;
  meterValue: number;
  timestamp: string;
}

// Notification types from base_ocpp
interface BaseNotification {
  type: string;
  sentAt?: string;
  [key: string]: unknown;
}

// Hook return type
interface UseSocketReturn {
  isConnected: boolean;
  chargerStatuses: Map<string, ChargerStatusEvent>;
  recentTransactions: TransactionEvent[];
  meterValues: Map<string, MeterValueEvent>;
  subscribeToCharger: (chargerId: string) => void;
  unsubscribeFromCharger: (chargerId: string) => void;
  lastUpdate: Date | null;
}

/**
 * Hook para gerenciar conexao WebSocket com o servidor base_ocpp CSMS
 * Fornece atualizacoes em tempo real sobre status de carregadores e transacoes
 */
export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [chargerStatuses, setChargerStatuses] = useState<Map<string, ChargerStatusEvent>>(new Map());
  const [recentTransactions, setRecentTransactions] = useState<TransactionEvent[]>([]);
  const [meterValues, setMeterValues] = useState<Map<string, MeterValueEvent>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const subscribedChargers = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = getWebSocketUrl();
    console.log('Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected to base_ocpp');

      // Start ping interval to keep connection alive
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      // Re-subscribe to previously subscribed chargers
      subscribedChargers.current.forEach(chargerId => {
        ws.send(JSON.stringify({ type: 'subscribe', events: [`charger:${chargerId}`] }));
      });
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data: BaseNotification = JSON.parse(event.data);
        handleNotification(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }, []);

  const handleNotification = useCallback((data: BaseNotification) => {
    const timestamp = data.sentAt || new Date().toISOString();
    setLastUpdate(new Date());

    switch (data.type) {
      case 'connected':
        console.log('Connected to notification service:', data.message);
        break;

      case 'pong':
        // Ping response, ignore
        break;

      case 'chargepoint:connected':
      case 'chargepoint:disconnected': {
        const chargerId = data.chargePointId as string;
        if (chargerId) {
          setChargerStatuses(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(chargerId);
            newMap.set(chargerId, {
              ...existing,
              chargerId,
              status: data.type === 'chargepoint:connected' ? 'Available' : 'Offline',
              timestamp,
            });
            return newMap;
          });
        }
        break;
      }

      case 'connector:status': {
        const chargerId = data.chargePointId as string;
        const connectorId = data.connectorId as number;
        const status = data.status as string;
        const errorCode = data.errorCode as string | undefined;

        if (chargerId) {
          setChargerStatuses(prev => {
            const newMap = new Map(prev);
            newMap.set(chargerId, {
              chargerId,
              status,
              connectorId,
              errorCode,
              timestamp,
            });
            return newMap;
          });
        }
        break;
      }

      case 'transaction:started': {
        const txEvent: TransactionEvent = {
          chargerId: data.chargePointId as string,
          transactionId: data.transactionId as number,
          status: 'started',
          timestamp,
        };
        setRecentTransactions(prev => [txEvent, ...prev.slice(0, 49)]);
        break;
      }

      case 'transaction:updated': {
        const txEvent: TransactionEvent = {
          chargerId: data.chargePointId as string,
          transactionId: data.transactionId as number,
          meterValue: data.meterValue as number | undefined,
          status: 'updated',
          timestamp,
        };
        setRecentTransactions(prev => [txEvent, ...prev.slice(0, 49)]);
        break;
      }

      case 'transaction:stopped': {
        const txEvent: TransactionEvent = {
          chargerId: data.chargePointId as string,
          transactionId: data.transactionId as number,
          status: 'stopped',
          timestamp,
        };
        setRecentTransactions(prev => [txEvent, ...prev.slice(0, 49)]);
        break;
      }

      case 'meterValues': {
        const chargerId = data.chargePointId as string;
        if (chargerId) {
          setMeterValues(prev => {
            const newMap = new Map(prev);
            newMap.set(chargerId, {
              chargerId,
              transactionId: data.transactionId as number,
              meterValue: data.meterValue as number,
              timestamp,
            });
            return newMap;
          });
        }
        break;
      }

      default:
        // Log unknown events for debugging
        if (!['stats', 'server:shutdown'].includes(data.type)) {
          console.log('Unhandled notification type:', data.type, data);
        }
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const subscribeToCharger = useCallback((chargerId: string) => {
    subscribedChargers.current.add(chargerId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', events: [`charger:${chargerId}`] }));
    }
  }, []);

  const unsubscribeFromCharger = useCallback((chargerId: string) => {
    subscribedChargers.current.delete(chargerId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', events: [`charger:${chargerId}`] }));
    }
  }, []);

  return {
    isConnected,
    chargerStatuses,
    recentTransactions,
    meterValues,
    subscribeToCharger,
    unsubscribeFromCharger,
    lastUpdate,
  };
}

/**
 * Hook simplificado para monitorar status de um carregador especifico
 */
export function useChargerStatus(chargerId: string): {
  status: ChargerStatusEvent | null;
  isConnected: boolean;
  lastUpdate: Date | null;
} {
  const { chargerStatuses, subscribeToCharger, unsubscribeFromCharger, isConnected, lastUpdate } = useSocket();

  useEffect(() => {
    if (chargerId) {
      subscribeToCharger(chargerId);
      return () => unsubscribeFromCharger(chargerId);
    }
  }, [chargerId, subscribeToCharger, unsubscribeFromCharger]);

  return {
    status: chargerStatuses.get(chargerId) || null,
    isConnected,
    lastUpdate,
  };
}

/**
 * Hook para obter estatisticas em tempo real
 */
export function useRealtimeStats(): {
  onlineChargers: number;
  activeTransactions: number;
  isConnected: boolean;
  lastUpdate: Date | null;
} {
  const { chargerStatuses, recentTransactions, isConnected, lastUpdate } = useSocket();

  const onlineChargers = Array.from(chargerStatuses.values()).filter(
    s => s.status === 'Available' || s.status === 'Charging' || s.status === 'Preparing'
  ).length;

  const activeTransactions = recentTransactions.filter(t => t.status === 'started').length;

  return {
    onlineChargers,
    activeTransactions,
    isConnected,
    lastUpdate,
  };
}
