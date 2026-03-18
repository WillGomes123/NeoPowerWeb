import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Palette,
  Plus,
  Trash2,
  Edit2,
  Globe,
  Image as ImageIcon,
  Upload,
  Loader2,
  Box,
  Users,
  X,
  Search,
  UserPlus,
  UserMinus,
} from 'lucide-react';

interface BrandingConfig {
  clientId: string;
  companyName: string;
  slogan?: string;
  logoType: 'programmatic' | 'image';
  logoUri?: string;
  splashUri?: string;
  splashBgColor?: string;
  primaryColor?: string;
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
    splashUri: '',
    splashBgColor: '#000000',
    primaryColor: '#00FF88',
  });

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/branding');
      if (response.ok) {
        const data = await response.json();
        // Fix: Use data.payload based on API response structure
        setConfigs(data.payload || []);
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
    if (!formData.clientId || !formData.companyName) {
      toast.error('ID do Cliente e Nome da Empresa são obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/admin/branding', formData);
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
        });
        void fetchConfigs();
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setFormData(prev => ({ ...prev, logoUri: data.payload.url }));
        toast.success('Logo enviado com sucesso!');
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro no upload');
      }
    } catch {
      toast.error('Erro ao conectar com o serviço de upload');
    } finally {
      setUploadingLogo(false);
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
        setBrandingUsers(data.payload || []);
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
      case 'atem':
        return 'ATEM';
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
        return 'border-amber-500/50 text-amber-400';
      case 'atem':
        return 'border-blue-500/50 text-blue-400';
      case 'blocked':
        return 'border-red-500/50 text-red-400';
      default:
        return 'border-zinc-600 text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">White Label & Branding</h1>
          <p className="text-zinc-400">Gerencie a identidade visual de cada cliente</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
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
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Marca
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 !p-0 overflow-hidden" style={{ maxWidth: '420px', width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="p-5 border-b border-zinc-800 shrink-0">
              <DialogTitle className="text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-emerald-400" />
                Configurar Marca
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-sm mt-1">
                Identidade visual do cliente no App
              </DialogDescription>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 p-5 space-y-5">
              {/* Identidade */}
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Identidade</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-xs">ID (Slug)</Label>
                    <Input
                      placeholder="cliente-xyz"
                      value={formData.clientId}
                      onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 text-white h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-xs">Empresa</Label>
                    <Input
                      placeholder="Nome Exibido"
                      value={formData.companyName}
                      onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 text-white h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">Slogan (Opcional)</Label>
                  <Input
                    value={formData.slogan}
                    onChange={e => setFormData({ ...formData, slogan: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white h-9 text-sm"
                  />
                </div>
              </div>

              {/* Logo */}
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Logo do App</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, logoType: 'programmatic' })}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${formData.logoType === 'programmatic' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}
                  >
                    Padrão
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, logoType: 'image' })}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${formData.logoType === 'image' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}
                  >
                    Upload
                  </button>
                </div>
                {formData.logoType === 'image' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="URL da logo ou faça upload"
                        value={formData.logoUri}
                        onChange={e => setFormData({ ...formData, logoUri: e.target.value })}
                        className="bg-zinc-800 border-zinc-700 text-white h-9 text-sm flex-1"
                      />
                      <div className="relative">
                        <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploadingLogo} />
                        <Button
                          type="button" variant="outline" size="sm"
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-9 px-3"
                          onClick={() => document.getElementById('logo-upload')?.click()}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    {formData.logoUri && (
                      <div className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <img src={formData.logoUri} alt="Logo" className="w-10 h-10 rounded object-contain bg-zinc-900" />
                        <span className="text-xs text-zinc-400 truncate flex-1">{formData.logoUri}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Splash Screen */}
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Splash Screen</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="URL da splash ou faça upload"
                      value={formData.splashUri || ''}
                      onChange={e => setFormData({ ...formData, splashUri: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 text-white h-9 text-sm flex-1"
                    />
                    <div className="relative">
                      <input
                        type="file" id="splash-upload" className="hidden" accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
                          if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return; }
                          setUploadingLogo(true);
                          const fd = new FormData();
                          fd.append('files', file);
                          try {
                            const res = await api.post('/admin/branding/upload', fd);
                            if (res.ok) {
                              const data = await res.json();
                              setFormData(prev => ({ ...prev, splashUri: data.payload.url }));
                              toast.success('Splash enviada!');
                            } else { toast.error('Erro no upload'); }
                          } catch { toast.error('Erro no upload'); }
                          finally { setUploadingLogo(false); }
                        }}
                      />
                      <Button
                        type="button" variant="outline" size="sm"
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-9 px-3"
                        onClick={() => document.getElementById('splash-upload')?.click()}
                        disabled={uploadingLogo}
                      >
                        {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  {formData.splashUri && (
                    <div className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                      <img src={formData.splashUri} alt="Splash" className="w-8 h-14 rounded object-contain bg-zinc-900" />
                      <span className="text-xs text-zinc-400 truncate flex-1">{formData.splashUri}</span>
                      <button onClick={() => setFormData({ ...formData, splashUri: '' })} className="text-zinc-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cores */}
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Cores</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-xs">Cor Primária</Label>
                    <div className="flex gap-2">
                      <input type="color" value={formData.primaryColor || '#00FF88'} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} className="w-10 h-9 rounded border border-zinc-700 bg-zinc-800 cursor-pointer" style={{ padding: '2px' }} />
                      <Input value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} className="bg-zinc-800 border-zinc-700 text-white font-mono h-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-xs">Fundo Splash</Label>
                    <div className="flex gap-2 items-center">
                      <label className="relative w-10 h-9 shrink-0 cursor-pointer">
                        <input
                          type="color"
                          value={formData.splashBgColor || '#000000'}
                          onChange={e => setFormData({ ...formData, splashBgColor: e.target.value })}
                          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                        />
                        <div className="w-full h-full rounded border border-zinc-700" style={{ backgroundColor: formData.splashBgColor || '#000000' }} />
                      </label>
                      <Input value={formData.splashBgColor || '#000000'} onChange={e => setFormData({ ...formData, splashBgColor: e.target.value })} className="bg-zinc-800 border-zinc-700 text-white font-mono h-9 text-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-zinc-800 shrink-0">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-zinc-700 text-zinc-300 h-9">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 h-9">
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Palette className="h-5 w-5 text-emerald-500" />
            Marcas Ativas
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Lista de todas as identidades visuais configuradas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">ID Cliente</TableHead>
                  <TableHead className="text-zinc-400">Empresa</TableHead>
                  <TableHead className="text-zinc-400">Cores</TableHead>
                  <TableHead className="text-zinc-400">Tipo Logo</TableHead>
                  <TableHead className="text-right text-zinc-400">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(config => (
                  <TableRow key={config.clientId} className="border-zinc-800">
                    <TableCell className="font-mono text-zinc-300">{config.clientId}</TableCell>
                    <TableCell className="text-white font-medium">{config.companyName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-zinc-700"
                          style={{ backgroundColor: config.primaryColor }}
                        />
                        <span className="text-zinc-400 text-xs font-mono">
                          {config.primaryColor}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {config.logoType === 'programmatic' ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/50 text-emerald-400 flex w-fit gap-1"
                        >
                          <Globe className="h-3 w-3" /> App Icon
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-blue-500/50 text-blue-400 flex w-fit gap-1"
                        >
                          <ImageIcon className="h-3 w-3" /> Imagem
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-blue-400"
                          title="Gerenciar usuários desta marca"
                          onClick={() => handleOpenUsersDialog(config.clientId)}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-emerald-400"
                          title="Gerar build do App (EAS)"
                          disabled={buildingClientId !== null}
                          onClick={() => openBuildDialog(config)}
                        >
                          {buildingClientId === config.clientId ? (
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                          ) : (
                            <Box className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-white"
                          onClick={() => handleEdit(config)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-red-400"
                          disabled={config.clientId === 'neopower-default'}
                          onClick={() => handleDelete(config.clientId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-zinc-500 italic">
                Nenhuma configuração encontrada no banco de dados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
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
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-[800px] max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Gerenciar Usuários —{' '}
              {configs.find(c => c.clientId === usersDialogClientId)?.companyName ||
                usersDialogClientId}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Associe usuários a esta marca. Usuários associados verão o branding deste cliente ao
              abrir o app.
            </DialogDescription>
          </DialogHeader>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 min-h-0 flex-1">
              {/* Search bar */}
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={userSearchFilter}
                  onChange={e => setUserSearchFilter(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white pl-9"
                />
              </div>

              {/* Tabs */}
              <Tabs
                value={usersTab}
                onValueChange={v => setUsersTab(v as any)}
                className="flex flex-col min-h-0 flex-1"
              >
                <TabsList className="bg-zinc-800/50 border border-zinc-700/50 shrink-0">
                  <TabsTrigger
                    value="associated"
                    className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-zinc-400"
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Associados ({brandingUsers.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="available"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Disponíveis ({availableUsers.length})
                  </TabsTrigger>
                </TabsList>

                {/* Associated Users Tab */}
                <TabsContent value="associated" className="mt-3 min-h-0 flex-1">
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    <div className="max-h-[380px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-zinc-800 hover:bg-transparent bg-zinc-800/50">
                            <TableHead className="text-zinc-400 w-[200px]">Nome</TableHead>
                            <TableHead className="text-zinc-400">Email</TableHead>
                            <TableHead className="text-zinc-400 w-[100px]">Função</TableHead>
                            <TableHead className="text-zinc-400 w-[80px] text-right">
                              Remover
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAssociated.length > 0 ? (
                            filteredAssociated.map(user => (
                              <TableRow
                                key={user.id}
                                className="border-zinc-800/50 hover:bg-zinc-800/30"
                              >
                                <TableCell className="text-white font-medium">
                                  {user.name || 'Sem nome'}
                                </TableCell>
                                <TableCell className="text-zinc-400 text-sm">
                                  {user.email}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${roleBadgeClass(user.role)}`}
                                  >
                                    {roleLabel(user.role)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
                                    onClick={() => handleRemoveBrandingUser(user.id)}
                                    title="Remover da marca"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow className="border-zinc-800/50">
                              <TableCell
                                colSpan={4}
                                className="text-center text-zinc-500 py-8 italic"
                              >
                                {userSearchFilter
                                  ? 'Nenhum usuário associado corresponde à busca'
                                  : 'Nenhum usuário associado a esta marca'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                {/* Available Users Tab */}
                <TabsContent value="available" className="mt-3 min-h-0 flex-1">
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    <div className="max-h-[380px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-zinc-800 hover:bg-transparent bg-zinc-800/50">
                            <TableHead className="text-zinc-400 w-[50px]">
                              <Checkbox
                                checked={
                                  filteredAvailable.length > 0 &&
                                  filteredAvailable.every(u => selectedUserIds.includes(u.id))
                                }
                                onCheckedChange={toggleSelectAllAvailable}
                                className="border-zinc-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                            </TableHead>
                            <TableHead className="text-zinc-400 w-[200px]">Nome</TableHead>
                            <TableHead className="text-zinc-400">Email</TableHead>
                            <TableHead className="text-zinc-400 w-[100px]">Função</TableHead>
                            <TableHead className="text-zinc-400 w-[120px]">Marca Atual</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAvailable.length > 0 ? (
                            filteredAvailable.map(user => (
                              <TableRow
                                key={user.id}
                                className={`border-zinc-800/50 cursor-pointer transition-colors ${
                                  selectedUserIds.includes(user.id)
                                    ? 'bg-blue-900/20 hover:bg-blue-900/30'
                                    : 'hover:bg-zinc-800/30'
                                }`}
                                onClick={() => toggleUserSelection(user.id)}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedUserIds.includes(user.id)}
                                    onCheckedChange={() => toggleUserSelection(user.id)}
                                    className="border-zinc-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                  />
                                </TableCell>
                                <TableCell className="text-white font-medium">
                                  {user.name || 'Sem nome'}
                                </TableCell>
                                <TableCell className="text-zinc-400 text-sm">
                                  {user.email}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${roleBadgeClass(user.role)}`}
                                  >
                                    {roleLabel(user.role)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {user.clientId ? (
                                    <Badge
                                      variant="outline"
                                      className="border-zinc-600 text-zinc-400 text-xs"
                                    >
                                      {user.clientId}
                                    </Badge>
                                  ) : (
                                    <span className="text-zinc-600 text-xs">Padrão</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow className="border-zinc-800/50">
                              <TableCell
                                colSpan={5}
                                className="text-center text-zinc-500 py-8 italic"
                              >
                                {userSearchFilter
                                  ? 'Nenhum usuário disponível corresponde à busca'
                                  : 'Todos os usuários já estão associados'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="shrink-0 border-t border-zinc-800 pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-zinc-500">
                {selectedUserIds.length > 0 && (
                  <span className="text-blue-400 font-medium">
                    {selectedUserIds.length} selecionado(s)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsUsersDialogOpen(false)}
                  className="border-zinc-700 text-zinc-300"
                >
                  Fechar
                </Button>
                {selectedUserIds.length > 0 && (
                  <Button onClick={handleAssignUsers} className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Associar {selectedUserIds.length} usuário(s)
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Build Options Dialog */}
      <Dialog open={isBuildDialogOpen} onOpenChange={setIsBuildDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 !p-0 overflow-hidden" style={{ maxWidth: '340px', width: '90vw' }}>
          <div className="p-5 border-b border-zinc-800">
            <DialogTitle className="text-white flex items-center gap-2">
              <Box className="h-5 w-5 text-emerald-500" />
              Gerar Build (EAS)
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm mt-1">
              Compilar app de{' '}
              <strong className="text-emerald-400">
                {selectedBuildClient?.companyName}
              </strong>
            </DialogDescription>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2.5">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Plataforma</p>
              <div className="space-y-2">
                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${buildPlatform === 'android' ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'}`}
                  onClick={() => setBuildPlatform('android')}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex justify-center items-center ${buildPlatform === 'android' ? 'border-emerald-500' : 'border-zinc-500'}`}
                  >
                    {buildPlatform === 'android' && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium text-sm ${buildPlatform === 'android' ? 'text-emerald-400' : 'text-zinc-300'}`}
                    >
                      Android (.apk / .aab)
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${buildPlatform === 'ios' ? 'bg-blue-900/20 border-blue-500/50' : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'}`}
                  onClick={() => setBuildPlatform('ios')}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex justify-center items-center ${buildPlatform === 'ios' ? 'border-blue-500' : 'border-zinc-500'}`}
                  >
                    {buildPlatform === 'ios' && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium text-sm ${buildPlatform === 'ios' ? 'text-blue-400' : 'text-zinc-300'}`}
                    >
                      iPhone (.ipa)
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${buildPlatform === 'all' ? 'bg-amber-900/20 border-amber-500/50' : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'}`}
                  onClick={() => setBuildPlatform('all')}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex justify-center items-center ${buildPlatform === 'all' ? 'border-amber-500' : 'border-zinc-500'}`}
                  >
                    {buildPlatform === 'all' && (
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium text-sm ${buildPlatform === 'all' ? 'text-amber-400' : 'text-zinc-300'}`}
                    >
                      Ambos (Android e iOS)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-3">
              <p className="text-amber-500/80 text-xs leading-relaxed">
                O processo pode levar de 5 a 15 min. Verifique o GitHub Actions.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
            <Button variant="outline" onClick={() => setIsBuildDialogOpen(false)} className="border-zinc-700 text-zinc-300 h-9">
              Cancelar
            </Button>
            <Button onClick={executeTriggerBuild} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Branding;
