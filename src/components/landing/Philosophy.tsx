import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { NAVY, COBALT, SKY, MUTED, BLUE_TEXT, WavyHmm, Eyebrow, reduced } from "./shared";

/**
 * About Trace, "triết lý vận hành", told as three scroll scenes instead of a wall of text.
 * Each scene has one short line in big type, the full paragraph revealed word by word, and a moving picture:
 * 1. answers rushing past, then slowing to a stop (một nhịp lùi lại)
 * 2. a blinking caret and a "Hmm…" rippling out (những nốt trầm ngập ngừng)
 * 3. scattered pieces gathering along a trace into one light (thứ ánh sáng độc bản)
 */
const SCENES = [
  { big: "Một nhịp lùi lại.", text: "Có một nghịch lý của thời đại: Khi đáp án được kết xuất chỉ trong chớp mắt, tư duy của chúng ta lại lướt đi quá vội vàng. Giữa một thế giới ồn ào nơi máy móc tranh nhau mớm lời, TraceEdu xin một nhịp lùi lại, để tâm trí của bạn thực sự cất tiếng." },
  { big: "Những nốt trầm ngập ngừng.", text: "Chúng tôi tin rằng, vẻ đẹp thực sự của tri thức không nằm ở một văn bản hoàn hảo được sinh ra từ phím tắt. Nó nằm ở những nốt trầm ngập ngừng. Là khoảnh khắc ngón tay bạn dừng lại trên bàn phím, nhíu mày hoài nghi, và một tiếng 'Hmm...' khe khẽ vang lên." },
  { big: "Thứ ánh sáng độc bản.", text: "Đó là lúc tư duy bắt đầu nảy mầm. Là khi bạn tự tay nhặt nhạnh từng mảnh ghép, lần theo những dấu vết nguyên sơ nhất để dệt nên thế giới quan của riêng mình. TraceEdu không tạo ra cỗ máy thông minh hơn con người. Chúng tôi chỉ nâng niu những khoảng lặng, để giữ gìn thứ ánh sáng độc bản mà không một thuật toán nào có thể sao chép." },
] as const;

const Word: React.FC<{ w: string; p: MotionValue<number>; a: number }> = ({ w, p, a }) => {
  const o = useTransform(p, [a, a + 0.08], [0.18, 1]);
  return <motion.span style={{ opacity: o }}>{w} </motion.span>;
};
const Paragraph: React.FC<{ text: string; p: MotionValue<number> }> = ({ text, p }) => {
  const words = text.split(" ");
  return <p className="mt-6 max-w-xl text-[16px] leading-[1.75] sm:text-[18px]" style={{ color: "#3c5268" }}>{words.map((w, i) => <Word key={i} w={w} p={p} a={(i / words.length) * 0.75} />)}</p>;
};

/* ---- scene 1: answers rush past, then stop */
const RUSH = ["Đáp án", "Copy", "Paste", "Viết hộ tôi", "Tóm tắt nhanh", "Generate", "Xong rồi", "Ctrl + V", "Trả lời ngay"];
const Rush: React.FC<{ t: number }> = ({ t }) => {
  const rows = useRef<(HTMLDivElement | null)[]>([]), tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, last = performance.now(); const off = [0, 120, 260, 60, 190];
    const f = (now: number) => {
      raf = requestAnimationFrame(f);
      const dt = Math.min(50, now - last); last = now;
      const speed = Math.max(0, 1 - tRef.current * 1.35);   // slows to a full stop
      rows.current.forEach((el, i) => { if (!el) return; off[i] = (off[i] + dt * speed * (0.35 + i * 0.09)) % 600; el.style.transform = `translateX(${-off[i]}px)`; el.style.filter = `blur(${speed * 2.2}px)`; });
    };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, []);
  const stop = Math.min(1, Math.max(0, (t - 0.55) / 0.3));
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 flex flex-col justify-center gap-4">
        {[0, 1, 2, 3, 4].map((r) => (
          <div key={r} ref={(el) => { rows.current[r] = el; }} className="flex w-max gap-3 whitespace-nowrap" style={{ opacity: 0.85 - Math.abs(r - 2) * 0.18 }}>
            {Array.from({ length: 14 }, (_, k) => <span key={k} className="rounded-full border border-[#004E9A]/15 bg-white px-4 py-2 text-[14px] font-medium shadow-sm" style={{ color: k % 3 ? MUTED : COBALT }}>{RUSH[(k + r * 2) % RUSH.length]}</span>)}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: stop, background: `radial-gradient(closest-side, rgba(248,251,255,${0.95 * stop}), rgba(248,251,255,${0.6 * stop}) 60%, transparent)` }}>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center gap-2 rounded-full text-white shadow-[0_12px_30px_-10px_rgba(0,78,154,0.7)]" style={{ background: `linear-gradient(135deg,${COBALT},${SKY})` }}><span className="h-6 w-1.5 rounded bg-white" /><span className="h-6 w-1.5 rounded bg-white" /></div>
          <div className="mt-4 text-[22px] font-semibold tracking-[-0.02em]" style={{ color: NAVY }}>Khoan đã.</div>
        </div>
      </div>
    </div>
  );
};

