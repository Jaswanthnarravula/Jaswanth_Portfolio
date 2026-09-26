/**
 * Reader-mode skills universe (`ROUTE-PLAIN-01` deviation, owner 2026-09-26): every published skill that has a logo
 * is passed to a progressively enhanced 3D globe. Names and years come from the skills data; logos from the asset
 * manifest (both asset modes work). The complete semantic skills matrix follows this decorative view in page.tsx.
 */
import { formatYears } from '@/components/content';
import { getSkills } from '@/data/selectors';
import { techAssetId, techLogoFor } from '@/lib/assets/tech';
import { SkillsGlobe, type GlobeSkill } from './SkillsGlobe';
import styles from './plain.module.css';

export function PlainToolbox() {
  const tools: GlobeSkill[] = getSkills().flatMap((group) =>
    group.items.flatMap((skill) => {
      const logo = techLogoFor(skill.name);
      if (!logo) return [];
      const years = formatYears(skill, true);
      return [
        {
          id: logo.slug,
          assetId: techAssetId(logo.slug),
          name: skill.name,
          detail: years ? `${group.label} · ${years}` : group.label,
        },
      ];
    }),
  );
  if (tools.length === 0) return null;
  return (
    <section className={`${styles.toolbox} ${styles.reveal}`} aria-label="Skills universe">
      <SkillsGlobe skills={tools} />
    </section>
  );
}
