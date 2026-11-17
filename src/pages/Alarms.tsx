import { Fragment, useState, useEffect, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { AlarmSeverity } from '../types';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { dataLocal } from '../components/ui/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
} from '../components/painel/Pagina';
import { Icone, IconeSvg } from '../components/painel/Icone';
import iconeRaio from '../assets/icones/alarmes-raio.svg';

/*
 * Alarmes — redesenho de nov/2026, à risca do Figma da Lauriane (frame
 * 185:4223, que no arquivo se chama "cameras" por engano): cabeçalho com
 * período, local e estação em pílula e o "Atualizar"; quatro cartões; os chips
 * de severidade; a tabela de linhas verdes.
 * Correções do Figma: subtítulo (era o das câmeras); os cartões, que eram
 * cópias ("Ativos 25 / 113,4% / Valor médio por recarga"), viram Ativos,
 * Críticos, Reconhecidos e Resolvidos com os números da lista — a pílula diz
 * quanto cada um é do total, porque não há histórico para uma variação; uma
 * coluna "Erro" só (o Figma repetiu a coluna).
 * Funções que já existiam e o Figma não mostra, no lugar menos intrusivo: o
 * filtro por status virou clique nos cartões; o aviso de crítico ativo virou o
 * cartão "Críticos" em vermelho; o conector fica sob o carregador; a mensagem
 * longa abre na própria linha; a paginação só aparece com mais de uma página.
 */

interface AlarmEntry {
  id: string;
  charger_id: string;
  connector_id: number;
  error_code: string;
  severity: AlarmSeverity;
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  timestamp: string;
  resolved_at?: string;
  location_name?: string;
}

// Pílulas do Figma (sem ícone: o texto já diz o estado). As cores seguem o
// Figma, com o texto um pouco mais escuro no claro para dar leitura.
const VERMELHO = 'bg-[#fedbd5] text-[#c00000] dark:bg-[#4a1d17] dark:text-[#ff8a75]';

const SEVERITY_CONFIG: Record<AlarmSeverity, { label: string; classe: string }> = {
  critical: { label: 'Crítico', classe: VERMELHO },
  high: { label: 'Alto', classe: 'bg-tom-amarelo text-estado-problema-forte' },
  medium: { label: 'Média', classe: 'bg-tom-azul text-estado-uso-forte' },
  low: { label: 'Baixa', classe: 'bg-tom-cinza text-tom-cinza-icone' },
};

const STATUS_CONFIG: Record<AlarmEntry['status'], { label: string; classe: string }> = {
  active: { label: 'Ativo', classe: VERMELHO },
  acknowledged: { label: 'Reconhecido', classe: 'bg-estado-problema text-estado-problema-forte' },
  resolved: { label: 'Resolvido', classe: 'bg-estado-livre text-estado-livre-forte' },
};

const ERROR_DESCRIPTIONS: Record<string, string> = {
  ConnectorLockFailure: 'Falha no travamento do conector',
  EVCommunicationError: 'Erro de comunicação com veículo',
  GroundFailure: 'Falha de aterramento',
  HighTemperature: 'Temperatura elevada',
  InternalError: 'Erro interno do carregador',
  OtherError: 'Outro erro',
  OverCurrentFailure: 'Sobrecorrente detectada',
  OverVoltage: 'Sobretensão detectada',
  PowerMeterFailure: 'Falha no medidor de energia',
  PowerSwitchFailure: 'Falha no interruptor de energia',
  ReaderFailure: 'Falha no leitor RFID',
  ResetFailure: 'Falha no reset',
  UnderVoltage: 'Subtensão detectada',
  WeakSignal: 'Sinal fraco de comunicação',
  Offline: 'Carregador offline',
  FirmwareFailed: 'Falha na atualização de firmware',
};

type FilterSeverity = 'all' | AlarmSeverity;
type FilterStatus = 'all' | 'active' | 'acknowledged' | 'resolved';

const SEVERIDADES: AlarmSeverity[] = ['critical', 'high', 'medium', 'low'];

