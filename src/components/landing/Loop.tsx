import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Check, Lock } from "lucide-react";
import { HmmLoader } from "../HmmBrand";
import { NAVY, COBALT, SKY, MUTED, MIST, GREEN, wait, reduced, Eyebrow } from "./shared";

const INK = NAVY;

/* The Hmm loop: the text on the left stays put, the product mockups scroll past on the right. */
const SCENES = [
  { kicker: "01 · Nghĩ trước, mở khóa", title: "Hmm... Think first!", body: "Bạn nêu vấn đề và luận điểm của mình trước. AI chỉ mở khoảng 30% đáp án, phần còn lại bị làm mờ cho đến khi bạn trả lời các câu hỏi giảng viên đã chuẩn bị." },
  { kicker: "02 · Trước khi nộp", title: "Hmm... Are you sure?", body: "AI hỏi ngược 3 câu dựa trên chính bài bạn làm: chỉ ra chỗ yếu về lập luận, nguồn, logic. Nếu lập luận vững, AI nói rõ như vậy. Giữ vững ý kiến có lý lẽ cũng là một câu trả lời tốt." },
  { kicker: "03 · Chế độ riêng", title: "Hmm... How about a different point of view?", body: "Mở một văn bản, bôi đen một luận điểm, bấm “Hmm… góc nhìn khác thì sao?”. AI không viết lại bài, chỉ đưa góc nhìn đối lập. Bạn phải bảo vệ luận điểm hoặc chỉnh lại câu gốc." },
] as const;

const Frame: React.FC<{ url: string; children: React.ReactNode; refEl?: React.Ref<HTMLDivElement> }> = ({ url, children, refEl }) => (
  <div ref={refEl} className="w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_30px_80px_-30px_rgba(0,78,154,0.3)]">
    <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-[#f1f6fb] px-4 py-2.5"><span className="h-2.5 w-2.5 rounded-full bg-black/15" /><span className="h-2.5 w-2.5 rounded-full bg-black/15" /><span className="h-2.5 w-2.5 rounded-full bg-black/15" /><span className="ml-3 truncate rounded-full bg-white px-3 py-0.5 text-[11px]" style={{ color: MUTED }}>{url}</span></div>
    <div className="relative min-h-[340px] p-5 sm:p-7 text-[13px] sm:text-[14px]">{children}</div>
    <div className="border-t border-black/[0.05] px-4 py-1.5 text-right text-[10px]" style={{ color: MUTED }}>Minh họa</div>
  </div>
);

const MockLens: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null), seen = useInView(ref, { amount: 0.5, once: true });
  return (
    <Frame url="traceedu.app/goc-nhin-khac" refEl={ref}>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Bài luận mẫu</div>
      <p className="leading-relaxed sm:w-[40%]" style={{ color: MUTED }}>Mạng xã hội đang làm hỏng giới trẻ. <motion.span animate={{ backgroundSize: seen ? "100% 100%" : "0% 100%" }} transition={{ duration: 1.1, delay: 0.3 }} style={{ backgroundImage: "linear-gradient(#cfe3f7,#cfe3f7)", backgroundRepeat: "no-repeat", color: INK, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>Ai dùng hơn hai giờ mỗi ngày đều bị trầm cảm.</motion.span> Vì vậy cần cấm hoàn toàn trước 18 tuổi.</p>
      <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={seen ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ delay: 1.5, type: "spring", stiffness: 320, damping: 18 }} className="mt-3 inline-block rounded-full px-4 py-1.5 text-[12px] font-semibold text-white shadow-lg" style={{ background: COBALT }}>Hmm... góc nhìn khác thì sao?</motion.div>
      <motion.div initial={{ opacity: 0, x: 40 }} animate={seen ? { opacity: 1, x: 0 } : {}} transition={{ delay: 2.3, type: "spring", stiffness: 260, damping: 24 }} className="mt-3 rounded-xl border border-black/10 bg-white p-3 shadow-xl sm:absolute sm:bottom-3 sm:right-3 sm:top-12 sm:mt-0 sm:w-[56%]">
        <div className="mb-2 text-[11px] font-semibold" style={{ color: COBALT }}>Lăng kính đối lập</div>
        <div className="rounded-lg bg-[#f1f6fb] px-2.5 py-2 text-[11.5px]" style={{ color: INK }}><div className="font-semibold">Giả định ngầm bị bỏ sót</div><div style={{ color: MUTED }}>Câu này coi tương quan là nguyên nhân: người buồn có thể dùng mạng nhiều hơn.</div></div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold"><div className="rounded-lg border px-2 py-1.5" style={{ borderColor: COBALT, color: COBALT }}>Bảo vệ luận điểm</div><div className="rounded-lg border px-2 py-1.5" style={{ borderColor: "rgba(4,27,45,0.15)", color: INK }}>Điều chỉnh câu gốc</div></div>
        <div className="mt-2 text-[10.5px]" style={{ color: MUTED }}>Chọn một để tiếp tục.</div>
      </motion.div>
    </Frame>
  );
};

