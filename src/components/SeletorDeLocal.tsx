import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';

export interface LocalParaSelecao {
  id: number;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  /** Marca do local (client_id); null = da plataforma. */
  clientId?: string | null;
}

const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Seletor de local com busca (relatório financeiro por local). A busca ignora
 * acento e maiúscula e procura no nome, na cidade e no id do local.
 */
export function SeletorDeLocal({
  locais,
  valor,
  onChange,
  mostrarMarca = false,
  carregando = false,
  textoVazio = 'Todos os locais',
}: {
  locais: LocalParaSelecao[];
  valor: number | null;
  onChange: (id: number | null) => void;
  /** Super admin: mostra a marca do local (ou "plataforma"). */
  mostrarMarca?: boolean;
  carregando?: boolean;
  /** Texto do botão sem local escolhido. */
  textoVazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const selecionado = locais.find(l => l.id === valor) ?? null;
  const detalhe = (l: LocalParaSelecao) =>
    [
      [l.cidade, l.estado].filter(Boolean).join('/'),
      mostrarMarca ? l.clientId || 'plataforma' : null,
      `#${l.id}`,
    ]
      .filter(Boolean)
      .join(' · ');

  const escolher = (id: number | null) => {
    onChange(id);
    setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={aberto}
          aria-label="Local"
          className="w-full flex items-center gap-2 pl-3 pr-2 py-2.5 bg-background border border-outline-variant/15 rounded-lg text-sm text-foreground hover:bg-surface-container-highest/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        >
          <span className="material-symbols-outlined text-outline text-lg">location_on</span>
          <span className={`flex-1 truncate text-left ${selecionado ? '' : 'text-outline'}`}>
            {selecionado
              ? selecionado.nome
              : valor != null
                ? `Local #${valor}`
                : carregando
                  ? 'Carregando locais...'
                  : textoVazio}
          </span>
          <span className="material-symbols-outlined text-outline text-lg">unfold_more</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[340px]" align="start">
        <Command
          filter={(value, busca) => (semAcento(value).includes(semAcento(busca.trim())) ? 1 : 0)}
        >
          <CommandInput placeholder="Buscar local por nome ou cidade..." />
          <CommandList>
            <CommandEmpty>Nenhum local encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Todos os locais" onSelect={() => escolher(null)}>
                <span className="flex-1">Todos os locais</span>
                {valor == null && (
                  <span className="material-symbols-outlined text-primary text-base">check</span>
                )}
              </CommandItem>
              {locais.map(l => (
                <CommandItem
                  key={l.id}
                  value={`${l.nome} ${l.cidade ?? ''} ${l.estado ?? ''} #${l.id}`}
                  onSelect={() => escolher(l.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{l.nome}</p>
                    <p className="text-xs text-on-surface-variant truncate">{detalhe(l)}</p>
                  </div>
                  {valor === l.id && (
                    <span className="material-symbols-outlined text-primary text-base">check</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
