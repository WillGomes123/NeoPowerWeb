import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { DynamicMap, TileLayer, Marker, useMap, L } from './DynamicMap';

// Inicializar Leaflet icons
if (typeof window !== 'undefined' && L) {
  try {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
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

// Ícone neon customizado para o mapa
const getNeonIcon = () => {
  if (!L) return null;
  return L.divIcon({
    className: 'custom-neon-marker',
    html: `<div style="
      width: 28px; height: 28px;
      background: linear-gradient(135deg, var(--md-sys-color-primary, #8eff71), var(--md-sys-color-secondary, #71ffc5));
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 16px rgba(142,255,113,0.5), 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

export function AddLocationForm({ onSuccess, onCancel }: AddLocationFormProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-14.235, -51.925]);
  const [uploadingImage, setUploadingImage] = useState(false);
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

  const handleLocationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter no máximo 5MB'); return; }
    setUploadingImage(true);
    const fd = new FormData();
    fd.append('files', file);
    try {
      const res = await api.post('/locations/upload', fd);
      if (res.ok) {
        const data = await res.json();
        const url = data.url || data.payload?.url;
        setFormData(prev => ({ ...prev, imagem_local_url: url }));
        toast.success('Imagem enviada!');
      } else { toast.error('Erro no upload'); }
    } catch { toast.error('Erro ao enviar imagem'); }
    finally { setUploadingImage(false); }

  };

  const handleSubmit = async () => {
    // Validação Aba 1: Localização
    if (!formData.name || !formData.cep || !formData.address || !formData.numero || !formData.cidade || !formData.estado) {
      toast.error('Preencha todos os campos obrigatórios da aba Localização');
      setActiveTab('info');
      return;
    }

    if (formData.estado.length !== 2) {
      toast.error('UF deve ter exatamente 2 caracteres (ex: SP)');
      setActiveTab('info');
      return;
    }

    // Validação Aba 2: Negócio
    if (!formData.razao_social || !formData.cnpj) {
      toast.error('Preencha todos os campos obrigatórios da aba Negócio');
      setActiveTab('business');
      return;
    }

    // Validar formato do CNPJ (deve ter máscara completa: 00.000.000/0000-00)
    if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(formData.cnpj)) {
      toast.error('CNPJ deve estar no formato 00.000.000/0000-00');
      setActiveTab('business');
      return;
    }

    // Validação Aba 3: Responsável
    if (!formData.nome_responsavel || !formData.cpf_responsavel || !formData.email_responsavel || !formData.telefone_responsavel) {
      toast.error('Preencha todos os campos obrigatórios da aba Responsável');
      setActiveTab('custom');
      return;
    }

    // Validar formato do CPF (deve ter máscara completa: 000.000.000-00)
    if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(formData.cpf_responsavel)) {
      toast.error('CPF deve estar no formato 000.000.000-00');
      setActiveTab('custom');
      return;
    }

    // Validar formato do telefone
    if (!/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/.test(formData.telefone_responsavel)) {
      toast.error('Telefone deve estar no formato (00) 00000-0000');
      setActiveTab('custom');
      return;
    }

    setLoading(true);
    try {
      // Normalizar dados antes de enviar
      const normalizedData = {
        ...formData,
        cep: formData.cep.replace(/\D/g, ''),
        // Converter strings vazias para null em campos opcionais
        complemento: formData.complemento || null,
        logo_url: formData.logo_url || null,
        imagem_local_url: formData.imagem_local_url || null,
        observacoes: formData.observacoes || null,
      };
      const response = await api.post('/locations', normalizedData);

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.details?.length) {
          const fieldErrors = errorData.details
            .map((d: { field: string; message: string }) => `${d.field}: ${d.message}`)
            .join(', ');
          throw new Error(fieldErrors);
        }
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

  const tabTriggerClass = "flex items-center gap-2 px-5 py-3 data-[state=active]:bg-primary data-[state=active]:text-on-primary text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-all duration-300 text-sm font-medium border border-transparent";

  return (
    <div className="flex flex-col h-full bg-surface-container border border-outline-variant/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="relative px-6 py-5 border-b border-outline-variant/10 bg-surface-container-low flex-shrink-0">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-all duration-300 border border-outline-variant/10"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <h2 className="font-headline text-2xl font-bold text-on-surface flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                  <span className="material-symbols-outlined text-xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>add_location_alt</span>
                </div>
                Adicionar Novo Local
              </h2>
              <p className="text-on-surface-variant text-sm mt-1 ml-[52px]">Preencha as informações do eletroposto</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </div>

      {/* Tabs e Conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        {/* Tabs Navigation */}
        <TabsList className="flex w-full bg-surface-container-low px-6 gap-2 border-b border-outline-variant/10 h-auto justify-start rounded-none py-3 flex-shrink-0">
          <TabsTrigger value="info" className={tabTriggerClass}>
            <span className="material-symbols-outlined text-lg">location_on</span>
            <span>Localização</span>
          </TabsTrigger>
          <TabsTrigger value="business" className={tabTriggerClass}>
            <span className="material-symbols-outlined text-lg">business</span>
            <span>Negócio</span>
          </TabsTrigger>
          <TabsTrigger value="custom" className={tabTriggerClass}>
            <span className="material-symbols-outlined text-lg">person</span>
            <span>Responsável</span>
          </TabsTrigger>
        </TabsList>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-surface/50">
          {/* ABA 1: LOCALIZAÇÃO */}
          <TabsContent value="info" className="space-y-5 mt-0" data-state={activeTab === 'info' ? 'active' : 'inactive'}>
            {/* Imagem do Local - Drop Zone */}
            <div className="mb-2">
              <Label className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">Imagem do Local</Label>
              {formData.imagem_local_url ? (
                <div className="relative h-48 rounded-xl overflow-hidden border border-outline-variant/10 group">
                  <img src={formData.imagem_local_url} alt="Preview" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => document.getElementById('add-location-image-upload')?.click()}
                      className="p-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imagem_local_url: '' })}
                      className="p-2.5 rounded-full bg-red-500/20 backdrop-blur-sm text-red-300 hover:bg-red-500/40 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => document.getElementById('add-location-image-upload')?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary/40', 'bg-primary/5'); }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-primary/40', 'bg-primary/5'); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary/40', 'bg-primary/5');
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const input = document.getElementById('add-location-image-upload') as HTMLInputElement;
                      const dt = new DataTransfer();
                      dt.items.add(file);
                      input.files = dt.files;
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }}
                  className="h-40 rounded-xl border-2 border-dashed border-outline-variant/20 hover:border-primary/40 bg-surface-container-low/30 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm text-primary">Enviando...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
                        <span className="material-symbols-outlined text-2xl text-primary">add_photo_alternate</span>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-on-surface font-medium">Clique ou arraste uma imagem</p>
                        <p className="text-xs text-on-surface-variant mt-1">PNG, JPG ou WEBP (max. 5MB)</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              <input type="file" id="add-location-image-upload" className="hidden" accept="image/*" onChange={handleLocationImageUpload} disabled={uploadingImage} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna dos campos */}
              <div className="glass-panel rounded-lg border border-outline-variant/10 p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">edit_location_alt</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Endereço</span>
                </div>

                <div>
                  <Label htmlFor="name" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                    Nome do Local <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Shopping Center Norte"
                    className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="cep" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      CEP <span className="text-primary">*</span>
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
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      Endereço <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Rua, Avenida..."
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="numero" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      N. <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="numero"
                      value={formData.numero}
                      onChange={e => setFormData({ ...formData, numero: e.target.value })}
                      onBlur={handleNumeroBlur}
                      placeholder="123"
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="complemento" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      Complemento
                    </Label>
                    <Input
                      id="complemento"
                      value={formData.complemento}
                      onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                      placeholder="Sala 1"
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cidade" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      Cidade <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                      placeholder="São Paulo"
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="estado" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      UF <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="estado"
                      value={formData.estado}
                      onChange={e => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                      placeholder="SP"
                      maxLength={2}
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm uppercase"
                    />
                  </div>
                </div>

                {pinPosition && (
                  <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="material-symbols-outlined text-base text-primary">my_location</span>
                    <p className="text-sm text-primary font-mono">
                      {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>

              {/* Coluna do mapa */}
              <div className="h-[300px] lg:h-full min-h-[300px] rounded-xl border border-outline-variant/10 overflow-hidden">
                <DynamicMap center={mapCenter} zoom={4} className="z-0 h-full w-full">
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <ChangeMapView center={mapCenter} />
                  {pinPosition && getNeonIcon() && (
                    <Marker position={pinPosition} icon={getNeonIcon()!} />
                  )}
                </DynamicMap>
              </div>
            </div>
          </TabsContent>

          {/* ABA 2: NEGÓCIO */}
          <TabsContent value="business" className="space-y-5 mt-0" data-state={activeTab === 'business' ? 'active' : 'inactive'}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-lg border border-outline-variant/10 p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">corporate_fare</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Dados da Empresa</span>
                </div>

                <div>
                  <Label htmlFor="razao_social" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                    Razão Social <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="razao_social"
                    value={formData.razao_social}
                    onChange={e => setFormData({ ...formData, razao_social: e.target.value })}
                    placeholder="Empresa LTDA"
                    className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                    CNPJ <span className="text-primary">*</span>
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
                    className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">Tipo Negócio</Label>
                    <Select value={formData.tipo_negocio} onValueChange={value => setFormData({ ...formData, tipo_negocio: value })}>
                      <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-container border-outline-variant/20">
                        <SelectItem value="comercial" className="text-on-surface focus:bg-surface-container-highest">Comercial</SelectItem>
                        <SelectItem value="condominio_residencial" className="text-on-surface focus:bg-surface-container-highest">Condomínio</SelectItem>
                        <SelectItem value="publico" className="text-on-surface focus:bg-surface-container-highest">Público</SelectItem>
                        <SelectItem value="shopping" className="text-on-surface focus:bg-surface-container-highest">Shopping</SelectItem>
                        <SelectItem value="posto" className="text-on-surface focus:bg-surface-container-highest">Posto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">Acesso</Label>
                    <Select value={formData.tipo_local} onValueChange={value => setFormData({ ...formData, tipo_local: value })}>
                      <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-container border-outline-variant/20">
                        <SelectItem value="publico" className="text-on-surface focus:bg-surface-container-highest">Público</SelectItem>
                        <SelectItem value="privado" className="text-on-surface focus:bg-surface-container-highest">Privado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">Estacionamento</Label>
                    <Select value={formData.tipo_estacionamento} onValueChange={value => setFormData({ ...formData, tipo_estacionamento: value })}>
                      <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-container border-outline-variant/20">
                        <SelectItem value="gratis" className="text-on-surface focus:bg-surface-container-highest">Grátis</SelectItem>
                        <SelectItem value="pago" className="text-on-surface focus:bg-surface-container-highest">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Horários */}
              <div className="glass-panel rounded-lg border border-outline-variant/10 p-6 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">schedule</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Horário de Funcionamento</span>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto">
                  {diasSemana.map(dia => (
                    <div key={dia} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low">
                      <span className="text-on-surface w-24 font-medium text-sm">{diasSemanaLabels[dia]}</span>
                      <Select
                        value={formData.horario_funcionamento[dia]?.tipo || '24horas'}
                        onValueChange={value => {
                          const newHorarios = { ...formData.horario_funcionamento };
                          newHorarios[dia] = { ...newHorarios[dia], tipo: value, abre_as: '00:00', fecha_as: '23:59' };
                          setFormData({ ...formData, horario_funcionamento: newHorarios });
                        }}
                      >
                        <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface h-9 text-sm flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-container border-outline-variant/20">
                          <SelectItem value="24horas" className="text-on-surface focus:bg-surface-container-highest">24 horas</SelectItem>
                          <SelectItem value="customizado" className="text-on-surface focus:bg-surface-container-highest">Customizado</SelectItem>
                          <SelectItem value="fechado" className="text-on-surface focus:bg-surface-container-highest">Fechado</SelectItem>
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
              <div className="glass-panel rounded-lg border border-outline-variant/10 p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">badge</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Dados do Responsável</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="nome_responsavel" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      Responsável <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="nome_responsavel"
                      value={formData.nome_responsavel}
                      onChange={e => setFormData({ ...formData, nome_responsavel: e.target.value })}
                      placeholder="Nome completo"
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf_responsavel" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      CPF <span className="text-primary">*</span>
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
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="email_responsavel" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      Email <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="email_responsavel"
                      type="email"
                      value={formData.email_responsavel}
                      onChange={e => setFormData({ ...formData, email_responsavel: e.target.value })}
                      placeholder="email@empresa.com"
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone_responsavel" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                      Telefone <span className="text-primary">*</span>
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
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-11 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="observacoes" className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 block">
                    Observações
                  </Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Informações adicionais..."
                    rows={4}
                    className="bg-surface-container-low border-outline-variant/20 text-on-surface text-sm resize-none"
                  />
                </div>
              </div>

              {/* Customização */}
              <div className="space-y-4">
                <div className="glass-panel rounded-lg border border-outline-variant/10 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">palette</span>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Personalização Visual</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-on-surface-variant text-sm">Cor do Local:</span>
                    <Input
                      type="color"
                      value={formData.cor_fundo}
                      onChange={e => setFormData({ ...formData, cor_fundo: e.target.value })}
                      className="w-14 h-10 cursor-pointer bg-transparent border-outline-variant/20 p-1 rounded-lg"
                    />
                    <Input
                      value={formData.cor_fundo}
                      onChange={e => setFormData({ ...formData, cor_fundo: e.target.value })}
                      className="w-32 bg-surface-container-low border-outline-variant/20 text-on-surface h-10 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="glass-panel rounded-lg border border-outline-variant/10 p-6">
                  <p className="text-on-surface-variant text-sm">
                    <span className="text-primary font-medium">Dica:</span> Após criar o local, você poderá adicionar carregadores e conectores através da página de detalhes do local.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-outline-variant/10 bg-surface-container-low flex-shrink-0">
          <p className="text-sm text-on-surface-variant/40">* Campos obrigatórios</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="rounded-full border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest h-11 px-6 text-sm font-medium transition-all duration-300 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold h-11 px-8 text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:scale-100"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                  Salvando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
                  Salvar Local
                </>
              )}
            </button>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
