import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from '@/lib/kernel/history/adapters';
import { createHistoryController } from '@/lib/kernel/history/controller';
import { readOsk } from '@/lib/kernel/history/port';
import { routePath } from '@/lib/kernel/types';

function manualClock() {
  let now = 0;
  const timers: { at: number; run: () => void; cancelled: boolean }[] = [];
  return {
    now: () => now,
    schedule: (run: () => void, ms: number) => {
      const timer = { at: now + ms, run, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    advance(ms: number) {
      now += ms;
      for (const timer of timers.splice(0)) {
        if (timer.cancelled) continue;
        if (timer.at <= now) timer.run();
        else timers.push(timer);
      }
    },
  };
}

function setup(initial = '/macos') {
  const port = createMemoryHistory(initial);
  const clock = manualClock();
  const pops: string[] = [];
  const controller = createHistoryController({
    port,
    onPop: (url) => pops.push(url),
    now: clock.now,
    schedule: clock.schedule,
  });
  controller.canonicalize(routePath(initial));
  return { port, clock, pops, controller };
}

describe('ROUTE-GOFN-01 go() decision table', () => {
  it('same URL → no-op', () => {
    const { port, controller } = setup();
    expect(controller.go(routePath('/macos'))).toBe('noop');
    expect(port.entries).toHaveLength(1);
  });

  it('new URL → push, recording the previous URL', () => {
    const { port, controller } = setup();
    expect(controller.go(routePath('/macos/finder'))).toBe('push');
    expect(port.entries.map((entry) => entry.url)).toEqual(['/macos', '/macos/finder']);
    expect(readOsk(port.state())).toEqual({ idx: 1, prev: '/macos' });
  });

  it('URL equal to osk.prev → history.back() (back-collapse)', () => {
    const { port, controller, pops } = setup();
    controller.go(routePath('/macos/finder'));
    expect(controller.go(routePath('/macos'))).toBe('back');
    port.flush();
    expect(port.index).toBe(0);
    expect(pops).toEqual([]); // our own echo is not reported as a visitor traversal
  });

  it('toggling A ↔ B keeps history bounded and never duplicates neighbours', () => {
    const { port, controller } = setup();
    for (let i = 0; i < 10; i++) {
      controller.go(routePath('/macos/finder'));
      port.flush();
      controller.go(routePath('/macos/safari'));
      port.flush();
    }
    const urls = port.entries.slice(0, port.index + 1).map((entry) => entry.url);
    expect(urls.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < urls.length; i++) expect(urls[i]).not.toBe(urls[i - 1]);
  });

  it('canonicalize always replaces and keeps the osk record', () => {
    const { port, controller } = setup();
    controller.go(routePath('/macos/finder'));
    expect(controller.canonicalize(routePath('/macos/finder/experience'))).toBe('replace');
    expect(port.entries).toHaveLength(2);
    expect(readOsk(port.state())).toEqual({ idx: 1, prev: '/macos' });
  });

  it('visitor traversals are reported to the kernel', () => {
    const { port, controller, pops } = setup();
    controller.go(routePath('/macos/finder'));
    port.back();
    port.flush();
    expect(pops).toEqual(['/macos']);
  });
});

describe('ROUTE-SER-01 traversal serialization + failsafe', () => {
  it('queues writes until the echoed popstate arrives, then drains in order', () => {
    const { port, controller } = setup();
    controller.go(routePath('/macos/finder'));
    controller.go(routePath('/macos')); // back() in flight
    expect(controller.traversing()).toBe(true);
    expect(controller.go(routePath('/macos/safari'))).toBe('queued');
    expect(port.entries.map((entry) => entry.url)).toEqual(['/macos', '/macos/finder']);
    port.flush();
    expect(controller.traversing()).toBe(false);
    expect(port.entries.map((entry) => entry.url)).toEqual(['/macos', '/macos/safari']);
  });

  it('falls back to push after 500 ms without an echo', () => {
    const port = createMemoryHistory('/macos');
    const clock = manualClock();
    const back = vi.spyOn(port, 'back').mockImplementation(() => undefined);
    const controller = createHistoryController({
      port,
      onPop: () => undefined,
      now: clock.now,
      schedule: clock.schedule,
    });
    controller.canonicalize(routePath('/macos'));
    controller.go(routePath('/macos/finder'));
    controller.go(routePath('/macos'));
    expect(back).toHaveBeenCalledOnce();
    clock.advance(499);
    expect(controller.traversing()).toBe(true);
    clock.advance(1);
    expect(controller.traversing()).toBe(false);
    expect(port.url()).toBe('/macos');
    expect(port.entries.map((entry) => entry.url)).toEqual(['/macos', '/macos/finder', '/macos']);
  });

  it('a different URL arriving mid-traversal is the visitor’s traversal and wins', () => {
    const port = createMemoryHistory('/a');
    const pops: string[] = [];
    const controller = createHistoryController({ port, onPop: (url) => pops.push(url) });
    controller.canonicalize(routePath('/a'));
    controller.go(routePath('/b'));
    controller.go(routePath('/c'));
    controller.go(routePath('/b')); // back() to /b
    port.back(); // the visitor also pressed Back
    port.flush();
    expect(pops).toEqual(['/a']);
  });
});

describe('ROUTE-TERM-01 push-rate degrade', () => {
  it('more than 20 pushes in 10 s switch to replace', () => {
    const { port, controller, clock } = setup('/linux');
    const ops = Array.from({ length: 25 }, (_, i) => {
      clock.advance(100);
      return controller.go(routePath(`/linux/terminal/p${i}`));
    });
    expect(ops.slice(0, 20).every((op) => op === 'push')).toBe(true);
    expect(ops.slice(20).every((op) => op === 'replace')).toBe(true);
    expect(port.entries).toHaveLength(21);
    expect(port.url()).toBe('/linux/terminal/p24');
    clock.advance(10_001);
    expect(controller.go(routePath('/linux/terminal/again'))).toBe('push');
  });
});
