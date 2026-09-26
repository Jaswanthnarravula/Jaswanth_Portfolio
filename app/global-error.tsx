'use client';
/** Last-resort error boundary: always offers the plain portfolio (content is in the main bundle). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'grid',
          placeItems: 'center',
          background: '#0e1222',
          color: '#f3f5ff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: 520, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Something went wrong.</h1>
          <p style={{ color: '#c7cbe0', margin: '0 0 24px' }}>
            The portfolio itself is fine — you can retry, or read it plainly.
          </p>
          <p style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: 0 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 44,
                padding: '10px 18px',
                borderRadius: 999,
                border: 0,
                background: '#4a6cf7',
                color: '#fff',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/plain"
              style={{
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: 999,
                border: '1px solid #4a5170',
                color: 'inherit',
              }}
            >
              Plain portfolio
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
