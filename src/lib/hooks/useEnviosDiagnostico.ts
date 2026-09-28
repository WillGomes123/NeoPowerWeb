import { useCallback, useEffect, useRef, useState } from 'react';
import {
  consultarPedidoDiagnostico,
  listarDiagnosticos,
  type ArquivoDiagnostico,
} from '../diagnosticos';

export const INTERVALO_CONSULTA_MS = 10_000;
/** Alguns carregadores levam minutos para montar e enviar o arquivo. */
export const LIMITE_ESPERA_MS = 10 * 60_000;

export type EstadoEnvio = 'aguardando' | 'recebido' | 'sem_envio';

export interface EnvioDiagnostico {
  token: string;
  chargerId: string;
  /** Quando o endereço de envio foi pedido (ms). */
  iniciadoEm: number;
  estado: EstadoEnvio;
  recebidos: number;
  ultimoEm: string | null;
  /** Nome que o carregador anunciou na resposta do GetDiagnostics, se veio. */
  arquivoAnunciado?: string;
  arquivo?: ArquivoDiagnostico;
}

export type NovoEnvio = Pick<
  EnvioDiagnostico,
  'token' | 'chargerId' | 'iniciadoEm' | 'arquivoAnunciado'
>;

/** O arquivo deste pedido: o mais novo do carregador que chegou depois do pedido. */
export async function localizarArquivoDoEnvio(
  envio: Pick<EnvioDiagnostico, 'chargerId' | 'iniciadoEm'>
): Promise<ArquivoDiagnostico | undefined> {
  const lista = await listarDiagnosticos(envio.chargerId);
  // Folga de 2 min para a diferença de relógio entre o navegador e o servidor.
  return lista.find(a => new Date(a.criadoEm).getTime() >= envio.iniciadoEm - 120_000) ?? lista[0];
}

/**
 * Acompanha os pedidos de diagnóstico: consulta o status de cada token a cada
 * 10 s até o arquivo chegar ou passar de 10 min sem nada.
 */
export function useEnviosDiagnostico() {
  const [envios, setEnvios] = useState<EnvioDiagnostico[]>([]);
  const enviosRef = useRef(envios);
  useEffect(() => {
    enviosRef.current = envios;
  }, [envios]);

  const haAguardando = envios.some(e => e.estado === 'aguardando');

  useEffect(() => {
    if (!haAguardando) return;
    let ativo = true;

    const consultar = async () => {
      const pendentes = enviosRef.current.filter(e => e.estado === 'aguardando');
      const mudancas = await Promise.all(
        pendentes.map(async (e): Promise<[string, Partial<EnvioDiagnostico>] | null> => {
          const status = await consultarPedidoDiagnostico(e.token);
          if (status && status.recebidos > 0) {
            const arquivo = await localizarArquivoDoEnvio(e).catch(() => undefined);
            return [
              e.token,
              {
                estado: 'recebido',
                recebidos: status.recebidos,
                ultimoEm: status.ultimoEm,
                arquivo,
              },
            ];
          }
          if (Date.now() - e.iniciadoEm >= LIMITE_ESPERA_MS)
            return [e.token, { estado: 'sem_envio' }];
          return null;
        })
      );
      const porToken = new Map(mudancas.filter(m => m !== null));
      if (!ativo || porToken.size === 0) return;
      setEnvios(prev =>
        prev.map(e => {
          const mudanca = porToken.get(e.token);
          return mudanca ? { ...e, ...mudanca } : e;
        })
      );
    };

    const id = setInterval(() => void consultar(), INTERVALO_CONSULTA_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [haAguardando]);

  const adicionar = useCallback((novos: NovoEnvio[]) => {
    if (novos.length === 0) return;
    setEnvios(prev => [
      ...novos.map(n => ({ ...n, estado: 'aguardando' as const, recebidos: 0, ultimoEm: null })),
      ...prev,
    ]);
  }, []);

  const removerConcluidos = useCallback(() => {
    setEnvios(prev => prev.filter(e => e.estado === 'aguardando'));
  }, []);

  return { envios, adicionar, removerConcluidos };
}