/* ---- scene 2: the caret hesitates, a Hmm ripples out */
const TYPED = "Liệu điều này có thật sự đúng không";
const Hesitate: React.FC<{ t: number }> = ({ t }) => {
  const n = Math.round(Math.min(1, t / 0.45) * TYPED.length);
  const hmm = Math.min(1, Math.max(0, (t - 0.45) / 0.2));
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      {[0, 1, 2].map((i) => <span key={i} className="ripple absolute h-40 w-40 rounded-full border-2" style={{ borderColor: SKY, animationDelay: `${i * 0.9}s`, opacity: hmm }} />)}
      <div className="relative w-[min(420px,90%)] rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_24px_60px_-28px_rgba(4,27,45,0.35)]">
        <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-black/10" /><span className="h-2.5 w-2.5 rounded-full bg-black/10" /><span className="h-2.5 w-2.5 rounded-full bg-black/10" /></div>
        <div className="mt-4 min-h-[28px] text-[17px]" style={{ color: NAVY }}>{TYPED.slice(0, n)}<span className="caret ml-0.5 inline-block h-5 w-[2px] translate-y-1" style={{ background: COBALT }} /></div>
      </div>
      <motion.div className="relative mt-8 text-[clamp(2.6rem,5vw,4rem)] font-semibold" style={{ opacity: hmm, ...BLUE_TEXT }} animate={{ scale: 0.9 + hmm * 0.1 }}><WavyHmm m={3} /></motion.div>
    </div>
  );
};

/* ---- scene 3: pieces gather along a trace into one light */
const PIECES = Array.from({ length: 26 }, (_, i) => {
  const a = i * 2.39996, r = 120 + ((i * 53) % 90);
  const u = i / 25, tx = 40 + u * 320, ty = 150 + Math.sin(u * Math.PI * 2.2) * 55 - u * 40;
  return { sx: 200 + Math.cos(a) * r, sy: 150 + Math.sin(a) * r * 0.7, tx, ty, s: 4 + (i % 4) * 2 };
});
const Gather: React.FC<{ t: number }> = ({ t }) => {
  const g = Math.min(1, t / 0.55), glow = Math.min(1, Math.max(0, (t - 0.55) / 0.3));
  const ease = g * g * (3 - 2 * g);
  const trail = PIECES.map((p) => [p.tx, p.ty]).map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden="true">
      <defs><radialGradient id="ph-light"><stop offset="0" stopColor="#ffffff" /><stop offset="0.3" stopColor="#bfe0ff" /><stop offset="1" stopColor={SKY} stopOpacity="0" /></radialGradient></defs>
      <path d={trail} fill="none" stroke={COBALT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - ease} opacity={0.8} />
      {PIECES.map((p, i) => {
        const x = p.sx + (p.tx - p.sx) * ease, y = p.sy + (p.ty - p.sy) * ease;
        return <rect key={i} x={x - p.s / 2} y={y - p.s / 2} width={p.s} height={p.s} rx="1.5" fill={i % 3 ? SKY : COBALT} opacity={0.55 + 0.45 * ease} transform={`rotate(${(1 - ease) * i * 25} ${x} ${y})`} />;
      })}
      <circle cx={PIECES[25].tx} cy={PIECES[25].ty} r={18 + glow * 46} fill="url(#ph-light)" opacity={glow} />
      <circle cx={PIECES[25].tx} cy={PIECES[25].ty} r={4 + glow * 5} fill="#ffffff" opacity={glow} />
    </svg>
  );
};

export const About: React.FC = () => {
  const wrap = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  const [v, setV] = useState({ s: 0, t: 0 });
  useMotionValueEvent(p, "change", (x) => { const q = Math.min(2.999, Math.max(0, x * 3)); const s = Math.floor(q), t = q - s; setV((o) => (o.s === s && Math.abs(o.t - t) < 0.01 ? o : { s, t })); });
  const local = [useTransform(p, [0, 0.27], [0, 1]), useTransform(p, [0.3333, 0.6], [0, 1]), useTransform(p, [0.6667, 0.93], [0, 1])];
  const visuals = [<Rush t={v.t} />, <Hesitate t={v.t} />, <Gather t={v.t} />];
  const sc = SCENES[v.s];
  return (
    <section ref={wrap} id="about" className="relative" style={{ height: reduced() ? "auto" : "330svh", background: "linear-gradient(180deg,#f3f7fb,#ffffff)" }} aria-label="About Trace">
      <div className={`${reduced() ? "" : "sticky top-0"} flex min-h-[100svh] items-center overflow-hidden px-5 py-24 sm:px-8 md:px-14`}>
        <style>{`.ripple{animation:ripple 2.7s ease-out infinite}@keyframes ripple{from{transform:scale(.5);opacity:.7}to{transform:scale(2.6);opacity:0}}.caret{animation:caret 1s steps(1) infinite}@keyframes caret{50%{opacity:0}}@media (prefers-reduced-motion:reduce){.ripple,.caret{animation:none}}`}</style>
        <div className="mx-auto grid w-full max-w-[1250px] items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <Eyebrow>About Trace · Triết lý vận hành</Eyebrow>
            <div className="mt-6 flex items-center gap-3">
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: COBALT }}>0{v.s + 1}</span>
              <div className="h-[3px] w-40 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full" style={{ width: `${((v.s + v.t) / 3) * 100}%`, background: `linear-gradient(90deg,${COBALT},${SKY})` }} /></div>
              <span className="text-[13px] tabular-nums" style={{ color: MUTED }}>03</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={v.s} initial={{ opacity: 0, y: 30, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -24, filter: "blur(8px)" }} transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}>
                <h2 className="mt-6 text-[clamp(2.4rem,5vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.045em]" style={{ color: NAVY }}>{sc.big.split(" ").slice(0, -1).join(" ")} <span style={BLUE_TEXT}>{sc.big.split(" ").slice(-1)}</span></h2>
                <Paragraph text={sc.text} p={local[v.s]} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="relative h-[300px] overflow-hidden rounded-[32px] border border-white bg-white/60 shadow-[0_40px_100px_-50px_rgba(4,27,45,0.45)] backdrop-blur sm:h-[380px] lg:h-[460px]">
            <AnimatePresence mode="wait">
              <motion.div key={v.s} className="absolute inset-0" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.5 }}>{visuals[v.s]}</motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
