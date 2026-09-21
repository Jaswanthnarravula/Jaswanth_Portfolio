/** DATA-RESUME-01 — the generated résumé PDF: valid structure, all facts, links, escaping, width-aware wrapping. */
import { describe, expect, it } from 'vitest';
import { portfolio } from '@/data/portfolio';
import { buildResumePdf, charWidth, textWidth, wrapToWidth } from '@/lib/resume/pdf';
import { fixturePortfolio } from '../../fixtures/portfolio';

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('résumé PDF writer', () => {
  it('produces a structurally valid PDF with a correct xref table', () => {
    const { bytes, pages } = buildResumePdf(portfolio);
    const text = latin1(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pages).toBeGreaterThanOrEqual(1);
    const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((match) => Number(match[1]));
    offsets.forEach((offset, index) => expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true));
    expect(text).toContain(`/Count ${pages}`);
  });
  it('contains every section and links every channel', () => {
    const text = latin1(buildResumePdf(portfolio).bytes);
    for (const label of ['SUMMARY', 'EXPERIENCE', 'SELECTED PROJECTS', 'EDUCATION', 'SKILLS'])
      expect(text).toContain(`(${label})`);
    expect(text).toContain('/URI (mailto:jaswanthnarravula@gmail.com)');
    expect(text).toContain('/URI (https://www.linkedin.com/in/jaswanth-narravula/)');
    expect(text).toContain('/Lang (en-US)');
  });
  it('is deterministic', () => {
    expect(latin1(buildResumePdf(fixturePortfolio).bytes)).toBe(latin1(buildResumePdf(fixturePortfolio).bytes));
  });
  it('escapes PDF syntax and maps characters outside WinAnsi', () => {
    const tricky = {
      ...fixturePortfolio,
      person: { ...fixturePortfolio.person, headline: 'Parens (and) back\\slash → arrow' },
    };
    const text = latin1(buildResumePdf(tricky).bytes);
    expect(text).toContain('Parens \\(and\\) back\\\\slash -> arrow');
  });
  it('measures with the Helvetica metrics and wraps within the width', () => {
    expect(charWidth('W', 'regular')).toBe(944);
    expect(charWidth('i', 'bold')).toBe(278);
    expect(charWidth('—', 'regular')).toBe(1000);
    expect(textWidth('ab', 'regular', 10)).toBeCloseTo(11.12, 2);
    const lines = wrapToWidth('one two three four five six seven eight nine ten', 'regular', 10, 80);
    for (const line of lines) expect(textWidth(line, 'regular', 10)).toBeLessThanOrEqual(80);
    expect(lines.join(' ')).toBe('one two three four five six seven eight nine ten');
  });
});
