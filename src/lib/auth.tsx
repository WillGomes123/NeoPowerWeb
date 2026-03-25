import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { toast } from 'sonner';
import { User, UserRole, BrandingConfig } from '../types';

// Session timeout em milissegundos (30 minutos)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Verificar a cada 1 minuto
const LAST_ACTIVITY_KEY = 'lastActivity';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  switchRole: (role: UserRole) => void;
  refreshActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env?.VITE_API_URL ?? '/api';

const normalizeRole = (role?: string | null): UserRole => {
  if (role === 'admin' || role === 'atem' || role === 'comum') return role;
  if (role === 'user') return 'comum';
  // Map base_ocpp roles to NeoRBAC roles
  if (role === 'ADMIN') return 'admin';
  if (role === 'OPERATOR') return 'atem';
  if (role === 'VIEWER') return 'comum';
  return 'comum';
};

const applyThemeAndBranding = (role?: UserRole | null, branding?: BrandingConfig | null) => {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('theme-atem', 'theme-default');
  if (role === 'atem') {
    document.body.classList.add('theme-atem');
  } else {
    document.body.classList.add('theme-default');
  }

  // Inject dynamic primary color CSS override if branding is available
  const existingStyle = document.getElementById('dynamic-branding-style');
  if (existingStyle) existingStyle.remove();

  if (branding?.primaryColor) {
    const style = document.createElement('style');
    style.id = 'dynamic-branding-style';
    // Derive lighter/darker variants from the primary color
    const hex = branding.primaryColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const dimR = Math.max(0, Math.floor(r * 0.7));
    const dimG = Math.max(0, Math.floor(g * 0.7));
    const dimB = Math.max(0, Math.floor(b * 0.7));
    const containerHex = `#${dimR.toString(16).padStart(2,'0')}${dimG.toString(16).padStart(2,'0')}${dimB.toString(16).padStart(2,'0')}`;

    style.innerHTML = `
      :root {
        --color-primary: ${branding.primaryColor} !important;
        --color-primary-dim: ${containerHex} !important;
        --color-primary-container: ${branding.primaryColor} !important;
        --color-primary-fixed: ${branding.primaryColor} !important;
        --color-primary-fixed-dim: ${containerHex} !important;
        --color-surface-tint: ${branding.primaryColor} !important;
        --color-ring: ${branding.primaryColor} !important;
        --color-sidebar-primary: ${branding.primaryColor} !important;
        --color-sidebar-ring: ${branding.primaryColor} !important;
        --color-chart-1: ${branding.primaryColor} !important;
      }
    `;
    document.head.appendChild(style);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const activityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Atualizar timestamp da última atividade
  const refreshActivity = useCallback(() => {
    if (user) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }
  }, [user]);

  // Verificar se a sessão expirou
  const checkSessionTimeout = useCallback(() => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return false;

    const lastActivityTime = parseInt(lastActivity, 10);
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;

    return timeSinceLastActivity > SESSION_TIMEOUT_MS;
  }, []);

  // Logout por inatividade
  const handleInactivityLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem('userData');
    setUser(null);
    applyThemeAndBranding(null, null);
    // Redirecionar para login com mensagem
    if (typeof window !== 'undefined') {
      window.location.href = '/login?expired=true';
    }
  }, []);

  // Monitorar atividade do usuário
  useEffect(() => {
    if (!user) return;

    // Atualizar atividade inicial
    refreshActivity();

    // Eventos que indicam atividade do usuário
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleUserActivity = () => {
      refreshActivity();
    };

    // Adicionar listeners de atividade
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Verificar timeout periodicamente
    activityCheckIntervalRef.current = setInterval(() => {
      if (checkSessionTimeout()) {
        handleInactivityLogout();
      }
    }, ACTIVITY_CHECK_INTERVAL_MS);

    return () => {
      // Cleanup listeners
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      // Cleanup interval
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
    };
  }, [user, refreshActivity, checkSessionTimeout, handleInactivityLogout]);

  // Check if user is logged in on mount
  // SECURITY: Apenas o token fica em localStorage, dados sensíveis ficam apenas em memória
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedRole = normalizeRole(localStorage.getItem('userRole'));

    // Verificar se a sessão expirou antes de restaurar
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity, 10);
      const now = Date.now();
      if (now - lastActivityTime > SESSION_TIMEOUT_MS) {
        // Sessão expirada, limpar dados
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        sessionStorage.removeItem('userData');
        applyThemeAndBranding(null, null);
        return;
      }
    }

    // Tentar recuperar dados do sessionStorage (mais seguro que localStorage)
    const sessionData = sessionStorage.getItem('userData');

    if (token && sessionData) {
      try {
        const userData = JSON.parse(sessionData);
        if (!userData.id || !userData.email) {
          throw new Error('Dados de sessão incompletos');
        }
        setUser({
          id: userData.id,
          name: userData.name || 'User',
          email: userData.email,
          role: storedRole,
          branding: userData.branding || null,
        });
        // Atualizar timestamp de atividade ao restaurar sessão
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      } catch {
        // Se falhar ao parsear, fazer logout
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        sessionStorage.removeItem('userData');
        applyThemeAndBranding(null, null);
      }
    } else {
      applyThemeAndBranding(null, null);
    }
  }, []);

  useEffect(() => {
    applyThemeAndBranding(user?.role, user?.branding);
  }, [user?.role, user?.branding]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // OCPP_API: endpoint /users/login com campos email e password
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      // Tratar rate limit (429)
      if (response.status === 429) {
        let retryAfter = 15; // default 15 minutos
        try {
          const errorData = await response.json();
          if (errorData.retryAfter) {
            retryAfter = Math.ceil(errorData.retryAfter / 60);
          }
        } catch {
          // ignore parse error
        }
        toast.error('Muitas tentativas de login', {
          description: `Aguarde ${retryAfter} minuto(s) antes de tentar novamente. Se você está tentando acessar de múltiplos dispositivos, aguarde um momento.`,
          duration: 10000,
        });
        return false;
      }

      const responseData = await response.json();

      if (!response.ok || responseData.success === false) {
        const errorMsg = responseData.message || responseData.error || 'Email ou senha incorretos.';
        toast.error('Erro ao fazer login', { description: errorMsg });
        return false;
      }

      const payload = responseData.data || responseData;

      // SECURITY: Token em localStorage, dados sensíveis em sessionStorage
      localStorage.setItem('token', payload.token);
      if (payload.refreshToken) {
        localStorage.setItem('refreshToken', payload.refreshToken);
      }
      const normalizedRole = normalizeRole(payload.user.role);
      localStorage.setItem('userRole', normalizedRole);

      // Map base_ocpp user fields to NeoRBAC format
      // base_ocpp: { id, username, role, email, enabled }
      // NeoRBAC: { id, name, email, role }
      const userName = payload.user.name || payload.user.username || 'User';
      const userEmail = payload.user.email || email;

      // Armazenar dados do usuário no sessionStorage (limpo ao fechar navegador)
      sessionStorage.setItem(
        'userData',
        JSON.stringify({
          id: payload.user.id,
          name: userName,
          email: userEmail,
          branding: payload.user.branding || null,
        })
      );

      setUser({
        id: payload.user.id,
        name: userName,
        email: userEmail,
        role: normalizedRole,
        branding: payload.user.branding || null,
      });

      // Inicializar timestamp de atividade para o timeout de sessão
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro de conexão com o servidor.';
      toast.error('Erro ao fazer login', { description: errorMsg });
      if (import.meta.env.DEV) {
        console.error('Login error:', err);
      }
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem('userData');
    setUser(null);
    applyThemeAndBranding(null, null);
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      // OCPP_API: endpoint /users/register com campos name, email e password
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      // Tratar rate limit (429)
      if (response.status === 429) {
        let retryAfter = 15;
        try {
          const errorData = await response.json();
          if (errorData.retryAfter) {
            retryAfter = Math.ceil(errorData.retryAfter / 60);
          }
        } catch {
          // ignore parse error
        }
        toast.error('Muitas tentativas', {
          description: `Aguarde ${retryAfter} minuto(s) antes de tentar novamente.`,
          duration: 10000,
        });
        return false;
      }

      const responseData = await response.json();

      if (!response.ok || responseData.success === false) {
        const errorMsg = responseData.message || responseData.error || 'Erro ao registrar.';
        toast.error('Erro ao registrar', { description: errorMsg });
        return false;
      }

      const payload = responseData.data || responseData;

      // SECURITY: Token em localStorage, dados sensíveis em sessionStorage
      localStorage.setItem('token', payload.token);
      if (payload.refreshToken) {
        localStorage.setItem('refreshToken', payload.refreshToken);
      }
      const normalizedRole = normalizeRole(payload.user.role);
      localStorage.setItem('userRole', normalizedRole);

      // Armazenar dados do usuário no sessionStorage
      sessionStorage.setItem(
        'userData',
        JSON.stringify({
          id: payload.user.id,
          name: payload.user.name,
          email: payload.user.email,
          branding: payload.user.branding || null,
        })
      );

      setUser({
        id: payload.user.id,
        name: payload.user.name,
        email: payload.user.email,
        role: normalizedRole,
        branding: payload.user.branding || null,
      });

      // Inicializar timestamp de atividade para o timeout de sessão
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro de conexão com o servidor.';
      toast.error('Erro ao registrar', { description: errorMsg });
      if (import.meta.env.DEV) {
        console.error('Registration error:', err);
      }
      return false;
    }
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
      localStorage.setItem('userRole', role);
      applyThemeAndBranding(role, user.branding);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, switchRole, refreshActivity }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
