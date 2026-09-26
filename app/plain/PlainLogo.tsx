/**
 * An organisation's logo on a white plate, sized by its own proportions so wide wordmarks and square emblems read at
 * the same optical height. Renders nothing for names without a logo; decorative (the name is always printed nearby).
 */
import { AssetIcon } from '@/components/ui/AssetIcon';
import { getAsset } from '@/lib/assets/manifest';
import { orgAssetFor } from '@/lib/assets/orgs';
import styles from './plain.module.css';

export function PlainLogo({ name, height = 30, small = false }: { name: string; height?: number; small?: boolean }) {
  const id = orgAssetFor(name);
  const entry = id ? getAsset(id) : undefined;
  if (!id || !entry) return null;
  const ratio = entry.box.w / entry.box.h;
  // One height for every logo in a row; very wide wordmarks cap at 96 px (a little shorter, never taller).
  const width = Math.round(Math.min(96, height * ratio));
  return (
    <span className={`${styles.logoPlate} ${small ? styles.logoPlateSmall : ''}`} aria-hidden="true">
      <AssetIcon id={id} size={width} />
    </span>
  );
}