const IDEAS = [["Luận điểm của bạn?", "Điện thoại làm đứt mạch tập trung"], ["Dẫn chứng nào?", "Khảo sát lớp và một nghiên cứu về sự chú ý"], ["Điều bạn chưa chắc?", "Chưa chắc đó là nguyên nhân duy nhất"]] as const;

const MockThink: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null), seen = useInView(ref, { amount: 0.6 });
  const [typed, setTyped] = useState<string[]>(["", "", ""]), [open, setOpen] = useState(false), [thinking, setThinking] = useState(false);
  useEffect(() => {
    if (!seen) { setTyped(["", "", ""]); setOpen(false); setThinking(false); return; }
    if (reduced()) { setTyped(IDEAS.map((x) => x[1])); setOpen(true); return; }
    let alive = true;
    (async () => {
      await wait(500);
      for (let i = 0; i < 3 && alive; i++) { for (let c = 1; c <= IDEAS[i][1].length && alive; c++) { setTyped((t) => t.map((v, k) => (k === i ? IDEAS[i][1].slice(0, c) : v))); await wait(22); } await wait(200); }
      await wait(250); if (!alive) return; setThinking(true); await wait(1500); if (!alive) return; setThinking(false); setOpen(true);
    })();
    return () => { alive = false; };
  }, [seen]);
  return (
    <Frame url="traceedu.app/lop/tieu-luan" refEl={ref}>
      <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-md px-3.5 py-2 text-white" style={{ background: COBALT }}>Viết giúp mình phần mở bài.</div>
      <div className="relative mt-3 max-w-[92%] rounded-2xl rounded-tl-md border border-black/10 bg-[#f1f6fb] px-3.5 py-3">
        <p className="leading-relaxed transition-[filter] duration-700" style={{ filter: open ? "blur(0)" : "blur(6px)", color: INK }}>Mở bài có thể bắt đầu từ một tình huống quen thuộc: thông báo điện thoại cắt ngang giờ học. Từ đó nêu câu hỏi nghiên cứu và hai hướng dẫn chứng bạn đã chọn.</p>
        {open && !reduced() && Array.from({ length: 14 }, (_, k) => { const ang = (k / 14) * Math.PI * 2; return <motion.span key={k} className="absolute left-1/2 top-1/2 h-3 w-5 rounded-sm" style={{ background: "rgba(66,140,212,0.35)", backdropFilter: "blur(4px)" }} initial={{ x: 0, y: 0, opacity: 0.9, rotate: 0 }} animate={{ x: Math.cos(ang) * 140, y: Math.sin(ang) * 70, opacity: 0, rotate: k * 40 }} transition={{ duration: 0.9, ease: "easeOut" }} />; })}
        {!open && thinking && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10 bg-white px-3 py-1 text-[15px] shadow" style={{ color: COBALT }}><HmmLoader count={4} label="AI đang đọc ý của bạn" /></span>}
        {!open && !thinking && <span className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] shadow" style={{ color: MUTED }}><Lock className="h-3 w-3" />Khóa 70%</span>}
      </div>
      {open ? <div className="mt-4 flex items-center gap-1.5 font-medium" style={{ color: GREEN }}><Check className="h-4 w-4" />Mở khóa rồi. Cùng đi tiếp nhé.</div> : (
        <div className="mt-4 space-y-2.5">{IDEAS.map(([label], i) => <div key={label}><div className="mb-1 text-[11px]" style={{ color: MUTED }}>{label}</div><div className="min-h-[34px] rounded-lg border bg-white px-3 py-1.5" style={{ borderColor: typed[i] ? "rgba(0,78,154,0.45)" : "rgba(0,0,0,0.12)", color: INK }}>{typed[i]}</div></div>)}</div>
      )}
    </Frame>
  );
};

