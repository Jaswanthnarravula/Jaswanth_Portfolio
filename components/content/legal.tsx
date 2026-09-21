import { Heading, type ViewProps } from './slots';

export interface LegalCredit {
  readonly label: string;
  readonly owner: string;
  readonly sourceUrl: string;
  readonly retrieved: string;
  readonly terms: string;
  readonly derived: boolean;
}

export interface LegalData {
  readonly credits: readonly LegalCredit[];
  readonly contactEmail: string;
  readonly glyphCredit: string;
  readonly assetMode: 'official' | 'original';
}

/** `LegalNotice` — every OS's Settings → About/Legal, `/plain`, Linux `legal` (shared/11 `ASSET-LEGAL-01`). */
export function LegalNotice({ data, headingLevel = 2 }: ViewProps<LegalData>) {
  const owners = [...new Set(data.credits.map((credit) => credit.owner))];
  return (
    <section className="cv cv-legal" aria-labelledby="cv-legal-title">
      <Heading level={headingLevel} id="cv-legal-title" className="cv-title">
        Legal &amp; credits
      </Heading>
      <p>
        This is a personal, non-commercial portfolio. It recreates the look of several operating systems to present one
        person&rsquo;s work, and it is not affiliated with, endorsed by or sponsored by any of their makers.
      </p>
      {data.assetMode === 'official' && owners.length > 0 && (
        <p>
          App icons, logos and other marks are trademarks and artwork of their respective owners ({owners.join(', ')})
          and are used only to identify the apps they represent.
        </p>
      )}
      <p>
        Original icon glyphs: {data.glyphCredit}. Wallpapers, device frames and the name wordmark are original artwork
        (the wordmark is set in Bebas Neue, SIL Open Font License). Fonts are the visitor&rsquo;s own system fonts, with
        Inter (SIL Open Font License) as a fallback. The handwritten greetings are traced from Kalam (Indian Type
        Foundry) and Klee One (Fontworks), both under the SIL Open Font License.
      </p>
      <p>
        Rights holders: to request a change or removal, email{' '}
        <a href={`mailto:${data.contactEmail}?subject=Rights%20request`}>{data.contactEmail}</a>. Every third-party
        asset can be replaced by original artwork within minutes.
      </p>
      {data.assetMode === 'official' && data.credits.length > 0 && (
        <details className="cv-details">
          <summary>Asset credits ({data.credits.length})</summary>
          <ul className="cv-credits">
            {data.credits.map((credit) => (
              <li key={`${credit.label}-${credit.sourceUrl}`}>
                <span>{credit.label}</span> — {credit.owner}
                {credit.derived ? ' (colour variant pending the original file)' : ''} ·{' '}
                <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
                  source
                </a>{' '}
                · retrieved <time dateTime={credit.retrieved}>{credit.retrieved}</time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export interface PrivacyData {
  readonly counted: readonly string[];
}

/** Privacy statement — shared/18 `ANL-NOTICE-01` (each OS's Settings → Privacy, and `/plain`). */
export function PrivacyNotice({ data, headingLevel = 2 }: ViewProps<PrivacyData>) {
  return (
    <section className="cv cv-privacy" aria-labelledby="cv-privacy-title">
      <Heading level={headingLevel} id="cv-privacy-title" className="cv-title">
        Privacy
      </Heading>
      <p>
        This site uses cookieless, privacy-friendly analytics: no cookies, no identifiers, no personal data, and never
        anything you type. It counts only:
      </p>
      <ul className="cv-bullets">
        {data.counted.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        If your browser sends Do Not Track or Global Privacy Control, or has Data Saver on, nothing is counted at all.
      </p>
    </section>
  );
}
