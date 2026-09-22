'use client';
/**
 * macOS dialogs and sheets — one at a time, through the overlay arbiter (a dialog outranks everything):
 *   · About This Mac (`EGG-ABOUT-01`, `MAC-SET-06`): Jaswanth as the hardware — chip = primary stack, memory = years
 *     of experience (only when the data publishes start dates), startup disk = current role, serial = résumé date;
 *   · Switch Operating System (`MAC-X-05`): visible OSes + Back to chooser;
 *   · Keyboard Shortcuts (`?`): the registry's macOS chords + the in-app keys (Finder columns, Quick Look, Terminal);
 *   · Get Info (`MAC-CTX-05`): kind, dates, stack, links and the canonical link, selected for manual copy when the
 *     clipboard is blocked;
 *   · Quick Look (`MAC-FIND-05`): the same content view, scaled from the row (Space or Esc closes, focus returns);
 *   · Restart… (a confirm sheet that replays the startup beat, for fun) and About {App}.
 * Each is a modal `dialog` with a heading: focus moves in, Tab stays inside, Esc closes, focus returns to the invoker;
 * the Shell makes everything behind it inert.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ContentFor, formatPeriod, formatUpdated } from '@/components/content';
import { FocusScope } from '@/components/primitives/FocusScope';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { SECTION_TITLES } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import {
  getCurrentRole,
  getExperience,
  getIndexEntry,
  getPerson,
  getResume,
  getSkills,
  resolveContent,
} from '@/data/selectors';
import { goPath } from '@/lib/seo/metadata';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { macBinding } from '../model';
import { copyLink, openRef, runMacCommand } from '../run-command';
import { macShortcuts } from '../shortcuts';
import { MAC_SLOTS } from '../slots';
import { MAC_TIMING } from '../timing';
import { afterQueued } from '@/stores/kernel-store';
import { closeDialog, returnFocus, useMacUi, type MacDialog } from '../ui';
import { SwitchOsList } from './SwitchOsList';
import styles from './dialogs.module.css';

/** Years of experience, only from published start dates (never guessed — shared/02). */
export function experienceYears(now = new Date()): number | null {
  const starts = getExperience()
    .map((role) => role.start)
    .filter((start): start is NonNullable<typeof start> => start !== null)
    .map((start) => Number(String(start).slice(0, 4)))
    .filter((year) => Number.isFinite(year));
  if (!starts.length) return null;
  return Math.max(1, now.getFullYear() - Math.min(...starts));
}

function Sheet({
  title,
  children,
  wide = false,
  footer,
  dismiss = 'Done',
  onClose,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
  /** The closing button's label ("Cancel" when the footer holds the sheet's own action). */
  dismiss?: string;
  onClose: () => void;
}) {
  const id = useId();
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      ref={node}
      className={styles.sheet}
      data-wide={wide || undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <FocusScope trapped initialFocus className={styles.scope}>
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>
          {footer}
          <button
            type="button"
            className={dismiss === 'Cancel' ? styles.button : `${styles.button} ${styles.primary}`}
            onClick={onClose}
          >
            {dismiss}
          </button>
        </div>
      </FocusScope>
    </div>
  );
}

function AboutThisMac({ onClose }: { onClose: () => void }) {
  const person = getPerson();
  const role = getCurrentRole();
  const years = experienceYears();
  const stack = getSkills()[0]
    ?.items.slice(0, 3)
    .map((skill) => skill.name)
    .join(' · ');
  const resume = getResume();
  const initials = person.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Sheet
      title="About This Mac"
      onClose={onClose}
      footer={
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            onClose();
            runMacCommand({ kind: 'settings', pane: 'general' });
          }}
        >
          More Info…
        </button>
      }
    >
      <div className={styles.about}>
        <span className={styles.monogram} aria-hidden="true">
          {initials}
        </span>
        <p className={styles.machine}>{person.givenName}</p>
        <p className={styles.model}>{person.role}</p>
        <dl className={styles.specs}>
          {stack ? (
            <>
              <dt>Chip</dt>
              <dd>{stack}</dd>
            </>
          ) : null}
          {years ? (
            <>
              <dt>Memory</dt>
              <dd>{years} years of experience</dd>
            </>
          ) : null}
          {role ? (
            <>
              <dt>Startup disk</dt>
              <dd>{role.role ? `${role.role}, ${role.company}` : role.company}</dd>
            </>
          ) : null}
          <dt>Serial number</dt>
          <dd>
            <time dateTime={resume.updated}>{formatUpdated(resume.updated)}</time>
          </dd>
        </dl>
      </div>
    </Sheet>
  );
}

