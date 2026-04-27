import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import {
  ArrowLeft,
  MapPin,
  Activity,
  DollarSign,
  Monitor,
  Info,
  Users,
  RefreshCw,
  Building2,
  Trash2,
  FileKey,
  Receipt
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Lazy load dos componentes de aba
import { LocationInfoTab } from '@/components/location-details/LocationInfoTab';
import { LocationTransactionsTab } from '@/components/location-details/LocationTransactionsTab';
import { LocationPerformanceTab } from '@/components/location-details/LocationPerformanceTab';
import { LocationFinancialTab } from '@/components/location-details/LocationFinancialTab';
import { LocationMonitoringTab } from '@/components/location-details/LocationMonitoringTab';
import { LocationPermissionsTab } from '@/components/location-details/LocationPermissionsTab';
import { LocationCertificadoTab } from '@/components/location-details/LocationCertificadoTab';
import { LocationNfseTab } from '@/components/location-details/LocationNfseTab';

interface LocationData {
  id: number;
  nomeDoLocal: string;
  endereco: string;
  numero: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: number;
  longitude: number;
  razaoSocial: string;
  cnpj: string;
  tipoDeNegocio: string;
  tipoDeLocal: string;
  horarioFuncionamento: any;
  nomeResponsavel: string;
  emailResponsavel: string;
  telefoneResponsavel: string;
  chargePoints?: any[];
}

interface UserPermissions {
  transactions: boolean;
  performance: boolean;
  financial: boolean;
  monitoring: boolean;
  info: boolean;
  permissions: boolean;
  certificado: boolean;
  nfse: boolean;
}

type TabId = 'info' | 'transactions' | 'performance' | 'financial' | 'monitoring' | 'permissions' | 'certificado' | 'nfse';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  permissionKey: keyof UserPermissions;
}

const tabs: Tab[] = [
  { id: 'info', label: 'Informações', icon: Info, permissionKey: 'info' },
  { id: 'transactions', label: 'Transações', icon: Activity, permissionKey: 'transactions' },
  { id: 'performance', label: 'Performance', icon: Monitor, permissionKey: 'performance' },
  { id: 'financial', label: 'Financeiro', icon: DollarSign, permissionKey: 'financial' },
  { id: 'monitoring', label: 'Monitoramento', icon: MapPin, permissionKey: 'monitoring' },
  { id: 'permissions', label: 'Permissões', icon: Users, permissionKey: 'permissions' },
  { id: 'nfse', label: 'NFS-e', icon: Receipt, permissionKey: 'info' }, // Usa permissão de 'info' ou admin
  { id: 'certificado', label: 'Certificado Digital', icon: FileKey, permissionKey: 'info' }, // Usa permissão de 'info' ou admin
];

export function LocationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [location, setLocation] = useState<LocationData | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      // Buscar dados do local e permissões em paralelo
      const [locationRes, permissionsRes] = await Promise.all([
        api.get(`/locations/${id}`),
        api.get(`/locations/${id}/my-permissions`)
      ]);

      if (!locationRes.ok || !permissionsRes.ok) {
        throw { status: !locationRes.ok ? locationRes.status : permissionsRes.status };
      }

      const locData = await locationRes.json();
      const permData = await permissionsRes.json();

      setLocation(locData.location);
      setPermissions(permData);

      // Se não tem permissão para ver info, seleciona a primeira aba disponível
      if (!permData.info) {
        const firstAvailable = tabs.find(tab => permData[tab.permissionKey]);
        if (firstAvailable) {
          setActiveTab(firstAvailable.id);
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar local:', error);
      toast.error('Erro ao carregar dados do local');
      if (error.status === 404) {
        navigate('/locais');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    toast.success('Dados atualizados');
  };

  const handleDeleteLocation = async () => {
    if (!location || !id) return;
    
    if (!window.confirm(`Tem certeza que deseja excluir o local "${location.nomeDoLocal}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const res = await api.delete(`/locations/${id}`);
      if (res.ok) {
        toast.success('Local excluído com sucesso!');
        navigate('/locais');
      } else {
        const error = await res.json();
        toast.error(error.message || 'Erro ao excluir local');
      }
    } catch (err) {
      toast.error('Erro ao conectar com o servidor');
    }
  };

  // Filtrar abas baseado nas permissões
  const visibleTabs = permissions
    ? tabs.filter(tab => permissions[tab.permissionKey])
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Carregando local...</p>
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="bg-card border-border p-8">
          <div className="text-center">
            <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Local não encontrado</h2>
            <p className="text-muted-foreground mb-4">O local solicitado não existe ou foi removido.</p>
            <Button onClick={() => navigate('/locais')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Locais
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="bg-card border-border p-8">
          <div className="text-center">
            <Users className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">Você não tem permissão para visualizar este local.</p>
            <Button onClick={() => navigate('/locais')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Locais
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/locais')}
            className="text-foreground/70 hover:text-foreground hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {location.nomeDoLocal || 'Local sem nome'}
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {location.endereco}, {location.numero} - {location.cidade}/{location.estado}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="border-border text-foreground/70 hover:bg-accent"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
        {isAdmin && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteLocation}
            className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir Local
          </Button>
        )}
      </div>

      {/* Tabs Navigation */}
      <Card className="bg-card border-border">
        <CardContent className="p-2">
          <div className="flex flex-wrap gap-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all
                    ${isActive
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'info' && permissions?.info && (
          <LocationInfoTab location={location} onUpdate={fetchData} />
        )}
        {activeTab === 'transactions' && permissions?.transactions && (
          <LocationTransactionsTab locationId={parseInt(id!)} />
        )}
        {activeTab === 'performance' && permissions?.performance && (
          <LocationPerformanceTab 
            locationId={parseInt(id!)} 
            locationName={location.nomeDoLocal} 
          />
        )}
        {activeTab === 'financial' && permissions?.financial && (
          <LocationFinancialTab locationId={parseInt(id!)} />
        )}
        {activeTab === 'monitoring' && permissions?.monitoring && (
          <LocationMonitoringTab locationId={parseInt(id!)} />
        )}
        {activeTab === 'permissions' && permissions?.permissions && (
          <LocationPermissionsTab locationId={parseInt(id!)} />
        )}
        {activeTab === 'nfse' && isAdmin && (
          <LocationNfseTab locationId={parseInt(id!)} />
        )}
        {activeTab === 'certificado' && isAdmin && (
          <LocationCertificadoTab locationId={parseInt(id!)} />
        )}
      </div>
    </div>
  );
}

export default LocationDetails;
