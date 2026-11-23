import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Check, Lock } from "lucide-react";
import { HmmLoader } from "../HmmBrand";
import { NAVY, COBALT, SKY, MUTED, MIST, GREEN, wait, reduced, Eyebrow } from "./shared";

const INK = NAVY;

/* The Hmm loop: the text on the left stays put, the product mockups scroll past on the right. */
const SCENES = [
  { kicker: "01 · Góc nhìn khác", title: "Hmm... How about a different point of view?", body: "Bôi đen một đoạn trong bài của bạn. Nói ý của bạn trước, rồi Hmm đưa ra hai góc nhìn khác để bạn nghĩ lại và sửa chính đoạn đó." },
  { kicker: "02 · Làm mờ để buộc nghĩ", title: "Hmm... Think first!", body: "Copy-paste thì dễ. Nhưng AI của chúng tôi sẽ khóa đáp án lại, cho đến khi bạn tự đưa ra được lập luận của riêng mình." },
  { kicker: "03 · Chất vấn", title: "Hmm... Are you sure?", body: "AI đóng vai người phản biện thân thiện: chỉ hỏi điểm yếu có thật, và nếu lập luận của bạn vững thì nói rõ như vậy. Giữ vững ý kiến có lý lẽ cũng là một câu trả lời tốt." },
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
    <Frame url="traceedu.app/lop/tieu-luan · Góc nhìn khác" refEl={ref}>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Bản nháp của bạn</div>
      <p className="leading-relaxed" style={{ color: MUTED }}>Việc học sinh dùng điện thoại đang làm giảm chất lượng học tập. <motion.span animate={{ backgroundSize: seen ? "100% 100%" : "0% 100%" }} transition={{ duration: 1.1, delay: 0.3 }} style={{ backgroundImage: "linear-gradient(#cfe3f7,#cfe3f7)", backgroundRepeat: "no-repeat", color: INK, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>Mạng xã hội làm giảm khả năng tập trung của người học.</motion.span> Vì vậy nhà trường nên hạn chế thiết bị cá nhân trong lớp.</p>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={seen ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1.3 }} className="mt-4 rounded-xl border border-black/10 bg-[#f1f6fb] p-3 text-[12px]" style={{ color: INK }}>
        <div className="mb-1 text-[11px] font-semibold" style={{ color: COBALT }}>Hmm… Bạn nghĩ gì về đoạn này?</div>Mình thấy đúng một phần, nhưng còn nhiều yếu tố khác.
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.9 }} animate={seen ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ delay: 2.1, type: "spring", stiffness: 320, damping: 16 }} className="absolute inset-x-4 bottom-4 rounded-xl border border-black/10 bg-white p-3 shadow-xl">
        <div className="mb-2 text-[12px] font-semibold" style={{ color: COBALT }}>Hai góc nhìn khác</div>
        <div className="grid gap-2 sm:grid-cols-2">{[["Dùng có kiểm soát", "Điện thoại có thể là công cụ học nếu có quy tắc rõ."], ["Nguyên nhân nằm ở nơi khác", "Mất tập trung còn do giấc ngủ và cách tổ chức lớp."]].map(([h, t]) => <div key={h} className="rounded-lg bg-[#f1f6fb] px-2.5 py-2 text-[11.5px]" style={{ color: INK }}><div className="font-semibold">{h}</div><div style={{ color: MUTED }}>{t}</div></div>)}</div>
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
  const mocks = [<MockLens key="a" />, <MockThink key="b" />, <MockSure key="c" />];
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

