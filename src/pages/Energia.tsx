import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Cable, ListChecks, PieChart, Receipt } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ABAS, type AbaEnergia, type PainelEnergia } from '../lib/energia';
import type { AbaProps } from '../components/energia/tipos';
import { VisaoGeral } from '../components/energia/VisaoGeral';
import { Usinas } from '../components/energia/Usinas';
import { Pontos } from '../components/energia/Pontos';
import { Conexoes } from '../components/energia/Conexoes';
import { Rateio } from '../components/energia/Rateio';
import { Apuracao } from '../components/energia/Apuracao';
import { Modalidades } from '../components/energia/Modalidades';
import { Icone } from '../components/painel/Icone';
import { AbasDaPagina, BotaoAtualizar, CabecalhoDaPagina } from '../components/painel/Pagina';

/** Ícone de cada aba: os do Figma (visão geral, usinas, pontos); os outros do Lucide. */
const ICONE_DA_ABA: Record<AbaEnergia, ReactNode> = {
  visao: <Icone nome="visao-geral" />,
  usinas: <Icone nome="usinas" />,
  pontos: <Icone nome="pontos-consumidores" />,
  conexoes: <Cable aria-hidden="true" className="w-6 h-6" />,
  rateio: <PieChart aria-hidden="true" className="w-6 h-6" />,
  apuracao: <Receipt aria-hidden="true" className="w-6 h-6" />,
  modalidades: <ListChecks aria-hidden="true" className="w-6 h-6" />,
};

/**
 * Energia — usinas de geração distribuída ligadas à rede de recarga.
 * Por enquanto só a NeoPower vê (a API recusa as outras marcas).
 */

const CONTEUDO: Record<AbaEnergia, ComponentType<AbaProps>> = {
  visao: VisaoGeral,
  usinas: Usinas,
  pontos: Pontos,
  conexoes: Conexoes,
  rateio: Rateio,
  apuracao: Apuracao,
  modalidades: Modalidades,
};

/** Mensagem da API: { error } nos erros, com { details } nas validações. */
async function mensagemDeErro(r: Response): Promise<string> {
  try {
    const d = await r.json();
    const detalhes = Array.isArray(d?.details)
      ? d.details
          .map((x: { field: string; message: string }) => `${x.field}: ${x.message}`)
          .join('; ')
      : '';
    return [d?.error || d?.message, detalhes].filter(Boolean).join(' — ') || `Erro ${r.status}`;
  } catch {
    return `Erro ${r.status}`;
  }
}

export const Energia = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [painel, setPainel] = useState<PainelEnergia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);

  const aba = (
    ABAS.some(a => a.id === params.get('aba')) ? params.get('aba') : 'visao'
  ) as AbaEnergia;
  const irPara = (a: AbaEnergia) => {
    setParams(a === 'visao' ? {} : { aba: a });
    window.scrollTo({ top: 0 });
  };

  // A seção também muda pelo submenu da Energia no menu lateral (só o ?aba=
  // muda). A página rola dentro do <main> da moldura: volta ao topo dele.
  useEffect(() => {
    document.querySelector('main')?.scrollTo?.({ top: 0 });
  }, [aba]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get('/energia/painel');
      if (r.ok) {
        setPainel((await r.json()) as PainelEnergia);
        setBloqueio(null);
        setAtualizadoEm(new Date());
        setFalhou(false);
      } else if (r.status === 403) {
        setBloqueio(await mensagemDeErro(r));
      } else {
        setFalhou(true);
        toast.error(await mensagemDeErro(r));
      }
    } catch {
      setFalhou(true);
      toast.error('Não foi possível carregar o módulo Energia.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const mudar: AbaProps['mudar'] = async (metodo, url, corpo, sucesso) => {
    try {
      const r = metodo === 'put' ? await api.put(url, corpo) : await api.post(url, corpo);
      if (!r.ok) {
        toast.error(await mensagemDeErro(r));
        return false;
      }
      setPainel((await r.json()) as PainelEnergia);
      if (sucesso) toast.success(sucesso);
      return true;
    } catch {
      toast.error('Falha de comunicação com o servidor.');
      return false;
    }
  };

  if (carregando && !painel) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (bloqueio || !painel) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-3">
        <span className="material-symbols-outlined text-5xl text-muted-foreground">lock</span>
        <h1 className="text-[32px] font-semibold text-foreground">Energia</h1>
        <p className="text-[15px] text-muted-foreground">
          {bloqueio || 'Não foi possível carregar o módulo.'}
        </p>
      </div>
    );
  }

  const Conteudo = CONTEUDO[aba];
  const atual = ABAS.find(a => a.id === aba)!;

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        rotulo="Geração distribuída"
        titulo={`Energia - ${atual.label}`}
        subtitulo={
          <span className="text-muted-foreground">
            Configure e monitore suas usinas, pontos de consumo e distribuição de energia.
          </span>
        }
        acoes={
          <BotaoAtualizar
            aoAtualizar={() => void carregar()}
            carregando={carregando}
            atualizadoEm={atualizadoEm}
            falhou={falhou}
          />
        }
      />

      <AbasDaPagina
        rotulo="Seções do módulo Energia"
        abas={ABAS.map(a => ({ id: a.id, rotulo: a.label, icone: ICONE_DA_ABA[a.id] }))}
        ativa={aba}
        aoMudar={irPara}
      />

      <Conteudo painel={painel} podeEditar={user?.role === 'admin'} mudar={mudar} irPara={irPara} />
    </div>
  );
};
