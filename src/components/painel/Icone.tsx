import type { CSSProperties } from 'react';
import visaoGeral from '../../assets/icones/visao-geral.svg';
import gestao from '../../assets/icones/gestao.svg';
import financeiro from '../../assets/icones/financeiro.svg';
import configuracoes from '../../assets/icones/configuracoes.svg';
import energia from '../../assets/icones/energia.svg';
import cameras from '../../assets/icones/cameras.svg';
import operacoes from '../../assets/icones/operacoes.svg';
import indicadores from '../../assets/icones/indicadores.svg';
import notificacoes from '../../assets/icones/notificacoes.svg';
import alarmes from '../../assets/icones/alarmes.svg';
import atendimento from '../../assets/icones/atendimento.svg';
import tema from '../../assets/icones/tema.svg';
import setaGrupo from '../../assets/icones/seta-grupo.svg';
import marcaRaio from '../../assets/icones/marca-raio.svg';
import calendario from '../../assets/icones/calendario.svg';
import local from '../../assets/icones/local.svg';
import estacao from '../../assets/icones/estacao.svg';
import setaAlta from '../../assets/icones/seta-alta.svg';
import graficoLinha from '../../assets/icones/grafico-linha.svg';
import graficoBarras from '../../assets/icones/grafico-barras.svg';
import plugue from '../../assets/icones/plugue.svg';
import recibo from '../../assets/icones/recibo.svg';
import kpiReceitaLiquida from '../../assets/icones/kpi-receita-liquida.svg';
import kpiEnergia from '../../assets/icones/kpi-energia.svg';
import estadoOffline from '../../assets/icones/estado-offline.svg';
import setaDireita from '../../assets/icones/seta-direita.svg';
import usinas from '../../assets/icones/usinas.svg';
import pontosConsumidores from '../../assets/icones/pontos-consumidores.svg';
import kpiUsinas from '../../assets/icones/kpi-usinas.svg';
import opLocais from '../../assets/icones/op-locais.svg';

/**
 * Ícones do redesenho (Figma da Lauriane, nov/2026), usados como máscara:
 * o desenho vem do SVG e a cor vem do texto em volta (`currentColor`), para
 * acompanhar o tema claro/escuro e a cor de cada marca.
 */
export const ICONES = {
  'visao-geral': visaoGeral,
  gestao,
  financeiro,
  configuracoes,
  energia,
  cameras,
  operacoes,
  indicadores,
  notificacoes,
  alarmes,
  atendimento,
  tema,
  'seta-grupo': setaGrupo,
  'marca-raio': marcaRaio,
  calendario,
  local,
  estacao,
  'seta-alta': setaAlta,
  'grafico-linha': graficoLinha,
  'grafico-barras': graficoBarras,
  plugue,
  recibo,
  'kpi-receita-liquida': kpiReceitaLiquida,
  'kpi-energia': kpiEnergia,
  'estado-offline': estadoOffline,
  'seta-direita': setaDireita,
  usinas,
  'pontos-consumidores': pontosConsumidores,
  'kpi-usinas': kpiUsinas,
  'op-locais': opLocais,
} as const;

export type NomeDoIcone = keyof typeof ICONES;

interface IconeProps {
  nome: NomeDoIcone;
  /** Largura em px (o Figma usa 24 nos menus). */
  tamanho?: number;
  /** Altura, quando o desenho não é quadrado. */
  altura?: number;
  className?: string;
}

export function Icone({ nome, tamanho = 24, altura, className = '' }: IconeProps) {
  return (
    <IconeSvg
      src={ICONES[nome]}
      tamanho={tamanho}
      altura={altura}
      className={className}
      nome={nome}
    />
  );
}

/**
 * O mesmo ícone em máscara, a partir de qualquer SVG importado na página
 * (`import x from '../assets/icones/x.svg'`). Para as telas usarem os ícones do
 * Figma sem precisar registrá-los aqui.
 */
export function IconeSvg({
  src,
  tamanho = 24,
  altura,
  className = '',
  nome,
}: {
  src: string;
  tamanho?: number;
  altura?: number;
  className?: string;
  nome?: string;
}) {
  const url = `url("${src}")`;
  const estilo: CSSProperties = {
    width: tamanho,
    height: altura ?? tamanho,
    backgroundColor: 'currentColor',
    maskImage: url,
    WebkitMaskImage: url,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  };
  return (
    <span
      aria-hidden="true"
      data-icone={nome ?? 'svg'}
      className={`inline-block shrink-0 ${className}`}
      style={estilo}
    />
  );
}
