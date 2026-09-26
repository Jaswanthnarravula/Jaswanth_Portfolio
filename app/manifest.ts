/** Web app manifest — original icons only, never third-party marks (shared/11 `ASSET-MARK-01`). */
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Jaswanth Narravula — Portfolio',
    short_name: 'Jaswanth',
    description: 'Five small operating systems that hold one career.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0e1222',
    theme_color: '#0e1222',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
