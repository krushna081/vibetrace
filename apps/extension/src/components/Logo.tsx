import type { ReactNode } from "react";

export function Logo({ badge = true }: { badge?: boolean }): ReactNode {
  return (
    <div className="ext-brand" aria-label="VibeTrace">
      <svg className="ext-brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="1" y="1" width="62" height="62" rx="13" fill="#0b0e0a" stroke="#2c3329" />
        <path
          d="M16 18 L30 47 L38 31 L45 47 L56 18"
          fill="none"
          stroke="#c7f65a"
          strokeWidth="6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <rect x="46" y="15" width="7" height="5" fill="#f2f7ec" />
      </svg>
      <span className="ext-brand-word">
        VIBE<span className="ext-brand-accent">TRACE</span>
      </span>
      {badge ? <span className="ext-brand-badge">EXT</span> : null}
    </div>
  );
}
