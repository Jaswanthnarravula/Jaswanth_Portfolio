/**
 * Before → after meters (shared/24 `READER-FX-13`). Reads a result value such as "4:20 → 1:45" or "420 → 290 ms" into
 * the two numbers it compares. Anything else ("No logouts", "180–195 ms") has no meter. The value itself is always
 * shown as written; the meter is decoration beside it.
 */
export interface Meter {
  readonly before: number;
  readonly after: number;
  /** after ÷ before, 0…1 for an improvement that shrinks a number. */
  readonly ratio: number;
}

function toNumber(text: string): number | null {
  const clock = /(\d+):(\d{2})/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const plain = /\d+(?:\.\d+)?/.exec(text.replaceAll(',', ''));
  return plain ? Number(plain[0]) : null;
}

export function parseMeter(value: string): Meter | null {
  const parts = value.split('→');
  if (parts.length !== 2) return null;
  const before = toNumber(parts[0] ?? '');
  const after = toNumber(parts[1] ?? '');
  if (before === null || after === null || before <= 0 || after < 0 || after > before) return null;
  return { before, after, ratio: after / before };
}
