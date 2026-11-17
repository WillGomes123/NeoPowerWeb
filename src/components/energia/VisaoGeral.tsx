import type { ReactNode } from 'react';
import { Check, PiggyBank } from 'lucide-react';
import { brl, pct } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { TabelaConexoes } from './TabelaConexoes';
import { Aviso, Botao, Painel } from './ui';
import { Icone } from '../painel/Icone';
import { classeDoCartao } from '../painel/Pagina';
import predioSolar from '../../assets/ilustracoes/energia-predio-solar.webp';

/*
 * Visão geral do módulo Energia no redesenho (Figma da Lauriane, Frame 18):
 * o "Comece por aqui" com a ilustração e as três etapas, e os cinco cartões de
 * indicador. Os alertas e as conexões ativas continuam embaixo.
 */

/** Módulo recém-aberto: diz por onde começar, em vez de mostrar tudo zerado. */
function Comecar({ painel, podeEditar, irPara }: AbaProps) {
  const passos = [
    {
      feito: painel.usinas.length > 0,
      titulo: 'Cadastre suas usinas',
      texto:
        'Informe os dados da usina, a unidade consumidora (UC), o tipo de geração e o custo fixo previsto.',
      aba: 'usinas' as const,
      botao: 'Cadastrar usina',
      ver: 'Ver usinas',
    },
    {
      feito: painel.pontos.length > 0,
      titulo: 'Cadastre os pontos consumidores',
      texto: 'Adicione as unidades consumidoras que receberão os créditos de energia.',
      aba: 'pontos' as const,
      botao: 'Ir para pontos',
      ver: 'Ver pontos',
    },
    {
      feito: painel.conexoes.length > 0,
      titulo: 'Configure as conexões e o rateio',
      texto: 'Vincule cada ponto a uma usina e defina as regras de distribuição de energia.',
      aba: 'conexoes' as const,
      botao: 'Ir para conexões',
      ver: 'Ver conexões',
    },
  ];
  const feitos = passos.filter(p => p.feito).length;
  // A etapa da vez é a primeira que falta: ela ganha o destaque verde.
  const daVez = passos.findIndex(p => !p.feito);

  return (
    <section
      aria-label="Comece por aqui"
      className="bg-card rounded-[25px] shadow-pilula p-6 xl:p-[30px] grid grid-cols-1 xl:grid-cols-[510px_1fr] gap-6 xl:gap-8 items-center"
    >
      <img
        src={predioSolar}
        alt="Prédio com painéis solares no telhado"
        className="hidden xl:block w-[510px] h-auto"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[32px] leading-tight font-semibold text-foreground">
              Comece por aqui
            </h2>
            <p className="text-[15px] font-medium text-foreground mt-1">
              Configure o módulo de geração distribuída para começar a acompanhar seus indicadores.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="h-[30px] px-5 rounded-[25px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center">
              {feitos} de {passos.length} etapas
            </span>
            <span
              className="block w-[188px] h-[10px] rounded-[5px] bg-[#9e9e9d]/40 overflow-hidden"
              role="progressbar"
              aria-valuenow={feitos}
              aria-valuemin={0}
              aria-valuemax={passos.length}
              aria-label="Etapas concluídas"
            >
              <span
                className="block h-full bg-primary"
                style={{ width: `${(feitos / passos.length) * 100}%` }}
              />
            </span>
          </div>
        </div>

        <ol className="mt-6 space-y-4">
          {passos.map((p, i) => {
            const destaque = i === daVez;
            return (
              <li
                key={p.aba}
                className="min-h-[92px] rounded-[30px] bg-background shadow-pilula px-5 py-3 flex flex-wrap sm:flex-nowrap items-center gap-4"
              >
                <span
                  aria-hidden="true"
                  className={`w-[57px] h-[57px] rounded-full flex items-center justify-center shrink-0 text-[32px] font-semibold ${
                    p.feito || destaque
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-[#d9d9d9] dark:bg-muted text-[#9e9e9d]'
                  }`}
                >
                  {p.feito ? <Check className="w-7 h-7" strokeWidth={3} /> : i + 1}
                </span>
                <span className="flex-1 min-w-[200px]">
                  <span className="block text-[20px] leading-tight font-semibold text-foreground">
                    {p.titulo}
                    {p.feito && <span className="sr-only"> (feito)</span>}
                  </span>
                  <span className="block text-sm font-medium text-foreground mt-1">{p.texto}</span>
                </span>
                <button
                  type="button"
                  onClick={() => irPara(p.aba)}
                  className={`h-[50px] w-full sm:w-[221px] shrink-0 rounded-[25px] px-6 inline-flex items-center justify-between gap-2 text-[15px] font-semibold transition hover:brightness-95 ${
                    destaque
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-[#d9d9d9] dark:bg-muted text-foreground'
                  }`}
                >
                  {p.feito ? p.ver : p.botao}
                  <Icone nome="seta-direita" />
                </button>
              </li>
            );
          })}
        </ol>
        {!podeEditar && (
          <p className="mt-4 text-sm text-muted-foreground">
            Os cadastros são feitos por um administrador.
          </p>
        )}
      </div>
    </section>
  );
}

