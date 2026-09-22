/**
 * CHOOSE-FAIL-01 for the chooser's own chunk: a failed import stays inside the slot (never the root error page), shows
 * Retry and the plain portfolio with focus on its heading, and recovers on Retry or when the network returns.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChooserSlot } from '@/components/shell/ChooserSlot';

type Load = NonNullable<Parameters<typeof ChooserSlot>[0]['load']>;

const chooserModule = { default: () => <h1>Choose how you want to explore</h1> } as unknown as Awaited<
  ReturnType<Load>
>;
const failing = () => Promise.reject(new Error('ChunkLoadError: offline'));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ChooserSlot', () => {
  it('renders the chooser once its chunk arrives', async () => {
    render(<ChooserSlot load={() => Promise.resolve(chooserModule)} />);
    expect(await screen.findByRole('heading', { name: 'Choose how you want to explore' })).toBeInTheDocument();
  });

  it('a failed chunk shows Retry and the plain portfolio, focused, and Retry loads it again', async () => {
    const load = vi.fn<Load>().mockImplementationOnce(failing).mockResolvedValue(chooserModule);
    render(<ChooserSlot load={load} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load the operating systems');
    expect(screen.getByRole('link', { name: 'Read the plain portfolio' })).toHaveAttribute('href', '/plain');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()); // focus was on <body>
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Choose how you want to explore' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('retries on its own when the network returns', async () => {
    const load = vi.fn<Load>().mockImplementationOnce(failing).mockResolvedValue(chooserModule);
    render(<ChooserSlot load={load} />);
    await screen.findByRole('alert');
    // The panel's effect (focus + the `online` listener) has run once its heading holds focus.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByRole('heading', { name: 'Choose how you want to explore' })).toBeVisible();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
