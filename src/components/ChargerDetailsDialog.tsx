import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ChargerDetails {
  charge_point_id: string;
  model?: string;
  vendor?: string;
  serial_number?: string;
  firmware_version?: string;
  description?: string;
  connector_type?: string;
  power_kw?: number;
  locationId: number | null;
  isConnected: boolean;
  status?: string;
  last_heartbeat?: string;
  connectors?: Connector[];
}

interface Connector {
  id: number;
  status: string;
  error_code?: string;
}

interface Tentativa {
  eventType: 'connected' | 'disconnected' | 'refused';
  ipAddress?: string | null;
  protocol?: string | null;
  reason?: string | null;
  timestamp: string;
}

interface Diagnostico {
  codigo: string;
  chegouAoServidor: boolean;
  ultimaTentativa: string | null;
  tentativasRecusadas24h: number;
}

interface Conectividade {
  isConnected: boolean;
  lastSeen: string | null;
  attempts: Tentativa[];
  diagnostico: Diagnostico;
}

/**
 * Tradução de cada diagnóstico: o que está acontecendo e o que fazer.
 *
 * O texto vive aqui, e não no backend, para poder mudar sem migrar dado — o
 * servidor guarda só o código. `acao` é a parte que interessa a quem está com
 * o equipamento na mão.
 */
const DIAGNOSTICOS: Record<
  string,
  { tom: 'ok' | 'alerta' | 'erro'; titulo: string; explica: string; acao: string }
> = {
  conectado: {
    tom: 'ok',
    titulo: 'Conectado',
    explica: 'O carregador está falando com o servidor normalmente.',
    acao: 'Nada a fazer.',
  },
  sem_contato: {
    tom: 'erro',
    titulo: 'Nenhum contato com o servidor',
    explica:
      'Nenhuma tentativa deste carregador chegou até aqui — nem recusada. O problema está antes do servidor: no equipamento ou na rede dele.',
    acao:
      'Confira no equipamento: a URL de conexão (compare com a de um carregador que funciona, no mesmo local), se o cliente OCPP está habilitado e se ele tem internet.',
  },
  recusado_nao_cadastrado: {
    tom: 'alerta',
    titulo: 'Recusado — ID não cadastrado',
    explica:
      'O equipamento chegou ao servidor, mas se apresentou com um ID que não existe no sistema.',
    acao:
      'Compare o ID que ele anuncia (na lista de tentativas abaixo) com o cadastrado. Se forem diferentes, corrija num dos dois lados.',
  },
  recusado_dono_plataforma: {
    tom: 'alerta',
    titulo: 'Recusado — sem operador vinculado',
    explica:
      'O carregador existe, mas ainda não pertence a nenhum operador, e está tentando entrar pela URL de um.',
    acao: 'Vincule o carregador ao operador em Estações › Carregadores Pendentes.',
  },
  recusado_outro_operador: {
    tom: 'erro',
    titulo: 'Recusado — pertence a outro operador',
    explica: 'Este ID já está cadastrado para outro operador da plataforma.',
    acao: 'Confirme se o ID está correto. Se estiver, a plataforma precisa reatribuir o carregador.',
  },
  recusado_nao_autorizado: {
    tom: 'erro',
    titulo: 'Recusado — carregador desautorizado',
    explica: 'O carregador está cadastrado, mas marcado como não autorizado.',
    acao: 'Reative o carregador no cadastro para permitir a conexão.',
  },
  recusado_rate_limit: {
    tom: 'alerta',
    titulo: 'Bloqueado temporariamente',
    explica:
      'O IP foi bloqueado depois de várias tentativas recusadas seguidas. O bloqueio expira sozinho.',
    acao:
      'Resolva a causa das recusas (veja as tentativas abaixo) e aguarde o bloqueio expirar — ele não se renova enquanto o carregador estiver barrado.',
  },
  offline_apos_conectar: {
    tom: 'alerta',
    titulo: 'Offline',
    explica: 'O carregador já esteve conectado, mas caiu e não voltou.',
    acao: 'Verifique energia e internet no local. Se voltar sozinho, foi queda momentânea de rede.',
  },
};

const MOTIVO_CURTO: Record<string, string> = {
  nao_cadastrado: 'ID não cadastrado',
  dono_plataforma: 'sem operador vinculado',
  dono_outro_operador: 'pertence a outro operador',
  nao_autorizado: 'desautorizado',
  rate_limited: 'bloqueado por excesso de tentativas',
};

