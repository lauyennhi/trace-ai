import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { ArrowRight, Check, Lock, Search, TriangleAlert } from "lucide-react";
import { HmmLoader } from "./HmmBrand";

/** Landing page, light "academic minimalist" version: hero · sticky hmm loop · aha · about + trust · final CTA. */
export const INK = "#1f2328", MUTED = "#5b6470", COBALT = "#0b57d0", LAV = "#8b7cf6", BRICK = "#c2503f";
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
type Role = "student" | "teacher";

/* ------------------------------------------------ thin ribbon: one hairline that runs down the whole page */
export const ThinRibbon: React.FC = () => {
  const path = useRef<SVGPathElement>(null);
  const d = (() => { let s = "M50 0"; for (let i = 0; i < 12; i++) { const y = i * 100, x = i % 2 ? 14 : 86; s += ` C ${x} ${y + 25}, ${x} ${y + 75}, 50 ${y + 100}`; } return s; })();
  useEffect(() => {
    const on = () => { const m = document.documentElement.scrollHeight - window.innerHeight; if (path.current) path.current.style.strokeDashoffset = String(1 - (m > 0 ? window.scrollY / m : 0)); };
    on(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox="0 0 100 1200" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="thin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={COBALT} /><stop offset="1" stopColor={LAV} /></linearGradient></defs>
      <path d={d} fill="none" stroke={LAV} strokeOpacity="0.12" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path ref={path} d={d} pathLength={1} fill="none" stroke="url(#thin)" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray="1" strokeDashoffset="1" />
    </svg>
  );
};

/* ------------------------------------------------------------------ 1. HERO */
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
      <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-6 py-4 shadow-[0_10px_40px_-12px_rgba(11,87,208,0.25)]">
        <Search className="h-5 w-5 shrink-0" style={{ color: MUTED }} />
        <div className="min-h-[1.6em] flex-1 truncate text-left text-[15px] sm:text-[18px]" style={{ color: INK }}>{text}<span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.18em] animate-pulse" style={{ background: COBALT }} /></div>
        <AnimatePresence>
          {hmm && <motion.span initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} className="shrink-0 rounded-full px-4 py-1.5 text-[18px]" style={{ background: "rgba(139,124,246,0.14)", color: LAV }}><HmmLoader count={5} label="hmm" /></motion.span>}
        </AnimatePresence>
      </div>
      <div className="mt-3 h-5 text-[13px]" style={{ color: MUTED }}>{hmm && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Hmm đang giữ đáp án lại. Bạn nói ý mình trước đã.</motion.span>}</div>
    </div>
  );
};

export const CtaPair: React.FC<{ onPick: (r: Role) => void }> = ({ onPick }) => (
  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
    <button onClick={() => onPick("student")} className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-110" style={{ background: COBALT }}>Tôi là sinh viên <ArrowRight className="h-4 w-4" /></button>
    <button onClick={() => onPick("teacher")} className="rounded-full border px-7 py-3.5 text-[15px] font-semibold transition hover:bg-black/[0.04]" style={{ borderColor: "rgba(0,0,0,0.18)", color: INK }}>Tôi là giảng viên</button>
  </div>
);

export const HeroLight: React.FC<{ onPick: (r: Role) => void }> = ({ onPick }) => (
  <section id="top" className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-5 pt-28 pb-20 text-center" aria-label="Giới thiệu hmm">
    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="font-semibold tracking-[-0.045em] leading-[0.98] text-[clamp(2.7rem,8vw,6.6rem)]" style={{ color: INK }}>Đừng để AI <span style={{ color: COBALT }}>nghĩ thay.</span></motion.h1>
    <p className="mt-6 max-w-xl text-[15px] sm:text-[18px] leading-relaxed" style={{ color: MUTED }}>Hmm cố tình làm chậm bạn một nhịp: dừng lại, trăn trở, rồi tự tìm ra câu trả lời. Đáp án đến sau, và là của bạn.</p>
    <div className="mt-12 flex w-full justify-center"><PromptBar /></div>
    <div className="mt-8"><CtaPair onPick={onPick} /></div>
  </section>
);

