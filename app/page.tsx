/**
 * `/` — the welcome layer (plans/02 Hello, plans/03 intro + profiles). Server-rendered and complete without
 * JavaScript; the OS chooser that follows lives in the persistent shell layer (plans/04), so Back from any OS lands
 * on it without re-rendering this page.
 */
import { Welcome } from '@/components/welcome/Welcome';
import { personJsonLd } from '@/lib/seo/metadata';

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd()).replace(/</g, '\\u003c') }}
      />
      <Welcome />
    </>
  );
}
