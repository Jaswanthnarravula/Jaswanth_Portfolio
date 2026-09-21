/** Card inputs per `ContentRef` (and the site / reader cards). Pure; shared by the OG routes and tests. */
import { SECTION_TITLES } from '@/data/content-index';
import { refSlug, type ContentRef } from '@/data/schema';
import { getIndexEntry, getPerson, resolveContent } from '@/data/selectors';
import type { OgCardInput } from './og';

export function cardFor(ref: ContentRef | null): OgCardInput {
  const person = getPerson();
  const base = { name: person.name, headline: person.headline };
  if (!ref)
    return {
      ...base,
      eyebrow: 'Portfolio',
      title: 'Five operating systems, one career',
      summary: person.summary[0] ?? person.headline,
    };
  const entry = getIndexEntry(ref);
  const content = resolveContent(ref);
  const tags =
    content.section === 'project'
      ? content.project.stack
      : content.section === 'role'
        ? content.role.stack
        : content.section === 'skills'
          ? content.groups.map((group) => group.label)
          : [];
  const summary =
    content.section === 'project'
      ? content.project.tagline || content.project.highlights[0] || ''
      : (entry?.summary ?? person.headline);
  return {
    ...base,
    eyebrow: refSlug(ref) ? SECTION_TITLES[ref.section] : 'Portfolio',
    title: entry?.title ?? SECTION_TITLES[ref.section],
    summary,
    tags,
  };
}

export const plainCard = (): OgCardInput => {
  const person = getPerson();
  return {
    name: person.name,
    headline: person.headline,
    eyebrow: 'Reader mode',
    title: 'The plain portfolio',
    summary: 'Every section on one accessible page — no operating system required.',
  };
};
