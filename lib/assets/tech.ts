/**
 * Tool logos for the reader page's Toolbox (`ROUTE-PLAIN-01` deviation, owner 2026-09-25). Each maps a published skill
 * name (data/portfolio.ts `skills`) to the manifest id `tech.{slug}`; skills without a logo simply stay text. Official
 * files come from Devicon (scripts/asset-sources.mjs); the original is a neutral glyph, never a third-party mark.
 */
import type { GlyphId } from './glyphs';

export interface TechLogo {
  readonly slug: string;
  /** Exactly as the skill is named in the data. */
  readonly skill: string;
  /** Original-mode stand-in. */
  readonly glyph: GlyphId;
}

export const TECH_LOGOS: readonly TechLogo[] = [
  { slug: 'java', skill: 'Java 17', glyph: 'code' },
  { slug: 'go', skill: 'Go', glyph: 'code' },
  { slug: 'python', skill: 'Python', glyph: 'code' },
  { slug: 'typescript', skill: 'TypeScript', glyph: 'code' },
  { slug: 'javascript', skill: 'JavaScript', glyph: 'code' },
  { slug: 'spring', skill: 'Spring Boot', glyph: 'code' },
  { slug: 'hibernate', skill: 'Hibernate', glyph: 'code' },
  { slug: 'fastapi', skill: 'FastAPI', glyph: 'code' },
  { slug: 'flask', skill: 'Flask', glyph: 'code' },
  { slug: 'sqlalchemy', skill: 'SQLAlchemy', glyph: 'code' },
  { slug: 'swagger', skill: 'OpenAPI / Swagger', glyph: 'document' },
  { slug: 'postgresql', skill: 'PostgreSQL', glyph: 'document' },
  { slug: 'mysql', skill: 'MySQL', glyph: 'document' },
  { slug: 'redis', skill: 'Redis', glyph: 'document' },
  { slug: 'elasticsearch', skill: 'Elasticsearch', glyph: 'search' },
  { slug: 'react', skill: 'React', glyph: 'window' },
  { slug: 'vitejs', skill: 'Vite', glyph: 'window' },
  { slug: 'docker', skill: 'Docker', glyph: 'terminal' },
  { slug: 'nginx', skill: 'Nginx', glyph: 'terminal' },
  { slug: 'linux', skill: 'Linux', glyph: 'terminal' },
  { slug: 'git', skill: 'Git', glyph: 'branch' },
  { slug: 'githubactions', skill: 'GitHub Actions', glyph: 'branch' },
  { slug: 'amazonwebservices', skill: 'AWS', glyph: 'globe' },
  { slug: 'azure', skill: 'Azure', glyph: 'globe' },
  { slug: 'maven', skill: 'Maven', glyph: 'settings' },
  { slug: 'junit', skill: 'JUnit 5', glyph: 'settings' },
  { slug: 'postman', skill: 'Postman', glyph: 'settings' },
];

export const techAssetId = (slug: string) => `tech.${slug}`;

const BY_SKILL = new Map(TECH_LOGOS.map((logo) => [logo.skill, logo]));
export const techLogoFor = (skill: string): TechLogo | undefined => BY_SKILL.get(skill);
