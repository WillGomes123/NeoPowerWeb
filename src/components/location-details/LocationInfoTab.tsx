import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Clock,
  Edit,
  FileText,
  Save,
  X,
  Search
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface LocationData {
  id: number;
  nomeDoLocal: string;
  endereco: string;
  numero: string;
  complemento?: string;
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
  imageUrl?: string;
}

interface Props {
  location: LocationData;
  onUpdate: () => void;
}

const diasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const diasLabel: Record<string, string> = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
  domingo: 'Domingo'
};

export function LocationInfoTab({ location, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    nomeDoLocal: location.nomeDoLocal || '',
    endereco: location.endereco || '',
    numero: location.numero || '',
    complemento: location.complemento || '',
    cidade: location.cidade || '',
    estado: location.estado || '',
    cep: location.cep || '',
    latitude: location.latitude?.toString() || '',
    longitude: location.longitude?.toString() || '',
    razaoSocial: location.razaoSocial || '',
    cnpj: location.cnpj || '',
    tipoDeNegocio: location.tipoDeNegocio || '',
    tipoDeLocal: location.tipoDeLocal || '',
    nomeResponsavel: location.nomeResponsavel || '',
    emailResponsavel: location.emailResponsavel || '',
    telefoneResponsavel: location.telefoneResponsavel || '',
    imageUrl: location.imageUrl || '',
  });

  const startEditing = () => {
    setForm({
      nomeDoLocal: location.nomeDoLocal || '',
      endereco: location.endereco || '',
      numero: location.numero || '',
      complemento: location.complemento || '',
      cidade: location.cidade || '',
      estado: location.estado || '',
      cep: location.cep || '',
      latitude: location.latitude?.toString() || '',
      longitude: location.longitude?.toString() || '',
      razaoSocial: location.razaoSocial || '',
      cnpj: location.cnpj || '',
      tipoDeNegocio: location.tipoDeNegocio || '',
      tipoDeLocal: location.tipoDeLocal || '',
      nomeResponsavel: location.nomeResponsavel || '',
      emailResponsavel: location.emailResponsavel || '',
      telefoneResponsavel: location.telefoneResponsavel || '',
      imageUrl: location.imageUrl || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        update('imageUrl', url);
        toast.success('Imagem enviada!');
      } else { toast.error('Erro no upload'); }
    } catch { toast.error('Erro ao enviar imagem'); }
    finally { setUploadingImage(false); }

  };

  const handleCepSearch = async () => {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      toast.error('CEP deve ter 8 dígitos');
      return;
    }
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }
      setForm(prev => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        cidade: data.localidade || prev.cidade,
        estado: data.uf || prev.estado,
        complemento: data.complemento || prev.complemento,
      }));

      // Buscar coordenadas via Nominatim
      const address = `${data.logradouro || ''}, ${data.localidade || ''}, ${data.uf || ''}, Brasil`;
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const geoData = await geoRes.json();
      if (geoData.length > 0) {
        setForm(prev => ({
          ...prev,
          latitude: geoData[0].lat,
          longitude: geoData[0].lon,
        }));
        toast.success('Endereço e coordenadas atualizados pelo CEP');
      } else {
        toast.success('Endereço atualizado, mas coordenadas não encontradas');
      }
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (form.nomeDoLocal) payload.name = form.nomeDoLocal;
      if (form.endereco) payload.address = form.endereco;
      if (form.numero) payload.numero = form.numero;
      if (form.complemento !== undefined) payload.complemento = form.complemento;
      if (form.cidade) payload.cidade = form.cidade;
      if (form.estado) payload.estado = form.estado;
      if (form.cep) payload.cep = form.cep;
      if (form.latitude) payload.latitude = parseFloat(form.latitude);
      if (form.longitude) payload.longitude = parseFloat(form.longitude);
      if (form.razaoSocial) payload.razao_social = form.razaoSocial;
      if (form.cnpj) payload.cnpj = form.cnpj;
      if (form.tipoDeNegocio) payload.tipo_negocio = form.tipoDeNegocio;
      if (form.tipoDeLocal) payload.tipo_local = form.tipoDeLocal;
      if (form.nomeResponsavel) payload.nome_responsavel = form.nomeResponsavel;
      if (form.emailResponsavel) payload.email_responsavel = form.emailResponsavel;
      if (form.telefoneResponsavel) payload.telefone_responsavel = form.telefoneResponsavel;
      if (form.imageUrl !== undefined) payload.imagem_local_url = form.imageUrl || null;


      const response = await api.put(`/locations/${location.id}`, payload);
      if (response.ok) {
        toast.success('Local atualizado com sucesso!');
        setIsEditing(false);
        onUpdate();
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return '-';
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return cnpj;
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return phone;
  };

  const formatCEP = (cep: string) => {
    if (!cep) return '-';
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return cep;
    return clean.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const renderHorario = () => {
    const horario = location.horarioFuncionamento;
    if (!horario) return <p className="text-zinc-400">Não informado</p>;

    return (
      <div className="space-y-2">
        {diasSemana.map(dia => {
          const diaHorario = horario[dia];
          if (!diaHorario) return null;

          let texto = '';
          if (diaHorario.tipo === '24horas') texto = '24 horas';
          else if (diaHorario.tipo === 'fechado') texto = 'Fechado';
          else if (diaHorario.tipo === 'customizado' || diaHorario.abre_as) texto = `${diaHorario.abre_as || '00:00'} - ${diaHorario.fecha_as || '00:00'}`;
          else texto = 'Não informado';

          return (
            <div key={dia} className="flex justify-between text-sm">
              <span className="text-zinc-400">{diasLabel[dia]}</span>
              <span className={`font-medium ${diaHorario.tipo === 'fechado' ? 'text-red-400' : 'text-white'}`}>
                {texto}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // ===== EDIT MODE =====
  if (isEditing) {
    return (
      <div className="space-y-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-emerald-400" />
              Editar Informações
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={cancelEditing} className="border-zinc-700 text-zinc-300">
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                <Save className="w-4 h-4 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Local */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Local</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Nome do Local</Label>
                  <Input value={form.nomeDoLocal} onChange={e => update('nomeDoLocal', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">CEP</Label>
                  <div className="flex gap-2">
                    <Input value={form.cep} onChange={e => update('cep', e.target.value)} placeholder="00000-000" className="bg-zinc-800 border-zinc-700 text-white" />
                    <Button size="sm" variant="outline" onClick={handleCepSearch} disabled={loadingCep} className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 shrink-0">
                      <Search className="w-4 h-4 mr-1" /> {loadingCep ? '...' : 'Buscar'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Endereço</Label>
                  <Input value={form.endereco} onChange={e => update('endereco', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Número</Label>
                    <Input value={form.numero} onChange={e => update('numero', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Complemento</Label>
                    <Input value={form.complemento} onChange={e => update('complemento', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Cidade</Label>
                  <Input value={form.cidade} onChange={e => update('cidade', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Estado</Label>
                  <Input value={form.estado} onChange={e => update('estado', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Latitude</Label>
                  <Input value={form.latitude} onChange={e => update('latitude', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Longitude</Label>
                  <Input value={form.longitude} onChange={e => update('longitude', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-zinc-300">Imagem do Local</Label>
                  <div className="flex gap-2">
                    <Input value={form.imageUrl} onChange={e => update('imageUrl', e.target.value)} placeholder="URL da imagem ou faça upload" className="bg-zinc-800 border-zinc-700 text-white flex-1" />
                    <div className="relative">
                      <input type="file" id="location-image-upload" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                      <Button
                        type="button" variant="outline" size="sm"
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-9 px-3"
                        onClick={() => document.getElementById('location-image-upload')?.click()}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? (
                          <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-zinc-300" />
                        ) : (
                          <span className="material-symbols-outlined text-base">upload</span>
                        )}
                      </Button>
                    </div>
                  </div>
                  {form.imageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-zinc-700 h-32 relative group/img">
                      <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                      <button
                        onClick={() => update('imageUrl', '')}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Empresa */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Empresa</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Razão Social</Label>
                  <Input value={form.razaoSocial} onChange={e => update('razaoSocial', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">CNPJ</Label>
                  <Input value={form.cnpj} onChange={e => update('cnpj', e.target.value)} placeholder="00.000.000/0000-00" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Tipo de Negócio</Label>
                  <Input value={form.tipoDeNegocio} onChange={e => update('tipoDeNegocio', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Tipo de Local</Label>
                  <Input value={form.tipoDeLocal} onChange={e => update('tipoDeLocal', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
              </div>
            </div>

            {/* Responsável */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Responsável</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Nome</Label>
                  <Input value={form.nomeResponsavel} onChange={e => update('nomeResponsavel', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">E-mail</Label>
                  <Input value={form.emailResponsavel} onChange={e => update('emailResponsavel', e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Telefone</Label>
                  <Input value={form.telefoneResponsavel} onChange={e => update('telefoneResponsavel', e.target.value)} placeholder="(00) 00000-0000" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== VIEW MODE =====
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Informações do Local
          </CardTitle>
          <Button variant="outline" size="sm" onClick={startEditing} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <Edit className="w-4 h-4 mr-2" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Nome do Local</label>
                <p className="text-white font-medium mt-1">{location.nomeDoLocal || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Endereço</label>
                <p className="text-white font-medium mt-1 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>
                    {location.endereco}, {location.numero}
                    {location.complemento && ` - ${location.complemento}`}
                    <br />
                    {location.cidade}/{location.estado} - CEP: {formatCEP(location.cep)}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Coordenadas</label>
                <p className="text-white font-medium mt-1">
                  {Number(location.latitude)?.toFixed(6)}, {Number(location.longitude)?.toFixed(6)}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Tipo de Negócio</label>
                <p className="text-white font-medium mt-1 capitalize">{location.tipoDeNegocio?.replace(/_/g, ' ') || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Tipo de Acesso</label>
                <p className="text-white font-medium mt-1 capitalize">{location.tipoDeLocal || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Carregadores</label>
                <p className="text-white font-medium mt-1">{location.chargePoints?.length || 0} carregadores</p>
              </div>
            </div>
          </div>
          {/* Image */}
          {location.imageUrl && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Imagem do Local</label>
              <div className="rounded-lg overflow-hidden border border-zinc-700 h-48">
                <img src={location.imageUrl} alt={location.nomeDoLocal} className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Razão Social</label>
              <p className="text-white font-medium mt-1">{location.razaoSocial || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider">CNPJ</label>
              <p className="text-white font-medium mt-1">{formatCNPJ(location.cnpj)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            Responsável
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Nome</label>
              <p className="text-white font-medium mt-1 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                {location.nomeResponsavel || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider">E-mail</label>
              <p className="text-white font-medium mt-1 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                {location.emailResponsavel || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Telefone</label>
              <p className="text-white font-medium mt-1 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                {formatPhone(location.telefoneResponsavel)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            Horário de Funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {renderHorario()}
        </CardContent>
      </Card>
    </div>
  );
}

export default LocationInfoTab;
