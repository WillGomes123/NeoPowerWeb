import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MapPin, Building, Clock, Palette, User, Save, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { DynamicMap, TileLayer, Marker, useMap, L } from './DynamicMap';

// Inicializar Leaflet icons
if (typeof window !== 'undefined' && L) {
  try {
    delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  } catch {
    // Silenciar erros de inicialização
  }
}

interface AddLocationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface LocationFormData {
  name: string;
  cep: string;
  address: string;
  numero: string;
  complemento: string;
  cidade: string;
  estado: string;
  pais: string;
  latitude: number;
  longitude: number;
  razao_social: string;
  cnpj: string;
  tipo_negocio: string;
  tipo_local: string;
  tipo_estacionamento: string;
  horario_funcionamento: {
    [key: string]: {
      tipo: string;
      abre_as: string;
      fecha_as: string;
    };
  };
  observacoes: string;
  logo_url: string;
  cor_fundo: string;
  imagem_local_url: string;
  nome_responsavel: string;
  cpf_responsavel: string;
  email_responsavel: string;
  telefone_responsavel: string;
}

const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const diasSemanaLabels: { [key: string]: string } = {
  domingo: 'Domingo',
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
};

// Componente para mover o mapa
const ChangeMapView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, 16);
  }, [center, map]);
  return null;
};

// Ícone padrão do Leaflet
const getDefaultIcon = () => {
  if (!L) return null;
  return L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
  });
};

