import { describe, expect, it } from 'vitest';
import { auditPlans } from '../../scripts/check-plans.mjs';

const spec = {
  path: 'plans/shared/01-test.md',
  text: '| ID | Feature | Acceptance test |\n|---|---|---|\n| `ARCH-TREE-01` | Folder tree | `unit: manifest` |',
};
const ledger = (row: string) => ({
  path: 'plans/shared/22-acceptance.md',
  text: `| ID | Phase | Status | Evidence | Deviation |\n|---|---|---|---|---|\n${row}`,
});

describe('plan integrity', () => {
  it('matches a requirement with exactly one phase and ledger', () => {
    const result = auditPlans([spec, ledger('| `ARCH-TREE-01` | P0 | planned | | |')]);
    expect(result.errors).toEqual([]);
    expect(result.phases.P0?.planned).toBe(1);
  });
  it('rejects unearned verification and duplicate ownership', () => {
    const result = auditPlans([spec, spec, ledger('| `ARCH-TREE-01` | P0 | verified | | |')]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('duplicate definition'),
        expect.stringContaining('without evidence'),
      ]),
    );
  });
  it('rejects orphan rows, missing rows, invalid phases and unsigned blockers', () => {
    expect(auditPlans([spec]).errors[0]).toContain('no ledger row');
    const result = auditPlans([ledger('| `ARCH-TREE-01` | P9 | BLOCKED | | |')]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('invalid phase'),
        expect.stringContaining('blocking reason'),
        expect.stringContaining('no owning specification'),
      ]),
    );
  });
});
