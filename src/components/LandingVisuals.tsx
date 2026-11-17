import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";

/** Two "show, don't tell" blocks for the landing page: a chat that runs by itself, and the output radar. */
const GRAD = "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)";
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const QUESTION = "Trước khi tôi hỗ trợ, hãy trả lời: biến số chính em muốn đo lường ở đây là gì?";
const ANSWER = "Thời gian dùng mạng xã hội mỗi ngày và điểm trung bình học kỳ.";
const HINTS = ["Giả thuyết: dùng nhiều hơn thì điểm thấp hơn?", "Cần kiểm soát giờ ngủ và việc làm thêm.", "Hướng khác: so sánh giữa các nhóm ngành."];

export const SocraticSection: React.FC = () => {
  const host = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [step, setStep] = useState(0);          // 0 idle · 1 student asks · 2 AI locked · 3 student types · 4 unlocked · 5 hints
  const [typed, setTyped] = useState("");
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(host.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) { setStep(5); setTyped(ANSWER); return; }
    if (!inView) return;
    let alive = true;
    (async () => {
      while (alive) {
        setStep(0); setTyped(""); await wait(500); if (!alive) return;
        setStep(1); await wait(1100); if (!alive) return;
        setStep(2); await wait(1700); if (!alive) return;
        setStep(3);
        for (let i = 1; i <= ANSWER.length && alive; i++) { setTyped(ANSWER.slice(0, i)); await wait(38); }
        await wait(700); if (!alive) return;
        setStep(4); await wait(1500); if (!alive) return;
        setStep(5); await wait(5200);
      }
    })();
    return () => { alive = false; };
  }, [inView, reduced]);

  return (
    <section ref={host} className="relative px-5 md:px-12 py-32 md:py-48 overflow-hidden" aria-label="Giao diện Socratic">
      <div className="absolute top-1/3 left-1/2 w-[40rem] h-[26rem] -translate-x-1/2 rounded-full bg-[#7c4dff] opacity-[0.1] blur-[130px]" />
      <div className="relative max-w-[1200px] mx-auto grid md:grid-cols-[1fr_1.1fr] gap-14 md:gap-24 items-center">
        <h2 className="text-[clamp(2.2rem,5vw,4.4rem)] font-medium tracking-[-0.035em] leading-[1.04]">AI đóng vai <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>người chất vấn</span>, không phải người làm thuê.</h2>

        <div className="rounded-[28px] border border-white/10 bg-[#0b0f1c]/70 backdrop-blur-xl p-5 sm:p-7 shadow-[0_30px_90px_-30px_rgba(124,77,255,0.55)]" role="img" aria-label="Minh họa: sinh viên nhờ viết bài, AI khóa câu trả lời và hỏi lại, sinh viên trả lời thì AI mở khóa và gợi ý">
          <div className="min-h-[400px] flex flex-col gap-3.5 text-[13px] sm:text-[14px]">
            <motion.div animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : 10 }} className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-[#7c4dff]/35 px-4 py-2.5 text-white/90">Viết cho tôi phần mở đầu bài tiểu luận.</motion.div>

            <motion.div animate={{ opacity: step >= 2 ? 1 : 0, y: step >= 2 ? 0 : 10 }} className="max-w-[88%] rounded-2xl rounded-tl-md bg-white/[0.07] border border-white/10 px-4 py-3">
              {step < 4 ? (
                <>
                  <p className="text-white/90 leading-relaxed">{QUESTION}</p>
                  <div className="relative mt-3 overflow-hidden rounded-lg">
                    <div className="space-y-1.5 blur-[5px] opacity-70" aria-hidden="true">{["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"].map((w, i) => <div key={i} className={`h-2 rounded-full bg-white/30 ${w}`} />)}</div>
                    <div className="absolute inset-0 flex items-center justify-center"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#0b0f1c]/80 border border-white/15 px-3 py-1 text-[11px] text-white/80"><Lock className="h-3 w-3" />Khóa 70%</span></div>
                  </div>
                </>
              ) : (
                <>
                  <motion.p initial={{ filter: "blur(6px)", opacity: 0.4 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.7 }} className="flex items-center gap-2 text-[#6ee7b7] font-medium"><Sparkles className="h-4 w-4" />Mở khóa thành công. Bắt đầu gợi ý…</motion.p>
                  <ul className="mt-2.5 space-y-1.5">{HINTS.map((h, i) => <motion.li key={h} initial={{ opacity: 0, x: -8 }} animate={{ opacity: step >= 5 ? 1 : 0, x: step >= 5 ? 0 : -8 }} transition={{ delay: i * 0.25 }} className="text-white/75 flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-[#a78bfa] shrink-0" />{h}</motion.li>)}</ul>
                </>
              )}
            </motion.div>
            <div className="flex-1" />
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white/85 min-h-[46px]">
              {step === 3 || step === 4 || step === 5 ? <>{typed}{step === 3 && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-white/80 animate-pulse" />}</> : <span className="text-white/30">Nhập ý của em…</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const AXES = [["Phản biện", 82, "#4f8cff"], ["Đào sâu", 70, "#7c4dff"], ["Kiểm chứng", 64, "#f59e0b"], ["Nội hóa", 75, "#34d399"], ["Chủ động", 79, "#ec4899"]] as const;
const C = 190, R = 128;
const pt = (i: number, f: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
const poly = (f: (i: number) => number) => AXES.map((_, i) => pt(i, f(i)).join(",")).join(" ");

export const PortfolioSection: React.FC = () => (
  <section id="ho-so" className="relative px-5 md:px-12 py-32 md:py-48 overflow-hidden" aria-label="Hồ sơ minh bạch">
    <div className="absolute bottom-0 right-1/4 w-[34rem] h-[24rem] rounded-full bg-[#ec4899] opacity-[0.08] blur-[130px]" />
    <div className="relative max-w-[1200px] mx-auto grid md:grid-cols-[1fr_1fr] gap-14 md:gap-24 items-center">
      <div>
        <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#a78bfa]">Bằng chứng đầu ra</div>
        <h2 className="mt-4 text-[clamp(2.2rem,5vw,4.4rem)] font-medium tracking-[-0.035em] leading-[1.04]">Định giá lại <span className="text-white/45">năng lực thật.</span></h2>
        <p className="mt-6 max-w-md text-[15px] md:text-[17px] leading-relaxed text-white/60">Chuyển toàn bộ quá trình đối thoại và lật ngược vấn đề thành Hồ sơ Minh bạch Học thuật.</p>
      </div>

      <div className="relative mx-auto w-full max-w-[420px]">
        <svg viewBox="0 0 380 380" className="w-full h-auto" role="img" aria-label="Biểu đồ radar 5 chiều tư duy: phản biện, đào sâu, kiểm chứng, nội hóa, chủ động">
          <defs><linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4f8cff" stopOpacity="0.45" /><stop offset="1" stopColor="#ec4899" stopOpacity="0.4" /></linearGradient></defs>
          {[0.33, 0.66, 1].map((f) => <polygon key={f} points={poly(() => f)} fill="none" stroke="rgba(255,255,255,0.1)" />)}
          {AXES.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />; })}
          <motion.polygon points={poly((i) => AXES[i][1] / 100)} fill="url(#radar-fill)" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" style={{ transformOrigin: `${C}px ${C}px` }} initial={{ scale: 0.15, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1.3, ease: [0.2, 0.8, 0.2, 1] }} />
          {AXES.map(([label, v, color], i) => {
            const [x, y] = pt(i, v / 100), [lx, ly] = pt(i, 1.2);
            return (
              <g key={label}>
                <motion.circle cx={x} cy={y} r="5" fill={color} stroke="#060914" strokeWidth="2" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1 + i * 0.08 }} />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="rgba(255,255,255,0.65)">{label}</text>
              </g>
            );
          })}
        </svg>
        <div className="absolute -top-2 right-0 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0b0f1c]/80 backdrop-blur px-3.5 py-1.5 text-[12px] text-white/85"><ShieldCheck className="h-3.5 w-3.5 text-[#34d399]" />Ghi nhận bởi Trace</div>
        <div className="mt-2 text-center text-[11px] text-white/35">Minh họa</div>
      </div>
    </div>
  </section>
);
