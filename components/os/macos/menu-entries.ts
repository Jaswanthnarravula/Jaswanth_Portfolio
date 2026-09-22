/**
 * Menu data (`MenuSpec`, serialisable) → the `Menu` primitive's entries, plus the macOS close feedback
 * (plans/macos/03 "Menus / context menus": open 0 ms · the chosen item blinks 60 ms · the menu fades out 130 ms).
 * The command runs at once — input always wins — and the blink + fade play on a detached, inert copy of the menu in
 * the shell's ghost layer (`[data-mac-ghosts]`), so nothing waits for them. Reduced motion: no blink, no fade.
 * Shortcut hints come from the keymap registry only (`MAC-MENU-08`).
 */
import type { MenuEntry } from '@/components/primitives/Menu';
import { prefersReducedMotion } from '@/lib/motion/dur';
import type { MacCommand } from './commands';
import { shortcutLabel, type MenuSpec } from './menus';
import { MAC_TIMING } from './timing';

/** Play the blink + fade on a copy of the open menu holding the chosen item (found by its label). */
export function menuFeedback(label: string, doc: Document | undefined = globalThis.document): void {
  if (!doc || prefersReducedMotion(doc.documentElement)) return;
  const item = [...doc.querySelectorAll<HTMLElement>('[role="menu"] [data-menu-item]')].find(
    (node) => node.querySelector('[data-menu-label]')?.textContent === label,
  );
  const menu = item?.closest<HTMLElement>('[role="menu"]');
  const layer = menu?.closest('[data-os="macos"], [data-mac-root]')?.querySelector('[data-mac-ghosts]');
  if (!item || !menu || !layer || typeof menu.animate !== 'function') return;
  const box = menu.getBoundingClientRect();
  const ghost = menu.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    margin: '0',
    pointerEvents: 'none',
  });
  const index = [...menu.querySelectorAll('[data-menu-item]')].indexOf(item);
  const copy = ghost.querySelectorAll<HTMLElement>('[data-menu-item]')[index];
  layer.append(ghost);
  const { blinkMs, fadeOutMs } = MAC_TIMING.menu;
  // Blink: the highlight goes off for one beat, then the whole menu fades.
  copy?.setAttribute('data-blink', '');
  copy?.animate([{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }], {
    duration: blinkMs,
    easing: 'steps(2, jump-none)',
  });
  const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: fadeOutMs,
    delay: blinkMs,
    easing: 'linear',
    fill: 'forwards',
  });
  const remove = () => ghost.remove();
  fade.finished.then(remove, remove);
}

export function toMenuEntries(
  specs: readonly MenuSpec[],
  run: (command: MacCommand) => void,
  { apple = false }: { apple?: boolean } = {},
): readonly MenuEntry[] {
  const select = (label: string, command: MacCommand) => () => {
    menuFeedback(label);
    run(command);
  };
  return specs.map((spec): MenuEntry => {
    switch (spec.kind) {
      case 'separator':
        return spec;
      case 'submenu':
        return {
          kind: 'submenu',
          id: spec.id,
          label: spec.label,
          disabled: spec.disabled,
          items: toMenuEntries(spec.items, run, { apple }),
        };
      case 'checkbox':
        return {
          kind: 'checkbox',
          id: spec.id,
          label: spec.label,
          checked: spec.checked,
          onSelect: select(spec.label, spec.command),
        };
      case 'item':
        return {
          kind: 'item',
          id: spec.id,
          label: spec.label,
          disabled: spec.disabled,
          shortcut: spec.shortcut ? shortcutLabel(spec.shortcut, apple) : undefined,
          onSelect: select(spec.label, spec.command),
        };
    }
  });
}
