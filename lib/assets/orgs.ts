/**
 * Employer, client, school and issuer logos for the reader page (`ROUTE-PLAIN-01` deviation, owner 2026-09-25). Each
 * maps an organisation name exactly as the data spells it to the manifest id `org.{slug}` (or, for credential issuers,
 * an existing tech logo). The original is a text monogram tile — the site's own artwork, never a third-party mark.
 */
import { techAssetId } from './tech';

export interface OrgLogo {
  readonly slug: string;
  /** Every spelling the data uses for this organisation. */
  readonly names: readonly string[];
  /** The official artwork's proportions, so both modes share one box. */
  readonly box: { readonly w: number; readonly h: number };
  readonly monogram: string;
  readonly gradient: readonly [string, string];
}

export const ORG_LOGOS: readonly OrgLogo[] = [
  { slug: 'gmail', names: ['Gmail'], box: { w: 48, h: 48 }, monogram: 'EM', gradient: ['#3a3a40', '#0b0b0c'] },
  { slug: 'linkedin', names: ['LinkedIn'], box: { w: 48, h: 48 }, monogram: 'LI', gradient: ['#3b6fe0', '#0f3fb0'] },
  { slug: 'instagram', names: ['Instagram'], box: { w: 48, h: 48 }, monogram: 'IG', gradient: ['#8847aa', '#522871'] },
  {
    slug: 'xclusive',
    names: ['Xclusive Trading Inc.'],
    box: { w: 48, h: 48 },
    monogram: 'XT',
    gradient: ['#3a3a40', '#0b0b0c'],
  },
  { slug: 'ibm', names: ['IBM'], box: { w: 96, h: 36 }, monogram: 'IBM', gradient: ['#3b6fe0', '#0f3fb0'] },
  { slug: 'dbs', names: ['DBS Bank'], box: { w: 112, h: 34 }, monogram: 'DBS', gradient: ['#f0443a', '#b3141b'] },
  {
    slug: 'aicte',
    names: ['All India Council for Technical Education (AICTE)'],
    box: { w: 48, h: 48 },
    monogram: 'AICTE',
    gradient: ['#f4a52a', '#c46a06'],
  },
  {
    slug: 'uab',
    names: ['University of Alabama at Birmingham'],
    box: { w: 96, h: 40 },
    monogram: 'UAB',
    gradient: ['#2f7a55', '#1a4d34'],
  },
  { slug: 'github', names: ['GitHub'], box: { w: 48, h: 48 }, monogram: 'GH', gradient: ['#3a3a40', '#0b0b0c'] },
  {
    slug: 'jntuh',
    names: ['Jawaharlal Nehru Technological University Hyderabad'],
    box: { w: 48, h: 48 },
    monogram: 'JNTUH',
    gradient: ['#6a4bc4', '#3b2584'],
  },
];

export const orgAssetId = (slug: string) => `org.${slug}`;

/** Credential issuers reuse the tool logo of their platform. */
const ISSUER_ASSETS: Readonly<Record<string, string>> = {
  'AWS Academy': techAssetId('amazonwebservices'),
  'Amazon Web Services': techAssetId('amazonwebservices'),
};

const BY_NAME = new Map(ORG_LOGOS.flatMap((logo) => logo.names.map((name) => [name, orgAssetId(logo.slug)] as const)));

/** The manifest id for an organisation or issuer named in the data, if it has a logo. */
export const orgAssetFor = (name: string): string | undefined => BY_NAME.get(name) ?? ISSUER_ASSETS[name];
