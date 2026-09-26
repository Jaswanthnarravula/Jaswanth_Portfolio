'use client';
/**
 * Starts the reader motion driver (shared/24) once the page is interactive. Renders nothing: every fact is already in
 * the server HTML, and scroll-linked motion is CSS, so the page is complete before — and without — this island.
 */
import { useEffect } from 'react';
import { startReaderFx } from '@/lib/motion/reader-fx';

export function PlainFx() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-reader-fx]');
    return root ? startReaderFx(root) : undefined;
  }, []);
  return null;
}
