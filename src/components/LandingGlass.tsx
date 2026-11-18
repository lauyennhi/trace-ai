import React, { useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { ArrowRight, Eye, Hourglass, PenLine, Sprout } from "lucide-react";
import { TraceLogo, NAVY, COBALT, SKY } from "./TraceLogo";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SOFT = "#a9bfd3";
// optional looping background video: put a file in /public and set VITE_BG_VIDEO=/bg-video.mp4
const BG_VIDEO: string = (import.meta as any).env?.VITE_BG_VIDEO ?? "";

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

export const TraceLine: React.FC<{ className?: string; flip?: boolean }> = ({ className = "", flip = false }) => {
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
    <svg ref={host} className={className} viewBox="0 0 1440 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true" overflow="hidden">
      <defs>
        <linearGradient id={gid} x1="0" x2="1"><stop offset="0" stopColor={SKY} stopOpacity="0" /><stop offset="0.25" stopColor={SKY} /><stop offset="0.7" stopColor="#9cc9f5" /><stop offset="1" stopColor={SKY} stopOpacity="0.2" /></linearGradient>
        <filter id={gid + "b"} x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="9" /></filter>
        <radialGradient id={gid + "o"}><stop offset="0" stopColor="#fff" /><stop offset="0.35" stopColor="#9cc9f5" stopOpacity="0.9" /><stop offset="1" stopColor={SKY} stopOpacity="0" /></radialGradient>
      </defs>
      {[[22, 0.14], [11, 0.22]].map(([dy, o], i) => <motion.path key={i} d={d} fill="none" stroke={COBALT} strokeOpacity={o} strokeWidth="2" transform={`translate(0 ${dy})`} initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, delay: 0.25 * (i + 1), ease: "easeInOut" }} />)}
      <motion.path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth="14" strokeOpacity="0.5" filter={`url(#${gid}b)`} initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, ease: "easeInOut" }} />
      <motion.path ref={main} d={d} fill="none" stroke={`url(#${gid})`} strokeWidth="3.2" strokeLinecap="round" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, ease: "easeInOut" }} />
      {!still && Array.from({ length: 9 }, (_, i) => <circle key={i} ref={(el) => { dots.current[i] = el; }} r={3.6 - i * 0.34} fill="#cfe6ff" opacity={0.7 - i * 0.07} />)}
      {!still && <g ref={orb} transform="translate(-100,-100)"><circle r="26" fill={`url(#${gid}o)`} /><circle r="5.5" fill="#fff" /></g>}
    </svg>
  );
};



/* ---------------------------------------------------------------- the glass orb */
const GlassOrb: React.FC = () => {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced()) return;
    const on = (e: PointerEvent) => { const el = host.current; if (!el) return; el.style.setProperty("--px", String((e.clientX / window.innerWidth - 0.5) * 2)); el.style.setProperty("--py", String((e.clientY / window.innerHeight - 0.5) * 2)); };
    window.addEventListener("pointermove", on, { passive: true }); return () => window.removeEventListener("pointermove", on);
  }, []);
  return (
    <div ref={host} className="orb-wrap pointer-events-none absolute left-1/2 top-[12%] z-[1] md:top-[8%]" style={{ width: "min(58vw,390px)", aspectRatio: "1" }} aria-hidden="true">
      {/* light streaks crossing behind the sphere */}
      <div className="orb-streak absolute left-[-70%] top-[40%] h-[22%] w-[240%]" />
      <div className="orb-streak orb-streak-2 absolute left-[-60%] top-[52%] h-[8%] w-[220%]" />
      <div className="orb-float absolute inset-0">
        <div className="orb-sphere absolute inset-0 overflow-hidden rounded-full">
          <div className="orb-swirl orb-swirl-a" /><div className="orb-swirl orb-swirl-b" /><div className="orb-core" />
          <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.55), rgba(255,255,255,0) 20%), radial-gradient(circle at 70% 85%, rgba(156,201,245,0.35), transparent 40%)" }} />
        </div>
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28), inset 0 0 70px rgba(156,201,245,0.32), 0 0 140px rgba(66,140,212,0.4)" }} />
      </div>
    </div>
  );
};

