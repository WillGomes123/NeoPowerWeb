import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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
 * Hook para gerenciar conexao Socket.IO com o servidor OCPP_API
 * Fornece atualizacoes em tempo real sobre status de carregadores e transacoes
 */
export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [chargerStatuses, setChargerStatuses] = useState<Map<string, ChargerStatusEvent>>(new Map());
  const [recentTransactions, setRecentTransactions] = useState<TransactionEvent[]>([]);
  const [meterValues, setMeterValues] = useState<Map<string, MeterValueEvent>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const subscribedChargers = useRef<Set<string>>(new Set());

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    // Get auth token
    const token = localStorage.getItem('token');

    // Connect to Socket.IO server
    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket.IO connected to OCPP_API');

      // Re-subscribe to previously subscribed chargers
      subscribedChargers.current.forEach(chargerId => {
        socket.emit('subscribe', { charger: chargerId });
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket.IO disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });

    // OCPP_API events - charger connection
    socket.on('charger_connected', (data: { id: string }) => {
      const timestamp = new Date().toISOString();
      setLastUpdate(new Date());
      setChargerStatuses((prev: Map<string, ChargerStatusEvent>) => {
        const newMap = new Map<string, ChargerStatusEvent>(prev);
        const existing = newMap.get(data.id);
        const updated: ChargerStatusEvent = {
          chargerId: data.id,
          status: 'Available',
          timestamp,
          connectorId: existing?.connectorId,
          errorCode: existing?.errorCode,
        };
        newMap.set(data.id, updated);
        return newMap;
      });
    });

    socket.on('charger_disconnected', (data: { id: string }) => {
      const timestamp = new Date().toISOString();
      setLastUpdate(new Date());
      setChargerStatuses((prev: Map<string, ChargerStatusEvent>) => {
        const newMap = new Map<string, ChargerStatusEvent>(prev);
        const existing = newMap.get(data.id);
        const updated: ChargerStatusEvent = {
          chargerId: data.id,
          status: 'Offline',
          timestamp,
          connectorId: existing?.connectorId,
          errorCode: existing?.errorCode,
        };
        newMap.set(data.id, updated);
        return newMap;
      });
    });

    // Heartbeat event
    socket.on('heartbeat', (data: { charger: string }) => {
      setLastUpdate(new Date());
      // Update last seen for the charger
      setChargerStatuses((prev: Map<string, ChargerStatusEvent>) => {
        const newMap = new Map<string, ChargerStatusEvent>(prev);
        const existing = newMap.get(data.charger);
        if (existing) {
          const updated: ChargerStatusEvent = {
            chargerId: existing.chargerId,
            status: existing.status,
            timestamp: new Date().toISOString(),
            connectorId: existing.connectorId,
            errorCode: existing.errorCode,
          };
          newMap.set(data.charger, updated);
        }
        return newMap;
      });
    });

    // Boot notification
    socket.on('boot_notification', (data: { chargerId: string; vendor?: string; model?: string }) => {
      const timestamp = new Date().toISOString();
      setLastUpdate(new Date());
      setChargerStatuses((prev: Map<string, ChargerStatusEvent>) => {
        const newMap = new Map<string, ChargerStatusEvent>(prev);
        newMap.set(data.chargerId, {
          chargerId: data.chargerId,
          status: 'Available',
          timestamp,
        });
        return newMap;
      });
    });

    // Status notification (connector status)
    socket.on('status_notification', (data: {
      chargerId: string;
      connectorId: number;
      status: string;
      errorCode?: string
    }) => {
      const timestamp = new Date().toISOString();
      setLastUpdate(new Date());
      setChargerStatuses((prev: Map<string, ChargerStatusEvent>) => {
        const newMap = new Map<string, ChargerStatusEvent>(prev);
        newMap.set(data.chargerId, {
          chargerId: data.chargerId,
          status: data.status,
          connectorId: data.connectorId,
          errorCode: data.errorCode,
          timestamp,
        });
        return newMap;
      });
    });

    // Meter value updates
    socket.on('meter_value_update', (data: {
      chargerId: string;
      transactionId: number;
      value?: number;
      energy?: number;
      power?: number;
      current?: number;
      voltage?: number;
      soc?: number;
      timestamp?: string;
    }) => {
      const timestamp = data.timestamp || new Date().toISOString();
      setLastUpdate(new Date());
      // Use energy if available, fallback to value
      const meterValue = data.energy ?? data.value ?? 0;
      setMeterValues((prev: Map<string, MeterValueEvent>) => {
        const newMap = new Map<string, MeterValueEvent>(prev);
        newMap.set(data.chargerId, {
          chargerId: data.chargerId,
          transactionId: data.transactionId,
          meterValue,
          timestamp,
        });
        return newMap;
      });
    });

    // Transaction started
    socket.on('transaction_started', (data: {
      chargerId: string;
      transactionId: number;
      idTag?: string;
      meterStart?: number;
      timestamp?: string;
    }) => {
      const timestamp = data.timestamp || new Date().toISOString();
      setLastUpdate(new Date());
      const txEvent: TransactionEvent = {
        chargerId: data.chargerId,
        transactionId: data.transactionId,
        status: 'started',
        timestamp,
      };
      setRecentTransactions(prev => [txEvent, ...prev.slice(0, 49)]);
    });

    // Transaction stopped
    socket.on('transaction_stopped', (data: {
      chargerId: string;
      transactionId: number;
      meterStop?: number;
      reason?: string;
      consumedWh?: number;
      totalCost?: number;
      timestamp?: string;
    }) => {
      const timestamp = data.timestamp || new Date().toISOString();
      setLastUpdate(new Date());
      const txEvent: TransactionEvent = {
        chargerId: data.chargerId,
        transactionId: data.transactionId,
        meterValue: data.meterStop,
        status: 'stopped',
        timestamp,
      };
      setRecentTransactions(prev => [txEvent, ...prev.slice(0, 49)]);
    });

    // Payment confirmed (wallet updated)
    socket.on('payment_confirmed', (data: {
      paymentId: number | string;
      amount: number;
      newBalance: number;
      message: string;
    }) => {
      setLastUpdate(new Date());
      console.log('Payment confirmed:', data);
    });

    // Wallet updated
    socket.on('wallet_updated', (data: {
      balance: number;
      transactionType: string;
      amount: number;
    }) => {
      setLastUpdate(new Date());
      console.log('Wallet updated:', data);
    });

  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const subscribeToCharger = useCallback((chargerId: string) => {
    subscribedChargers.current.add(chargerId);
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', { charger: chargerId });
    }
  }, []);

  const unsubscribeFromCharger = useCallback((chargerId: string) => {
    subscribedChargers.current.delete(chargerId);
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', { charger: chargerId });
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
