// API utility functions for making authenticated requests
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env?.VITE_API_URL ?? '/api';

// Configurações de retry
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 segundo
  // 429 (rate limit) NÃO deve fazer retry automático - usuário precisa esperar
  retryableStatuses: [408, 500, 502, 503, 504],
};

// Controle de notificação de rate limit (evita spam de toasts)
let rateLimitToastShown = false;
let rateLimitToastTimeout: ReturnType<typeof setTimeout> | null = null;

// Get token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

// Create headers with authentication
const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// Função auxiliar para delay (exponential backoff)
const delay = (ms: number, attempt: number = 1) => {
  return new Promise(resolve => setTimeout(resolve, ms * Math.pow(2, attempt - 1)));
};

// Verifica se o erro é retryable
const isRetryableError = (status: number): boolean => {
  return RETRY_CONFIG.retryableStatuses.includes(status);
};

// Mostra notificação de rate limit (com debounce para evitar spam)
const showRateLimitNotification = (retryAfter?: number) => {
  if (rateLimitToastShown) return;

  rateLimitToastShown = true;
  const minutes = retryAfter ? Math.ceil(retryAfter / 60) : 15;

  toast.error('Limite de requisições atingido', {
    description: `Muitas requisições simultâneas. Aguarde ${minutes} minuto(s) e tente novamente. Se você está usando a mesma conta em múltiplos dispositivos, isso é normal.`,
    duration: 10000,
  });

  // Reset flag após 30 segundos para permitir nova notificação se necessário
  if (rateLimitToastTimeout) clearTimeout(rateLimitToastTimeout);
  rateLimitToastTimeout = setTimeout(() => {
    rateLimitToastShown = false;
  }, 30000);
};

// Generic fetch wrapper with authentication and retry logic
export const fetchWithAuth = async (
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = getAuthHeaders();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // If unauthorized, redirect to login (não fazer retry)
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    // Tratar rate limit (429) - mostrar mensagem e NÃO fazer retry automático
    if (response.status === 429) {
      try {
        const data = await response.clone().json();
        showRateLimitNotification(data.retryAfter);
      } catch {
        showRateLimitNotification();
      }
      // Retornar a response para que o código chamador possa tratar também
      return response;
    }

    // Se o erro é retryable e ainda temos tentativas
    if (!response.ok && isRetryableError(response.status) && retryCount < RETRY_CONFIG.maxRetries) {
      // Retry silencioso - logs apenas em desenvolvimento via DevTools
      await delay(RETRY_CONFIG.retryDelay, retryCount + 1);
      return fetchWithAuth(endpoint, options, retryCount + 1);
    }

    return response;
  } catch (error) {
    // Erro de rede (sem conexão, timeout, etc)
    if (error instanceof TypeError && retryCount < RETRY_CONFIG.maxRetries) {
      // Retry silencioso - logs apenas em desenvolvimento via DevTools
      await delay(RETRY_CONFIG.retryDelay, retryCount + 1);
      return fetchWithAuth(endpoint, options, retryCount + 1);
    }

    throw error;
  }
};

// Convenience methods
export const api = {
  get: async (endpoint: string) => {
    return fetchWithAuth(endpoint, { method: 'GET' });
  },

  post: async <T = unknown>(endpoint: string, data?: T) => {
    return fetchWithAuth(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put: async <T = unknown>(endpoint: string, data?: T) => {
    return fetchWithAuth(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async <T = unknown>(endpoint: string, data?: T) => {
    return fetchWithAuth(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
};
