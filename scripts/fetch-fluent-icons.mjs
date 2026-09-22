/**
 * Fluent UI System Icons for the Windows 11 skin — plans/windows/01-identity "Iconography": system glyphs come from
 * Fluent UI System Icons (Microsoft, MIT). Downloads a pinned version of the named SVGs from the npm package on
 * jsDelivr and writes their path data to `components/os/windows/fluent.generated.ts`, one named export per glyph so each
 * chunk bundles only the glyphs it uses (≈ 150 bytes each; no runtime dependency, no network at build time).
 * Re-run only to add a glyph:
 *   node scripts/fetch-fluent-icons.mjs
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.1.341';
const BASE = `https://cdn.jsdelivr.net/npm/@fluentui/svg-icons@${VERSION}/icons/`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'components/os/windows/fluent.generated.ts');

/** Logical name → candidate files (first that exists wins). */
const ICONS = {
  search: ['search_20_regular'],
  taskView: ['layer_diagonal_20_regular', 'square_multiple_20_regular'],
  minimize: ['subtract_16_regular'],
  maximize: ['square_16_regular', 'maximize_16_regular'],
  restore: ['square_multiple_16_regular'],
  close: ['dismiss_16_regular'],
  dismiss: ['dismiss_20_regular'],
  chevronRight: ['chevron_right_12_regular'],
  chevronLeft: ['chevron_left_12_regular'],
  chevronDown: ['chevron_down_12_regular'],
  chevronUp: ['chevron_up_16_regular'],
  arrowLeft: ['arrow_left_20_regular'],
  arrowRight: ['arrow_right_20_regular'],
  arrowUp: ['arrow_up_20_regular'],
  refresh: ['arrow_clockwise_20_regular'],
  home: ['home_20_regular'],
  homeFilled: ['home_20_filled'],
  folder: ['folder_20_regular'],
  document: ['document_20_regular'],
  documentText: ['document_text_20_regular'],
  documentPdf: ['document_pdf_20_regular'],
  link: ['link_20_regular'],
  share: ['share_20_regular'],
  sort: ['arrow_sort_20_regular'],
  sortUp: ['arrow_sort_up_20_regular'],
  sortDown: ['arrow_sort_down_20_regular'],
  view: ['grid_20_regular'],
  list: ['text_bullet_list_ltr_20_regular', 'list_20_regular'],
  more: ['more_horizontal_20_regular'],
  panelRight: ['panel_right_20_regular'],
  panelLeft: ['panel_left_20_regular'],
  panelBottom: ['panel_bottom_20_regular'],
  add: ['add_20_regular'],
  cut: ['cut_20_regular'],
  copy: ['copy_20_regular'],
  paste: ['clipboard_paste_20_regular'],
  desktop: ['desktop_20_regular'],
  laptop: ['laptop_20_regular'],
  paint: ['paint_brush_20_regular'],
  accessibility: ['accessibility_20_regular'],
  shield: ['shield_20_regular'],
  lock: ['lock_closed_20_regular'],
  apps: ['apps_20_regular'],
  appsList: ['apps_list_20_regular'],
  swap: ['arrow_swap_20_regular'],
  tour: ['lightbulb_20_regular'],
  info: ['info_20_regular'],
  infoFilled: ['info_20_filled'],
  speaker: ['speaker_2_20_regular'],
  speakerMute: ['speaker_mute_20_regular'],
  alert: ['alert_20_regular'],
  wifi: ['wifi_1_20_regular'],
  plug: ['plug_connected_20_regular'],
  power: ['power_20_regular'],
  moon: ['weather_moon_20_regular'],
  sun: ['weather_sunny_20_regular'],
  darkTheme: ['dark_theme_20_regular'],
  sparkle: ['sparkle_20_regular'],
  drop: ['drop_20_regular'],
  settings: ['settings_20_regular'],
  mail: ['mail_20_regular'],
  mailFilled: ['mail_20_filled'],
  compose: ['compose_20_regular'],
  calendar: ['calendar_ltr_20_regular'],
  people: ['people_20_regular'],
  reply: ['arrow_reply_20_regular'],
  attach: ['attach_20_regular'],
  send: ['send_20_regular'],
  delete: ['delete_20_regular'],
  drafts: ['drafts_20_regular'],
  sent: ['send_20_regular'],
  inbox: ['mail_inbox_20_regular'],
  navigation: ['navigation_20_regular'],
  star: ['star_20_regular'],
  starFilled: ['star_20_filled'],
  branch: ['branch_20_regular'],
  fork: ['branch_fork_20_regular'],
  library: ['library_20_regular'],
  open: ['open_20_regular'],
  window: ['window_20_regular'],
  windowNew: ['window_new_20_regular'],
  download: ['arrow_download_20_regular'],
  zoomIn: ['zoom_in_20_regular'],
  zoomOut: ['zoom_out_20_regular'],
  pageFit: ['page_fit_20_regular'],
  save: ['save_20_regular'],
  print: ['print_20_regular'],
  rotate: ['arrow_rotate_clockwise_20_regular'],
  starAdd: ['star_add_20_regular'],
  puzzle: ['puzzle_piece_20_regular'],
  checkmark: ['checkmark_20_regular'],
  checkmarkCircle: ['checkmark_circle_20_filled'],
  warning: ['warning_20_filled'],
  error: ['error_circle_20_filled'],
  filter: ['filter_20_regular'],
  code: ['code_20_regular'],
  console: ['window_console_20_regular'],
  eye: ['eye_20_regular'],
  pin: ['pin_20_regular'],
  location: ['location_20_regular'],
  clock: ['clock_20_regular'],
  keyboard: ['keyboard_20_regular'],
  textSize: ['text_font_size_20_regular'],
  image: ['image_20_regular'],
  globe: ['globe_20_regular'],
  history: ['history_20_regular'],
  person: ['person_20_regular'],
  briefcase: ['briefcase_20_regular'],
  hatGraduation: ['hat_graduation_20_regular'],
  bookOpen: ['book_open_20_regular'],
  sidebar: ['panel_left_expand_20_regular', 'panel_left_20_regular'],
  split: ['split_vertical_20_regular'],
  save16: ['save_16_regular'],
  flag: ['flag_20_regular'],
  sendFilled: ['send_20_filled'],
  arrowReset: ['arrow_reset_20_regular'],
  flash: ['flash_20_regular'],
  contrast: ['circle_half_fill_20_regular'],
  sourceControl: ['branch_compare_20_regular', 'branch_20_regular'],
  files: ['document_copy_20_regular'],
  emoji: ['emoji_20_regular'],
  signOut: ['sign_out_20_regular'],
};

