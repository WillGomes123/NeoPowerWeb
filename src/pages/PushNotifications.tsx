import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  ImagePlus,
  Loader2,
  MapPin,
  Send,
  Smartphone,
  Trash2,
  UserSearch,
  Users,
  X,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  BlocoDeIcone,
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
  type Tom,
} from '../components/painel/Pagina';
import {
  BarraDeFiltros,
  CampoDeBusca,
  classeDoBotaoPerigo,
  classeDoBotaoPrincipal,
  classeDoBotaoSecundario,
} from '../components/painel/Pecas';
import { Icone, IconeSvg } from '../components/painel/Icone';
import iconeCampanhas from '../assets/icones/notificacoes-campanhas.svg';
import iconeFalhas from '../assets/icones/notificacoes-falhas.svg';
import iconeAbaCampanhas from '../assets/icones/notificacoes-aba-campanhas.svg';
import iconeSetaMes from '../assets/icones/notificacoes-seta-mes.svg';
import iconeSemImagem from '../assets/icones/notificacoes-sem-imagem.svg';
import iconeMaisOpcoes from '../assets/icones/notificacoes-mais-opcoes.svg';
import iconeNova from '../assets/icones/notificacoes-nova.svg';

/*
 * Notificações Push — redesenho de nov/2026, à risca do Figma da Lauriane
 * (frame 185:3733): "Centro de mensagens", "Nova campanha" em pílula de
 * contorno e o "Atualizar"; a pílula do mês e a do "Mês em andamento"; quatro
 * cartões com a comparação com o mês anterior; a aba "Campanhas"; a barra de
 * filtros; a tabela de linhas verdes com "Ver detalhes" e o menu ⋮.
 * O mês recorta os cartões: campanhas, entregas e falhas do mês saem das
 * próprias campanhas (data do envio ou, sem envio, da criação), e o mês
 * anterior dá o "Outubro: …" e a variação. Dispositivos ativos é o número de
 * hoje (a API não guarda o histórico), sem comparação.
 * Correções do Figma: "R$" e o ícone de cifrão em dispositivos e "kWh" em
 * falhas (cópias de outra tela); sem a aba "Carregadores", que não tem dado.
 * A tabela mostra todas as campanhas (um rascunho do mês passado não some) e
 * tem os filtros da barra, inclusive o de datas.
 */

interface Campaign {
  id: number;
  title: string;
  message: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  targetAudience: 'all_users' | 'specific_location' | 'specific_users' | 'specific_profile';
  /** Marca dona da campanha; null = todas as marcas. */
  clientId?: string | null;
  locationId: number | null;
  profileId: number | null;
  sentCount: number;
  failedCount: number;
  /** Clientes que receberam a campanha dentro do app (sino), com ou sem push. */
  inAppCount?: number;
  /** Imagem do push e do sino (link https da versão leve no Cloudinary). */
  imageUrl?: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface PushStats {
  activeTokens: number;
  totalCampaigns: number;
  totalSent: number;
  totalFailed: number;
  campaignsByStatus: {
    draft: number;
    scheduled: number;
    sent: number;
    failed: number;
  };
}

interface Location {
  id: number;
  nomeDoLocal: string;
}

interface MarcaOpcao {
  clientId: string;
  companyName: string;
}

interface ProfileOption {
  id: number;
  name: string;
  color?: string | null;
}

// Pílulas de status do Figma (sem ícone: o texto já diz o estado). "Enviada" é
// o verde cheio do Figma; as outras usam tons fixos de estado.
const VERMELHO = 'bg-[#fedbd5] text-[#c00000] dark:bg-[#4a1d17] dark:text-[#ff8a75]';

const statusConfig: Record<Campaign['status'], { label: string; classe: string }> = {
  draft: {
    label: 'Rascunho',
    classe: 'bg-[#e9e9ec] text-[#4d4d4d] dark:bg-muted dark:text-muted-foreground',
  },
  scheduled: { label: 'Agendada', classe: 'bg-tom-azul text-estado-uso-forte' },
  sending: { label: 'Enviando', classe: 'bg-estado-problema text-estado-problema-forte' },
  sent: { label: 'Enviada', classe: 'bg-primary text-primary-foreground' },
  failed: { label: 'Falhou', classe: VERMELHO },
};

const audienceLabels = {
  all_users: 'Todos os usuários',
  specific_location: 'Local específico',
  specific_users: 'Usuários específicos',
  specific_profile: 'Perfil específico',
};

// Valores que a API entende no clientId da campanha (super-admin).
const MARCA_PADRAO = 'neopower-default';
const TODAS_AS_MARCAS = 'todas';
// Filtro "Marca": campanha sem marca (foi para todas as marcas).
const SEM_MARCA = '__todas_as_marcas__';

/** Ids de usuário digitados ou vindos do link (separados por vírgula, espaço ou linha). */
const idsDosUsuarios = (texto: string): number[] => [
  ...new Set(
    texto
      .split(/[\s,;]+/)
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0)
  ),
];

// Imagem da campanha: os mesmos limites da API (POST /push/campaigns/imagem).
const TIPOS_DE_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO_DA_IMAGEM = 5 * 1024 * 1024;

/** Pílula dos filtros da barra (190 × 43 no Figma), com a seta para baixo. */
const classeDoFiltro =
  'h-[43px] data-[size=default]:h-[43px] w-full sm:w-auto sm:min-w-[190px] rounded-[25px] border border-foreground dark:border-border bg-card pl-[30px] pr-[18px] gap-3 ' +
  'text-[15px] font-medium text-foreground hover:bg-card hover:text-foreground data-[placeholder]:text-foreground [&>svg]:opacity-100';

