import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddLocationForm } from '../components/AddLocationForm';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { useSocket } from '../lib/hooks/useSocket';
import { useTenant } from '../contexts/TenantContext';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { DynamicMap, TileLayer, Marker, useMap } from '../components/DynamicMap';
import {
  estadoDoCarregador,
  estadoDoLocal,
  type EstadoDoCarregador,
} from '../lib/estadoDoCarregador';
import { BotaoAtualizar, CabecalhoDaPagina, classeDoCartao } from '../components/painel/Pagina';
import {
  BarraDeFiltros,
  CampoDeBusca,
  classeDoBotaoPrincipal,
  classeDoBotaoContorno,
} from '../components/painel/Pecas';
import { IconeSvg } from '../components/painel/Icone';
import { cn } from '../components/ui/utils';
import {
  AlternarGradeLista,
  CartaoDoLocal,
  CartaoLocalSelecionado,
  ChipComSeta,
  ContadorDeLocais,
  LegendaDoMapa,
  MenuFiltrarPorStatus,
  enderecoDoLocal,
  grupoDoLocal,
  temCoordenadas,
  type LocalResumo,
  type ResumoDoLocal,
} from '../components/locais/PecasDeLocais';
import {
  MarcadoresDoMapa,
  estadoDoMarcador,
  iconeDoLocal,
  type PontoDoMapa,
} from '../components/locais/MarcadoresDoMapa';
import { ConfirmarExclusaoDoLocal } from '../components/locais/ConfirmarExclusaoDoLocal';
import iconeNovo from '../assets/icones/locais-novo.svg';
import iconeAbaMapa from '../assets/icones/locais-aba-mapa.svg';
import iconeAbaLista from '../assets/icones/locais-aba-lista.svg';
import iconeKpiLocais from '../assets/icones/locais-kpi-locais.svg';
import iconeKpiCarregadores from '../assets/icones/locais-kpi-carregadores.svg';
import iconeKpiDisponiveis from '../assets/icones/locais-kpi-disponiveis.svg';
import iconeKpiCarregando from '../assets/icones/locais-kpi-carregando.svg';
import iconeKpiProblema from '../assets/icones/locais-kpi-problema.svg';
import iconeKpiOffline from '../assets/icones/locais-kpi-offline.svg';
import iconeMais from '../assets/icones/locais-mapa-mais.svg';
import iconeMenos from '../assets/icones/locais-mapa-menos.svg';
import iconeLocalizar from '../assets/icones/locais-mapa-localizar.svg';
import iconePino from '../assets/icones/locais-pino.svg';

interface Location extends LocalResumo {
  chargePoints?: any[];
}

interface Charger {
  charge_point_id: string;
  description?: string;
  model?: string;
  address: string;
  latitude: number;
  longitude: number;
  isConnected: boolean;
  last_seen?: string | null;
  locationId?: number;
  ocppStatus?: string; // Available, Charging, Faulted, Preparing, etc.
}

type Aba = 'mapa' | 'lista';
type MapaLeaflet = ReturnType<typeof useMap>;

// Chips "Filtrar por status": o local entra pelo estado que mostra no mapa.
// O em instalação (ou sem carregador) só aparece em "Todas".
type FiltroDeStatus = 'todas' | 'operacional' | 'problema' | 'offline';
const CHIPS: { id: FiltroDeStatus; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'operacional', rotulo: 'Operacional' },
  { id: 'problema', rotulo: 'Problema' },
  { id: 'offline', rotulo: 'Offline' },
];

const TILE_CLARO = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_ESCURO = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

// Botões brancos sobre o mapa (Figma: zoom, enquadrar e o quadro de baixo).
const classeDoControle =
  'bg-white dark:bg-card text-[#37352f] dark:text-foreground inline-flex items-center justify-center transition hover:bg-[#f5f5f5] dark:hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed';

// Enquadra o mapa exatamente nos locais do operador (white label), em vez de um
// centro/zoom fixo apontado para o Brasil inteiro. Assim o operador cai direto
// onde estão seus carregadores. Um único local -> setView com zoom de rua;
// vários -> fitBounds cobrindo todos, com um teto de zoom para não colar demais.
// `pedido` muda quando o usuário pede para ver todos os locais de novo.
const FitToMarkers = ({ positions, pedido }: { positions: [number, number][]; pedido: number }) => {
  const map = useMap();
  const sig = positions.map(p => p.join(',')).join('|');
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
    } else {
      map.fitBounds(positions, { padding: [60, 60], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, sig, pedido]);
  return null;
};

