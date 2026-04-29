import { useState, useEffect } from 'react';
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
  endereco: string;
}

interface Charger {
  chargerId: string;
  model?: string;
  locationAddress?: string;
}

/**
 * Returns the effective status of a voucher considering both is_active flag and end_date expiration.
 */
function getVoucherStatus(voucher: Voucher): 'active' | 'expired' | 'inactive' {
  if (!voucher.is_active) return 'inactive';
  if (voucher.end_date) {
    const endDate = new Date(voucher.end_date);
    // Set end of day for the end_date so it's valid through the entire last day
    endDate.setHours(23, 59, 59, 999);
    if (endDate < new Date()) return 'expired';
  }
  return 'active';
}

export const Vouchers = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [deleteVoucherId, setDeleteVoucherId] = useState<number | null>(null);

  // Filters
  const [filterCode, setFilterCode] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');

  useEffect(() => {
    void fetchVouchers();
    void fetchLocations();
    void fetchChargers();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/locations/all');
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isEditing && editingVoucher) {
    return (
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-colors font-medium text-sm text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Voltar
          </button>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-1">
            {editingVoucher.id ? 'EDITAR' : 'CRIAR'} VOUCHER
          </span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">
            {editingVoucher.id ? 'Editar Voucher' : 'Novo Voucher'}
          </h1>
          <p className="text-on-surface-variant mt-1">Preencha os dados do voucher</p>
        </div>

        <div className="glass-panel rounded-xl border border-outline-variant/10 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-on-surface-variant text-xs uppercase tracking-widest">
                Código do Voucher
              </Label>
              <Input
                id="code"
                value={editingVoucher.code}
                onChange={e => setEditingVoucher({ ...editingVoucher, code: e.target.value })}
                className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                placeholder="CODIGO123"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-on-surface-variant text-xs uppercase tracking-widest">
                Nome do Voucher
              </Label>
              <Input
                id="name"
                value={editingVoucher.name}
                onChange={e => setEditingVoucher({ ...editingVoucher, name: e.target.value })}
                className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                placeholder="Nome descritivo"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description" className="text-on-surface-variant text-xs uppercase tracking-widest">
                Descrição
              </Label>
              <Textarea
                id="description"
                value={editingVoucher.description || ''}
                onChange={e =>
                  setEditingVoucher({ ...editingVoucher, description: e.target.value })
                }
                className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                placeholder="Descrição do voucher"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-on-surface-variant text-xs uppercase tracking-widest">
                Tipo de Desconto
              </Label>
              <Select
                value={editingVoucher.type}
                onValueChange={(value: 'percent' | 'fixed' | 'kwh') =>
                  setEditingVoucher({ ...editingVoucher, type: value })
                }
              >
                <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-container border-outline-variant/20">
                  <SelectItem value="percent" className="text-on-surface focus:bg-surface-container-highest">
                    Percentagem (%)
                  </SelectItem>
                  <SelectItem value="fixed" className="text-on-surface focus:bg-surface-container-highest">
                    Reais (R$)
                  </SelectItem>
                  <SelectItem value="kwh" className="text-on-surface focus:bg-surface-container-highest">
                    Quilowatt-hora (kWh)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value" className="text-on-surface-variant text-xs uppercase tracking-widest">
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
                className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date" className="text-on-surface-variant text-xs uppercase tracking-widest">
                Data de Início
              </Label>
              <Input
                id="start_date"
                type="date"
                value={editingVoucher.start_date || ''}
                onChange={e =>
                  setEditingVoucher({ ...editingVoucher, start_date: e.target.value })
                }
                className="bg-surface-container-low border-outline-variant/20 text-on-surface"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date" className="text-on-surface-variant text-xs uppercase tracking-widest">
                Válido Até
              </Label>
              <Input
                id="end_date"
                type="date"
                value={editingVoucher.end_date || ''}
                onChange={e => setEditingVoucher({ ...editingVoucher, end_date: e.target.value })}
                className="bg-surface-container-low border-outline-variant/20 text-on-surface"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_quantity" className="text-on-surface-variant text-xs uppercase tracking-widest">
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
                className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                placeholder="Ilimitado"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_id" className="text-on-surface-variant text-xs uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                  Restringir a Local (opcional)
                </div>
              </Label>
              <Select
                value={editingVoucher.location_id?.toString() || 'none'}
                onValueChange={(value) =>
                  setEditingVoucher({
                    ...editingVoucher,
                    location_id: value === 'none' ? null : parseInt(value),
                    charger_id: value === 'none' ? editingVoucher.charger_id : null,
                  })
                }
              >
                <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                  <SelectValue placeholder="Todos os locais" />
                </SelectTrigger>
                <SelectContent className="bg-surface-container border-outline-variant/20">
                  <SelectItem value="none" className="text-on-surface focus:bg-surface-container-highest">
                    Todos os locais
                  </SelectItem>
                  {locations.map((location) => (
                    <SelectItem
                      key={location.id}
                      value={location.id.toString()}
                      className="text-on-surface focus:bg-surface-container-highest"
                    >
                      {location.nomeDoLocal} - {location.endereco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-on-surface-variant">
                Se selecionado, o voucher só pode ser usado neste local
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="charger_id" className="text-on-surface-variant text-xs uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-primary">ev_station</span>
                  Restringir a Carregador (opcional)
                </div>
              </Label>
              <Select
                value={editingVoucher.charger_id || 'none'}
                onValueChange={(value) =>
                  setEditingVoucher({
                    ...editingVoucher,
                    charger_id: value === 'none' ? null : value,
                    location_id: value === 'none' ? editingVoucher.location_id : null,
                  })
                }
              >
                <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                  <SelectValue placeholder="Todos os carregadores" />
                </SelectTrigger>
                <SelectContent className="bg-surface-container border-outline-variant/20">
                  <SelectItem value="none" className="text-on-surface focus:bg-surface-container-highest">
                    Todos os carregadores
                  </SelectItem>
                  {chargers.map((charger) => (
                    <SelectItem
                      key={charger.chargerId}
                      value={charger.chargerId}
                      className="text-on-surface focus:bg-surface-container-highest"
                    >
                      {charger.chargerId} {charger.model ? `(${charger.model})` : ''} {charger.locationAddress ? `- ${charger.locationAddress}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-on-surface-variant">
                Se selecionado, o voucher só pode ser usado neste carregador específico
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active" className="text-on-surface-variant text-xs uppercase tracking-widest">
                Ativar Voucher
              </Label>
              <div className="flex items-center space-x-2 mt-2">
                <Switch
                  id="is_active"
                  checked={editingVoucher.is_active}
                  onCheckedChange={checked =>
                    setEditingVoucher({ ...editingVoucher, is_active: checked })
                  }
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="is_active" className="text-on-surface-variant cursor-pointer">
                  {editingVoucher.is_active ? 'Ativo' : 'Inativo'}
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-outline-variant/10">
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 rounded-full border border-outline-variant/20 text-on-surface-variant font-medium text-sm hover:bg-surface-container-high transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Salvar Voucher
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredVouchers = vouchers.filter(v => {
    const matchesCode = v.code.toLowerCase().includes(filterCode.toLowerCase()) || v.name.toLowerCase().includes(filterCode.toLowerCase());
    const status = getVoucherStatus(v);
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
          ? status === 'active'
          : status !== 'active'; // 'inactive' filter shows both inactive and expired
    const matchesLocation = filterLocation === 'all' ? true : v.location_id?.toString() === filterLocation;
    return matchesCode && matchesStatus && matchesLocation;
  });

  const activeCount = vouchers.filter(v => getVoucherStatus(v) === 'active').length;
  const inactiveCount = vouchers.filter(v => getVoucherStatus(v) !== 'active').length;
  const totalUsed = vouchers.reduce((s, v) => s + (v.used_quantity || 0), 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-1">PROMOTIONS</span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Vouchers</h1>
          <p className="text-on-surface-variant mt-1">Gerenciamento de cupons e descontos</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void fetchVouchers()} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-colors font-medium text-sm">
            <span className="material-symbols-outlined text-lg">refresh</span>
            Atualizar
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            Novo Voucher
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard icon="confirmation_number" label="TOTAL VOUCHERS" value={String(vouchers.length)} />
        <SummaryCard icon="check_circle" label="ATIVOS" value={String(activeCount)} color="text-primary" />
        <SummaryCard icon="cancel" label="INATIVOS" value={String(inactiveCount)} color="text-on-surface-variant" />
        <SummaryCard icon="sell" label="TOTAL UTILIZADOS" value={String(totalUsed)} color="text-tertiary" />
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-lg border border-outline-variant/10 p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <Input
            type="text"
            placeholder="Buscar por código ou nome..."
            value={filterCode}
            onChange={e => setFilterCode(e.target.value)}
            className="pl-10 bg-surface-container-low border-outline-variant/20 text-on-surface"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-[180px] bg-surface-container-low border-outline-variant/20 text-on-surface">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-surface-container border-outline-variant/20">
            <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">Todos os Status</SelectItem>
            <SelectItem value="active" className="text-on-surface focus:bg-surface-container-highest">Ativos</SelectItem>
            <SelectItem value="inactive" className="text-on-surface focus:bg-surface-container-highest">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-full md:w-[200px] bg-surface-container-low border-outline-variant/20 text-on-surface">
            <SelectValue placeholder="Local" />
          </SelectTrigger>
          <SelectContent className="bg-surface-container border-outline-variant/20">
            <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">Todos os Locais</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id.toString()} className="text-on-surface focus:bg-surface-container-highest">
                {loc.nomeDoLocal}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vouchers Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">confirmation_number</span>
            Lista de Vouchers
          </h3>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{filteredVouchers.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          {filteredVouchers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">confirmation_number</span>
              <p className="text-sm font-semibold text-on-surface">{vouchers.length === 0 ? 'Nenhum voucher criado' : 'Nenhum voucher encontrado'}</p>
              <p className="text-xs text-on-surface-variant mt-1">{vouchers.length === 0 ? 'Clique em "Novo Voucher" para criar cupons de desconto' : 'Altere os filtros de busca acima'}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Restrição</th>
                  <th className="px-6 py-4">Validade</th>
                  <th className="px-6 py-4">Uso</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filteredVouchers.map((voucher) => {
                  const typeLabels = {
                    percent: '%',
                    fixed: 'R$',
                    kwh: 'kWh',
                  };

                  const usagePct = voucher.total_quantity
                    ? ((voucher.used_quantity || 0) / voucher.total_quantity) * 100
                    : 0;

                  return (
                    <tr key={voucher.id} className="hover:bg-surface-container-highest/30 transition-colors group">
                      {/* Code */}
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold">
                          {voucher.code}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-on-surface">{voucher.name}</span>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface border border-outline-variant/10 text-[10px] font-bold">
                          {voucher.type === 'percent' && '%'}
                          {voucher.type === 'fixed' && 'R$'}
                          {voucher.type === 'kwh' && 'kWh'}
                          <span className="text-on-surface-variant">{voucher.type}</span>
                        </span>
                      </td>

                      {/* Value */}
                      <td className="px-6 py-4">
                        <span className="text-lg font-headline font-bold text-on-surface">
                          {voucher.value} <span className="text-xs font-normal text-on-surface-variant">{typeLabels[voucher.type]}</span>
                        </span>
                      </td>

                      {/* Restriction */}
                      <td className="px-6 py-4">
                        {voucher.location_id || voucher.charger_id ? (
                          <div className="flex items-center gap-2">
                            {voucher.location_id && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-xs">location_on</span>
                                {locations.find(l => l.id === voucher.location_id)?.nomeDoLocal || `Local #${voucher.location_id}`}
                              </span>
                            )}
                            {voucher.charger_id && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-xs">ev_station</span>
                                {voucher.charger_id}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-on-surface-variant text-xs">Sem restrição</span>
                        )}
                      </td>

                      {/* Validity */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-on-surface-variant">
                            De:{' '}
                            {voucher.start_date
                              ? new Date(voucher.start_date).toLocaleDateString('pt-BR')
                              : 'N/A'}
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            Até:{' '}
                            {voucher.end_date
                              ? new Date(voucher.end_date).toLocaleDateString('pt-BR')
                              : 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Usage */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 bg-surface-container-highest h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full shadow-[0_0_8px_var(--primary)]"
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-on-surface whitespace-nowrap">
                            {voucher.used_quantity || 0}/{voucher.total_quantity || '\u221E'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {(() => {
                          const status = getVoucherStatus(voucher);
                          if (status === 'active') {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-primary/10 text-primary border-primary/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                Ativo
                              </span>
                            );
                          }
                          if (status === 'expired') {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-amber-500/10 text-amber-500 border-amber-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Expirado
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-outline/10 text-on-surface-variant border-outline/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                              Inativo
                            </span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleEdit(voucher);
                            }}
                            className="w-8 h-8 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (voucher.id) handleDeleteClick(voucher.id);
                            }}
                            className="w-8 h-8 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface-variant flex items-center justify-center hover:bg-error/10 hover:text-error hover:border-error/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteVoucherId !== null}
        onOpenChange={open => !open && setDeleteVoucherId(null)}
      >
        <AlertDialogContent className="bg-surface-container border-outline-variant/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-on-surface font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-error">warning</span>
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant">
              Tem certeza que deseja excluir este voucher? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-outline-variant/20 text-on-surface-variant rounded-full px-6">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-error hover:bg-error/90 text-on-error rounded-full px-6 font-bold">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
