/**
 * Portfolio schema — shared/02-portfolio-data.md.
 *
 * Facts that the owner has not published are `null` (never guessed); any entry holding a `null` fact must carry
 * `placeholder: true`, which the production guard (`scripts/check-content.mjs`) refuses to ship.
 */

/** `YYYY-MM`, or `YYYY` when only the year is published. */
export type PartialDate = `${number}-${number}` | `${number}`;

export interface Provenance {
  /** Where the facts were read from. */
  readonly sources: readonly { readonly label: string; readonly url: string }[];
  /** ISO date the facts were last reviewed. */
  readonly retrieved: string;
  /** Metrics are as reported by the owner, not measured by this site. */
  readonly metricsReported: true;
}

/** The recruiter card — shared/23 `CONTENT-GLANCE-01`. Deliberately has no work-authorization field. */
export interface Glance {
  readonly targetRoles: readonly string[];
  readonly experience: string;
  readonly coreStack: readonly string[];
  readonly strengths: readonly string[];
  readonly workModes: readonly string[];
  readonly availability: string;
}

/** What the owner is working on now — shared/23 `CONTENT-NOW-01`. */
export interface NowNote {
  readonly text: string;
  readonly updated: PartialDate;
}

export interface Person {
  readonly name: string;
  readonly givenName: string;
  readonly headline: string;
  readonly role: string;
  readonly location: string;
  readonly summary: readonly string[];
  readonly openTo: string;
  readonly glance?: Glance;
  readonly now?: NowNote;
  readonly placeholder?: true;
}

export type ContactLinkKind = 'github' | 'linkedin' | 'instagram' | 'site' | 'x';
export interface ContactLink {
  readonly kind: ContactLinkKind;
  readonly label: string;
  readonly url: string;
  readonly handle: string;
}

export interface Contact {
  readonly email: string;
  readonly links: readonly ContactLink[];
}

export interface Experience {
  readonly slug: string;
  readonly company: string;
  readonly client?: string;
  readonly role: string | null;
  readonly start: PartialDate | null;
  readonly end: PartialDate | 'present' | null;
  readonly location: string | null;
  readonly summary: string;
  /** Team, ownership and scale — shared/23 `CONTENT-SCOPE-01`. */
  readonly scope?: string;
  readonly highlights: readonly string[];
  readonly stack: readonly string[];
  readonly placeholder?: true;
}

/** Case study parts — shared/23 `CONTENT-CASE-01`. */
export interface Decision {
  readonly title: string;
  readonly detail: string;
  readonly rejected?: string;
}
export interface ResultMetric {
  readonly value: string;
  readonly label: string;
}
/** One stage of a project's architecture, in request/data order — shared/24 `READER-FX-12`. */
export interface FlowStep {
  readonly label: string;
  readonly detail: string;
}
export interface CaseStudy {
  readonly problem: readonly string[];
  readonly role: string;
  readonly decisions: readonly Decision[];
  readonly results: readonly ResultMetric[];
  /** How the system fits together; written only from facts already in the project's own text. */
  readonly flow?: readonly FlowStep[];
}

/** A deep-dive article attached to its project — shared/23 `CONTENT-DIVE-01`. */
export type ArticleBlock =
  { readonly kind: 'p'; readonly text: string } | { readonly kind: 'steps'; readonly items: readonly string[] };
export interface DeepDive {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly blocks: readonly ArticleBlock[];
}

export interface MediaRef {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly kind: 'image' | 'video';
}

export interface Project {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly context: string;
  readonly description: readonly string[];
  readonly highlights: readonly string[];
  readonly stack: readonly string[];
  readonly repo?: string;
  readonly live?: string;
  readonly year?: number;
  readonly featured: boolean;
  /** Source is proprietary: explains why no repository link exists. */
  readonly closedSource?: true;
  readonly media?: readonly MediaRef[];
  readonly caseStudy?: CaseStudy;
  readonly deepDives?: readonly DeepDive[];
  readonly placeholder?: true;
}

export interface Education {
  readonly slug: string;
  readonly school: string;
  readonly shortName: string;
  readonly degree: string;
  readonly start: PartialDate | null;
  readonly end: PartialDate | null;
  readonly notes: readonly string[];
  readonly placeholder?: true;
}

/** shared/23 `CONTENT-CRED-01`: a course is never presented as a certification. */
export interface Credential {
  readonly name: string;
  readonly issuer: string;
  readonly kind: 'course' | 'certification';
  readonly status: 'earned' | 'in-progress';
  /** Issued (earned) or target (in progress). */
  readonly date?: PartialDate;
  readonly verifyUrl?: string;
}

export interface Skill {
  readonly name: string;
  /** Only when the owner publishes a rating — never inferred (owner decision 2026-09-21). */
  readonly level?: 1 | 2 | 3 | 4 | 5;
  /** At least this many years, as the owner states them (shared/23 `CONTENT-SKILL-01`). */
  readonly years?: number;
  /** "About {years}" rather than "{years}+". */
  readonly approx?: true;
}

export interface SkillGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly Skill[];
}

export interface Resume {
  readonly file: `/resume/${string}.pdf`;
  readonly downloadName: string;
  readonly updated: string;
}

/** One page of the published résumé PDF as images (scripts/resume-pages.mjs): CSS px at 100 % + rendered widths. */
export interface ResumePage {
  readonly width: number;
  readonly height: number;
  readonly srcset: readonly (readonly [src: string, width: number])[];
}

/** A run of the published résumé's own text; `bold` where the PDF sets it in a bold face. */
export interface ResumeRun {
  readonly text: string;
  readonly bold?: true;
}

/** A reading block of the published résumé's own text — its text version (scripts/resume-pages.mjs). */
export interface ResumeBlock {
  readonly kind: 'title' | 'heading' | 'text' | 'item';
  readonly runs: readonly ResumeRun[];
  /** The right-aligned part of an entry row (its dates). */
  readonly aside?: string;
}

export interface Portfolio {
  readonly person: Person;
  readonly contact: Contact;
  readonly experience: readonly Experience[];
  readonly projects: readonly Project[];
  readonly education: readonly Education[];
  readonly credentials: readonly Credential[];
  readonly skills: readonly SkillGroup[];
  readonly resume: Resume;
  readonly provenance: Provenance;
}

export const SECTION_IDS = ['about', 'projects', 'experience', 'skills', 'education', 'resume', 'contact'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type CollectionSection = 'projects' | 'experience' | 'education';
export type SingletonSection = Exclude<SectionId, CollectionSection>;

/**
 * OS-agnostic pointer to content. Generic over slug types so the kernel can work with plain strings (validated
 * at runtime against the catalogue) while UI code uses the data-derived unions (`PortfolioRef`).
 */
export type ContentRef<P extends string = string, E extends string = string, D extends string = string> =
  | { readonly section: SingletonSection }
  | { readonly section: 'projects'; readonly slug?: P }
  | { readonly section: 'experience'; readonly slug?: E }
  | { readonly section: 'education'; readonly slug?: D };

export const isCollectionSection = (section: SectionId): section is CollectionSection =>
  section === 'projects' || section === 'experience' || section === 'education';

export const isSectionId = (value: unknown): value is SectionId =>
  typeof value === 'string' && (SECTION_IDS as readonly string[]).includes(value);

export const refSlug = (ref: ContentRef): string | undefined => ('slug' in ref ? ref.slug : undefined);
