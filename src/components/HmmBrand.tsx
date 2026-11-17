import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Small brand kit for "hmm": the wordmark, the h-m-m-m loader, a wave of letters, a hum sound, and text that runs around a button. */

export const GRAD = "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)";

/** Wordmark: "hmm" with a ribbon that leaves the last m, like a stroke of ink. */
export const HmmLogo: React.FC<{ className?: string; ribbon?: boolean }> = ({ className = "", ribbon = true }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label="hmm">
    <span className="text-[22px] leading-none font-semibold tracking-[-0.04em]">hmm</span>
    {ribbon && (
      <svg width="44" height="22" viewBox="0 0 44 22" aria-hidden="true" className="-ml-0.5 mt-1.5">
        <defs><linearGradient id="hmm-rib" x1="0" x2="1"><stop offset="0" stopColor="#4f8cff" /><stop offset="0.55" stopColor="#7c4dff" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>
        <path d="M1 14 C 8 14, 9 5, 16 5 S 26 18, 33 18 S 40 8, 43 8" fill="none" stroke="url(#hmm-rib)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )}
  </span>
);

/** Replaces spinners: the letters h m m m bob like a wave while the system is thinking. */
export const HmmLoader: React.FC<{ className?: string; label?: string; count?: number }> = ({ className = "", label = "Đang nghĩ", count = 4 }) => {
  const still = useReducedMotion();
  return (
    <span role="status" aria-label={label} className={`inline-flex items-baseline font-medium tracking-[0.18em] ${className}`}>
      <span aria-hidden="true">h</span>
      {Array.from({ length: count }, (_, i) => (
        <motion.span key={i} aria-hidden="true" animate={still ? undefined : { y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1.15, delay: i * 0.13, ease: "easeInOut" }}>m</motion.span>
      ))}
    </span>
  );
};

/** A soft "hmm": two low sine partials with a slow vibrato and a gentle envelope. Only ever called from a click. */
export function playHmm() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC(), now = ctx.currentTime, dur = 1.5;
    const master = ctx.createGain(); master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.09, now + 0.25); master.gain.setValueAtTime(0.09, now + 0.9); master.gain.linearRampToValueAtTime(0, now + dur);
    master.connect(ctx.destination);
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 5.2; lfoGain.gain.value = 4; lfo.connect(lfoGain);
    for (const [f, g] of [[196, 1], [392, 0.35]] as const) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(f * 0.96, now); o.frequency.linearRampToValueAtTime(f, now + 0.5);
      og.gain.value = g; lfoGain.connect(o.frequency); o.connect(og); og.connect(master); o.start(now); o.stop(now + dur);
    }
    lfo.start(now); lfo.stop(now + dur);
    setTimeout(() => ctx.close().catch(() => {}), (dur + 0.3) * 1000);
  } catch { /* sound is optional */ }
}

/** A button with the word "hmm" running around its border. Size is fixed so the path can be exact. */
export const HmmBorderButton: React.FC<{ onClick: () => void; children: React.ReactNode; w?: number; h?: number }> = ({ onClick, children, w = 270, h = 58 }) => {
  const pad = 14, r = h / 2;
  const d = `M ${pad + r} ${pad} H ${pad + w - r} A ${r} ${r} 0 0 1 ${pad + w - r} ${pad + h} H ${pad + r} A ${r} ${r} 0 0 1 ${pad + r} ${pad} Z`;
  const run = useRef<SVGAnimateElement>(null);
  useEffect(() => { try { (run.current as any)?.beginElement?.(); } catch { /* ignore */ } }, []);
  const still = useReducedMotion();
  return (
    <span className="relative inline-block" style={{ width: w + pad * 2, height: h + pad * 2 }}>
      <svg className="absolute inset-0 pointer-events-none overflow-visible" width={w + pad * 2} height={h + pad * 2} aria-hidden="true">
        <defs><path id="hmm-run-path" d={d} /></defs>
        <text fontSize="10" fontWeight="600" letterSpacing="5" fill="rgba(196,181,253,0.85)">
          <textPath href="#hmm-run-path" startOffset="0">
            {Array(40).fill("hmm").join("   ")}
            {!still && <animate ref={run} attributeName="startOffset" from="0" to="-168" dur="6s" repeatCount="indefinite" />}
          </textPath>
        </text>
      </svg>
      <button onClick={onClick} className="absolute rounded-full text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-[filter] hover:brightness-110" style={{ left: pad, top: pad, width: w, height: h, background: GRAD }}>{children}</button>
    </span>
  );
};
