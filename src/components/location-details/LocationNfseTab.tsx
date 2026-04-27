import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Save,
  Edit,
  X,
  Building2,
  Receipt,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface NfseData {
  nfse_provider: 'fortes' | 'manaus' | null;
  fortes_im: string | null;
  cidade_ibge: string | null;
  aliquota_iss: number | null;
  cod_servico_lc116: string | null;
  cod_trib_mun: string | null;
  simples_nacional: boolean | null;
  fortes_licenciado: string | null;
  fortes_estabelecimento: string | null;
}

interface Props {
  locationId: number;
}

const IBGE_COMUNS = [
  { cidade: 'Manaus — AM', ibge: '1302603' },
  { cidade: 'São Paulo — SP', ibge: '3550308' },
  { cidade: 'Curitiba — PR', ibge: '4106902' },
  { cidade: 'Rio de Janeiro — RJ', ibge: '3304557' },
  { cidade: 'Belo Horizonte — MG', ibge: '3106200' },
];

export function LocationNfseTab({ locationId }: Props) {
  const [data, setData] = useState<NfseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    nfse_provider: '' as string,
    fortes_im: '',
    cidade_ibge: '',
    aliquota_iss: '',
    cod_servico_lc116: '',
    cod_trib_mun: '',
    simples_nacional: false,
    fortes_licenciado: '',
    fortes_estabelecimento: '',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/locations/${locationId}`);
      if (response.ok) {
        const result = await response.json();
        const loc = result.location || result;
        const nfseData: NfseData = {
          nfse_provider: loc.nfse_provider || null,
          fortes_im: loc.fortes_im || loc.fortesIm || null,
          cidade_ibge: loc.cidade_ibge || loc.cidadeIbge || null,
          aliquota_iss: loc.aliquota_iss != null ? loc.aliquota_iss : (loc.aliquotaIss != null ? loc.aliquotaIss : null),
          cod_servico_lc116: loc.cod_servico_lc116 || loc.codServicoLc116 || null,
          cod_trib_mun: loc.cod_trib_mun || loc.codTribMun || null,
          simples_nacional: loc.simples_nacional ?? loc.simplesNacional ?? null,
          fortes_licenciado: loc.fortes_licenciado || loc.fortesLicenciado || null,
          fortes_estabelecimento: loc.fortes_estabelecimento || loc.fortesEstabelecimento || null,
        };
        setData(nfseData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados fiscais:', error);
      toast.error('Erro ao carregar dados fiscais');
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startEditing = () => {
    if (!data) return;
    setForm({
      nfse_provider: data.nfse_provider || '',
      fortes_im: data.fortes_im || '',
      cidade_ibge: data.cidade_ibge || '',
      aliquota_iss: data.aliquota_iss != null ? String(Math.round(data.aliquota_iss * 10000) / 100) : '5',
      cod_servico_lc116: data.cod_servico_lc116 || '09.01',
      cod_trib_mun: data.cod_trib_mun || '',
      simples_nacional: data.simples_nacional ?? false,
      fortes_licenciado: data.fortes_licenciado || '',
      fortes_estabelecimento: data.fortes_estabelecimento || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        nfse_provider: form.nfse_provider || null,
        fortes_im: form.fortes_im || null,
        cidade_ibge: form.cidade_ibge || null,
        aliquota_iss: form.aliquota_iss ? parseFloat(form.aliquota_iss) / 100 : null,
        cod_servico_lc116: form.cod_servico_lc116 || null,
        cod_trib_mun: form.cod_trib_mun || null,
        simples_nacional: form.simples_nacional,
        fortes_licenciado: form.fortes_licenciado || null,
        fortes_estabelecimento: form.fortes_estabelecimento || null,
      };

      const response = await api.put(`/locations/${locationId}`, payload);
      if (response.ok) {
        toast.success('Dados fiscais atualizados com sucesso!');
        setIsEditing(false);
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao salvar dados fiscais');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // ===== EDIT MODE =====
  if (isEditing) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Edit className="w-5 h-5 text-lime-600 dark:text-lime-400" />
              Editar Dados Fiscais (NFS-e)
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={cancelEditing} className="border-border text-foreground/70">
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-lime-600 hover:bg-lime-700">
                <Save className="w-4 h-4 mr-1" /> {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Provider */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Provider de Emissão</h4>
              <div className="flex gap-3">
                {(['fortes', 'manaus'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, nfse_provider: form.nfse_provider === p ? '' : p })}
                    className={`flex-1 py-3 rounded-lg border text-sm font-semibold transition-all ${
                      form.nfse_provider === p
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {p === 'fortes' ? '🏢 Fortes Doc' : '🏛️ Manaus (SOAP)'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {form.nfse_provider === 'manaus'
                  ? 'Requer Certificado A1 (.pfx) — configure na aba Certificado Digital.'
                  : form.nfse_provider === 'fortes'
                  ? 'Requer CNPJ Licenciado no Fortes Doc.'
                  : 'Selecione o provider para ativar a emissão automática de NFS-e.'}
              </p>
            </div>

            {/* Inscrição Municipal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/70">Inscrição Municipal</Label>
                <Input
                  value={form.fortes_im}
                  onChange={e => setForm({ ...form, fortes_im: e.target.value })}
                  placeholder="Ex: 12345678"
                  className="bg-surface-container-high border-border text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground/70">Código IBGE</Label>
                <Input
                  value={form.cidade_ibge}
                  onChange={e => setForm({ ...form, cidade_ibge: e.target.value.replace(/\D/g, '') })}
                  placeholder="Ex: 1302603 (Manaus)"
                  className="bg-surface-container-high border-border text-foreground"
                />
              </div>
            </div>

            {/* Alíquota + Código Serviço */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/70">Alíquota ISS (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={form.aliquota_iss}
                  onChange={e => setForm({ ...form, aliquota_iss: e.target.value })}
                  placeholder="5"
                  className="bg-surface-container-high border-border text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground/70">Código Serviço LC 116/2003</Label>
                <Input
                  value={form.cod_servico_lc116}
                  onChange={e => setForm({ ...form, cod_servico_lc116: e.target.value })}
                  placeholder="09.01"
                  className="bg-surface-container-high border-border text-foreground font-mono"
                />
                <p className="text-xs text-muted-foreground">09.01 = Fornecimento de energia elétrica (padrão EV)</p>
              </div>
            </div>

            {/* Código Tributação Municipal */}
            <div className="space-y-1.5">
              <Label className="text-foreground/70">Código Tributação Municipal</Label>
              <Input
                value={form.cod_trib_mun}
                onChange={e => setForm({ ...form, cod_trib_mun: e.target.value })}
                placeholder="Ex: 140101100 (Padrão Nacional NFS-e)"
                className="bg-surface-container-high border-border text-foreground font-mono"
              />
            </div>

            {/* Simples Nacional */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container-high/50 border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Optante pelo Simples Nacional</p>
                <p className="text-xs text-muted-foreground">Afeta o cálculo de ISS retido</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, simples_nacional: !form.simples_nacional })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.simples_nacional ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.simples_nacional ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Campos Fortes Doc (condicionais) */}
            {form.nfse_provider === 'fortes' && (
              <div className="space-y-4 p-4 rounded-lg border border-border bg-surface-container-high/30">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Fortes Doc — Identificação
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-foreground/70">CNPJ Licenciado</Label>
                    <Input
                      value={form.fortes_licenciado}
                      onChange={e => setForm({ ...form, fortes_licenciado: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      className="bg-surface-container-high border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground/70">Código Estabelecimento</Label>
                    <Input
                      value={form.fortes_estabelecimento}
                      onChange={e => setForm({ ...form, fortes_estabelecimento: e.target.value })}
                      placeholder="Ex: 1"
                      className="bg-surface-container-high border-border text-foreground"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* IBGEs comuns - atalhos */}
            <div className="p-4 rounded-lg border border-border bg-surface-container-high/30">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Códigos IBGE Comuns</p>
              <div className="space-y-1.5">
                {IBGE_COMUNS.map(item => (
                  <button
                    key={item.ibge}
                    type="button"
                    onClick={() => setForm({ ...form, cidade_ibge: item.ibge })}
                    className={`flex justify-between items-center w-full px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      form.cidade_ibge === item.ibge
                        ? 'bg-primary/15 text-primary'
                        : 'hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    <span>{item.cidade}</span>
                    <span className="font-mono">{item.ibge}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== VIEW MODE =====
  const hasProvider = !!data?.nfse_provider;
  const providerLabel = data?.nfse_provider === 'fortes' ? 'Fortes Doc (API REST)' : data?.nfse_provider === 'manaus' ? 'Manaus (SOAP ABRASF)' : 'Não configurado';
  const aliquotaDisplay = data?.aliquota_iss != null ? `${(data.aliquota_iss * 100).toFixed(2)}%` : 'Não informada';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Status Card */}
      <Card className="bg-card border-border overflow-hidden">
        <div className={`h-1.5 w-full ${hasProvider ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${hasProvider ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                <Receipt className={`w-6 h-6 ${hasProvider ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <div>
                <CardTitle className="text-xl">Dados Fiscais (NFS-e)</CardTitle>
                <CardDescription>
                  {hasProvider
                    ? 'Emissão automática de NFS-e configurada'
                    : 'Emissão automática de NFS-e não configurada'}
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={startEditing} className="border-border text-foreground/70 hover:bg-accent">
              <Edit className="w-4 h-4 mr-2" /> Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Provider</p>
              <div className="flex items-center gap-2">
                {hasProvider ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
                <span className="font-medium text-foreground">{providerLabel}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Alíquota ISS</p>
              <span className="font-medium text-foreground">{aliquotaDisplay}</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Simples Nacional</p>
              <span className={`font-medium ${data?.simples_nacional ? 'text-emerald-500' : 'text-foreground'}`}>
                {data?.simples_nacional ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhes Fiscais */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-lime-600 dark:text-lime-400" />
            Detalhes Fiscais
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Inscrição Municipal</label>
              <p className="text-foreground font-medium mt-1">{data?.fortes_im || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Código IBGE</label>
              <p className="text-foreground font-medium mt-1 font-mono">{data?.cidade_ibge || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Código Serviço LC 116/2003</label>
              <p className="text-foreground font-medium mt-1 font-mono">{data?.cod_servico_lc116 || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Código Tributação Municipal</label>
              <p className="text-foreground font-medium mt-1 font-mono">{data?.cod_trib_mun || '-'}</p>
            </div>
            {data?.nfse_provider === 'fortes' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">CNPJ Licenciado (Fortes)</label>
                  <p className="text-foreground font-medium mt-1">{data?.fortes_licenciado || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Código Estabelecimento</label>
                  <p className="text-foreground font-medium mt-1">{data?.fortes_estabelecimento || '-'}</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LocationNfseTab;
