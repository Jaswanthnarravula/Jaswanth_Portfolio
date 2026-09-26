import { FallbackFooter } from '@/components/shell/SemanticFallback';
import { getPerson } from '@/data/selectors';

export default function NotFound() {
  const person = getPerson();
  return (
    <div className="doc">
      <header className="doc-top">
        <a className="doc-brand" href="/">
          {person.name}
          <span>{person.role}</span>
        </a>
      </header>
      <main className="doc-main" id="main">
        <p className="doc-eyebrow">404</p>
        <h1 className="doc-title">This page isn&rsquo;t here.</h1>
        <p className="doc-lede">The address may be old or mistyped. Everything in the portfolio is one step away:</p>
        <p className="cv-actions">
          <a className="cv-button cv-button-primary" href="/">
            Start at the beginning
          </a>
          <a className="cv-button" href="/plain">
            Read the plain portfolio
          </a>
        </p>
      </main>
      <FallbackFooter />
    </div>
  );
}
