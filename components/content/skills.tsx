import type { SkillGroup } from '@/data/schema';
import { Heading, withSlots, type ViewProps } from './slots';

/** `SkillsMatrix` — editor / notes apps, `skills`, `neofetch`. Ratings appear only if the owner publishes them. */
export function SkillsMatrix({
  data,
  density = 'comfortable',
  slots,
  headingLevel = 2,
}: ViewProps<readonly SkillGroup[]>) {
  const { Tag } = withSlots(slots);
  return (
    <div className="cv cv-skills" data-density={density}>
      {data.map((group) => (
        <section key={group.id} className="cv-skill-group" aria-labelledby={`cv-skill-${group.id}`}>
          <Heading level={headingLevel} id={`cv-skill-${group.id}`} className="cv-subtitle">
            {group.label}
          </Heading>
          <ul className="cv-tags" role="list">
            {group.items.map((item) => (
              <li key={item.name}>
                <Tag>
                  {item.name}
                  {item.years ? <span className="cv-muted"> · {item.years} yrs</span> : null}
                </Tag>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
