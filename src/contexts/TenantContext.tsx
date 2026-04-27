import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../lib/auth';

interface TenantContextData {
  tenantSlug: string;
  tenantBranding: any | null;
  loadingTenant: boolean;
  isDark: boolean;
  toggleTheme: () => void;
}

const TenantContext = createContext<TenantContextData>({
  tenantSlug: 'neopower',
  tenantBranding: null,
  loadingTenant: true,
  isDark: true,
  toggleTheme: () => {},
});

export const useTenant = () => useContext(TenantContext);

interface TenantProviderProps {
  children: React.ReactNode;
}

const APP_ROUTES = [
  'login', 'estacoes', 'locais', 'transacoes', 'indicadores', 
  'operacoes', 'relatorio-financeiro', 'usuarios', 'vouchers', 
  'tarifas', 'carteiras', 'notificacoes', 'email', 'branding', 
  'sustentabilidade', 'alarmes', 'agendamentos', 'metas'
];

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [tenantSlug, setTenantSlug] = useState<string>('neopower');
  const [tenantBranding, setTenantBranding] = useState<any | null>(null);
  const [loadingTenant, setLoadingTenant] = useState<boolean>(true);

  // O branding do usuário logado (se houver) sobrescreve o branding do tenant base
  const activeBranding = user?.branding || tenantBranding;
  const { isDark, toggle: toggleTheme } = useAppTheme(activeBranding);

  useEffect(() => {
    const initializeTenant = async () => {
      try {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const potentialTenant = pathParts[0];

        if (!potentialTenant || APP_ROUTES.includes(potentialTenant)) {
          const originalPath = window.location.pathname;
          window.location.replace(`/neopower${originalPath === '/' ? '/login' : originalPath}`);
          return;
        }

        const slug = potentialTenant.toLowerCase();

        // Mapa URL-slug → backend clientId. A URL pública /neopower/... é
        // reconhecível pro usuário, mas o whitelabel real no banco é 'neo'.
        const SLUG_ALIASES: Record<string, string> = {
          neopower: 'neo',
        };
        const backendSlug = SLUG_ALIASES[slug] ?? slug;

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/branding/${backendSlug}`);

        if (response.ok) {
          const result = await response.json();
          setTenantBranding(result.data);
          setTenantSlug(slug);
        } else {
          if (slug !== 'neopower') {
            window.location.replace(`/neopower/login`);
            return;
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar Tenant:', error);
      } finally {
        setLoadingTenant(false);
      }
    };

    initializeTenant();
  }, []);

  if (loadingTenant) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ tenantSlug, tenantBranding, loadingTenant, isDark, toggleTheme }}>
      {children}
    </TenantContext.Provider>
  );
};
