import { useCallback, useEffect, useState, type ComponentType } from 'react';
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

  const aba = (
    ABAS.some(a => a.id === params.get('aba')) ? params.get('aba') : 'visao'
  ) as AbaEnergia;
  const irPara = (a: AbaEnergia) => {
    setParams(a === 'visao' ? {} : { aba: a });
    window.scrollTo({ top: 0 });
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get('/energia/painel');
      if (r.ok) {
        setPainel((await r.json()) as PainelEnergia);
        setBloqueio(null);
      } else if (r.status === 403) {
        setBloqueio(await mensagemDeErro(r));
      } else {
        toast.error(await mensagemDeErro(r));
      }
    } catch {
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
        <span className="material-symbols-outlined text-5xl text-outline">lock</span>
        <h2 className="text-2xl font-headline font-bold text-on-surface">Energia</h2>
        <p className="text-sm text-on-surface-variant">
          {bloqueio || 'Não foi possível carregar o módulo.'}
        </p>
      </div>
    );
  }

  const Conteudo = CONTEUDO[aba];
  const atual = ABAS.find(a => a.id === aba)!;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">
            Geração distribuída
          </span>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">
            Energia · {atual.label}
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Usinas ligadas à rede de recarga: quem abastece qual ponto, quanto cada um economiza e o
            que vai para a usina.
          </p>
        </div>
        <button
          onClick={() => void carregar()}
          className="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/10 text-on-surface-variant hover:text-primary transition-colors self-start md:self-auto"
        >
          <span className={`material-symbols-outlined text-sm ${carregando ? 'animate-spin' : ''}`}>
            refresh
          </span>
          <span className="text-xs font-bold font-headline uppercase tracking-wider">
            Atualizar
          </span>
        </button>
      </div>

      <nav
        className="bg-surface-container-low p-1 rounded-lg border border-outline-variant/10 flex gap-1 overflow-x-auto"
        aria-label="Seções do módulo Energia"
      >
        {ABAS.map(a => (
          <button
            key={a.id}
            onClick={() => irPara(a.id)}
            aria-current={aba === a.id ? 'page' : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-bold font-headline rounded-md transition-all ${
              aba === a.id
                ? 'bg-surface-container-highest text-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </nav>

      <Conteudo painel={painel} podeEditar={user?.role === 'admin'} mudar={mudar} irPara={irPara} />
    </div>
  );
};
