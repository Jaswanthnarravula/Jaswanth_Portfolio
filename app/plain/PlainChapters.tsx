/**
 * Featured work as case-study chapters (shared/24 `READER-FX-11/12/13`, a `ROUTE-PLAIN-01` deviation): a pinned visual
 * — the project's architecture (`CaseStudy.flow`) and a step rail — beside the story beats Challenge → Role →
 * Decisions → Results. Same project data as every OS; the full case study and deep dives stay on
 * `/go/projects/{slug}`.
 */
import type { CSSProperties, ReactNode } from 'react';
import { goHref } from '@/components/content';
import type { Project } from '@/data/schema';
import { parseMeter } from './meter';
import fx from './fx.module.css';

const BEATS = ['The challenge', 'My role', 'Key decisions', 'Results'] as const;
const pad = (value: number) => String(value).padStart(2, '0');

function Visual({ project, index }: { readonly project: Project; readonly index: number }) {
  const flow = project.caseStudy?.flow ?? [];
  return (
    <div className={fx.visual}>
      <div className={`${fx.visualCard} ${fx.tilt}`} data-fx-tilt="3">
        <span className={fx.light} aria-hidden="true" />
        <p className={fx.visualTop}>
          <span>Featured / {pad(index + 1)}</span>
          {project.context}
        </p>
        {flow.length > 0 && (
          <>
            <p className={fx.visualLabel} id={`flow-${project.slug}`}>
              How it fits together
            </p>
            <ol className={fx.flow} aria-labelledby={`flow-${project.slug}`}>
              {flow.map((step, stepIndex) => (
                <li key={step.label} className={fx.flowNode} style={{ '--i': stepIndex } as CSSProperties}>
                  <span className={fx.flowIndex} aria-hidden="true">
                    {pad(stepIndex + 1)}
                  </span>
                  <span className={fx.flowLabel}>{step.label}</span>
                  <span className={fx.flowDetail}>{step.detail}</span>
                  {stepIndex < flow.length - 1 && (
                    <span className={fx.flowLink} aria-hidden="true">
                      <span className={fx.pulse} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
        {project.caseStudy && (
          <ol className={fx.steps} aria-hidden="true">
            {BEATS.map((beat) => (
              <li key={beat} className={fx.step}>
                {beat.replace(/^(The|My|Key) /, '')}
              </li>
            ))}
          </ol>
        )}
        <ul className={fx.visualStack} aria-label={`${project.name} stack`}>
          {project.stack.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Beat({ index, children }: { readonly index: number; readonly children: ReactNode }) {
  return (
    <section className={fx.beat}>
      <h4>
        <span aria-hidden="true">{pad(index + 1)}</span>
        {BEATS[index]}
      </h4>
      {children}
    </section>
  );
}

export function PlainChapters({ projects }: { readonly projects: readonly Project[] }) {
  return (
    <div className={fx.chapters}>
      {projects.map((project, index) => {
        const href = goHref({ section: 'projects', slug: project.slug });
        const study = project.caseStudy;
        return (
          <article
            key={project.slug}
            className={fx.chapter}
            data-tone={index % 3}
            data-fx-live=""
            aria-labelledby={`chapter-${project.slug}`}
          >
            <header className={fx.chapterHead}>
              <h3 id={`chapter-${project.slug}`}>
                <a href={href}>
                  {project.name}
                  <span aria-hidden="true">↗</span>
                </a>
              </h3>
              <p>{project.tagline}</p>
            </header>
            <Visual project={project} index={index} />
            <div className={fx.beats}>
              {study ? (
                <>
                  <Beat index={0}>
                    {study.problem.map((paragraph, paragraphIndex) => (
                      <p key={paragraph.slice(0, 32)} className={paragraphIndex === 0 ? fx.beatLead : undefined}>
                        {paragraph}
                      </p>
                    ))}
                  </Beat>
                  <Beat index={1}>
                    <p className={fx.beatLead}>{study.role}</p>
                  </Beat>
                  <Beat index={2}>
                    <ol className={fx.decisions}>
                      {study.decisions.map((decision) => (
                        <li key={decision.title}>
                          <strong>{decision.title}</strong>
                          <span>{decision.detail}</span>
                        </li>
                      ))}
                    </ol>
                  </Beat>
                  <Beat index={3}>
                    <dl className={fx.results}>
                      {study.results.map((result) => {
                        const meter = parseMeter(result.value);
                        return (
                          <div key={result.label}>
                            <dt>{result.label}</dt>
                            <dd>
                              {result.value}
                              {meter && (
                                <span
                                  className={fx.meter}
                                  style={{ '--ratio': meter.ratio.toFixed(3) } as CSSProperties}
                                  aria-hidden="true"
                                >
                                  <span className={fx.meterRow}>
                                    <span>before</span>
                                    <span className={fx.meterTrack}>
                                      <span className={fx.meterBefore} />
                                    </span>
                                  </span>
                                  <span className={fx.meterRow}>
                                    <span>after</span>
                                    <span className={fx.meterTrack}>
                                      <span className={fx.meterAfter} />
                                    </span>
                                  </span>
                                </span>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </Beat>
                </>
              ) : (
                project.description.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className={fx.beatLead}>
                    {paragraph}
                  </p>
                ))
              )}
              <a className={`${fx.chapterLink} ${fx.magnet}`} href={href} data-fx-magnet="">
                Read the full case study <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
