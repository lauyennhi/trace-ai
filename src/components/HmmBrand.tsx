import React, { useEffect, useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Small brand kit for "hmm": the wordmark, the h-m-m-m loader, a wave of letters, a hum sound, and text that runs around a button. */

export const GRAD = "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)";

const H_PATH = "M207 395 V175 M207 312 C207 272 232 257 262 257 C292 257 312 275 312 312 V395";
const M_PATH = "M378 395 V237 M378 312 C378 272 400 257 419 257 C440 257 460 275 460 312 V395 M460 312 C460 272 484 257 511 257 C540 257 562 275 562 312 V336 A39 39 0 0 0 640 336 V312 C640 272 662 257 681 257 C702 257 722 275 722 312 V395 M722 312 C722 272 744 257 764 257 C788 257 805 275 805 312 V395";
export const MARK_LIGHT_BG: [string, string, string] = ["#0a35a0", "#6a55c8", "#a87be0"];
export const MARK_DARK_BG: [string, string, string] = ["#5b94ff", "#8b6cff", "#d08af0"];

/** The logo: lowercase "hmm" in one stroke; the last two m's are joined by a U like a stretched ribbon. Optional "..." and a draw-in animation. */
export const HmmMark: React.FC<{ className?: string; colors?: [string, string, string]; dots?: boolean; draw?: boolean; style?: React.CSSProperties }> = ({ className = "", colors = MARK_DARK_BG, dots = false, draw = false, style }) => {
  const id = useId().replace(/:/g, "");
  const still = useReducedMotion();
  const anim = draw && !still;
  const P = (d: string, delay: number) => anim
    ? <motion.path d={d} fill="none" stroke={`url(#${id})`} strokeWidth="40" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, delay, ease: "easeInOut" }} />
    : <path d={d} fill="none" stroke={`url(#${id})`} strokeWidth="40" />;
  return (
    <svg viewBox={dots ? "150 150 830 290" : "160 160 680 250"} className={className} style={style} role="img" aria-label="hmm" overflow="visible">
      <defs><linearGradient id={id} gradientUnits="userSpaceOnUse" x1="187" y1="0" x2="825" y2="0"><stop offset="0" stopColor={colors[0]} /><stop offset="0.55" stopColor={colors[1]} /><stop offset="1" stopColor={colors[2]} /></linearGradient></defs>
      {P(H_PATH, 0)}{P(M_PATH, 0.45)}
      {dots && [865, 905, 945].map((x, i) => (
        <motion.circle key={x} cx={x} cy={378} r={15} fill={colors[2]} initial={anim ? { opacity: 0, scale: 0.2 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.7 + i * 0.28, type: "spring", stiffness: 300, damping: 14 }} style={{ transformBox: "fill-box", transformOrigin: "center" }} />
      ))}
    </svg>
  );
};

/** Small wordmark for navigation bars on dark backgrounds. */
export const HmmLogo: React.FC<{ className?: string; ribbon?: boolean }> = ({ className = "" }) => <HmmMark className={`h-[22px] w-auto ${className}`} colors={MARK_DARK_BG} />;

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
