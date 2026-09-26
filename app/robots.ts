import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/config/environment';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: publicEnv.preview ? { userAgent: '*', disallow: '/' } : { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', publicEnv.siteUrl).toString(),
  };
}
