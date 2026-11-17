import { useEffect, useMemo, useState } from 'react';
import { Marker, L, useMap } from '../DynamicMap';
import type { EstadoDoCarregador } from '../../lib/estadoDoCarregador';
import iconePino from '../../assets/icones/locais-pino.svg';
import iconeRaio from '../../assets/icones/locais-raio.svg';
import iconeAlerta from '../../assets/icones/locais-alerta.svg';
import iconeSemConexao from '../../assets/icones/locais-sem-conexao.svg';

/*
 * Marcadores do mapa de Locais (Figma da Lauriane, variantes desenhadas ao lado
 * do frame 182:4680): círculo branco de 48 px com contorno de 3 px na cor do
 * estado e o ícone do estado dentro; locais muito próximos viram um círculo
 * de agrupamento com o número de locais (o "3" do Figma).
 */

export type EstadoDoMarcador = 'livre' | 'uso' | 'problema' | 'offline' | 'instalacao';

export interface PontoDoMapa {
  id: number;
  nome: string;
  lat: number;
  lng: number;
  estado: EstadoDoMarcador;
}

// Cores fixas de estado do Figma (não seguem a cor da marca).
const ESTILO: Record<EstadoDoMarcador, { cor: string; icone: string; rotulo: string }> = {
  livre: { cor: '#00cc6a', icone: iconePino, rotulo: 'Disponível' },
  uso: { cor: '#089ef7', icone: iconeRaio, rotulo: 'Carregando' },
  problema: { cor: '#fec80b', icone: iconeAlerta, rotulo: 'Problema' },
  offline: { cor: '#666666', icone: iconeSemConexao, rotulo: 'Offline' },
  instalacao: { cor: '#9e9e9d', icone: iconePino, rotulo: 'Em instalação' },
};

/** Estado do marcador a partir do estado que o local mostra. */
export function estadoDoMarcador(
  estado: EstadoDoCarregador,
  totalDeCarregadores: number
): EstadoDoMarcador {
  if (totalDeCarregadores === 0) return 'instalacao';
  if (estado === 'ativo') return 'livre';
  if (estado === 'emUso') return 'uso';
  if (estado === 'falha' || estado === 'indisponivel') return 'problema';
  return estado === 'offline' ? 'offline' : 'instalacao';
}

export const rotuloDoMarcador = (e: EstadoDoMarcador) => ESTILO[e].rotulo;

const TAMANHO = 48;
// Distância (px na tela) abaixo da qual dois locais viram um grupo.
const RAIO_DO_GRUPO = 50;

// O SVG pequeno vira data URI no build: aspas codificadas para caber no style.
const mascara = (src: string) =>
  `url('${src.replace(/'/g, '%27').replace(/"/g, '%22')}') center / contain no-repeat`;

function circulo(cor: string, conteudo: string, selecionado: boolean, tracejado = false): string {
  // Selecionado: um halo na cor do estado, para achar no mapa o local do cartão ao lado.
  const halo = selecionado
    ? `box-shadow:0 0 0 6px color-mix(in srgb, ${cor} 35%, transparent);`
    : '';
  return (
    `<div style="box-sizing:border-box;width:${TAMANHO}px;height:${TAMANHO}px;border-radius:50%;background:#fff;` +
    `border:3px ${tracejado ? 'dashed' : 'solid'} ${cor};${halo}display:flex;align-items:center;justify-content:center">` +
    `${conteudo}</div>`
  );
}

function htmlDoLocal(estado: EstadoDoMarcador, selecionado: boolean): string {
  const { cor, icone } = ESTILO[estado];
  const m = mascara(icone);
  return circulo(
    cor,
    `<span style="width:24px;height:24px;background:${cor};-webkit-mask:${m};mask:${m}"></span>`,
    selecionado,
    estado === 'instalacao'
  );
}

function htmlDoGrupo(quantidade: number, cor: string, selecionado: boolean): string {
  return circulo(
    cor,
    `<span style="font:700 16px/1 Poppins, sans-serif;color:#37352f">${quantidade}</span>`,
    selecionado
  );
}

// Grupo com problema fica amarelo; com algum local operando, verde; senão, cinza.
function corDoGrupo(pontos: PontoDoMapa[]): string {
  if (pontos.some(p => p.estado === 'problema')) return ESTILO.problema.cor;
  if (pontos.some(p => p.estado === 'livre' || p.estado === 'uso')) return ESTILO.livre.cor;
  return ESTILO.offline.cor;
}

