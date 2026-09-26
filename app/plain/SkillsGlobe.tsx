'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { afterFirstPaint } from '@/lib/motion/idle';
import styles from './plain.module.css';

export interface GlobeSkill {
  readonly id: string;
  readonly assetId: string;
  readonly name: string;
  readonly detail: string;
}

interface SkillsGlobeProps {
  readonly skills: readonly GlobeSkill[];
}

const loadScene = () => import('./SkillsGlobeScene');
const SkillsGlobeScene = dynamic(loadScene, {
  ssr: false,
  loading: () => null,
});

function canUseInteractiveGlobe(): boolean {
  if (document.documentElement.dataset.tier === '0') return false;
  if (window.innerWidth <= 700) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return false;

  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
  if (!context) return false;
  context.getExtension('WEBGL_lose_context')?.loseContext();
  return true;
}

function StaticGlobe({ skills }: SkillsGlobeProps) {
  return (
    <div className={styles.globeFallback} aria-hidden="true">
      <div className={styles.globeFallbackGlow} />
      <svg className={styles.globeFallbackMesh} viewBox="0 0 600 600" focusable="false">
        <defs>
          <clipPath id="skills-globe-clip">
            <circle cx="300" cy="300" r="228" />
          </clipPath>
        </defs>
        <circle cx="300" cy="300" r="228" />
        <g clipPath="url(#skills-globe-clip)">
          <path d="M72 300 161 104 300 72 439 104 528 300 439 496 300 528 161 496Z" />
          <path d="m161 104 61 113 78-145 78 145 61-113M72 300l150-83h156l150 83M72 300l150 83h156l150-83M161 496l61-113 78 145 78-145 61 113" />
          <path d="m161 104 61 279 217-279M72 300l306-83 61 279M161 496l61-279 217 279M72 300l306 83 61-279" />
          <path d="M222 217 161 496M378 217 161 104M222 383 439 104M378 383 439 496" />
          <ellipse cx="300" cy="300" rx="228" ry="88" />
          <ellipse cx="300" cy="300" rx="92" ry="228" />
        </g>
      </svg>
      <div className={styles.globeFallbackSkills}>
        {skills.slice(0, 16).map((skill) => (
          <div className={styles.globeFallbackSkill} key={skill.id}>
            <AssetIcon id={skill.assetId} size={46} className={styles.globeFallbackIcon} />
            <span>{skill.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkillsGlobe({ skills }: SkillsGlobeProps) {
  const root = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(false);
  const [active, setActive] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // No wait on arrival: in idle time after first paint the scene chunk loads and the canvas mounts paused, so
  // scrolling in only starts its frame loop; it renders only while the section is on or near the screen.
  useEffect(() => {
    const element = root.current;
    if (!element || !canUseInteractiveGlobe()) return;
    const abort = new AbortController();
    afterFirstPaint(
      () =>
        void loadScene().then(() => {
          if (!abort.signal.aborted) setInteractive(true);
        }),
      { signal: abort.signal },
    );
    const visible = new IntersectionObserver((entries) => setActive(entries.some((entry) => entry.isIntersecting)), {
      rootMargin: '600px 0px',
    });
    visible.observe(element);
    return () => {
      abort.abort();
      visible.disconnect();
    };
  }, []);

  return (
    <div className={styles.globe} ref={root}>
      {interactive && !unavailable ? (
        <SkillsGlobeScene skills={skills} active={active} onUnavailable={() => setUnavailable(true)} />
      ) : (
        <StaticGlobe skills={skills} />
      )}
    </div>
  );
}
