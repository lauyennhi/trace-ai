import React, { useEffect, useMemo, useRef } from "react";
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

/* ---------------------------------------------------------------- the trace line (signature graphic) */
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function tracePath(loops: [number, number, number][]): string {
  const N = 420; let d = "";
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let x = -80 + 1600 * t, y = 250 + 80 * Math.sin(t * 5.4 + 0.5) - 90 * t;
    for (const [t0, t1, R] of loops) {
      const phi = 2 * Math.PI * sstep(t0, t1, t);
      x -= R * Math.sin(phi); y -= R * (1 - Math.cos(phi)) * Math.sign(R);
    }
    d += (i ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d;
}

export const TraceLine: React.FC<{ className?: string; flip?: boolean; light?: boolean }> = ({ className = "", flip = false, light = false }) => {
  const host = useRef<SVGSVGElement>(null), main = useRef<SVGPathElement>(null);
  const orb = useRef<SVGGElement>(null), dots = useRef<(SVGCircleElement | null)[]>([]);
  const d = useMemo(() => tracePath(flip ? [[0.3, 0.42, -62], [0.6, 0.72, 78]] : [[0.38, 0.5, 78], [0.66, 0.76, -56]]), [flip]);
  const gid = useRef("tl" + Math.random().toString(36).slice(2, 7)).current;
  useEffect(() => {
    if (reduced() || !main.current) return;
    const path = main.current, len = path.getTotalLength();
    let raf = 0, visible = true, t0 = performance.now() + 2200;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(host.current!);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now < t0) return;
      const f = ((now - t0) / 9000) % 1;
      const p = path.getPointAtLength(f * len);
      orb.current?.setAttribute("transform", `translate(${p.x},${p.y})`);
      dots.current.forEach((c, i) => { if (!c) return; const q = path.getPointAtLength(Math.max(0, f * len - (i + 1) * 26)); c.setAttribute("cx", String(q.x)); c.setAttribute("cy", String(q.y)); });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [d]);
  const still = reduced();
  return (
    <svg ref={host} className={className} viewBox="0 0 1440 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true" overflow="visible">
      <defs>
        <linearGradient id={gid} x1="0" x2="1"><stop offset="0" stopColor={light ? COBALT : SKY} stopOpacity="0" /><stop offset="0.25" stopColor={light ? COBALT : SKY} /><stop offset="0.7" stopColor={light ? SKY : "#9cc9f5"} /><stop offset="1" stopColor={SKY} stopOpacity="0.2" /></linearGradient>
        <filter id={gid + "b"} filterUnits="userSpaceOnUse" x="-200" y="-300" width="1840" height="980"><feGaussianBlur stdDeviation="9" /></filter>
        <radialGradient id={gid + "o"}><stop offset="0" stopColor={light ? SKY : "#fff"} /><stop offset="0.35" stopColor="#9cc9f5" stopOpacity="0.9" /><stop offset="1" stopColor={SKY} stopOpacity="0" /></radialGradient>
      </defs>
      {[[22, 0.14], [11, 0.22]].map(([dy, o], i) => <motion.path key={i} d={d} fill="none" stroke={COBALT} strokeOpacity={o} strokeWidth="2" transform={`translate(0 ${dy})`} initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, delay: 0.25 * (i + 1), ease: "easeInOut" }} />)}
      <motion.path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth="14" strokeOpacity="0.5" filter={`url(#${gid}b)`} initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, ease: "easeInOut" }} />
      <motion.path ref={main} d={d} fill="none" stroke={`url(#${gid})`} strokeWidth="3.2" strokeLinecap="round" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, ease: "easeInOut" }} />
      {!still && Array.from({ length: 9 }, (_, i) => <circle key={i} ref={(el) => { dots.current[i] = el; }} r={3.6 - i * 0.34} fill={light ? SKY : "#cfe6ff"} opacity={0.7 - i * 0.07} />)}
      {!still && <g ref={orb} transform="translate(-100,-100)"><circle r="26" fill={`url(#${gid}o)`} /><circle r="5.5" fill={light ? COBALT : "#fff"} /></g>}
    </svg>
  );
};



