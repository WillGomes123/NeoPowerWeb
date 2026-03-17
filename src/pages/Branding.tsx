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
import { Palette, Plus, Trash2, Edit2, Globe, Image as ImageIcon, Upload, Loader2, Box, Users, X, Search, UserPlus, UserMinus } from 'lucide-react';

interface BrandingConfig {
  clientId: string;
  companyName: string;
  slogan?: string;
  logoType: 'programmatic' | 'image';
  logoUri?: string;
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
    primaryColor: '#00FF88'
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
            primaryColor: '#00FF88'
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

  const handleTriggerBuild = async (clientId: string) => {
    if (!confirm(`Deseja iniciar o build do App para o cliente "${clientId}"? Isso pode levar alguns minutos na Expo.`)) return;
    
    setBuildingClientId(clientId);
    try {
      const response = await api.post(`/admin/branding/${encodeURIComponent(clientId)}/build`, {
        platform: 'android',
        profile: 'preview' // Build de teste/instalação direta
      });
      
      if (response.ok) {
        toast.success('Build iniciado com sucesso! Verifique o painel da Expo.');
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
        api.get('/admin/users')
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
      const response = await api.post(`/admin/branding/${encodeURIComponent(usersDialogClientId)}/users`, { userIds: selectedUserIds });
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
      const response = await api.delete(`/admin/branding/${encodeURIComponent(usersDialogClientId)}/users/${userId}`);
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
    return (user.name || '').toLowerCase().includes(q) || (user.email || '').toLowerCase().includes(q);
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
      case 'admin': return 'Admin';
      case 'atem': return 'ATEM';
      case 'comum': return 'Comum';
      case 'blocked': return 'Bloqueado';
      default: return role || '-';
    }
  };

  const roleBadgeClass = (role: string | null) => {
    switch (role) {
      case 'admin': return 'border-amber-500/50 text-amber-400';
      case 'atem': return 'border-blue-500/50 text-blue-400';
      case 'blocked': return 'border-red-500/50 text-red-400';
      default: return 'border-zinc-600 text-zinc-400';
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
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setFormData({
                clientId: '',
                companyName: '',
                slogan: '',
                logoType: 'programmatic',
                logoUri: '',
                primaryColor: '#00FF88'
            })}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Marca
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-white">Configurar Marca</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Defina os elementos visuais que o App assumirá para este cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="clientId" className="text-zinc-300">ID do Cliente (Slug)</Label>
                    <Input
                        id="clientId"
                        placeholder="ex: cliente-xyz"
                        value={formData.clientId}
                        onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                        className="bg-zinc-800 border-zinc-700 text-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-zinc-300">Nome da Empresa</Label>
                    <Input
                        id="companyName"
                        placeholder="Nome Exibido"
                        value={formData.companyName}
                        onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                        className="bg-zinc-800 border-zinc-700 text-white"
                    />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slogan" className="text-zinc-300">Slogan (Opcional)</Label>
                <Input
                  id="slogan"
                  value={formData.slogan}
                  onChange={e => setFormData({ ...formData, slogan: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-zinc-300">Tipo de Logo</Label>
                    <div className="flex gap-2">
                        <Button 
                            variant={formData.logoType === 'programmatic' ? 'default' : 'outline'}
                            className={formData.logoType === 'programmatic' ? 'bg-emerald-600' : 'border-zinc-700'}
                            onClick={() => setFormData({ ...formData, logoType: 'programmatic' })}
                        >
                            Ícone App
                        </Button>
                        <Button 
                            variant={formData.logoType === 'image' ? 'default' : 'outline'}
                            className={formData.logoType === 'image' ? 'bg-emerald-600' : 'border-zinc-700'}
                            onClick={() => setFormData({ ...formData, logoType: 'image' })}
                        >
                            Imagem/URL
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="color" className="text-zinc-300">Cor Primária</Label>
                    <div className="flex gap-2">
                        <Input
                            id="color"
                            type="color"
                            value={formData.primaryColor}
                            onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="w-12 h-10 p-1 bg-zinc-800 border-zinc-700"
                        />
                        <Input
                            value={formData.primaryColor}
                            onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="bg-zinc-800 border-zinc-700 text-white font-mono"
                        />
                    </div>
                </div>
              </div>

              {formData.logoType === 'image' && (
                <div className="space-y-2">
                    <Label htmlFor="logoUri" className="text-zinc-300">Logo (URL ou Upload)</Label>
                    <div className="flex gap-2">
                        <Input
                            id="logoUri"
                            placeholder="https://..."
                            value={formData.logoUri}
                            onChange={e => setFormData({ ...formData, logoUri: e.target.value })}
                            className="bg-zinc-800 border-zinc-700 text-white flex-1"
                        />
                        <div className="relative">
                            <input
                                type="file"
                                id="logo-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                                disabled={uploadingLogo}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                onClick={() => document.getElementById('logo-upload')?.click()}
                                disabled={uploadingLogo}
                            >
                                {uploadingLogo ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? 'Salvando...' : 'Salvar Configuração'}
              </Button>
            </DialogFooter>
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
                        <span className="text-zinc-400 text-xs font-mono">{config.primaryColor}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {config.logoType === 'programmatic' ? (
                        <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 flex w-fit gap-1">
                          <Globe className="h-3 w-3" /> App Icon
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-blue-500/50 text-blue-400 flex w-fit gap-1">
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
                            onClick={() => handleTriggerBuild(config.clientId)}
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
                <p className="text-zinc-500 italic">Nenhuma configuração encontrada no banco de dados.</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Users Management Dialog */}
      <Dialog open={isUsersDialogOpen} onOpenChange={(open) => {
        setIsUsersDialogOpen(open);
        if (!open) { setUserSearchFilter(''); setUsersTab('associated'); }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-[800px] max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Gerenciar Usuários — {configs.find(c => c.clientId === usersDialogClientId)?.companyName || usersDialogClientId}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Associe usuários a esta marca. Usuários associados verão o branding deste cliente ao abrir o app.
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
              <Tabs value={usersTab} onValueChange={v => setUsersTab(v as any)} className="flex flex-col min-h-0 flex-1">
                <TabsList className="bg-zinc-800/50 border border-zinc-700/50 shrink-0">
                  <TabsTrigger value="associated" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-zinc-400">
                    <UserMinus className="h-4 w-4 mr-2" />
                    Associados ({brandingUsers.length})
                  </TabsTrigger>
                  <TabsTrigger value="available" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400">
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
                            <TableHead className="text-zinc-400 w-[80px] text-right">Remover</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAssociated.length > 0 ? filteredAssociated.map(user => (
                            <TableRow key={user.id} className="border-zinc-800/50 hover:bg-zinc-800/30">
                              <TableCell className="text-white font-medium">{user.name || 'Sem nome'}</TableCell>
                              <TableCell className="text-zinc-400 text-sm">{user.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${roleBadgeClass(user.role)}`}>
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
                          )) : (
                            <TableRow className="border-zinc-800/50">
                              <TableCell colSpan={4} className="text-center text-zinc-500 py-8 italic">
                                {userSearchFilter ? 'Nenhum usuário associado corresponde à busca' : 'Nenhum usuário associado a esta marca'}
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
                                checked={filteredAvailable.length > 0 && filteredAvailable.every(u => selectedUserIds.includes(u.id))}
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
                          {filteredAvailable.length > 0 ? filteredAvailable.map(user => (
                            <TableRow
                              key={user.id}
                              className={`border-zinc-800/50 cursor-pointer transition-colors ${
                                selectedUserIds.includes(user.id) ? 'bg-blue-900/20 hover:bg-blue-900/30' : 'hover:bg-zinc-800/30'
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
                              <TableCell className="text-white font-medium">{user.name || 'Sem nome'}</TableCell>
                              <TableCell className="text-zinc-400 text-sm">{user.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${roleBadgeClass(user.role)}`}>
                                  {roleLabel(user.role)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {user.clientId ? (
                                  <Badge variant="outline" className="border-zinc-600 text-zinc-400 text-xs">
                                    {user.clientId}
                                  </Badge>
                                ) : (
                                  <span className="text-zinc-600 text-xs">Padrão</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow className="border-zinc-800/50">
                              <TableCell colSpan={5} className="text-center text-zinc-500 py-8 italic">
                                {userSearchFilter ? 'Nenhum usuário disponível corresponde à busca' : 'Todos os usuários já estão associados'}
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
                  <span className="text-blue-400 font-medium">{selectedUserIds.length} selecionado(s)</span>
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
                  <Button
                    onClick={handleAssignUsers}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Associar {selectedUserIds.length} usuário(s)
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Branding;
