import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Check, Trash2, X, Settings } from 'lucide-react';
import { Button } from './ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { api } from '../lib/api';
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  sendTestNotification,
} from '../lib/webPush';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  icon: string;
  isRead: boolean;
  data: Record<string, any> | null;
  createdAt: string;
}

const iconMap: Record<string, string> = {
  'flash': '⚡',
  'checkmark-circle': '✓',
  'alert-circle': '⚠️',
  'wallet': '💰',
  'card': '💳',
  'gift': '🎁',
  'information-circle': 'ℹ️',
  'location': '📍',
  'bell': '🔔',
};

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  // Check push status
  const checkPushStatus = useCallback(async () => {
    const supported = isPushSupported();
    setPushSupported(supported);

    if (supported) {
      const subscribed = await isSubscribedToPush();
      setPushEnabled(subscribed);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNotifications();
    checkPushStatus();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, checkPushStatus]);

  // Handle push toggle
  const handlePushToggle = async (enabled: boolean) => {
    setLoading(true);
    try {
      if (enabled) {
        const success = await subscribeToPush();
        setPushEnabled(success);
        if (!success) {
          alert('Não foi possível ativar as notificações. Verifique as permissões do navegador.');
        }
      } else {
        await unsubscribeFromPush();
        setPushEnabled(false);
      }
    } catch (error) {
      console.error('Push toggle failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Test push notification
  const handleTestPush = async () => {
    setLoading(true);
    try {
      const success = await sendTestNotification();
      if (success) {
        alert('Notificação de teste enviada!');
      } else {
        alert('Falha ao enviar notificação de teste.');
      }
    } catch (error) {
      console.error('Test push failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-zinc-400 hover:text-white hover:bg-zinc-900"
        >
          {pushEnabled ? (
            <Bell className="w-5 h-5" />
          ) : (
            <BellOff className="w-5 h-5" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0 bg-zinc-900 border-zinc-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <h3 className="font-semibold text-white">Notificações</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-zinc-400 hover:text-white h-7 px-2"
              >
                <Check className="w-3 h-3 mr-1" />
                Ler todas
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="h-7 w-7 text-zinc-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-3 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-white">Notificações Push</p>
                <p className="text-xs text-zinc-500">
                  {pushSupported
                    ? 'Receba alertas mesmo com o navegador fechado'
                    : 'Não suportado neste navegador'}
                </p>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={handlePushToggle}
                disabled={!pushSupported || loading}
              />
            </div>
            {pushEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestPush}
                disabled={loading}
                className="w-full text-xs border-zinc-700 text-zinc-300 hover:text-white"
              >
                Testar Notificação
              </Button>
            )}
            {!pushSupported && (
              <p className="text-xs text-amber-500 mt-2">
                Seu navegador não suporta notificações push.
              </p>
            )}
            {pushSupported && getPermissionStatus() === 'denied' && (
              <p className="text-xs text-red-500 mt-2">
                Notificações bloqueadas. Verifique as configurações do navegador.
              </p>
            )}
          </div>
        )}

        {/* Notifications List */}
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-zinc-500">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-zinc-800/50 transition-colors ${
                    !notification.isRead ? 'bg-zinc-800/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">
                      {iconMap[notification.icon] || '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${
                          notification.isRead ? 'text-zinc-400' : 'text-white'
                        }`}>
                          {notification.title}
                        </p>
                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="h-6 px-2 text-xs text-zinc-400 hover:text-emerald-400"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Marcar como lida
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification(notification.id)}
                          className="h-6 px-2 text-xs text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
