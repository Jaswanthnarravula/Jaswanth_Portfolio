/**
 * Résumé PDF writer — shared/02 résumé ingestion, `DATA-RESUME-01`, IMPLEMENTATION.md issue 6.
 * The owner supplied LinkedIn rather than a résumé file, so the PDF is generated from the typed portfolio data at build
 * time (scripts/build-resume.mjs). Dependency-free and deterministic: PDF 1.4, the standard Helvetica faces (no font
 * embedding), US Letter, link annotations for every channel. Only `import type` here, so Node can run it by stripping
 * types.
 */
import type { Experience, PartialDate, Portfolio } from '../../data/schema';

// Standard Adobe AFM advance widths (1/1000 em), WinAnsi codes 32–126.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
  556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
  280, 389, 584,
];
/** WinAnsi upper-half characters the data uses: code → [regular, bold] widths. */
const EXTENDED: Readonly<Record<string, readonly [code: number, regular: number, bold: number]>> = {
  '–': [0x96, 556, 556],
  '—': [0x97, 1000, 1000],
  '•': [0x95, 350, 350],
  '·': [0xb7, 278, 278],
  é: [0xe9, 556, 556],
  '’': [0x92, 222, 278],
  '‘': [0x91, 222, 278],
  '“': [0x93, 333, 500],
  '”': [0x94, 333, 500],
  '…': [0x85, 1000, 1000],
  '×': [0xd7, 584, 584],
};
/** Characters outside WinAnsi, spelled out. */
const FALLBACK: Readonly<Record<string, string>> = {
  '→': '->',
  '★': '*',
  '≤': '<=',
  '≥': '>=',
  [String.fromCharCode(0xa0)]: ' ',
};

type Face = 'regular' | 'bold';

const normalizeText = (text: string) => [...text].map((char) => FALLBACK[char] ?? char).join('');

export function charWidth(char: string, face: Face): number {
  const code = char.charCodeAt(0);
  const table = face === 'bold' ? HELVETICA_BOLD : HELVETICA;
  if (code >= 32 && code <= 126) return table[code - 32]!;
  const extended = EXTENDED[char];
  if (extended) return face === 'bold' ? extended[2] : extended[1];
  return 556;
}

export function textWidth(text: string, face: Face, size: number): number {
  let total = 0;
  for (const char of normalizeText(text)) total += charWidth(char, face);
  return (total * size) / 1000;
}

function encodePdfString(text: string): string {
  let out = '';
  for (const char of normalizeText(text)) {
    const code = char.charCodeAt(0);
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (code >= 32 && code <= 126) out += char;
    else {
      const extended = EXTENDED[char];
      out += `\\${(extended ? extended[0] : 63).toString(8).padStart(3, '0')}`;
    }
  }
  return out;
}

export function wrapToWidth(text: string, face: Face, size: number, width: number): string[] {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, face, size) <= width || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// --- Layout ------------------------------------------------------------------------------------------------------

const PAGE = { w: 612, h: 792 } as const;
const MARGIN = { x: 54, top: 54, bottom: 54 } as const;
const CONTENT_W = PAGE.w - MARGIN.x * 2;
const INK = '0.11 0.12 0.14';
const MUTED = '0.36 0.38 0.42';
const ACCENT = '0.12 0.33 0.72';

interface Link {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly uri: string;
}

class Layout {
  pages: { ops: string[]; links: Link[] }[] = [];
  y = 0;

  constructor() {
    this.newPage();
  }

  private get page() {
    return this.pages[this.pages.length - 1]!;
  }

