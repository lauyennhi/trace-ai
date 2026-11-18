import React, { useId } from "react";

/** Trace Edu wordmark, drawn as vectors: "Tr" in navy, "ace" in cobalt with a sky-blue thread running through the letters, "Edu" light. */
export const NAVY = "#041B2D", COBALT = "#004E9A", SKY = "#428CD4";

export const TraceLogo: React.FC<{ className?: string; tone?: "light" | "dark"; edu?: boolean }> = ({ className = "h-8 w-auto", tone = "light", edu = true }) => {
  const dark = tone === "dark", gid = useId().replace(/:/g, "");
  const tr = dark ? "#ffffff" : NAVY, a0 = dark ? SKY : COBALT, a1 = dark ? "#a9ccf2" : SKY, sub = dark ? "#c8d6e6" : NAVY;
  return (
    <svg viewBox={edu ? "-12 -12 640 144" : "-12 -12 430 144"} className={className} role="img" aria-label="Trace Edu" fill="none" strokeLinejoin="round">
      <defs><linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="165" y1="0" x2="410" y2="0"><stop offset="0" stopColor={a0} /><stop offset="1" stopColor={a1} /></linearGradient></defs>
      <g stroke={tr} strokeWidth="17"><path d="M0 8 H88 M44 8 V120" /><path d="M112 42 V120 M112 76 C112 54 126 44 148 44" /></g>
      <g stroke={`url(#${gid})`} strokeWidth="17">
        <circle cx="205" cy="80" r="32" /><path d="M237 46 V120" />
        <path d="M317.6 59.4 A32 32 0 1 0 317.6 100.6" />
        <path d="M336 80 H400 C400 62 386 48 368 48 C350 48 336 62 336 80 C336 98 350 112 368 112 C380 112 390 106 396 96" />
      </g>
      {edu && <g stroke={sub} strokeWidth="7"><path d="M464 40 H440 V116 H464 M440 78 H460" /><circle cx="506" cy="88" r="28" /><path d="M534 40 V116" /><path d="M556 60 V94 C556 108 564 116 578 116 C592 116 600 108 600 94 M600 60 V116" /></g>}
    </svg>
  );
};
