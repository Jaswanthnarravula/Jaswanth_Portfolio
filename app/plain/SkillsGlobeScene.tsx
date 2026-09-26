'use client';

import { Float, Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, DoubleSide, FrontSide, Group, Vector3 } from 'three';
import { AssetIcon } from '@/components/ui/AssetIcon';
import type { GlobeSkill } from './SkillsGlobe';
import styles from './plain.module.css';

interface SkillsGlobeSceneProps {
  readonly skills: readonly GlobeSkill[];
  /** Renders only while the section is on or near the screen. */
  readonly active: boolean;
  readonly onUnavailable: () => void;
}

const GLOBE_RADIUS = 2.8;
const SKILL_RADIUS = 3.3;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const EMBER = '#e65320';

function pointOnSphere(index: number, total: number): [number, number, number] {
  const y = 1 - ((index + 0.5) / total) * 2;
  const ring = Math.sqrt(1 - y * y);
  const angle = index * GOLDEN_ANGLE;
  return [Math.cos(angle) * ring * SKILL_RADIUS, y * SKILL_RADIUS, Math.sin(angle) * ring * SKILL_RADIUS];
}

/**
 * A logo that always faces the camera. Only the half turned toward the viewer shows: visibility ramps from 0 just past
 * the globe's edge to 1 near the front. It is written every third frame (staggered per mark) and the element's
 * 300 ms opacity/transform transition turns those steps into the slow fade in and out.
 */
function SkillMark({
  skill,
  position,
  phase,
}: {
  readonly skill: GlobeSkill;
  readonly position: [number, number, number];
  readonly phase: number;
}) {
  const anchor = useRef<Group>(null);
  const mark = useRef<HTMLDivElement>(null);
  const frame = useRef(phase);
  const world = useMemo(() => new Vector3(), []);
  const view = useMemo(() => new Vector3(), []);

  useFrame(({ camera }) => {
    frame.current += 1;
    if (frame.current % 3 !== 0 || !anchor.current || !mark.current) return;
    anchor.current.lookAt(camera.position);
    anchor.current.getWorldPosition(world).normalize();
    const facing = world.dot(view.copy(camera.position).normalize());
    const shown = Math.min(1, Math.max(0, (facing - 0.1) * 2));
    const style = mark.current.style;
    style.opacity = shown.toFixed(3);
    style.transform = `scale(${(0.8 + 0.4 * shown).toFixed(3)})`;
    style.pointerEvents = shown > 0.8 ? 'auto' : 'none';
  });

  return (
    <group ref={anchor} position={position}>
      <Html transform center distanceFactor={1.5} zIndexRange={[20, 0]}>
        <div className={styles.globeSkill} ref={mark}>
          <div className={styles.globeSkillBody}>
            <AssetIcon id={skill.assetId} size={152} className={styles.globeSkillIcon} priority />
            <span className={styles.globeSkillName}>{skill.name}</span>
          </div>
        </div>
      </Html>
    </group>
  );
}

function SkillsUniverse({ skills }: { readonly skills: readonly GlobeSkill[] }) {
  const spin = useRef<Group>(null);

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += Math.min(delta, 0.1) * 0.06;
  });

  return (
    <group ref={spin} rotation={[0.01, 0, 0]}>
      <mesh>
        <icosahedronGeometry args={[GLOBE_RADIUS, 2]} />
        <meshBasicMaterial color={EMBER} wireframe transparent opacity={0.16} side={FrontSide} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[GLOBE_RADIUS, 2]} />
        <meshBasicMaterial color={EMBER} wireframe transparent opacity={0.05} side={BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS - 0.05, 16, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} side={DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS + 0.1, 16, 16]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.08} blending={AdditiveBlending} side={BackSide} />
      </mesh>
      {skills.map((skill, index) => (
        <SkillMark key={skill.id} skill={skill} position={pointOnSphere(index, skills.length)} phase={index % 3} />
      ))}
    </group>
  );
}

export default function SkillsGlobeScene({ skills, active, onUnavailable }: SkillsGlobeSceneProps) {
  return (
    <div className={styles.globeScene} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 10.3], fov: 50, near: 0.1, far: 40 }}
        dpr={[1, 1.5]}
        frameloop={active ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault();
              onUnavailable();
            },
            { once: true },
          );
        }}
      >
        <fog attach="fog" args={['#000000', 10, 25]} />
        <Float speed={1} rotationIntensity={0.2} floatIntensity={0.2}>
          <SkillsUniverse skills={skills} />
        </Float>
        <OrbitControls
          autoRotate
          autoRotateSpeed={0.8}
          enableDamping
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  );
}
