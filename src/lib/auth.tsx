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
import { User, UserRole } from '../types';

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
  return 'comum';
};

const applyThemeForRole = (role?: UserRole | null) => {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('theme-atem', 'theme-default');
  if (role === 'atem') {
    document.body.classList.add('theme-atem');
  } else {
    document.body.classList.add('theme-default');
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
    localStorage.removeItem('userRole');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem('userData');
    setUser(null);
    applyThemeForRole(null);
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
        localStorage.removeItem('userRole');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        sessionStorage.removeItem('userData');
        applyThemeForRole(null);
        return;
      }
    }

    // Tentar recuperar dados do sessionStorage (mais seguro que localStorage)
    const sessionData = sessionStorage.getItem('userData');

    if (token && sessionData) {
      try {
        const userData = JSON.parse(sessionData);
        setUser({
          id: userData.id || '1',
          name: userData.name || 'User',
          email: userData.email,
          role: storedRole,
        });
        // Atualizar timestamp de atividade ao restaurar sessão
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      } catch {
        // Se falhar ao parsear, fazer logout
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        sessionStorage.removeItem('userData');
        applyThemeForRole(null);
      }
    } else {
      applyThemeForRole(null);
    }
  }, []);

  useEffect(() => {
    applyThemeForRole(user?.role);
  }, [user?.role]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Compatível com base_ocpp: endpoint /auth/login e campo username
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: email, password }),
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login.');
      }

      // SECURITY: Token em localStorage, dados sensíveis em sessionStorage
      localStorage.setItem('token', data.token);
      const normalizedRole = normalizeRole(data.user.role);
      localStorage.setItem('userRole', normalizedRole);

      // Armazenar dados do usuário no sessionStorage (limpo ao fechar navegador)
      sessionStorage.setItem(
        'userData',
        JSON.stringify({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
        })
      );

      setUser({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: normalizedRole,
      });

      // Inicializar timestamp de atividade para o timeout de sessão
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

      return true;
    } catch (err) {
      // Use logger ao invés de console.error
      if (process.env.NODE_ENV === 'development') {
        console.error('Login error:', err);
      }
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem('userData');
    setUser(null);
    applyThemeForRole(null);
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      // Compatível com base_ocpp: endpoint /web-users e campos username/email
      const response = await fetch(`${API_BASE_URL}/web-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: name, email, password, role: 'VIEWER' }),
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao registrar.');
      }

      // SECURITY: Token em localStorage, dados sensíveis em sessionStorage
      localStorage.setItem('token', data.token);
      const normalizedRole = normalizeRole(data.user.role);
      localStorage.setItem('userRole', normalizedRole);

      // Armazenar dados do usuário no sessionStorage
      sessionStorage.setItem(
        'userData',
        JSON.stringify({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
        })
      );

      setUser({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: normalizedRole,
      });

      // Inicializar timestamp de atividade para o timeout de sessão
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

      return true;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration error:', err);
      }
      return false;
    }
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
      localStorage.setItem('userRole', role);
      applyThemeForRole(role);
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