  newPage() {
    this.pages.push({ ops: [], links: [] });
    this.y = PAGE.h - MARGIN.top;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN.bottom) this.newPage();
  }

  text(
    x: number,
    text: string,
    { face = 'regular', size = 10, color = INK }: { face?: Face; size?: number; color?: string } = {},
  ) {
    const font = face === 'bold' ? '/F2' : '/F1';
    this.page.ops.push(
      `BT ${color} rg ${font} ${size} Tf ${x.toFixed(2)} ${this.y.toFixed(2)} Td (${encodePdfString(text)}) Tj ET`,
    );
  }

  link(x: number, width: number, size: number, uri: string) {
    this.page.links.push({ x, y: this.y - size * 0.25, w: width, h: size * 1.15, uri });
  }

  rule(weight = 0.6, color = '0.82 0.84 0.87') {
    this.page.ops.push(
      `${color} RG ${weight} w ${MARGIN.x} ${this.y.toFixed(2)} m ${PAGE.w - MARGIN.x} ${this.y.toFixed(2)} l S`,
    );
  }

  gap(points: number) {
    this.y -= points;
  }

  /** A wrapped paragraph; returns the height used. */
  paragraph(
    text: string,
    {
      x = MARGIN.x,
      width = CONTENT_W,
      face = 'regular',
      size = 10,
      leading = 1.38,
      color = INK,
    }: { x?: number; width?: number; face?: Face; size?: number; leading?: number; color?: string } = {},
  ) {
    for (const line of wrapToWidth(text, face, size, width)) {
      this.ensure(size * leading);
      this.y -= size * leading;
      this.text(x, line, { face, size, color });
    }
  }

  bullet(text: string, size = 9.6) {
    const indent = 12;
    const lines = wrapToWidth(text, 'regular', size, CONTENT_W - indent);
    this.ensure(size * 1.38 * Math.min(lines.length, 2));
    lines.forEach((line, index) => {
      this.ensure(size * 1.38);
      this.y -= size * 1.38;
      if (index === 0) this.text(MARGIN.x + 2, '•', { size, color: MUTED });
      this.text(MARGIN.x + indent, line, { size });
    });
  }

  /** Bold left text with a muted right-aligned note on the same baseline. */
  row(left: string, right: string | null, { size = 10.5 }: { size?: number } = {}) {
    this.ensure(size * 1.5 + 12);
    this.y -= size * 1.45;
    const rightWidth = right ? textWidth(right, 'regular', size - 1) : 0;
    const leftLines = wrapToWidth(left, 'bold', size, CONTENT_W - rightWidth - 12);
    this.text(MARGIN.x, leftLines[0] ?? '', { face: 'bold', size });
    if (right) this.text(PAGE.w - MARGIN.x - rightWidth, right, { size: size - 1, color: MUTED });
    for (const line of leftLines.slice(1)) {
      this.y -= size * 1.3;
      this.text(MARGIN.x, line, { face: 'bold', size });
    }
  }

  /** "Label: items" with a bold label; continuation lines align under the text. */
  labeled(label: string, text: string, size = 9.4) {
    const labelText = `${label}: `;
    const labelWidth = textWidth(labelText, 'bold', size);
    const words = normalizeText(text).split(/\s+/).filter(Boolean);
    let line = '';
    let first = true;
    const flush = () => {
      this.ensure(size * 1.38);
      this.y -= size * 1.38;
      if (first) this.text(MARGIN.x, labelText, { face: 'bold', size });
      this.text(MARGIN.x + (first ? labelWidth : 0), line, { size });
      first = false;
      line = '';
    };
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const available = CONTENT_W - (first ? labelWidth : 0);
      if (textWidth(candidate, 'regular', size) <= available || !line) line = candidate;
      else {
        flush();
        line = word;
      }
    }
    if (line || first) flush();
  }

  heading(label: string) {
    this.ensure(40);
    this.gap(19);
    this.text(MARGIN.x, label.toUpperCase(), { face: 'bold', size: 8.6, color: ACCENT });
    this.gap(5);
    this.rule(0.5);
    this.gap(2);
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function date(value: PartialDate | 'present' | null): string | null {
  if (value === null) return null;
  if (value === 'present') return 'Present';
  const [year, month] = value.split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : (year ?? null);
}
function period(start: PartialDate | null, end: PartialDate | 'present' | null): string | null {
  const from = date(start);
  const to = date(end);
  if (from && to) return `${from} – ${to}`;
  return to === 'Present' ? 'Present' : (from ?? to);
}
const roleLine = (role: Experience) =>
  [role.role, role.company].filter(Boolean).join(' — ') + (role.client ? ` (client: ${role.client})` : '');

export interface ResumePdf {
  readonly bytes: Uint8Array;
  readonly pages: number;
}

export function buildResumePdf(data: Portfolio): ResumePdf {
  const layout = new Layout();
  const { person, contact } = data;

  layout.y -= 22;
  layout.text(MARGIN.x, person.name, { face: 'bold', size: 22 });
  layout.gap(17);
  layout.text(MARGIN.x, person.headline, { size: 11, color: MUTED });
  layout.gap(15);

  // Contact line with link annotations.
  const channels: { label: string; uri?: string }[] = [
    { label: contact.email, uri: `mailto:${contact.email}` },
    ...contact.links.map((link) => ({
      label: link.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      uri: link.url,
    })),
    { label: person.location },
  ];
  const size = 9.4;
  const separator = textWidth('·', 'regular', size) + 12;
  let x = MARGIN.x;
  channels.forEach((channel, index) => {
    const width = textWidth(channel.label, 'regular', size);
    if (index > 0 && x + separator + width > MARGIN.x + CONTENT_W) {
      layout.gap(size * 1.45);
      x = MARGIN.x;
    } else if (index > 0) {
      layout.text(x + 6, '·', { size, color: MUTED });
      x += separator;
    }
    layout.text(x, channel.label, { size, color: channel.uri ? ACCENT : MUTED });
    if (channel.uri) layout.link(x, width, size, channel.uri);
    x += width;
  });
  layout.gap(10);
  layout.rule(0.8, '0.2 0.22 0.26');

  layout.heading('Summary');
  person.summary.slice(0, 2).forEach((paragraph, index) => {
    if (index > 0) layout.gap(4);
    layout.paragraph(paragraph, { size: 10 });
  });

  layout.heading('Experience');
  for (const role of data.experience) {
    layout.row(roleLine(role), period(role.start, role.end));
    if (role.location) layout.paragraph(role.location, { size: 9, color: MUTED });
    layout.gap(2);
    for (const highlight of role.highlights) layout.bullet(highlight);
    layout.paragraph(`Stack: ${role.stack.join(', ')}`, { size: 8.8, color: MUTED });
    layout.gap(6);
  }

  layout.heading('Selected projects');
  const projects = [...data.projects].sort((a, b) => Number(b.featured) - Number(a.featured));
  for (const project of projects) {
    layout.row(`${project.name} — ${project.context}`, project.year ? String(project.year) : null, { size: 10 });
    layout.paragraph(project.tagline, { size: 9.6 });
    layout.paragraph(project.highlights.join(' · '), { size: 9, color: MUTED });
    layout.gap(4);
  }

  layout.heading('Education');
  for (const school of data.education) {
    layout.row(`${school.degree} — ${school.school}`, period(school.start, school.end), { size: 10 });
    if (school.notes.length) layout.paragraph(school.notes.join(' · '), { size: 9, color: MUTED });
    layout.gap(3);
  }
  if (data.credentials.length) {
    layout.gap(4);
    layout.labeled('Credentials', data.credentials.map((c) => `${c.name} (${c.issuer})`).join(', '));
  }

  layout.heading('Skills');
  for (const group of data.skills) {
    layout.labeled(group.label, group.items.map((item) => item.name).join(', '));
    layout.gap(1.5);
  }

  return { bytes: serialize(layout, data), pages: layout.pages.length };
}

// --- Serialization -----------------------------------------------------------------------------------------------

function serialize(layout: Layout, data: Portfolio): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add('');
  const pagesRef = add('');
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageRefs: number[] = [];
  for (const page of layout.pages) {
    const stream = page.ops.join('\n');
    const content = add(`<< /Length ${latin1Length(stream)} >>\nstream\n${stream}\nendstream`);
    const annots = page.links.map((link) =>
      add(
        `<< /Type /Annot /Subtype /Link /Border [0 0 0] /Rect [${link.x.toFixed(2)} ${link.y.toFixed(2)} ${(link.x + link.w).toFixed(2)} ${(link.y + link.h).toFixed(2)}] /A << /S /URI /URI (${encodePdfString(link.uri)}) >> >>`,
      ),
    );
    pageRefs.push(
      add(
        `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R${annots.length ? ` /Annots [${annots.map((ref) => `${ref} 0 R`).join(' ')}]` : ''} >>`,
      ),
    );
  }
  objects[pagesRef - 1] =
    `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;
  const info = add(
    `<< /Title ${textString(`${data.person.name} — Résumé`)} /Author ${textString(data.person.name)} /Subject ${textString(data.person.headline)} /Creator ${textString('Portfolio OS résumé builder')} >>`,
  );
  objects[catalog - 1] =
    `<< /Type /Catalog /Pages ${pagesRef} 0 R /Lang (en-US) /ViewerPreferences << /DisplayDocTitle true >> >>`;

  let body = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(latin1Length(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = latin1Length(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1Bytes(body);
}

/** Document-information strings as UTF-16BE hex (full Unicode, independent of font encodings). */
function textString(text: string): string {
  let hex = 'FEFF';
  for (let index = 0; index < text.length; index++)
    hex += text.charCodeAt(index).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

const latin1Length = (text: string) => text.length;

function latin1Bytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index) & 0xff;
  return bytes;
}
