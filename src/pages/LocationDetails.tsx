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
import { BotaoAtualizar, CabecalhoDaPagina, classeDoCartao } from '@/components/painel/Pagina';
import { classeDoBotaoContorno, classeDoBotaoPerigo } from '@/components/painel/Pecas';
import { cn } from '@/components/ui/utils';
import { AbasDoLocal } from '@/components/locais/AbasDoLocal';
import { ConfirmarExclusaoDoLocal } from '@/components/locais/ConfirmarExclusaoDoLocal';

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
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // NFS-e e certificado digital: admin ou operador da marca (a API aplica a mesma regra).
  const podeGerirLocal = user?.role === 'admin' || user?.role === 'operador';

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
      setAtualizadoEm(new Date());
      setFalhou(false);

      // Se não tem permissão para ver info, seleciona a primeira aba disponível
      if (!permData.info) {
        const firstAvailable = tabs.find(tab => permData[tab.permissionKey]);
        if (firstAvailable) {
          setActiveTab(firstAvailable.id);
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar local:', error);
      setFalhou(true);
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

  // A hora da última atualização fica embaixo do botão (BotaoAtualizar); a
  // falha aparece ali e no aviso de erro, sem o "Dados atualizados" de antes,
  // que saía mesmo quando a busca falhava.
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  // Abre a confirmação, que diz a consequência e faz o pedido à API.
  const handleDeleteLocation = () => {
    if (!location || !id) return;
    setConfirmandoExclusao(true);
  };

  // Filtrar abas baseado nas permissões
  const visibleTabs = permissions
    ? tabs.filter(
        tab =>
          permissions[tab.permissionKey] &&
          (podeGerirLocal || (tab.id !== 'nfse' && tab.id !== 'certificado'))
      )
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
        <Card className={cn(classeDoCartao, 'border-0 p-8')}>
          <CardContent className="text-center p-0">
            <Building2 className="w-12 h-12 text-primary-strong mx-auto mb-4" />
            <h2 className="text-[20px] font-semibold text-foreground mb-2">Local não encontrado</h2>
            <p className="text-[15px] text-muted-foreground mb-4">O local solicitado não existe ou foi removido.</p>
            <Button onClick={() => navigate('/locais')} variant="outline" className={classeDoBotaoContorno}>
              <ArrowLeft className="w-4 h-4" />
              Voltar para Locais
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className={cn(classeDoCartao, 'border-0 p-8')}>
          <CardContent className="text-center p-0">
            <Users className="w-12 h-12 text-estado-problema-forte mx-auto mb-4" />
            <h2 className="text-[20px] font-semibold text-foreground mb-2">Acesso restrito</h2>
            <p className="text-[15px] text-muted-foreground mb-4">Você não tem permissão para visualizar este local.</p>
            <Button onClick={() => navigate('/locais')} variant="outline" className={classeDoBotaoContorno}>
              <ArrowLeft className="w-4 h-4" />
              Voltar para Locais
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-[25px] pb-12">
      {/* Cabeçalho do redesenho, com a volta para Locais em cima do título */}
      <button
        type="button"
        onClick={() => navigate('/locais')}
        className="inline-flex items-center gap-2 -mb-1 text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Voltar para Locais
      </button>
      <CabecalhoDaPagina
        titulo={location.nomeDoLocal || 'Local sem nome'}
        subtitulo={
          <span className="inline-flex items-start gap-1.5">
            <MapPin className="w-4 h-4 mt-0.5 text-primary-strong shrink-0" aria-hidden="true" />
            {[
              [location.endereco, location.numero].filter(Boolean).join(', '),
              [location.cidade, location.estado].filter(Boolean).join('/'),
            ]
              .filter(Boolean)
              .join(' - ')}
          </span>
        }
        acoes={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 3xl:gap-8">
            {/* Ação destrutiva separada e em vermelho; a confirmação diz a consequência */}
            {isAdmin && (
              <button type="button" onClick={handleDeleteLocation} className={cn(classeDoBotaoPerigo, 'h-12 px-6')}>
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Excluir local
              </button>
            )}
            <BotaoAtualizar
              aoAtualizar={() => void handleRefresh()}
              carregando={isRefreshing}
              atualizadoEm={atualizadoEm}
              falhou={falhou && !!atualizadoEm}
            />
          </div>
        }
      />

      <AbasDoLocal
        rotulo="Seções do local"
        ativa={activeTab}
        aoMudar={setActiveTab}
        abas={visibleTabs.map(tab => {
          const Icon = tab.icon;
          return { id: tab.id, rotulo: tab.label, icone: <Icon className="w-5 h-5" aria-hidden="true" /> };
        })}
      />

      <ConfirmarExclusaoDoLocal
        local={confirmandoExclusao ? location : null}
        carregadores={location.chargePoints ? location.chargePoints.length : null}
        aoFechar={() => setConfirmandoExclusao(false)}
        aoExcluir={() => navigate('/locais')}
      />

      {/* Tab Content */}
      {/* Cartões das abas no estilo novo (cantos de 15 px; os de fora sem borda e
          com a sombra do painel), sem mexer em cada aba */}
      <div className="min-h-[500px] [&_[data-slot=card]]:rounded-[15px] [&_[data-slot=card]:not([data-slot=card]_*)]:border-transparent [&_[data-slot=card]:not([data-slot=card]_*)]:shadow-cartao">
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
        {activeTab === 'nfse' && podeGerirLocal && (
          <LocationNfseTab locationId={parseInt(id!)} />
        )}
        {activeTab === 'certificado' && podeGerirLocal && (
          <LocationCertificadoTab locationId={parseInt(id!)} />
        )}
      </div>
    </div>
  );
}

export default LocationDetails;