// "Ver no mapa" da lista: aproxima no local escolhido (roda depois do FitToMarkers).
const IrParaOLocal = ({ alvo }: { alvo: { pos: [number, number]; vez: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (alvo) map.setView(alvo.pos, 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, alvo?.vez]);
  return null;
};

// Entrega o mapa aos botões do Figma (fora do Leaflet) e tira o zoom padrão do Leaflet.
const GuardarMapa = ({ aoCriar }: { aoCriar: (m: MapaLeaflet | null) => void }) => {
  const map = useMap();
  useEffect(() => {
    map.zoomControl?.remove();
    aoCriar(map);
    return () => aoCriar(null);
  }, [map, aoCriar]);
  return null;
};

export const Locations = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapDialogLocation, setMapDialogLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroDeStatus, setFiltroDeStatus] = useState<FiltroDeStatus>('todas');
  const [activeTab, setActiveTab] = useState<Aba>('mapa');
  const [modoDaLista, setModoDaLista] = useState<'grade' | 'lista'>('grade');
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [foco, setFoco] = useState<{ id: number; vez: number } | null>(null);
  const [pedidoDeEnquadrar, setPedidoDeEnquadrar] = useState(0);
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null);
  const [aExcluir, setAExcluir] = useState<Location | null>(null);
  const { chargerStatuses } = useSocket();
  const { user } = useAuth();
  const { isDark } = useTenant();
  const isAdmin = user?.role === 'admin';

  const mergedChargers = useMemo(() => {
    if (chargerStatuses.size === 0) return chargers;
    return chargers.map(charger => {
      const socketStatus = chargerStatuses.get(charger.charge_point_id);
      if (!socketStatus) return charger;
      return {
        ...charger,
        // 'Offline' vem da desconexão; os outros status vêm do próprio
        // carregador, conectado (Unavailable = fora de serviço).
        isConnected: socketStatus.status !== 'Offline',
        ocppStatus: socketStatus.status || charger.ocppStatus,
        last_seen: charger.last_seen ?? socketStatus.timestamp,
      };
    });
  }, [chargers, chargerStatuses]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, chRes] = await Promise.all([api.get('/locations/all'), api.get('/chargers')]);
      if (locRes.ok) { const d = await locRes.json(); setLocations(d.locations || []); }
      if (chRes.ok) {
        const d = await chRes.json();
        // O GET /chargers manda o status em ocpp_status; a tela só lia o do
        // socket e, sem evento, todo local aparecia Offline.
        setChargers(
          Array.isArray(d)
            ? d.map((c: Charger & { ocpp_status?: string | null }) => ({ ...c, ocppStatus: c.ocppStatus ?? c.ocpp_status ?? undefined }))
            : []
        );
      }
      // Os números na tela só são "de agora" quando as duas buscas chegaram.
      const ok = locRes.ok && chRes.ok;
      setFalhou(!ok);
      if (ok) setAtualizadoEm(new Date());
      else toast.error('Erro ao carregar dados');
    } catch {
      setFalhou(true);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Resumo de cada local: total, livres, em uso, instalados e o estado que mostra.
  const resumos = useMemo(() => {
    const estadosPorLocal = new Map<number, EstadoDoCarregador[]>();
    for (const c of mergedChargers) {
      if (c.locationId == null) continue;
      const lista = estadosPorLocal.get(c.locationId) ?? [];
      lista.push(estadoDoCarregador(c));
      estadosPorLocal.set(c.locationId, lista);
    }
    const m = new Map<number, ResumoDoLocal>();
    for (const loc of locations) {
      const estados = estadosPorLocal.get(loc.id) ?? [];
      m.set(loc.id, {
        total: loc.chargePoints?.length || estados.length,
        ativos: estados.filter(e => e === 'ativo').length,
        emUso: estados.filter(e => e === 'emUso').length,
        // Ocupação sobre os já instalados: o cadastrado que nunca ligou não
        // é carregador parado.
        instalados: estados.filter(e => e !== 'instalacao').length,
        estado: estadoDoLocal(estados),
      });
    }
    return m;
  }, [locations, mergedChargers]);

  const resumoDe = useCallback(
    (loc: Location): ResumoDoLocal =>
      resumos.get(loc.id) ?? { total: 0, ativos: 0, emUso: 0, instalados: 0, estado: 'instalacao' },
    [resumos]
  );

  // Contadores do topo (Figma): sempre da rede inteira, sem os filtros.
  const numeros = useMemo(() => {
    const ids = new Set(locations.map(l => l.id));
    const estados = mergedChargers
      .filter(c => c.locationId != null && ids.has(c.locationId))
      .map(estadoDoCarregador);
    const conta = (...es: EstadoDoCarregador[]) => estados.filter(e => es.includes(e)).length;
    return {
      mapeados: locations.filter(temCoordenadas).length,
      carregadores: locations.reduce((s, l) => s + (resumos.get(l.id)?.total ?? 0), 0),
      disponiveis: conta('ativo'),
      carregando: conta('emUso'),
      problema: conta('falha', 'indisponivel'),
      offline: conta('offline'),
    };
  }, [locations, mergedChargers, resumos]);

  // Busca por nome, endereço, cidade ou identificador (número do local ou ID
  // de um carregador dele), como pediu o estudo de usabilidade.
  const buscados = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const idsPorLocal = new Map<number, string[]>();
    for (const c of mergedChargers) {
      if (c.locationId == null) continue;
      idsPorLocal.set(c.locationId, [...(idsPorLocal.get(c.locationId) ?? []), (c.charge_point_id || '').toLowerCase()]);
    }
    const lista = !q
      ? locations
      : locations.filter(loc =>
          (loc.nomeDoLocal || '').toLowerCase().includes(q) ||
          (loc.endereco || '').toLowerCase().includes(q) ||
          (loc.cidade || '').toLowerCase().includes(q) ||
          String(loc.id) === q ||
          (idsPorLocal.get(loc.id) ?? []).some(id => id.includes(q))
        );
    // Locais com carregador online no topo (mais online primeiro); o resto mantém a ordem.
    const online = (loc: Location) => mergedChargers.filter(c => c.locationId === loc.id && c.isConnected).length;
    return lista
      .map((loc, ordem) => ({ loc, ordem, online: online(loc) }))
      .sort((a, b) => b.online - a.online || a.ordem - b.ordem)
      .map(({ loc }) => loc);
  }, [locations, searchQuery, mergedChargers]);

  const grupoDe = useCallback((loc: Location) => grupoDoLocal(resumoDe(loc)), [resumoDe]);

  const contagemDosChips = useMemo(() => {
    const c: Record<FiltroDeStatus, number> = { todas: buscados.length, operacional: 0, problema: 0, offline: 0 };
    for (const loc of buscados) {
      const g = grupoDe(loc);
      if (g === 'operacional' || g === 'problema' || g === 'offline') c[g] += 1;
    }
    return c;
  }, [buscados, grupoDe]);

  const filtered = useMemo(
    () => (filtroDeStatus === 'todas' ? buscados : buscados.filter(loc => grupoDe(loc) === filtroDeStatus)),
    [buscados, filtroDeStatus, grupoDe]
  );

  const noMapa = useMemo(() => filtered.filter(temCoordenadas), [filtered]);
  const selecionado = noMapa.find(l => l.id === selecionadoId) ?? noMapa[0] ?? null;

  const pontos = useMemo<PontoDoMapa[]>(
    () =>
      noMapa.map(loc => {
        const r = resumoDe(loc);
        return {
          id: loc.id,
          nome: loc.nomeDoLocal,
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
          estado: estadoDoMarcador(r.estado, r.total),
        };
      }),
    [noMapa, resumoDe]
  );

  // Map center: average of all location coordinates, or default to Manaus
  const mapCenter = useMemo<[number, number]>(() => {
    const withCoords = locations.filter(temCoordenadas);
    if (withCoords.length === 0) return [-3.119, -60.0217]; // Manaus
    const avgLat = withCoords.reduce((s, l) => s + Number(l.latitude), 0) / withCoords.length;
    const avgLng = withCoords.reduce((s, l) => s + Number(l.longitude), 0) / withCoords.length;
    return [avgLat, avgLng];
  }, [locations]);

  // Coordenadas dos locais com lat/lng válidos — usadas para enquadrar o mapa
  // exatamente na rede do operador (ver FitToMarkers).
  const locationPositions = useMemo<[number, number][]>(
    () => locations.filter(temCoordenadas).map(l => [Number(l.latitude), Number(l.longitude)] as [number, number]),
    [locations]
  );

  const alvoDoFoco = useMemo(() => {
    const loc = foco && locations.find(l => l.id === foco.id);
    return loc && foco ? { pos: [Number(loc.latitude), Number(loc.longitude)] as [number, number], vez: foco.vez } : null;
  }, [foco, locations]);

  const mudarDeAba = (aba: Aba) => {
    setFoco(null);
    setActiveTab(aba);
  };

  const verNoMapa = (loc: Location) => {
    setSelecionadoId(loc.id);
    setFoco({ id: loc.id, vez: Date.now() });
    setActiveTab('mapa');
  };

  const verTodos = () => {
    setFoco(null);
    setPedidoDeEnquadrar(n => n + 1);
  };

  const centralizarNoSelecionado = () => {
    if (!mapa || !selecionado) return;
    mapa.setView([Number(selecionado.latitude), Number(selecionado.longitude)], Math.max(mapa.getZoom(), 16));
  };

  const limparFiltros = () => {
    setSearchQuery('');
    setFiltroDeStatus('todas');
  };

  if (isAddingLocation) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
        <AddLocationForm
          onSuccess={() => { setIsAddingLocation(false); fetchData(); toast.success('Local adicionado!'); }}
          onCancel={() => setIsAddingLocation(false)}
        />
      </div>
    );
  }

  const semDados = locations.length === 0;
  const valor = (n: number) => (loading && semDados ? '—' : n);
  const filtrando = filtroDeStatus !== 'todas' || !!searchQuery.trim();

  // Vazio, carregando ou com erro (vale para as duas abas).
  const aviso = loading && semDados ? (
    <div className={`${classeDoCartao} flex flex-col items-center justify-center py-16`}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
      <p className="text-[15px] font-medium text-muted-foreground">Carregando locais…</p>
    </div>
  ) : falhou && semDados ? (
    <div className={`${classeDoCartao} flex flex-col items-center justify-center py-16 gap-3 text-center`}>
      <p className="text-[15px] font-medium text-foreground">Não foi possível carregar os locais.</p>
      <button type="button" onClick={() => void fetchData()} className={classeDoBotaoContorno}>
        Tentar de novo
      </button>
    </div>
  ) : semDados ? (
    <div className={`${classeDoCartao} flex flex-col items-center justify-center py-16 text-center`}>
      <p className="text-[15px] font-medium text-foreground">Nenhum local cadastrado</p>
      <p className="text-sm text-muted-foreground mt-1">Clique em "Novo local" para começar.</p>
    </div>
  ) : null;

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        rotulo="Visão geral da rede"
        titulo="Locais"
        subtitulo="Localize e monitore seus pontos de recarga"
        acoes={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 3xl:gap-8 [&_button]:shadow-[0_4px_4px_rgba(0,0,0,0.25)]">
            <button
              type="button"
              onClick={() => setIsAddingLocation(true)}
              className={`${classeDoBotaoPrincipal} sm:w-[201px]`}
            >
              <IconeSvg src={iconeNovo} />
              Novo local
            </button>
            <BotaoAtualizar
              aoAtualizar={() => void fetchData()}
              carregando={loading}
              atualizadoEm={atualizadoEm}
              falhou={falhou && !!atualizadoEm}
            />
          </div>
        }
      />

      {/* Abas do Figma: texto com ícone e o sublinhado verde de 5 px na ativa */}
      <nav aria-label="Modo de exibição dos locais" className="flex gap-[23px] overflow-x-auto">
        {([
          { id: 'mapa', rotulo: 'Visualização em mapa', icone: iconeAbaMapa },
          { id: 'lista', rotulo: 'Locais registrados', icone: iconeAbaLista },
        ] as const).map(a => {
          const ativa = activeTab === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => mudarDeAba(a.id)}
              aria-pressed={ativa}
              className="relative h-[46px] w-[220px] sm:w-[260px] shrink-0 pl-4 pb-1.5 inline-flex items-center gap-4 text-[15px] font-medium text-[#37352f] dark:text-foreground"
            >
              <IconeSvg src={a.icone} />
              {a.rotulo}
              <span
                aria-hidden="true"
                className={`absolute left-0 right-0 bottom-0 h-[5px] rounded-[25px] transition-colors ${
                  ativa ? 'bg-primary shadow-[0_4px_4px_rgba(0,0,0,0.25)]' : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* Contadores (Figma): rede inteira */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-6 gap-[17px]">
        <ContadorDeLocais
          rotulo="Locais mapeados"
          valor={valor(numeros.mapeados)}
          icone={<IconeSvg src={iconeKpiLocais} tamanho={48} className="text-primary-strong" />}
        />
        <ContadorDeLocais
          rotulo="Carregadores"
          valor={valor(numeros.carregadores)}
          icone={<IconeSvg src={iconeKpiCarregadores} tamanho={48} className="text-[#575757] dark:text-tom-cinza-icone" />}
        />
        <ContadorDeLocais
          rotulo="Disponíveis"
          valor={valor(numeros.disponiveis)}
          icone={<IconeSvg src={iconeKpiDisponiveis} tamanho={48} className="text-[#37352f] dark:text-foreground" />}
        />
        <ContadorDeLocais
          rotulo="Carregando"
          valor={valor(numeros.carregando)}
          icone={<IconeSvg src={iconeKpiCarregando} tamanho={48} altura={47} className="text-black dark:text-foreground" />}
        />
        <ContadorDeLocais
          rotulo="Problema"
          valor={valor(numeros.problema)}
          icone={<IconeSvg src={iconeKpiProblema} tamanho={48} className="text-[#fec80b]" />}
        />
        <ContadorDeLocais
          rotulo="Offline"
          valor={valor(numeros.offline)}
          icone={<IconeSvg src={iconeKpiOffline} tamanho={47} className="text-black dark:text-foreground" />}
        />
      </div>

      <BarraDeFiltros>
        <CampoDeBusca
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="Pesquisar local por nome, cidade ou identificador"
          title="Nome, endereço, cidade, número do local ou ID de um carregador"
          placeholder="Pesquisar"
        />
        <MenuFiltrarPorStatus
          opcoes={CHIPS.map(c => ({ id: c.id, rotulo: `${c.rotulo} (${contagemDosChips[c.id]})` }))}
          valor={filtroDeStatus}
          aoMudar={setFiltroDeStatus}
        />
        {CHIPS.map(chip => (
          <ChipComSeta key={chip.id} ativo={filtroDeStatus === chip.id} onClick={() => setFiltroDeStatus(chip.id)}>
            {chip.rotulo} ({contagemDosChips[chip.id]})
          </ChipComSeta>
        ))}
      </BarraDeFiltros>

      {aviso ??
        (activeTab === 'mapa' ? (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] 3xl:grid-cols-[minmax(0,1087fr)_minmax(0,470fr)] gap-[17px]">
            <section
              aria-label="Mapa dos locais"
              className={`${classeDoCartao} relative isolate overflow-hidden min-h-[460px] xl:min-h-[522px]`}
            >
              <div className="absolute inset-0">
                <DynamicMap center={mapCenter} zoom={locations.length > 1 ? 10 : 13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    key={isDark ? 'escuro' : 'claro'}
                    attribution='&copy; <a href="https://www.esri.com">Esri</a>'
                    url={isDark ? TILE_ESCURO : TILE_CLARO}
                  />
                  <GuardarMapa aoCriar={setMapa} />
                  <FitToMarkers positions={locationPositions} pedido={pedidoDeEnquadrar} />
                  <IrParaOLocal alvo={alvoDoFoco} />
                  <MarcadoresDoMapa pontos={pontos} selecionadoId={selecionado?.id ?? null} aoSelecionar={setSelecionadoId} />
                </DynamicMap>
              </div>
              {noMapa.length === 0 && (
                <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] px-5 py-3 rounded-[15px] bg-card shadow-cartao text-[15px] font-medium text-foreground text-center">
                  Nenhum local com coordenadas neste filtro.
                </p>
              )}
              {/* Controles do Figma: zoom e "ver todos" no canto de cima; centralizar embaixo */}
              <div className="absolute left-[29px] top-[19px] z-[1000] flex flex-col gap-[15px]">
                <div className="w-12 rounded-[5px] overflow-hidden flex flex-col">
                  <button type="button" onClick={() => mapa?.zoomIn()} aria-label="Aproximar" title="Aproximar" className={cn(classeDoControle, 'h-10')}>
                    <IconeSvg src={iconeMais} />
                  </button>
                  <button
                    type="button"
                    onClick={() => mapa?.zoomOut()}
                    aria-label="Afastar"
                    title="Afastar"
                    className={cn(classeDoControle, 'h-[43px] bg-[#ebebeb] dark:bg-muted')}
                  >
                    <IconeSvg src={iconeMenos} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={verTodos}
                  aria-label="Ver todos os locais"
                  title="Ver todos os locais"
                  className={cn(classeDoControle, 'w-12 h-[43px] rounded-[5px]')}
                >
                  <IconeSvg src={iconeLocalizar} />
                </button>
              </div>
              <button
                type="button"
                onClick={centralizarNoSelecionado}
                disabled={!selecionado}
                className={cn(
                  classeDoControle,
                  'absolute right-9 bottom-8 z-[1000] w-[234px] max-w-[calc(100%-2rem)] h-[43px] rounded-[5px] px-3 justify-start gap-3 text-sm font-medium'
                )}
              >
                <IconeSvg src={iconeLocalizar} />
                Centralizar no local
              </button>
            </section>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex xl:flex-col gap-[17px]">
              <LegendaDoMapa comEmInstalacao={pontos.some(p => p.estado === 'instalacao')} />
              <CartaoLocalSelecionado local={selecionado} resumo={selecionado ? resumoDe(selecionado) : null} />
            </div>
          </div>
        ) : (
          <div className="space-y-[14px]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[20px] font-semibold text-[#37352f] dark:text-foreground">
                {filtrando ? 'Locais encontrados' : 'Todos os locais'} ({filtered.length})
              </h2>
              <AlternarGradeLista modo={modoDaLista} aoMudar={setModoDaLista} />
            </div>
            {filtered.length === 0 ? (
              <div className={`${classeDoCartao} flex flex-col items-center justify-center py-16 gap-3 text-center`}>
                <p className="text-[15px] font-medium text-foreground">Nenhum local encontrado</p>
                <p className="text-sm text-muted-foreground">Tente outro termo de busca ou outro status.</p>
                <button type="button" onClick={limparFiltros} className={classeDoBotaoContorno}>
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div
                className={
                  modoDaLista === 'grade'
                    ? 'grid grid-cols-1 md:grid-cols-2 3xl:grid-cols-3 gap-[30px]'
                    : 'flex flex-col gap-[17px]'
                }
              >
                {filtered.map(loc => (
                  <CartaoDoLocal
                    key={loc.id}
                    local={loc}
                    resumo={resumoDe(loc)}
                    emLinha={modoDaLista === 'lista'}
                    aoVerDetalhes={() => navigate(`/locais/${loc.id}`)}
                    aoVerNoMapa={() => verNoMapa(loc)}
                    aoAbrirMapaDoLocal={() => { setMapDialogLocation(loc); setMapDialogOpen(true); }}
                    aoExcluir={isAdmin ? () => setAExcluir(loc) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

      {/* Mapa do local (item "Mapa do local" no menu "…" do cartão) */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="bg-card border-border rounded-[15px] p-0! overflow-hidden" style={{ maxWidth: '700px', width: '95vw', height: '80vh', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <VisuallyHidden><DialogTitle>Mapa do Local</DialogTitle></VisuallyHidden>
          {mapDialogLocation && (
            <>
              <div className="px-6 py-4 border-b border-border shrink-0">
                <h3 className="text-[20px] font-semibold text-foreground flex items-center gap-2">
                  <span className="text-primary-strong"><IconeSvg src={iconePino} /></span>
                  {mapDialogLocation.nomeDoLocal}
                </h3>
                <p className="text-sm font-medium text-muted-foreground mt-0.5">
                  {enderecoDoLocal(mapDialogLocation).filter(Boolean).join(', ')}
                </p>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <DynamicMap
                  center={[Number(mapDialogLocation.latitude), Number(mapDialogLocation.longitude)]}
                  zoom={16}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    key={isDark ? 'escuro' : 'claro'}
                    attribution='&copy; <a href="https://www.esri.com">Esri</a>'
                    url={isDark ? TILE_ESCURO : TILE_CLARO}
                  />
                  <Marker
                    position={[Number(mapDialogLocation.latitude), Number(mapDialogLocation.longitude)]}
                    icon={iconeDoLocal(
                      estadoDoMarcador(resumoDe(mapDialogLocation).estado, resumoDe(mapDialogLocation).total)
                    )}
                  />
                </DynamicMap>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmarExclusaoDoLocal
        local={aExcluir}
        carregadores={aExcluir ? (aExcluir.chargePoints?.length ?? null) : null}
        aoFechar={() => setAExcluir(null)}
        aoExcluir={() => { setAExcluir(null); fetchData(); }}
      />
    </div>
  );
};
