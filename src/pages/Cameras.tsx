import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { cn } from '../components/ui/utils';
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Icone, IconeSvg } from '../components/painel/Icone';
import {
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
} from '../components/painel/Pagina';
import {
  BarraDeFiltros,
  CampoDeBusca,
  ChipDeFiltro,
  EtiquetaDeEstado,
  classeDoBotaoContorno,
  classeDoBotaoPerigo,
  classeDoBotaoPrincipal,
} from '../components/painel/Pecas';
import iconeLocaisSemCamera from '../assets/icones/op-offline.svg';
import iconePredio from '../assets/icones/cameras-predio.svg';
import iconeMais from '../assets/icones/cameras-mais.svg';
import iconeSemCamera from '../assets/icones/cameras-sem-camera.svg';
import ilustracaoCamera from '../assets/ilustracoes/cameras-camera-verde.webp';

/*
 * Câmeras — redesenho de nov/2026 (Figma da Lauriane, frame "cameras"), seguido
 * à risca: quatro contadores, barra com a busca e três pílulas, "Locais da
 * rede" em cartões de duas colunas e, no local sem câmera, a câmera verde com o
 * "Adicionar câmera". O que a tela já fazia e o Figma não mostra (as imagens
 * das câmeras, o tamanho delas, editar e remover) aparece só quando o local tem
 * câmera.
 */

interface Camera {
  id: number;
  locationId: number;
  nome: string;
  playbackUrl: string | null;
  ativa: boolean;
  ordem: number;
  endereco: string | null;
  temRtsp: boolean;
  online: boolean;
  vistoEm: string | null;
}

interface LocalComCameras {
  locationId: number;
  local: string;
  cidade: string | null;
  cameras: Camera[];
}

type Tamanho = 'compacto' | 'medio' | 'grande';
type Filtro = 'todos' | 'com' | 'sem';

/** Colunas das imagens dentro do cartão do local (meia largura da tela). */
const COLUNAS: Record<Tamanho, string> = {
  compacto: 'grid-cols-2 sm:grid-cols-3',
  medio: 'grid-cols-1 sm:grid-cols-2',
  grande: 'grid-cols-1',
};

const ROTULO_DO_TAMANHO: Record<Tamanho, string> = {
  compacto: 'Compacto',
  medio: 'Médio',
  grande: 'Grande',
};

/** Busca sem diferenciar maiúsculas nem acentos ("sao" acha "São"). */
const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');

/**
 * Contador do Figma (300×112, branco a 70%): bloco do ícone, rótulo e número.
 * Igual ao `CartaoContador` do painel, mas o rótulo quebra em vez de cortar,
 * para os quatro caberem numa linha em 1366 px ("Locais sem câmera").
 */
