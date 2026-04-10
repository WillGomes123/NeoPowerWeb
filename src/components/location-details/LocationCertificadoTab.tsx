import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileKey,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CertificadoStatus {
  location_id: number;
  nome: string;
  cnpj: string;
  nfse_provider: 'fortes' | 'manaus' | null;
  certificado: {
    presente: boolean;
    validade: string | null;
    expirado: boolean | null;
    dias_para_expirar: number | null;
  };
}

interface Props {
  locationId: number;
}

export function LocationCertificadoTab({ locationId }: Props) {
  const [status, setStatus] = useState<CertificadoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [provider, setProvider] = useState<'fortes' | 'manaus'>('manaus');

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/locations/${locationId}/certificado/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Erro ao buscar status do certificado:', error);
      toast.error('Erro ao carregar status do certificado');
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !password) {
      toast.error('Selecione um arquivo e informe a senha');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('certificado', file);
    formData.append('senha', password);
    formData.append('nfse_provider', provider);

    try {
      const response = await api.post(`/locations/${locationId}/certificado`, formData);
      
      if (response.ok) {
        toast.success('Certificado enviado com sucesso!');
        setFile(null);
        setPassword('');
        fetchStatus();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao enviar certificado');
      }
    } catch (error) {
      console.error('Erro no upload do certificado:', error);
      toast.error('Erro de conexão com o servidor');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja remover este certificado? A emissão de NFS-e será interrompida.')) {
      return;
    }

    try {
      const response = await api.delete(`/locations/${locationId}/certificado`);
      if (response.ok) {
        toast.success('Certificado removido');
        fetchStatus();
      } else {
        toast.error('Erro ao remover certificado');
      }
    } catch (error) {
      toast.error('Erro de conexão');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Clock className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Status Atual */}
      <Card className="bg-card border-border overflow-hidden">
        <div className={`h-1.5 w-full ${status?.certificado.presente ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${status?.certificado.presente ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                <ShieldCheck className={`w-6 h-6 ${status?.certificado.presente ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <div>
                <CardTitle className="text-xl">Certificado Digital A1</CardTitle>
                <CardDescription>
                  {status?.certificado.presente 
                    ? 'Certificado configurado e pronto para emissão' 
                    : 'Nenhum certificado configurado para este local'}
                </CardDescription>
              </div>
            </div>
            {status?.certificado.presente && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDelete}
                className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remover
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.certificado.presente ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Validade</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium text-foreground">
                    {status.certificado.validade 
                      ? format(new Date(status.certificado.validade), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : 'Não informada'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status</p>
                <div className="flex items-center gap-2">
                  {status.certificado.expirado ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-500 font-bold">EXPIRADO</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-500 font-bold">VÁLIDO</span>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Provedor NFS-e</p>
                <div className="flex items-center gap-2 text-foreground capitalize font-medium">
                  <Building2 className="w-4 h-4 text-primary" />
                  {status.nfse_provider || 'Não configurado'}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6 flex flex-col items-center text-center gap-3">
              <FileKey className="w-12 h-12 text-amber-500 opacity-50" />
              <div>
                <h4 className="font-bold text-amber-500">Atenção</h4>
                <p className="text-sm text-amber-500/80 max-w-md">
                  Sem um certificado digital válido, o sistema não poderá assinar e emitir Notas Fiscais de Serviço (NFS-e) para as transações deste local.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulário de Upload */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Configurar Novo Certificado</CardTitle>
          <CardDescription>
            Faça o upload do arquivo .pfx ou .p12 para substituir o atual ou configurar um novo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Arquivo */}
              <div className="space-y-2">
                <Label htmlFor="cert-file">Arquivo do Certificado (.pfx, .p12)</Label>
                <div className="relative group">
                  <Input
                    id="cert-file"
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="cursor-pointer file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:mr-4 hover:border-primary transition-colors h-10 pt-1.5"
                  />
                  <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors pointer-events-none" />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <Label htmlFor="cert-pwd">Senha do Certificado</Label>
                <div className="relative">
                  <Input
                    id="cert-pwd"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Informe a senha do arquivo"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Provedor */}
              <div className="space-y-2">
                <Label htmlFor="provider">Provedor NFS-e</Label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="manaus">Prefeitura de Manaus (SOAP ABRASF)</option>
                  <option value="fortes">Fortes Doc (API REST)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={!file || !password || isUploading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[150px]"
              >
                {isUploading ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Salvar Certificado
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Informações Adicionais */}
      <div className="bg-surface-container-low rounded-xl p-6 border border-border/50">
        <h4 className="flex items-center gap-2 font-bold text-foreground mb-3 font-headline">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Sobre a Segurança do Certificado
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <p>
            O arquivo do certificado e sua senha são criptografados com o algoritmo <strong>AES-256-GCM</strong> antes de serem persistidos no banco de dados. 
          </p>
          <p>
            A descriptografia ocorre apenas temporariamente e estritamente em memória durante a assinatura dos lotes de NFS-e, garantindo que os dados nunca sejam expostos em texto claro.
          </p>
        </div>
      </div>
    </div>
  );
}