export function AddLocationForm({ onSuccess, onCancel }: AddLocationFormProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-14.235, -51.925]);
  const [pinPosition, setPinPosition] = useState<[number, number] | null>(null);

  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    cep: '',
    address: '',
    numero: '',
    complemento: '',
    cidade: '',
    estado: '',
    pais: 'Brasil',
    latitude: -23.5505,
    longitude: -46.6333,
    razao_social: '',
    cnpj: '',
    tipo_negocio: 'comercial',
    tipo_local: 'publico',
    tipo_estacionamento: 'gratis',
    horario_funcionamento: {},
    observacoes: '',
    logo_url: '',
    cor_fundo: '#10b981',
    imagem_local_url: '',
    nome_responsavel: '',
    cpf_responsavel: '',
    email_responsavel: '',
    telefone_responsavel: '',
  });

  // Inicializar horários
  React.useEffect(() => {
    const defaultHorarios: LocationFormData['horario_funcionamento'] = {};
    diasSemana.forEach(dia => {
      defaultHorarios[dia] = {
        tipo: '24horas',
        abre_as: '00:00',
        fecha_as: '23:59',
      };
    });
    setFormData(prev => ({ ...prev, horario_funcionamento: defaultHorarios }));
  }, []);

  // Auto-preenchimento por CEP
  const handleCepBlur = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setFormData(prev => ({
        ...prev,
        address: data.logradouro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
        complemento: data.complemento || prev.complemento,
      }));

      toast.success('Endereço preenchido automaticamente!');

      if (data.logradouro && data.localidade && data.uf) {
        await geocodeAddress(data.logradouro, '', data.localidade, data.uf);
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast.error('Erro ao buscar CEP');
    } finally {
      setLoadingCep(false);
    }
  };

  // Geocodificação
  const geocodeAddress = async (endereco: string, numero: string, cidade: string, estado: string) => {
    const query = `${endereco}, ${numero}, ${cidade}, ${estado}, Brasil`;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const coords: [number, number] = [parseFloat(lat), parseFloat(lon)];

        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
        }));

        setMapCenter(coords);
        setPinPosition(coords);
        toast.success('Localização encontrada no mapa!');
      } else {
        toast.warning('Endereço não encontrado no mapa');
      }
    } catch (error) {
      console.error('Erro de geocodificação:', error);
      toast.error('Erro ao buscar localização no mapa');
    }
  };

  const handleNumeroBlur = () => {
    const { address, numero, cidade, estado } = formData;
    if (address && numero && cidade && estado) {
      void geocodeAddress(address, numero, cidade, estado);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.cep || !formData.address) {
      toast.error('Preencha todos os campos obrigatórios da Aba 1');
      setActiveTab('info');
      return;
    }

    if (!formData.razao_social || !formData.cnpj) {
      toast.error('Preencha todos os campos obrigatórios da Aba 2');
      setActiveTab('business');
      return;
    }

    if (!formData.nome_responsavel || !formData.cpf_responsavel || !formData.email_responsavel) {
      toast.error('Preencha todos os campos obrigatórios da Aba 3');
      setActiveTab('custom');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/locations', formData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar local');
      }

      toast.success('Local criado com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao criar local:', error);
      toast.error(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border border-emerald-800/30 rounded-xl overflow-hidden shadow-2xl shadow-emerald-900/30 backdrop-blur-sm">
      {/* Header */}
      <div className="relative px-6 py-5 border-b border-emerald-800/30 bg-gradient-to-r from-emerald-900/50 via-emerald-950/30 to-transparent flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-500/15 via-transparent to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="p-2 rounded-lg bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-300 hover:text-emerald-100 transition-all duration-300 border border-emerald-800/30"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl text-emerald-50 font-bold flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shadow-lg shadow-emerald-900/20">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                </div>
                Adicionar Novo Local
              </h2>
              <p className="text-emerald-300/60 text-sm mt-1 ml-[52px]">Preencha as informações do eletroposto</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-emerald-900/30 text-emerald-400 hover:text-emerald-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs e Conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        {/* Tabs Navigation */}
        <TabsList className="flex w-full bg-emerald-950/50 px-6 gap-2 border-b border-emerald-800/30 h-auto justify-start rounded-none py-3 flex-shrink-0">
          <TabsTrigger
            value="info"
            className="flex items-center gap-2 px-5 py-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-900/50 data-[state=active]:border-emerald-500 text-emerald-300/70 hover:bg-emerald-900/40 hover:text-emerald-200 rounded-lg transition-all duration-300 text-sm font-medium border border-transparent"
          >
            <MapPin className="w-4 h-4" />
            <span>Localização</span>
          </TabsTrigger>
          <TabsTrigger
            value="business"
            className="flex items-center gap-2 px-5 py-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-900/50 data-[state=active]:border-emerald-500 text-emerald-300/70 hover:bg-emerald-900/40 hover:text-emerald-200 rounded-lg transition-all duration-300 text-sm font-medium border border-transparent"
          >
            <Building className="w-4 h-4" />
            <span>Negócio</span>
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="flex items-center gap-2 px-5 py-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-900/50 data-[state=active]:border-emerald-500 text-emerald-300/70 hover:bg-emerald-900/40 hover:text-emerald-200 rounded-lg transition-all duration-300 text-sm font-medium border border-transparent"
          >
            <User className="w-4 h-4" />
            <span>Responsável</span>
          </TabsTrigger>
        </TabsList>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gradient-to-b from-emerald-950/20 to-zinc-950/40">
          {/* ABA 1: LOCALIZAÇÃO */}
          <TabsContent value="info" className="space-y-5 mt-0" data-state={activeTab === 'info' ? 'active' : 'inactive'}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna dos campos */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                    Nome do Local <span className="text-emerald-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Shopping Center Norte"
                    className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="cep" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      CEP <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={e => {
                        const value = e.target.value.replace(/\D/g, '');
                        const formatted = value.replace(/^(\d{5})(\d{3})$/, '$1-$2');
                        setFormData({ ...formData, cep: formatted });
                      }}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      maxLength={9}
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      Endereço <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Rua, Avenida..."
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="numero" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      Nº <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="numero"
                      value={formData.numero}
                      onChange={e => setFormData({ ...formData, numero: e.target.value })}
                      onBlur={handleNumeroBlur}
                      placeholder="123"
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="complemento" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      Complemento
                    </Label>
                    <Input
                      id="complemento"
                      value={formData.complemento}
                      onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                      placeholder="Sala 1"
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cidade" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      Cidade <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                      placeholder="São Paulo"
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="estado" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      UF <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="estado"
                      value={formData.estado}
                      onChange={e => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                      placeholder="SP"
                      maxLength={2}
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm uppercase placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {pinPosition && (
                  <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <p className="text-sm text-emerald-400 font-mono">
                      {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>

              {/* Coluna do mapa */}
              <div className="h-[300px] lg:h-full min-h-[300px] rounded-xl border border-emerald-800/40 overflow-hidden shadow-lg shadow-emerald-900/20">
                <DynamicMap center={mapCenter} zoom={4} className="z-0 h-full w-full">
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <ChangeMapView center={mapCenter} />
                  {pinPosition && getDefaultIcon() && (
                    <Marker position={pinPosition} icon={getDefaultIcon()!} />
                  )}
                </DynamicMap>
              </div>
            </div>
          </TabsContent>

          {/* ABA 2: NEGÓCIO */}
          <TabsContent value="business" className="space-y-5 mt-0" data-state={activeTab === 'business' ? 'active' : 'inactive'}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="razao_social" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                    Razão Social <span className="text-emerald-400">*</span>
                  </Label>
                  <Input
                    id="razao_social"
                    value={formData.razao_social}
                    onChange={e => setFormData({ ...formData, razao_social: e.target.value })}
                    placeholder="Empresa LTDA"
                    className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                    CNPJ <span className="text-emerald-400">*</span>
                  </Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '');
                      const formatted = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
                      setFormData({ ...formData, cnpj: formatted });
                    }}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-emerald-200/80 text-sm mb-2 block font-medium">Tipo Negócio</Label>
                    <Select value={formData.tipo_negocio} onValueChange={value => setFormData({ ...formData, tipo_negocio: value })}>
                      <SelectTrigger className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-emerald-950 border-emerald-800/50">
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="condominio_residencial">Condomínio</SelectItem>
                        <SelectItem value="publico">Público</SelectItem>
                        <SelectItem value="shopping">Shopping</SelectItem>
                        <SelectItem value="posto">Posto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-emerald-200/80 text-sm mb-2 block font-medium">Acesso</Label>
                    <Select value={formData.tipo_local} onValueChange={value => setFormData({ ...formData, tipo_local: value })}>
                      <SelectTrigger className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-emerald-950 border-emerald-800/50">
                        <SelectItem value="publico">Público</SelectItem>
                        <SelectItem value="privado">Privado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-emerald-200/80 text-sm mb-2 block font-medium">Estacionamento</Label>
                    <Select value={formData.tipo_estacionamento} onValueChange={value => setFormData({ ...formData, tipo_estacionamento: value })}>
                      <SelectTrigger className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-emerald-950 border-emerald-800/50">
                        <SelectItem value="gratis">Grátis</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Horários */}
              <div className="space-y-3">
                <Label className="text-emerald-200/80 text-sm block font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Horário de Funcionamento
                </Label>
                <div className="grid grid-cols-1 gap-2 p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/30 max-h-[280px] overflow-y-auto">
                  {diasSemana.map(dia => (
                    <div key={dia} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/20">
                      <span className="text-emerald-300 w-24 font-medium text-sm">{diasSemanaLabels[dia]}</span>
                      <Select
                        value={formData.horario_funcionamento[dia]?.tipo || '24horas'}
                        onValueChange={value => {
                          const newHorarios = { ...formData.horario_funcionamento };
                          newHorarios[dia] = { ...newHorarios[dia], tipo: value, abre_as: '00:00', fecha_as: '23:59' };
                          setFormData({ ...formData, horario_funcionamento: newHorarios });
                        }}
                      >
                        <SelectTrigger className="bg-emerald-950/40 text-emerald-50 border-emerald-800/40 h-9 text-sm flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-emerald-950 border-emerald-800/50">
                          <SelectItem value="24horas">24 horas</SelectItem>
                          <SelectItem value="customizado">Customizado</SelectItem>
                          <SelectItem value="fechado">Fechado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ABA 3: RESPONSÁVEL */}
          <TabsContent value="custom" className="space-y-5 mt-0" data-state={activeTab === 'custom' ? 'active' : 'inactive'}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="nome_responsavel" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      Responsável <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="nome_responsavel"
                      value={formData.nome_responsavel}
                      onChange={e => setFormData({ ...formData, nome_responsavel: e.target.value })}
                      placeholder="Nome completo"
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf_responsavel" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      CPF <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="cpf_responsavel"
                      value={formData.cpf_responsavel}
                      onChange={e => {
                        const value = e.target.value.replace(/\D/g, '');
                        const formatted = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
                        setFormData({ ...formData, cpf_responsavel: formatted });
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="email_responsavel" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      Email <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="email_responsavel"
                      type="email"
                      value={formData.email_responsavel}
                      onChange={e => setFormData({ ...formData, email_responsavel: e.target.value })}
                      placeholder="email@empresa.com"
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone_responsavel" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                      Telefone <span className="text-emerald-400">*</span>
                    </Label>
                    <Input
                      id="telefone_responsavel"
                      value={formData.telefone_responsavel}
                      onChange={e => {
                        const value = e.target.value.replace(/\D/g, '');
                        const formatted = value.length === 11
                          ? value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
                          : value.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
                        setFormData({ ...formData, telefone_responsavel: formatted });
                      }}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 h-11 text-sm placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="observacoes" className="text-emerald-200/80 text-sm mb-2 block font-medium">
                    Observações
                  </Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Informações adicionais..."
                    rows={4}
                    className="bg-emerald-950/30 text-emerald-50 border-emerald-800/50 text-sm resize-none placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Customização */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/30">
                  <Label className="text-emerald-200/80 text-sm block font-medium flex items-center gap-2 mb-4">
                    <Palette className="w-4 h-4 text-emerald-400" />
                    Personalização Visual
                  </Label>
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-300/70 text-sm">Cor do Local:</span>
                    <Input
                      type="color"
                      value={formData.cor_fundo}
                      onChange={e => setFormData({ ...formData, cor_fundo: e.target.value })}
                      className="w-14 h-10 cursor-pointer bg-transparent border-emerald-800/50 p-1 rounded-lg"
                    />
                    <Input
                      value={formData.cor_fundo}
                      onChange={e => setFormData({ ...formData, cor_fundo: e.target.value })}
                      className="w-32 bg-emerald-950/40 text-emerald-50 border-emerald-800/50 h-10 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-emerald-300/60 text-sm">
                    <span className="text-emerald-400 font-medium">Dica:</span> Após criar o local, você poderá adicionar carregadores e conectores através da página de detalhes do local.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-emerald-800/30 bg-gradient-to-r from-emerald-950/50 to-transparent flex-shrink-0">
          <p className="text-sm text-emerald-300/40">* Campos obrigatórios</p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-emerald-800/50 hover:bg-emerald-900/30 hover:border-emerald-700 text-emerald-300 h-11 px-6 text-sm font-medium transition-all duration-300"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-11 px-8 text-sm font-semibold shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Local
                </>
              )}
            </Button>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
