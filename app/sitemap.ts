/** Sitemap from the content index: only `/`, `/plain` and `/go/*` (shared/19 `OG-MAP-01`, shared/13 `DEPLOY-SEO-01`). */
import type { MetadataRoute } from 'next';
import { contentIndex } from '@/data/content-index';
import { publicEnv } from '@/lib/config/environment';
import { goPath } from '@/lib/seo/metadata';

export const dynamic = 'force-static';

export function sitemapEntries(siteUrl: string, lastModified: Date): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, siteUrl).toString();
  return [
    { url: url('/'), lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: url('/plain'), lastModified, changeFrequency: 'monthly', priority: 0.8 },
    ...contentIndex.entries.map((entry) => ({
      url: url(goPath(entry.ref)),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: entry.parent ? 0.6 : 0.7,
    })),
  ];
}

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(publicEnv.siteUrl, new Date());
}