// Filtro "Datas": períodos contados a partir de hoje.
const PERIODOS = {
  todas: { label: 'Todas', dias: null },
  hoje: { label: 'Hoje', dias: 1 },
  '7': { label: 'Últimos 7 dias', dias: 7 },
  '30': { label: 'Últimos 30 dias', dias: 30 },
  '90': { label: 'Últimos 90 dias', dias: 90 },
} as const;
type Periodo = keyof typeof PERIODOS;

/** Cabeçalho da tabela do Figma: maiúsculas, sem fundo (as linhas é que têm). */
const classeDoTh =
  'px-3 3xl:px-4 pb-1 text-left text-[13px] 3xl:text-[15px] font-semibold uppercase text-foreground whitespace-nowrap';

/** Célula das linhas verdes do Figma; a primeira e a última arredondam a linha. */
const classeDoTd =
  'px-3 3xl:px-4 py-3 3xl:py-[25px] align-middle bg-primary/[0.14] first:rounded-l-[15px] last:rounded-r-[15px]';

const classeDoRotulo = 'text-sm font-medium text-foreground';
const classeDoCampo = 'bg-background border-border text-foreground';

const numero = (n: number) => n.toLocaleString('pt-BR');
const comMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const inicioDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const somarMeses = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
/** Data que vale para a campanha: o envio ou, sem envio, a criação. */
const dataDaCampanha = (c: Campaign) => new Date(c.sentAt || c.createdAt);