const MockSure: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null), seen = useInView(ref, { amount: 0.5, once: true });
  return (
    <Frame url="traceedu.app/lop/tieu-luan · Bạn chắc chứ?" refEl={ref}>
      <div className="mb-3 flex items-center justify-between text-[11px]" style={{ color: MUTED }}><span className="font-semibold uppercase tracking-wide">Lượt 1/3</span><span>Không phải để bắt lỗi</span></div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-black/10 bg-[#f1f6fb] px-3.5 py-2.5" style={{ color: INK }}>
        <div className="mb-1 text-[11px] font-semibold" style={{ color: COBALT }}>Chưa có dẫn chứng</div>
        <div className="mb-1 text-[11.5px] italic" style={{ color: MUTED }}>Bạn đã viết: “làm giảm khả năng tập trung”</div>
        Bạn chứng minh luận điểm này thế nào?
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={seen ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1.2 }} className="ml-auto mt-3 max-w-[85%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-white" style={{ background: COBALT }}>Khảo sát lớp mình cho thấy 7/10 bạn bị ngắt mạch khi có thông báo, nên mình giữ ý kiến này.</motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={seen ? { opacity: 1, y: 0 } : {}} transition={{ delay: 2.2 }} className="mt-3 max-w-[85%] rounded-2xl rounded-tl-md border border-black/10 bg-[#f1f6fb] px-3.5 py-2.5" style={{ color: INK }}>
        <div className="mb-1 text-[11px] font-semibold" style={{ color: COBALT }}>Hỏi mở rộng</div>
        Số liệu đó đến từ đâu, và nếu mẫu khác thì kết quả còn như vậy không?
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : {}} transition={{ delay: 2.8 }} className="mt-4 text-[11.5px]" style={{ color: MUTED }}>Giữ vững ý kiến có lý lẽ cũng là một câu trả lời tốt.</motion.div>
    </Frame>
  );
};

export const Loop: React.FC = () => {
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const on = () => { const mid = window.innerHeight / 2; let best = 0, bd = Infinity; els.current.forEach((el, i) => { if (!el) return; const r = el.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = i; } }); setActive(best); };
    on(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  const mocks = [<MockThink key="a" />, <MockSure key="b" />, <MockLens key="c" />];
  return (
    <section id="vong-lap" className="relative" style={{ background: MIST }} aria-label="Vòng lặp Hmm">
      <div className="mx-auto max-w-[1200px] px-5 md:px-12 py-20 md:py-28"><div className="mb-16 md:mb-24 max-w-2xl"><Eyebrow>Vòng lặp Hmm</Eyebrow><h2 className="mt-5 text-[clamp(2rem,4.4vw,3.4rem)] font-medium tracking-[-0.04em] leading-[1.05]" style={{ color: INK }}>Ba lần dừng lại,<br />trên đường đến câu trả lời.</h2></div>
      <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
        <div className="relative hidden md:block"><div className="sticky top-[26vh]">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
              <div className="text-[12px] font-semibold tracking-wide" style={{ color: COBALT }}>{SCENES[active].kicker}</div>
              <h3 className="mt-3 text-[clamp(2rem,3.6vw,3.2rem)] font-medium tracking-[-0.04em] leading-[1.05]" style={{ color: INK }}>{SCENES[active].title}</h3>
              <p className="mt-4 max-w-sm text-[16px] leading-relaxed" style={{ color: MUTED }}>{SCENES[active].body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex gap-2">{SCENES.map((_, i) => <span key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: i === active ? 36 : 14, background: i === active ? COBALT : "rgba(0,0,0,0.15)" }} />)}</div>
        </div></div>
        <div className="space-y-20 md:space-y-[22vh]">
          {mocks.map((m, i) => (
            <div key={i} ref={(el) => { els.current[i] = el; }}>
              <div className="mb-5 md:hidden"><div className="text-[12px] font-semibold" style={{ color: COBALT }}>{SCENES[i].kicker}</div><h3 className="mt-2 text-[1.7rem] font-semibold tracking-[-0.03em] leading-[1.1]" style={{ color: INK }}>{SCENES[i].title}</h3><p className="mt-2 text-[15px] leading-relaxed" style={{ color: MUTED }}>{SCENES[i].body}</p></div>
              {m}
            </div>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
};