type Icone = ReturnType<typeof L.divIcon>;
const cache = new Map<string, Icone>();
function icone(chave: string, html: string): Icone {
  let i = cache.get(chave);
  if (!i) {
    i = L.divIcon({
      className: '',
      html,
      iconSize: [TAMANHO, TAMANHO],
      iconAnchor: [TAMANHO / 2, TAMANHO / 2],
    });
    cache.set(chave, i);
  }
  return i;
}

/** Ícone de um local só (o mapa do diálogo "Mapa do local" usa também). */
export const iconeDoLocal = (estado: EstadoDoMarcador, selecionado = false) =>
  icone(`l-${estado}-${selecionado}`, htmlDoLocal(estado, selecionado));

export function MarcadoresDoMapa({
  pontos,
  selecionadoId,
  aoSelecionar,
}: {
  pontos: PontoDoMapa[];
  selecionadoId: number | null;
  aoSelecionar: (id: number) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const mudou = () => setZoom(map.getZoom());
    map.on('zoomend', mudou);
    // O enquadramento inicial (FitToMarkers / "Ver no mapa") roda antes desta
    // inscrição: lê o zoom de agora para não agrupar com o zoom de antes.
    mudou();
    return () => {
      map.off('zoomend', mudou);
    };
  }, [map]);

  // Agrupamento simples: cada local ainda solto puxa os vizinhos a menos de
  // RAIO_DO_GRUPO px, no zoom atual.
  const grupos = useMemo(() => {
    const projetados = pontos.map(p => ({ p, xy: map.project([p.lat, p.lng], zoom) }));
    const usados = new Set<number>();
    const lista: PontoDoMapa[][] = [];
    projetados.forEach((a, i) => {
      if (usados.has(i)) return;
      usados.add(i);
      const grupo = [a.p];
      projetados.forEach((b, j) => {
        if (usados.has(j) || a.xy.distanceTo(b.xy) > RAIO_DO_GRUPO) return;
        usados.add(j);
        grupo.push(b.p);
      });
      lista.push(grupo);
    });
    return lista;
  }, [pontos, zoom, map]);

  // Clique no grupo aproxima até separar os locais; se estão no mesmo ponto, escolhe o primeiro.
  const abrirGrupo = (grupo: PontoDoMapa[]) => {
    const limites = L.latLngBounds(grupo.map(p => [p.lat, p.lng] as [number, number]));
    const mesmoPonto = limites.getNorthEast().equals(limites.getSouthWest());
    if (mesmoPonto || map.getZoom() >= map.getMaxZoom()) {
      aoSelecionar(grupo[0].id);
      return;
    }
    map.fitBounds(limites, { padding: [80, 80] });
  };

  if (typeof L === 'undefined') return null;

  return (
    <>
      {grupos.map(grupo => {
        if (grupo.length === 1) {
          const p = grupo[0];
          const selecionado = p.id === selecionadoId;
          return (
            <Marker
              key={`l-${p.id}`}
              position={[p.lat, p.lng]}
              icon={iconeDoLocal(p.estado, selecionado)}
              title={`${p.nome}: ${ESTILO[p.estado].rotulo}`}
              zIndexOffset={selecionado ? 1000 : 0}
              eventHandlers={{ click: () => aoSelecionar(p.id) }}
            />
          );
        }
        const lat = grupo.reduce((s, p) => s + p.lat, 0) / grupo.length;
        const lng = grupo.reduce((s, p) => s + p.lng, 0) / grupo.length;
        const selecionado = grupo.some(p => p.id === selecionadoId);
        const cor = corDoGrupo(grupo);
        return (
          <Marker
            key={`g-${grupo.map(p => p.id).join('-')}`}
            position={[lat, lng]}
            icon={icone(
              `g-${cor}-${grupo.length}-${selecionado}`,
              htmlDoGrupo(grupo.length, cor, selecionado)
            )}
            title={`${grupo.length} locais: ${grupo.map(p => p.nome).join(', ')}`}
            zIndexOffset={selecionado ? 1000 : 500}
            eventHandlers={{ click: () => abrirGrupo(grupo) }}
          />
        );
      })}
    </>
  );
}
