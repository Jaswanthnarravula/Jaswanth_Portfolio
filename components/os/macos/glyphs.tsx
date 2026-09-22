/**
 * Toolbar and sidebar glyphs for the macOS apps — Lucide paths (ISC; credited in `GLYPH_CREDIT`) at a 1.5 px stroke,
 * tuned to SF Symbols' weight (plans/macos/01-identity "Iconography": SF Symbols are not licensed for the web).
 * Decorative: every control that shows one carries its own accessible name.
 */
import type { ReactNode, SVGProps } from 'react';

type GlyphProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { readonly size?: number };

function glyph(paths: ReactNode, strokeWidth = 1.5) {
  return function Glyph({ size = 16, ...rest }: GlyphProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const SidebarGlyph = glyph(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </>,
);
export const ZoomInGlyph = glyph(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8M11 8v6M8 11h6" />
  </>,
);
export const ZoomOutGlyph = glyph(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8M8 11h6" />
  </>,
);
export const ShareGlyph = glyph(
  <>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </>,
);
export const DownloadGlyph = glyph(
  <>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </>,
);
export const PrintGlyph = glyph(
  <>
    <path d="M6 9V3h12v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M6 14h12v7H6z" />
  </>,
);
export const TextGlyph = glyph(
  <>
    <path d="M4 7V5h16v2M9 19h6M12 5v14" />
  </>,
);
export const ComposeGlyph = glyph(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </>,
);
export const ReplyGlyph = glyph(
  <>
    <path d="M9 17 4 12l5-5" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </>,
);
export const CopyGlyph = glyph(
  <>
    <rect width="13" height="13" x="9" y="9" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>,
);
export const InboxGlyph = glyph(
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z" />
  </>,
);
export const SendGlyph = glyph(
  <>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </>,
);
export const DraftGlyph = glyph(
  <>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z" />
    <path d="M14 2v6h6M9 15h6M9 11h2" />
  </>,
);
export const PaperclipGlyph = glyph(
  <path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
);
export const ExternalGlyph = glyph(
  <>
    <path d="M15 3h6v6M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>,
);
export const StarGlyph = glyph(<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z" />);
export const ForkGlyph = glyph(
  <>
    <circle cx="6" cy="5" r="2" />
    <circle cx="18" cy="5" r="2" />
    <circle cx="12" cy="19" r="2" />
    <path d="M6 7v1a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V7M12 12v5" />
  </>,
);
export const BookGlyph = glyph(<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />);
export const LayersGlyph = glyph(
  <>
    <path d="m12 2 10 5-10 5L2 7Z" />
    <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
  </>,
);
export const LinkGlyph = glyph(
  <>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </>,
);
export const FileGlyph = glyph(
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </>,
);
export const FilesGlyph = glyph(
  <>
    <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5Z" />
    <path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8M15 2v5h5" />
  </>,
);
export const SearchLineGlyph = glyph(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8" />
  </>,
);
export const BranchGlyph = glyph(
  <>
    <circle cx="6" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="8" r="2" />
    <path d="M6 8v8M18 10a6 6 0 0 1-6 6H8" />
  </>,
);
export const BlocksGlyph = glyph(
  <>
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3" />
  </>,
);
export const XGlyph = glyph(<path d="M18 6 6 18M6 6l12 12" />, 2);
export const PlusGlyph = glyph(<path d="M12 5v14M5 12h14" />, 2);
export const ReloadGlyph = glyph(
  <>
    <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
    <path d="M21 3v5h-5" />
  </>,
);
export const TabsGlyph = glyph(
  <>
    <rect width="18" height="14" x="3" y="6" rx="2" />
    <path d="M7 3h10" />
  </>,
);
export const GridGlyph = glyph(
  <>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
  </>,
);
export const ListGlyph = glyph(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, 2);
export const ColumnsGlyph = glyph(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18M15 3v18" />
  </>,
);
export const MoreGlyph = glyph(
  <>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </>,
  2.5,
);
export const InfoGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </>,
);
export const EyeGlyph = glyph(
  <>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const SlidersGlyph = glyph(
  <>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </>,
);
export const PaletteGlyph = glyph(
  <>
    <circle cx="13.5" cy="6.5" r=".5" />
    <circle cx="17.5" cy="10.5" r=".5" />
    <circle cx="8.5" cy="7.5" r=".5" />
    <circle cx="6.5" cy="12.5" r=".5" />
    <path d="M12 2a10 10 0 0 0 0 20c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9Z" />
  </>,
);
export const AccessibilityGlyph = glyph(
  <>
    <circle cx="16" cy="4" r="1" />
    <path d="m18 19 1-7-6 1M5 8l3-3 5.5 3-2.4 3.5M4.2 14.5a5 5 0 0 0 6.9 5M13.8 17.5a5 5 0 0 0-6.9-5" />
  </>,
);
export const SpeakerGlyph = glyph(
  <>
    <path d="M11 5 6 9H2v6h4l5 4Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </>,
);
export const DockGlyph = glyph(
  <>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="M6 16h12" />
  </>,
);
export const KeyboardGlyph = glyph(
  <>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h.01M12 13h.01M16 13h.01M7 16h10" />
  </>,
);
export const HandGlyph = glyph(
  <>
    <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" />
  </>,
);
export const GearGlyph = glyph(
  <>
    <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.8l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.8l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const MonitorGlyph = glyph(
  <>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </>,
);
export const ClockGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>,
);
export const CheckGlyph = glyph(<path d="M20 6 9 17l-5-5" />, 2);
export const PlayGlyph = glyph(<path d="m6 3 14 9-14 9Z" />);
export const MailGlyph = glyph(
  <>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </>,
);
export const ErrorGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </>,
);
export const WarningGlyph = glyph(
  <>
    <path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
    <path d="M12 9v4M12 17h.01" />
  </>,
);
export const ChevronDownGlyph = glyph(<path d="m6 9 6 6 6-6" />, 2);