/** Cartão de indicador do Figma (Energia): ícone, rótulo, número e explicação. */
function CartaoDaEnergia({
  icone,
  rotulo,
  valor,
  zerado,
  texto,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: string;
  zerado: boolean;
  texto: string;
}) {
  return (
    <section
      className={`${classeDoCartao} min-h-[201px] p-[30px] pt-[33px] flex flex-col`}
      aria-label={rotulo}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="w-[45px] h-[45px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center shrink-0"
        >
          {icone}
        </span>
        <h3 className="text-base leading-tight font-semibold text-muted-foreground">{rotulo}</h3>
      </div>
      <p
        className={`mt-4 text-[32px] leading-tight font-semibold tabular-nums ${zerado ? 'text-[#9e9e9d]' : 'text-foreground'}`}
      >
        {valor}
      </p>
      <p className="mt-auto pt-2 text-[15px] leading-snug font-medium text-muted-foreground">
        {texto}
      </p>
    </section>
  );
}

export function VisaoGeral(props: AbaProps) {
  const { painel, irPara } = props;
  const { kpis } = painel;
  const ativas = painel.conexoes.filter(c => c.status !== 'cancelado');
  const semUsina = kpis.pontosTotal - kpis.pontosComEnergia;
  const montado =
    painel.usinas.length > 0 && painel.pontos.length > 0 && painel.conexoes.length > 0;

  return (
    <div className="space-y-[25px]">
      {!montado && <Comecar {...props} />}

      <div>
        <h2 className="text-[32px] leading-tight font-semibold text-foreground">
          Energia visão geral
        </h2>
        <p className="text-[15px] font-medium text-foreground mt-1">
          Configure e monitore suas usinas, pontos de consumo e distribuição de energia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-5 gap-[19px]">
        <CartaoDaEnergia
          icone={<Icone nome="kpi-usinas" tamanho={32} />}
          rotulo="Usinas cadastradas"
          valor={String(painel.usinas.length)}
          zerado={!painel.usinas.length}
          texto={
            !painel.usinas.length
              ? 'Nenhuma usina cadastrada ainda.'
              : kpis.usinasEmHomologacao
                ? `${kpis.usinasOperando} operando, ${kpis.usinasEmHomologacao} em homologação.`
                : `${kpis.usinasOperando} operando.`
          }
        />
        <CartaoDaEnergia
          icone={<Icone nome="pontos-consumidores" />}
          rotulo="Pontos consumidores"
          valor={String(kpis.pontosTotal)}
          zerado={!kpis.pontosTotal}
          texto={
            !kpis.pontosTotal
              ? 'Nenhum ponto cadastrado ainda.'
              : semUsina
                ? `${kpis.pontosComEnergia} com energia, ${semUsina} ainda sem usina.`
                : 'Todos com usina.'
          }
        />
        <CartaoDaEnergia
          icone={<Icone nome="kpi-energia" />}
          rotulo="Energia compensada"
          valor={`${kpis.compensadoKwh.toLocaleString('pt-BR')} kWh`}
          zerado={!kpis.compensadoKwh}
          texto={
            kpis.geradoKwh
              ? `No mês, de ${kpis.geradoKwh.toLocaleString('pt-BR')} kWh gerados.`
              : 'Aguardando cadastro para exibir o consumo.'
          }
        />
        <CartaoDaEnergia
          icone={<PiggyBank aria-hidden="true" className="w-6 h-6" />}
          rotulo="Economia dos pontos"
          valor={brl(kpis.economia)}
          zerado={!kpis.economia}
          texto="Quanto os pontos economizam por mês."
        />
        <CartaoDaEnergia
          icone={<Icone nome="financeiro" />}
          rotulo="Repasse às usinas"
          valor={brl(kpis.repasseUsinas)}
          zerado={!kpis.repasseUsinas}
          texto={`Por mês. NeoPower: ${brl(kpis.neopower)} (${pct(painel.parametros.taxaNeopower)}).`}
        />
      </div>

      {montado && (
        <Painel
          titulo="Alertas"
          detalhe={painel.alertas.length ? 'O que precisa de ação hoje' : undefined}
        >
          <div className="p-5 space-y-2.5">
            {painel.alertas.length === 0 && (
              <Aviso tom="ok">
                Nada pendente: todas as usinas com rateio em dia e todos os pontos com energia.
              </Aviso>
            )}
            {painel.alertas.map((a, i) => (
              <Aviso
                key={i}
                tom={a.nivel === 'erro' ? 'erro' : 'aviso'}
                acao={
                  a.aba ? (
                    <Botao pequeno onClick={() => irPara(a.aba!)}>
                      {a.aba === 'rateio' ? 'Abrir rateio' : 'Conectar'}
                    </Botao>
                  ) : undefined
                }
              >
                {a.texto}
              </Aviso>
            ))}
          </div>
        </Painel>
      )}

      {/* Antes da primeira conexão, os alertas de "ponto sem usina" seriam só ruído. */}
      {!montado && painel.alertas.some(a => a.nivel === 'erro') && (
        <div className="space-y-2.5">
          {painel.alertas
            .filter(a => a.nivel === 'erro')
            .map((a, i) => (
              <Aviso key={i} tom="erro">
                {a.texto}
              </Aviso>
            ))}
        </div>
      )}

      {ativas.length > 0 && (
        <Painel
          titulo="Conexões ativas"
          detalhe={`${ativas.length} conexões · ${painel.usinas.length} usinas`}
        >
          <TabelaConexoes painel={painel} lista={ativas} />
        </Painel>
      )}
    </div>
  );
}
