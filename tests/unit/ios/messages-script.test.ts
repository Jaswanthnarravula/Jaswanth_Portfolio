/**
 * iOS Messages script graph (plans/ios/apps/messages.md, `IOS-MSG-02`): every branch resolves, chips drive the graph,
 * and every fact in a bubble comes from the data it was built from (a fixture with sentinel values — nothing is typed).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mailtoUrl } from '@/components/content/contact-actions';
import {
  bubbleText,
  buildScript,
  chipsAfter,
  EMPTY_THREAD,
  MAX_STEPS,
  oneLine,
  parseThread,
  RESUME_ATTACHMENT,
  TOP_LEVEL,
  transcript,
  typingMs,
  type ChipId,
  type ScriptData,
} from '@/components/os/ios/apps/messages-script';
import { getContact, getFeaturedProjects, getPerson, getResumeFileMeta } from '@/data/selectors';

const FIXTURE: ScriptData = {
  person: {
    name: 'Zed Quill',
    givenName: 'Zed',
    headline: 'Sentinel headline — zebra systems',
    summary: ['Builds sentinel widgets for quokkas. Second sentence never shown.', 'Another paragraph.'],
    openTo: 'Open to sentinel roles in Atlantis.',
  },
  contact: {
    email: 'zed@example.test',
    links: [
      { kind: 'github', label: 'GitHub', url: 'https://github.com/zed-sentinel', handle: 'zed-sentinel' },
      {
        kind: 'linkedin',
        label: 'LinkedIn',
        url: 'https://www.linkedin.com/in/zed-sentinel',
        handle: 'in/zed-sentinel',
      },
    ],
  },
  file: { bytes: 13_500, pages: 2 },
  featured: [{ name: 'Sentinel One' }, { name: 'Sentinel Two' }],
};

const ALL: readonly ChipId[] = [
  'what',
  'available',
  'resume',
  'where',
  'projects',
  'email',
  'copy-email',
  'hello',
  'start-over',
];

describe('IOS-MSG-02 messages script graph', () => {
  const script = buildScript(FIXTURE);

  it('IOS-MSG-02 every branch resolves: a chip label, an outgoing line and replies; every follow-up exists', () => {
    for (const id of ALL) {
      const branch = script.branches[id];
      expect(branch.id).toBe(id);
      expect(branch.chip.length).toBeGreaterThan(0);
      if (id !== 'start-over') {
        expect(branch.say.length).toBeGreaterThan(0);
        expect(branch.replies.length).toBeGreaterThan(0);
      }
      for (const next of branch.next) expect(ALL).toContain(next);
    }
    expect(script.greeting).toHaveLength(2);
    expect(TOP_LEVEL).toEqual(['what', 'available', 'resume', 'where']);
    expect(script.branches.what.chip).toBe('What do you do?');
    expect(script.branches.available.chip).toBe('Are you available?');
    expect(script.branches.resume.chip).toBe('Show me your résumé');
    expect(script.branches.where.chip).toBe('Where else can I find you?');
    expect(script.branches.projects.chip).toBe('See projects');
    expect(script.branches.email.chip).toBe('Email you');
    expect(script.branches['copy-email'].chip).toBe('Copy your email');
  });

  it('IOS-MSG-02 "What do you do?" → headline + one-line summary → "See projects" (opens GitHub, names featured work)', () => {
    const texts = script.branches.what.replies.map((bubble) => bubbleText({ bubble }));
    expect(texts).toEqual([FIXTURE.person.headline, 'Builds sentinel widgets for quokkas.']);
    expect(script.branches.what.next).toEqual(['projects']);
    expect(script.branches.projects.action).toEqual({ kind: 'open-app', role: 'github' });
    const reply = bubbleText({ bubble: script.branches.projects.replies[0]! });
    expect(reply).toContain('Sentinel One and Sentinel Two');
    expect(oneLine(['One. Two.'])).toBe('One.');
    expect(oneLine(['No full stop'])).toBe('No full stop');
  });

  it('IOS-MSG-02 "Are you available?" → person.openTo → "Email you" · "Copy your email"', () => {
    expect(bubbleText({ bubble: script.branches.available.replies[0]! })).toBe(FIXTURE.person.openTo);
    expect(script.branches.available.next).toEqual(['email', 'copy-email']);
  });

  it('IOS-MSG-04 "Email you" hands off through the Mail builder (mailtoUrl) to the data address', () => {
    const href = mailtoUrl({ email: FIXTURE.contact.email, subject: 'Hi Zed' });
    expect(script.branches.email.action).toEqual({ kind: 'mailto', href });
    const bubble = script.branches.email.replies.find((candidate) => candidate.kind === 'mailto');
    expect(bubble).toMatchObject({ kind: 'mailto', href, email: FIXTURE.contact.email });
    expect(script.branches['copy-email'].action).toEqual({ kind: 'copy', text: FIXTURE.contact.email });
    const address = script.branches['copy-email'].replies[0]!;
    expect(bubbleText({ bubble: address, outcome: 'copied' })).toContain(FIXTURE.contact.email);
    expect(bubbleText({ bubble: address, outcome: 'blocked' })).toContain(FIXTURE.contact.email);
  });

  it('IOS-MSG-02 "Show me your résumé" → the "Résumé.pdf" attachment with the file facts', () => {
    const attachment = script.branches.resume.replies.find((bubble) => bubble.kind === 'attachment');
    expect(attachment).toEqual({
      kind: 'attachment',
      from: 'them',
      name: RESUME_ATTACHMENT,
      label: 'PDF, 13 KB, 2 pages',
    });
    const unbuilt = buildScript({ ...FIXTURE, file: null }).branches.resume.replies.find(
      (bubble) => bubble.kind === 'attachment',
    );
    expect(unbuilt).toMatchObject({ label: 'PDF' });
  });

  it('IOS-MSG-02 "Where else can I find you?" → one link bubble per contact.links entry', () => {
    const links = script.branches.where.replies.filter((bubble) => bubble.kind === 'link');
    expect(links).toEqual(
      FIXTURE.contact.links.map((link) => ({
        kind: 'link',
        from: 'them',
        linkKind: link.kind,
        label: link.label,
        handle: link.handle,
        url: link.url,
      })),
    );
    const none = buildScript({ ...FIXTURE, contact: { ...FIXTURE.contact, links: [] } });
    expect(bubbleText({ bubble: none.branches.where.replies[0]! })).toContain(FIXTURE.contact.email);
  });

  it('IOS-MSG-02 chips drive branches: follow-ups first, then unvisited questions; all visited → top level + "Start over"', () => {
    expect(chipsAfter(script, [])).toEqual(TOP_LEVEL);
    expect(chipsAfter(script, ['available'])).toEqual(['email', 'copy-email', 'what', 'resume', 'where']);
    expect(chipsAfter(script, ['what'])).toEqual(['projects', 'available', 'resume', 'where']);
    expect(chipsAfter(script, ['what', 'available', 'resume', 'where'])).toEqual(['email']);
    expect(chipsAfter(script, ['what', 'available', 'resume', 'where', 'email'])).toEqual([...TOP_LEVEL, 'start-over']);
  });

  it('IOS-MSG-05 the transcript is derived from visited branches; a bad stored value never breaks it', () => {
    const thread = {
      at: 1000,
      s: [
        { c: 'available' as const, t: 2000 },
        { c: 'copy-email' as const, t: 3000, o: 'blocked' as const },
      ],
    };
    const lines = transcript(script, thread);
    expect(lines.map((line) => line.key)).toEqual(['g:0', 'g:1', '0:me', '0:0', '0:1', '1:me', '1:0']);
    expect(lines[2]!.bubble).toEqual({ kind: 'text', from: 'me', text: script.branches.available.say });
    expect(lines[6]!.outcome).toBe('blocked');
    expect(parseThread(JSON.parse(JSON.stringify(thread)))).toEqual(thread);
    expect(parseThread(null)).toEqual(EMPTY_THREAD);
    expect(
      parseThread({
        at: 'x',
        s: [
          { c: 'nope', t: 1 },
          { c: 'what', t: 2 },
        ],
      }),
    ).toEqual({ at: null, s: [{ c: 'what', t: 2 }] });
    const many = { at: 1, s: Array.from({ length: 90 }, (_, t) => ({ c: 'what', t })) };
    expect(parseThread(many).s).toHaveLength(MAX_STEPS);
    // The stored form stays far below the kernel's 4 000-character cap for a session value.
    expect(JSON.stringify(parseThread(many)).length).toBeLessThan(4000);
  });

  it('IOS-MSG-03 typing time is ≤ 600 ms per bubble', () => {
    for (const line of transcript(script, {
      at: 1,
      s: ALL.filter((id) => id !== 'start-over').map((c, t) => ({ c, t })),
    }))
      expect(typingMs(line)).toBeLessThanOrEqual(600);
  });

  it('IOS-MSG-02 no hard-coded facts: the real data flows through, and the module holds none of it', () => {
    const person = getPerson();
    const contact = getContact();
    const real = buildScript({ person, contact, file: getResumeFileMeta(), featured: getFeaturedProjects() });
    expect(bubbleText({ bubble: real.branches.available.replies[0]! })).toBe(person.openTo);
    expect(bubbleText({ bubble: real.branches.what.replies[0]! })).toBe(person.headline);
    const source = readFileSync('components/os/ios/apps/messages-script.ts', 'utf8');
    const facts = [
      person.name,
      person.headline,
      person.openTo,
      contact.email,
      ...contact.links.map((link) => link.url),
    ];
    for (const fact of facts) expect(source).not.toContain(fact);
    expect(source).not.toMatch(/data\/portfolio/);
  });
});
