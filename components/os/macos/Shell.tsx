/**
 * The macos chunk entry (shared/01 `ARCH-SPLIT-01`: one lazy chunk per OS). Until the real shell is built in its
 * phase, the chunk resolves the preview stub; the OS stays unreleased (`OS_REGISTRY.macos.released === false`).
 */
export { default } from '@/components/shell/StubOs';
