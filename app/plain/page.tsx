/**
 * `/plain` — reader mode ("Skip the OS"). Every section on one semantic page; never redirects (shared/05
 * `ROUTE-PLAIN-01`). Résumé actions sit at the top (shared/14); legal + privacy statements close the page.
 */
import type { Metadata } from 'next';
import {
  ContentFor,
  LegalNotice,
  PrivacyNotice,
  ProjectList,
  ResumeDocument,
  ResumePages,
  formatUpdated,
  resumeFileLabel,
} from '@/components/content';
import { FallbackFooter } from '@/components/shell/SemanticFallback';
import { SECTION_TITLES } from '@/data/content-index';
import { SECTION_IDS, type ContentRef } from '@/data/schema';
import {
  getContact,
  getPerson,
  getProjects,
  getResume,
  getResumeFileMeta,
  getResumePages,
  getResumeText,
} from '@/data/selectors';
import { assetCredits, ASSET_MODE } from '@/lib/assets/manifest';
import { GLYPH_CREDIT } from '@/lib/assets/glyphs';
import { metadataForRoute, personJsonLd } from '@/lib/seo/metadata';
import { PlainAbout } from './PlainAbout';
import { PlainChapters } from './PlainChapters';
import { PlainContact } from './PlainContact';
import { PlainEducation } from './PlainEducation';
import { PlainExperience } from './PlainExperience';
import { PlainFx } from './PlainFx';
import { PlainGithub } from './PlainGithub';
import { PlainRail } from './PlainRail';
import { PlainToolbox } from './PlainToolbox';
import { Letters, Masked } from './SplitText';
import fx from './fx.module.css';
import styles from './plain.module.css';

export const metadata: Metadata = metadataForRoute({ kind: 'plain' });

const COUNTED = [
  'Page views, reported as the section viewed (not your path through the site)',
  'Which profile, operating system and apps are opened',
  'Résumé downloads and contact hand-offs (the channel, never the message)',
  'Whether help, the tour or search were used (never what you typed)',
  'Anonymous loading-speed measurements',
];