function Contador({
  icone,
  rotulo,
  valor,
  fundoDoIcone = 'bg-primary-soft text-primary-strong',
}: {
  icone: ReactNode;
  rotulo: string;
  valor: number;
  fundoDoIcone?: string;
}) {
  return (
    <section
      aria-label={rotulo}
      className="bg-card/70 rounded-[15px] shadow-cartao min-h-[112px] px-4 3xl:px-[32px] py-4 flex items-center gap-4 3xl:gap-[15px]"
    >
      <span
        aria-hidden="true"
        className={`${fundoDoIcone} w-[57px] h-[53px] rounded-[5px] flex items-center justify-center shrink-0`}
      >
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-base leading-tight font-semibold text-[#001119] dark:text-foreground">
          {rotulo}
        </span>
        <span className="block text-[36px] leading-tight font-semibold tabular-nums text-foreground">
          {valor}
        </span>
      </span>
    </section>
  );
}

/** Pílula verde de contorno com "+" (o "Adicionar câmera" do Figma). */
function BotaoAdicionar({
  onClick,
  rotulo,
  className = '',
}: {
  onClick: () => void;
  rotulo: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={`h-9 min-w-[196px] pl-4 pr-5 rounded-[25px] border border-primary bg-primary-soft dark:bg-transparent text-primary-strong text-[13px] font-medium inline-flex items-center gap-[11px] whitespace-nowrap shrink-0 hover:brightness-95 transition ${className}`}
    >
      <IconeSvg src={iconeMais} tamanho={22} />
      Adicionar câmera
    </button>
  );
}

export function Cameras() {
  const [painel, setPainel] = useState<LocalComCameras[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  // Erro sem nada na tela; com câmeras na tela, elas ficam e o botão avisa.
  const [erro, setErro] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const jaCarregou = useRef(false);

  const [tamanho, setTamanho] = useState<Tamanho>('medio');
  // '' = todos os locais (filtro do cabeçalho, como no Figma).
  const [localId, setLocalId] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');

  // Cadastro
  const [dialogAberto, setDialogAberto] = useState(false);
  const [localAlvo, setLocalAlvo] = useState<LocalComCameras | null>(null);
  const [editando, setEditando] = useState<Camera | null>(null);
  const [form, setForm] = useState({ nome: '', rtspUrl: '', playbackUrl: '' });
  const [salvando, setSalvando] = useState(false);

  // Remoção (com confirmação)
  const [removendo, setRemovendo] = useState<{
    local: LocalComCameras;
    cam: Camera;
  } | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  /** `silencioso`: a atualização automática, sem o "Atualizando…". */
  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setAtualizando(true);
    try {
      const r = await api.get('/cameras');
      if (!r.ok) throw new Error('falha');
      const d = await r.json();
      const lista = d?.data ?? d;
      setPainel(Array.isArray(lista) ? lista : []);
      jaCarregou.current = true;
      setErro(null);
      setFalhou(false);
      setAtualizadoEm(new Date());
    } catch {
      if (jaCarregou.current) setFalhou(true);
      else setErro('Não foi possível carregar as câmeras.');
    } finally {
      setCarregando(false);
      if (!silencioso) setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    // O gateway reporta periodicamente; recarregamos para o indicador de
    // online não ficar preso no estado do primeiro carregamento.
    const id = setInterval(() => void carregar(true), 60_000);
    return () => clearInterval(id);
  }, [carregar]);

  const abrirNovo = (local: LocalComCameras) => {
    setLocalAlvo(local);
    setEditando(null);
    setForm({ nome: '', rtspUrl: '', playbackUrl: '' });
    setDialogAberto(true);
  };

  const abrirEdicao = (local: LocalComCameras, cam: Camera) => {
    setLocalAlvo(local);
    setEditando(cam);
    // A URL RTSP nunca volta do servidor — o campo começa vazio e em branco
    // significa "manter a atual".
    setForm({ nome: cam.nome, rtspUrl: '', playbackUrl: cam.playbackUrl ?? '' });
    setDialogAberto(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      toast.error('Informe um nome para a câmera');
      return;
    }
    setSalvando(true);
    try {
      const corpo = {
        nome: form.nome,
        ...(form.rtspUrl ? { rtspUrl: form.rtspUrl } : {}),
        playbackUrl: form.playbackUrl,
      };
      const r = editando
        ? await api.put(`/cameras/${editando.id}`, corpo)
        : await api.post(`/locations/${localAlvo!.locationId}/cameras`, corpo);

      if (r.ok) {
        toast.success(editando ? 'Câmera atualizada' : 'Câmera cadastrada');
        setDialogAberto(false);
        void carregar(true);
      } else {
        const e = await r.json().catch(() => null);
        toast.error(e?.error || 'Não foi possível salvar a câmera');
      }
    } catch {
      toast.error('Não foi possível salvar a câmera');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!removendo) return;
    setExcluindo(true);
    try {
      const r = await api.delete(`/cameras/${removendo.cam.id}`);
      if (r.ok) {
        toast.success('Câmera removida');
        setRemovendo(null);
        void carregar(true);
      } else {
        toast.error('Não foi possível remover');
      }
    } catch {
      toast.error('Não foi possível remover');
    } finally {
      setExcluindo(false);
    }
  };

  // O filtro de local do cabeçalho vale para os contadores e para a lista; a
  // busca e as pílulas da barra, só para a lista.
  const doEscopo = localId ? painel.filter(l => String(l.locationId) === localId) : painel;
  const totalCameras = doEscopo.reduce((n, l) => n + l.cameras.length, 0);
  const totalOnline = doEscopo.reduce((n, l) => n + l.cameras.filter(c => c.online).length, 0);
  const semCamera = doEscopo.filter(l => l.cameras.length === 0).length;
  const comCamera = doEscopo.length - semCamera;

  const termo = semAcento(busca.trim());
  const visiveis = doEscopo.filter(
    l =>
      (filtro === 'todos' || (filtro === 'com' ? l.cameras.length > 0 : l.cameras.length === 0)) &&
      (!termo ||
        [l.local, l.cidade ?? '', ...l.cameras.map(c => c.nome)].some(t =>
          semAcento(t).includes(termo)
        ))
  );
  const temFiltro = filtro !== 'todos' || !!termo;

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        titulo="Câmeras"
        subtitulo="Gerencie e monitore as câmeras dos seus locais"
        filtros={
          painel.length > 0 && (
            <Select
              value={localId || 'todos'}
              onValueChange={v => setLocalId(v === 'todos' ? '' : v)}
            >
              <SelectTrigger className={classeDaPilula} aria-label="Filtrar por local">
                <span className="flex items-center gap-3 min-w-0">
                  <Icone nome="local" />
                  <SelectValue placeholder="Todos os locais" />
                </span>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos os locais</SelectItem>
                {painel.map(l => (
                  <SelectItem key={l.locationId} value={String(l.locationId)}>
                    {l.local}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
        acoes={
          <BotaoAtualizar
            aoAtualizar={() => void carregar()}
            carregando={atualizando}
            atualizadoEm={atualizadoEm}
            falhou={falhou}
          />
        }
      />

      {/* Contadores */}
      <div className="grid grid-cols-2 xl:grid-cols-4 3xl:grid-cols-[repeat(4,300px)] gap-4 xl:gap-[22px]">
        <Contador
          icone={<Icone nome="op-locais" tamanho={37} altura={38} />}
          rotulo="Locais"
          valor={doEscopo.length}
        />
        <Contador
          icone={<Icone nome="op-locais" tamanho={37} altura={38} />}
          rotulo="Câmeras"
          valor={totalCameras}
        />
        <Contador
          icone={<Icone nome="op-locais" tamanho={37} altura={38} />}
          rotulo="Transmitindo"
          valor={totalOnline}
        />
        <Contador
          icone={<img src={iconeLocaisSemCamera} alt="" className="w-[37px] h-[38px]" />}
          rotulo="Locais sem câmera"
          valor={semCamera}
          fundoDoIcone="bg-[#fedbd5] dark:bg-destructive/20"
        />
      </div>

      {/* Sem resposta da API e nada para mostrar */}
      {erro && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-[15px] bg-destructive/10 text-destructive">
          <p className="flex-1 text-[15px] font-medium">{erro}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="h-10 px-5 rounded-[25px] bg-card text-destructive text-sm font-semibold"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Barra do Figma: busca e três pílulas */}
      <BarraDeFiltros>
        <CampoDeBusca
          value={busca}
          onChange={e => setBusca(e.target.value)}
          aria-label="Pesquisar local, cidade ou câmera"
        />
        <div
          role="group"
          aria-label="Filtrar locais"
          className="flex flex-wrap gap-[15px] 3xl:ml-[55px]"
        >
          {(
            [
              { id: 'todos', rotulo: `Todos (${doEscopo.length})` },
              { id: 'com', rotulo: `Com câmera (${comCamera})` },
              { id: 'sem', rotulo: `Sem câmera (${semCamera})` },
            ] as Array<{ id: Filtro; rotulo: string }>
          ).map(f => (
            <ChipDeFiltro key={f.id} ativo={filtro === f.id} onClick={() => setFiltro(f.id)}>
              <span className="inline-block min-w-[85px] text-center">{f.rotulo}</span>
            </ChipDeFiltro>
          ))}
        </div>
        {/* Tamanho das imagens (não está no Figma): só quando há câmera */}
        {totalCameras > 0 && (
          <div
            role="group"
            aria-label="Tamanho das imagens"
            className="xl:ml-auto inline-flex items-center gap-1 rounded-[25px] bg-muted p-1"
          >
            {(['compacto', 'medio', 'grande'] as Tamanho[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTamanho(t)}
                aria-pressed={tamanho === t}
                className={`h-[35px] px-4 rounded-[25px] text-sm font-medium transition ${
                  tamanho === t
                    ? 'bg-card text-primary-strong shadow-pilula'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {ROTULO_DO_TAMANHO[t]}
              </button>
            ))}
          </div>
        )}
      </BarraDeFiltros>

      {/* Locais */}
      <section aria-labelledby="titulo-locais-da-rede" className="space-y-[18px]">
        <h2 id="titulo-locais-da-rede" className="pl-1.5 text-[20px] font-semibold text-foreground">
          Locais da rede ({visiveis.length})
        </h2>

        {carregando && (
          <p className="text-[15px] text-muted-foreground" role="status">
            Carregando…
          </p>
        )}

        {!carregando && !erro && visiveis.length === 0 && (
          <div className={`${classeDoCartao} p-8 text-center space-y-3`}>
            <p className="text-[15px] font-medium text-foreground">
              {doEscopo.length === 0
                ? 'Nenhum local para exibir.'
                : 'Nenhum local encontrado com esses filtros.'}
            </p>
            {temFiltro && (
              <button
                type="button"
                onClick={() => {
                  setBusca('');
                  setFiltro('todos');
                }}
                className={classeDoBotaoContorno}
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-[30px] gap-y-[22px] items-start">
          {visiveis.map(local => {
            const temCamera = local.cameras.length > 0;
            const transmitindo = local.cameras.filter(c => c.online).length;
            return (
              <article
                key={local.locationId}
                aria-label={local.local}
                className={`${classeDoCartao} pl-[21px] pr-[24px] pt-[26px] pb-[19px] flex flex-col gap-[16px] min-w-0`}
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-center gap-3 min-w-0">
                    <span
                      aria-hidden="true"
                      className="w-[44px] h-[44px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center shrink-0"
                    >
                      <IconeSvg src={iconePredio} tamanho={22} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[20px] leading-tight font-semibold text-foreground break-words">
                        {local.local}
                      </h3>
                      <p className="text-[15px] leading-tight font-medium text-foreground">
                        {local.cidade || (
                          <span className="text-muted-foreground">Cidade não informada</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {temCamera ? (
                    <span className="h-[37px] min-w-[178px] px-5 rounded-[25px] bg-primary-soft text-primary-strong text-[13px] font-medium inline-flex items-center justify-center whitespace-nowrap shrink-0">
                      {local.cameras.length} {local.cameras.length === 1 ? 'câmera' : 'câmeras'} ·{' '}
                      {transmitindo} transmitindo
                    </span>
                  ) : (
                    <span className="h-[37px] min-w-[178px] px-5 rounded-[25px] bg-[#cccccc] dark:bg-muted text-foreground text-[13px] font-medium inline-flex items-center justify-center gap-[15px] whitespace-nowrap shrink-0">
                      <IconeSvg src={iconeSemCamera} tamanho={21} />
                      Sem câmera
                    </span>
                  )}
                </header>

                {temCamera ? (
                  <div className="space-y-3">
                    <div className={`grid gap-3 ${COLUNAS[tamanho]}`}>
                      {local.cameras.map(cam => (
                        <div
                          key={cam.id}
                          className="rounded-[15px] border border-border bg-card overflow-hidden min-w-0"
                        >
                          {/* Área de vídeo (fundo preto nos dois temas) */}
                          <div className="aspect-video bg-black relative flex items-center justify-center">
                            {cam.playbackUrl ? (
                              <video
                                src={cam.playbackUrl}
                                className="w-full h-full object-cover"
                                autoPlay
                                muted
                                playsInline
                                controls
                              />
                            ) : (
                              <div className="text-center px-4">
                                <p className="text-white/80 text-xs font-semibold uppercase tracking-widest">
                                  Aguardando gateway
                                </p>
                                <p className="text-white/60 text-[11px] mt-1 leading-relaxed">
                                  O navegador não reproduz RTSP. Um gateway no local precisa
                                  converter o sinal antes.
                                </p>
                              </div>
                            )}
                            <span className="absolute top-2 left-2">
                              <EtiquetaDeEstado estado={cam.online ? 'livre' : 'offline'}>
                                {cam.online ? 'Ao vivo' : 'Offline'}
                              </EtiquetaDeEstado>
                            </span>
                          </div>

                          {/* Rodapé da câmera */}
                          <div className="p-3 flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-[15px] font-semibold text-foreground truncate"
                                title={cam.nome}
                              >
                                {cam.nome}
                              </p>
                              <p className="text-muted-foreground text-[11px] font-mono truncate">
                                {cam.endereco ?? 'sem endereço cadastrado'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => abrirEdicao(local, cam)}
                                className="h-8 px-3.5 rounded-[25px] border border-foreground/70 dark:border-primary bg-card text-foreground dark:text-primary-strong text-xs font-medium hover:bg-muted transition"
                              >
                                Editar
                              </button>
                              <span aria-hidden="true" className="w-px h-5 bg-border" />
                              <button
                                type="button"
                                onClick={() => setRemovendo({ local, cam })}
                                className="h-8 px-3.5 rounded-[25px] border border-destructive/60 bg-card text-destructive text-xs font-medium hover:bg-destructive/10 transition"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <BotaoAdicionar
                      onClick={() => abrirNovo(local)}
                      rotulo={`Adicionar câmera em ${local.local}`}
                    />
                  </div>
                ) : (
                  /* Estado vazio do Figma: câmera verde, recado e o "Adicionar câmera" */
                  <div className="@container">
                    <div className="rounded-[25px] border border-[#9e9e9d] dark:border-border bg-gradient-to-r from-[#ebedf0] dark:from-muted to-transparent min-h-[144px] flex items-center pl-[5px] pr-4 @2xl:pr-[29px] py-2 @2xl:py-0">
                      <img
                        src={ilustracaoCamera}
                        alt=""
                        width={207}
                        height={155}
                        className="w-[120px] @md:w-[150px] @2xl:w-[207px] h-auto shrink-0 -my-[6px]"
                      />
                      <div className="flex-1 min-w-0 flex flex-col @2xl:flex-row @2xl:items-start @2xl:justify-between gap-3 ml-2 @2xl:ml-[4px] @2xl:pt-[3px]">
                        <div className="min-w-0">
                          <p className="text-[15px] leading-[1] font-semibold text-foreground max-w-[200px]">
                            Nenhuma câmera instalada nesse local
                          </p>
                          <p className="text-sm leading-[1.01] text-foreground mt-[7px] max-w-[305px]">
                            Adicione uma câmera para iniciar o monitoramento
                          </p>
                        </div>
                        <BotaoAdicionar
                          onClick={() => abrirNovo(local)}
                          rotulo={`Adicionar câmera em ${local.local}`}
                          className="self-start"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Cadastro / edição */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-lg bg-card rounded-[15px] border-border">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-foreground">
              {editando ? 'Editar câmera' : 'Nova câmera'}
            </DialogTitle>
            <DialogDescription className="text-[15px]">{localAlvo?.local}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Nome</Label>
              <Input
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Entrada, Vaga 1, Painel…"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">URL RTSP</Label>
              <Input
                type="password"
                autoComplete="off"
                value={form.rtspUrl}
                onChange={e => setForm({ ...form, rtspUrl: e.target.value })}
                placeholder={
                  editando?.temRtsp
                    ? 'Salva — deixe em branco para manter'
                    : 'rtsp://usuario:senha@192.168.0.10:554/stream1'
                }
              />
              <p className="text-muted-foreground text-xs">
                Contém a senha da câmera. É guardada criptografada e nunca volta para esta tela.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                URL de exibição (HLS/WebRTC)
              </Label>
              <Input
                value={form.playbackUrl}
                onChange={e => setForm({ ...form, playbackUrl: e.target.value })}
                placeholder="Preenchida pelo gateway do local"
              />
              <p className="text-muted-foreground text-xs">
                Endereço que o navegador toca. Enquanto estiver vazio, a câmera aparece como
                aguardando gateway.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDialogAberto(false)}
                className={classeDoBotaoContorno}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={salvando}
                className={cn(classeDoBotaoPrincipal, 'h-10')}
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação da remoção: diz o que acontece */}
      <AlertDialog open={!!removendo} onOpenChange={aberto => !aberto && setRemovendo(null)}>
        <AlertDialogContent className="bg-card rounded-[15px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[20px] text-foreground">
              Remover a câmera “{removendo?.cam.nome}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px]">
              Ela sai do painel de {removendo?.local.local} e o endereço RTSP salvo é apagado. Para
              voltar a ver as imagens, será preciso cadastrá-la de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <button
              type="button"
              onClick={() => setRemovendo(null)}
              className={classeDoBotaoContorno}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void remover()}
              disabled={excluindo}
              className={classeDoBotaoPerigo}
            >
              {excluindo ? 'Removendo…' : 'Remover câmera'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