function Shortcuts({ onClose }: { onClose: () => void }) {
  const shortcuts = macShortcuts();
  const inApp: readonly [string, string][] = [
    ['Finder columns: open / go back', '→ or Enter · ←'],
    ['Quick Look the selected item', 'Space'],
    ['Context menu for the focused item', 'Shift+F10'],
    ['Terminal: complete · history · cancel', 'Tab · ↑↓ · Ctrl+C'],
    ['Leave the Terminal prompt', 'Esc, then Tab'],
  ];
  return (
    <Sheet
      title="Keyboard Shortcuts"
      wide
      onClose={onClose}
      footer={
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            onClose();
            runMacCommand({ kind: 'tour' });
          }}
        >
          Take the Tour
        </button>
      }
    >
      <table className={styles.table}>
        <caption className="sr-only">Keyboard shortcuts</caption>
        <tbody>
          {shortcuts.map((shortcut) => (
            <tr key={shortcut.id}>
              <th scope="row">{shortcut.label}</th>
              <td>
                <kbd>{shortcut.keys}</kbd>
              </td>
            </tr>
          ))}
          {inApp.map(([label, keys]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>
                <kbd>{keys}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}

/** What Get Info says about a piece of content (kind, dates, stack, links) — from the data, never typed here. */
export function infoFor(ref: ContentRef): {
  kind: string;
  rows: readonly [string, string][];
  links: readonly { label: string; url: string }[];
} {
  const content = resolveContent(ref);
  const entry = getIndexEntry(ref);
  switch (content.section) {
    case 'role':
      return {
        kind: 'Role',
        rows: [
          ['Company', content.role.company],
          ...(content.role.role ? ([['Role', content.role.role]] as [string, string][]) : []),
          ...(formatPeriod(content.role.start, content.role.end)
            ? ([['Dates', formatPeriod(content.role.start, content.role.end)!]] as [string, string][])
            : []),
          ...(content.role.stack.length ? ([['Stack', content.role.stack.join(', ')]] as [string, string][]) : []),
        ],
        links: [],
      };
    case 'project':
      return {
        kind: 'Project',
        rows: [
          ['Name', content.project.name],
          ...(content.project.year ? ([['Year', String(content.project.year)]] as [string, string][]) : []),
          ...(content.project.stack.length
            ? ([['Stack', content.project.stack.join(', ')]] as [string, string][])
            : []),
        ],
        links: [
          ...(content.project.repo ? [{ label: 'Source', url: content.project.repo }] : []),
          ...(content.project.live ? [{ label: 'Live site', url: content.project.live }] : []),
        ],
      };
    case 'school':
      return {
        kind: 'School',
        rows: [
          ['School', content.school.school],
          ['Degree', content.school.degree],
          ...(formatPeriod(content.school.start, content.school.end)
            ? ([['Dates', formatPeriod(content.school.start, content.school.end)!]] as [string, string][])
            : []),
        ],
        links: [],
      };
    case 'resume':
      return {
        kind: 'PDF document',
        rows: [['Updated', formatUpdated(content.resume.updated)]],
        links: [],
      };
    default:
      return {
        kind: entry?.parent ? 'Document' : 'Folder',
        rows: [['Section', SECTION_TITLES[ref.section]]],
        links: [],
      };
  }
}

function GetInfo({ target, onClose }: { target: ContentRef; onClose: () => void }) {
  const info = infoFor(target);
  const title = getIndexEntry(target)?.title ?? SECTION_TITLES[target.section];
  const [manual, setManual] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const url = typeof window === 'undefined' ? goPath(target) : `${window.location.origin}${goPath(target)}`;
  useEffect(() => {
    if (manual) field.current?.select();
  }, [manual]);
  return (
    <Sheet
      title={`${title} Info`}
      onClose={onClose}
      footer={
        <button
          type="button"
          className={styles.button}
          onClick={() => void copyLink(target).then((outcome) => setManual(outcome === 'fallback'))}
        >
          Copy Link
        </button>
      }
    >
      <dl className={styles.specs}>
        <dt>Kind</dt>
        <dd>{info.kind}</dd>
        {info.rows.map(([label, value]) => (
          <div key={label} className={styles.pair}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {info.links.map((link) => (
          <div key={link.url} className={styles.pair}>
            <dt>{link.label}</dt>
            <dd>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.url.replace(/^https?:\/\//, '')}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </dd>
          </div>
        ))}
      </dl>
      <label className={styles.link}>
        Link
        <input ref={field} readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
      </label>
      {manual ? <p className={styles.hint}>Press Ctrl/Cmd+C to copy the selected link.</p> : null}
      <p>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            onClose();
            openRef(target);
          }}
        >
          Open
        </button>
      </p>
    </Sheet>
  );
}

function QuickLook({ target, origin, onClose }: { target: ContentRef; origin: string | null; onClose: () => void }) {
  const id = useId();
  const node = useRef<HTMLDivElement>(null);
  const title = getIndexEntry(target)?.title ?? SECTION_TITLES[target.section];

  // Scales from the row it came from (transform + opacity); Space or Esc closes.
  useLayoutEffect(() => {
    const el = node.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return;
    const from = origin ? document.getElementById(origin)?.getBoundingClientRect() : null;
    const to = el.getBoundingClientRect();
    const start = from
      ? `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${Math.max(0.1, from.width / to.width)})`
      : 'scale(0.96)';
    const run = el.animate(
      [
        { transform: start, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: MAC_TIMING.quickLook.ms, easing: MAC_TIMING.quickLook.ease },
    );
    return () => run.cancel();
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && !(event.key === ' ' && !(event.target as Element).closest('a,button,input')))
        return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div ref={node} className={styles.quickLook} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <FocusScope trapped initialFocus className={styles.scope}>
        <header className={styles.qlHead}>
          <h2 id={`${id}-title`} className={styles.qlTitle}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              onClose();
              openRef(target);
            }}
          >
            Open
          </button>
          <button type="button" className={styles.button} onClick={onClose}>
            Close
          </button>
        </header>
        <div className={styles.qlBody}>
          <ContentFor target={target} headingLevel={3} slots={MAC_SLOTS} resumePages={false} />
        </div>
      </FocusScope>
    </div>
  );
}

function Restart({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="Restart this Mac?"
      dismiss="Cancel"
      onClose={onClose}
      footer={
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={() => {
            onClose();
            runMacCommand({ kind: 'restart-now' });
          }}
        >
          Restart
        </button>
      }
    >
      <p>It replays the startup, just for fun. Your windows stay where they are.</p>
    </Sheet>
  );
}

function AboutApp({ role, onClose }: { role: MacDialog & { kind: 'about-app' }; onClose: () => void }) {
  const binding = macBinding(role.role);
  return (
    <Sheet title={`About ${binding.title}`} onClose={onClose}>
      <div className={styles.about}>
        <AssetIcon id={binding.icon} size={64} />
        <p className={styles.machine}>{binding.title}</p>
        <p className={styles.model}>Part of {getPerson().name}’s portfolio, running on this Mac.</p>
      </div>
    </Sheet>
  );
}

/** The dialog host: renders the arbiter's dialog and returns focus to its invoker when it closes. */
export function Dialogs() {
  const dialog = useMacUi((state) => (state.overlay === 'dialog' ? state.dialog : null));
  const close = () => {
    closeDialog();
    // Once the page behind is interactive again (the dialog's inert lifts with the next render).
    afterQueued(() => returnFocus('dialog'));
  };
  if (!dialog) return null;
  let content: ReactNode;
  switch (dialog.kind) {
    case 'about-this-mac':
      content = <AboutThisMac onClose={close} />;
      break;
    case 'switch-os':
      content = (
        <Sheet title="Switch Operating System" onClose={close}>
          <SwitchOsList onPick={closeDialog} />
        </Sheet>
      );
      break;
    case 'shortcuts':
      content = <Shortcuts onClose={close} />;
      break;
    case 'get-info':
      content = <GetInfo target={dialog.ref} onClose={close} />;
      break;
    case 'quick-look':
      content = <QuickLook target={dialog.ref} origin={dialog.origin ?? null} onClose={close} />;
      break;
    case 'restart':
      content = <Restart onClose={close} />;
      break;
    case 'about-app':
      content = <AboutApp role={dialog} onClose={close} />;
      break;
  }
  return (
    <div className={styles.layer} data-dialog-layer="">
      <div className={styles.scrim} aria-hidden="true" />
      {content}
    </div>
  );
}
