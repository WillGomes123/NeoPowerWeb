import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

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

const COLUNAS: Record<Tamanho, string> = {
  compacto: 'grid-cols-2 md:grid-cols-4 xl:grid-cols-6',
  medio: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  grande: 'grid-cols-1 lg:grid-cols-2',
};

export function Cameras() {
  const [painel, setPainel] = useState<LocalComCameras[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState<Tamanho>('medio');
  const [somenteComCamera, setSomenteComCamera] = useState(false);

  // Cadastro
  const [dialogAberto, setDialogAberto] = useState(false);
  const [localAlvo, setLocalAlvo] = useState<LocalComCameras | null>(null);
  const [editando, setEditando] = useState<Camera | null>(null);
  const [form, setForm] = useState({ nome: '', rtspUrl: '', playbackUrl: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/cameras');
      if (!r.ok) {
        setErro('Não foi possível carregar as câmeras.');
        return;
      }
      const d = await r.json();
      const lista = d?.data ?? d;
      setPainel(Array.isArray(lista) ? lista : []);
      setErro(null);
    } catch {
      setErro('Não foi possível carregar as câmeras.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    // O gateway reporta periodicamente; recarregamos para o indicador de
    // online não ficar preso no estado do primeiro carregamento.
    const id = setInterval(carregar, 60_000);
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
        carregar();
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

  const remover = async (cam: Camera) => {
    if (!confirm(`Remover a câmera "${cam.nome}"?`)) return;
    try {
      const r = await api.delete(`/cameras/${cam.id}`);
      if (r.ok) {
        toast.success('Câmera removida');
        carregar();
      } else {
        toast.error('Não foi possível remover');
      }
    } catch {
      toast.error('Não foi possível remover');
    }
  };

  const visiveis = somenteComCamera ? painel.filter(l => l.cameras.length > 0) : painel;
  const totalCameras = painel.reduce((n, l) => n + l.cameras.length, 0);
  const totalOnline = painel.reduce((n, l) => n + l.cameras.filter(c => c.online).length, 0);
  const semCamera = painel.filter(l => l.cameras.length === 0).length;

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Câmeras</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Monitoramento dos locais em um só painel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-outline-variant">
            {(['compacto', 'medio', 'grande'] as Tamanho[]).map(t => (
              <button
                key={t}
                onClick={() => setTamanho(t)}
                className={`px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  tamanho === t
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={() => setSomenteComCamera(v => !v)}
            className="text-xs"
          >
            {somenteComCamera ? 'Mostrar todos os locais' : 'Só locais com câmera'}
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { rotulo: 'Locais', valor: painel.length },
          { rotulo: 'Câmeras', valor: totalCameras },
          { rotulo: 'Transmitindo', valor: totalOnline, destaque: totalOnline > 0 },
          { rotulo: 'Locais sem câmera', valor: semCamera, alerta: semCamera > 0 },
        ].map(k => (
          <div
            key={k.rotulo}
            className="bg-surface-container rounded-xl border border-outline-variant p-4"
          >
            <p
              className={`text-2xl font-bold tabular-nums ${
                k.destaque ? 'text-primary' : k.alerta ? 'text-error' : 'text-on-surface'
              }`}
            >
              {k.valor}
            </p>
            <p className="text-on-surface-variant text-xs uppercase tracking-widest mt-0.5">
              {k.rotulo}
            </p>
          </div>
        ))}
      </div>

      {erro && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4">
          <p className="text-on-surface text-sm">{erro}</p>
          <Button variant="outline" onClick={carregar} className="mt-3 text-xs">
            Tentar de novo
          </Button>
        </div>
      )}

      {carregando && <p className="text-on-surface-variant text-sm">Carregando…</p>}

      {!carregando && !erro && visiveis.length === 0 && (
        <p className="text-on-surface-variant text-sm">Nenhum local para exibir.</p>
      )}

      {/* Painel por local */}
      {visiveis.map(local => (
        <section key={local.locationId} className="space-y-3">
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant pb-2">
            <div>
              <h2 className="text-on-surface font-bold">{local.local}</h2>
              {local.cidade && (
                <p className="text-on-surface-variant text-xs">{local.cidade}</p>
              )}
            </div>
            <Button variant="outline" onClick={() => abrirNovo(local)} className="text-xs">
              Adicionar câmera
            </Button>
          </div>

          {local.cameras.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center">
              <p className="text-on-surface-variant text-sm">
                Nenhuma câmera instalada neste local
              </p>
            </div>
          ) : (
            <div className={`grid gap-3 ${COLUNAS[tamanho]}`}>
              {local.cameras.map(cam => (
                <div
                  key={cam.id}
                  className="rounded-xl border border-outline-variant bg-surface-container overflow-hidden"
                >
                  {/* Área de vídeo */}
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
                        <p className="text-white/70 text-xs font-bold uppercase tracking-widest">
                          Aguardando gateway
                        </p>
                        <p className="text-white/40 text-[11px] mt-1 leading-relaxed">
                          O navegador não reproduz RTSP. Um gateway no local precisa
                          converter o sinal antes.
                        </p>
                      </div>
                    )}

                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        cam.online ? 'bg-primary text-on-primary' : 'bg-black/60 text-white/70'
                      }`}
                    >
                      {cam.online ? 'ao vivo' : 'offline'}
                    </span>
                  </div>

                  {/* Rodapé da câmera */}
                  <div className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-on-surface text-sm font-bold truncate">{cam.nome}</p>
                      <p className="text-on-surface-variant text-[11px] font-mono truncate">
                        {cam.endereco ?? 'sem endereço cadastrado'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => abrirEdicao(local, cam)}
                        className="text-on-surface-variant hover:text-on-surface text-xs px-2 py-1"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remover(cam)}
                        className="text-error/80 hover:text-error text-xs px-2 py-1"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Cadastro / edição */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar câmera' : 'Nova câmera'}</DialogTitle>
            <DialogDescription>{localAlvo?.local}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                Nome
              </Label>
              <Input
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Entrada, Vaga 1, Painel…"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                URL RTSP
              </Label>
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
              <p className="text-on-surface-variant text-[11px]">
                Contém a senha da câmera. É guardada criptografada e nunca volta para esta
                tela.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                URL de exibição (HLS/WebRTC)
              </Label>
              <Input
                value={form.playbackUrl}
                onChange={e => setForm({ ...form, playbackUrl: e.target.value })}
                placeholder="Preenchida pelo gateway do local"
              />
              <p className="text-on-surface-variant text-[11px]">
                Endereço que o navegador toca. Enquanto estiver vazio, a câmera aparece como
                aguardando gateway.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