export const PushNotifications = () => {
  const { user } = useAuth();
  // Admin da plataforma (sem marca) escolhe para qual marca vai a campanha.
  // Antes a campanha dele ia para os clientes de todas as white labels.
  const isSuperAdmin = user?.role === 'admin' && !user?.branding?.clientId;
  const [marcas, setMarcas] = useState<MarcaOpcao[]>([]);
  const [marca, setMarca] = useState<string>(MARCA_PADRAO);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<PushStats | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  // A última busca falhou: a tela mostra os dados de antes.
  const [falhou, setFalhou] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  // Campanha aberta no "Ver detalhes".
  const [detalhe, setDetalhe] = useState<Campaign | null>(null);

  // Filtros da tabela
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | Campaign['status']>('todos');
  const [filtroMarca, setFiltroMarca] = useState('todas');
  const [filtroPublico, setFiltroPublico] = useState<'todos' | Campaign['targetAudience']>('todos');
  const [filtroDatas, setFiltroDatas] = useState<Periodo>('todas');
  // Mês dos cartões (a pílula "‹ Novembro de 2026 ›").
  const [mes, setMes] = useState(() => inicioDoMes(new Date()));

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<string>('all_users');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [imagem, setImagem] = useState<string | null>(null);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  // Público "Usuários Específicos": os ids, e o nome de cada um para conferir.
  const [usuariosEscolhidos, setUsuariosEscolhidos] = useState('');
  const [nomeDoUsuario, setNomeDoUsuario] = useState<Record<number, string>>({});
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchData();
  }, []);

  // Campanha preenchida pelo link (?publico=specific_users&usuarios=1,2,3&titulo=…
  // &mensagem=…&marca=…): abre a criação já pronta, para só conferir e criar.
  useEffect(() => {
    if (searchParams.get('publico') !== 'specific_users') return;
    setTargetAudience('specific_users');
    setUsuariosEscolhidos(searchParams.get('usuarios') ?? '');
    setTitle(searchParams.get('titulo') ?? '');
    setMessage(searchParams.get('mensagem') ?? '');
    const marcaDoLink = searchParams.get('marca');
    if (marcaDoLink) setMarca(marcaDoLink);
    setDialogOpen(true);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nomes das contas escolhidas, para conferir antes de criar.
  useEffect(() => {
    if (targetAudience !== 'specific_users' || Object.keys(nomeDoUsuario).length > 0) return;
    void (async () => {
      try {
        const r = await api.get('/admin/users');
        if (!r.ok) return;
        const lista: Array<{ id: number; name?: string; email?: string }> = await r.json();
        if (!Array.isArray(lista)) return;
        setNomeDoUsuario(
          Object.fromEntries(lista.map(u => [u.id, u.name || u.email || `#${u.id}`]))
        );
      } catch {
        // Sem a lista, a tela mostra só os números.
      }
    })();
  }, [targetAudience, nomeDoUsuario]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void (async () => {
      try {
        const r = await api.get('/admin/branding');
        if (!r.ok) return;
        const data = await r.json();
        const brutas: Array<{ clientId?: string; companyName?: string }> = Array.isArray(data)
          ? data
          : data?.payload || [];
        const lista: MarcaOpcao[] = brutas
          .filter((b): b is { clientId: string; companyName?: string } => !!b?.clientId)
          .map(b => ({ clientId: b.clientId, companyName: b.companyName || b.clientId }));
        if (!lista.some(m => m.clientId === MARCA_PADRAO)) {
          lista.unshift({ clientId: MARCA_PADRAO, companyName: 'NeoPower' });
        }
        setMarcas(lista);
      } catch {
        // sem a lista, fica só a NeoPower (padrão da API)
      }
    })();
  }, [isSuperAdmin]);

  const nomeDaMarca = (clientId: string | null | undefined) =>
    clientId == null
      ? 'Todas as marcas'
      : (marcas.find(m => m.clientId === clientId)?.companyName ?? clientId);

  const fetchData = async () => {
    setAtualizando(true);
    try {
      const [campaignsRes, statsRes, locationsRes, profilesRes] = await Promise.all([
        api.get('/push/campaigns'),
        api.get('/push/stats'),
        api.get('/locations/all'),
        api.get('/profiles'),
      ]);

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setLocations(data.locations || []);
      }

      if (profilesRes.ok) {
        setProfiles(await profilesRes.json());
      }

      // Campanhas e totais são o que a tela mostra: sem eles, a busca falhou.
      if (campaignsRes.ok && statsRes.ok) {
        setAtualizadoEm(new Date());
        setFalhou(false);
      } else {
        setFalhou(true);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados');
      setFalhou(true);
    } finally {
      setAtualizando(false);
      setLoading(false);
    }
  };

  // A imagem sobe antes da campanha: a API guarda no Cloudinary e devolve o
  // link de uma versão leve, que vai na criação da campanha.
  const handleImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // deixa escolher o mesmo arquivo de novo
    if (!file) return;
    if (!TIPOS_DE_IMAGEM.includes(file.type)) {
      toast.error('Use uma imagem JPG, PNG ou WebP');
      return;
    }
    if (file.size > TAMANHO_MAXIMO_DA_IMAGEM) {
      toast.error('A imagem deve ter no máximo 5 MB');
      return;
    }
    setEnviandoImagem(true);
    const fd = new FormData();
    fd.append('imagem', file);
    try {
      const response = await api.post('/push/campaigns/imagem', fd);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Erro ao enviar a imagem');
      }
      setImagem(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar a imagem');
    } finally {
      setEnviandoImagem(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Preencha o título e a mensagem');
      return;
    }

    if (targetAudience === 'specific_location' && !selectedLocation) {
      toast.error('Selecione um local');
      return;
    }
    if (targetAudience === 'specific_profile' && !selectedProfile) {
      toast.error('Selecione um perfil');
      return;
    }
    if (targetAudience === 'specific_users' && idsDosUsuarios(usuariosEscolhidos).length === 0) {
      toast.error('Informe os ids dos usuários');
      return;
    }

    if (
      isSuperAdmin &&
      marca === TODAS_AS_MARCAS &&
      !confirm(
        'Esta campanha vai para os clientes de TODAS as marcas, white labels incluídas. Continuar?'
      )
    ) {
      return;
    }

    try {
      const payload: any = {
        title: title.trim(),
        message: message.trim(),
        targetAudience,
      };
      if (isSuperAdmin) {
        payload.clientId = marca;
      }

      if (targetAudience === 'specific_location' && selectedLocation) {
        payload.locationId = parseInt(selectedLocation);
      }
      if (targetAudience === 'specific_profile' && selectedProfile) {
        payload.profileId = parseInt(selectedProfile);
      }
      if (targetAudience === 'specific_users') {
        payload.userIds = idsDosUsuarios(usuariosEscolhidos);
      }
      if (imagem) {
        payload.imageUrl = imagem;
      }

      const response = await api.post('/push/campaigns', payload);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Erro ao criar campanha');
      }

      toast.success('Campanha criada com sucesso!');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar campanha');
    }
  };

  /** Envia a campanha (depois de confirmar). Devolve true se foi enviada. */
  const handleSendCampaign = async (campaign: Campaign): Promise<boolean> => {
    const { id } = campaign;
    const publico = audienceLabels[campaign.targetAudience].toLowerCase();
    const daMarca = isSuperAdmin ? ` (${nomeDaMarca(campaign.clientId)})` : '';
    if (
      !confirm(
        `Enviar "${campaign.title}" para ${publico}${daMarca}? O push chega nos celulares na hora e não dá para desfazer.`
      )
    ) {
      return false;
    }
    setSending(id);
    try {
      const response = await api.post(`/push/campaigns/${id}/send`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao enviar');
      }

      const data = await response.json();
      // O push só chega a quem tem aparelho cadastrado; no app, chega a todo o
      // público da marca. API antiga não manda o "inApp": fica a mensagem de antes.
      toast.success(
        typeof data.inApp === 'number'
          ? `Campanha enviada! ${data.inApp} clientes no app, ${data.sent} por push` +
              (data.failed ? `, ${data.failed} falharam` : '')
          : `Campanha enviada! ${data.sent} enviados, ${data.failed} falharam`
      );
      fetchData();
      return true;
    } catch (error: any) {
      console.error('Erro ao enviar campanha:', error);
      toast.error(error.message || 'Erro ao enviar campanha');
      return false;
    } finally {
      setSending(null);
    }
  };

  /** Exclui a campanha (depois de confirmar). Devolve true se foi excluída. */
  const handleDeleteCampaign = async (campaign: Campaign): Promise<boolean> => {
    const jaEnviada = campaign.status === 'sent' || campaign.sentCount > 0;
    if (
      !confirm(
        `Excluir a campanha "${campaign.title}"? Ela sai desta lista` +
          (jaEnviada
            ? ' e os envios dela deixam de contar nos totais. Os pushes já entregues continuam nos celulares.'
            : '.') +
          ' Não dá para desfazer.'
      )
    ) {
      return false;
    }

    try {
      const response = await api.delete(`/push/campaigns/${campaign.id}`);

      if (!response.ok) {
        throw new Error('Erro ao excluir');
      }

      toast.success('Campanha excluída');
      fetchData();
      return true;
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      toast.error('Erro ao excluir campanha');
      return false;
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setTargetAudience('all_users');
    setSelectedLocation('');
    setSelectedProfile('');
    setUsuariosEscolhidos('');
    setMarca(MARCA_PADRAO);
    setImagem(null);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  /** O local ou o perfil do público, quando a campanha é para um só. */
  const detalheDoPublico = (c: Campaign): string | null => {
    if (c.targetAudience === 'specific_location' && c.locationId != null) {
      return locations.find(l => l.id === c.locationId)?.nomeDoLocal ?? `Local #${c.locationId}`;
    }
    if (c.targetAudience === 'specific_profile' && c.profileId != null) {
      return profiles.find(p => p.id === c.profileId)?.name ?? `Perfil #${c.profileId}`;
    }
    return null;
  };

  // Marcas do filtro: as cadastradas e as que aparecem nas campanhas.
  const marcasDoFiltro = useMemo(() => {
    const lista = [...marcas];
    for (const c of campaigns) {
      if (c.clientId && !lista.some(m => m.clientId === c.clientId)) {
        lista.push({ clientId: c.clientId, companyName: c.clientId });
      }
    }
    return lista;
  }, [marcas, campaigns]);

  const campanhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const dias = PERIODOS[filtroDatas].dias;
    let inicio: Date | null = null;
    if (dias) {
      inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      inicio.setDate(inicio.getDate() - (dias - 1));
    }
    return campaigns.filter(c => {
      if (termo && !`${c.title} ${c.message}`.toLowerCase().includes(termo)) return false;
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      if (filtroMarca !== 'todas') {
        if (filtroMarca === SEM_MARCA ? c.clientId != null : c.clientId !== filtroMarca) {
          return false;
        }
      }
      if (filtroPublico !== 'todos' && c.targetAudience !== filtroPublico) return false;
      if (inicio && dataDaCampanha(c) < inicio) return false;
      return true;
    });
  }, [campaigns, busca, filtroStatus, filtroMarca, filtroPublico, filtroDatas]);

  // Números do mês escolhido e do anterior, a partir das campanhas.
  const numerosDoMes = (inicio: Date) => {
    const fim = somarMeses(inicio, 1);
    const doMes = campaigns.filter(c => {
      const quando = dataDaCampanha(c);
      return quando >= inicio && quando < fim;
    });
    return {
      campanhas: doMes.length,
      entregas: doMes.reduce((t, c) => t + (c.sentCount || 0), 0),
      falhas: doMes.reduce((t, c) => t + (c.failedCount || 0), 0),
    };
  };
  const doMes = numerosDoMes(mes);
  const doMesAnterior = numerosDoMes(somarMeses(mes, -1));
  const eMesAtual = mes.getTime() === inicioDoMes(new Date()).getTime();
  const nomeDoMes = comMaiuscula(
    mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  );
  const nomeDoMesAnterior = comMaiuscula(
    somarMeses(mes, -1).toLocaleDateString('pt-BR', { month: 'long' })
  );
  const variacao = (agora: number, antes: number) =>
    antes > 0 ? ((agora - antes) / antes) * 100 : undefined;

  const temFiltro =
    !!busca.trim() ||
    filtroStatus !== 'todos' ||
    filtroMarca !== 'todas' ||
    filtroPublico !== 'todos' ||
    filtroDatas !== 'todas';

  const limparFiltros = () => {
    setBusca('');
    setFiltroStatus('todos');
    setFiltroMarca('todas');
    setFiltroPublico('todos');
    setFiltroDatas('todas');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // "dados até 14/11 06:43": a hora em que os números chegaram.
  const dadosAte = atualizadoEm
    ? `${atualizadoEm.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        rotulo="Centro de mensagens"
        titulo="Notificações Push"
        subtitulo="Crie, envie e acompanhe campanhas de comunicação"
        detalhe={
          <div className="mt-[15px] flex flex-wrap items-center gap-[17px]">
            <SeletorDeMes
              nome={nomeDoMes}
              aoVoltar={() => setMes(m => somarMeses(m, -1))}
              aoAvancar={() => setMes(m => somarMeses(m, 1))}
              podeAvancar={!eMesAtual}
            />
            {eMesAtual && (
              <span className="h-[43px] px-9 rounded-[25px] border border-tom-azul-icone bg-[#e6f4fe] dark:bg-tom-azul text-estado-uso-forte text-[11px] inline-flex items-center shadow-pilula">
                <span>
                  <span className="font-semibold">Mês em andamento</span>
                  {dadosAte && ` dados até ${dadosAte}`}
                </span>
              </span>
            )}
          </div>
        }
        acoes={
          <>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={`${classeDaPilula} inline-flex items-center justify-center active:scale-[0.98] transition`}
            >
              <IconeSvg src={iconeNova} tamanho={24} />
              Nova campanha
            </button>
            <BotaoAtualizar
              aoAtualizar={() => void fetchData()}
              carregando={atualizando}
              atualizadoEm={atualizadoEm}
              falhou={falhou}
            />
          </>
        }
      />

      {/* Cartões do mês: o mês anterior dá a comparação embaixo. */}
      <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[22px]">
        <CartaoDeNumero
          icone={<Smartphone className="w-6 h-6" aria-hidden="true" />}
          titulo="Dispositivos ativos"
          valor={stats ? numero(stats.activeTokens) : '—'}
        />
        <CartaoDeNumero
          icone={
            <span className="text-tom-azul-icone inline-flex">
              <IconeSvg src={iconeCampanhas} tamanho={28} altura={29} />
            </span>
          }
          titulo="Campanhas"
          valor={numero(doMes.campanhas)}
          variacao={variacao(doMes.campanhas, doMesAnterior.campanhas)}
          comparacao={`${nomeDoMesAnterior}: ${numero(doMesAnterior.campanhas)}`}
        />
        <CartaoDeNumero
          titulo="Entregas com sucesso"
          valor={numero(doMes.entregas)}
          variacao={variacao(doMes.entregas, doMesAnterior.entregas)}
          comparacao={`${nomeDoMesAnterior}: ${numero(doMesAnterior.entregas)}`}
        />
        <CartaoDeNumero
          icone={<IconeSvg src={iconeFalhas} tamanho={26} altura={28} />}
          titulo="Falhas na entrega"
          valor={numero(doMes.falhas)}
          variacao={variacao(doMes.falhas, doMesAnterior.falhas)}
          comparacao={`${nomeDoMesAnterior}: ${numero(doMesAnterior.falhas)}`}
          subirEPior
        />
      </div>

      {/* A aba "Campanhas" (a de "Carregadores" saiu: não tem dado) e os filtros. */}
      <div className="pt-6 space-y-[19px]">
        <h2 className="w-fit h-[43px] pl-[29px] pr-8 rounded-[25px] bg-primary text-primary-foreground text-[15px] font-semibold inline-flex items-center gap-[7px] shadow-pilula">
          <IconeSvg src={iconeAbaCampanhas} tamanho={24} />
          Campanhas
        </h2>

        <BarraDeFiltros>
          <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[240px] 3xl:max-w-[703px] [&>label]:max-w-none">
            <CampoDeBusca
              value={busca}
              onChange={e => setBusca(e.target.value)}
              aria-label="Pesquisar campanha pelo título ou pela mensagem"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 3xl:gap-[18px] w-full sm:w-auto 3xl:ml-auto">
            <Select
              value={filtroStatus}
              onValueChange={v => setFiltroStatus(v as typeof filtroStatus)}
            >
              <SelectTrigger className={classeDoFiltro} aria-label="Filtrar por status">
                <SelectValue>
                  Status: {filtroStatus === 'todos' ? 'Todos' : statusConfig[filtroStatus].label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(statusConfig) as Campaign['status'][]).map(s => (
                  <SelectItem key={s} value={s}>
                    {statusConfig[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Só a plataforma vê campanhas de mais de uma marca. */}
            {isSuperAdmin && (
              <Select value={filtroMarca} onValueChange={setFiltroMarca}>
                <SelectTrigger className={classeDoFiltro} aria-label="Filtrar por marca">
                  <SelectValue>
                    Marca:{' '}
                    {filtroMarca === 'todas'
                      ? 'Todas'
                      : filtroMarca === SEM_MARCA
                        ? 'Todas as marcas'
                        : nomeDaMarca(filtroMarca)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="todas">Todas</SelectItem>
                  {marcasDoFiltro.map(m => (
                    <SelectItem key={m.clientId} value={m.clientId}>
                      {m.companyName}
                    </SelectItem>
                  ))}
                  <SelectItem value={SEM_MARCA}>Para todas as marcas</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select
              value={filtroPublico}
              onValueChange={v => setFiltroPublico(v as typeof filtroPublico)}
            >
              <SelectTrigger className={classeDoFiltro} aria-label="Filtrar por público">
                <SelectValue>
                  Públicos: {filtroPublico === 'todos' ? 'Todos' : audienceLabels[filtroPublico]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(audienceLabels) as Campaign['targetAudience'][]).map(a => (
                  <SelectItem key={a} value={a}>
                    {audienceLabels[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroDatas} onValueChange={v => setFiltroDatas(v as Periodo)}>
              <SelectTrigger className={classeDoFiltro} aria-label="Filtrar por data">
                <SelectValue>Datas: {PERIODOS[filtroDatas].label}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(Object.keys(PERIODOS) as Periodo[]).map(p => (
                  <SelectItem key={p} value={p}>
                    {PERIODOS[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </BarraDeFiltros>
      </div>

      {/* Tabela de campanhas */}
      <section className={`${classeDoCartao} px-[13px] pt-[18px] pb-[13px]`} aria-label="Campanhas">
        {campaigns.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[15px] font-semibold text-foreground">
              Nenhuma campanha criada ainda
            </p>
            <p className="text-sm mt-1 text-muted-foreground">
              Clique em "Nova campanha" para começar
            </p>
          </div>
        ) : campanhasFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[15px] font-semibold text-foreground">
              Nenhuma campanha com estes filtros
            </p>
            {temFiltro && (
              <button
                type="button"
                onClick={limparFiltros}
                className="mt-2 text-sm font-medium text-primary-strong hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-[14px] text-sm 3xl:text-[15px] text-foreground">
              <thead>
                <tr>
                  <th className={`${classeDoTh} 3xl:pl-[32px]`}>Campanha</th>
                  <th className={`${classeDoTh} hidden 3xl:table-cell`}>Mensagem prévia</th>
                  {isSuperAdmin && <th className={classeDoTh}>Marca</th>}
                  <th className={classeDoTh}>Público</th>
                  <th className={classeDoTh}>Status</th>
                  <th className={classeDoTh}>Alcance</th>
                  <th className={classeDoTh}>Data</th>
                  <th className={classeDoTh}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campanhasFiltradas.map(campaign => {
                  const podeEnviar = campaign.status === 'draft' || campaign.status === 'scheduled';
                  const quando = dataDaCampanha(campaign);
                  return (
                    <tr key={campaign.id}>
                      <td className={`${classeDoTd} 3xl:pl-[31px]`}>
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Miniatura url={campaign.imageUrl} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-[1.15] line-clamp-2 max-w-[222px]">
                              {campaign.title}
                            </p>
                            {/* No estreito a "Mensagem prévia" vem aqui, sob o título. */}
                            <p className="3xl:hidden mt-0.5 text-[13px] text-muted-foreground line-clamp-1 max-w-[222px]">
                              {campaign.message}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={`${classeDoTd} hidden 3xl:table-cell`}>
                        <p className="max-w-[280px] line-clamp-2 leading-[1.389]">
                          {campaign.message}
                        </p>
                      </td>
                      {isSuperAdmin && (
                        <td className={classeDoTd}>{nomeDaMarca(campaign.clientId)}</td>
                      )}
                      <td className={classeDoTd}>
                        <span className="block max-w-[110px] leading-[1.389]">
                          {audienceLabels[campaign.targetAudience]}
                        </span>
                      </td>
                      <td className={classeDoTd}>
                        <PilulaDeStatus status={campaign.status} />
                      </td>
                      <td className={`${classeDoTd} whitespace-nowrap leading-[1.389]`}>
                        <Alcance campaign={campaign} />
                      </td>
                      <td className={`${classeDoTd} whitespace-nowrap leading-[1.389]`}>
                        <span className="block">{quando.toLocaleDateString('pt-BR')}</span>
                        <span className="block">
                          {quando.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className={classeDoTd}>
                        <div className="flex items-center gap-1 3xl:gap-[18px]">
                          <button
                            type="button"
                            onClick={() => setDetalhe(campaign)}
                            className="h-10 3xl:h-[43px] px-4 3xl:px-[25px] rounded-[25px] border border-primary bg-transparent text-primary-strong text-sm 3xl:text-[15px] font-semibold whitespace-nowrap shadow-pilula hover:bg-primary-soft transition"
                          >
                            Ver detalhes
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Mais ações: ${campaign.title}`}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-foreground hover:bg-card transition"
                              >
                                <IconeSvg src={iconeMaisOpcoes} tamanho={24} />
                              </button>
                            </DropdownMenuTrigger>
                            {/* "Ver detalhes" fica só no botão: abrir um Dialog de
                                dentro do menu deixa a página sem clique (Radix). */}
                            <DropdownMenuContent align="end" className="min-w-[200px]">
                              {podeEnviar && (
                                <>
                                  <DropdownMenuItem
                                    disabled={sending === campaign.id}
                                    onSelect={() => void handleSendCampaign(campaign)}
                                  >
                                    <Send aria-hidden="true" />
                                    {sending === campaign.id ? 'Enviando...' : 'Enviar agora'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={campaign.status === 'sending'}
                                onSelect={() => void handleDeleteCampaign(campaign)}
                              >
                                <Trash2 aria-hidden="true" />
                                Excluir campanha
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ver detalhes */}
      <Dialog open={!!detalhe} onOpenChange={aberto => !aberto && setDetalhe(null)}>
        {detalhe && (
          <DialogContent className="bg-card border-border sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[20px] font-semibold text-foreground pr-6">
                {detalhe.title}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Criada em {formatDate(detalhe.createdAt)}
              </DialogDescription>
            </DialogHeader>

            {detalhe.imageUrl && (
              <img
                src={detalhe.imageUrl}
                alt="Imagem da campanha"
                className="w-full max-h-56 object-cover rounded-[15px]"
              />
            )}

            <div className="rounded-[15px] bg-primary/[0.14] px-4 py-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Mensagem</p>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                {detalhe.message}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <ItemDoDetalhe rotulo="Status">
                <PilulaDeStatus status={detalhe.status} />
              </ItemDoDetalhe>
              <ItemDoDetalhe rotulo="Público">
                {audienceLabels[detalhe.targetAudience]}
                {detalheDoPublico(detalhe) && (
                  <span className="block text-xs text-muted-foreground">
                    {detalheDoPublico(detalhe)}
                  </span>
                )}
              </ItemDoDetalhe>
              {isSuperAdmin && (
                <ItemDoDetalhe rotulo="Marca">{nomeDaMarca(detalhe.clientId)}</ItemDoDetalhe>
              )}
              <ItemDoDetalhe rotulo="Alcance">
                <Alcance campaign={detalhe} />
              </ItemDoDetalhe>
              {detalhe.scheduledAt && (
                <ItemDoDetalhe rotulo="Agendada para">
                  {formatDate(detalhe.scheduledAt)}
                </ItemDoDetalhe>
              )}
              <ItemDoDetalhe rotulo="Enviada em">{formatDate(detalhe.sentAt)}</ItemDoDetalhe>
            </dl>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
              <button
                type="button"
                disabled={detalhe.status === 'sending'}
                onClick={() => {
                  void handleDeleteCampaign(detalhe).then(ok => ok && setDetalhe(null));
                }}
                className={classeDoBotaoPerigo}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Excluir
              </button>
              <div className="ml-auto flex gap-3">
                <button
                  type="button"
                  onClick={() => setDetalhe(null)}
                  className={`${classeDoBotaoSecundario} h-10`}
                >
                  Fechar
                </button>
                {(detalhe.status === 'draft' || detalhe.status === 'scheduled') && (
                  <button
                    type="button"
                    disabled={sending === detalhe.id}
                    onClick={() => {
                      void handleSendCampaign(detalhe).then(ok => ok && setDetalhe(null));
                    }}
                    className={`${classeDoBotaoPrincipal} h-10`}
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    {sending === detalhe.id ? 'Enviando...' : 'Enviar agora'}
                  </button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Nova campanha */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-foreground">
              Nova campanha
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crie uma notificação para enviar aos usuários do aplicativo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className={classeDoRotulo}>Título da notificação</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Promoção Especial!"
                className={classeDoCampo}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">{title.length}/100 caracteres</p>
            </div>

            <div className="space-y-2">
              <label className={classeDoRotulo}>Mensagem</label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite a mensagem da notificação..."
                className={`${classeDoCampo} min-h-[100px]`}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{message.length}/500 caracteres</p>
            </div>

            <div className="space-y-2">
              <label className={classeDoRotulo}>Imagem (opcional)</label>
              {imagem ? (
                <div className="relative">
                  <img
                    src={imagem}
                    alt="Imagem da campanha"
                    className="w-full max-h-48 object-cover rounded-[15px] border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setImagem(null)}
                    title="Tirar a imagem"
                    aria-label="Tirar a imagem"
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/90 text-foreground flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-[15px] border border-dashed border-border text-muted-foreground text-sm transition-colors ${
                    enviandoImagem ? 'opacity-60' : 'cursor-pointer hover:bg-muted'
                  }`}
                >
                  {enviandoImagem ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="w-4 h-4" aria-hidden="true" />
                  )}
                  {enviandoImagem ? 'Enviando a imagem...' : 'Escolher imagem'}
                  <input
                    type="file"
                    accept={TIPOS_DE_IMAGEM.join(',')}
                    className="hidden"
                    disabled={enviandoImagem}
                    onChange={e => void handleImagem(e)}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">
                JPG, PNG ou WebP de até 5 MB. Imagem larga (2:1, como 1024×512) fica melhor. Aparece
                no push do Android e na lista de notificações do app. No push do iPhone, só a partir
                da próxima versão do app na App Store.
              </p>
            </div>

            {isSuperAdmin && (
              <div className="space-y-2">
                <label className={classeDoRotulo}>Marca</label>
                <Select value={marca} onValueChange={setMarca}>
                  <SelectTrigger className={classeDoCampo}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {(marcas.length
                      ? marcas
                      : [{ clientId: MARCA_PADRAO, companyName: 'NeoPower' }]
                    ).map(m => (
                      <SelectItem key={m.clientId} value={m.clientId}>
                        {m.companyName}
                      </SelectItem>
                    ))}
                    <SelectItem value={TODAS_AS_MARCAS} className="text-destructive">
                      Todas as marcas (white labels incluídas)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Só os clientes desta marca recebem. Para teste, use um perfil ou local específico.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className={classeDoRotulo}>Público-alvo</label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger className={classeDoCampo}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all_users">
                    <Users aria-hidden="true" />
                    Todos os usuários
                  </SelectItem>
                  <SelectItem value="specific_location">
                    <MapPin aria-hidden="true" />
                    Local específico
                  </SelectItem>
                  <SelectItem value="specific_profile">
                    <BadgeCheck aria-hidden="true" />
                    Perfil específico
                  </SelectItem>
                  <SelectItem value="specific_users">
                    <UserSearch aria-hidden="true" />
                    Usuários específicos
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetAudience === 'specific_location' && (
              <div className="space-y-2">
                <label className={classeDoRotulo}>Selecione o local</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className={classeDoCampo}>
                    <SelectValue placeholder="Escolha um local" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.nomeDoLocal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetAudience === 'specific_profile' && (
              <div className="space-y-2">
                <label className={classeDoRotulo}>Selecione o perfil</label>
                <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                  <SelectTrigger className={classeDoCampo}>
                    <SelectValue placeholder="Escolha um perfil" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {profiles.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nenhum perfil cadastrado
                      </div>
                    )}
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetAudience === 'specific_users' && (
              <div className="space-y-2">
                <label className={classeDoRotulo}>Ids dos usuários</label>
                <Input
                  value={usuariosEscolhidos}
                  onChange={e => setUsuariosEscolhidos(e.target.value)}
                  placeholder="Ex.: 1375, 1359, 1364"
                  className={classeDoCampo}
                />
                {idsDosUsuarios(usuariosEscolhidos).length > 0 && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">
                      {idsDosUsuarios(usuariosEscolhidos).length} conta(s):
                    </span>{' '}
                    {idsDosUsuarios(usuariosEscolhidos)
                      .map(id => nomeDoUsuario[id] ?? `#${id}`)
                      .join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Prévia */}
            <div className="rounded-[15px] bg-muted px-4 py-3 mt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">
                Prévia da notificação
              </p>
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 bg-primary text-primary-foreground rounded-[10px] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    {title || 'Título da notificação'}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">
                    {message || 'Mensagem da notificação aparece aqui...'}
                  </p>
                </div>
              </div>
              {imagem && (
                <img
                  src={imagem}
                  alt=""
                  className="mt-3 w-full max-h-40 object-cover rounded-[10px]"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className={`${classeDoBotaoSecundario} h-10`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateCampaign}
              disabled={enviandoImagem}
              className={`${classeDoBotaoPrincipal} h-10`}
            >
              Criar campanha
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * Cartão do Figma: bloco de ícone e título; o número grande alinhado ao título;
 * embaixo, a variação contra o mês anterior e o número dele ("Outubro: 791").
 */
function CartaoDeNumero({
  icone,
  tom = 'marca',
  titulo,
  valor,
  variacao,
  comparacao,
  subirEPior,
}: {
  /** Sem ícone o bloco fica vazio, como no Figma ("Entregas com sucesso"). */
  icone?: ReactNode;
  tom?: Tom;
  titulo: string;
  valor: string;
  /** Variação (%) contra o mês anterior — só quando ele tem número. */
  variacao?: number;
  comparacao?: string;
  /** Falhas: subir é ruim (vermelho), cair é bom (verde). */
  subirEPior?: boolean;
}) {
  const desceu = variacao !== undefined && variacao < 0;
  const bom = subirEPior ? desceu : !desceu;
  return (
    <section
      className={`${classeDoCartao} min-h-[150px] 3xl:min-h-[168px] pl-[23px] pr-6 pt-[19px] pb-4 flex flex-col`}
      aria-label={titulo}
    >
      <div className="flex items-center gap-[18px]">
        <BlocoDeIcone tom={tom}>{icone}</BlocoDeIcone>
        <h2 className="text-base 3xl:text-[20px] leading-tight font-medium text-[#001119] dark:text-foreground">
          {titulo}
        </h2>
      </div>
      <p className="mt-2 pl-[59px] text-[32px] 3xl:text-[40px] leading-tight font-semibold tabular-nums text-foreground">
        {valor}
      </p>
      {(variacao !== undefined || comparacao) && (
        <div className="mt-auto pt-2 flex items-center justify-between gap-3 text-sm 3xl:text-[15px] font-medium">
          {variacao !== undefined ? (
            <span
              className={`inline-flex items-center gap-1 tabular-nums ${
                variacao === 0
                  ? 'text-muted-foreground'
                  : bom
                    ? 'text-primary-strong'
                    : 'text-destructive'
              }`}
            >
              {variacao !== 0 && (
                // O desenho da seta aponta para a direita; o Figma o gira para ↑ e ↓.
                <span className={`inline-flex ${desceu ? 'rotate-90' : '-rotate-90'}`}>
                  <Icone nome="seta-alta" tamanho={19} />
                </span>
              )}
              {Math.abs(variacao).toFixed(1).replace('.', ',')}%
            </span>
          ) : (
            <span />
          )}
          {comparacao && (
            <span className="text-muted-foreground whitespace-nowrap">{comparacao}</span>
          )}
        </div>
      )}
    </section>
  );
}

/** A pílula do mês do Figma: "‹ Novembro de 2026 ›" (não passa do mês de hoje). */
function SeletorDeMes({
  nome,
  aoVoltar,
  aoAvancar,
  podeAvancar,
}: {
  nome: string;
  aoVoltar: () => void;
  aoAvancar: () => void;
  podeAvancar: boolean;
}) {
  const classeDaSeta =
    'w-7 h-7 rounded-full inline-flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="h-[43px] w-[214px] rounded-[25px] border border-primary bg-[#f4f6f8] dark:bg-card shadow-pilula px-[10px] flex items-center justify-between text-[11px] font-medium text-foreground">
      <button type="button" onClick={aoVoltar} aria-label="Mês anterior" className={classeDaSeta}>
        <span className="inline-flex rotate-180">
          <IconeSvg src={iconeSetaMes} tamanho={19} altura={18} />
        </span>
      </button>
      <span aria-live="polite">{nome}</span>
      <button
        type="button"
        onClick={aoAvancar}
        disabled={!podeAvancar}
        aria-label="Próximo mês"
        className={classeDaSeta}
      >
        <IconeSvg src={iconeSetaMes} tamanho={19} altura={18} />
      </button>
    </div>
  );
}

/** Miniatura da campanha: a imagem dela ou o desenho de "sem imagem" do Figma. */
function Miniatura({ url }: { url?: string | null }) {
  return (
    <span className="w-16 h-12 3xl:w-[84px] 3xl:h-[63px] shrink-0 rounded-[15px] border border-[#9e9e9d] dark:border-border bg-card overflow-hidden flex items-center justify-center text-[#9e9e9d]">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <>
          <span className="inline-flex 3xl:hidden">
            <IconeSvg src={iconeSemImagem} tamanho={36} />
          </span>
          <span className="hidden 3xl:inline-flex">
            <IconeSvg src={iconeSemImagem} tamanho={48} />
          </span>
        </>
      )}
    </span>
  );
}

/** Pílula de status do Figma ("ENVIADA"): 43 px, maiúsculas, sombra. */
function PilulaDeStatus({ status }: { status: Campaign['status'] }) {
  const s = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center justify-center h-9 3xl:h-[43px] px-4 3xl:px-[22px] rounded-[25px] text-xs 3xl:text-[15px] font-semibold uppercase whitespace-nowrap shadow-pilula ${s.classe}`}
    >
      {s.label}
    </span>
  );
}

/** Quantos receberam: no app (sino) e por push, com as falhas. */
function Alcance({ campaign }: { campaign: Campaign }) {
  return (
    <>
      {campaign.inAppCount ? (
        <span className="block">{numero(campaign.inAppCount)} no app</span>
      ) : null}
      <span className="block">{numero(campaign.sentCount)} por push</span>
      {campaign.failedCount > 0 && (
        <span className="block text-xs text-destructive">
          {numero(campaign.failedCount)} falha(s)
        </span>
      )}
    </>
  );
}

function ItemDoDetalhe({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted-foreground mb-1">{rotulo}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

export default PushNotifications;
