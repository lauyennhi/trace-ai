import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { NAVY, COBALT, SKY, MUTED, BRICK, GREEN, reduced } from "./shared";

/**
 * The thinking path. x is time, y is how deeply the student is thinking (up = deeper).
 * Grey dashed: the shortcut (ask the AI, paste the answer). Blue: what TraceEdu records instead:
 * a dip when the student wants to copy, a loop each time they stop and reconsider ("Hmm…"), then the rise to "Aha!".
 */
const W = 1200, H = 420, X0 = 130, X1 = 1100;
const ANCH: [number, number][] = [[0, 300], [0.17, 352], [0.36, 220], [0.53, 238], [0.74, 150], [1, 70]];
const LOOPS: [number, number, number][] = [[0.29, 0.39, 46], [0.66, 0.75, 38]];
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const baseY = (t: number) => {
  let i = 0; while (i < ANCH.length - 2 && t > ANCH[i + 1][0]) i++;
  const [ta, ya] = ANCH[i], [tb, yb] = ANCH[i + 1], k = (t - ta) / (tb - ta);
  return ya + (yb - ya) * (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, k)))) / 2;
};
const at = (t: number): [number, number] => {
  let x = X0 + (X1 - X0) * t, y = baseY(t);
  for (const [a, b, R] of LOOPS) { const phi = 2 * Math.PI * sstep(a, b, t); x -= R * Math.sin(phi); y -= R * (1 - Math.cos(phi)); }
  return [x, y];
};

type Stop = { t: number; label: string; sub: string; tone: "start" | "down" | "loop" | "up" | "aha"; above?: boolean };
const STOPS: Stop[] = [
  { t: 0, label: "Câu hỏi", sub: "Một bài luận cần viết", tone: "start" },
  { t: 0.17, label: "Muốn copy cho xong", sub: "Cám dỗ của đường tắt", tone: "down" },
  { t: 0.34, label: "Hmm… nghĩ lại", sub: "Nói ra ý mình trước", tone: "loop", above: true },
  { t: 0.53, label: "Tự viết lập luận", sub: "Đáp án mở khóa", tone: "up" },
  { t: 0.705, label: "Hmm… chắc chưa?", sub: "Bị hỏi ngược, giữ hoặc đổi ý", tone: "loop", above: true },
  { t: 1, label: "Aha!", sub: "Hiểu, và có bằng chứng", tone: "aha", above: true },
];
const TONE = { start: NAVY, down: BRICK, loop: COBALT, up: SKY, aha: GREEN } as const;

