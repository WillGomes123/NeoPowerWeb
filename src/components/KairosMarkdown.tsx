// Markdown simples para as respostas da KAIROS: parágrafos, quebras de linha,
// títulos (#), listas (- * 1.), **negrito**, *itálico*, `código` e blocos ```.
// Gera elementos React (sem innerHTML), então o texto da IA nunca vira HTML.
import { Fragment, ReactNode } from 'react';

const inline = (texto: string, chave: string): ReactNode[] => {
  const out: ReactNode[] = [];
  // `_itálico_` só fora de palavras, para não quebrar ids como charge_point_id.
  const re =
    /(\*\*[^*]+?\*\*|(?<!\w)__[^_]+?__(?!\w)|`[^`]+?`|\*[^*\s][^*]*?\*|(?<!\w)_[^_\s][^_]*?_(?!\w))/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) out.push(texto.slice(ultimo, m.index));
    const t = m[0];
    const k = `${chave}-${i++}`;
    if (t.startsWith('**') || t.startsWith('__')) {
      out.push(
        <strong key={k} className="font-bold">
          {t.slice(2, -2)}
        </strong>
      );
    } else if (t.startsWith('`')) {
      out.push(
        <code
          key={k}
          className="px-1 py-0.5 rounded bg-surface-container-low font-mono text-[0.95em]"
        >
          {t.slice(1, -1)}
        </code>
      );
    } else {
      out.push(<em key={k}>{t.slice(1, -1)}</em>);
    }
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) out.push(texto.slice(ultimo));
  return out;
};

/** Linhas de um parágrafo, com <br/> entre elas. */
const linhas = (ls: string[], chave: string) =>
  ls.map((l, i) => (
    <Fragment key={`${chave}-${i}`}>
      {i > 0 && <br />}
      {inline(l, `${chave}-${i}`)}
    </Fragment>
  ));

export const KairosMarkdown = ({ texto }: { texto: string }) => {
  const src = (texto || '').replace(/\r\n?/g, '\n').split('\n');
  const blocos: ReactNode[] = [];
  let i = 0;
  let b = 0;

  while (i < src.length) {
    const linha = src[i];
    const k = `b${b++}`;

    if (!linha.trim()) {
      i++;
      continue;
    }

    // Bloco de código
    if (linha.trim().startsWith('```')) {
      const corpo: string[] = [];
      i++;
      while (i < src.length && !src[i].trim().startsWith('```')) corpo.push(src[i++]);
      i++;
      blocos.push(
        <pre
          key={k}
          className="p-2.5 rounded-lg bg-surface-container-low font-mono text-[11px] overflow-x-auto whitespace-pre"
        >
          {corpo.join('\n')}
        </pre>
      );
      continue;
    }

    // Título
    const titulo = /^(#{1,4})\s+(.*)$/.exec(linha);
    if (titulo) {
      blocos.push(
        <p key={k} className={`font-bold ${titulo[1].length <= 2 ? 'text-[13px]' : ''}`}>
          {inline(titulo[2], k)}
        </p>
      );
      i++;
      continue;
    }

    // Listas
    const ehUl = (l: string) => /^\s*[-*•]\s+/.test(l);
    const ehOl = (l: string) => /^\s*\d+[.)]\s+/.test(l);
    if (ehUl(linha) || ehOl(linha)) {
      const ordenada = ehOl(linha);
      const itens: string[] = [];
      while (i < src.length && (ordenada ? ehOl(src[i]) : ehUl(src[i]))) {
        let item = src[i].replace(ordenada ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/, '');
        i++;
        // Continuação indentada do mesmo item
        while (i < src.length && /^\s{2,}\S/.test(src[i]) && !ehUl(src[i]) && !ehOl(src[i])) {
          item += `\n${src[i].trim()}`;
          i++;
        }
        itens.push(item);
      }
      const Tag = ordenada ? 'ol' : 'ul';
      blocos.push(
        <Tag key={k} className={`pl-5 space-y-1 ${ordenada ? 'list-decimal' : 'list-disc'}`}>
          {itens.map((it, j) => (
            <li key={j}>{linhas(it.split('\n'), `${k}-${j}`)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    // Parágrafo: junta linhas até uma linha em branco ou outro bloco
    const par: string[] = [];
    while (
      i < src.length &&
      src[i].trim() &&
      !src[i].trim().startsWith('```') &&
      !/^#{1,4}\s/.test(src[i]) &&
      !ehUl(src[i]) &&
      !ehOl(src[i])
    ) {
      par.push(src[i++]);
    }
    blocos.push(<p key={k}>{linhas(par, k)}</p>);
  }

  return <div className="space-y-2 break-words">{blocos}</div>;
};
