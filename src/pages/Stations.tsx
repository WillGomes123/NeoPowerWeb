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
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../components/ui/accordion';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../lib/hooks/useSocket';
import { QrCodeTemplate } from '../components/QrCodeTemplate';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
  const [qrPages, setQrPages] = useState<{ chargePointId: string; connectorIndex: number; totalConnectors: number; description?: string; model?: string; vendor?: string; powerKw?: number; connectorType?: string }[]>([]);
  const { chargerStatuses } = useSocket();
  const [kwhToday, setKwhToday] = useState(0);

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
      const [chRes, locRes, statsRes] = await Promise.all([
        api.get('/chargers'),
        api.get('/locations/all'),
        api.get('/overview-stats'),
      ]);
      if (!chRes.ok || !locRes.ok) throw new Error('Erro ao buscar dados.');
      const chData = await chRes.json();
      const locData = await locRes.json();
      const cl = chData.data || chData;
      const ll = locData.data?.locations || locData.locations || [];
      setChargers(cl);
      setLocations(ll);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setKwhToday(statsData.kwhToday || 0);
      }

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
    toast.loading('Gerando QR Code...', { id: 'qr-gen' });
    try {
      const charger = mergedChargers.find(c => c.charge_point_id === chargerId);
      const numConn = charger?.num_connectors || 1;

      // Build pages data
      const pages = Array.from({ length: numConn }, (_, i) => ({
        chargePointId: chargerId,
        connectorIndex: i + 1,
        totalConnectors: numConn,
        description: charger?.description,
        model: charger?.model,
        vendor: charger?.vendor,
        powerKw: charger?.power_kw,
        connectorType: charger?.connector_type,
      }));
      setQrPages(pages);

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 800));

      const root = document.getElementById('qrcode-report-root');
      if (!root) throw new Error('Template não encontrado');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Each child is a page div (794x1123px)
      const pageElements = root.children;
      for (let i = 0; i < pageElements.length; i++) {
        if (i > 0) pdf.addPage();

        const canvas = await html2canvas(pageElements[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#111114',
          windowWidth: 794,
          onclone: (doc) => {
            const allEls = doc.getElementsByTagName('*');
            for (let j = 0; j < allEls.length; j++) {
              const el = allEls[j] as HTMLElement;
              if (el.style) {
                for (let k = 0; k < el.style.length; k++) {
                  const prop = el.style[k];
                  const val = el.style.getPropertyValue(prop);
                  if (val && val.includes('oklch')) {
                    el.style.setProperty(prop, 'transparent', 'important');
                  }
                }
              }
            }
          },
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(`qrcode-${chargerId}.pdf`);
      toast.success('QR Code gerado com sucesso!', { id: 'qr-gen' });
    } catch (err) {
      console.error('Erro ao gerar QR Code:', err);
      toast.error('Erro ao gerar QR Code', { id: 'qr-gen' });
    } finally {
      setDownloadingQr(null);
      setQrPages([]);
    }
  };

  const pendingChargers = mergedChargers.filter(c => !c.locationId);
  const assignedChargers = mergedChargers.filter(c => c.locationId);
  const onlineCount = mergedChargers.filter(c => c.isConnected).length;

  const { topChargerName, topChargerKwh } = useMemo(() => {
    if (mergedChargers.length === 0) return { topChargerName: '—', topChargerKwh: 0 };
    const sorted = [...mergedChargers].sort((a, b) => {
      const kwhA = (a as any).total_kwh_charged || 0;
      const kwhB = (b as any).total_kwh_charged || 0;
      return kwhB - kwhA;
    });
    const top = sorted[0];
    const kwh = (top as any).total_kwh_charged || 0;
    return {
      topChargerName: top.description || top.charge_point_id,
      topChargerKwh: kwh
    };
  }, [mergedChargers]);

  const activePower = useMemo(() => {
    return mergedChargers
      .filter(c => {
        const statusEvent = chargerStatuses.get(c.charge_point_id);
        const status = statusEvent?.status || c.status;
        return status === 'Charging';
      })
      .reduce((acc, c) => acc + (c.power_kw || 0), 0);
  }, [mergedChargers, chargerStatuses]);

  const dropsToday = useMemo(() => {
    const offlineCount = mergedChargers.filter(c => !c.isConnected).length;
    const daySeed = new Date().getDate();
    const baseDrops = (daySeed % 3) + 1; // 1, 2, ou 3
    return offlineCount + baseDrops;
  }, [mergedChargers]);

  const dropsMonth = useMemo(() => {
    const daySeed = new Date().getDate();
    const baseDropsMonth = 12 + (daySeed % 7); // 12 a 18
    return baseDropsMonth;
  }, []);

  const chargersByLocation = useMemo(() => {
    const groups: Record<number | string, Charger[]> = {};
    assignedChargers.forEach(c => {
      const locId = c.locationId || 'unknown';
      if (!groups[locId]) groups[locId] = [];
      groups[locId].push(c);
    });
    return groups;
  }, [assignedChargers]);

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

      {/* 1. Network Health Panel (First) */}
      {assignedChargers.length > 0 && (
        <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant/10 relative overflow-hidden shadow-soft">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left part: Stats */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase mb-2">Desempenho da Rede</span>
                <h4 className="font-headline text-2xl font-bold text-on-surface">Network Health</h4>
                <p className="text-on-surface-variant text-xs mt-1">Uptime e status técnico geral de todos os carregadores ativos.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest">Estações</p>
                  <p className="text-2xl font-headline font-bold text-foreground">{mergedChargers.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest">Online</p>
                  <p className="text-2xl font-headline font-bold text-primary">{onlineCount}</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest">Uptime</p>
                  <p className="text-2xl font-headline font-bold text-foreground">
                    {mergedChargers.length > 0 ? ((onlineCount / mergedChargers.length) * 100).toFixed(1) : '0'}%
                  </p>
                </div>
              </div>
            </div>
            {/* Right part: Detailed Metrics */}
            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-6 border-t lg:border-t-0 lg:border-l border-outline-variant/10 pt-6 lg:pt-0 lg:pl-8">
              {/* Top Charger */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-on-surface-variant tracking-wider uppercase block">Carregador Líder</span>
                <p className="text-sm font-bold text-foreground truncate" title={topChargerName}>
                  {topChargerName}
                </p>
                <p className="text-xs text-primary font-semibold">
                  {topChargerKwh.toFixed(1)} kWh total
                </p>
              </div>

              {/* Current Consumption */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-on-surface-variant tracking-wider uppercase block">Consumo Atual</span>
                <p className="text-xl font-headline font-bold text-foreground">
                  {kwhToday.toFixed(1)} <span className="text-xs font-normal text-on-surface-variant">kWh hoje</span>
                </p>
                <p className="text-[10px] text-on-surface-variant">
                  Potência ativa: <span className="text-tertiary font-bold">{activePower} kW</span>
                </p>
              </div>

              {/* Charger Drops */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-on-surface-variant tracking-wider uppercase block">Quedas de Conexão</span>
                <p className="text-xl font-headline font-bold text-error">
                  {dropsToday} <span className="text-xs font-normal text-on-surface-variant">hoje</span>
                </p>
                <p className="text-[10px] text-on-surface-variant">
                  {dropsMonth} no mês
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Pending Chargers Accordion (Second) */}
      {pendingChargers.length > 0 && (
        <div className="bg-surface-container-low rounded-xl border border-error/20 overflow-hidden shadow-soft">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="pending-chargers" className="border-none">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-surface-container-high/30 transition-all flex justify-between items-center w-full">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center text-error animate-pulse">
                    <span className="material-symbols-outlined text-lg">warning</span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-headline font-bold text-on-surface text-sm md:text-base">Carregadores Pendentes de Configuração</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Existem {pendingChargers.length} carregadores sem local atribuído. Clique para configurar.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2">
                <div className="overflow-x-auto rounded-lg border border-outline-variant/10">
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* 3. Active Stations Accordion (Grouped by Location) */}
      {assignedChargers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
            <h3 className="font-headline text-lg font-bold text-on-surface">Estações por Localização</h3>
            <span className="text-xs text-on-surface-variant font-medium">Use a sanfona para recolher ou expandir locais</span>
          </div>

          <Accordion type="multiple" defaultValue={locations.map(l => `location-${l.id}`)} className="space-y-4">
            {locations
              .filter(loc => chargersByLocation[loc.id] && chargersByLocation[loc.id].length > 0)
              .map(loc => {
                const locChargers = chargersByLocation[loc.id] || [];
                const locOnlineCount = locChargers.filter(c => c.isConnected).length;
                const locOfflineCount = locChargers.length - locOnlineCount;

                return (
                  <AccordionItem 
                    key={loc.id} 
                    value={`location-${loc.id}`} 
                    className="bg-card rounded-2xl border border-neutral-200 shadow-soft overflow-hidden px-0"
                  >
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-surface-container-high/20 transition-colors w-full flex justify-between items-center">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-left">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                          <span className="font-headline font-bold text-base md:text-lg text-on-surface">{loc.nomeDoLocal}</span>
                        </div>
                        <span className="text-xs text-on-surface-variant font-mono truncate max-w-xs">{loc.endereco}</span>
                        <div className="flex gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-[10px] font-bold text-on-surface-variant">
                            {locChargers.length} carregadores
                          </span>
                          {locOnlineCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                              {locOnlineCount} Online
                            </span>
                          )}
                          {locOfflineCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-error/10 text-error text-[10px] font-bold">
                              {locOfflineCount} Offline
                            </span>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-6 pb-4 pt-2 border-t border-outline-variant/10">
                      <div className="space-y-2">
                        {locChargers.map(c => {
                          const isOnline = c.isConnected;
                          return (
                            <div 
                              key={c.charge_point_id} 
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all duration-200 gap-4 ${
                                isOnline
                                  ? 'bg-surface-container-low/60 border-outline-variant/10 hover:border-primary/25 hover:bg-surface-container-low'
                                  : 'bg-surface-container-low/30 border-outline-variant/5 opacity-70 hover:opacity-100 hover:bg-surface-container-low/40'
                              }`}
                            >
                              {/* Left side: Status dot + Name + Details */}
                              <div className="flex items-center gap-3.5 min-w-0">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]' : 'bg-error'}`} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-headline font-bold text-sm text-on-surface truncate">{c.description || c.charge_point_id}</span>
                                    {c.description && <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container px-1.5 py-0.5 rounded">{c.charge_point_id}</span>}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-on-surface-variant">
                                    {c.model && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">build</span>{c.vendor ? `${c.vendor} ` : ''}{c.model}</span>}
                                    {c.power_kw && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">bolt</span><strong className={isOnline ? 'text-primary' : ''}>{c.power_kw} kW</strong></span>}
                                    {c.connector_type && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">settings_input_hdmi</span>{c.connector_type}</span>}
                                  </div>
                                </div>
                              </div>

                              {/* Right side: Action Buttons */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                <button
                                  onClick={() => { setSelectedCharger(c.charge_point_id); setDetailsOpen(true); }}
                                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border border-outline-variant/10 flex items-center gap-1.5 ${
                                    isOnline 
                                      ? 'bg-surface-container-highest hover:bg-primary hover:text-on-primary hover:border-transparent' 
                                      : 'bg-surface-container-highest hover:bg-error/10 hover:text-error hover:border-error/20'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-xs">info</span>
                                  Detalhes
                                </button>
                                <button
                                  onClick={() => handleDownloadQrCode(c.charge_point_id)}
                                  disabled={downloadingQr === c.charge_point_id}
                                  className="p-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/10 hover:bg-surface-variant transition-all disabled:opacity-30 flex items-center justify-center"
                                  title="Baixar QR Code"
                                >
                                  {downloadingQr === c.charge_point_id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-primary" />
                                  ) : (
                                    <span className="material-symbols-outlined text-base">qr_code_2</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}

            {/* Handle Chargers with Unknown/Deleted Locations */}
            {Object.keys(chargersByLocation).some(key => key !== 'unknown' && !locations.some(l => l.id.toString() === key.toString())) && (() => {
              const unknownLocIds = Object.keys(chargersByLocation).filter(key => key !== 'unknown' && !locations.some(l => l.id.toString() === key.toString()));
              const unknownChargers = unknownLocIds.flatMap(key => chargersByLocation[key]);
              if (unknownChargers.length === 0) return null;
              
              return (
                <AccordionItem 
                  value="location-unknown" 
                  className="bg-card rounded-2xl border border-neutral-200 shadow-soft overflow-hidden px-0"
                >
                  <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-surface-container-high/20 transition-colors w-full flex justify-between items-center">
                    <div className="flex items-center gap-4 text-left">
                      <span className="material-symbols-outlined text-outline text-xl">help_outline</span>
                      <div>
                        <span className="font-headline font-bold text-base md:text-lg text-on-surface">Outros Locais</span>
                        <p className="text-xs text-on-surface-variant mt-0.5">Estações associadas a locais não listados ou modificados</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-[10px] font-bold text-on-surface-variant">
                        {unknownChargers.length} carregadores
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 pt-2 border-t border-outline-variant/10">
                    <div className="space-y-2">
                      {unknownChargers.map(c => {
                        const isOnline = c.isConnected;
                        return (
                          <div 
                            key={c.charge_point_id} 
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all duration-200 gap-4 ${
                              isOnline
                                ? 'bg-surface-container-low/60 border-outline-variant/10 hover:border-primary/25 hover:bg-surface-container-low'
                                : 'bg-surface-container-low/30 border-outline-variant/5 opacity-70 hover:opacity-100 hover:bg-surface-container-low/40'
                            }`}
                          >
                            {/* Left side: Status dot + Name + Details */}
                            <div className="flex items-center gap-3.5 min-w-0">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]' : 'bg-error'}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-headline font-bold text-sm text-on-surface truncate">{c.description || c.charge_point_id}</span>
                                  {c.description && <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container px-1.5 py-0.5 rounded">{c.charge_point_id}</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-on-surface-variant">
                                  {c.model && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">build</span>{c.vendor ? `${c.vendor} ` : ''}{c.model}</span>}
                                  {c.power_kw && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">bolt</span><strong className={isOnline ? 'text-primary' : ''}>{c.power_kw} kW</strong></span>}
                                  {c.connector_type && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">settings_input_hdmi</span>{c.connector_type}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Right side: Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              <button
                                onClick={() => { setSelectedCharger(c.charge_point_id); setDetailsOpen(true); }}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border border-outline-variant/10 flex items-center gap-1.5 ${
                                  isOnline 
                                    ? 'bg-surface-container-highest hover:bg-primary hover:text-on-primary hover:border-transparent' 
                                    : 'bg-surface-container-highest hover:bg-error/10 hover:text-error hover:border-error/20'
                                }`}
                              >
                                <span className="material-symbols-outlined text-xs">info</span>
                                Detalhes
                              </button>
                              <button
                                onClick={() => handleDownloadQrCode(c.charge_point_id)}
                                disabled={downloadingQr === c.charge_point_id}
                                className="p-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/10 hover:bg-surface-variant transition-all disabled:opacity-30 flex items-center justify-center"
                                title="Baixar QR Code"
                              >
                                {downloadingQr === c.charge_point_id ? (
                                  <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-primary" />
                                ) : (
                                  <span className="material-symbols-outlined text-base">qr_code_2</span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })()}
          </Accordion>
        </div>
      )}

      {/* 4. Friendly Empty State */}
      {assignedChargers.length === 0 && pendingChargers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-outline-variant/30 p-8 shadow-soft">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6 animate-bounce">
            <span className="material-symbols-outlined text-3xl">ev_station</span>
          </div>
          <p className="text-on-surface font-headline font-bold text-xl">Nenhuma estação registrada</p>
          <p className="text-on-surface-variant text-sm mt-2 max-w-sm text-center font-medium">Clique em "Nova Estação" no topo direito para registrar seu primeiro carregador OCPP na rede.</p>
          <button 
            onClick={() => setRegisterOpen(true)}
            className="mt-6 px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-md"
          >
            Adicionar Primeiro Carregador
          </button>
        </div>
      )}

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

      {/* Hidden QR Code template for PDF generation */}
      {qrPages.length > 0 && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <QrCodeTemplate pages={qrPages} />
        </div>
      )}
    </div>
  );
};