/* ------------------------------------------------ 2. LOOP: sticky text on the left, mockups scroll on the right */
const SCENES = [
  { kicker: "01 · Góc nhìn đối lập", title: "Hmm… Góc nhìn khác thì sao?", body: "Bôi đen một đoạn trên bất kỳ trang nào. Hmm đặt cạnh nó một góc nhìn ngược lại, để bạn bớt nghe mỗi một phía." },
  { kicker: "02 · Ma sát nhận thức", title: "Hmm… Nghĩ trước đã.", body: "Dán thì dễ. Nhưng câu trả lời bị làm mờ cho đến khi bạn tự nêu được lập luận của mình." },
  { kicker: "03 · Chất vấn Socratic", title: "Hmm… Bạn chắc chứ?", body: "Nguồn không có thật, lập luận còn lỏng: Hmm hỏi lại ngay trước khi bạn nộp, như một hội đồng phản biện nhỏ." },
] as const;

const Frame: React.FC<{ url: string; children: React.ReactNode; refEl?: React.Ref<HTMLDivElement> }> = ({ url, children, refEl }) => (
  <div ref={refEl} className="w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_30px_80px_-30px_rgba(11,87,208,0.3)]">
    <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-[#f6f7f9] px-4 py-2.5"><span className="h-2.5 w-2.5 rounded-full bg-black/15" /><span className="h-2.5 w-2.5 rounded-full bg-black/15" /><span className="h-2.5 w-2.5 rounded-full bg-black/15" /><span className="ml-3 truncate rounded-full bg-white px-3 py-0.5 text-[11px]" style={{ color: MUTED }}>{url}</span></div>
    <div className="relative min-h-[340px] p-5 sm:p-7 text-[13px] sm:text-[14px]">{children}</div>
    <div className="border-t border-black/[0.05] px-4 py-1.5 text-right text-[10px]" style={{ color: MUTED }}>Minh họa</div>
  </div>
);

const MockLens: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null), seen = useInView(ref, { amount: 0.5, once: true });
  return (
    <Frame url="bao-chi.minhhoa/giao-duc" refEl={ref}>
      <div className="mb-3 h-4 w-3/4 rounded bg-black/10" />
      <p className="leading-relaxed" style={{ color: MUTED }}>Nhiều ý kiến cho rằng việc học sinh dùng điện thoại là nguyên nhân chính của sự sa sút. <motion.span animate={{ backgroundSize: seen ? "100% 100%" : "0% 100%" }} transition={{ duration: 1.1, delay: 0.3 }} style={{ backgroundImage: "linear-gradient(#ddd6fe,#ddd6fe)", backgroundRepeat: "no-repeat", color: INK, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>Mạng xã hội làm giảm khả năng tập trung của người học.</motion.span> Điều này được xem là hiển nhiên và ít khi bị đặt lại câu hỏi.</p>
      <div className="mt-3 space-y-2">{["w-full", "w-11/12", "w-2/3"].map((w) => <div key={w} className={`h-2 rounded bg-black/[0.07] ${w}`} />)}</div>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={seen ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1.5, duration: 0.5 }} className="absolute right-4 bottom-4 w-[78%] max-w-[300px] rounded-xl border border-black/10 bg-white p-3.5 shadow-xl">
        <div className="text-[12px] font-semibold" style={{ color: LAV }}>Hmm… góc nhìn khác</div>
        {["Dùng có kiểm soát có thể hỗ trợ việc học", "Mất tập trung còn do nhiều nguyên nhân khác"].map((t) => <div key={t} className="mt-2 rounded-lg bg-[#f6f7f9] px-2.5 py-2 text-[12px]" style={{ color: INK }}><span className="mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "rgba(194,80,63,0.12)", color: BRICK }}>Phản biện</span>{t}</div>)}
      </motion.div>
    </Frame>
  );
};

const IDEAS = [["Luận điểm của bạn?", "Điện thoại làm đứt mạch tập trung"], ["Dẫn chứng nào?", "Khảo sát lớp và một nghiên cứu về sự chú ý"], ["Điều bạn chưa chắc?", "Chưa chắc đó là nguyên nhân duy nhất"]] as const;

const MockThink: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null), seen = useInView(ref, { amount: 0.6 });
  const [typed, setTyped] = useState<string[]>(["", "", ""]), [open, setOpen] = useState(false);
  useEffect(() => {
    if (!seen) { setTyped(["", "", ""]); setOpen(false); return; }
    if (reduced()) { setTyped(IDEAS.map((x) => x[1])); setOpen(true); return; }
    let alive = true;
    (async () => {
      await wait(500);
      for (let i = 0; i < 3 && alive; i++) { for (let c = 1; c <= IDEAS[i][1].length && alive; c++) { setTyped((t) => t.map((v, k) => (k === i ? IDEAS[i][1].slice(0, c) : v))); await wait(22); } await wait(200); }
      await wait(350); if (alive) setOpen(true);
    })();
    return () => { alive = false; };
  }, [seen]);
  return (
    <Frame url="hmm.app/lop/tieu-luan" refEl={ref}>
      <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-md px-3.5 py-2 text-white" style={{ background: COBALT }}>Viết giúp mình phần mở bài.</div>
      <div className="relative mt-3 max-w-[92%] rounded-2xl rounded-tl-md border border-black/10 bg-[#f6f7f9] px-3.5 py-3">
        <p className="leading-relaxed transition-[filter] duration-700" style={{ filter: open ? "blur(0)" : "blur(6px)", color: INK }}>Mở bài có thể bắt đầu từ một tình huống quen thuộc: thông báo điện thoại cắt ngang giờ học. Từ đó nêu câu hỏi nghiên cứu và hai hướng dẫn chứng bạn đã chọn.</p>
        {!open && <span className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] shadow" style={{ color: MUTED }}><Lock className="h-3 w-3" />Khóa 70%</span>}
      </div>
      {open ? <div className="mt-4 flex items-center gap-1.5 font-medium" style={{ color: "#1a7f4b" }}><Check className="h-4 w-4" />Mở khóa rồi. Cùng đi tiếp nhé.</div> : (
        <div className="mt-4 space-y-2.5">{IDEAS.map(([label], i) => <div key={label}><div className="mb-1 text-[11px]" style={{ color: MUTED }}>{label}</div><div className="min-h-[34px] rounded-lg border bg-white px-3 py-1.5" style={{ borderColor: typed[i] ? "rgba(11,87,208,0.45)" : "rgba(0,0,0,0.12)", color: INK }}>{typed[i]}</div></div>)}</div>
      )}
    </Frame>
  );
};

