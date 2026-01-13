import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  EnhancedTable,
  EnhancedTableHeader,
  EnhancedTableBody,
  EnhancedTableRow,
  EnhancedTableHead,
  EnhancedTableCell,
} from '../components/EnhancedTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Switch } from '../components/ui/switch';
import { StatusBadge } from '../components/StatusBadge';
import { Plus, Edit, Trash2, ArrowLeft, Ticket, MapPin, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

interface Voucher {
  id?: number;
  code: string;
  name: string;
  description?: string;
  type: 'percent' | 'fixed' | 'kwh';
  value: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  total_quantity?: number | null;
  used_quantity?: number;
  location_id?: number | null;
  charger_id?: string | null;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  address: string;
}

interface Charger {
  chargerId: string;
  model?: string;
  locationAddress?: string;
}

export const Vouchers = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [deleteVoucherId, setDeleteVoucherId] = useState<number | null>(null);

  useEffect(() => {
    void fetchVouchers();
    void fetchLocations();
    void fetchChargers();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    }
  };

  const fetchChargers = async () => {
    try {
      const response = await api.get('/chargers');
      if (response.ok) {
        const data = await response.json();
        setChargers(data);
      }
    } catch (error) {
      console.error('Erro ao buscar carregadores:', error);
    }
  };

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/vouchers');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setVouchers(data);
    } catch (error) {
      console.error('Erro ao buscar vouchers:', error);
      toast.error('Erro ao buscar vouchers');
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingVoucher({
      code: '',
      name: '',
      description: '',
      type: 'percent',
      value: 0,
      is_active: true,
      start_date: '',
      end_date: '',
      total_quantity: null,
      location_id: null,
      charger_id: null,
    });
    setIsEditing(true);
  };

  const handleEdit = (voucher: Voucher) => {
    // Format dates to yyyy-MM-dd for input[type=date]
    const formatDate = (dateString?: string) =>
      dateString ? new Date(dateString).toISOString().split('T')[0] : '';

    setEditingVoucher({
      ...voucher,
      start_date: formatDate(voucher.start_date),
      end_date: formatDate(voucher.end_date),
    });
    setIsEditing(true);
  };

  const handleDeleteClick = (voucherId: number) => {
    setDeleteVoucherId(voucherId);
  };

  const confirmDelete = async () => {
    if (!deleteVoucherId) return;

    try {
      const response = await api.delete(`/vouchers/${deleteVoucherId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao excluir voucher.');
      }
      toast.success('Voucher excluído com sucesso!');
      void fetchVouchers();
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setDeleteVoucherId(null);
    }
  };

  const handleSave = async () => {
    if (!editingVoucher) return;

    const method = editingVoucher.id ? api.put : api.post;
    const endpoint = editingVoucher.id ? `/vouchers/${editingVoucher.id}` : '/vouchers';

    try {
      const response = await method(endpoint, {
        ...editingVoucher,
        total_quantity: editingVoucher.total_quantity || null,
        start_date: editingVoucher.start_date || null,
        end_date: editingVoucher.end_date || null,
        location_id: editingVoucher.location_id || null,
        charger_id: editingVoucher.charger_id || null,
      });

      if (!response.ok) {
        throw new Error(`Falha ao ${editingVoucher.id ? 'atualizar' : 'criar'} voucher.`);
      }

      toast.success(`Voucher ${editingVoucher.id ? 'atualizado' : 'criado'} com sucesso!`);
      setIsEditing(false);
      setEditingVoucher(null);
      void fetchVouchers();
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingVoucher(null);
  };

  if (loading && !isEditing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-emerald-400">Carregando vouchers...</div>
      </div>
    );
  }

  if (isEditing && editingVoucher) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleCancel}
            variant="ghost"
            className="text-emerald-300 hover:text-emerald-100 hover:bg-emerald-900/30"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        <div>
          <h1 className="text-emerald-50">
            {editingVoucher.id ? 'Editar Voucher' : 'Criar Voucher'}
          </h1>
          <p className="text-emerald-300/60 mt-1">Preencha os dados do voucher</p>
        </div>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-emerald-200">
                  Código do Voucher
                </Label>
                <Input
                  id="code"
                  value={editingVoucher.code}
                  onChange={e => setEditingVoucher({ ...editingVoucher, code: e.target.value })}
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600"
                  placeholder="CODIGO123"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-emerald-200">
                  Nome do Voucher
                </Label>
                <Input
                  id="name"
                  value={editingVoucher.name}
                  onChange={e => setEditingVoucher({ ...editingVoucher, name: e.target.value })}
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600"
                  placeholder="Nome descritivo"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description" className="text-emerald-200">
                  Descrição
                </Label>
                <Textarea
                  id="description"
                  value={editingVoucher.description || ''}
                  onChange={e =>
                    setEditingVoucher({ ...editingVoucher, description: e.target.value })
                  }
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600"
                  placeholder="Descrição do voucher"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type" className="text-emerald-200">
                  Tipo de Desconto
                </Label>
                <Select
                  value={editingVoucher.type}
                  onValueChange={(value: 'percent' | 'fixed' | 'kwh') =>
                    setEditingVoucher({ ...editingVoucher, type: value })
                  }
                >
                  <SelectTrigger className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-emerald-900 border-emerald-700">
                    <SelectItem
                      value="percent"
                      className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                    >
                      Percentagem (%)
                    </SelectItem>
                    <SelectItem
                      value="fixed"
                      className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                    >
                      Reais (R$)
                    </SelectItem>
                    <SelectItem
                      value="kwh"
                      className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                    >
                      Quilowatt-hora (kWh)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="value" className="text-emerald-200">
                  Valor
                </Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={editingVoucher.value}
                  onChange={e =>
                    setEditingVoucher({ ...editingVoucher, value: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date" className="text-emerald-200">
                  Data de Início
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={editingVoucher.start_date || ''}
                  onChange={e =>
                    setEditingVoucher({ ...editingVoucher, start_date: e.target.value })
                  }
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date" className="text-emerald-200">
                  Válido Até
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={editingVoucher.end_date || ''}
                  onChange={e => setEditingVoucher({ ...editingVoucher, end_date: e.target.value })}
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_quantity" className="text-emerald-200">
                  Quantidade Total (deixe em branco para ilimitado)
                </Label>
                <Input
                  id="total_quantity"
                  type="number"
                  value={editingVoucher.total_quantity || ''}
                  onChange={e =>
                    setEditingVoucher({
                      ...editingVoucher,
                      total_quantity: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600"
                  placeholder="Ilimitado"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_id" className="text-emerald-200">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    Restringir a Local (opcional)
                  </div>
                </Label>
                <Select
                  value={editingVoucher.location_id?.toString() || 'none'}
                  onValueChange={(value) =>
                    setEditingVoucher({
                      ...editingVoucher,
                      location_id: value === 'none' ? null : parseInt(value),
                      charger_id: value === 'none' ? editingVoucher.charger_id : null, // Limpa carregador se selecionar local
                    })
                  }
                >
                  <SelectTrigger className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600">
                    <SelectValue placeholder="Todos os locais" />
                  </SelectTrigger>
                  <SelectContent className="bg-emerald-900 border-emerald-700">
                    <SelectItem
                      value="none"
                      className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                    >
                      Todos os locais
                    </SelectItem>
                    {locations.map((location) => (
                      <SelectItem
                        key={location.id}
                        value={location.id.toString()}
                        className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                      >
                        {location.nomeDoLocal} - {location.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-emerald-300/50">
                  Se selecionado, o voucher só pode ser usado neste local
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="charger_id" className="text-emerald-200">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    Restringir a Carregador (opcional)
                  </div>
                </Label>
                <Select
                  value={editingVoucher.charger_id || 'none'}
                  onValueChange={(value) =>
                    setEditingVoucher({
                      ...editingVoucher,
                      charger_id: value === 'none' ? null : value,
                      location_id: value === 'none' ? editingVoucher.location_id : null, // Limpa local se selecionar carregador
                    })
                  }
                >
                  <SelectTrigger className="bg-emerald-900/40 border-emerald-700/50 text-emerald-50 focus:border-emerald-600">
                    <SelectValue placeholder="Todos os carregadores" />
                  </SelectTrigger>
                  <SelectContent className="bg-emerald-900 border-emerald-700">
                    <SelectItem
                      value="none"
                      className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                    >
                      Todos os carregadores
                    </SelectItem>
                    {chargers.map((charger) => (
                      <SelectItem
                        key={charger.chargerId}
                        value={charger.chargerId}
                        className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                      >
                        {charger.chargerId} {charger.model ? `(${charger.model})` : ''} {charger.locationAddress ? `- ${charger.locationAddress}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-emerald-300/50">
                  Se selecionado, o voucher só pode ser usado neste carregador específico
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="is_active" className="text-emerald-200">
                  Ativar Voucher
                </Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Switch
                    id="is_active"
                    checked={editingVoucher.is_active}
                    onCheckedChange={checked =>
                      setEditingVoucher({ ...editingVoucher, is_active: checked })
                    }
                    className="data-[state=checked]:bg-emerald-600"
                  />
                  <Label htmlFor="is_active" className="text-emerald-300/70 cursor-pointer">
                    {editingVoucher.is_active ? 'Ativo' : 'Inativo'}
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="bg-emerald-900/40 border-emerald-700/50 text-emerald-100 hover:bg-emerald-800/50"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30"
              >
                Salvar Voucher
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-emerald-50">Vouchers</h1>
          <p className="text-emerald-300/60 mt-1">Gerenciamento de cupons e descontos</p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Voucher
        </Button>
      </div>

      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
        <CardHeader>
          <CardTitle className="text-emerald-50 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-emerald-400" />
            Lista de Vouchers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Ticket className="w-16 h-16 text-emerald-500/30 mb-4" />
              <p className="text-xl text-emerald-300 font-semibold">Nenhum voucher criado</p>
              <p className="text-base text-emerald-400/60 mt-2">Clique em "Novo Voucher" para criar cupons de desconto</p>
            </div>
          ) : (
          <EnhancedTable>
            <EnhancedTableHeader>
              <EnhancedTableRow>
                <EnhancedTableHead>Código</EnhancedTableHead>
                <EnhancedTableHead>Nome</EnhancedTableHead>
                <EnhancedTableHead>Tipo</EnhancedTableHead>
                <EnhancedTableHead>Valor</EnhancedTableHead>
                <EnhancedTableHead>Restrição</EnhancedTableHead>
                <EnhancedTableHead>Validade</EnhancedTableHead>
                <EnhancedTableHead>Uso</EnhancedTableHead>
                <EnhancedTableHead>Status</EnhancedTableHead>
                <EnhancedTableHead>Ações</EnhancedTableHead>
              </EnhancedTableRow>
            </EnhancedTableHeader>
            <EnhancedTableBody>
              {vouchers.map((voucher, index) => {
                const typeLabels = {
                  percent: '%',
                  fixed: 'R$',
                  kwh: 'kWh',
                };

                return (
                  <EnhancedTableRow key={voucher.id} index={index}>
                    <EnhancedTableCell className="font-mono">
                      <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        {voucher.code}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell className="font-medium">{voucher.name}</EnhancedTableCell>
                    <EnhancedTableCell>
                      <span className="capitalize inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/30">
                        {voucher.type === 'percent' && '%'}
                        {voucher.type === 'fixed' && 'R$'}
                        {voucher.type === 'kwh' && 'kWh'}
                        <span className="text-xs opacity-75">{voucher.type}</span>
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell highlight>
                      <span className="text-lg font-semibold">
                        {voucher.value} {typeLabels[voucher.type]}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      {voucher.location_id || voucher.charger_id ? (
                        <div className="flex items-center gap-2">
                          {voucher.location_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs">
                              <MapPin className="w-3 h-3" />
                              {locations.find(l => l.id === voucher.location_id)?.nomeDoLocal || `Local #${voucher.location_id}`}
                            </span>
                          )}
                          {voucher.charger_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 text-xs">
                              <Zap className="w-3 h-3" />
                              {voucher.charger_id}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-emerald-300/50 text-sm">Sem restrição</span>
                      )}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-emerald-300/70">
                          De:{' '}
                          {voucher.start_date
                            ? new Date(voucher.start_date).toLocaleDateString('pt-BR')
                            : 'N/A'}
                        </span>
                        <span className="text-emerald-300/70">
                          Até:{' '}
                          {voucher.end_date
                            ? new Date(voucher.end_date).toLocaleDateString('pt-BR')
                            : 'N/A'}
                        </span>
                      </div>
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-emerald-950/50 rounded-full h-2 overflow-hidden border border-emerald-700/30">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                            style={{
                              width: `${voucher.total_quantity ? ((voucher.used_quantity || 0) / voucher.total_quantity) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">
                          {voucher.used_quantity || 0}/{voucher.total_quantity || '∞'}
                        </span>
                      </div>
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <StatusBadge status={voucher.is_active ? 'active' : 'inactive'} />
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleEdit(voucher);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 border border-transparent hover:border-emerald-500/30"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            if (voucher.id) handleDeleteClick(voucher.id);
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 border border-transparent hover:border-red-500/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </EnhancedTableCell>
                  </EnhancedTableRow>
                );
              })}
            </EnhancedTableBody>
          </EnhancedTable>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog - substitui window.confirm() */}
      <AlertDialog
        open={deleteVoucherId !== null}
        onOpenChange={open => !open && setDeleteVoucherId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este voucher? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
