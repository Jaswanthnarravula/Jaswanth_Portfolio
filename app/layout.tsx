import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Shell } from '@/components/shell/Shell';
import { publicEnv } from '@/lib/config/environment';
import { SITE_TITLE } from '@/lib/kernel/route/title';
import { TIER_SCRIPT } from '@/lib/kernel/tier-script';
import { SITE_DESCRIPTION } from '@/lib/seo/metadata';
import './globals.css';

/** Inter variable (latin, ≤ 50 KB) — the universal metric-matched fallback; system stacks show the real OS faces. */
const inter = localFont({
  src: './fonts/inter-latin-var.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: SITE_TITLE, template: '%s' },
  description: SITE_DESCRIPTION,
  applicationName: 'Jaswanth Narravula — Portfolio',
  authors: [{ name: 'Jaswanth Narravula' }],
  openGraph: {
    type: 'website',
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [{ url: '/og/site', width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION, images: ['/og/site'] },
  robots: { index: !publicEnv.preview, follow: !publicEnv.preview },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0e1222' },
    { media: '(prefers-color-scheme: light)', color: '#f4f6fb' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Sets data-tier / data-motion / data-glass / data-theme before first paint (PERF-TIER-01). */}
        <script dangerouslySetInnerHTML={{ __html: TIER_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="/plain">
          Skip the OS: plain portfolio
        </a>
        <Shell>
          <div id="page-layer">{children}</div>
        </Shell>
      </body>
    </html>
  );
}
