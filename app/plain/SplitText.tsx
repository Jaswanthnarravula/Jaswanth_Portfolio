/**
 * Split text for reader reveals (shared/24 `READER-FX-06`). `Letters` keeps one accessible copy of the text and hides
 * the animated letters; `Words` keeps real words (screen readers read them as one sentence) so each can fade with the
 * scroll. The index / position custom properties are fixed layout inputs, not animated values.
 */
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import fx from './fx.module.css';

/** `label` is what assistive tech reads when it differs from the letters (e.g. the text plus trailing punctuation). */
export function Letters({ text, label = text }: { readonly text: string; readonly label?: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span className={fx.letters} data-text={text} aria-hidden="true">
        {Array.from(text).map((letter, index) => (
          <span key={index} className={fx.letter} style={{ '--i': index } as CSSProperties}>
            {letter === ' ' ? ' ' : letter}
          </span>
        ))}
      </span>
    </>
  );
}

export function Words({ text }: { readonly text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const last = Math.max(words.length - 1, 1);
  return words.map((word, index) => (
    <Fragment key={index}>
      <span className={fx.word} style={{ '--p': (index / last).toFixed(3) } as CSSProperties}>
        {word}
      </span>
      {index < words.length - 1 ? ' ' : ''}
    </Fragment>
  ));
}

/** A heading's text wiped up through a clip-path mask as it scrolls in. */
export function Masked({ children }: { readonly children: ReactNode }) {
  return (
    <span className={fx.mask}>
      <span className={fx.maskInner}>{children}</span>
    </span>
  );
}