export const ThinkingPath: React.FC = () => {
  const host = useRef<HTMLDivElement>(null), path = useRef<SVGPathElement>(null), orb = useRef<SVGGElement>(null);
  const seen = useInView(host, { amount: 0.35 });
  const [reached, setReached] = useState(-1);
  const { d, fracs, pts } = useMemo(() => {
    const N = 600; let d = "", len = 0, prev: [number, number] | null = null; const cum: number[] = [];
    for (let i = 0; i <= N; i++) { const p = at(i / N); if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); cum.push(len); d += (i ? " L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); prev = p; }
    // a loop stop sits on top of its loop; others on the line
    const pts = STOPS.map((s) => { if (s.tone !== "loop") return at(s.t); const L = LOOPS.find(([a, b]) => s.t >= a && s.t <= b)!; return at((L[0] + L[1]) / 2); });
    const fracs = STOPS.map((s) => cum[Math.round(s.t * N)] / len);
    return { d, fracs, pts };
  }, []);

  useEffect(() => {
    if (!seen) return;
    if (reduced()) { setReached(STOPS.length - 1); return; }
    const el = path.current!, len = el.getTotalLength();
    let raf = 0; const t0 = performance.now() + 900, DUR = 9000, HOLD = 2200;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const e = now - t0; if (e < 0) return;
      const f = Math.min(1, (e % (DUR + HOLD)) / DUR);
      const p = el.getPointAtLength(f * len);
      orb.current?.setAttribute("transform", `translate(${p.x},${p.y})`);
      let r = -1; fracs.forEach((fr, i) => { if (f >= fr - 0.002) r = i; });
      setReached((old) => (old === r ? old : r));
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seen, fracs]);

  return (
    <div ref={host} className="relative mx-auto w-full max-w-[1200px] overflow-x-auto pb-2 [scrollbar-width:none] lg:overflow-visible">
      <div className="relative min-w-[760px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Đường tư duy: từ câu hỏi, qua những lần dừng lại nghĩ, đến khoảnh khắc Aha. Đường tắt là đường thẳng từ câu hỏi tới đáp án dán sẵn.">
          <defs>
            <linearGradient id="tp-g" x1={X0} x2={X1} y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={NAVY} /><stop offset="0.45" stopColor={COBALT} /><stop offset="0.85" stopColor={SKY} /><stop offset="1" stopColor={GREEN} /></linearGradient>
            <filter id="tp-glow" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><feGaussianBlur stdDeviation="7" /></filter>
            <radialGradient id="tp-orb"><stop offset="0" stopColor="#fff" /><stop offset="0.35" stopColor="#bfe0ff" /><stop offset="1" stopColor={SKY} stopOpacity="0" /></radialGradient>
          </defs>
          {/* axis */}
          <line x1={X0 - 40} y1={H - 24} x2={X0 - 40} y2={30} stroke="rgba(4,27,45,0.18)" strokeWidth="1.5" />
          <path d={`M${X0 - 46} 40 L${X0 - 40} 28 L${X0 - 34} 40`} fill="none" stroke="rgba(4,27,45,0.3)" strokeWidth="1.5" />
          <text x={X0 - 52} y={H / 2} transform={`rotate(-90 ${X0 - 52} ${H / 2})`} textAnchor="middle" fontSize="13" fill={MUTED}>Độ sâu tư duy</text>
          {[110, 210, 310].map((y) => <line key={y} x1={X0 - 30} x2={X1 + 40} y1={y} y2={y} stroke="rgba(4,27,45,0.06)" strokeDasharray="3 7" />)}

          {/* the shortcut */}
          <motion.line x1={pts[0][0]} y1={pts[0][1]} x2={X1} y2={pts[0][1] - 10} stroke="rgba(4,27,45,0.28)" strokeWidth="2" strokeDasharray="7 8" initial={{ pathLength: 0 }} animate={seen ? { pathLength: 1 } : {}} transition={{ duration: 0.8 }} />
          <motion.g initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : {}} transition={{ delay: 0.6 }}>
            <text x={X1 - 4} y={pts[0][1] - 22} textAnchor="end" fontSize="13" fill={MUTED}>Đường tắt: hỏi AI → dán đáp án</text>
            <text x={X1 - 4} y={pts[0][1] + 18} textAnchor="end" fontSize="12" fill={BRICK}>0 dấu vết tư duy</text>
          </motion.g>

          {/* the thinking path */}
          <motion.path d={d} fill="none" stroke={SKY} strokeOpacity="0.35" strokeWidth="14" filter="url(#tp-glow)" initial={{ pathLength: 0 }} animate={seen ? { pathLength: 1 } : {}} transition={{ duration: 2.4, ease: "easeInOut", delay: 0.3 }} />
          <motion.path ref={path} d={d} fill="none" stroke="url(#tp-g)" strokeWidth="4.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={seen ? { pathLength: 1 } : {}} transition={{ duration: 2.4, ease: "easeInOut", delay: 0.3 }} />

          {STOPS.map((s, i) => {
            const [x, y] = pts[i], on = reached >= i, c = TONE[s.tone];
            return (
              <g key={s.label}>
                <circle cx={x} cy={y} r={on ? 9 : 6} fill={on ? c : "#ffffff"} stroke={c} strokeWidth="2.5" style={{ transition: "all .35s" }} />
                {on && s.tone === "aha" && <circle cx={x} cy={y} r="9" fill="none" stroke={GREEN} strokeWidth="2"><animate attributeName="r" values="9;34" dur="1.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.8;0" dur="1.4s" repeatCount="indefinite" /></circle>}
              </g>
            );
          })}
          {!reduced() && <g ref={orb} transform={`translate(${pts[0][0]},${pts[0][1]})`}><circle r="22" fill="url(#tp-orb)" /><circle r="5" fill={COBALT} /></g>}
        </svg>
        {/* labels in HTML so they stay readable */}
        {STOPS.map((s, i) => {
          const [x, y] = pts[i], on = reached >= i, c = TONE[s.tone];
          const left = `${(x / W) * 100}%`, top = `${(y / H) * 100}%`;
          return (
            <div key={s.label} className="pointer-events-none absolute w-[180px] -translate-x-1/2 text-center transition-all duration-500" style={{ left, top, transform: `translate(-50%, ${s.above ? "calc(-100% - 22px)" : "22px"})`, opacity: on ? 1 : 0.35 }}>
              <div className="inline-block whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold shadow-sm" style={{ background: on ? c : "#ffffff", color: on ? "#ffffff" : c, border: `1px solid ${c}33` }}>{s.label}</div>
              <div className="mt-1 text-[11.5px] leading-tight" style={{ color: MUTED }}>{s.sub}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px]" style={{ color: MUTED }}>
        <span className="inline-flex items-center gap-2"><span className="h-[3px] w-7 rounded-full" style={{ background: `linear-gradient(90deg,${COBALT},${SKY})` }} />Đường tư duy TraceEdu ghi lại</span>
        <span className="inline-flex items-center gap-2"><span className="w-7 border-t-2 border-dashed" style={{ borderColor: "rgba(4,27,45,0.3)" }} />Đường tắt</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COBALT }} />Mỗi vòng lặp là một lần “Hmm…”</span>
      </div>
    </div>
  );
};