async function fetchSvg(name) {
  const response = await fetch(`${BASE}${name}.svg`);
  if (!response.ok) return null;
  return response.text();
}

const entries = [];
for (const [key, candidates] of Object.entries(ICONS)) {
  let found = null;
  for (const name of candidates) {
    const svg = await fetchSvg(name);
    if (svg) {
      found = { name, svg };
      break;
    }
  }
  if (!found) throw new Error(`No Fluent icon found for ${key}: ${candidates.join(', ')}`);
  const box = Number(/viewBox="0 0 (\d+) \d+"/.exec(found.svg)?.[1] ?? 20);
  const paths = [...found.svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => match[1]);
  if (!paths.length) throw new Error(`${found.name} has no path data`);
  entries.push({ key, name: found.name, box, paths });
}

const exportName = (key) => `fl${key[0].toUpperCase()}${key.slice(1)}`;
const body = entries
  .map(
    ({ key, name, box, paths }) =>
      `/** ${name} */\nexport const ${exportName(key)}: Glyph = { box: ${box}, d: ${JSON.stringify(paths.join(' '))} };`,
  )
  .join('\n');

await writeFile(
  out,
  `/**
 * Generated by scripts/fetch-fluent-icons.mjs — do not edit.
 * Fluent UI System Icons ${VERSION} (@fluentui/svg-icons), © Microsoft Corporation, MIT License
 * (https://github.com/microsoft/fluentui-system-icons/blob/main/LICENSE).
 */
export interface Glyph {
  readonly box: number;
  readonly d: string;
}

${body}
`,
);
console.log(`[fluent] wrote ${entries.length} glyphs to ${out}`);