const CSS = `
.orb-wrap{--px:0;--py:0;transform:translate(calc(-50% + var(--px)*14px),calc(var(--py)*10px))}
.orb-float{animation:orbfloat 7s ease-in-out infinite}
@keyframes orbfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
.orb-sphere{background:radial-gradient(circle at 50% 55%,rgba(0,52,110,.8),rgba(4,27,45,.95) 75%)}
.orb-swirl{position:absolute;inset:-20%;mix-blend-mode:screen;filter:blur(11px)}
.orb-swirl-a{background:conic-gradient(from 0deg,transparent 0 10%,#428CD4 22%,transparent 40%,#cfe6ff 58%,transparent 72%,#004E9A 86%,transparent);animation:spin 16s linear infinite}
.orb-swirl-b{background:conic-gradient(from 120deg,transparent 0 18%,#9cc9f5 30%,transparent 46%,#428CD4 66%,transparent 84%);opacity:.8;animation:spin 23s linear infinite reverse}
.orb-core{position:absolute;left:30%;top:36%;width:42%;height:34%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.55),transparent);filter:blur(12px);animation:corepulse 5s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes corepulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
.orb-streak{border-radius:999px;background:linear-gradient(90deg,transparent,rgba(0,78,154,.55) 25%,rgba(66,140,212,.9) 55%,rgba(255,255,255,.95) 66%,rgba(156,201,245,.5) 80%,transparent);filter:blur(16px);transform:rotate(-24deg);opacity:.85;animation:streak 9s ease-in-out infinite}
.orb-streak-2{filter:blur(7px);opacity:.6;transform:rotate(-24deg);animation-delay:-4s}
@keyframes streak{0%,100%{translate:-3% 0}50%{translate:3% -2%}}
.glass-card{transition:transform .35s ease,background .35s ease,box-shadow .35s ease}
.glass-card:hover{transform:translateY(-4px);background:rgba(255,255,255,.045);box-shadow:inset 0 1px 1px rgba(255,255,255,.18),0 30px 80px -30px rgba(66,140,212,.5)}
.grain{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");mix-blend-mode:overlay;opacity:.12}
@media (prefers-reduced-motion:reduce){.orb-float,.orb-swirl,.orb-core,.orb-streak{animation:none!important}}
`;

/* ---------------------------------------------------------------- fixed ambient background */
export const AmbientBg: React.FC = () => (
  <div className="fixed inset-0 -z-0 overflow-hidden" style={{ background: NAVY }} aria-hidden="true">
    <style>{CSS}</style>
    {BG_VIDEO && <video className="absolute inset-0 h-full w-full object-cover opacity-60" src={BG_VIDEO} autoPlay muted loop playsInline />}
    <div className="absolute inset-0" style={{ background: `radial-gradient(90% 70% at 50% 18%, rgba(0,78,154,0.5), transparent 70%), radial-gradient(60% 50% at 85% 85%, rgba(66,140,212,0.22), transparent 70%), linear-gradient(180deg, ${NAVY}cc, ${NAVY}f2)` }} />
    <div className="grain absolute inset-0" />
  </div>
);

/* ---------------------------------------------------------------- hero */
export const HeroGlass: React.FC<{ onStart: () => void; onDiscover: () => void }> = ({ onStart, onDiscover }) => (
  <section id="top" className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden px-5 pb-12 pt-28 sm:px-8 md:px-14 md:pb-16" aria-label="TraceEdu">
    <TraceLine className="pointer-events-none absolute inset-x-0 top-[24%] z-0 h-[44%] w-full opacity-60" />
    <GlassOrb />
    <div className="relative z-10 max-w-[900px]">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <TraceLogo tone="dark" className="h-10 w-auto sm:h-12" />
        <p className="mt-3 max-w-md text-[14px] leading-snug sm:text-[16px]" style={{ color: SOFT }}>Trở thành tiêu chuẩn kiểm định nhận thức mới của giáo dục hiện đại</p>
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }} className="mt-8 font-medium tracking-[-0.045em] leading-[0.95] text-[clamp(3rem,9vw,7.6rem)] text-white">
        Less Paste,<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg,#ffffff,#bcdcfa 45%,${SKY})` }}>More Trace</span>
      </motion.h1>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }} className="mt-9 flex flex-wrap gap-3">
        <button onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium transition hover:bg-white/90" style={{ color: NAVY }}>Bắt đầu ngay <ArrowRight className="h-4 w-4" /></button>
        <button onClick={onDiscover} className="liquid-glass rounded-full px-7 py-3.5 text-[15px] font-medium text-white transition hover:bg-white/10">Khám phá</button>
      </motion.div>
    </div>
  </section>
);

