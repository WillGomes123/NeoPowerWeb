import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { cn } from '../ui/utils';
import { classeDoBotaoContorno, classeDoBotaoPerigo } from '../painel/Pecas';
import { api } from '../../lib/api';

/**
 * Confirmação de "Excluir local" (só admin). Diz a consequência: o local sai do
 * painel e do app e não volta. A API só exclui local sem carregador; quando
 * sabemos que há carregador, o botão fica desligado com o motivo, em vez de
 * deixar o pedido falhar.
 */
export function ConfirmarExclusaoDoLocal({
  local,
  carregadores,
  aoFechar,
  aoExcluir,
}: {
  /** Local a excluir; null fecha a janela. */
  local: { id: number; nomeDoLocal: string } | null;
  /** Carregadores cadastrados no local (null quando não se sabe). */
  carregadores: number | null;
  aoFechar: () => void;
  aoExcluir: () => void;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const bloqueado = !!carregadores && carregadores > 0;

  const excluir = async () => {
    if (!local) return;
    setExcluindo(true);
    try {
      const res = await api.delete(`/locations/${local.id}`);
      if (res.ok) {
        toast.success('Local excluído.');
        aoExcluir();
      } else {
        // A API manda o motivo em `error` (ex.: "Existem 2 carregador(es) associado(s)...").
        const corpo = await res.json().catch(() => ({}));
        toast.error(corpo.error || corpo.message || 'Não foi possível excluir o local.');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor.');
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <AlertDialog open={!!local} onOpenChange={aberto => !aberto && !excluindo && aoFechar()}>
      <AlertDialogContent className="bg-card border-border rounded-[15px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[20px] font-semibold text-foreground">
            Excluir o local “{local?.nomeDoLocal}”?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-[15px] text-foreground">
              {bloqueado ? (
                <p>
                  Este local tem {carregadores} carregador{carregadores === 1 ? '' : 'es'}. Para
                  excluir, mova ou remova os carregadores antes (em Estações).
                </p>
              ) : (
                <p>O local sai do painel e do app de vez. Não dá para desfazer.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3">
          <AlertDialogCancel
            disabled={excluindo}
            className={cn(classeDoBotaoContorno, 'h-12 px-6 mt-0')}
          >
            {bloqueado ? 'Fechar' : 'Cancelar'}
          </AlertDialogCancel>
          {!bloqueado && (
            <button
              type="button"
              onClick={() => void excluir()}
              disabled={excluindo}
              className={cn(classeDoBotaoPerigo, 'h-12 px-6')}
            >
              {excluindo ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              )}
              Excluir local
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
