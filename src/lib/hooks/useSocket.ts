import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env?.VITE_SOCKET_URL ?? 'http://localhost:3000';

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
 * Hook para gerenciar conexao WebSocket com o servidor OCPP
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

  useEffect(() => {
    // Get auth token
    const token = localStorage.getItem('token');

    // Initialize socket connection with auth
    const socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');

      // Re-subscribe to previously subscribed chargers
      subscribedChargers.current.forEach(chargerId => {
        socket.emit('subscribe:charger', { chargerId });
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Charger status update event
    socket.on('charger:statusUpdate', (data: ChargerStatusEvent) => {
      setChargerStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(data.chargerId, data);
        return newMap;
      });
      setLastUpdate(new Date());
    });

    // Transaction events
    socket.on('transaction:started', (data: TransactionEvent) => {
      setRecentTransactions(prev => [{ ...data, status: 'started' }, ...prev.slice(0, 49)]);
      setLastUpdate(new Date());
    });

    socket.on('transaction:updated', (data: TransactionEvent) => {
      setRecentTransactions(prev => [{ ...data, status: 'updated' }, ...prev.slice(0, 49)]);
      setLastUpdate(new Date());
    });

    socket.on('transaction:stopped', (data: TransactionEvent) => {
      setRecentTransactions(prev => [{ ...data, status: 'stopped' }, ...prev.slice(0, 49)]);
      setLastUpdate(new Date());
    });

    // Meter values event
    socket.on('meterValues', (data: MeterValueEvent) => {
      setMeterValues(prev => {
        const newMap = new Map(prev);
        newMap.set(data.chargerId, data);
        return newMap;
      });
      setLastUpdate(new Date());
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribeToCharger = useCallback((chargerId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('subscribe:charger', { chargerId });
      subscribedChargers.current.add(chargerId);
    }
  }, []);

  const unsubscribeFromCharger = useCallback((chargerId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('unsubscribe:charger', { chargerId });
      subscribedChargers.current.delete(chargerId);
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
