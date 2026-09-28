// Receptor de diagnósticos da API (GetDiagnostics sem servidor FTP próprio).
// O painel pede um endereço de envio por carregador, manda esse endereço como
// `location` do GetDiagnostics e acompanha a chegada do arquivo pelo token.
import { api } from './api';

export interface PedidoDiagnostico {
  token: string;
  /** URL pública terminada em "/" — vai no campo location do GetDiagnostics. */
  uploadUrl: string;
  /**
   * Mesmo pedido pelo receptor FTP (ftp://token:token@host:porta/), quando a
   * API tem o serviço ftp-diagnosticos configurado. Os MOBY CVBE só enviam por
   * FTP: com https respondem ao GetDiagnostics sem fileName.
   */
  uploadUrlFtp?: string | null;
  expiraEm: string;
}

export interface ArquivoDiagnostico {
  id: number | string;
  chargerId: string;
  nome: string;
  contentType: string | null;
  tamanho: number;
  criadoEm: string;
  pedidoEm: string | null;
}

export interface StatusPedido {
  recebidos: number;
  ultimoEm: string | null;
}

/** API ainda sem o receptor: as rotas /diagnostics respondem 404. */
export class ServidorDiagnosticosIndisponivel extends Error {
  constructor() {
    super('O servidor de diagnósticos da NeoPower ainda não está disponível na API.');
    this.name = 'ServidorDiagnosticosIndisponivel';
  }
}

async function mensagemDeErro(r: Response, padrao: string): Promise<string> {
  const corpo = (await r.json().catch(() => null)) as { error?: string; message?: string } | null;
  return corpo?.error || corpo?.message || padrao;
}

export async function criarPedidoDiagnostico(chargerId: string): Promise<PedidoDiagnostico> {
  const r = await api.post('/diagnostics/requests', { chargerId });
  if (r.status === 404) throw new ServidorDiagnosticosIndisponivel();
  if (!r.ok)
    throw new Error(await mensagemDeErro(r, 'Não foi possível gerar o endereço de envio.'));
  const pedido = (await r.json()) as Partial<PedidoDiagnostico> | null;
  if (!pedido?.token || !pedido.uploadUrl)
    throw new Error('A API não devolveu o endereço de envio.');
  return pedido as PedidoDiagnostico;
}

export async function listarDiagnosticos(chargerId: string): Promise<ArquivoDiagnostico[]> {
  const r = await api.get(`/diagnostics?chargerId=${encodeURIComponent(chargerId)}`);
  if (r.status === 404) throw new ServidorDiagnosticosIndisponivel();
  if (!r.ok) throw new Error(await mensagemDeErro(r, 'Não foi possível carregar os diagnósticos.'));
  const lista = (await r.json()) as unknown;
  if (!Array.isArray(lista)) return [];
  return (lista as ArquivoDiagnostico[]).sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  );
}

/**
 * true = receptor no ar; false = API sem o receptor (404); null = não deu para
 * saber (rede, 5xx, 403). A consulta é só leitura, sem gerar token de envio.
 */
export async function servidorDiagnosticosNoAr(chargerId: string): Promise<boolean | null> {
  try {
    const r = await api.get(`/diagnostics?chargerId=${encodeURIComponent(chargerId)}`);
    if (r.status === 404) return false;
    return r.ok ? true : null;
  } catch {
    return null;
  }
}

/** null quando a consulta falha — quem chama tenta de novo no próximo ciclo. */
export async function consultarPedidoDiagnostico(token: string): Promise<StatusPedido | null> {
  try {
    const r = await api.get(`/diagnostics/requests/${encodeURIComponent(token)}/status`);
    if (!r.ok) return null;
    const s = (await r.json()) as Partial<StatusPedido> | null;
    return { recebidos: Number(s?.recebidos) || 0, ultimoEm: s?.ultimoEm ?? null };
  } catch {
    return null;
  }
}

/**
 * Baixa pelo fetch autenticado e entrega como blob: um link direto para a URL
 * de download não levaria o token e a API responderia 401.
 */
export async function baixarDiagnostico(arquivo: Pick<ArquivoDiagnostico, 'id' | 'nome'>) {
  const r = await api.get(`/diagnostics/${encodeURIComponent(String(arquivo.id))}/download`);
  if (!r.ok) throw new Error(await mensagemDeErro(r, 'Não foi possível baixar o arquivo.'));
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.nome || `diagnostico-${arquivo.id}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: valor < 10 ? 1 : 0 })} ${unidades[i]}`;
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Nome do arquivo que o carregador anunciou no GetDiagnostics.conf. A API
 * devolve { success, data: { fileName } }; sem fileName, o carregador não vai
 * enviar para aquele endereço.
 */
export function arquivoDaResposta(resposta: unknown): string | undefined {
  const r = resposta as { data?: { fileName?: unknown }; fileName?: unknown } | null;
  const nome = r?.data?.fileName ?? r?.fileName;
  return typeof nome === 'string' && nome ? nome : undefined;
}
