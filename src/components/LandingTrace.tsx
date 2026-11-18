import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { ArrowRight, FileSearch, Lock, UserCheck } from "lucide-react";
import { HmmLoader } from "./HmmBrand";
import { NAVY, COBALT, SKY, wait, reduced } from "./LandingSections";

export type Role = "student" | "teacher";
const SOFT = "#9fb6cc";   // muted text on navy

/* ------------------------------------------------------------------------------------------------------------------
 * The signature graphic: the "trace", a line of thought that climbs, loops back on itself (like the ligature in the
 * logo), and moves on. A light travels along it. Pure SVG, one rAF loop that only runs while the line is on screen.
 * ---------------------------------------------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------------------------------- hero */
const PROMPTS = ["Tóm tắt chương 3 cho tôi...", "Viết giúp tôi bài luận về mạng xã hội", "Giải bài tập này giúp tôi"];
const PromptBar: React.FC = () => {
  const [text, setText] = useState(""), [hmm, setHmm] = useState(false);
  useEffect(() => {
    if (reduced()) { setText(PROMPTS[0]); setHmm(true); return; }
    let alive = true;
    (async () => {
      let i = 0;
      while (alive) {
        const t = PROMPTS[i++ % PROMPTS.length]; setHmm(false);
        for (let c = 1; c <= t.length && alive; c++) { setText(t.slice(0, c)); await wait(50); }
        await wait(450); if (!alive) return;
        setHmm(true); await wait(3600); if (!alive) return;
        setHmm(false);
        for (let c = t.length; c >= 0 && alive; c--) { setText(t.slice(0, c)); await wait(14); }
        await wait(500);
      }
    })();
    return () => { alive = false; };
  }, []);
  return (
    <div className="w-full max-w-2xl" role="img" aria-label="Minh họa: người dùng gõ một yêu cầu cho AI, nút gửi biến thành chữ hmm">
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] px-5 py-4 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(66,140,212,0.5)]">
        <div className="min-h-[1.6em] flex-1 truncate text-left text-[15px] sm:text-[18px] text-white">{text}<span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.18em] animate-pulse bg-[#7db8ee]" /></div>
        <AnimatePresence>
          {hmm && <motion.span initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} className="shrink-0 rounded-full border border-[#428CD4]/50 bg-[#428CD4]/20 px-4 py-1.5 text-[18px] text-[#bcdcfa]"><HmmLoader count={5} label="hmm" /></motion.span>}
        </AnimatePresence>
      </div>
      <div className="mt-3 h-5 text-[13px]" style={{ color: SOFT }}>{hmm && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Hmm… Đáp án đang được giữ lại. Bạn nói ý mình trước đã.</motion.span>}</div>
    </div>
  );
};

export const CtaPair: React.FC<{ onPick: (r: Role) => void; dark?: boolean }> = ({ onPick, dark = true }) => (
  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
    <button onClick={() => onPick("student")} className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(66,140,212,0.7)] transition hover:brightness-110" style={{ background: `linear-gradient(90deg,${COBALT},${SKY})` }}>Tôi là sinh viên <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
    <button onClick={() => onPick("teacher")} className={`rounded-full border px-7 py-3.5 text-[15px] font-semibold transition ${dark ? "border-white/25 text-white hover:bg-white/10" : "border-black/20 hover:bg-black/5"}`}>Tôi là giảng viên</button>
  </div>
);

export const HeroTrace: React.FC<{ onPick: (r: Role) => void }> = ({ onPick }) => (
  <section id="top" className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pt-28 pb-56 text-center text-white" style={{ background: `radial-gradient(120% 90% at 50% 0%, #0b3558 0%, ${NAVY} 60%)` }} aria-label="Giới thiệu Trace Edu">
    <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "28px 28px", maskImage: "radial-gradient(70% 60% at 50% 40%, #000, transparent)" }} />
    <div className="absolute -top-40 left-1/2 h-[30rem] w-[46rem] -translate-x-1/2 rounded-full bg-[#004E9A] opacity-40 blur-[140px]" />
    <TraceLine className="absolute inset-x-0 bottom-0 h-[36%] w-full" />
    <div className="relative z-10 flex w-full flex-col items-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[12px] tracking-wide" style={{ color: "#bcdcfa" }}>Nền tảng đọc dấu vết tư duy trong thời đại AI</motion.div>
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="font-semibold tracking-[-0.045em] leading-[0.98] text-[clamp(2.7rem,8vw,6.6rem)]">Đừng để AI <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg,#6fb0ee,${SKY},#9cc9f5)` }}>nghĩ thay.</span></motion.h1>
      <p className="mt-6 max-w-xl text-[15px] sm:text-[18px] leading-relaxed" style={{ color: SOFT }}>Trace Edu cố tình làm chậm bạn một nhịp: dừng lại, trăn trở, rồi tự tìm ra câu trả lời. Đáp án đến sau, và là của bạn.</p>
      <div className="mt-10 flex w-full justify-center"><PromptBar /></div>
      <div className="mt-6"><CtaPair onPick={onPick} /></div>
    </div>
  </section>
);