/* ---------------------------------------------------------------- vision */
export const VisionGlass: React.FC = () => (
  <section id="vision" className="relative px-5 py-24 sm:px-8 md:px-14 md:py-40" aria-label="Tầm nhìn">
    <div className="mx-auto max-w-[1100px]">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.8 }} className="liquid-glass glass-card rounded-[32px] p-8 sm:p-12 md:p-16">
        <div className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.2em]" style={{ color: SKY }}><Eye className="h-4 w-4" />Tầm nhìn</div>
        <p className="mt-7 text-[clamp(1.5rem,3.4vw,2.9rem)] font-medium leading-[1.25] tracking-[-0.025em] text-white">
          Tầm nhìn của chúng tôi không phải là một thế giới nơi AI làm tốt hơn con người. Đó là một hệ sinh thái học thuật nơi công nghệ biết lùi lại đúng lúc, <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg,#bcdcfa,${SKY})` }}>để nhường chỗ cho tư duy độc lập được phép bắt đầu.</span>
        </p>
      </motion.div>
    </div>
  </section>
);

/* ---------------------------------------------------------------- about */
const PARAS = [
  { Icon: Hourglass, text: "Có một nghịch lý của thời đại: Khi đáp án được kết xuất chỉ trong chớp mắt, tư duy của chúng ta lại lướt đi quá vội vàng. Giữa một thế giới ồn ào nơi máy móc tranh nhau mớm lời, TraceEdu xin một nhịp lùi lại, để tâm trí của bạn thực sự cất tiếng." },
  { Icon: PenLine, text: "Chúng tôi tin rằng, vẻ đẹp thực sự của tri thức không nằm ở một văn bản hoàn hảo được sinh ra từ phím tắt. Nó nằm ở những nốt trầm ngập ngừng. Là khoảnh khắc ngón tay bạn dừng lại trên bàn phím, nhíu mày hoài nghi, và một tiếng 'Hmm...' khe khẽ vang lên." },
  { Icon: Sprout, text: "Đó là lúc tư duy bắt đầu nảy mầm. Là khi bạn tự tay nhặt nhạnh từng mảnh ghép, lần theo những dấu vết nguyên sơ nhất để dệt nên thế giới quan của riêng mình. TraceEdu không tạo ra cỗ máy thông minh hơn con người. Chúng tôi chỉ nâng niu những khoảng lặng, để giữ gìn thứ ánh sáng độc bản mà không một thuật toán nào có thể sao chép." },
] as const;

export const AboutGlass: React.FC = () => (
  <section id="about" className="relative px-5 pb-24 sm:px-8 md:px-14 md:pb-40" aria-label="About Trace">
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-10 flex items-end justify-between gap-6 md:mb-14">
        <h2 className="text-[clamp(2.2rem,5.4vw,4.6rem)] font-medium tracking-[-0.04em] leading-[1] text-white">About <span style={{ color: SKY }}>Trace</span></h2>
        <svg viewBox="0 0 120 30" className="hidden w-32 sm:block" aria-hidden="true"><path d="M2 20 C 18 2, 30 2, 44 16 S 72 30, 84 14 S 106 4, 118 10" fill="none" stroke={SKY} strokeWidth="2" strokeLinecap="round" /></svg>
      </div>
      <div className="grid gap-4 md:gap-6">
        {PARAS.map(({ Icon, text }, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, delay: i * 0.05 }} className="liquid-glass glass-card flex gap-5 rounded-[28px] p-6 sm:gap-7 sm:p-9 md:p-11">
            <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `linear-gradient(135deg,${COBALT},${SKY})` }}><Icon className="h-5 w-5 text-white" /></span>
            <p className="text-[16px] leading-[1.75] sm:text-[18px]" style={{ color: i === 2 ? "#ffffff" : "#d4e3f2" }}>{text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export const FooterGlass: React.FC<{ onContact: () => void; onLogin: () => void }> = ({ onContact, onLogin }) => (
  <footer className="relative px-5 pb-10 pt-6 text-[13px] sm:px-8 md:px-14" style={{ color: SOFT }}>
    <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8">
      <TraceLogo tone="dark" className="h-6 w-auto" />
      <span>Less Paste, More Trace.</span>
      <nav className="flex gap-5" aria-label="Chân trang">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-white">Home</button>
        <button onClick={onContact} className="hover:text-white">Contact</button>
        <button onClick={onLogin} className="hover:text-white">Đăng nhập</button>
      </nav>
    </div>
  </footer>
);