interface ChargerDetailsDialogProps {
  chargePointId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export const ChargerDetailsDialog = ({ chargePointId, open, onOpenChange, onUpdate }: ChargerDetailsDialogProps) => {
  const [charger, setCharger] = useState<ChargerDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [changingAvailability, setChangingAvailability] = useState(false);
  const [resetType, setResetType] = useState<'Soft' | 'Hard'>('Soft');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editConnectorType, setEditConnectorType] = useState('');
  const [editPowerKw, setEditPowerKw] = useState('');

  const [conectividade, setConectividade] = useState<Conectividade | null>(null);

  useEffect(() => {
    if (open && chargePointId) {
      void fetchChargerDetails();
      void buscarConectividade();
    } else {
      setConectividade(null);
    }
  }, [open, chargePointId]);

  // Enquanto o diálogo estiver aberto, revalida a cada 15s: é comum ficar com
  // ele aberto esperando o equipamento entrar depois de um ajuste em campo.
  useEffect(() => {
    if (!open || !chargePointId) return;
    const t = setInterval(() => void buscarConectividade(), 15000);
    return () => clearInterval(t);
  }, [open, chargePointId]);

  const buscarConectividade = async () => {
    if (!chargePointId) return;
    try {
      const r = await api.get(
        `/chargers/${encodeURIComponent(chargePointId)}/connection-attempts?limit=20`
      );
      if (!r.ok) return; // sem diagnóstico o resto do diálogo segue útil
      const d = await r.json();
      setConectividade(d.data ?? d);
    } catch {
      /* silencioso: é informação complementar */
    }
  };

  const fetchChargerDetails = async () => {
    if (!chargePointId) return;
    setLoading(true);
    try {
      const r = await api.get(`/chargers/${encodeURIComponent(chargePointId)}/details`);
      if (r.ok) {
        const d = await r.json();
        setCharger(d); setEditName(d.description || ''); setEditConnectorType(d.connector_type || ''); setEditPowerKw(d.power_kw ? String(d.power_kw) : ''); setEditing(false);
      } else toast.error('Erro ao carregar detalhes');
    } catch { toast.error('Erro ao carregar detalhes'); }
    finally { setLoading(false); }
  };

