import React from "react";

/** TraceEdu wordmark, drawn as vectors after the brand logo: "Tr" and "e" in navy, the "ac" ligature as an infinity loop in cobalt, "Edu" light. */
export const NAVY = "#041B2D", COBALT = "#004E9A", SKY = "#428CD4";
export const INFINITY_OPEN = "M318.2 61.6A32 32 0 0 0 271.4 55.5C254.5 69.6 245.5 90.4 228.6 104.5A32 32 0 1 1 228.6 55.5C245.5 69.6 254.5 90.4 271.4 104.5A32 32 0 0 0 318.2 98.4";
export const INFINITY_CLOSED = "M271.4 55.5C254.5 69.6 245.5 90.4 228.6 104.5A32 32 0 1 1 228.6 55.5C245.5 69.6 254.5 90.4 271.4 104.5A32 32 0 1 0 271.4 55.5Z";

export const TraceLogo: React.FC<{ className?: string; tone?: "light" | "dark"; edu?: boolean }> = ({ className = "h-8 w-auto", tone = "light", edu = true }) => {
  const dark = tone === "dark";
  const ink = dark ? "#ffffff" : NAVY, loop = dark ? SKY : COBALT, sub = dark ? "#d4e3f2" : NAVY;
  return (
    <svg viewBox={edu ? "-12 -12 660 144" : "-12 -12 450 144"} className={className} role="img" aria-label="TraceEdu" fill="none" strokeLinejoin="round">
      <g stroke={ink} strokeWidth="17">
        <path d="M0 8H88M44 8V120" /><path d="M112 42V120M112 76C112 54 126 44 148 44" />
        <path d="M354 80H418C418 62 404 48 386 48C368 48 354 62 354 80C354 98 368 112 386 112C398 112 408 106 414 96" />
      </g>
      <path d={INFINITY_OPEN} stroke={loop} strokeWidth="17" />
      {edu && <g stroke={sub} strokeWidth="7"><path d="M480 40H456V116H480M456 78H476" /><circle cx="522" cy="88" r="28" /><path d="M550 40V116" /><path d="M572 60V94C572 108 580 116 594 116C608 116 616 108 616 94M616 60V116" /></g>}
    </svg>
  );
};
