import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

interface BrandingConfig {
  clientId: string;
  companyName?: string;
  slogan?: string;
  logoType: 'programmatic' | 'image';
  logoUri?: string;
  logoUriLight?: string;
  logoUriDark?: string;
  splashUri?: string;
  splashBgColor?: string;
  primaryColor?: string;
  theme?: 'dark' | 'light';
  updatedAt?: string;
}

interface BrandingUser {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
}

interface AllUser {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
  clientId: string | null;
}

export const Branding = () => {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<BrandingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [buildingClientId, setBuildingClientId] = useState<string | null>(null);

  // Build Dialog State
  const [isBuildDialogOpen, setIsBuildDialogOpen] = useState(false);
  const [selectedBuildClient, setSelectedBuildClient] = useState<BrandingConfig | null>(null);
  const [buildPlatform, setBuildPlatform] = useState<'android' | 'ios' | 'all'>('android');

  // Users management state
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [usersDialogClientId, setUsersDialogClientId] = useState<string>('');
  const [brandingUsers, setBrandingUsers] = useState<BrandingUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<BrandingConfig>>({
    clientId: '',
    companyName: '',
    slogan: '',
    logoType: 'programmatic',
    logoUri: '',
    logoUriLight: '',
    logoUriDark: '',
    splashUri: '',
    splashBgColor: '#000000',
    primaryColor: '#00FF88',
    theme: 'dark' as 'dark' | 'light',
  });

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/branding');
      if (response.ok) {
        const data = await response.json();
        setConfigs(Array.isArray(data) ? data : (data.payload || []));
      }
    } catch {
      toast.error('Erro ao carregar configurações de marca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfigs();
  }, []);

  const handleSubmit = async () => {
    if (!formData.clientId) {
      toast.error('ID do Cliente é obrigatório');
      return;
    }

    console.log('Enviando Branding (isEdit?):', !!formData.updatedAt, formData);
    setSubmitting(true);
    try {
      let response;
      const { updatedAt, ...dataToSave } = formData;

      if (updatedAt) {
        // Enviar atualização (PUT)
        response = await api.put(`/admin/branding/${encodeURIComponent(formData.clientId!)}`, dataToSave);
      } else {
        // Enviar criação (POST)
        response = await api.post('/admin/branding', dataToSave);
      }

      if (response.ok) {
        toast.success('Configuração de marca salva com sucesso!');
        setIsDialogOpen(false);
        setFormData({
          clientId: '',
          companyName: '',
          slogan: '',
          logoType: 'programmatic',
          logoUri: '',
          splashUri: '',
          splashBgColor: '#000000',
          primaryColor: '#00FF88',
          theme: 'dark',
        });
        void fetchConfigs();

        // Se a marca editada for a do próprio usuário logado ou se for admin, atualiza o preview
        if (user?.role === 'admin' || user?.branding?.clientId === formData.clientId || user?.branding?.logoUri === formData.logoUri) {
          try {
            const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
            userData.branding = { ...formData };
            sessionStorage.setItem('userData', JSON.stringify(userData));

            // Força a atualização do tema local para refletir a escolha do Branco/Escuro feita no admin
            if (formData.theme) {
              localStorage.setItem('neopower-theme', formData.theme);
            }

            // Recarrega para aplicar as novas variáveis de CSS e imagens globais
            window.location.reload();
          } catch (e) {
            console.error('Erro ao atualizar dados de sessão:', e);
          }
        }
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao salvar configuração');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    if (clientId === 'neopower-default') {
      toast.error('Não é possível excluir a marca padrão');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta configuração?')) return;

    try {
      const response = await api.delete(`/admin/branding/${encodeURIComponent(clientId)}`);
      if (response.ok) {
        toast.success('Configuração excluída');
        void fetchConfigs();
      }
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'logoUri' | 'logoUriLight' | 'logoUriDark' = 'logoUri') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingLogo(true);
    const formDataUpload = new FormData();
    formDataUpload.append('files', file);

    try {
      const response = await api.post('/admin/branding/upload', formDataUpload);
      if (response.ok) {
        const data = await response.json();
        const urlValue = data.url || (data.payload && data.payload.url) || data.secure_url;
        
        if (urlValue) {
          setFormData(prev => ({ ...prev, [target]: urlValue }));
          toast.success('Logo enviado com sucesso!');
        } else {
          toast.error('Erro: URL nao encontrada na resposta');
        }
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro no upload');
      }
    } catch {
      toast.error('Erro ao conectar com o serviço de upload');
    } finally {
      setUploadingLogo(false);
      // Limpar o input para permitir subir o mesmo arquivo novamente
      e.target.value = '';
    }
  };

  const openBuildDialog = (config: BrandingConfig) => {
    setSelectedBuildClient(config);
    setBuildPlatform('android'); // reset to default
    setIsBuildDialogOpen(true);
  };

  const executeTriggerBuild = async () => {
    if (!selectedBuildClient) return;

    setIsBuildDialogOpen(false);
    setBuildingClientId(selectedBuildClient.clientId);
    try {
      const response = await api.post(
        `/admin/branding/${encodeURIComponent(selectedBuildClient.clientId)}/build`,
        {
          platform: buildPlatform,
          profile: 'preview', // Build de teste/instalação direta
        }
      );

      if (response.ok) {
        toast.success(
          `Build para ${buildPlatform.toUpperCase()} iniciado com sucesso! Verifique o painel da Expo.`
        );
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao iniciar build');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor para iniciar build');
    } finally {
      setBuildingClientId(null);
    }
  };

  const handleEdit = (config: BrandingConfig) => {
    setFormData(config);
    setIsDialogOpen(true);
  };

  const handleOpenUsersDialog = async (clientId: string) => {
    setUsersDialogClientId(clientId);
    setIsUsersDialogOpen(true);
    setLoadingUsers(true);
    setSelectedUserIds([]);
    try {
      const [usersRes, allUsersRes] = await Promise.all([
        api.get(`/admin/branding/${encodeURIComponent(clientId)}/users`),
        api.get('/admin/users'),
      ]);
      if (usersRes.ok) {
        const data = await usersRes.json();
        setBrandingUsers(Array.isArray(data) ? data : (data.payload || []));
      }
      if (allUsersRes.ok) {
        const data = await allUsersRes.json();
        setAllUsers(data);
      }
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAssignUsers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Selecione pelo menos um usuário');
      return;
    }
    try {
      const response = await api.post(
        `/admin/branding/${encodeURIComponent(usersDialogClientId)}/users`,
        { userIds: selectedUserIds }
      );
      if (response.ok) {
        toast.success(`${selectedUserIds.length} usuário(s) associado(s)`);
        setSelectedUserIds([]);
        void handleOpenUsersDialog(usersDialogClientId);
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao associar usuários');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor');
    }
  };

  const handleRemoveBrandingUser = async (userId: number) => {
    try {
      const response = await api.delete(
        `/admin/branding/${encodeURIComponent(usersDialogClientId)}/users/${userId}`
      );
      if (response.ok) {
        toast.success('Usuário removido da marca');
        void handleOpenUsersDialog(usersDialogClientId);
      }
    } catch {
      toast.error('Erro ao remover usuário');
    }
  };

  const [userSearchFilter, setUserSearchFilter] = useState('');
  const [usersTab, setUsersTab] = useState<'associated' | 'available'>('associated');

  // Users not already assigned to this branding
  const availableUsers = allUsers.filter(u => !brandingUsers.some(bu => bu.id === u.id));

  const filterBySearch = (user: { name: string | null; email: string | null }) => {
    if (!userSearchFilter) return true;
    const q = userSearchFilter.toLowerCase();
    return (
      (user.name || '').toLowerCase().includes(q) || (user.email || '').toLowerCase().includes(q)
    );
  };

  const filteredAssociated = brandingUsers.filter(filterBySearch);
  const filteredAvailable = availableUsers.filter(filterBySearch);

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllAvailable = () => {
    const visibleIds = filteredAvailable.map(u => u.id);
    const allSelected = visibleIds.every(id => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedUserIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const roleLabel = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'comum':
        return 'Comum';
      case 'blocked':
        return 'Bloqueado';
      default:
        return role || '-';
    }
  };

  const roleBadgeClass = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'border-primary/30 text-primary bg-primary/10';
      case 'blocked':
        return 'border-red-500/30 text-red-400 bg-red-500/10';
      default:
        return 'border-outline-variant/20 text-on-surface-variant bg-surface-container-highest';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-1">WHITE LABEL ENGINE</span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Branding</h1>
          <p className="text-on-surface-variant mt-1">Gerencie a identidade visual de cada cliente</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all"
              onClick={() =>
                setFormData({
                  clientId: '',
                  companyName: '',
                  slogan: '',
                  logoType: 'programmatic',
                  logoUri: '',
                  splashUri: '',
                  splashBgColor: '#000000',
                  primaryColor: '#00FF88',
                  theme: 'dark',
                })
              }
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
              Nova Marca
            </button>
          </DialogTrigger>

          {/* Create/Edit Dialog */}
          <DialogContent className="bg-surface-container border-outline-variant/20 !p-0 overflow-hidden" style={{ maxWidth: '420px', width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="p-5 border-b border-outline-variant/10 shrink-0">
              <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">palette</span>
                Configurar Marca
              </DialogTitle>
              <DialogDescription className="text-on-surface-variant text-sm mt-1">
                Identidade visual do cliente no App
              </DialogDescription>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 p-5 space-y-5">
              {/* Identidade */}
              <div className="space-y-3">
                <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Identidade</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">ID (Slug)</Label>
                    <Input
                      placeholder="cliente-xyz"
                      value={formData.clientId}
                      onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Empresa (Opcional)</Label>
                    <Input
                      placeholder="Nome Exibido"
                      value={formData.companyName || ''}
                      onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Slogan (Opcional)</Label>
                  <Input
                    value={formData.slogan}
                    onChange={e => setFormData({ ...formData, slogan: e.target.value })}
                    className="bg-surface-container-low border-outline-variant/20 text-on-surface h-9 text-sm"
                  />
                </div>
              </div>

              {/* Logo */}
              <div className="space-y-3">
                <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Logo do App</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, logoType: 'programmatic' })}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${formData.logoType === 'programmatic' ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Padrao
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, logoType: 'image' })}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${formData.logoType === 'image' ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Upload
                  </button>
                </div>
                {formData.logoType === 'image' && (
                  <div className="space-y-4">
                    {/* Logo Padrão */}
                    <div className="space-y-1.5">
                      <Label className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">Logo Padrao (Obrigatório)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="URL da logo ou faca upload"
                          value={formData.logoUri}
                          onChange={e => setFormData({ ...formData, logoUri: e.target.value })}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface h-9 text-sm flex-1"
                        />
                        <div className="relative">
                          <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUri')} disabled={uploadingLogo} />
                          <button
                            type="button"
                            className="h-9 px-3 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                            ) : (
                              <span className="material-symbols-outlined text-lg">upload</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Logo Tema Claro */}
                    <div className="space-y-1.5">
                      <Label className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">Logo Tema Claro (Opcional)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="URL da logo para tema claro"
                          value={formData.logoUriLight}
                          onChange={e => setFormData({ ...formData, logoUriLight: e.target.value })}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface h-9 text-sm flex-1"
                        />
                        <div className="relative">
                          <input type="file" id="logo-light-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUriLight')} disabled={uploadingLogo} />
                          <button
                            type="button"
                            className="h-9 px-3 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center"
                            onClick={() => document.getElementById('logo-light-upload')?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                            ) : (
                              <span className="material-symbols-outlined text-lg">upload</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Logo Tema Escuro */}
                    <div className="space-y-1.5">
                      <Label className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">Logo Tema Escuro (Opcional)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="URL da logo para tema escuro"
                          value={formData.logoUriDark}
                          onChange={e => setFormData({ ...formData, logoUriDark: e.target.value })}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface h-9 text-sm flex-1"
                        />
                        <div className="relative">
                          <input type="file" id="logo-dark-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUriDark')} disabled={uploadingLogo} />
                          <button
                            type="button"
                            className="h-9 px-3 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center"
                            onClick={() => document.getElementById('logo-dark-upload')?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                            ) : (
                              <span className="material-symbols-outlined text-lg">upload</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Previews */}
                    <div className="grid grid-cols-3 gap-2">
                      {formData.logoUri && (
                        <div className="flex flex-col items-center gap-1 p-2 bg-surface-container-low rounded-lg border border-outline-variant/10">
                          <Label className="text-[8px] text-on-surface-variant uppercase">Padrao</Label>
                          <img src={formData.logoUri} alt="Logo" className="w-8 h-8 rounded object-contain bg-white" />
                        </div>
                      )}
                      {formData.logoUriLight && (
                        <div className="flex flex-col items-center gap-1 p-2 bg-slate-200 rounded-lg border border-outline-variant/10">
                          <Label className="text-[8px] text-black uppercase">Claro (BG Cinza)</Label>
                          <img src={formData.logoUriLight} alt="Logo Claro" className="w-8 h-8 rounded object-contain" />
                        </div>
                      )}
                      {formData.logoUriDark && (
                        <div className="flex flex-col items-center gap-1 p-2 bg-slate-800 rounded-lg border border-outline-variant/10">
                          <Label className="text-[8px] text-white uppercase">Escuro (BG Preto)</Label>
                          <img src={formData.logoUriDark} alt="Logo Escuro" className="w-8 h-8 rounded object-contain" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Splash Screen */}
              <div className="space-y-3">
                <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Splash Screen</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="URL da splash ou faca upload"
                      value={formData.splashUri || ''}
                      onChange={e => setFormData({ ...formData, splashUri: e.target.value })}
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface h-9 text-sm flex-1"
                    />
                    <div className="relative">
                      <input
                        type="file" id="splash-upload" className="hidden" accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
                          if (file.size > 5 * 1024 * 1024) { toast.error('Maximo 5MB'); return; }
                          setUploadingLogo(true);
                          const fd = new FormData();
                          fd.append('files', file);
                          try {
                            const res = await api.post('/admin/branding/upload', fd);
                            if (res.ok) {
                              const data = await res.json();
                              setFormData(prev => ({ ...prev, splashUri: data.url || data.payload?.url }));
                              toast.success('Splash enviada!');
                            } else { toast.error('Erro no upload'); }
                          } catch { toast.error('Erro no upload'); }
                          finally { setUploadingLogo(false); }
                        }}
                      />
                      <button
                        type="button"
                        className="h-9 px-3 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center"
                        onClick={() => document.getElementById('splash-upload')?.click()}
                        disabled={uploadingLogo}
                      >
                        {uploadingLogo ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                        ) : (
                          <span className="material-symbols-outlined text-lg">upload</span>
                        )}
                      </button>
                    </div>
                  </div>
                  {formData.splashUri && (
                    <div className="flex items-center gap-3 p-2 bg-surface-container-low rounded-lg border border-outline-variant/10">
                      <img src={formData.splashUri} alt="Splash" className="w-8 h-14 rounded object-contain bg-surface-container" />
                      <span className="text-xs text-on-surface-variant truncate flex-1">{formData.splashUri}</span>
                      <button onClick={() => setFormData({ ...formData, splashUri: '' })} className="text-on-surface-variant hover:text-error transition-colors">
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cores */}
              <div className="space-y-3">
                <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Cores</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Cor Primaria</Label>
                    <div className="flex gap-2">
                      <input type="color" value={formData.primaryColor || '#00FF88'} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} className="w-10 h-9 rounded border border-outline-variant/20 bg-surface-container-low cursor-pointer" style={{ padding: '2px' }} />
                      <Input value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} className="bg-surface-container-low border-outline-variant/20 text-on-surface font-mono h-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Fundo Splash</Label>
                    <div className="flex gap-2 items-center">
                      <label className="relative w-10 h-9 shrink-0 cursor-pointer">
                        <input
                          type="color"
                          value={formData.splashBgColor || '#000000'}
                          onChange={e => setFormData({ ...formData, splashBgColor: e.target.value })}
                          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                        />
                        <div className="w-full h-full rounded border border-outline-variant/20" style={{ backgroundColor: formData.splashBgColor || '#000000' }} />
                      </label>
                      <Input value={formData.splashBgColor || '#000000'} onChange={e => setFormData({ ...formData, splashBgColor: e.target.value })} className="bg-surface-container-low border-outline-variant/20 text-on-surface font-mono h-9 text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tema da Web */}
              <div className="space-y-3">
                <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Tema da Plataforma Web</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, theme: 'dark' })}
                    className={`flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      formData.theme === 'dark'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/30'
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-[#0e0e0e] border border-[#494847] flex items-center justify-center">
                      <span className="text-[#39FF14] text-xs font-bold">A</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold">Escuro</p>
                      <p className="text-[10px] text-on-surface-variant">Fundo escuro, texto claro</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, theme: 'light' })}
                    className={`flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      formData.theme === 'light'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/30'
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-[#f0f2f5] border border-[#d1d5db] flex items-center justify-center">
                      <span className="text-[#111827] text-xs font-bold">A</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold">Claro</p>
                      <p className="text-[10px] text-on-surface-variant">Fundo claro, texto escuro</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-outline-variant/10 shrink-0">
              <button onClick={() => setIsDialogOpen(false)} className="px-6 py-2 rounded-full border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors font-medium text-sm">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard icon="palette" label="TOTAL MARCAS" value={String(configs.length)} />
        <SummaryCard icon="public" label="PROGRAMATICAS" value={String(configs.filter(c => c.logoType === 'programmatic').length)} color="text-primary" />
        <SummaryCard icon="image" label="COM LOGO CUSTOM" value={String(configs.filter(c => c.logoType === 'image').length)} color="text-tertiary" />
      </div>

      {/* Configs Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="text-lg font-headline font-bold text-on-surface">Marcas Ativas</h3>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{configs.length} registros</span>
        </div>
        {configs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-6 py-4">ID Cliente</th>
                  <th className="px-6 py-4">Empresa</th>
                  <th className="px-6 py-4">Cores</th>
                  <th className="px-6 py-4">Tipo Logo</th>
                  <th className="px-6 py-4 text-center">Tema Web</th>
                  <th className="px-6 py-4 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {configs.map(config => (
                  <tr key={config.clientId} className="hover:bg-surface-container-highest/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-on-surface">{config.clientId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-on-surface">{config.companyName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full border border-outline-variant/20"
                          style={{ backgroundColor: config.primaryColor }}
                        />
                        <span className="text-on-surface-variant text-xs font-mono">
                          {config.primaryColor}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {config.logoType === 'programmatic' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                          <span className="material-symbols-outlined text-xs">public</span>
                          App Icon
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary text-[10px] font-bold">
                          <span className="material-symbols-outlined text-xs">image</span>
                          Imagem
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        config.theme === 'light' 
                          ? 'bg-surface-container-highest text-foreground border border-border'
                          : 'bg-surface-container-highest text-foreground border border-border'
                      }`}>
                        <span className="material-symbols-outlined text-xs">
                          {config.theme === 'light' ? 'light_mode' : 'dark_mode'}
                        </span>
                        {config.theme === 'light' ? 'CLARO' : 'ESCURO'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1.5">
                        <button
                          className="w-8 h-8 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all"
                          title="Gerenciar usuarios desta marca"
                          onClick={() => handleOpenUsersDialog(config.clientId)}
                        >
                          <span className="material-symbols-outlined text-lg">group</span>
                        </button>
                        <button
                          className="w-8 h-8 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all disabled:opacity-40"
                          title="Gerar build do App (EAS)"
                          disabled={buildingClientId !== null}
                          onClick={() => openBuildDialog(config)}
                        >
                          {buildingClientId === config.clientId ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                          ) : (
                            <span className="material-symbols-outlined text-lg">build</span>
                          )}
                        </button>
                        <button
                          className="w-8 h-8 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high hover:text-on-surface transition-all"
                          onClick={() => handleEdit(config)}
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          className="w-8 h-8 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant flex items-center justify-center hover:bg-error/10 hover:text-error hover:border-error/20 transition-all disabled:opacity-40"
                          disabled={config.clientId === 'neopower-default'}
                          onClick={() => handleDelete(config.clientId)}
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-on-surface-variant italic">
              Nenhuma configuracao encontrada no banco de dados.
            </p>
          </div>
        )}
      </div>

      {/* Users Management Dialog */}
      <Dialog
        open={isUsersDialogOpen}
        onOpenChange={open => {
          setIsUsersDialogOpen(open);
          if (!open) {
            setUserSearchFilter('');
            setUsersTab('associated');
          }
        }}
      >
        <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[800px] max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">group</span>
              Gerenciar Usuarios —{' '}
              {configs.find(c => c.clientId === usersDialogClientId)?.companyName ||
                usersDialogClientId}
            </DialogTitle>
            <DialogDescription className="text-on-surface-variant">
              Associe usuarios a esta marca. Usuarios associados verao o branding deste cliente ao
              abrir o app.
            </DialogDescription>
          </DialogHeader>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 min-h-0 flex-1">
              {/* Search bar */}
              <div className="relative shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant">search</span>
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={userSearchFilter}
                  onChange={e => setUserSearchFilter(e.target.value)}
                  className="bg-surface-container-low border-outline-variant/20 text-on-surface pl-10"
                />
              </div>

              {/* Tabs */}
              <Tabs
                value={usersTab}
                onValueChange={v => setUsersTab(v as any)}
                className="flex flex-col min-h-0 flex-1"
              >
                <TabsList className="bg-surface-container-low border border-outline-variant/10 shrink-0">
                  <TabsTrigger
                    value="associated"
                    className="data-[state=active]:bg-primary data-[state=active]:text-on-primary text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-sm mr-2">person_remove</span>
                    Associados ({brandingUsers.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="available"
                    className="data-[state=active]:bg-primary data-[state=active]:text-on-primary text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-sm mr-2">person_add</span>
                    Disponiveis ({availableUsers.length})
                  </TabsTrigger>
                </TabsList>

                {/* Associated Users Tab */}
                <TabsContent value="associated" className="mt-3 min-h-0 flex-1">
                  <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
                    <div className="max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                            <th className="px-6 py-3 w-[200px]">Nome</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3 w-[100px]">Funcao</th>
                            <th className="px-6 py-3 w-[80px] text-right">Remover</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/5">
                          {filteredAssociated.length > 0 ? (
                            filteredAssociated.map(user => (
                              <tr
                                key={user.id}
                                className="hover:bg-surface-container-highest/30 transition-colors"
                              >
                                <td className="px-6 py-3 text-sm font-medium text-on-surface">
                                  {user.name || 'Sem nome'}
                                </td>
                                <td className="px-6 py-3 text-sm text-on-surface-variant">
                                  {user.email}
                                </td>
                                <td className="px-6 py-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeClass(user.role)}`}
                                  >
                                    {roleLabel(user.role)}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <button
                                    className="w-7 h-7 rounded-lg bg-surface-container-highest text-on-surface-variant flex items-center justify-center hover:bg-error/10 hover:text-error transition-all mx-auto"
                                    onClick={() => handleRemoveBrandingUser(user.id)}
                                    title="Remover da marca"
                                  >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="text-center text-on-surface-variant py-8 italic"
                              >
                                {userSearchFilter
                                  ? 'Nenhum usuario associado corresponde a busca'
                                  : 'Nenhum usuario associado a esta marca'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>

                {/* Available Users Tab */}
                <TabsContent value="available" className="mt-3 min-h-0 flex-1">
                  <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
                    <div className="max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                            <th className="px-6 py-3 w-[50px]">
                              <Checkbox
                                checked={
                                  filteredAvailable.length > 0 &&
                                  filteredAvailable.every(u => selectedUserIds.includes(u.id))
                                }
                                onCheckedChange={toggleSelectAllAvailable}
                                className="border-outline-variant/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </th>
                            <th className="px-6 py-3 w-[200px]">Nome</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3 w-[100px]">Funcao</th>
                            <th className="px-6 py-3 w-[120px]">Marca Atual</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/5">
                          {filteredAvailable.length > 0 ? (
                            filteredAvailable.map(user => (
                              <tr
                                key={user.id}
                                className={`cursor-pointer transition-colors ${
                                  selectedUserIds.includes(user.id)
                                    ? 'bg-primary/5 hover:bg-primary/10'
                                    : 'hover:bg-surface-container-highest/30'
                                }`}
                                onClick={() => toggleUserSelection(user.id)}
                              >
                                <td className="px-6 py-3">
                                  <Checkbox
                                    checked={selectedUserIds.includes(user.id)}
                                    onCheckedChange={() => toggleUserSelection(user.id)}
                                    className="border-outline-variant/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                </td>
                                <td className="px-6 py-3 text-sm font-medium text-on-surface">
                                  {user.name || 'Sem nome'}
                                </td>
                                <td className="px-6 py-3 text-sm text-on-surface-variant">
                                  {user.email}
                                </td>
                                <td className="px-6 py-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeClass(user.role)}`}
                                  >
                                    {roleLabel(user.role)}
                                  </span>
                                </td>
                                <td className="px-6 py-3">
                                  {user.clientId ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-outline-variant/20 text-on-surface-variant text-[10px] font-bold font-mono">
                                      {user.clientId}
                                    </span>
                                  ) : (
                                    <span className="text-on-surface-variant text-xs">Padrao</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="text-center text-on-surface-variant py-8 italic"
                              >
                                {userSearchFilter
                                  ? 'Nenhum usuario disponivel corresponde a busca'
                                  : 'Todos os usuarios ja estao associados'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <div className="shrink-0 border-t border-outline-variant/10 pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-on-surface-variant">
                {selectedUserIds.length > 0 && (
                  <span className="text-primary font-medium">
                    {selectedUserIds.length} selecionado(s)
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsUsersDialogOpen(false)}
                  className="px-6 py-2 rounded-full border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors font-medium text-sm"
                >
                  Fechar
                </button>
                {selectedUserIds.length > 0 && (
                  <button onClick={handleAssignUsers} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    Associar {selectedUserIds.length} usuario(s)
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Build Options Dialog */}
      <Dialog open={isBuildDialogOpen} onOpenChange={setIsBuildDialogOpen}>
        <DialogContent className="bg-surface-container border-outline-variant/20 !p-0 overflow-hidden" style={{ maxWidth: '340px', width: '90vw' }}>
          <div className="p-5 border-b border-outline-variant/10">
            <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">build</span>
              Gerar Build (EAS)
            </DialogTitle>
            <DialogDescription className="text-on-surface-variant text-sm mt-1">
              Compilar app de{' '}
              <strong className="text-primary">
                {selectedBuildClient?.companyName}
              </strong>
            </DialogDescription>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2.5">
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Plataforma</p>
              <div className="space-y-2">
                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${buildPlatform === 'android' ? 'bg-primary/10 border-primary/30' : 'bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/30'}`}
                  onClick={() => setBuildPlatform('android')}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex justify-center items-center ${buildPlatform === 'android' ? 'border-primary' : 'border-outline-variant/40'}`}
                  >
                    {buildPlatform === 'android' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium text-sm ${buildPlatform === 'android' ? 'text-primary' : 'text-on-surface-variant'}`}
                    >
                      Android (.apk / .aab)
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${buildPlatform === 'ios' ? 'bg-primary/10 border-primary/30' : 'bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/30'}`}
                  onClick={() => setBuildPlatform('ios')}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex justify-center items-center ${buildPlatform === 'ios' ? 'border-primary' : 'border-outline-variant/40'}`}
                  >
                    {buildPlatform === 'ios' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium text-sm ${buildPlatform === 'ios' ? 'text-primary' : 'text-on-surface-variant'}`}
                    >
                      iPhone (.ipa)
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${buildPlatform === 'all' ? 'bg-primary/10 border-primary/30' : 'bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/30'}`}
                  onClick={() => setBuildPlatform('all')}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex justify-center items-center ${buildPlatform === 'all' ? 'border-primary' : 'border-outline-variant/40'}`}
                  >
                    {buildPlatform === 'all' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium text-sm ${buildPlatform === 'all' ? 'text-primary' : 'text-on-surface-variant'}`}
                    >
                      Ambos (Android e iOS)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-high border border-outline-variant/30 rounded-lg p-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-sm text-muted-foreground mt-0.5">schedule</span>
              <p className="text-muted-foreground text-xs leading-relaxed">
                O processo pode levar de 5 a 15 min. Verifique o GitHub Actions.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-outline-variant/10">
            <button onClick={() => setIsBuildDialogOpen(false)} className="px-6 py-2 rounded-full border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors font-medium text-sm">
              Cancelar
            </button>
            <button onClick={executeTriggerBuild} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-sm">check</span>
              Confirmar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function SummaryCard({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="glass-panel p-6 rounded-lg border border-outline-variant/10 flex flex-col justify-between h-28 hover:border-primary/30 transition-colors">
      <div className="flex justify-between items-start">
        <span className="text-on-surface-variant text-xs uppercase tracking-widest">{label}</span>
        <span className={`material-symbols-outlined text-sm ${color || 'text-primary'}`}>{icon}</span>
      </div>
      <span className="text-3xl font-headline font-bold text-on-surface">{value}</span>
    </div>
  );
}

export default Branding;
