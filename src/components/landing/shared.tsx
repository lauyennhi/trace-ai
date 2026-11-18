import React, { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { NAVY, COBALT, SKY } from "../TraceLogo";

export { NAVY, COBALT, SKY };
export const SOFT = "#9fb6cc";        // muted text on navy
export const MUTED = "#4a6178";       // muted text on white
export const MIST = "#f3f7fb";        // pale section background
export const BRICK = "#c2503f";
export const GREEN = "#16a34a";
export const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const BLUE_TEXT = { backgroundImage: `linear-gradient(90deg,${COBALT},${SKY})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;
export const LIGHT_BG = "radial-gradient(70% 60% at 85% 10%, rgba(66,140,212,0.22), transparent 70%), radial-gradient(60% 55% at 10% 90%, rgba(0,78,154,0.12), transparent 70%), linear-gradient(180deg,#eef5fc,#f8fbff)";
export const SKY_TEXT = { backgroundImage: `linear-gradient(90deg,#7db8ee,${SKY})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;

/** "Hmm…" written inline: the m's bob one after another, like a wave. The signature micro-interaction. */
export const WavyHmm: React.FC<{ m?: number; dots?: boolean; className?: string; style?: React.CSSProperties }> = ({ m = 2, dots = true, className = "", style }) => {
  const still = useReducedMotion();
  return (
    <span className={`inline-flex items-baseline ${className}`} style={style} aria-label="Hmm">
      <span aria-hidden="true">H</span>
      {Array.from({ length: m }, (_, i) => <motion.span key={i} aria-hidden="true" className="inline-block" animate={still ? undefined : { y: ["0em", "-0.12em", "0em"] }} transition={{ repeat: Infinity, duration: 1.3, delay: i * 0.14, ease: "easeInOut" }}>m</motion.span>)}
      {dots && <span aria-hidden="true">...</span>}
    </span>
  );
};

/** Text that lights up word by word as it scrolls through the viewport. */
const Word: React.FC<{ w: string; p: MotionValue<number>; a: number; b: number; hi?: boolean }> = ({ w, p, a, b, hi }) => {
  const o = useTransform(p, [a, b], [0.16, 1]);
  return <motion.span style={{ opacity: o, ...(hi ? BLUE_TEXT : {}) }}>{w} </motion.span>;
};
export const ScrollWords: React.FC<{ text: string; className?: string; highlight?: string }> = ({ text, className = "", highlight }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.88", "end 0.5"] });
  const words = text.split(" ");
  const hiStart = highlight ? text.indexOf(highlight) : -1;
  let pos = 0;
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => {
        const at = pos; pos += w.length + 1;
        const hi = hiStart >= 0 && at >= hiStart && at < hiStart + (highlight?.length ?? 0);
        const a = i / words.length;
        return <Word key={i} w={w} p={scrollYProgress} a={a * 0.9} b={a * 0.9 + 0.12} hi={hi} />;
      })}
    </p>
  );
};

/** Small uppercase label used at the top of each section. */
export const Eyebrow: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: dark ? SKY : COBALT }}>
    <span className="h-px w-8" style={{ background: "currentColor" }} />{children}
  </div>
);
