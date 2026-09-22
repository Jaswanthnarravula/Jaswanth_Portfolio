/** iOS Files pure model: places ↔ locations, the session trail (IOS-FILES-05), labels, sorting, tags (IOS-FILES-01/02). */
import { describe, expect, it } from 'vitest';
import * as M from '@/components/os/ios/apps/files-model';
import type { Experience, Project } from '@/data/schema';

const role = (over: Partial<Experience>): Experience => ({
  slug: 'acme',
  company: 'Acme',
  role: 'Senior Engineer',
  start: '2022-01',
  end: 'present',
  location: null,
  summary: '',
  highlights: [],
  stack: ['Go'],
  ...over,
});

describe('IOS-FILES-02 places and URLs', () => {
  it('round-trips every place through a kernel location and a key', () => {
    const places: M.Place[] = [
      M.ROOT,
      M.RESUME,
      { kind: 'folder', section: 'experience' },
      { kind: 'doc', section: 'education', slug: 'uab' },
    ];
    for (const place of places) {
      expect(M.placeOf(M.locationOf(place))).toEqual(place);
      expect(M.placeFromKey(M.placeKey(place))).toEqual(place);
    }
  });

  it('names a role row "{Company} — {Role}, {period}" spoken with "to"', () => {
    expect(M.roleItem(role({})).label).toBe('Acme — Senior Engineer, Jan 2022 to Present');
    expect(M.roleItem(role({ role: null })).name).toBe('Acme');
  });

  it('sorts by name or newest first', () => {
    const items = [
      role({ slug: 'b', company: 'Beta', end: '2020-01' }),
      role({ slug: 'a', company: 'Alpha', end: '2019-01' }),
      role({}),
    ].map(M.roleItem);
    expect(M.sortItems(items, 'name').map((item) => item.name.split(' ')[0])).toEqual(['Acme', 'Alpha', 'Beta']);
    expect(M.sortItems(items, 'date')[0]!.key).toBe('experience/acme');
  });
});

describe('IOS-FILES-05 trail synthesis', () => {
  it('a deep link (no stored trail) synthesizes the owner folder; the root starts empty', () => {
    expect(M.resolveTrail(M.RESUME, null)).toEqual(['jaswanth']);
    expect(M.resolveTrail({ kind: 'doc', section: 'experience', slug: 'x' }, null)).toEqual(['jaswanth']);
    expect(M.resolveTrail(M.ROOT, null)).toEqual([]);
  });

  it('a stored trail is honoured while it leads there', () => {
    expect(M.resolveTrail(M.RESUME, [])).toEqual([]);
    expect(M.resolveTrail({ kind: 'folder', section: 'experience' }, ['iphone', 'jaswanth'])).toEqual([
      'iphone',
      'jaswanth',
    ]);
    expect(M.resolveTrail({ kind: 'doc', section: 'experience', slug: 'x' }, ['tag:Go'])).toEqual(['tag:Go']);
    // A tag cannot lead to a folder URL.
    expect(M.resolveTrail({ kind: 'folder', section: 'experience' }, ['tag:Go'])).toEqual(['jaswanth']);
    expect(M.resolveTrail(M.RESUME, ['bogus'])).toEqual(['jaswanth']);
  });
});

describe('IOS-FILES-01 tags', () => {
  it('ranks the stack tags by use, then name, and lists what carries them', () => {
    const project = { slug: 'p', name: 'P', stack: ['Go', 'Rust'] } as unknown as Project;
    const tags = M.tagsFrom([role({}), role({ slug: 'b', stack: ['Rust', 'Go'] })], [project]);
    expect(tags.map((tag) => [tag.name, tag.count])).toEqual([
      ['Go', 3],
      ['Rust', 2],
    ]);
    expect(M.tagged('Rust', [role({})], [project]).projects).toHaveLength(1);
  });
});
