import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Zap, TrendingUp, Receipt, AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Grupo = 'B' | 'A';

interface ExtraItem {
  label: string;
  value: string; // R$
}

interface BillB {
  distribuidora: string;
  mesReferencia: string;
  consumoKwh: string;
  te: string;      // R$/kWh
  tusd: string;    // R$/kWh
  cosip: string;   // R$
  extras: ExtraItem[];
}

interface BillA {
  distribuidora: string;
  mesReferencia: string;
  consumoPontaKwh: string;
  tePonta: string;
  tusdPonta: string;
  consumoForaKwh: string;
  teForaPonta: string;
  tusdForaPonta: string;
  demandaKw: string;
  tarifaDemanda: string; // R$/kW
  cosip: string;
  extras: ExtraItem[];
}

interface Props {
  locationId: number;
  locationAddress: string;
}

const STORAGE_KEY = (id: number) => `energy_bill_${id}`;

const defaultBillB = (): BillB => ({
  distribuidora: '', mesReferencia: '', consumoKwh: '',
  te: '', tusd: '', cosip: '', extras: [],
});
const defaultBillA = (): BillA => ({
  distribuidora: '', mesReferencia: '',
  consumoPontaKwh: '', tePonta: '', tusdPonta: '',
  consumoForaKwh: '', teForaPonta: '', tusdForaPonta: '',
  demandaKw: '', tarifaDemanda: '', cosip: '', extras: [],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const n = (s: string) => parseFloat(s.replace(',', '.')) || 0;
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtKwh = (v: number) =>
  `R$ ${v.toFixed(4).replace('.', ',')}/kWh`;

function calcB(b: BillB) {
  const kwh = n(b.consumoKwh);
  if (kwh <= 0) return null;
  const energyCharge = kwh * (n(b.te) + n(b.tusd));
  const extrasTotal = b.extras.reduce((s, e) => s + n(e.value), 0);
  const totalBill = energyCharge + n(b.cosip) + extrasTotal;
  const avgCost = totalBill / kwh;
  return { kwh, energyCharge, totalBill, avgCost, extrasTotal };
}

function calcA(a: BillA) {
  const kwh = n(a.consumoPontaKwh) + n(a.consumoForaKwh);
  if (kwh <= 0) return null;
  const energyPonta = n(a.consumoPontaKwh) * (n(a.tePonta) + n(a.tusdPonta));
  const energyFora  = n(a.consumoForaKwh) * (n(a.teForaPonta) + n(a.tusdForaPonta));
  const demandaCharge = n(a.demandaKw) * n(a.tarifaDemanda);
  const extrasTotal = a.extras.reduce((s, e) => s + n(e.value), 0);
  const totalBill = energyPonta + energyFora + demandaCharge + n(a.cosip) + extrasTotal;
  const avgCost = totalBill / kwh;
  return { kwh, energyPonta, energyFora, demandaCharge, totalBill, avgCost, extrasTotal };
}

// ─── Componentes menores ──────────────────────────────────────────────────────

const Field = ({
  label, value, onChange, placeholder = '0,00', type = 'text', unit,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; unit?: string;
}) => (
  <div className="space-y-1">
    <label className="block text-xs font-medium text-muted-foreground">{label}</label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-3 mt-5 first:mt-0">
    {children}
  </p>
);

// ─── Componente principal ─────────────────────────────────────────────────────

export function LocationEnergyTab({ locationId, locationAddress }: Props) {
  const [grupo, setGrupo] = useState<Grupo>('B');
  const [margin, setMargin] = useState(40);
  const [billB, setBillB] = useState<BillB>(defaultBillB());
  const [billA, setBillA] = useState<BillA>(defaultBillA());
  const [currentTariff, setCurrentTariff] = useState<number | null>(null);
  const [currentMinPrice, setCurrentMinPrice] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);

  // Persistência via localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(locationId));
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.grupo) setGrupo(saved.grupo);
        if (saved.margin != null) setMargin(saved.margin);
        if (saved.billB) setBillB({ ...defaultBillB(), ...saved.billB });
        if (saved.billA) setBillA({ ...defaultBillA(), ...saved.billA });
      }
    } catch { /* ignora erros de parse */ }
  }, [locationId]);

  const persist = useCallback((patch: object) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(locationId));
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY(locationId), JSON.stringify({ ...prev, ...patch }));
    } catch { /* ignora */ }
  }, [locationId]);

  // Tarifa atual do local
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/tariffs/current?locationAddress=${encodeURIComponent(locationAddress)}`);
        if (res.ok) {
          const data = await res.json();
          const t = data.tariff ?? data;
          if (t?.price_per_kwh) setCurrentTariff(parseFloat(t.price_per_kwh));
          if (t?.min_price) setCurrentMinPrice(parseFloat(t.min_price));
        }
      } catch { /* silencioso */ }
    };
    void load();
  }, [locationAddress]);

  // Utilitários de update com persist
  const updB = (patch: Partial<BillB>) => {
    setBillB(p => { const next = { ...p, ...patch }; persist({ billB: next }); return next; });
  };
  const updA = (patch: Partial<BillA>) => {
    setBillA(p => { const next = { ...p, ...patch }; persist({ billA: next }); return next; });
  };
  const changeGrupo = (g: Grupo) => { setGrupo(g); persist({ grupo: g }); };
  const changeMargin = (v: number) => { setMargin(v); persist({ margin: v }); };

  // Extras
  const addExtra = () => {
    if (grupo === 'B') updB({ extras: [...billB.extras, { label: '', value: '' }] });
    else updA({ extras: [...billA.extras, { label: '', value: '' }] });
  };
  const removeExtra = (i: number) => {
    if (grupo === 'B') updB({ extras: billB.extras.filter((_, idx) => idx !== i) });
    else updA({ extras: billA.extras.filter((_, idx) => idx !== i) });
  };
  const updateExtra = (i: number, field: 'label' | 'value', val: string) => {
    if (grupo === 'B') {
      const next = billB.extras.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
      updB({ extras: next });
    } else {
      const next = billA.extras.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
      updA({ extras: next });
    }
  };
  const extras = grupo === 'B' ? billB.extras : billA.extras;

  // Cálculo
  const result = grupo === 'B' ? calcB(billB) : calcA(billA);
  const minTariff = result ? result.avgCost * (1 + margin / 100) : null;

  // Aplicar tarifa mínima ao local
  const handleApply = async () => {
    if (minTariff == null || !result) return;
    setApplying(true);
    try {
      const res = await api.post('/tariffs', {
        newPrice: parseFloat(minTariff.toFixed(2)),
        minPrice: parseFloat(result.avgCost.toFixed(2)),
        locationAddress,
      });
      if (res.ok) {
        setCurrentTariff(parseFloat(minTariff.toFixed(2)));
        setCurrentMinPrice(parseFloat(result.avgCost.toFixed(2)));
        toast.success(`Tarifa mínima de ${fmtKwh(minTariff)} aplicada ao local`);
      } else {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast.error(err.error || 'Erro ao aplicar tarifa');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Conta de Energia
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Calcule o custo real por kWh e defina a tarifa mínima do eletroposto.
          </p>
        </div>
        {/* Tarifa atual */}
        {currentTariff != null && (
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2 text-sm shrink-0">
            <span className="text-muted-foreground">Tarifa atual</span>
            <span className="font-bold text-foreground">{fmtKwh(currentTariff)}</span>
            {currentMinPrice != null && currentMinPrice > 0 && (
              <span className="text-xs text-amber-400 font-medium">piso {fmtKwh(currentMinPrice)}</span>
            )}
          </div>
        )}
      </div>

      {/* Seletor de grupo */}
      <div className="flex bg-card border border-border rounded-xl overflow-hidden w-fit">
        {(['B', 'A'] as Grupo[]).map(g => (
          <button
            key={g}
            onClick={() => changeGrupo(g)}
            className={`px-6 py-2.5 text-sm font-bold transition-all ${
              grupo === g
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Grupo {g}{g === 'B' ? ' · Baixa Tensão' : ' · Média/Alta Tensão'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Formulário ── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              Dados da Fatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Distribuidora"
                value={grupo === 'B' ? billB.distribuidora : billA.distribuidora}
                onChange={v => grupo === 'B' ? updB({ distribuidora: v }) : updA({ distribuidora: v })}
                placeholder="Ex.: Amazonas Energia"
              />
              <Field
                label="Mês de referência"
                value={grupo === 'B' ? billB.mesReferencia : billA.mesReferencia}
                onChange={v => grupo === 'B' ? updB({ mesReferencia: v }) : updA({ mesReferencia: v })}
                placeholder="MM/AAAA"
              />
            </div>

            {grupo === 'B' ? (
              <>
                <SectionTitle>Consumo · Grupo B</SectionTitle>
                <Field
                  label="Consumo (kWh)"
                  value={billB.consumoKwh}
                  onChange={v => updB({ consumoKwh: v })}
                  placeholder="850"
                  unit="kWh"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="TE (R$/kWh)" value={billB.te} onChange={v => updB({ te: v })} placeholder="0,42" />
                  <Field label="TUSD (R$/kWh)" value={billB.tusd} onChange={v => updB({ tusd: v })} placeholder="0,46" />
                </div>
              </>
            ) : (
              <>
                <SectionTitle>Consumo Ponta · Grupo A</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Consumo (kWh)" value={billA.consumoPontaKwh} onChange={v => updA({ consumoPontaKwh: v })} placeholder="200" unit="kWh" />
                  <Field label="TE (R$/kWh)" value={billA.tePonta} onChange={v => updA({ tePonta: v })} placeholder="0,52" />
                  <Field label="TUSD (R$/kWh)" value={billA.tusdPonta} onChange={v => updA({ tusdPonta: v })} placeholder="0,38" />
                </div>

                <SectionTitle>Consumo Fora-Ponta · Grupo A</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Consumo (kWh)" value={billA.consumoForaKwh} onChange={v => updA({ consumoForaKwh: v })} placeholder="4955" unit="kWh" />
                  <Field label="TE (R$/kWh)" value={billA.teForaPonta} onChange={v => updA({ teForaPonta: v })} placeholder="0,31" />
                  <Field label="TUSD (R$/kWh)" value={billA.tusdForaPonta} onChange={v => updA({ tusdForaPonta: v })} placeholder="0,22" />
                </div>

                <SectionTitle>Demanda</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Demanda contratada (kW)" value={billA.demandaKw} onChange={v => updA({ demandaKw: v })} placeholder="50" unit="kW" />
                  <Field label="Tarifa demanda (R$/kW)" value={billA.tarifaDemanda} onChange={v => updA({ tarifaDemanda: v })} placeholder="28,00" />
                </div>
              </>
            )}

            <SectionTitle>Itens Financeiros / Adicionais</SectionTitle>
            <Field
              label="COSIP (R$)"
              value={grupo === 'B' ? billB.cosip : billA.cosip}
              onChange={v => grupo === 'B' ? updB({ cosip: v }) : updA({ cosip: v })}
              placeholder="0,00"
              unit="R$"
            />

            {extras.map((e, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Item adicional</label>
                  <input
                    type="text"
                    value={e.label}
                    onChange={ev => updateExtra(i, 'label', ev.target.value)}
                    placeholder="Ex.: Bandeira Vermelha"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    value={e.value}
                    onChange={ev => updateExtra(i, 'value', ev.target.value)}
                    placeholder="0,00"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  />
                </div>
                <button
                  onClick={() => removeExtra(i)}
                  className="mb-0.5 p-2 text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              onClick={addExtra}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar item
            </button>
          </CardContent>
        </Card>

        {/* ── Resultado ── */}
        <div className="space-y-4">
          {/* Margem */}
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Margem sobre o custo
                </span>
                <span className="text-sm font-bold text-primary">{margin}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={5}
                value={margin}
                onChange={e => changeMargin(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span>
                <span>100%</span>
                <span>200%</span>
              </div>
            </CardContent>
          </Card>

          {/* Resultado do cálculo */}
          {result ? (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ fill: 'currentColor' }} />
                  Base de Preço do Eletroposto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Consumo total</p>
                    <p className="text-lg font-bold text-foreground">{result.kwh.toLocaleString('pt-BR')} kWh</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Fatura estimada</p>
                    <p className="text-lg font-bold text-foreground">{fmt(result.totalBill)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Custo médio kWh</p>
                    <p className="text-lg font-bold text-foreground">{fmt(result.avgCost)}</p>
                  </div>
                </div>

                {'demandaCharge' in result && (
                  <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-border/50 pt-2">
                    <div className="flex justify-between">
                      <span>Energia ponta</span><span>{fmt(result.energyPonta)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Energia fora-ponta</span><span>{fmt(result.energyFora)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Demanda</span><span>{fmt(result.demandaCharge)}</span>
                    </div>
                  </div>
                )}

                <div className="border-t border-primary/20 pt-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Tarifa mínima sugerida ao motorista</p>
                  <p className="text-3xl font-bold text-primary">
                    {fmtKwh(minTariff!)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Custo {fmt(result.avgCost)}/kWh + {margin}% margem
                  </p>
                </div>

                {/* Comparação com tarifa atual */}
                {currentTariff != null && (
                  <div className={`rounded-lg p-3 flex items-start gap-2 text-xs ${
                    minTariff! > currentTariff
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  }`}>
                    {minTariff! > currentTariff ? (
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    )}
                    <span>
                      {minTariff! > currentTariff
                        ? `Tarifa atual (${fmtKwh(currentTariff)}) está abaixo do custo com margem. Recomenda-se aplicar o mínimo.`
                        : `Tarifa atual (${fmtKwh(currentTariff)}) já está acima do mínimo sugerido.`}
                    </span>
                  </div>
                )}

                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {applying ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Aplicar como tarifa deste local
                    </>
                  )}
                </button>
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  Define o preço de venda e o piso mínimo (custo sem margem) para este local.
                  A cobrança nunca ficará abaixo do custo real por kWh.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <Zap className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Preencha o consumo e as tarifas da fatura para calcular o preço mínimo.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