export default function PlainPage() {
  const person = getPerson();
  const resume = getResume();
  const file = getResumeFileMeta();
  const projects = getProjects();
  const featured = projects.filter((project) => project.featured);
  // Hero proof points: the lead result of each featured case study, straight from the data.
  const proof = featured.flatMap((project) => {
    const metric = project.caseStudy?.results[0];
    return metric ? [{ project, metric }] : [];
  });
  return (
    <div className={`doc ${styles.portfolio} ${fx.root}`} data-reader-fx="">
      <PlainFx />
      {/* Decorative layers (shared/24 READER-FX-07/08): per-section tone and a static grain. */}
      <div className={fx.tone} aria-hidden="true">
        <span className={fx.toneAbout} />
        <span className={fx.toneCh0} />
        <span className={fx.toneCh1} />
        <span className={fx.toneCh2} />
        <span className={fx.toneContact} />
      </div>
      <div className={fx.grain} aria-hidden="true" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd()).replace(/</g, '\\u003c') }}
      />
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={`${styles.header} ${fx.header}`}>
        <span className={fx.progress} aria-hidden="true" data-fx-reduced="" />
        <a className={styles.brand} href="/">
          <span className={styles.monogram} aria-hidden="true">
            jn.
          </span>
          <span>
            {person.name}
            <small>{person.role}</small>
          </span>
          <span className="sr-only"> — home</span>
        </a>
        <nav className={`${styles.navigation} ${fx.nav}`} aria-label="Sections" data-fx-nav="">
          <ul>
            {SECTION_IDS.map((section) => (
              <li key={section}>
                <a href={`#${section}`}>{SECTION_TITLES[section]}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <PlainRail />
      <main className={styles.main} id="main" tabIndex={-1}>
        <section className={styles.hero} id="home" aria-labelledby="portfolio-title" data-fx-hero="">
          {/* Depth layers (shared/24 READER-FX-03/05): a coordinate grid far back and a pointer light. Owner removed the node network 2026-09-26. */}
          <div className={fx.field} aria-hidden="true">
            <div className={fx.grid} />
          </div>
          <div className={fx.spot} aria-hidden="true" data-fx-spot="" />
          <div className={styles.heroTop}>
            <p className={styles.eyebrow}>Engineering portfolio / {person.location}</p>
            <a className={styles.availability} href="#contact">
              <span aria-hidden="true" />
              Open to backend roles
            </a>
          </div>
          <>
            <h1 className={`${styles.name} ${fx.name}`} id="portfolio-title" data-fx-vel="">
              <span className={`${styles.nameLine} ${fx.nearLeft}`}>
                <Letters text={person.givenName} />
              </span>
              <span className={`${styles.nameAccent} ${fx.nearRight}`}>
                <Letters
                  text={person.name.slice(person.givenName.length).trim()}
                  label={`${person.name.slice(person.givenName.length).trim()}.`}
                />
                <span className={styles.period} aria-hidden="true">
                  .
                </span>
              </span>
            </h1>
            {/* The hero object (shared/24 READER-FX-04): the portrait in CSS 3D (rings removed by the owner 2026-09-26) — scroll turns it, the pointer
                tilts it, scroll speed makes it lag and settle. */}
            <div className={`${styles.portraitBackdrop} ${fx.object}`}>
              <div className={fx.objectTurn}>
                <div className={fx.objectTilt} data-fx-object="" data-fx-vel="">
                  <div className={styles.portraitDecoration} aria-hidden="true">
                    <span className={styles.portraitOrbit} />
                    <span className={styles.portraitOrbitInner} />
                  </div>
                  <div className={fx.face}>
                    <div className={styles.portraitImage}>
                      <span className={fx.placeholder} aria-hidden="true">
                        jn.
                      </span>
                      {/* Pre-sized local assets keep the decorative portrait independent of LinkedIn and JavaScript. */}
                      {/* eslint-disable-next-line @next/next/no-img-element -- responsive, pre-optimized static WebP assets */}
                      <img
                        src="/assets/portrait/jaswanth-800.webp"
                        srcSet="/assets/portrait/jaswanth-480.webp 480w, /assets/portrait/jaswanth-800.webp 800w"
                        sizes="(max-width: 700px) 240px, (max-width: 1000px) 38vw, 460px"
                        width={800}
                        height={800}
                        alt={`${person.name} — profile portrait`}
                        fetchPriority="high"
                        decoding="async"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
          <div className={styles.heroBottom}>
            <div>
              <p className={styles.headline}>{person.headline}</p>
              <div className={styles.actions}>
                <a className={`${styles.primary} ${fx.magnet}`} href="#projects" data-fx-magnet="">
                  Explore my work <span aria-hidden="true">↘</span>
                </a>
                <a className={`${styles.textLink} ${fx.magnet}`} href="#contact" data-fx-magnet="">
                  Get in touch <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
            {proof.length > 0 && (
              <aside className={styles.focus} aria-label="Results in production">
                <span className={styles.eyebrow}>Shipped to production</span>
                <ul className={styles.proof}>
                  {proof.map(({ project, metric }) => (
                    <li key={project.slug}>
                      <p>
                        <strong>{metric.value}</strong> {metric.label}
                      </p>
                      <span>{project.name}</span>
                    </li>
                  ))}
                </ul>
                <a href="#about">
                  Meet the engineer <span aria-hidden="true">↓</span>
                </a>
              </aside>
            )}
          </div>
          {file && (
            <div className={styles.resumeBar}>
              <span className={styles.eyebrow}>The résumé, at a glance</span>
              <div>
                <a className={styles.textLink} href={resume.file}>
                  Open PDF
                </a>
                <a className={styles.textLink} href={resume.file} download={resume.downloadName}>
                  Download résumé <span className="cv-muted">({resumeFileLabel(file)})</span>
                </a>
              </div>
            </div>
          )}
        </section>
        {SECTION_IDS.map((section, index) => (
          <section
            key={section}
            id={section}
            className={`${styles.section} ${fx.section} ${section === 'projects' ? styles.work : ''} ${section === 'skills' || section === 'experience' ? styles.wide : ''} ${section === 'contact' ? styles.contact : ''}`}
            aria-labelledby={`plain-${section}`}
          >
            <span className={fx.rule} aria-hidden="true" />
            <header className={`${styles.sectionHeading} ${fx.heading}`}>
              <span className={`${styles.sectionNumber} ${fx.number}`} aria-hidden="true">
                {String(index + 1).padStart(2, '0')} /
              </span>
              <h2 id={`plain-${section}`} className={section === 'projects' ? fx.extrude : undefined}>
                <Masked>{SECTION_TITLES[section]}</Masked>
              </h2>
              {section === 'projects' && (
                <p>
                  Production systems.
                  <br />
                  Considered decisions. Measured results.
                </p>
              )}
              {section === 'contact' && (
                <p>
                  Let’s build something
                  <br />
                  that holds up.
                </p>
              )}
            </header>
            <div className={styles.sectionBody}>
              {section === 'projects' ? (
                <>
                  <PlainChapters projects={featured} />
                  <p className={styles.archiveLabel}>More engineering work</p>
                  <ProjectList data={projects.filter((project) => !project.featured)} headingLevel={3} />
                  <PlainGithub />
                </>
              ) : section === 'about' ? (
                <PlainAbout />
              ) : section === 'skills' ? (
                <>
                  <PlainToolbox />
                  <p className={styles.archiveLabel}>Everything, by area</p>
                  <ContentFor target={{ section }} headingLevel={3} density="comfortable" />
                </>
              ) : section === 'contact' ? (
                <PlainContact />
              ) : section === 'education' ? (
                <PlainEducation />
              ) : section === 'experience' ? (
                <PlainExperience />
              ) : section === 'resume' ? (
                <>
                  <p className="cv-meta">
                    Updated <time dateTime={resume.updated}>{formatUpdated(resume.updated)}</time>
                    {file ? ` · ${resumeFileLabel(file)} · ${file.pages} ${file.pages === 1 ? 'page' : 'pages'}` : ''}
                  </p>
                  {file && (
                    <p className="cv-actions">
                      <a className="cv-button cv-button-primary" href={resume.file} type="application/pdf">
                        Open PDF
                      </a>
                      <a className="cv-button" href={resume.file} download={resume.downloadName}>
                        Download <span className="cv-muted">({resumeFileLabel(file)})</span>
                      </a>
                    </p>
                  )}
                  <div className="cv-resume-pages">
                    <div className="cv-text-hidden cv-paper">
                      <ResumeDocument data={getResumeText()} headingLevel={3} />
                    </div>
                    <ResumePages pages={getResumePages()} className="cv-pages" pageClassName="cv-page" />
                  </div>
                </>
              ) : (
                <ContentFor target={{ section } as ContentRef} headingLevel={3} density="comfortable" />
              )}
            </div>
          </section>
        ))}
        <section className={styles.legal} aria-label="Legal and privacy">
          <LegalNotice
            data={{
              credits: assetCredits(),
              contactEmail: getContact().email,
              glyphCredit: GLYPH_CREDIT,
              assetMode: ASSET_MODE,
            }}
            headingLevel={2}
          />

          <div>
            <PrivacyNotice data={{ counted: COUNTED }} headingLevel={2} />
          </div>
        </section>
      </main>
      <div className={styles.footer}>
        <div className={styles.footerIntro}>
          <p>
            {person.name}
            <span>One career. A few different perspectives.</span>
          </p>
          <a href="#main">Back to top ↑</a>
        </div>
        <FallbackFooter />
      </div>
    </div>
  );
}
