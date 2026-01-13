import { api } from './api';

const SW_PATH = '/sw.js';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH);
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Get VAPID public key from server
 */
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const response = await api.get('/notifications/push/vapid-key');
    return response.data.publicKey;
  } catch (error) {
    console.error('Failed to get VAPID key:', error);
    return null;
  }
}

/**
 * Convert VAPID key to Uint8Array for subscription
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return false;
  }

  // Check permission
  const permission = await requestPermission();
  if (permission !== 'granted') {
    console.warn('Push notification permission denied');
    return false;
  }

  // Register service worker
  const registration = await registerServiceWorker();
  if (!registration) {
    return false;
  }

  // Get VAPID key
  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) {
    console.error('Failed to get VAPID public key');
    return false;
  }

  try {
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    // Send subscription to server
    const subscriptionJson = subscription.toJSON();
    await api.post('/notifications/push/subscribe', {
      subscription: {
        endpoint: subscriptionJson.endpoint,
        keys: {
          p256dh: subscriptionJson.keys?.p256dh,
          auth: subscriptionJson.keys?.auth
        }
      }
    });

    console.log('Push subscription successful');
    return true;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!registration) {
      return true;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Notify server
    await api.delete('/notifications/push/unsubscribe');

    console.log('Push unsubscription successful');
    return true;
  } catch (error) {
    console.error('Push unsubscription failed:', error);
    return false;
  }
}

/**
 * Check if currently subscribed to push
 */
export async function isSubscribedToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get push subscription status from server
 */
export async function getPushStatus(): Promise<{ subscribed: boolean; count: number }> {
  try {
    const response = await api.get('/notifications/push/status');
    return {
      subscribed: response.data.subscribed,
      count: response.data.subscriptionCount
    };
  } catch (error) {
    return { subscribed: false, count: 0 };
  }
}

/**
 * Send test notification
 */
export async function sendTestNotification(): Promise<boolean> {
  try {
    await api.post('/notifications/push/test');
    return true;
  } catch (error) {
    console.error('Test notification failed:', error);
    return false;
  }
}
