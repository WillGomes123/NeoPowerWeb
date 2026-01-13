import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Clock,
  Edit,
  FileText
} from 'lucide-react';

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

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return '-';
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return cnpj;
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (clean.length === 10) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
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
    if (!horario) return <p className="text-emerald-300/70">Não informado</p>;

    return (
      <div className="space-y-2">
        {diasSemana.map(dia => {
          const diaHorario = horario[dia];
          if (!diaHorario) return null;

          let texto = '';
          if (diaHorario.tipo === '24h') {
            texto = '24 horas';
          } else if (diaHorario.tipo === 'fechado') {
            texto = 'Fechado';
          } else if (diaHorario.tipo === 'customizado' || diaHorario.abre_as) {
            texto = `${diaHorario.abre_as || '00:00'} - ${diaHorario.fecha_as || '00:00'}`;
          } else {
            texto = 'Não informado';
          }

          return (
            <div key={dia} className="flex justify-between text-sm">
              <span className="text-emerald-300/70">{diasLabel[dia]}</span>
              <span className={`font-medium ${diaHorario.tipo === 'fechado' ? 'text-red-400' : 'text-emerald-50'}`}>
                {texto}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Informações do Local */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="flex flex-row items-center justify-between border-b border-emerald-800/30 pb-4">
          <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Informações do Local
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/30"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Nome do Local</label>
                <p className="text-emerald-50 font-medium mt-1">{location.nomeDoLocal || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Endereço</label>
                <p className="text-emerald-50 font-medium mt-1 flex items-start gap-2">
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
                <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Coordenadas</label>
                <p className="text-emerald-50 font-medium mt-1">
                  {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Tipo de Negócio</label>
                <p className="text-emerald-50 font-medium mt-1 capitalize">{location.tipoDeNegocio?.replace(/_/g, ' ') || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Tipo de Acesso</label>
                <p className="text-emerald-50 font-medium mt-1 capitalize">{location.tipoDeLocal || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Carregadores</label>
                <p className="text-emerald-50 font-medium mt-1">{location.chargePoints?.length || 0} carregadores</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações da Empresa */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Razão Social</label>
              <p className="text-emerald-50 font-medium mt-1">{location.razaoSocial || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-emerald-400/70 uppercase tracking-wider">CNPJ</label>
              <p className="text-emerald-50 font-medium mt-1">{formatCNPJ(location.cnpj)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsável */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            Responsável
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Nome</label>
              <p className="text-emerald-50 font-medium mt-1 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                {location.nomeResponsavel || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-emerald-400/70 uppercase tracking-wider">E-mail</label>
              <p className="text-emerald-50 font-medium mt-1 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                {location.emailResponsavel || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-emerald-400/70 uppercase tracking-wider">Telefone</label>
              <p className="text-emerald-50 font-medium mt-1 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                {formatPhone(location.telefoneResponsavel)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horário de Funcionamento */}
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
        <CardHeader className="border-b border-emerald-800/30 pb-4">
          <CardTitle className="text-lg text-emerald-50 flex items-center gap-2">
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