  const handleSaveInfo = async () => {
    if (!chargePointId) return;
    setSaving(true);
    try {
      const r = await api.put(`/chargers/${encodeURIComponent(chargePointId)}/info`, { description: editName || null, connector_type: editConnectorType || null, power_kw: editPowerKw ? Number(editPowerKw) : null });
      if (r.ok) { toast.success('Atualizado!'); setEditing(false); void fetchChargerDetails(); onUpdate?.(); }
      else toast.error('Erro ao salvar');
    } catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!chargePointId) return;
    setResetting(true);
    try {
      const r = await api.post(`/chargers/${encodeURIComponent(chargePointId)}/reset`, { type: resetType });
      if (r.ok) { const d = await r.json(); d.status === 'Accepted' ? toast.success(`Reset ${resetType} aceito`) : toast.warning(`Reset ${resetType} rejeitado`); onUpdate?.(); }
      else { const e = await r.json(); toast.error(e.error || 'Erro no reset'); }
    } catch { toast.error('Erro no reset'); }
    finally { setResetting(false); }
  };

  const handleChangeAvailability = async (available: boolean) => {
    if (!chargePointId) return;
    setChangingAvailability(true);
    try {
      const r = await api.post(`/chargers/${encodeURIComponent(chargePointId)}/availability`, { type: available ? 'Operative' : 'Inoperative', connectorId: 0 });
      if (r.ok) { const d = await r.json(); d.status === 'Accepted' ? (toast.success(`${available ? 'Ativado' : 'Desativado'}!`), void fetchChargerDetails(), onUpdate?.()) : toast.warning('Comando rejeitado'); }
      else { const e = await r.json(); toast.error(e.error || 'Erro'); }
    } catch { toast.error('Erro ao alterar disponibilidade'); }
    finally { setChangingAvailability(false); }
  };

  const statusStyle = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'available': return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', dot: 'bg-primary' };
      case 'charging': return { bg: 'bg-tertiary/10', text: 'text-tertiary', border: 'border-tertiary/30', dot: 'bg-tertiary' };
      case 'preparing': return { bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/30', dot: 'bg-secondary' };
      case 'faulted': return { bg: 'bg-error/10', text: 'text-error', border: 'border-error/30', dot: 'bg-error' };
      default: return { bg: 'bg-outline/10', text: 'text-on-surface-variant', border: 'border-outline/30', dot: 'bg-outline' };
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleString('pt-BR') : 'N/A';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-container border-outline-variant/20 max-w-2xl !max-h-[80vh] !flex !flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pb-4 border-b border-outline-variant/10">
          <DialogTitle className="text-on-surface font-headline flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-xl">ev_station</span>
            </div>
            Detalhes do Carregador
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant font-mono text-xs">{chargePointId}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : charger ? (
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 min-h-0 pt-4" style={{ maxHeight: 'calc(80vh - 120px)' }}>

            {/* Status */}
            <Section icon="monitoring" title="Status">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${
                    charger.isConnected ? 'bg-primary/10 text-primary border-primary/30' : 'bg-error/10 text-error border-error/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${charger.isConnected ? 'bg-primary animate-pulse' : 'bg-error'}`} />
                    {charger.isConnected ? 'CONECTADO' : 'DESCONECTADO'}
                  </span>
                  {charger.status && (() => {
                    const s = statusStyle(charger.status);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {charger.status.toUpperCase()}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-xs text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  {formatDate(charger.last_heartbeat)}
                </div>
              </div>
            </Section>

            {/* Identification (editable) */}
            <Section icon="badge" title="Identificação" action={!editing ? (
              <button onClick={() => setEditing(true)} className="text-primary text-[10px] font-bold uppercase tracking-widest hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">edit</span> Editar
              </button>
            ) : undefined}>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Nome</label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ex: Carregador 1" className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Tipo de Conector</label>
                      <Select value={editConnectorType} onValueChange={setEditConnectorType}>
                        <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent className="bg-surface-container border-outline-variant/20">
                          {['CCS2', 'CCS1', 'CHAdeMO', 'Tipo 2', 'Tipo 1', 'GBT'].map(t => (
                            <SelectItem key={t} value={t} className="text-on-surface focus:bg-surface-container-highest">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Potência (kW)</label>
                      <Input type="number" value={editPowerKw} onChange={e => setEditPowerKw(e.target.value)} placeholder="50" className="bg-surface-container-low border-outline-variant/20 text-on-surface" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSaveInfo} disabled={saving} className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button onClick={() => { setEditing(false); setEditName(charger.description || ''); setEditConnectorType(charger.connector_type || ''); setEditPowerKw(charger.power_kw ? String(charger.power_kw) : ''); }} className="px-4 py-1.5 rounded-lg text-on-surface-variant text-xs font-bold hover:bg-surface-container-highest transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <InfoField label="Nome" value={charger.description} />
                  <InfoField label="Tipo Conector" value={charger.connector_type} />
                  <InfoField label="Potência" value={charger.power_kw ? `${charger.power_kw} kW` : undefined} accent />
                </div>
              )}
            </Section>

            {/* Device Info */}
            <Section icon="devices" title="Dispositivo">
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Modelo" value={charger.model} />
                <InfoField label="Fabricante" value={charger.vendor} />
                <InfoField label="Número de Série" value={charger.serial_number} mono />
                <InfoField label="Firmware" value={charger.firmware_version} mono />
              </div>
            </Section>

            {/* Conectividade: diagnóstico + tentativas */}
            {conectividade && (
              <Section icon="cable" title="Conectividade">
                <DiagnosticoBox diag={conectividade.diagnostico} />
                <ListaDeTentativas tentativas={conectividade.attempts} />
              </Section>
            )}

            {/* Connectors */}
            {charger.connectors && charger.connectors.length > 0 && (
              <Section icon="power" title="Conectores">
                <div className="space-y-2">
                  {charger.connectors.map(conn => {
                    const s = statusStyle(conn.status);
                    return (
                      <div key={conn.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm text-on-surface-variant">electrical_services</span>
                          </div>
                          <span className="text-sm font-medium text-on-surface">Conector {conn.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {conn.status}
                          </span>
                          {conn.error_code && conn.error_code !== 'NoError' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-error/10 text-error border border-error/30">
                              {conn.error_code}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Actions */}
            <Section icon="settings_power" title="Ações">
              <div className="space-y-4">
                {/* Reset */}
                <div className="flex items-center gap-3">
                  <Select value={resetType} onValueChange={(v: 'Soft' | 'Hard') => setResetType(v)}>
                    <SelectTrigger className="w-32 bg-surface-container-low border-outline-variant/20 text-on-surface text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-surface-container border-outline-variant/20">
                      <SelectItem value="Soft" className="text-on-surface focus:bg-surface-container-highest">Soft Reset</SelectItem>
                      <SelectItem value="Hard" className="text-on-surface focus:bg-surface-container-highest">Hard Reset</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={handleReset} disabled={resetting || !charger.isConnected} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/20 text-on-surface text-sm font-bold hover:bg-surface-container-highest transition-all disabled:opacity-30">
                    <span className={`material-symbols-outlined text-base ${resetting ? 'animate-spin' : ''}`}>refresh</span>
                    {resetting ? 'Resetando...' : 'Resetar'}
                  </button>
                </div>

                {/* Availability */}
                <div className="flex items-center gap-3">
                  <button onClick={() => handleChangeAvailability(true)} disabled={changingAvailability || !charger.isConnected} className="px-5 py-2 rounded-lg bg-primary text-on-primary text-sm font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100">
                    <span className="material-symbols-outlined text-base align-middle mr-1">power</span>
                    Ativar
                  </button>
                  <button onClick={() => handleChangeAvailability(false)} disabled={changingAvailability || !charger.isConnected} className="px-5 py-2 rounded-lg border border-error/30 text-error text-sm font-bold hover:bg-error/10 transition-all disabled:opacity-30">
                    <span className="material-symbols-outlined text-base align-middle mr-1">power_off</span>
                    Desativar
                  </button>
                  {!charger.isConnected && (
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Carregador desconectado</span>
                  )}
                </div>
              </div>
            </Section>
          </div>
        ) : (
          <div className="text-center py-12 text-on-surface-variant flex-1">
            <span className="material-symbols-outlined text-4xl text-outline mb-3 block">search_off</span>
            Carregador não encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/* ── Sub-components ── */

function Section({ icon, title, action, children }: { icon: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-lg border border-outline-variant/10 overflow-hidden">
      <div className="px-5 py-3 border-b border-outline-variant/5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-primary">{icon}</span>
          {title}
        </span>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function DiagnosticoBox({ diag }: { diag: Diagnostico }) {
  const d = DIAGNOSTICOS[diag.codigo] ?? DIAGNOSTICOS.offline_apos_conectar;
  const tons = {
    ok: { borda: 'border-primary/30', fundo: 'bg-primary/5', txt: 'text-primary', icone: 'check_circle' },
    alerta: { borda: 'border-amber-400/30', fundo: 'bg-amber-400/5', txt: 'text-amber-400', icone: 'warning' },
    erro: { borda: 'border-error/30', fundo: 'bg-error/5', txt: 'text-error', icone: 'error' },
  }[d.tom];

  return (
    <div className={`rounded-lg border ${tons.borda} ${tons.fundo} p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined text-lg ${tons.txt} shrink-0`}>{tons.icone}</span>
        <div className="min-w-0">
          <p className={`font-headline font-bold text-sm ${tons.txt}`}>{d.titulo}</p>
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{d.explica}</p>
          <p className="text-xs text-on-surface mt-2 leading-relaxed">
            <span className="font-bold">O que fazer: </span>
            {d.acao}
          </p>
          {diag.tentativasRecusadas24h > 0 && (
            <p className="text-[11px] text-on-surface-variant mt-2">
              {diag.tentativasRecusadas24h} tentativa
              {diag.tentativasRecusadas24h > 1 ? 's' : ''} recusada
              {diag.tentativasRecusadas24h > 1 ? 's' : ''} nas últimas 24h.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ListaDeTentativas({ tentativas }: { tentativas: Tentativa[] }) {
  if (!tentativas.length) {
    return (
      <p className="text-xs text-on-surface-variant italic">
        Nenhuma tentativa registrada para este carregador.
      </p>
    );
  }
  const rotulo = (t: Tentativa) =>
    t.eventType === 'connected'
      ? { txt: 'Conectou', cor: 'text-primary', icone: 'link' }
      : t.eventType === 'refused'
        ? { txt: `Recusado — ${MOTIVO_CURTO[t.reason ?? ''] ?? t.reason ?? 'motivo não informado'}`, cor: 'text-amber-400', icone: 'block' }
        : { txt: `Desconectou${t.reason ? ` (${t.reason})` : ''}`, cor: 'text-on-surface-variant', icone: 'link_off' };

  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto">
      {tentativas.map((t, i) => {
        const r = rotulo(t);
        return (
          <div key={i} className="flex items-start gap-2.5 text-xs py-1">
            <span className={`material-symbols-outlined text-sm ${r.cor} shrink-0`}>{r.icone}</span>
            <span className="font-mono text-on-surface-variant shrink-0">
              {new Date(t.timestamp).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </span>
            <span className={`${r.cor} min-w-0 break-words`}>{r.txt}</span>
          </div>
        );
      })}
    </div>
  );
}

function InfoField({ label, value, mono, accent }: { label: string; value?: string | null; mono?: boolean; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} ${accent && value ? 'text-primary font-bold font-headline' : 'text-on-surface'}`}>
        {value || <span className="text-outline italic text-xs">N/A</span>}
      </p>
    </div>
  );
}

export default ChargerDetailsDialog;