const MockSure: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null), seen = useInView(ref, { amount: 0.5, once: true });
  const refs = [["[1] Nghiên cứu về mạng xã hội và học tập, 2021", false], ["[2] baocao-khongtontai.org/tt-2023", true], ["[3] doi:10.0000/khong.ton.tai", true]] as const;
  return (
    <Frame url="tai-lieu/tieu-luan.doc" refEl={ref}>
      <div className="mb-2 text-[15px] font-semibold" style={{ color: INK }}>Tài liệu tham khảo</div>
      <div className="space-y-2">
        {refs.map(([r, bad]) => (
          <motion.div key={r} animate={bad && seen ? { backgroundColor: ["rgba(194,80,63,0)", "rgba(194,80,63,0.16)", "rgba(194,80,63,0.07)", "rgba(194,80,63,0.16)"] } : {}} transition={{ duration: 2, delay: 0.6, times: [0, 0.3, 0.6, 1] }} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: bad && seen ? "rgba(194,80,63,0.55)" : "rgba(0,0,0,0.1)", color: INK }}>
            <span className={bad ? "underline decoration-dotted" : ""}>{r}</span>
            {bad && seen && <span className="inline-flex shrink-0 items-center gap-1 text-[11px]" style={{ color: BRICK }}><TriangleAlert className="h-3 w-3" />không tìm thấy</span>}
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={seen ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 1.8, duration: 0.4 }} className="absolute inset-x-6 bottom-5 rounded-xl border border-black/10 bg-white p-4 shadow-2xl">
        <div className="text-[12px] font-semibold" style={{ color: LAV }}>Hmm…</div>
        <div className="mt-1 text-[16px] font-semibold" style={{ color: INK }}>Lấy gì làm chứng?</div>
        <div className="mt-2 rounded-lg border border-black/10 bg-[#f6f7f9] px-3 py-1.5 text-[12px]" style={{ color: MUTED }}>Bạn chứng minh luận điểm này bằng gì?</div>
      </motion.div>
    </Frame>
  );
};

