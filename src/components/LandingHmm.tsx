import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Lock, Sparkles, TriangleAlert, Bell } from "lucide-react";
import { HmmBorderButton, HmmLoader, GRAD, playHmm } from "./HmmBrand";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const slice = (s: string, t: number) => s.slice(0, Math.round(s.length * clamp(t)));
const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ 1. HERO */
const PROMPTS = ["Viết cho tôi một bài luận về...", "Giải bài tập này giúp tôi", "Tóm tắt chương 3 cho tôi"];

const HeroChat: React.FC = () => {
  const [text, setText] = useState("");
  const [hmm, setHmm] = useState(false);
  useEffect(() => {
    if (prefersReduced()) { setText(PROMPTS[0]); setHmm(true); return; }
    let alive = true;
    (async () => {
      let i = 0;
      while (alive) {
        const p = PROMPTS[i++ % PROMPTS.length];
        setHmm(false);
        for (let c = 1; c <= p.length && alive; c++) { setText(p.slice(0, c)); await wait(52); }
        await wait(420); if (!alive) return;
        setHmm(true);                       // the send button never appears: it turns into "hmmm"
        await wait(3400); if (!alive) return;
        setHmm(false);
        for (let c = p.length; c >= 0 && alive; c--) { setText(p.slice(0, c)); await wait(16); }
        await wait(450);
      }
    })();
    return () => { alive = false; };
  }, []);
  return (
    <div className="w-full max-w-2xl rounded-[28px] border border-white/12 bg-[#0b0f1c]/70 backdrop-blur-xl p-3 shadow-[0_30px_90px_-30px_rgba(124,77,255,0.6)]" role="img" aria-label="Minh họa: người dùng gõ một yêu cầu cho AI, nút gửi biến thành chữ hmm">
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4 min-h-[72px]">
        <div className="flex-1 text-left text-[15px] sm:text-[18px] text-white/90 whitespace-pre-wrap break-words">{text}<span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.18em] bg-white/85 animate-pulse" /></div>
        <AnimatePresence>
          {hmm && (
            <motion.div initial={{ opacity: 0, scale: 0.6, width: 0 }} animate={{ opacity: 1, scale: 1, width: "auto" }} exit={{ opacity: 0, scale: 0.6, width: 0 }} transition={{ duration: 0.35 }} className="overflow-hidden whitespace-nowrap rounded-full bg-[#7c4dff]/20 border border-[#7c4dff]/45 px-4 py-2 text-[18px] text-[#c4b5fd]">
              <HmmLoader count={5} label="hmm" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const WaveBg: React.FC = () => (
  <div className="absolute inset-x-0 top-[46%] h-40 -translate-y-1/2 overflow-hidden pointer-events-none opacity-70" aria-hidden="true">
    <svg className="absolute left-0 top-0 h-full w-[200%] animate-[hmmwave_22s_linear_infinite]" viewBox="0 0 2400 160" preserveAspectRatio="none">
      <defs><linearGradient id="hw" x1="0" x2="1"><stop offset="0" stopColor="#4f8cff" /><stop offset="0.5" stopColor="#7c4dff" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>
      <path d="M0 80 C 100 10, 200 10, 300 80 S 500 150, 600 80 S 800 10, 900 80 S 1100 150, 1200 80 S 1400 10, 1500 80 S 1700 150, 1800 80 S 2000 10, 2100 80 S 2300 150, 2400 80" fill="none" stroke="url(#hw)" strokeWidth="14" strokeLinecap="round" opacity="0.5" />
      <path d="M0 92 C 100 22, 200 22, 300 92 S 500 162, 600 92 S 800 22, 900 92 S 1100 162, 1200 92 S 1400 22, 1500 92 S 1700 162, 1800 92 S 2000 22, 2100 92 S 2300 162, 2400 92" fill="none" stroke="url(#hw)" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
    </svg>
    <style>{`@keyframes hmmwave { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
  </div>
);

export const HeroHmm: React.FC<{ onExperience: () => void }> = ({ onExperience }) => (
  <section className="relative min-h-[100svh] overflow-hidden px-5 pt-28 pb-16 flex flex-col items-center justify-center text-center" aria-label="Giới thiệu hmm">
    <div className="absolute -top-40 -left-32 w-[42rem] h-[42rem] rounded-full bg-[#0b57d0] opacity-[0.2] blur-[130px]" />
    <div className="absolute top-1/4 -right-40 w-[38rem] h-[38rem] rounded-full bg-[#7c4dff] opacity-[0.18] blur-[130px]" />
    <div className="absolute -bottom-52 left-1/4 w-[40rem] h-[28rem] rounded-full bg-[#ec4899] opacity-[0.12] blur-[130px]" />
    <WaveBg />
    <div className="relative z-10 flex flex-col items-center w-full">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="font-semibold tracking-[-0.045em] leading-[0.98] text-[clamp(2.6rem,8vw,7rem)]">Đừng để AI <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>nghĩ thay.</span></motion.h1>
      <div className="mt-10 sm:mt-12 w-full flex justify-center"><HeroChat /></div>
      <p className="mt-9 max-w-xl text-[14px] sm:text-[17px] leading-relaxed text-white/55">Nền tảng bắt bạn phải dừng lại, trăn trở và tự tìm ra câu trả lời.</p>
      <button onClick={() => { playHmm(); onExperience(); }} className="mt-8 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white inline-flex items-center gap-2 transition-[filter] hover:brightness-110" style={{ background: GRAD }}>Trải nghiệm tiếng “Hmm”</button>
    </div>
  </section>
);

/* ------------------------------------------------------------ 2. STICKY LOOP */
const SCENES = [
  { title: "Hmm… Góc nhìn khác thì sao?", desc: "Bôi đen bất kỳ đoạn nào trên internet. Hmm ném cho bạn một góc nhìn đối lập để đập tan sự phiến diện.", chips: [["Sắp có", "tiện ích trình duyệt"]] },
  { title: "Hmm… Nghĩ trước đã.", desc: "Copy-paste thì dễ. Nhưng AI sẽ khóa đáp án lại, cho đến khi bạn tự đưa ra được lập luận của riêng mình.", chips: [["Đã có", "làm mờ rồi mở khóa"]] },
  { title: "Hmm… Bạn chắc chứ?", desc: "Không có chỗ cho trích dẫn ma hay lập luận rỗng tuếch. AI đóng vai hội đồng phản biện ngay trước khi bạn nộp bài.", chips: [["Đã có", "chất vấn Socratic"], ["Sắp có", "quét nguồn"]] },
] as const;

const SceneLens: React.FC<{ t: number }> = ({ t }) => {
  const hl = sm(0.05, 0.4, t), pop = sm(0.5, 0.62, t);
  return (
    <div className="absolute inset-0 flex flex-col text-[10px] sm:text-[12px]">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2"><span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" /><span className="ml-2 rounded-full bg-white/8 px-3 py-0.5 text-white/40">baibao.minhhoa/tin-tuc</span></div>
      <div className="flex-1 px-5 py-4">
        <div className="mb-3 h-3 w-3/4 rounded bg-white/25" />
        <p className="leading-relaxed text-white/55">Trong những năm gần đây, nhiều ý kiến bàn về thói quen dùng điện thoại của học sinh. <span className="text-white" style={{ backgroundImage: "linear-gradient(rgba(124,77,255,0.6),rgba(124,77,255,0.6))", backgroundSize: `${hl * 100}% 100%`, backgroundRepeat: "no-repeat", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>Mạng xã hội đang làm giảm khả năng tập trung của người học.</span> Nhiều người cho rằng đây là điều hiển nhiên và không cần bàn thêm.</p>
        <div className="mt-3 space-y-1.5">{["w-full", "w-11/12", "w-4/5"].map((w, i) => <div key={i} className={`h-1.5 rounded bg-white/10 ${w}`} />)}</div>
      </div>
      <motion.div style={{ opacity: pop, transform: `translateY(${(1 - pop) * 14}px) scale(${0.94 + 0.06 * pop})` }} className="absolute right-3 bottom-3 w-[64%] rounded-2xl border border-white/15 bg-[#161a2c]/95 backdrop-blur p-3 shadow-2xl">
        <div className="flex items-center gap-1.5 text-[#c4b5fd] font-semibold"><Bell className="h-3.5 w-3.5" />ting · Hmm… góc nhìn khác</div>
        {["Dùng có kiểm soát có thể hỗ trợ việc học", "Nguyên nhân mất tập trung có thể nằm ở chỗ khác"].map((x, i) => (
          <div key={i} className="mt-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5"><span className="mr-1.5 rounded-full bg-[#ec4899]/25 px-1.5 py-0.5 text-[9px] text-[#f9a8d4]">Phản biện</span><span className="text-white/75">{x}</span></div>
        ))}
        <div className="mt-1.5 text-[9px] text-white/35">Minh họa</div>
      </motion.div>
    </div>
  );
};

const IDEAS = ["Mạng xã hội làm giảm tập trung vì thông báo liên tục", "Khảo sát lớp em và một nghiên cứu về chú ý", "Em chưa chắc đó là nguyên nhân duy nhất"];
const LABELS = ["Luận điểm của em?", "Em dùng dẫn chứng nào?", "Điều em chưa chắc?"];

const SceneBlur: React.FC<{ t: number }> = ({ t }) => {
  const unlock = sm(0.78, 0.92, t);
  return (
    <div className="absolute inset-0 flex flex-col gap-2.5 px-4 py-4 text-[10px] sm:text-[12px]">
      <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-md bg-[#7c4dff]/35 px-3 py-1.5 text-white/90">Viết cho tôi phần mở đầu bài luận.</div>
      <div className="relative max-w-[88%] rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.06] px-3 py-2.5">
        <div style={{ filter: `blur(${(1 - unlock) * 7}px)`, opacity: 0.6 + 0.4 * unlock }} className="space-y-1 leading-relaxed text-white/85">
          <p>Dựa trên luận điểm của em, phần mở bài có thể bắt đầu từ một tình huống quen thuộc: thông báo điện thoại cắt ngang một giờ học.</p>
          <p>Từ đó nêu câu hỏi nghiên cứu và hai hướng dẫn chứng em đã chọn.</p>
        </div>
        {unlock < 0.5 && <div className="absolute inset-0 flex items-center justify-center"><span className="inline-flex items-center gap-1 rounded-full bg-[#0b0f1c]/85 border border-white/15 px-2.5 py-1 text-white/80"><Lock className="h-3 w-3" />Khóa 70%</span></div>}
        {unlock > 0.1 && <motion.span initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.7 }} className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#6ee7b7]" />}
      </div>
      <div className="mt-auto space-y-1.5">
        {unlock > 0.3 ? <div className="flex items-center gap-1.5 text-[#6ee7b7] font-medium"><Check className="h-3.5 w-3.5" />Mở khóa thành công</div> : LABELS.map((l, i) => (
          <div key={l}><div className="text-white/45 mb-0.5">{l}</div><div className="min-h-[24px] rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-white/85">{slice(IDEAS[i], sm(0.06 + i * 0.22, 0.24 + i * 0.22, t))}</div></div>
        ))}
      </div>
    </div>
  );
};

const SceneSure: React.FC<{ t: number }> = ({ t }) => {
  const flag = sm(0.1, 0.3, t), modal = sm(0.5, 0.64, t);
  const refs = [["[1] Nghiên cứu về mạng xã hội và học tập", false], ["[2] baocao-khongtontai.org/ttt", true], ["[3] doi:10.0000/khong.ton.tai", true]] as const;
  return (
    <div className="absolute inset-0 px-5 py-4 text-[10px] sm:text-[12px]">
      <div className="mb-2 font-semibold text-white/70">Tài liệu tham khảo</div>
      <div className="space-y-1.5">
        {refs.map(([r, bad]) => (
          <div key={r} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: bad ? `rgba(244,63,94,${0.15 + 0.7 * flag})` : "rgba(255,255,255,0.1)", background: bad ? `rgba(244,63,94,${0.04 + 0.12 * flag})` : "rgba(255,255,255,0.03)" }}>
            <span className={bad ? "text-white/80 underline decoration-dotted" : "text-white/70"}>{r}</span>
            {bad && flag > 0.3 && <span className="inline-flex shrink-0 items-center gap-1 text-[#fda4af]"><TriangleAlert className="h-3 w-3" />không tìm thấy</span>}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[9px] text-white/30">Minh họa · quét nguồn: sắp có</div>
      <div style={{ opacity: modal }} className="absolute inset-0 flex items-center justify-center bg-black/55">
        <div style={{ transform: `scale(${0.92 + 0.08 * modal})` }} className="w-[78%] rounded-2xl border border-white/15 bg-[#161a2c] p-4 shadow-2xl">
          <div className="flex items-center gap-1.5 text-[#c4b5fd] font-semibold"><Sparkles className="h-3.5 w-3.5" />Hmm…</div>
          <div className="mt-1.5 text-[12px] sm:text-[14px] font-medium text-white">Bạn chứng minh luận điểm này thế nào?</div>
          <div className="mt-2.5 min-h-[28px] rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-white/85">{slice("Bằng khảo sát lớp em và một nghiên cứu về sự chú ý", sm(0.72, 0.94, t))}<span className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 bg-white/80 animate-pulse" /></div>
        </div>
      </div>
    </div>
  );
};

export const LoopHmm: React.FC = () => {
  const wrap = useRef<HTMLElement>(null);
  const [v, setV] = useState({ s: 0, t: 0 });
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!wrap.current) return;
      const r = wrap.current.getBoundingClientRect(), p = clamp(-r.top / Math.max(1, r.height - window.innerHeight)) * 2.999;
      const s = Math.floor(p), t = p - s;
      setV((o) => (o.s === s && Math.abs(o.t - t) < 0.01 ? o : { s, t }));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  const sc = SCENES[v.s];
  return (
    <section ref={wrap} id="vong-lap" className="relative" style={{ height: "430svh" }} aria-label="Vòng lặp hmm">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute top-1/3 left-1/2 w-[44rem] h-[28rem] -translate-x-1/2 rounded-full bg-[#7c4dff] opacity-[0.1] blur-[140px]" />
        <div className="relative mx-auto flex h-full max-w-[1250px] flex-col justify-center gap-6 px-5 md:flex-row md:items-center md:gap-14 md:px-12 pt-20 md:pt-0">
          <div className="md:w-[42%]">
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#a78bfa]">Vòng lặp Hmm · {v.s + 1}/3</div>
            <AnimatePresence mode="wait">
              <motion.div key={v.s} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.4 }}>
                <h2 className="mt-3 text-[clamp(1.9rem,4.4vw,3.8rem)] font-semibold tracking-[-0.035em] leading-[1.05]">{sc.title}</h2>
                <p className="mt-4 max-w-md text-[13.5px] md:text-[16px] leading-relaxed text-white/60">{sc.desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">{sc.chips.map(([st, label]) => <span key={st + label} className={`rounded-full px-3 py-1 text-[11px] font-medium ${st === "Đã có" ? "bg-[#34d399]/15 text-[#6ee7b7]" : "bg-white/10 text-white/60"}`}>{st} · {label}</span>)}</div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-6 hidden md:flex gap-2">{SCENES.map((_, i) => <span key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: i === v.s ? 36 : 14, background: i === v.s ? "#a78bfa" : "rgba(255,255,255,0.2)" }} />)}</div>
          </div>
          <div className="md:w-[58%]">
            <div className="mx-auto w-full max-w-[640px]">
              <div className="rounded-[18px] border border-white/15 bg-[#0a0d18] p-2 shadow-[0_40px_100px_-30px_rgba(124,77,255,0.6)]">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[12px] bg-[#0e1220]">
                  {v.s === 0 && <SceneLens t={v.t} />}{v.s === 1 && <SceneBlur t={v.t} />}{v.s === 2 && <SceneSure t={v.t} />}
                </div>
              </div>
              <div className="mx-auto h-2.5 w-[94%] rounded-b-[14px] bg-gradient-to-b from-white/15 to-white/5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ 3. AHA */
const AXES = [["Phản biện", 82, "#4f8cff"], ["Đào sâu", 70, "#7c4dff"], ["Kiểm chứng", 64, "#f59e0b"], ["Nội hóa", 75, "#34d399"], ["Chủ động", 79, "#ec4899"]] as const;
const C = 190, R = 128;
const pt = (i: number, f: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
const poly = (f: (i: number) => number) => AXES.map((_, i) => pt(i, f(i)).join(",")).join(" ");

export const AhaHmm: React.FC = () => (
  <section id="aha" className="relative px-5 md:px-12 py-32 md:py-48 overflow-hidden" aria-label="Khoảnh khắc Aha">
    <div className="absolute bottom-0 right-1/4 w-[36rem] h-[26rem] rounded-full bg-[#ec4899] opacity-[0.09] blur-[140px]" />
    <div className="relative max-w-[1200px] mx-auto grid md:grid-cols-2 gap-14 md:gap-24 items-center">
      <div>
        <h2 className="text-[clamp(2.4rem,6vw,5rem)] font-semibold tracking-[-0.04em] leading-[1.02]">Và rồi… <motion.span initial={{ opacity: 0, scale: 0.7 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", delay: 0.2 }} className="inline-block bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>“Aha!”</motion.span></h2>
        <p className="mt-6 max-w-md text-[15px] md:text-[17px] leading-relaxed text-white/60">Mọi nỗ lực tư duy của bạn không bị bỏ phí. Nó được số hóa thành Hồ sơ Minh bạch: minh chứng cho thấy bạn thực sự làm chủ tri thức.</p>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-white/65">{["Human", "Machine", "Mind"].map((w, i) => <React.Fragment key={w}>{i > 0 && <span className="text-white/25">·</span>}<span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1"><b className="text-white">{w[0]}</b>{w.slice(1)}</span></React.Fragment>)}<span className="ml-1 text-white/35">= hmm</span></div>
      </div>
      <div className="relative mx-auto w-full max-w-[420px]">
        <svg viewBox="0 0 380 380" className="w-full h-auto" role="img" aria-label="Biểu đồ radar 5 chiều tư duy">
          <defs><linearGradient id="aha-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4f8cff" stopOpacity="0.5" /><stop offset="1" stopColor="#ec4899" stopOpacity="0.42" /></linearGradient></defs>
          {[0.33, 0.66, 1].map((f) => <polygon key={f} points={poly(() => f)} fill="none" stroke="rgba(255,255,255,0.1)" />)}
          {AXES.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />; })}
          <motion.polygon points={poly((i) => AXES[i][1] / 100)} fill="url(#aha-fill)" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" style={{ transformOrigin: `${C}px ${C}px` }} initial={{ scale: 0.05, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1.5, ease: [0.2, 0.8, 0.2, 1] }} />
          {AXES.map(([label, val, color], i) => { const [x, y] = pt(i, val / 100), [lx, ly] = pt(i, 1.2); return (
            <g key={label}><motion.circle cx={x} cy={y} r="5" fill={color} stroke="#060914" strokeWidth="2" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.2 + i * 0.08 }} /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="rgba(255,255,255,0.65)">{label}</text></g>
          ); })}
        </svg>
        {/* the stamp lands after the radar has opened */}
        <motion.svg viewBox="0 0 120 120" className="absolute -bottom-3 -right-1 w-[116px] h-[116px] sm:w-[132px] sm:h-[132px]" initial={{ opacity: 0, scale: 2.2, rotate: -30 }} whileInView={{ opacity: 1, scale: 1, rotate: -12 }} viewport={{ once: true }} transition={{ delay: 1.9, type: "spring", stiffness: 180, damping: 14 }} aria-label="Dấu mộc: hồ sơ minh bạch">
          <defs><path id="seal-circle" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
          <circle cx="60" cy="60" r="56" fill="rgba(52,211,153,0.12)" stroke="#34d399" strokeWidth="2.5" /><circle cx="60" cy="60" r="38" fill="none" stroke="#34d399" strokeWidth="1.2" strokeDasharray="2 3" />
          <text fontSize="9" fontWeight="700" letterSpacing="2.4" fill="#6ee7b7"><textPath href="#seal-circle">HỒ SƠ MINH BẠCH · HMM · HỒ SƠ MINH BẠCH ·</textPath></text>
          <path d="M44 61 l11 11 l22 -24" fill="none" stroke="#6ee7b7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
        <div className="mt-6 text-center text-[11px] text-white/35">Minh họa</div>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------- 4. FINAL CTA */
export const FinalHmm: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <section className="relative overflow-hidden px-5 md:px-12 py-28 md:py-40 text-center" aria-label="Bắt đầu">
    <div className="absolute left-1/2 top-1/2 w-[46rem] h-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7c4dff] opacity-[0.13] blur-[140px]" />
    <div className="relative">
      <h2 className="mx-auto max-w-3xl text-[clamp(2.2rem,5.6vw,4.6rem)] font-semibold tracking-[-0.04em] leading-[1.04]">Sẵn sàng để bộ não <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>đổ mồ hôi</span> chưa?</h2>
      <div className="mt-12 flex justify-center"><HmmBorderButton onClick={onStart}>Bắt đầu thử thách</HmmBorderButton></div>
      <div className="mt-6 text-white/45 text-sm"><HmmLoader className="text-xl text-white/40" count={4} /></div>
    </div>
  </section>
);
