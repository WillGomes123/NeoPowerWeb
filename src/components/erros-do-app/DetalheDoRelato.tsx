import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import {
  CLASSES_DO_TOM,
  atrasoDaChegada,
  codigoDoRelato,
  dataHoraCompleta,
  ehFatal,
  infoDoTipo,
  jsEmUso,
  momentoDoRelato,
  rotuloDaPlataforma,
  textoDoRelato,
  versaoComBuild,
  type RelatoDeErro,
  type Tom,
} from '../../lib/errosDoApp';

function copiar(texto: string, aviso: string) {
  // Sem HTTPS (ou sem permissão) o navegador não expõe a área de transferência.
  if (!navigator.clipboard) {
    toast.error('Não foi possível copiar');
    return;
  }
  navigator.clipboard
    .writeText(texto)
    .then(() => toast.success(aviso))
    .catch(() => toast.error('Não foi possível copiar'));
}

function Selo({ tom, icone, children }: { tom: Tom; icone: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${CLASSES_DO_TOM[tom]}`}
    >
      <span className="material-symbols-outlined text-sm" aria-hidden="true">
        {icone}
      </span>
      {children}
    </span>
  );
}

/**
 * Selo do tipo do relato, sempre com ícone e rótulo (a cor só reforça). O
 * "fatal" aparece à parte quando o tipo, por si, não diz que o app caiu.
 */
export function SeloDoTipo({ relato }: { relato: Pick<RelatoDeErro, 'tipo' | 'fatal'> }) {
  const info = infoDoTipo(relato.tipo);
  const fatalAParte = ehFatal(relato) && info.tom !== 'critico';
  return (
    <span className="inline-flex flex-wrap items-center gap-1" title={info.descricao}>
      <Selo tom={info.tom} icone={info.icone}>
        {info.rotulo}
      </Selo>
      {fatalAParte && (
        <Selo tom="critico" icone="bolt">
          fatal
        </Selo>
      )}
    </span>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">
      {children}
    </h4>
  );
}

function Campo({
  rotulo,
  valor,
  detalhe,
  mono = false,
  copiavel = false,
}: {
  rotulo: string;
  valor: string | null | undefined;
  detalhe?: string | null;
  mono?: boolean;
  copiavel?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-on-surface-variant">{rotulo}</dt>
      <dd className="flex items-start gap-1.5 min-w-0">
        <span
          className={`text-on-surface break-all ${mono ? 'font-mono text-xs leading-5' : 'text-sm'}`}
        >
          {valor || '—'}
          {detalhe && (
            <span className="ml-1 font-mono text-[11px] text-on-surface-variant">({detalhe})</span>
          )}
        </span>
        {copiavel && valor && (
          <button
            type="button"
            onClick={() => copiar(valor, `${rotulo} copiado`)}
            className="shrink-0 text-on-surface-variant hover:text-primary transition-colors"
            title={`Copiar ${rotulo.toLowerCase()}`}
          >
            <span className="sr-only">Copiar {rotulo.toLowerCase()}</span>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              content_copy
            </span>
          </button>
        )}
      </dd>
    </div>
  );
}

function BlocoDeCodigo({
  titulo,
  texto,
  vazio,
  avisoAoCopiar,
}: {
  titulo: string;
  texto: string | null;
  vazio: string;
  avisoAoCopiar: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <Titulo>{titulo}</Titulo>
        {texto && (
          <button
            type="button"
            onClick={() => copiar(texto, avisoAoCopiar)}
            className="flex items-center gap-1 text-primary text-[10px] font-bold uppercase tracking-widest hover:underline"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              content_copy
            </span>
            Copiar
          </button>
        )}
      </div>
      {texto ? (
        // Quebra as linhas longas da pilha do Hermes em vez de rolar para o lado.
        <pre className="text-[11px] leading-relaxed font-mono text-on-surface bg-surface-container-lowest/60 rounded-md p-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
          {texto}
        </pre>
      ) : (
        <p className="text-xs text-on-surface-variant">{vazio}</p>
      )}
    </section>
  );
}

function Conteudo({ relato, marca }: { relato: RelatoDeErro; marca: string }) {
  const info = infoDoTipo(relato.tipo);
  const atraso = atrasoDaChegada(relato);
  const execucao = typeof relato.contexto?.execucao === 'string' ? relato.contexto.execucao : null;
  const contexto =
    relato.contexto && Object.keys(relato.contexto).length
      ? JSON.stringify(relato.contexto, null, 2)
      : null;
  const sistema = [rotuloDaPlataforma(relato.plataforma), relato.osVersao]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <SheetHeader className="shrink-0 px-6 pt-6 pb-4 pr-12 border-b border-outline-variant/10">
        <SheetTitle className="text-on-surface font-headline flex items-center gap-3">
          <span className={`p-2 rounded-lg border ${CLASSES_DO_TOM[info.tom]}`}>
            <span className="material-symbols-outlined text-xl block" aria-hidden="true">
              {info.icone}
            </span>
          </span>
          <span className="truncate">{info.rotulo}</span>
          <span className="font-mono text-xs font-normal text-on-surface-variant">
            #{relato.id}
          </span>
        </SheetTitle>
        <SheetDescription className="text-on-surface-variant text-xs">
          Ocorreu em {dataHoraCompleta(momentoDoRelato(relato))}
          {atraso ? `, chegou ${atraso} depois` : ''}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* O título já diz o tipo; o selo só entra quando o tipo não diz que foi fatal. */}
          {ehFatal(relato) && info.tom !== 'critico' && (
            <Selo tom="critico" icone="bolt">
              fatal
            </Selo>
          )}
          {relato.emergencia && (
            <Selo tom="critico" icone="emergency_home">
              Abertura de emergência
            </Selo>
          )}
          <span className="font-mono text-[11px] text-on-surface-variant">{relato.tipo}</span>
        </div>
      </SheetHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
        <section className="space-y-2">
          <Titulo>Mensagem</Titulo>
          <p className="text-sm text-on-surface whitespace-pre-wrap break-words">
            {relato.mensagem || 'Sem mensagem'}
          </p>
          <p className="text-xs text-on-surface-variant">{info.descricao}</p>
        </section>

        <section className="space-y-3">
          <Titulo>App</Titulo>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <Campo rotulo="Marca" valor={marca} detalhe={relato.clientId} />
            <Campo
              rotulo="Versão (build)"
              valor={versaoComBuild(relato.appVersao, relato.appBuild)}
            />
            <Campo rotulo="JS em uso" valor={jsEmUso(relato)} />
            <Campo rotulo="Update ID" valor={relato.updateId} mono copiavel />
            <Campo rotulo="Canal" valor={relato.canal} />
            <Campo rotulo="Runtime" valor={relato.runtime} />
          </dl>
        </section>

        <section className="space-y-3">
          <Titulo>Aparelho</Titulo>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <Campo rotulo="Sistema" valor={sistema} />
            <Campo rotulo="Modelo" valor={relato.modelo} />
            <Campo rotulo="App ID" valor={relato.appId} mono />
          </dl>
        </section>

        <section className="space-y-3">
          <Titulo>Ocorrência</Titulo>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <Campo
              rotulo="Usuário"
              valor={relato.userId != null ? `#${relato.userId}` : 'Sem login'}
            />
            <Campo rotulo="Tela" valor={relato.tela} mono />
            {/* O mesmo código que a tela de erro do app mostra para a pessoa. */}
            <Campo rotulo="Código" valor={codigoDoRelato(relato)} mono copiavel />
            <Campo rotulo="Execução" valor={execucao} mono />
            <Campo rotulo="Recebido em" valor={dataHoraCompleta(relato.criadoEm)} />
          </dl>
        </section>

        <BlocoDeCodigo
          titulo="Pilha"
          texto={relato.pilha}
          avisoAoCopiar="Pilha copiada"
          vazio={
            relato.tipo === 'encerramento_abrupto'
              ? 'Sem pilha: o app caiu fora do JS (crash nativo, travamento ou encerrado pelo sistema).'
              : 'Sem pilha.'
          }
        />
        <BlocoDeCodigo
          titulo="Contexto"
          texto={contexto}
          avisoAoCopiar="Contexto copiado"
          vazio="Sem contexto."
        />
      </div>

      <div className="shrink-0 px-6 py-4 border-t border-outline-variant/10 flex justify-end">
        <button
          type="button"
          onClick={() => copiar(textoDoRelato(relato, marca), 'Relato copiado')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/20 text-on-surface text-sm font-bold hover:bg-surface-container-highest transition-all"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            content_copy
          </span>
          Copiar relato
        </button>
      </div>
    </>
  );
}

interface DetalheDoRelatoProps {
  /** Fica preenchido ao fechar, para o painel não esvaziar durante a animação. */
  relato: RelatoDeErro | null;
  aberto: boolean;
  nomeDaMarca: (clientId: string | null) => string;
  aoFechar: () => void;
}

export const DetalheDoRelato = ({
  relato,
  aberto,
  nomeDaMarca,
  aoFechar,
}: DetalheDoRelatoProps) => (
  <Sheet
    open={aberto && relato !== null}
    onOpenChange={abrir => {
      if (!abrir) aoFechar();
    }}
  >
    <SheetContent
      side="right"
      className="bg-surface-container border-outline-variant/20 w-full sm:max-w-2xl p-0 gap-0 focus:outline-none"
      // Sem isto o foco cai no primeiro botão (copiar o update ID). O painel
      // recebe o foco e o Tab segue para os botões dele.
      onOpenAutoFocus={e => {
        e.preventDefault();
        (e.currentTarget as HTMLElement | null)?.focus();
      }}
    >
      {relato && <Conteudo relato={relato} marca={nomeDaMarca(relato.clientId)} />}
    </SheetContent>
  </Sheet>
);
