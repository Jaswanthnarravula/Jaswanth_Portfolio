/**
 * Reader-mode About code card (`ROUTE-PLAIN-01` deviation, owner 2026-09-26): the person record written as a small
 * Java file beside the About lead — name, role, core stack and location all come from `getPerson()`. The code is real
 * text from the first frame; the looping typing effect only clips it (shared/24 motion rules). Line numbers are CSS
 * counters so screen readers skip them. Both buttons are links.
 */
import { getPerson } from '@/data/selectors';
import fx from './fx.module.css';
import styles from './plain.module.css';

type Kind = 'comment' | 'keyword' | 'type' | 'name' | 'call' | 'string' | 'strong';
type Part = string | readonly [kind: Kind, text: string];

/** One source line: gutter number (CSS), indent, then the code the typing loop reveals (`data-fx-text`). */
function Line({ depth = 0, parts }: { readonly depth?: number; readonly parts: readonly Part[] }) {
  return (
    <span className={styles.codeLine}>
      {depth > 0 && <span className={styles.codeIndent}>{'  '.repeat(depth)}</span>}
      <span className={styles.codeText} data-fx-text="">
        {parts.map((part, index) =>
          typeof part === 'string' ? (
            part
          ) : (
            <span key={index} className={styles[`tok_${part[0]}`]}>
              {part[1]}
            </span>
          ),
        )}
      </span>
      {'\n'}
    </span>
  );
}

/** One builder step: `.method("value")` at the chained-call indent. */
function Step({
  method,
  value,
  strong,
}: {
  readonly method: string;
  readonly value: string;
  readonly strong?: boolean;
}) {
  return <Line depth={4} parts={['.', ['call', method], '(', [strong ? 'strong' : 'string', `"${value}"`], ')']} />;
}

export function PlainCode() {
  const person = getPerson();
  const stack = person.glance?.coreStack.slice(0, 3) ?? [];
  return (
    <figure className={`${styles.code} ${styles.reveal}`} aria-labelledby="plain-code-file">
      <div className={styles.codeBar}>
        <span className={styles.codeLights} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <figcaption id="plain-code-file" className={styles.codeFile}>
          <span aria-hidden="true" />
          Portfolio.java
        </figcaption>
      </div>
      {/* The typing loop (lib/motion/code-typing) only clips what is already here; hover or focus shows it all. */}
      <pre className={styles.codeBody} data-fx-type="">
        <code>
          <Line parts={[['comment', '// Hello, World — thanks for stopping by.']]} />
          <Line parts={[['keyword', 'package'], ' dev.', ['name', 'portfolio'], ';']} />
          <Line parts={[]} />
          <Line parts={[['keyword', 'public class'], ' ', ['type', 'Portfolio'], ' {']} />
          <Line
            depth={1}
            parts={[['keyword', 'public static void'], ' ', ['call', 'main'], '(', ['type', 'String'], '[] args) {']}
          />
          <Line
            depth={2}
            parts={[['type', 'Engineer'], ' me = ', ['type', 'Engineer'], '.', ['call', 'builder'], '()']}
          />
          <Step method="name" value={person.name} strong />
          <Step method="role" value={person.role} />
          {stack.length > 0 && (
            <Line
              depth={4}
              parts={[
                '.',
                ['call', 'stack'],
                '(',
                ['type', 'List'],
                '.',
                ['call', 'of'],
                '(',
                ...stack.flatMap((item, index): Part[] =>
                  index === 0 ? [['string', `"${item}"`]] : [', ', ['string', `"${item}"`]],
                ),
                '))',
              ]}
            />
          )}
          <Step method="basedIn" value={person.location} />
          <Line depth={4} parts={['.', ['call', 'build'], '();']} />
          <Line depth={2} parts={['me.', ['call', 'ship'], '();', '  ', ['comment', '// see it in action ↓']]} />
          <Line depth={1} parts={['}']} />
          <Line parts={['}']} />
        </code>
        <span className={styles.codeCaret} aria-hidden="true" data-fx-caret="" />
      </pre>
      <div className={styles.codeActions}>
        <a className={`${styles.codeRun} ${fx.magnet}`} href="#experience" data-fx-magnet="">
          <span aria-hidden="true">▷</span> Run me.ship()
          <span className="sr-only"> — jump to experience</span>
        </a>
        <a className={`${styles.codeSecondary} ${fx.magnet}`} href="#projects" data-fx-magnet="">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
            <path
              d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h13.3a1.5 1.5 0 0 0 1.44-1.08L21.5 11H7.6a1.5 1.5 0 0 0-1.44 1.08L4.5 17.5M3 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.5h6.8A1.5 1.5 0 0 1 19 8.5V11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          Open projects/
        </a>
      </div>
    </figure>
  );
}
