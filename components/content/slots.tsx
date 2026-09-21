/**
 * View contract — shared/03. Views are hook-free functions of data; the OS app supplies the idiom through slots.
 * `slots.Link` is how an OS injects `KernelLink` (in-OS navigation) while the SSR fallback injects a plain `<a>`.
 */
import type { ComponentType, ReactNode } from 'react';
import type { ContentRef, MediaRef } from '@/data/schema';
import { refSlug } from '@/data/schema';

export type Density = 'comfortable' | 'compact' | 'text';
/** 1 only on reader pages, where the view's title is the page title; windows start at 2/3 (shared/09). */
export type HeadingLevel = 1 | 2 | 3 | 4;

export interface LinkSlotProps {
  readonly to: ContentRef;
  readonly children: ReactNode;
  readonly className?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-current'?: 'page' | 'true';
}

export interface MediaSlotProps {
  readonly media: MediaRef;
  readonly className?: string;
}

export interface TagSlotProps {
  readonly children: ReactNode;
}

export interface ActionSlotProps {
  readonly action: ContentAction;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Typed hand-off actions a view can offer; the OS decides how they look and behave. */
export type ContentAction =
  | { readonly kind: 'copy'; readonly text: string; readonly label: string }
  | { readonly kind: 'download'; readonly href: string; readonly filename: string }
  | { readonly kind: 'open-resume' };

export interface ViewSlots {
  readonly Link: ComponentType<LinkSlotProps>;
  readonly Media: ComponentType<MediaSlotProps>;
  readonly Tag: ComponentType<TagSlotProps>;
  /** `null` → the action is not offered (e.g. copy without JavaScript). */
  readonly Action: ComponentType<ActionSlotProps> | null;
}

export interface ViewProps<T> {
  readonly data: T;
  readonly density?: Density;
  readonly slots?: Partial<ViewSlots>;
  readonly headingLevel?: HeadingLevel;
}

export const goHref = (ref: ContentRef): string => {
  const slug = refSlug(ref);
  return `/go/${ref.section}${slug ? `/${slug}` : ''}`;
};

function PlainLink({ to, children, ...rest }: LinkSlotProps) {
  return (
    <a href={goHref(to)} {...rest}>
      {children}
    </a>
  );
}

function PlainMedia({ media, className }: MediaSlotProps) {
  if (media.kind === 'video') return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- views are framework-agnostic; dimensions are mandatory (CLS)
    <img
      src={media.src}
      alt={media.alt}
      width={media.width}
      height={media.height}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

function PlainTag({ children }: TagSlotProps) {
  return <span className="cv-tag">{children}</span>;
}

export const DEFAULT_SLOTS: ViewSlots = { Link: PlainLink, Media: PlainMedia, Tag: PlainTag, Action: null };

export const withSlots = (slots?: Partial<ViewSlots>): ViewSlots => ({ ...DEFAULT_SLOTS, ...slots });

/** Heading element for a level, clamped to h6. */
export function Heading({
  level,
  children,
  className,
  id,
}: {
  level: number;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const Tag = `h${Math.min(Math.max(level, 1), 6)}` as 'h2';
  return (
    <Tag className={className} id={id}>
      {children}
    </Tag>
  );
}
