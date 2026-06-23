import React from 'react';

const wrap = (children) => (props) => {
  const { size = 18, ...rest } = props ?? {};
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
};

export const Icon = {
  Play: wrap(<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />),
  Pause: wrap(
    <>
      <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
    </>
  ),
  Stop: wrap(<rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" rx="1" />),
  Fwd: wrap(
    <>
      <polygon points="4 4 13 12 4 20 4 4" fill="currentColor" stroke="none" />
      <polygon points="13 4 22 12 13 20 13 4" fill="currentColor" stroke="none" />
    </>
  ),
  Back: wrap(
    <>
      <polygon points="20 4 11 12 20 20 20 4" fill="currentColor" stroke="none" />
      <polygon points="11 4 2 12 11 20 11 4" fill="currentColor" stroke="none" />
    </>
  ),
  Mark: wrap(
    <>
      <polyline points="6 4 6 20" />
      <polyline points="6 12 18 4" />
      <polyline points="6 12 18 20" />
    </>
  ),
  In: wrap(
    <>
      <polyline points="4 4 4 20" />
      <polyline points="9 8 15 12 9 16" />
    </>
  ),
  Out: wrap(
    <>
      <polyline points="20 4 20 20" />
      <polyline points="15 8 9 12 15 16" />
    </>
  ),
  Blade: wrap(
    <>
      <circle cx="6" cy="18" r="2" />
      <line x1="7.5" y1="16.5" x2="20" y2="4" />
      <line x1="13" y1="11" x2="20" y2="4" />
    </>
  ),
  Trash: wrap(
    <>
      <polyline points="4 7 20 7" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </>
  ),
  Plus: wrap(
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  Upload: wrap(
    <>
      <path d="M12 4v12" />
      <polyline points="7 9 12 4 17 9" />
      <path d="M4 20h16" />
    </>
  ),
  Sparkles: wrap(
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
    </>
  ),
  Wand: wrap(
    <>
      <path d="M4 20l10-10" />
      <path d="M14 4l2 2" />
      <path d="M18 8l2 2" />
      <path d="M3 7l2 2" />
    </>
  ),
  Export: wrap(
    <>
      <path d="M12 4v12" />
      <polyline points="7 9 12 4 17 9" />
      <rect x="4" y="16" width="16" height="4" rx="1" />
    </>
  ),
  Help: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  Layers: wrap(
    <>
      <polygon points="12 3 22 8 12 13 2 8 12 3" />
      <polyline points="2 14 12 19 22 14" />
    </>
  ),
  Target: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  Lock: wrap(
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  Mute: wrap(
    <>
      <polygon points="4 9 8 9 13 5 13 19 8 15 4 15 4 9" fill="currentColor" stroke="none" />
      <line x1="17" y1="9" x2="22" y2="14" />
      <line x1="22" y1="9" x2="17" y2="14" />
    </>
  ),
  Volume: wrap(
    <>
      <polygon points="4 9 8 9 13 5 13 19 8 15 4 15 4 9" fill="currentColor" stroke="none" />
      <path d="M17 8a5 5 0 0 1 0 8" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </>
  ),
  Eye: wrap(
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  EyeOff: wrap(
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9" />
      <path d="M6.1 7.2A17 17 0 0 0 2 12s3.5 7 10 7c1.5 0 2.9-.2 4.2-.6" />
    </>
  ),
  Settings: wrap(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.4H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  Search: wrap(
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </>
  ),
  Snap: wrap(
    <>
      <path d="M4 4v16" />
      <path d="M20 4v16" />
      <path d="M9 12h6" />
      <path d="M11 9l-3 3 3 3" />
      <path d="M13 15l3-3-3-3" />
    </>
  ),
  Loop: wrap(
    <>
      <path d="M17 4l4 4-4 4" />
      <path d="M3 12a5 5 0 0 1 5-5h13" />
      <path d="M7 20l-4-4 4-4" />
      <path d="M21 12a5 5 0 0 1-5 5H3" />
    </>
  ),
  Undo: wrap(
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
    </>
  ),
  Redo: wrap(
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h4" />
    </>
  ),
  Crop: wrap(
    <>
      <path d="M6 2v16h16" />
      <path d="M2 6h16v16" />
    </>
  ),
  Wave: wrap(
    <>
      <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
    </>
  ),
  T: wrap(
    <>
      <line x1="5" y1="5" x2="19" y2="5" />
      <line x1="12" y1="5" x2="12" y2="20" />
    </>
  )
};