export const LoopLight: React.FC = () => {
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const on = () => { const mid = window.innerHeight / 2; let best = 0, bd = Infinity; els.current.forEach((el, i) => { if (!el) return; const r = el.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = i; } }); setActive(best); };
    on(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  const mocks = [<MockLens key="a" />, <MockThink key="b" />, <MockSure key="c" />];
  return (
    <section id="vong-lap" className="relative z-10 mx-auto max-w-[1200px] px-5 md:px-12 py-20 md:py-28" aria-label="Vòng lặp Hmm">
      <div className="mb-16 md:mb-24 max-w-2xl"><div className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: COBALT }}>Vòng lặp Hmm</div><h2 className="mt-3 text-[clamp(1.8rem,4vw,3rem)] font-semibold tracking-[-0.035em] leading-[1.08]" style={{ color: INK }}>Ba lần dừng lại, trên đường đến câu trả lời.</h2></div>
      <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
        <div className="relative hidden md:block"><div className="sticky top-[26vh]">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
              <div className="text-[12px] font-semibold tracking-wide" style={{ color: LAV }}>{SCENES[active].kicker}</div>
              <h3 className="mt-3 text-[clamp(2rem,3.6vw,3.2rem)] font-semibold tracking-[-0.035em] leading-[1.05]" style={{ color: INK }}>{SCENES[active].title}</h3>
              <p className="mt-4 max-w-sm text-[16px] leading-relaxed" style={{ color: MUTED }}>{SCENES[active].body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex gap-2">{SCENES.map((_, i) => <span key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: i === active ? 36 : 14, background: i === active ? COBALT : "rgba(0,0,0,0.15)" }} />)}</div>
        </div></div>
        <div className="space-y-20 md:space-y-[22vh]">
          {mocks.map((m, i) => (
            <div key={i} ref={(el) => { els.current[i] = el; }}>
              <div className="mb-5 md:hidden"><div className="text-[12px] font-semibold" style={{ color: LAV }}>{SCENES[i].kicker}</div><h3 className="mt-2 text-[1.7rem] font-semibold tracking-[-0.03em] leading-[1.1]" style={{ color: INK }}>{SCENES[i].title}</h3><p className="mt-2 text-[15px] leading-relaxed" style={{ color: MUTED }}>{SCENES[i].body}</p></div>
              {m}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ 3. AHA */
const AXES = [["Phản biện", 82], ["Đào sâu", 70], ["Kiểm chứng", 64], ["Nội hóa", 75], ["Chủ động", 79]] as const;
const C = 150, R = 100;
const pt = (i: number, f: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
const poly = (f: (i: number) => number) => AXES.map((_, i) => pt(i, f(i)).join(",")).join(" ");

export const AhaLight: React.FC = () => (
  <section id="aha" className="relative z-10 px-5 md:px-12 py-24 md:py-36 text-center" aria-label="Khoảnh khắc Aha">
    <div className="mx-auto max-w-3xl">
      <h2 className="text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold tracking-[-0.04em] leading-[1.04]" style={{ color: INK }}>Định giá lại tư duy.<br />Từ Hmm đến <span style={{ color: COBALT }}>Aha!</span></h2>
      <p className="mx-auto mt-6 max-w-xl text-[16px] md:text-[18px] leading-relaxed" style={{ color: MUTED }}>Điểm cuối cùng chỉ nói được bạn đã đến đâu. Hmm còn ghi lại bạn đã đi thế nào: mỗi lần nghi ngờ, mỗi lần viết ra ý mình, mỗi lần bị hỏi ngược.</p>
    </div>
    <div className="mx-auto mt-14 max-w-4xl rounded-3xl border border-black/10 bg-white p-5 sm:p-8 text-left shadow-[0_40px_100px_-40px_rgba(11,87,208,0.35)]">
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
        <div><div className="text-[12px]" style={{ color: MUTED }}>Hồ sơ tư duy</div><div className="text-[17px] font-semibold" style={{ color: INK }}>Tiểu luận: Mạng xã hội và việc học</div></div>
        <motion.div initial={{ opacity: 0, scale: 2, rotate: -14 }} whileInView={{ opacity: 1, scale: 1, rotate: -6 }} viewport={{ once: true }} transition={{ delay: 1.4, type: "spring", stiffness: 200, damping: 14 }} className="rounded-lg border-2 px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] uppercase" style={{ borderColor: "#1a7f4b", color: "#1a7f4b" }}>Hồ sơ minh bạch · Hmm</motion.div>
      </div>
      <div className="mt-6 grid items-center gap-8 md:grid-cols-[1fr_1fr]">
        <svg viewBox="0 0 300 300" className="mx-auto w-full max-w-[340px]" role="img" aria-label="Biểu đồ radar 5 tiêu chí tư duy">
          {[0.33, 0.66, 1].map((f) => <polygon key={f} points={poly(() => f)} fill="none" stroke="rgba(0,0,0,0.1)" />)}
          {AXES.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(0,0,0,0.08)" />; })}
          <motion.polygon points={poly((i) => AXES[i][1] / 100)} fill="rgba(11,87,208,0.18)" stroke={COBALT} strokeWidth="2" strokeLinejoin="round" style={{ transformOrigin: `${C}px ${C}px` }} initial={{ scale: 0.05, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 1.3, ease: [0.2, 0.8, 0.2, 1] }} />
          {AXES.map(([label, v], i) => { const [x, y] = pt(i, v / 100), [lx, ly] = pt(i, 1.22); return <g key={label}><circle cx={x} cy={y} r="4" fill={COBALT} /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill={MUTED}>{label}</text></g>; })}
        </svg>
        <div className="space-y-3">
          {[["Ý tự viết trước khi mở khóa", "3 / 3"], ["Câu hỏi ngược đã trả lời", "4"], ["Nguồn đã kiểm", "5 / 6"]].map(([k, v]) => <div key={k} className="flex items-center justify-between rounded-xl bg-[#f6f7f9] px-4 py-3"><span className="text-[14px]" style={{ color: MUTED }}>{k}</span><span className="text-[18px] font-semibold tabular-nums" style={{ color: INK }}>{v}</span></div>)}
          <svg viewBox="0 0 200 40" className="w-full" aria-hidden="true"><path d="M0 30 C 20 6, 30 6, 50 24 S 80 36, 100 18 S 140 2, 160 12 S 190 8, 200 4" fill="none" stroke={LAV} strokeWidth="1.5" strokeLinecap="round" /></svg>
          <div className="text-[11px]" style={{ color: MUTED }}>Đường tư duy theo thời gian · Minh họa</div>
        </div>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------- 4. ABOUT + TRUST */
const ABOUT = [
  ["Với người học", "Đi chậm lại một nhịp. Hiểu được thì mới là của mình, còn chép được thì chỉ là mượn."],
  ["Với thầy cô", "Thấy bài làm đã hình thành ra sao, không chỉ cái kết quả nộp lên cuối cùng."],
  ["Với nhà trường", "Một cách dùng AI mà điểm số vẫn còn đáng tin."],
] as const;

export const AboutLight: React.FC = () => (
  <section id="about" className="relative z-10" aria-label="Về Hmm">
    <div className="mx-auto max-w-[1100px] px-5 md:px-12 py-24 md:py-36">
      <div className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: COBALT }}>About Hmm</div>
      <h2 className="mt-5 max-w-4xl text-[clamp(2rem,4.8vw,4rem)] font-semibold tracking-[-0.04em] leading-[1.06]" style={{ color: INK }}>AI đã trả lời được gần như mọi thứ. Việc còn lại của người học là <span style={{ color: COBALT }}>tự hỏi, tự ngờ, tự hiểu.</span></h2>
      <p className="mt-7 max-w-2xl text-[16px] md:text-[19px] leading-relaxed" style={{ color: MUTED }}>Hmm là chỗ học có AI ngồi cạnh, nhưng AI không nói trước. Nó chờ bạn nói ra ý mình, hỏi ngược khi bạn dễ dãi, và lặng lẽ giữ lại từng bước bạn đã nghĩ.</p>
      <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-black/10 bg-black/10 md:grid-cols-3">
        {ABOUT.map(([t, d]) => <div key={t} className="bg-white p-7 md:p-9"><div className="text-[13px] font-semibold" style={{ color: COBALT }}>{t}</div><p className="mt-3 text-[15px] leading-relaxed" style={{ color: MUTED }}>{d}</p></div>)}
      </div>
      <p className="mt-12 max-w-2xl text-[clamp(1.2rem,2.3vw,1.7rem)] font-medium leading-snug tracking-[-0.02em]" style={{ color: INK }}>“Hmm…” là tiếng một người đang nghĩ. Chúng mình làm ra một chỗ để tiếng ấy còn được lắng nghe.</p>
    </div>
    <div className="border-y border-black/[0.07] bg-[#f3f4f7] px-5 py-8 text-center">
      <p className="mx-auto max-w-3xl text-[13px] md:text-[14px] leading-relaxed" style={{ color: MUTED }}>Hmm đặt câu hỏi theo tinh thần chất vấn của Socrates, và đo quá trình nghĩ qua <b style={{ color: INK }}>Process Score</b>: 5 tiêu chí, mỗi điểm kèm đoạn trao đổi làm bằng chứng. Giảng viên đọc bằng chứng và là người quyết định điểm cuối.</p>
    </div>
  </section>
);

/* ------------------------------------------------------------ 5. FINAL CTA */
export const FinalLight: React.FC<{ onPick: (r: Role) => void; onLogin: () => void; onContact: () => void }> = ({ onPick, onLogin, onContact }) => (
  <>
    <section className="relative z-10 px-5 md:px-12 py-28 md:py-40 text-center" aria-label="Bắt đầu">
      <h2 className="mx-auto max-w-3xl text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold tracking-[-0.04em] leading-[1.04]" style={{ color: INK }}>Sẵn sàng để bộ não <span style={{ color: COBALT }}>đổ mồ hôi</span> chưa?</h2>
      <div className="mt-10"><CtaPair onPick={onPick} /></div>
    </section>
    <footer className="relative z-10 border-t border-black/[0.07] bg-white px-5 md:px-12 py-8 text-[13px]" style={{ color: MUTED }}>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
        <span>hmm · Human · Machine · Mind</span>
        <nav className="flex flex-wrap gap-5" aria-label="Chân trang">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-black">Home</button>
          <button onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-black">About Hmm</button>
          <button onClick={onContact} className="hover:text-black">Contact</button>
          <button onClick={onLogin} className="hover:text-black">Đăng nhập</button>
        </nav>
        <span className="text-[12px]">Hình minh họa trên trang này không phải số liệu thật.</span>
      </div>
    </footer>
  </>
);
