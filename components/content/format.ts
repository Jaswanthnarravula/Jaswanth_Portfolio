/** Pure formatting helpers shared by the content views and their text renderers. */
import type { Credential, PartialDate, Skill } from '@/data/schema';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatPartialDate(value: PartialDate | 'present' | null): string | null {
  if (value === null) return null;
  if (value === 'present') return 'Present';
  const [year, month] = value.split('-');
  const name = month ? MONTHS[Number(month) - 1] : undefined;
  return name ? `${name} ${year}` : (year ?? null);
}

/** "Jan 2024 – Dec 2025" · "2019 – 2023" · "Present" · `null` when nothing is published. */
export function formatPeriod(start: PartialDate | null, end: PartialDate | 'present' | null): string | null {
  const from = formatPartialDate(start);
  const to = formatPartialDate(end);
  if (from && to) return `${from} – ${to}`;
  if (to === 'Present') return 'Present';
  return from ?? to;
}

/**
 * Skill years as the owner states them (shared/23 `CONTENT-SKILL-01`): "1.5+ yrs", "~1 yr"; `long` spells it out
 * for accessible names ("1.5+ years", "about 1 year"). `null` when no years are published.
 */
export function formatYears(skill: Pick<Skill, 'years' | 'approx'>, long = false): string | null {
  if (!skill.years) return null;
  const unit = long ? (skill.years > 1 ? 'years' : 'year') : skill.years > 1 ? 'yrs' : 'yr';
  if (skill.approx) return long ? `about ${skill.years} ${unit}` : `~${skill.years} ${unit}`;
  return `${skill.years}+ ${unit}`;
}

/**
 * What a credential is, never overstated (shared/23 `CONTENT-CRED-01`): "Course credential · Jan 2022",
 * "Certification · in progress · target Mar 2027".
 */
export function formatCredential(credential: Credential): string {
  const parts: string[] = [credential.kind === 'course' ? 'Course credential' : 'Certification'];
  const date = formatPartialDate(credential.date ?? null);
  if (credential.status === 'in-progress') parts.push(date ? `in progress · target ${date}` : 'in progress');
  else if (date) parts.push(date);
  return parts.join(' · ');
}

/** Machine-readable `<time dateTime>` value for a partial date. */
export const isoDate = (value: PartialDate | null): string | undefined => value ?? undefined;

export function wrap(text: string, width: number, indent = ''): string[] {
  const max = Math.max(8, width - indent.length);
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= max) line += ` ${word}`;
      else {
        lines.push(indent + line);
        line = word;
      }
      while (line.length > max) {
        lines.push(indent + line.slice(0, max));
        line = line.slice(max);
      }
    }
    lines.push(indent + line);
  }
  return lines;
}

/** Bullet with hanging indent: "• first line" / "  continuation" (the indent follows the marker: "1. " → 3). */
export function bullet(text: string, width: number, marker = '•'): string[] {
  const indent = ' '.repeat(marker.length + 1);
  const [first = '', ...rest] = wrap(text, width - indent.length);
  return [`${marker} ${first}`, ...rest.map((line) => `${indent}${line}`)];
}

export const rule = (width: number, char = '─') => char.repeat(Math.max(4, Math.min(width, 80)));

export const byteSize = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export interface ResumeFileMeta {
  readonly bytes: number;
  readonly pages: number;
}

/** "PDF, 13 KB" — the Download action states the file type and size (shared/14 accessibility). */
export const resumeFileLabel = (file: ResumeFileMeta | null) => (file ? `PDF, ${byteSize(file.bytes)}` : 'PDF');
