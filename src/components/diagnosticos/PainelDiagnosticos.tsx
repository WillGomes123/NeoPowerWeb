import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  ServidorDiagnosticosIndisponivel,
  baixarDiagnostico,
  formatarDataHora,
  formatarTamanho,
  listarDiagnosticos,
  type ArquivoDiagnostico,
} from '../../lib/diagnosticos';
import {
  localizarArquivoDoEnvio,
  type EnvioDiagnostico,
} from '../../lib/hooks/useEnviosDiagnostico';

const DICA_SEM_ENVIO =
  'O carregador não enviou. Alguns modelos só aceitam FTP; confira nos logs do carregador o DiagnosticsStatusNotification (UploadFailed)';

export interface CarregadorResumo {
  charge_point_id: string;
  description?: string;
}

interface Props {
  carregadores: CarregadorResumo[];
  envios: EnvioDiagnostico[];
  onLimparConcluidos: () => void;
  /** Carregador aberto na lista de recebidos ao entrar na aba. */
  carregadorInicial?: string;
}

const cardClass =
  'bg-gradient-to-br from-gray-100 to-gray-50 dark:from-zinc-900/80 dark:to-zinc-800/50 border-gray-200 dark:border-border';

const horaCurta = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function PainelDiagnosticos({
  carregadores,
  envios,
  onLimparConcluidos,
  carregadorInicial,
}: Props) {
  const [chargerId, setChargerId] = useState(
    carregadorInicial ?? envios[0]?.chargerId ?? carregadores[0]?.charge_point_id ?? ''
  );
  const [arquivos, setArquivos] = useState<ArquivoDiagnostico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [indisponivel, setIndisponivel] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  const nomeDo = (id: string) =>
    carregadores.find(c => c.charge_point_id === id)?.description || id;

  // Recarrega a lista quando um envio deste carregador acaba de chegar.
  const chegadasDoCarregador = envios.filter(
    e => e.chargerId === chargerId && e.estado === 'recebido'
  ).length;

  const carregar = useCallback(async () => {
    if (!chargerId) return;
    setCarregando(true);
    try {
      setArquivos(await listarDiagnosticos(chargerId));
      setIndisponivel(false);
      setErro(null);
    } catch (e) {
      setArquivos([]);
      if (e instanceof ServidorDiagnosticosIndisponivel) setIndisponivel(true);
      else setErro(e instanceof Error ? e.message : 'Não foi possível carregar os diagnósticos.');
    } finally {
      setCarregando(false);
    }
  }, [chargerId]);

  useEffect(() => {
    void carregar();
  }, [carregar, chegadasDoCarregador]);

  const baixar = async (chave: string, obter: () => Promise<ArquivoDiagnostico | undefined>) => {
    setBaixando(chave);
    try {
      const arquivo = await obter();
      if (!arquivo) {
        toast.error('O arquivo ainda não aparece na lista. Tente de novo em instantes.');
        return;
      }
      await baixarDiagnostico(arquivo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível baixar o arquivo.');
    } finally {
      setBaixando(null);
    }
  };

  const haConcluidos = envios.some(e => e.estado !== 'aguardando');

  return (
    <div className="space-y-6">
      {envios.length > 0 && (
        <Card className={cardClass}>
          <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <CardTitle className="text-foreground">Envios de diagnóstico</CardTitle>
              <CardDescription className="text-muted-foreground">
                O painel confere a cada 10 s, por até 10 min. Alguns carregadores levam alguns
                minutos para enviar.
              </CardDescription>
            </div>
            {haConcluidos && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLimparConcluidos}
                className="border-border text-muted-foreground hover:bg-accent shrink-0"
              >
                Limpar concluídos
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {envios.map(envio => (
              <div
                key={envio.token}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${
                  envio.estado === 'recebido'
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {envio.estado === 'aguardando' ? (
                    <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin mt-0.5 shrink-0" />
                  ) : envio.estado === 'recebido' ? (
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {nomeDo(envio.chargerId)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {envio.chargerId} · pedido às {horaCurta(envio.iniciadoEm)}
                      {envio.arquivoAnunciado ? ` · ${envio.arquivoAnunciado}` : ''}
                    </p>
                    {envio.estado === 'aguardando' && (
                      <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">
                        Aguardando envio do carregador…
                      </p>
                    )}
                    {envio.estado === 'recebido' && (
                      <p className="text-xs mt-1 text-primary font-medium">
                        Recebido
                        {envio.arquivo
                          ? ` · ${envio.arquivo.nome} (${formatarTamanho(envio.arquivo.tamanho)})`
                          : envio.recebidos > 1
                            ? ` · ${envio.recebidos} arquivos`
                            : ''}
                      </p>
                    )}
                    {envio.estado === 'sem_envio' && (
                      <p className="text-xs mt-1 text-amber-700 dark:text-amber-300 leading-relaxed">
                        {DICA_SEM_ENVIO}
                      </p>
                    )}
                  </div>
                </div>
                {envio.estado === 'recebido' && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void baixar(
                        envio.token,
                        async () => envio.arquivo ?? localizarArquivoDoEnvio(envio)
                      )
                    }
                    disabled={baixando === envio.token}
                    className="bg-primary hover:bg-primary/80 text-on-primary self-end sm:self-auto shrink-0"
                  >
                    {baixando === envio.token ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Baixar
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className={cardClass}>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle className="text-foreground">Diagnósticos recebidos</CardTitle>
            <CardDescription className="text-muted-foreground">
              Arquivos que o carregador enviou ao servidor NeoPower.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={chargerId} onValueChange={setChargerId}>
              <SelectTrigger className="w-full sm:w-64 bg-surface-container-low border-outline-variant text-foreground">
                <SelectValue placeholder="Escolha o carregador" />
              </SelectTrigger>
              <SelectContent>
                {carregadores.map(c => (
                  <SelectItem key={c.charge_point_id} value={c.charge_point_id}>
                    {c.description ? `${c.description} · ${c.charge_point_id}` : c.charge_point_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void carregar()}
              disabled={!chargerId || carregando}
              aria-label="Atualizar lista"
              className="border-border text-muted-foreground hover:bg-accent shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {indisponivel ? (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  O servidor de diagnósticos da NeoPower ainda não está no ar.
                </p>
                <p className="text-muted-foreground mt-1">
                  Por enquanto, use a opção “URL própria (FTP/HTTP)” no comando Obter Diagnósticos.
                  Nesse caso o arquivo fica no seu servidor e não aparece aqui.
                </p>
              </div>
            </div>
          ) : erro ? (
            <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>
          ) : !chargerId ? (
            <p className="text-sm text-muted-foreground">
              Escolha um carregador para ver os arquivos.
            </p>
          ) : carregando && arquivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : arquivos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum diagnóstico recebido deste carregador.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {arquivos.map(a => {
                const chave = `arq-${a.id}`;
                return (
                  <div key={chave} className="flex items-center gap-3 p-3">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-mono text-foreground break-all sm:truncate"
                        title={a.nome}
                      >
                        {a.nome}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatarTamanho(a.tamanho)} · recebido em {formatarDataHora(a.criadoEm)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void baixar(chave, async () => a)}
                      disabled={baixando === chave}
                      className="border-border text-foreground hover:bg-accent shrink-0"
                    >
                      {baixando === chave ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Baixar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
