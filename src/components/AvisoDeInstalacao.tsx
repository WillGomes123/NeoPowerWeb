import { useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { useTenant } from '../contexts/TenantContext';
import { appDaMarca } from '../lib/appInstalavel';
import { useAvisoDeInstalacao } from '../lib/instalarNoCelular';

/** As páginas legais servem os clientes do app das lojas, não quem usa o painel. */
const PAGINAS_SEM_AVISO = ['/privacidade', '/termos', '/excluir-conta', '/suporte'];

/**
 * Cartão no pé da tela, só no celular, oferecendo instalar o painel como app
 * (ver lib/instalarNoCelular.ts). Usa o nome e o ícone da marca da URL, os
 * mesmos que o celular vai mostrar depois de instalado.
 */
export function AvisoDeInstalacao() {
  const { modo, instalar, dispensar } = useAvisoDeInstalacao();
  const { tenantSlug, tenantBranding } = useTenant();
  const { pathname } = useLocation();

  if (!modo || PAGINAS_SEM_AVISO.some(p => pathname.startsWith(p))) return null;

  const nome = appDaMarca(tenantSlug, tenantBranding, '').nome;
  const icone = document.head.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');

  return (
    <div
      role="dialog"
      aria-label={`Instalar ${nome}`}
      className="fixed inset-x-3 z-[45] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-start gap-3">
        {icone && <img src={icone} alt="" className="size-11 shrink-0 rounded-[10px]" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instale o {nome} no celular</p>
          {modo === 'instalar' ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              O painel abre direto da tela inicial, em tela cheia, como um aplicativo.
            </p>
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Toque em{' '}
              <span className="material-symbols-outlined align-[-3px] text-base leading-none">
                ios_share
              </span>{' '}
              Compartilhar (no Safari, ele também fica no menu ⋯) e depois em{' '}
              <strong className="text-foreground">Adicionar à Tela de Início</strong>.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {modo === 'instalar' ? (
          <>
            <Button variant="ghost" size="sm" onClick={dispensar}>
              Agora não
            </Button>
            <Button size="sm" onClick={() => void instalar()}>
              Instalar
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={dispensar}>
            Entendi
          </Button>
        )}
      </div>
    </div>
  );
}