/**
 * A mensagem fica numa caixa estreita da coluna "Erro" (até duas linhas) para
 * a tabela não estourar. Acima deste tamanho a mensagem com certeza é cortada
 * na tela, então a linha ganha o botão de expandir — abaixo dele o texto cabe e
 * o botão só seria ruído. É um limite por caracteres porque o corte real é por
 * pixel, que não dá para medir antes de renderizar.
 */
export const MESSAGE_PREVIEW_LIMIT = 60;

export const isMensagemLonga = (mensagem: string | null | undefined): boolean =>
  (mensagem ?? '').trim().length > MESSAGE_PREVIEW_LIMIT;

/** Cabeçalho da tabela do Figma: maiúsculas, sem fundo (as linhas é que têm). */
const classeDoTh =
  'px-3 3xl:px-4 pb-1 text-left text-[13px] 3xl:text-[15px] font-semibold uppercase text-foreground whitespace-nowrap';

/** Célula das linhas verdes do Figma; a primeira e a última arredondam a linha. */
const classeDoTd =
  'px-3 3xl:px-4 py-3 align-middle bg-primary/[0.14] first:rounded-l-[15px] last:rounded-r-[15px]';

const ordenar = (lista: string[]) =>
  [...new Set(lista)].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const Alarms = () => {
  const [alarms, setAlarms] = useState<AlarmEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  // A última busca falhou: a lista na tela é a de antes.
  const [falhou, setFalhou] = useState(false);
  // Filtros do cabeçalho (período, local e estação), sobre a lista carregada.
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroLocal, setFiltroLocal] = useState('');
  const [filtroEstacao, setFiltroEstacao] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  // Alarmes com a mensagem aberta na linha de detalhe.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 12;

  const toggleExpanded = (alarmId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(alarmId)) next.delete(alarmId);
      else next.add(alarmId);
      return next;
    });
  };

  useEffect(() => {
    void fetchAlarms();
  }, []);

  // Filtro novo: volta para a primeira página.
  useEffect(() => {
    setCurrentPage(1);
  }, [dataInicio, dataFim, filtroLocal, filtroEstacao, filterStatus, filterSeverity]);

  const fetchAlarms = async () => {
    setAtualizando(true);
    const chegou = (lista: AlarmEntry[]) => {
      setAlarms(lista);
      setAtualizadoEm(new Date());
      setFalhou(false);
    };
    try {
      // Tenta endpoint dedicado de alarmes
      const res = await api.get('/alarms');
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        if (arr.length > 0) {
          chegou(arr);
          return;
        }
      }
      // Fallback: gera a partir dos carregadores
      const chargersRes = await api.get('/chargers');
      if (!chargersRes.ok) throw new Error('Falha ao buscar os carregadores');
      const chargers = await chargersRes.json();
      chegou(generateAlarmsFromChargers(Array.isArray(chargers) ? chargers : []));
    } catch {
      // A lista na tela fica (vazia na primeira vez) e o "Atualizar" avisa.
      setFalhou(true);
    } finally {
      setAtualizando(false);
      setLoading(false);
    }
  };

  const generateAlarmsFromChargers = (chargers: any[]): AlarmEntry[] => {
    const result: AlarmEntry[] = [];
    for (const cp of chargers) {
      const cpId = cp.charge_point_id || cp.id || 'UNKNOWN';
      const locName = cp.location_name || cp.address || '';

      if (cp.status === 'offline' || cp.is_online === false) {
        result.push({
          id: `${cpId}-offline`,
          charger_id: cpId,
          connector_id: 0,
          error_code: 'Offline',
          severity: 'high',
          status: 'active',
          message: `Carregador ${cpId} está offline. Sem heartbeat recente.`,
          timestamp: cp.last_heartbeat || new Date().toISOString(),
          location_name: locName,
        });
      }

      const connectors = cp.connectors || [];
      for (const conn of connectors) {
        if (conn.status === 'Faulted' || (conn.error_code && conn.error_code !== 'NoError')) {
          const errCode = conn.error_code || 'InternalError';
          result.push({
            id: `${cpId}-${conn.connector_id}-${errCode}`,
            charger_id: cpId,
            connector_id: conn.connector_id || 1,
            error_code: errCode,
            severity: ['GroundFailure', 'OverCurrentFailure', 'OverVoltage'].includes(errCode)
              ? 'critical'
              : ['HighTemperature', 'UnderVoltage', 'PowerSwitchFailure'].includes(errCode)
                ? 'high'
                : 'medium',
            status: 'active',
            message: ERROR_DESCRIPTIONS[errCode] || `Erro: ${errCode}`,
            timestamp: conn.timestamp || new Date().toISOString(),
            location_name: locName,
          });
        }
      }
    }

    return result.sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (
        sevOrder[a.severity] - sevOrder[b.severity] ||
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });
  };

  const handleAcknowledge = (alarmId: string) => {
    setAlarms(prev =>
      prev.map(a => (a.id === alarmId ? { ...a, status: 'acknowledged' as const } : a))
    );
    toast.success('Alarme reconhecido');
  };

  const handleResolve = (alarmId: string) => {
    setAlarms(prev =>
      prev.map(a =>
        a.id === alarmId
          ? { ...a, status: 'resolved' as const, resolved_at: new Date().toISOString() }
          : a
      )
    );
    toast.success('Alarme resolvido');
  };

  // Opções dos filtros do cabeçalho: os locais e as estações que têm alarme.
  const locaisDoFiltro = useMemo(
    () => ordenar(alarms.map(a => a.location_name ?? '').filter(Boolean)),
    [alarms]
  );
  const estacoesDoFiltro = useMemo(() => ordenar(alarms.map(a => a.charger_id)), [alarms]);

  // Período, local e estação valem para a página toda (cartões, chips e tabela).
  const doEscopo = useMemo(() => {
    const inicio = dataInicio ? dataLocal(dataInicio) : null;
    const fim = dataFim ? dataLocal(dataFim) : null;
    fim?.setHours(23, 59, 59, 999);
    return alarms.filter(a => {
      if (filtroLocal && a.location_name !== filtroLocal) return false;
      if (filtroEstacao && a.charger_id !== filtroEstacao) return false;
      const quando = new Date(a.timestamp);
      if (inicio && quando < inicio) return false;
      if (fim && quando > fim) return false;
      return true;
    });
  }, [alarms, dataInicio, dataFim, filtroLocal, filtroEstacao]);

  // Os chips contam dentro do status escolhido (nos cartões), para baterem com a tabela.
  const doStatus = useMemo(
    () => doEscopo.filter(a => filterStatus === 'all' || a.status === filterStatus),
    [doEscopo, filterStatus]
  );

  const filtered = useMemo(
    () => doStatus.filter(a => filterSeverity === 'all' || a.severity === filterSeverity),
    [doStatus, filterSeverity]
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const current = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const activeCount = doEscopo.filter(a => a.status === 'active').length;
  const criticalCount = doEscopo.filter(
    a => a.severity === 'critical' && a.status === 'active'
  ).length;
  const acknowledgedCount = doEscopo.filter(a => a.status === 'acknowledged').length;
  const resolvedCount = doEscopo.filter(a => a.status === 'resolved').length;

  // O filtro por status (antes uma barra de botões) é o clique nos cartões.
  const criticosEscolhido = filterStatus === 'active' && filterSeverity === 'critical';
  const escolherStatus = (status: Exclude<FilterStatus, 'all'>) =>
    setFilterStatus(atual => (atual === status ? 'all' : status));
  const escolherCriticos = () => {
    if (criticosEscolhido) {
      setFilterStatus('all');
      setFilterSeverity('all');
    } else {
      setFilterStatus('active');
      setFilterSeverity('critical');
    }
  };

  const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        titulo="Alarmes"
        subtitulo="Acompanhe e trate os alarmes dos carregadores"
        filtros={
          <>
            <DateRangePicker
              startDate={dataInicio}
              endDate={dataFim}
              onStartDateChange={setDataInicio}
              onEndDateChange={setDataFim}
              onClear={() => {
                setDataInicio('');
                setDataFim('');
              }}
              placeholder="Todo o período"
              className={`${classeDaPilula} justify-start`}
            />
            <Select
              value={filtroLocal || 'todos'}
              onValueChange={v => setFiltroLocal(v === 'todos' ? '' : v)}
            >
              <SelectTrigger className={classeDaPilula} aria-label="Filtrar por local">
                <span className="flex flex-1 items-center gap-3 min-w-0">
                  <Icone nome="local" />
                  <span className="min-w-0 truncate"><SelectValue placeholder="Todos os locais" /></span>
                </span>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos os locais</SelectItem>
                {locaisDoFiltro.map(l => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filtroEstacao || 'todas'}
              onValueChange={v => setFiltroEstacao(v === 'todas' ? '' : v)}
            >
              <SelectTrigger className={classeDaPilula} aria-label="Filtrar por estação">
                <span className="flex flex-1 items-center gap-3 min-w-0">
                  <Icone nome="estacao" />
                  <span className="min-w-0 truncate"><SelectValue placeholder="Todas as estações" /></span>
                </span>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todas">Todas as estações</SelectItem>
                {estacoesDoFiltro.map(e => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        acoes={
          <BotaoAtualizar
            aoAtualizar={() => void fetchAlarms()}
            carregando={atualizando}
            atualizadoEm={atualizadoEm}
            falhou={falhou}
          />
        }
      />

      {/* Cartões (219 × 188 no Figma); um clique filtra a tabela pelo status. */}
      <div className="pt-[27px] grid grid-cols-2 xl:grid-cols-[repeat(4,219px)] gap-[25px]">
        <CartaoDeAlarme
          titulo="Ativos"
          valor={activeCount}
          total={doEscopo.length}
          escolhido={filterStatus === 'active' && !criticosEscolhido}
          aoEscolher={() => escolherStatus('active')}
          dica="Mostrar só os ativos"
        />
        <CartaoDeAlarme
          titulo="Críticos"
          valor={criticalCount}
          total={doEscopo.length}
          escolhido={criticosEscolhido}
          aoEscolher={escolherCriticos}
          dica="Mostrar só os críticos ativos"
          alerta={criticalCount > 0}
        />
        <CartaoDeAlarme
          titulo="Reconhecidos"
          valor={acknowledgedCount}
          total={doEscopo.length}
          escolhido={filterStatus === 'acknowledged'}
          aoEscolher={() => escolherStatus('acknowledged')}
          dica="Mostrar só os reconhecidos"
        />
        <CartaoDeAlarme
          titulo="Resolvidos"
          valor={resolvedCount}
          total={doEscopo.length}
          escolhido={filterStatus === 'resolved'}
          aoEscolher={() => escolherStatus('resolved')}
          dica="Mostrar só os resolvidos"
        />
      </div>

      {/* Chips de severidade */}
      <div
        className="flex flex-wrap items-center gap-[18px] 3xl:gap-[23px]"
        role="group"
        aria-label="Filtrar por severidade"
      >
        <ChipDoFigma ativo={filterSeverity === 'all'} onClick={() => setFilterSeverity('all')}>
          Todos ({doStatus.length})
        </ChipDoFigma>
        {SEVERIDADES.map(s => (
          <ChipDoFigma key={s} ativo={filterSeverity === s} onClick={() => setFilterSeverity(s)}>
            {SEVERITY_CONFIG[s].label} ({doStatus.filter(a => a.severity === s).length})
          </ChipDoFigma>
        ))}
      </div>

      {/* Tabela (1278 px no Figma, sem cartão em volta) */}
      <div className="pt-[60px] max-w-[1278px] overflow-x-auto">
        <table
          aria-label="Histórico de alarmes"
          className="w-full border-separate border-spacing-y-[10px] text-[13px] font-semibold text-foreground"
        >
          <thead>
            <tr>
              <th className={classeDoTh}>Severidade</th>
              <th className={classeDoTh}>Carregador</th>
              <th className={classeDoTh}>Erro</th>
              <th className={classeDoTh}>Local</th>
              <th className={classeDoTh}>Data/Hora</th>
              <th className={classeDoTh}>Status</th>
              <th className={classeDoTh}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {current.length === 0 ? (
              <tr>
                <td colSpan={7} className={`${classeDoTd} py-10 text-center`}>
                  <p className="text-[15px] font-medium text-muted-foreground">
                    Nenhum alarme encontrado
                  </p>
                </td>
              </tr>
            ) : (
              current.map(alarm => {
                const sev = SEVERITY_CONFIG[alarm.severity];
                const st = STATUS_CONFIG[alarm.status] || STATUS_CONFIG.active;
                const longa = isMensagemLonga(alarm.message);
                const aberta = expandedIds.has(alarm.id);
                const detalheId = `alarme-mensagem-${alarm.id}`;
                return (
                  <Fragment key={alarm.id}>
                    <tr>
                      <td className={classeDoTd}>
                        <Pilula classe={sev.classe}>{sev.label}</Pilula>
                      </td>
                      <td className={classeDoTd}>
                        <span className="block whitespace-nowrap">{alarm.charger_id}</span>
                        {alarm.connector_id > 0 && (
                          <span className="block text-xs font-medium text-muted-foreground">
                            Conector {alarm.connector_id}
                          </span>
                        )}
                      </td>
                      <td className={classeDoTd}>
                        <div className="flex flex-col items-start 3xl:flex-row 3xl:items-center gap-1.5 3xl:gap-6">
                          <Pilula classe="bg-[#e9e9ec] text-[#62666e] dark:bg-muted dark:text-muted-foreground">
                            {alarm.error_code}
                          </Pilula>
                          <div className="flex items-start gap-1.5">
                            {/* title serve de atalho no hover; o botão ao lado é o
                                caminho que funciona no toque e no teclado. */}
                            <span
                              className="max-w-[200px] 3xl:max-w-[226px] line-clamp-2 break-words"
                              title={alarm.message}
                            >
                              {alarm.message}
                            </span>
                            {longa && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(alarm.id)}
                                aria-expanded={aberta}
                                aria-controls={detalheId}
                                title={aberta ? 'Recolher mensagem' : 'Ver mensagem completa'}
                                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary-strong transition-colors"
                              >
                                <span className="sr-only">
                                  {aberta ? 'Recolher mensagem' : 'Ver mensagem completa'}
                                </span>
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${aberta ? 'rotate-180' : ''}`}
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={classeDoTd}>{alarm.location_name || '-'}</td>
                      <td className={`${classeDoTd} whitespace-nowrap`}>
                        <span className="block">{data(alarm.timestamp)}</span>
                        <span className="block">{hora(alarm.timestamp)}</span>
                      </td>
                      <td className={classeDoTd}>
                        <Pilula classe={st.classe}>{st.label}</Pilula>
                      </td>
                      <td className={classeDoTd}>
                        <div className="flex flex-col 3xl:flex-row gap-[7px]">
                          {alarm.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(alarm.id)}
                              className="h-9 px-3 rounded-[15px] bg-[#e9e9ec] dark:bg-muted text-foreground text-[13px] font-semibold whitespace-nowrap shadow-pilula hover:brightness-95 transition"
                            >
                              Reconhecer
                            </button>
                          )}
                          {alarm.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleResolve(alarm.id)}
                              className="h-9 px-3 rounded-[15px] bg-primary-soft text-primary-strong text-[13px] font-semibold whitespace-nowrap shadow-pilula hover:brightness-95 transition"
                            >
                              Resolver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Linha de detalhe — a mensagem ganha a largura inteira da
                        tabela, em vez da caixa estreita da coluna. */}
                    {longa && aberta && (
                      <tr>
                        <td id={detalheId} colSpan={7} className={`${classeDoTd} px-5 py-4`}>
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                            Mensagem completa
                          </p>
                          <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">
                            {alarm.message}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {/* Paginação (12 por página): só quando há mais de uma página. */}
        {totalPages > 1 && (
          <div className="mt-3 flex flex-wrap justify-between items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              Página <span className="font-semibold text-foreground">{currentPage}</span> de{' '}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </p>
            <div className="flex gap-3">
              <ChipDoFigma
                ativo={false}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                desabilitado={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Anterior
              </ChipDoFigma>
              <ChipDoFigma
                ativo={false}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                desabilitado={currentPage === totalPages}
              >
                Próxima
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </ChipDoFigma>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Pílula da tabela do Figma (severidade, erro e status): 36 px, maiúsculas, sombra. */
function Pilula({ classe, children }: { classe: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center justify-center h-9 px-[18px] 3xl:px-[22px] rounded-[25px] text-xs 3xl:text-[13px] font-semibold uppercase whitespace-nowrap shadow-pilula ${classe}`}
    >
      {children}
    </span>
  );
}

/** Chip do Figma: verde quando escolhido; cinza-claro com sombra, sem borda, nos outros. */
function ChipDoFigma({
  ativo,
  onClick,
  desabilitado,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  desabilitado?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      disabled={desabilitado}
      className={`h-[43px] min-w-[142px] px-6 rounded-[25px] inline-flex items-center justify-center gap-1 text-[15px] font-semibold whitespace-nowrap shadow-pilula transition disabled:opacity-40 disabled:cursor-not-allowed ${
        ativo
          ? 'bg-primary text-primary-foreground'
          : 'bg-[#f4f6f8] dark:bg-card text-foreground hover:brightness-95'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Cartão do Figma: raio, título, o número e a pílula verde com quanto o grupo é
 * do total (no Figma era uma variação, que a lista de alarmes não tem). Com
 * crítico ativo, o cartão "Críticos" fica vermelho: é o aviso que antes era
 * uma faixa sobre a página.
 */
function CartaoDeAlarme({
  titulo,
  valor,
  total,
  escolhido,
  aoEscolher,
  dica,
  alerta,
}: {
  titulo: string;
  valor: number;
  total: number;
  escolhido: boolean;
  aoEscolher: () => void;
  dica: string;
  alerta?: boolean;
}) {
  const parte = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={escolhido}
      title={escolhido ? 'Mostrar todos' : dica}
      className={`${classeDoCartao} min-h-[188px] pl-[29px] pr-4 pt-[21px] pb-5 flex flex-col text-left transition hover:brightness-[0.98] ${
        escolhido ? 'ring-2 ring-primary' : ''
      }`}
    >
      <span className="flex items-start gap-[14px]">
        <span
          className={`mt-[3px] ${alerta ? 'text-[#c00000] dark:text-[#ff8a75]' : 'text-primary-strong'}`}
        >
          <IconeSvg src={iconeRaio} tamanho={26} />
        </span>
        <span className="min-w-0">
          <span className="block text-[20px] leading-tight font-semibold text-[#001119] dark:text-foreground">
            {titulo}
          </span>
          <span className="block text-[32px] leading-tight font-semibold tabular-nums text-foreground">
            {valor}
          </span>
        </span>
      </span>
      <span className="mt-auto">
        <span
          className={`inline-flex items-center h-7 px-3 rounded-[15px] text-[15px] font-medium tabular-nums shadow-[0_2px_19px_rgba(0,0,0,0.25)] dark:shadow-none ${
            alerta ? VERMELHO : 'bg-primary-soft text-primary-strong'
          }`}
        >
          {parte}%
        </span>
        <span className="block mt-2 text-[10px] font-normal text-[#001119] dark:text-muted-foreground">
          {alerta ? 'Ação imediata necessária' : 'do total de alarmes'}
        </span>
      </span>
    </button>
  );
}
