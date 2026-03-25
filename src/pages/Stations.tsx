import { useState, useEffect, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { ChargerDetailsDialog } from '../components/ChargerDetailsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../lib/hooks/useSocket';

interface Charger {
  charge_point_id: string;
  model?: string;
  vendor?: string;
  description?: string;
  power_kw?: number;
  num_connectors?: number;
  connector_type?: string;
  locationId: number | null;
  isConnected: boolean;
  status?: string;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
}

export const Stations = () => {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocations, setSelectedLocations] = useState<{ [key: string]: string }>({});
  const [selectedCharger, setSelectedCharger] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState<string | null>(null);
  const { chargerStatuses } = useSocket();

  const [regForm, setRegForm] = useState({
    charge_point_id: '', description: '', model: '', vendor: '',
    connector_type: '', power_kw: '', num_connectors: '1', locationId: '',
  });

  const mergedChargers = useMemo(() => {
    if (chargerStatuses.size === 0) return chargers;
    return chargers.map(c => {
      const s = chargerStatuses.get(c.charge_point_id);
      if (!s) return c;
      return { ...c, isConnected: s.status !== 'Offline' && s.status !== 'Unavailable' };
    });
  }, [chargers, chargerStatuses]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [chRes, locRes] = await Promise.all([api.get('/chargers'), api.get('/locations/all')]);
      if (!chRes.ok || !locRes.ok) throw new Error('Erro ao buscar dados.');
      const chData = await chRes.json();
      const locData = await locRes.json();
      const cl = chData.data || chData;
      const ll = locData.data?.locations || locData.locations || [];
      setChargers(cl);
      setLocations(ll);
      const init: Record<string, string> = {};
      cl.forEach((c: Charger) => { if (!c.locationId && ll.length > 0) init[c.charge_point_id] = ll[0].id.toString(); });
      setSelectedLocations(init);
    } catch { toast.error('Erro ao buscar dados'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void fetchData(); }, []);

  const handleAssignCharger = async (chargerId: string) => {
    const locationId = selectedLocations[chargerId];
    if (!locationId) { toast.error('Selecione um local'); return; }
    try {
      const r = await api.put(`/chargers/${chargerId}/assign-location`, { locationId: parseInt(locationId) });
      if (!r.ok) throw new Error();
      toast.success('Carregador associado!');
      void fetchData();
    } catch { toast.error('Erro ao atribuir'); }
  };

  const handleRegisterCharger = async () => {
    if (!regForm.charge_point_id.trim()) { toast.error('ID obrigatório'); return; }
    setRegistering(true);
    try {
      const p: Record<string, unknown> = { charge_point_id: regForm.charge_point_id.trim() };
      if (regForm.description) p.description = regForm.description;
      if (regForm.model) p.model = regForm.model;
      if (regForm.vendor) p.vendor = regForm.vendor;
      if (regForm.connector_type) p.connector_type = regForm.connector_type;
      if (regForm.power_kw) p.power_kw = parseFloat(regForm.power_kw);
      if (regForm.num_connectors) p.num_connectors = parseInt(regForm.num_connectors);
      if (regForm.locationId) p.locationId = parseInt(regForm.locationId);
      const r = await api.post('/chargers/register', p);
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erro'); }
      toast.success('Carregador registrado!');
      setRegisterOpen(false);
      setRegForm({ charge_point_id: '', description: '', model: '', vendor: '', connector_type: '', power_kw: '', num_connectors: '1', locationId: '' });
      void fetchData();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setRegistering(false); }
  };

  const handleDownloadQrCode = async (chargerId: string) => {
    setDownloadingQr(chargerId);
    try {
      const r = await api.get(`/chargers/${chargerId}/qrcode`);
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `qrcode-${chargerId}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast.success('QR Code baixado!');
    } catch { toast.error('Erro ao gerar QR Code'); }
    finally { setDownloadingQr(null); }
  };

  const getLocationName = (id: number | null) => id ? locations.find(l => l.id === id)?.nomeDoLocal || '—' : '—';
  const pendingChargers = mergedChargers.filter(c => !c.locationId);
  const assignedChargers = mergedChargers.filter(c => c.locationId);
  const onlineCount = mergedChargers.filter(c => c.isConnected).length;

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
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase mb-2">NETWORK HUB</span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Estações de Recarga</h1>
          <p className="text-on-surface-variant mt-2 max-w-lg">Gerencie sua rede em tempo real. Monitore disponibilidade e saúde técnica de todos os carregadores.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => void fetchData()} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-colors font-medium text-sm">
            <span className="material-symbols-outlined text-lg">refresh</span>
            Atualizar
          </button>
          <button onClick={() => setRegisterOpen(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            Nova Estação
          </button>
        </div>
      </div>

      {/* Pending Chargers Alert */}
      {pendingChargers.length > 0 && (
        <div className="bg-surface-container-low rounded-xl border border-error/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center gap-3">
            <span className="material-symbols-outlined text-error">warning</span>
            <h3 className="font-headline font-bold text-on-surface">Carregadores Pendentes</h3>
            <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-0.5 rounded-full">{pendingChargers.length} sem local</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-6 py-3">Charge Point ID</th>
                  <th className="px-6 py-3">Modelo</th>
                  <th className="px-6 py-3">Fabricante</th>
                  <th className="px-6 py-3">Potência</th>
                  <th className="px-6 py-3">Atribuir Local</th>
                  <th className="px-6 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {pendingChargers.map(c => (
                  <tr key={c.charge_point_id} className="hover:bg-surface-container-highest/30 transition-colors">
                    <td className="px-6 py-3">
                      <span className="text-sm font-medium">{c.description || c.charge_point_id}</span>
                      {c.description && <p className="text-[10px] text-on-surface-variant font-mono">{c.charge_point_id}</p>}
                    </td>
                    <td className="px-6 py-3 text-sm">{c.model || '—'}</td>
                    <td className="px-6 py-3 text-sm text-on-surface-variant">{c.vendor || '—'}</td>
                    <td className="px-6 py-3 text-sm">{c.power_kw ? <span className="text-primary font-bold">{c.power_kw} kW</span> : '—'}</td>
                    <td className="px-6 py-3">
                      <Select value={selectedLocations[c.charge_point_id] || ''} onValueChange={v => setSelectedLocations(p => ({ ...p, [c.charge_point_id]: v }))}>
                        <SelectTrigger className="w-[220px] bg-surface-container-low border-outline-variant/20 text-on-surface text-sm">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-container border-outline-variant/20">
                          {locations.map(l => (
                            <SelectItem key={l.id} value={l.id.toString()} className="text-on-surface focus:bg-surface-container-highest">{l.nomeDoLocal}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-3">
                      <button onClick={() => handleAssignCharger(c.charge_point_id)} className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:scale-105 active:scale-95 transition-all">
                        Salvar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Station Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {assignedChargers.map(c => {
          const isOnline = c.isConnected;
          return (
            <div key={c.charge_point_id} className={`group rounded-xl p-6 border transition-all duration-300 relative overflow-hidden ${
              isOnline
                ? 'bg-surface-container-low border-transparent hover:border-primary/20'
                : 'bg-surface-container-low/50 border-transparent hover:border-error/20'
            }`}>
              {isOnline && <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />}

              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-lg bg-surface-container-highest border border-outline-variant/10 ${isOnline ? 'text-primary' : 'text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-2xl">ev_station</span>
                </div>
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isOnline
                    ? 'bg-primary/10 text-primary'
                    : 'bg-error/10 text-error'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-primary animate-pulse' : 'bg-error'}`} />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              <div className={`space-y-1 mb-6 ${!isOnline ? 'opacity-60' : ''}`}>
                <h3 className="font-headline text-lg font-bold text-on-surface truncate">{c.description || c.charge_point_id}</h3>
                <p className="text-xs text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">location_on</span>
                  {getLocationName(c.locationId)}
                </p>
                {c.description && <p className="text-[10px] text-on-surface-variant font-mono">{c.charge_point_id}</p>}
              </div>

              <div className={`grid grid-cols-2 gap-4 mb-6 ${!isOnline ? 'opacity-60' : ''}`}>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Potência</p>
                  <p className={`font-headline font-medium ${isOnline ? 'text-primary' : 'text-on-surface'}`}>{c.power_kw ? `${c.power_kw} kW` : '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Modelo</p>
                  <p className="text-on-surface font-medium">{c.model || '—'}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedCharger(c.charge_point_id); setDetailsOpen(true); }}
                  className={`flex-1 py-2 rounded-lg bg-surface-container-highest text-sm font-bold transition-all ${
                    isOnline ? 'hover:bg-primary hover:text-on-primary' : 'hover:bg-error/20 hover:text-error'
                  }`}
                >
                  Detalhes
                </button>
                <button
                  onClick={() => handleDownloadQrCode(c.charge_point_id)}
                  disabled={downloadingQr === c.charge_point_id}
                  className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-variant transition-all disabled:opacity-30"
                  title="Baixar QR Code"
                >
                  {downloadingQr === c.charge_point_id ? (
                    <div className="w-5 h-5 animate-spin rounded-full border-b-2 border-primary" />
                  ) : (
                    <span className="material-symbols-outlined text-xl">qr_code_2</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* Network Health Bento Box */}
        {assignedChargers.length > 0 && (
          <div className="lg:col-span-2 bg-surface-container rounded-xl p-8 border border-outline-variant/10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <h4 className="font-headline text-2xl font-bold mb-2">Network Health</h4>
              <p className="text-on-surface-variant text-sm mb-8">Visão geral da performance da rede no ciclo atual.</p>
              <div className="flex gap-12 items-end">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">TOTAL ESTAÇÕES</p>
                  <p className="text-5xl font-headline font-bold text-primary tracking-tighter">
                    {mergedChargers.length}
                  </p>
                  <p className="text-secondary text-xs mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    {onlineCount} online agora
                  </p>
                </div>
                <div className="flex-1 h-24 flex items-end gap-1.5 pb-2">
                  {[20, 40, 30, 60, 45, 80, 70].map((h, i) => (
                    <div key={i} className="w-full bg-surface-container-highest rounded-t-sm relative group overflow-hidden" style={{ height: `${h}%` }}>
                      <div className="absolute bottom-0 left-0 w-full bg-primary/40 group-hover:bg-primary transition-all duration-300 h-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-outline-variant/10 flex justify-between items-center relative z-10">
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Online</p>
                  <p className="text-xl font-headline font-bold text-primary">{onlineCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Uptime</p>
                  <p className="text-xl font-headline font-bold">
                    {mergedChargers.length > 0 ? ((onlineCount / mergedChargers.length) * 100).toFixed(1) : '0'}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {assignedChargers.length === 0 && pendingChargers.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline mb-4">ev_station</span>
            <p className="text-on-surface font-headline font-bold text-xl">Nenhuma estação registrada</p>
            <p className="text-on-surface-variant text-sm mt-2">Clique em "Nova Estação" para registrar seu primeiro carregador</p>
          </div>
        )}
      </div>

      {/* Charger Details Dialog */}
      <ChargerDetailsDialog chargePointId={selectedCharger} open={detailsOpen} onOpenChange={setDetailsOpen} onUpdate={fetchData} />

      {/* Register Charger Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="bg-surface-container border-outline-variant/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">ev_station</span>
              Registrar Novo Carregador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-on-surface-variant text-xs uppercase tracking-widest">ID do Carregador *</Label>
              <Input placeholder="Ex: CP001, CHARGER-A1" value={regForm.charge_point_id} onChange={e => setRegForm(f => ({ ...f, charge_point_id: e.target.value }))} className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
              <p className="text-[10px] text-on-surface-variant">Este ID será usado no QR Code e deve corresponder ao ID OCPP</p>
            </div>
            <div className="space-y-2">
              <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Descrição</Label>
              <Input placeholder="Ex: Carregador Estacionamento A" value={regForm.description} onChange={e => setRegForm(f => ({ ...f, description: e.target.value }))} className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Modelo</Label>
                <Input placeholder="Ex: Wallbox Plus" value={regForm.model} onChange={e => setRegForm(f => ({ ...f, model: e.target.value }))} className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Fabricante</Label>
                <Input placeholder="Ex: ABB" value={regForm.vendor} onChange={e => setRegForm(f => ({ ...f, vendor: e.target.value }))} className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Potência (kW)</Label>
                <Input type="number" placeholder="22" value={regForm.power_kw} onChange={e => setRegForm(f => ({ ...f, power_kw: e.target.value }))} className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Conectores</Label>
                <Input type="number" min="1" value={regForm.num_connectors} onChange={e => setRegForm(f => ({ ...f, num_connectors: e.target.value }))} className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Tipo Conector</Label>
                <Select value={regForm.connector_type} onValueChange={v => setRegForm(f => ({ ...f, connector_type: v }))}>
                  <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent className="bg-surface-container border-outline-variant/20">
                    {['Type1', 'Type2', 'CCS1', 'CCS2', 'CHAdeMO', 'GBT'].map(t => (
                      <SelectItem key={t} value={t} className="text-on-surface focus:bg-surface-container-highest">{t === 'GBT' ? 'GB/T' : t.replace('Type', 'Type ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Local (opcional)</Label>
              <Select value={regForm.locationId} onValueChange={v => setRegForm(f => ({ ...f, locationId: v }))}>
                <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface"><SelectValue placeholder="Selecione um local" /></SelectTrigger>
                <SelectContent className="bg-surface-container border-outline-variant/20">
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id.toString()} className="text-on-surface focus:bg-surface-container-highest">{l.nomeDoLocal}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setRegisterOpen(false)} className="border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest rounded-full px-6">
                Cancelar
              </Button>
              <button
                onClick={handleRegisterCharger}
                disabled={registering || !regForm.charge_point_id.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                {registering && <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-on-primary" />}
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
                Registrar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
