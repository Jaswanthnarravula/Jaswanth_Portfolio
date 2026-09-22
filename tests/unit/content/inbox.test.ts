/**
 * The shared inbox (components/content/inbox.ts) — WIN-OUT-01 / MAC-MAIL-01 "messages derive from fixture data", and the
 * shared Send hand-off — WIN-OUT-03 / MAC-MAIL-03 "mailto URL encoded; long body truncated" (VIEW-CONTACT-01).
 */
import { describe, expect, it } from 'vitest';
import {
  CONTINUED_NOTE,
  MAILTO_BODY_LIMIT,
  buildInbox,
  formatUpdated,
  replySubject,
  resumeFileLabel,
  sendTarget,
} from '@/components/content';
import type { Portfolio } from '@/data/schema';
import { fixturePortfolio as p } from '../../fixtures/portfolio';

const file = { bytes: 13_245, pages: 2 };
const inboxOf = (portfolio: Portfolio = p, meta: typeof file | null = file) =>
  buildInbox({ person: portfolio.person, contact: portfolio.contact, resume: portfolio.resume, file: meta });

describe('WIN-OUT-01 · MAC-MAIL-01 the inbox derives from the fixture', () => {
  it('holds exactly the three messages, pinned "Let\'s talk" first, all unread, from the person to the visitor', () => {
    const inbox = inboxOf();
    expect(inbox.map((message) => message.subject)).toEqual(["Let's talk", 'Where to find me', 'My résumé']);
    expect(inbox.map((message) => message.id)).toEqual(['lets-talk', 'where-to-find-me', 'resume']);
    expect(inbox.map((message) => message.pinned)).toEqual([true, false, false]);
    expect(inbox.every((message) => message.unread)).toBe(true);
    for (const message of inbox) {
      expect(message.from).toEqual({ name: 'Ada Example', address: 'ada@example.com', initials: 'AE' });
      expect(message.to).toBe('You');
      expect(message.date).toBe(p.resume.updated);
      expect(message.dateLabel).toBe(formatUpdated(p.resume.updated));
      expect(message.body.at(-1)).toBe(p.person.givenName);
      expect(message.preview.length).toBeGreaterThan(0);
    }
  });

  it('"Let\'s talk" carries person.openTo, the email and the other channels', () => {
    const [talk] = inboxOf();
    const text = talk!.body.join('\n');
    expect(text).toContain(p.person.openTo);
    expect(text).toContain(p.contact.email);
    expect(text).toContain('GitHub');
    expect(talk!.preview).toContain(p.person.openTo);
    expect(talk!.attachment).toBeUndefined();
  });

  it('"Where to find me" hands its links to the app as buttons', () => {
    const find = inboxOf()[1]!;
    expect(find.links).toEqual(p.contact.links);
    expect(find.body.join(' ')).toContain('GitHub');
    expect(find.body.join(' ')).toContain(p.contact.email);
  });

  it('"My résumé" attaches the PDF with its download name, size and pages; no PDF → nothing to save', () => {
    const cv = inboxOf()[2]!;
    expect(cv.attachment).toEqual({
      name: p.resume.downloadName,
      href: p.resume.file,
      size: '13 KB',
      label: resumeFileLabel(file),
      pages: 2,
      downloadable: true,
    });
    expect(cv.body[0]).toContain('PDF, 13 KB, 2 pages');
    const unbuilt = inboxOf(p, null)[2]!;
    expect(unbuilt.attachment).toMatchObject({ size: null, label: 'PDF', pages: null, downloadable: false });
  });

  it('every fact is an argument: another portfolio yields other words, and no channel line when there are none', () => {
    const other: Portfolio = {
      ...p,
      person: { ...p.person, name: 'Grace Hopper', givenName: 'Grace', openTo: 'Open to compilers.' },
      contact: { email: 'grace@example.org', links: [] },
    };
    const inbox = inboxOf(other);
    const text = inbox.flatMap((message) => message.body).join('\n');
    expect(text).toContain('Open to compilers.');
    expect(text).toContain('grace@example.org');
    expect(text).not.toMatch(/Ada|ada@example\.com|GitHub/);
    expect(inbox[0]!.from.initials).toBe('GH');
    expect(inbox[1]!.links).toEqual([]);
  });

  it('replies are "Re: …" once', () => {
    expect(replySubject("Let's talk")).toBe("Re: Let's talk");
    expect(replySubject("Re: Let's talk")).toBe("Re: Let's talk");
  });
});

describe('WIN-OUT-03 · MAC-MAIL-03 Send = an encoded mailto: hand-off', () => {
  it('encodes the subject and body (CRLF line breaks); an empty body is left out', () => {
    const target = sendTarget({ email: 'ada@example.com', subject: 'Hello & welcome', body: 'Line 1\nLine 2 = ok?' });
    expect(target).toEqual({
      url: 'mailto:ada@example.com?subject=Hello%20%26%20welcome&body=Line%201%0D%0ALine%202%20%3D%20ok%3F',
      truncated: false,
      body: 'Line 1\nLine 2 = ok?',
    });
    expect(sendTarget({ email: 'ada@example.com', subject: '  ', body: '  \n' }).url).toBe('mailto:ada@example.com');
  });

  it('a body over 1800 characters is cut at a word, ends with the note, and fits the limit', () => {
    const long = Array.from({ length: 400 }, (_, index) => `word${index}`).join(' ');
    expect(long.length).toBeGreaterThan(MAILTO_BODY_LIMIT);
    const target = sendTarget({ email: 'ada@example.com', subject: 'Long', body: long });
    expect(target.truncated).toBe(true);
    expect(target.body.length).toBeLessThanOrEqual(MAILTO_BODY_LIMIT);
    expect(target.body.endsWith(`\n\n${CONTINUED_NOTE}`)).toBe(true);
    const kept = target.body.slice(0, -CONTINUED_NOTE.length - 2);
    expect(long.startsWith(kept)).toBe(true);
    expect(kept).toMatch(/word\d+$/);
    expect(decodeURIComponent(target.url.split('body=')[1]!)).toBe(target.body.replace(/\n/g, '\r\n'));
  });

  it('never splits a surrogate pair at the cut', () => {
    const emoji = '😀'.repeat(MAILTO_BODY_LIMIT);
    const target = sendTarget({ email: 'ada@example.com', subject: '', body: emoji });
    expect(target.truncated).toBe(true);
    expect(() => encodeURIComponent(target.body)).not.toThrow();
    expect(target.body.length).toBeLessThanOrEqual(MAILTO_BODY_LIMIT);
  });

  it('a body of exactly the limit is carried whole', () => {
    const exact = 'a'.repeat(MAILTO_BODY_LIMIT);
    expect(sendTarget({ email: 'ada@example.com', subject: '', body: exact })).toMatchObject({
      truncated: false,
      body: exact,
    });
  });
});