/* ------------------------------------------------------------------------------------------------ trust strip */
const TRUST = [
  [Lock, "Đáp án bị khóa ở máy chủ", "Phần còn lại của câu trả lời không rời máy chủ cho tới khi người học nói ra ý mình. Không có cách nào xem lén trên trình duyệt."],
  [FileSearch, "Chấm quá trình, kèm bằng chứng", "Năm tiêu chí tư duy, mỗi điểm đều gắn với đoạn trao đổi đã làm ra nó. Ai cũng kiểm tra lại được."],
  [UserCheck, "Thầy cô giữ quyền chốt điểm", "AI đề xuất, giảng viên đọc bằng chứng rồi quyết định. Điểm cuối cùng luôn có người chịu trách nhiệm."],
] as const;

export const TrustStrip: React.FC = () => (
  <section className="relative z-10 -mt-24 px-5 md:px-12 pb-6" aria-label="Điểm khác biệt">
    <div className="mx-auto grid max-w-[1100px] gap-4 md:grid-cols-3">
      {TRUST.map(([Icon, t, d], i) => (
        <motion.div key={t} initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: i * 0.1 }} className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_24px_60px_-28px_rgba(4,27,45,0.35)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg,${COBALT},${SKY})` }}><Icon className="h-5 w-5" /></span>
          <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em]" style={{ color: NAVY }}>{t}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-[#4a6178]">{d}</p>
        </motion.div>
      ))}
    </div>
  </section>
);

/* --------------------------------------------------------------------------------------------------- aha */
const AXES = [["Phản biện", 82], ["Đào sâu", 70], ["Kiểm chứng", 64], ["Nội hóa", 75], ["Chủ động", 79]] as const;
const C = 150, R = 100;
const pt = (i: number, f: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
const poly = (f: (i: number) => number) => AXES.map((_, i) => pt(i, f(i)).join(",")).join(" ");

const CountUp: React.FC<{ to: number; suffix?: string }> = ({ to, suffix = "" }) => {
  const ref = useRef<HTMLSpanElement>(null), seen = useInView(ref, { once: true });
  const [v, setV] = useState(reduced() ? to : 0);
  useEffect(() => {
    if (!seen || reduced()) return;
    let raf = 0; const t0 = performance.now();
    const f = (n: number) => { const k = Math.min(1, (n - t0) / 1400); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [seen, to]);
  return <span ref={ref}>{v}{suffix}</span>;
};

export const AhaTrace: React.FC = () => (
  <section id="aha" className="relative overflow-hidden px-5 md:px-12 py-24 md:py-36 text-white" style={{ background: `linear-gradient(180deg,${NAVY},#06263f)` }} aria-label="Khoảnh khắc Aha">
    <div className="absolute right-0 top-1/3 h-[28rem] w-[34rem] rounded-full bg-[#428CD4] opacity-[0.14] blur-[140px]" />
    <div className="relative mx-auto max-w-3xl text-center">
      <h2 className="text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold tracking-[-0.04em] leading-[1.04]">Định giá lại tư duy.<br />Từ Hmm đến <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg,#6fb0ee,#bcdcfa)` }}>Aha!</span></h2>
      <p className="mx-auto mt-6 max-w-xl text-[16px] md:text-[18px] leading-relaxed" style={{ color: SOFT }}>Điểm cuối cùng chỉ nói được bạn đã đến đâu. Trace Edu còn ghi lại bạn đã đi thế nào: mỗi lần nghi ngờ, mỗi lần viết ra ý mình, mỗi lần bị hỏi ngược.</p>
    </div>
    <div className="relative mx-auto mt-14 max-w-4xl rounded-3xl border border-white/12 bg-white/[0.05] p-5 sm:p-8 text-left backdrop-blur-xl shadow-[0_40px_100px_-40px_rgba(66,140,212,0.6)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div><div className="text-[12px]" style={{ color: SOFT }}>Hồ sơ tư duy</div><div className="text-[17px] font-semibold">Tiểu luận: Mạng xã hội và việc học</div></div>
        <motion.div initial={{ opacity: 0, scale: 2, rotate: -14 }} whileInView={{ opacity: 1, scale: 1, rotate: -5 }} viewport={{ once: true }} transition={{ delay: 1.4, type: "spring", stiffness: 200, damping: 14 }} className="rounded-lg border-2 border-[#6fe0a8] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6fe0a8]">Hồ sơ minh bạch · Trace Edu</motion.div>
      </div>
      <div className="mt-6 grid items-center gap-8 md:grid-cols-2">
        <svg viewBox="0 0 300 300" className="mx-auto w-full max-w-[340px]" role="img" aria-label="Biểu đồ radar 5 tiêu chí tư duy">
          {[0.33, 0.66, 1].map((f) => <polygon key={f} points={poly(() => f)} fill="none" stroke="rgba(255,255,255,0.14)" />)}
          {AXES.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" />; })}
          <motion.polygon points={poly((i) => AXES[i][1] / 100)} fill="rgba(66,140,212,0.3)" stroke={SKY} strokeWidth="2" strokeLinejoin="round" style={{ transformOrigin: `${C}px ${C}px` }} initial={{ scale: 0.05, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 1.3, ease: [0.2, 0.8, 0.2, 1] }} />
          {AXES.map(([label, v], i) => { const [x, y] = pt(i, v / 100), [lx, ly] = pt(i, 1.22); return <g key={label}><circle cx={x} cy={y} r="4" fill="#bcdcfa" /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill={SOFT}>{label}</text></g>; })}
        </svg>
        <div className="space-y-3">
          {([["Ý tự viết trước khi mở khóa", 3, "/3"], ["Câu hỏi ngược đã trả lời", 4, ""], ["Nguồn đã kiểm", 5, "/6"]] as const).map(([k, v, suf]) => <div key={k} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3"><span className="text-[14px]" style={{ color: SOFT }}>{k}</span><span className="text-[20px] font-semibold tabular-nums"><CountUp to={v} suffix={suf} /></span></div>)}
          <svg viewBox="0 0 200 40" className="w-full" aria-hidden="true"><motion.path d="M0 30 C 20 6, 30 6, 50 24 S 80 36, 100 18 S 140 2, 160 12 S 190 8, 200 4" fill="none" stroke={SKY} strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.8 }} /></svg>
          <div className="text-[11px]" style={{ color: SOFT }}>Đường tư duy theo thời gian · Minh họa</div>
        </div>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------------------------------- final CTA + footer */
export const FinalTrace: React.FC<{ onPick: (r: Role) => void; onLogin: () => void; onContact: () => void }> = ({ onPick, onLogin, onContact }) => (
  <>
    <section className="relative overflow-hidden px-5 md:px-12 pt-28 md:pt-40 pb-56 text-center text-white" style={{ background: `radial-gradient(110% 100% at 50% 0%, #0b3558 0%, ${NAVY} 65%)` }} aria-label="Bắt đầu">
      <TraceLine flip className="absolute inset-x-0 bottom-0 h-[52%] w-full" />
      <div className="relative">
        <h2 className="mx-auto max-w-3xl text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold tracking-[-0.04em] leading-[1.04]">Sẵn sàng để bộ não <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg,#6fb0ee,#bcdcfa)` }}>đổ mồ hôi</span> chưa?</h2>
        <p className="mx-auto mt-5 max-w-md text-[16px]" style={{ color: SOFT }}>Bắt đầu bằng một bài. Phần còn lại, bạn sẽ tự nhìn thấy.</p>
        <div className="mt-10"><CtaPair onPick={onPick} /></div>
      </div>
    </section>
    <footer className="px-5 md:px-12 py-8 text-[13px] text-white" style={{ background: NAVY, color: SOFT, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
        <span>Trace Edu · Human · Machine · Mind</span>
        <nav className="flex flex-wrap gap-5" aria-label="Chân trang">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-white">Home</button>
          <button onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white">About Trace</button>
          <button onClick={onContact} className="hover:text-white">Contact</button>
          <button onClick={onLogin} className="hover:text-white">Đăng nhập</button>
        </nav>
        <span className="text-[12px]">Hình minh họa trên trang này không phải số liệu thật.</span>
      </div>
    </footer>
  </>
);
