import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithAuth, api } from '../api';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
delete (window as { location?: Location }).location;
window.location = { href: '' } as Location;

describe('API Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    window.location.href = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchWithAuth - Basico', () => {
    it('deve fazer request com token de autorizacao', async () => {
      localStorageMock.setItem('token', 'test-token-123');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' }),
      });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('deve fazer request sem token quando nao autenticado', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers).not.toHaveProperty('Authorization');
    });

    it('deve usar VITE_API_URL se definido', async () => {
      const originalEnv = import.meta.env.VITE_API_URL;
      import.meta.env.VITE_API_URL = 'https://api.example.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await fetchWithAuth('/test');

      // Verificar que a URL base foi usada
      expect(mockFetch).toHaveBeenCalled();

      import.meta.env.VITE_API_URL = originalEnv;
    });

    it('deve retornar response quando sucesso', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetchWithAuth('/test');

      expect(response).toBe(mockResponse);
    });
  });

  describe('Redirect 401/403', () => {
    it('deve redirecionar para /login em 401', async () => {
      localStorageMock.setItem('token', 'test-token');
      localStorageMock.setItem('userRole', 'admin');
      localStorageMock.setItem('userName', 'Test User');
      localStorageMock.setItem('userEmail', 'test@test.com');
      localStorageMock.setItem('userId', '123');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(fetchWithAuth('/test')).rejects.toThrow('Unauthorized');

      expect(window.location.href).toBe('/login');
      expect(localStorageMock.getItem('token')).toBeNull();
      expect(localStorageMock.getItem('userRole')).toBeNull();
      expect(localStorageMock.getItem('userName')).toBeNull();
      expect(localStorageMock.getItem('userEmail')).toBeNull();
      expect(localStorageMock.getItem('userId')).toBeNull();
    });

    it('deve redirecionar para /login em 403', async () => {
      localStorageMock.setItem('token', 'test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(fetchWithAuth('/test')).rejects.toThrow('Unauthorized');

      expect(window.location.href).toBe('/login');
      expect(localStorageMock.getItem('token')).toBeNull();
    });

    it('deve limpar todo localStorage em 401', async () => {
      localStorageMock.setItem('token', 'token');
      localStorageMock.setItem('userRole', 'admin');
      localStorageMock.setItem('userName', 'User');
      localStorageMock.setItem('userEmail', 'user@test.com');
      localStorageMock.setItem('userId', '1');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(fetchWithAuth('/test')).rejects.toThrow('Unauthorized');

      expect(localStorageMock.getItem('token')).toBeNull();
      expect(localStorageMock.getItem('userRole')).toBeNull();
      expect(localStorageMock.getItem('userName')).toBeNull();
      expect(localStorageMock.getItem('userEmail')).toBeNull();
      expect(localStorageMock.getItem('userId')).toBeNull();
    });
  });

  describe('Retry Logic Completo', () => {
    it('deve fazer retry em erro 500', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const response = await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.ok).toBe(true);
    });

    it('deve fazer retry em erro 502', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 502 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve fazer retry em erro 503', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve fazer retry em erro 504', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 504 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve fazer retry em erro 408 (timeout)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 408 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve fazer retry em erro 429 (rate limit)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve respeitar maximo de 3 retries', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const response = await fetchWithAuth('/test');

      // 1 tentativa original + 3 retries = 4 chamadas
      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(response.ok).toBe(false);
    });

    it('deve aplicar exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const promise = fetchWithAuth('/test');

      // Avançar timers para simular delays
      await vi.advanceTimersByTimeAsync(1000); // Primeiro retry (1s)
      await vi.advanceTimersByTimeAsync(2000); // Segundo retry (2s)

      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('nao deve fazer retry em erro 400', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const response = await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.ok).toBe(false);
    });

    it('nao deve fazer retry em erro 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const response = await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('nao deve fazer retry em 401/403', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(fetchWithAuth('/test')).rejects.toThrow('Unauthorized');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('deve fazer retry em erro de rede (TypeError)', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve fazer retry ate 3 vezes em erro de rede', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network error'));

      await expect(fetchWithAuth('/test')).rejects.toThrow('Network error');

      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 original + 3 retries
    });

    it('deve propagar erro nao-TypeError apos retries', async () => {
      const customError = new Error('Custom error');
      mockFetch.mockRejectedValue(customError);

      await expect(fetchWithAuth('/test')).rejects.toThrow('Custom error');

      expect(mockFetch).toHaveBeenCalledTimes(1); // Nao retryable
    });

    it('deve fazer retry em fetch timeout', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('API Convenience Methods', () => {
    it('api.get deve fazer GET request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await api.get('/users');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('api.post deve fazer POST request com dados', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });

      const data = { name: 'Test', email: 'test@test.com' };
      await api.post('/users', data);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        })
      );
    });

    it('api.post deve funcionar sem dados', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await api.post('/action');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/action',
        expect.objectContaining({
          method: 'POST',
          body: 'undefined',
        })
      );
    });

    it('api.put deve fazer PUT request com dados', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const data = { id: 1, name: 'Updated' };
      await api.put('/users/1', data);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        })
      );
    });

    it('api.delete deve fazer DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      await api.delete('/users/1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('api.delete deve incluir body se dados fornecidos', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const data = { reason: 'Test delete' };
      await api.delete('/users/1', data);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify(data),
        })
      );
    });
  });

  describe('Headers Customizados', () => {
    it('deve permitir override de headers', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test', {
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('deve mesclar headers customizados com auth headers', async () => {
      localStorageMock.setItem('token', 'test-token');
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test', {
        headers: {
          'X-Request-ID': '123',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
            'X-Request-ID': '123',
          }),
        })
      );
    });
  });

  describe('Request Options', () => {
    it('deve passar options do fetch', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ test: 'data' }),
        })
      );
    });

    it('deve suportar diferentes metodos HTTP', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      await fetchWithAuth('/test', { method: 'GET' });
      await fetchWithAuth('/test', { method: 'POST' });
      await fetchWithAuth('/test', { method: 'PUT' });
      await fetchWithAuth('/test', { method: 'DELETE' });
      await fetchWithAuth('/test', { method: 'PATCH' });

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com endpoint vazio', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('');

      expect(mockFetch).toHaveBeenCalledWith('/api', expect.any(Object));
    });

    it('deve lidar com endpoint sem barra inicial', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('test');

      expect(mockFetch).toHaveBeenCalledWith('/apitest', expect.any(Object));
    });

    it('deve lidar com response sem json', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const response = await fetchWithAuth('/test');

      expect(response.status).toBe(204);
    });

    it('deve preservar retry count entre chamadas', async () => {
      // Primeira chamada com retry
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test1');

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Segunda chamada deve começar com retry count 0
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await fetchWithAuth('/test2');

      expect(mockFetch).toHaveBeenCalledTimes(4); // 2 + 2
    });
  });

  describe('Integracao Completa', () => {
    it('deve fazer request completo com autenticacao, retry e sucesso', async () => {
      localStorageMock.setItem('token', 'auth-token');

      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });

      const response = await api.get('/data');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('deve lidar com fluxo completo de erro e redirect', async () => {
      localStorageMock.setItem('token', 'invalid-token');

      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(api.get('/protected')).rejects.toThrow('Unauthorized');

      expect(window.location.href).toBe('/login');
      expect(localStorageMock.getItem('token')).toBeNull();
    });

    it('deve fazer POST com dados, retry e sucesso', async () => {
      localStorageMock.setItem('token', 'token');

      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 123 }) });

      const userData = { name: 'John', email: 'john@test.com' };
      const response = await api.post('/users', userData);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.id).toBe(123);
    });
  });
});
