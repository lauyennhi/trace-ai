import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Bell, Check, Lock, TriangleAlert } from "lucide-react";
import { HmmLoader } from "../HmmBrand";
import { NAVY, COBALT, SKY, MUTED, MIST, BRICK, GREEN, wait, reduced, Eyebrow } from "./shared";

const INK = NAVY;

/* The Hmm loop: the text on the left stays put, the product mockups scroll past on the right. */
const SCENES = [
  { kicker: "01 · Tiện ích trình duyệt", title: "Hmm... How about a different point of view?", body: "Bôi đen bất kỳ rào cản nào trên internet. Chúng tôi sẽ ném cho bạn một góc nhìn đối lập để đập tan sự phiến diện." },
  { kicker: "02 · Làm mờ để buộc nghĩ", title: "Hmm... Think first!", body: "Copy-paste thì dễ. Nhưng AI của chúng tôi sẽ khóa đáp án lại, cho đến khi bạn tự đưa ra được lập luận của riêng mình." },
  { kicker: "03 · Chất vấn Socratic & quét nguồn", title: "Hmm... Are you sure?", body: "Không có chỗ cho những trích dẫn ma hay lập luận rỗng tuếch. AI sẽ đóng vai hội đồng phản biện ngay trước khi bạn nộp bài." },
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
    <Frame url="bao-chi.minhhoa/giao-duc" refEl={ref}>
      <div className="mb-3 h-4 w-3/4 rounded bg-black/10" />
      <p className="leading-relaxed" style={{ color: MUTED }}>Nhiều ý kiến cho rằng việc học sinh dùng điện thoại là nguyên nhân chính của sự sa sút. <motion.span animate={{ backgroundSize: seen ? "100% 100%" : "0% 100%" }} transition={{ duration: 1.1, delay: 0.3 }} style={{ backgroundImage: "linear-gradient(#cfe3f7,#cfe3f7)", backgroundRepeat: "no-repeat", color: INK, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>Mạng xã hội làm giảm khả năng tập trung của người học.</motion.span> Điều này được xem là hiển nhiên và ít khi bị đặt lại câu hỏi.</p>
      <div className="mt-3 space-y-2">{["w-full", "w-11/12", "w-2/3"].map((w) => <div key={w} className={`h-2 rounded bg-black/[0.07] ${w}`} />)}</div>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.85 }} animate={seen ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ delay: 1.5, type: "spring", stiffness: 380, damping: 15 }} className="absolute right-4 bottom-4 w-[78%] max-w-[300px] rounded-xl border border-black/10 bg-white p-3.5 shadow-xl">
        <motion.span initial={{ opacity: 0, scale: 0.4 }} animate={seen ? { opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 0.9], y: [0, -6, -10, -16] } : {}} transition={{ delay: 1.5, duration: 1.4 }} className="absolute -top-4 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: SKY }}><Bell className="h-3 w-3" />ting!</motion.span>
        <div className="text-[12px] font-semibold" style={{ color: COBALT }}>Hmm… góc nhìn khác</div>
        {["Dùng có kiểm soát có thể hỗ trợ việc học", "Mất tập trung còn do nhiều nguyên nhân khác"].map((t) => <div key={t} className="mt-2 rounded-lg bg-[#f1f6fb] px-2.5 py-2 text-[12px]" style={{ color: INK }}><span className="mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "rgba(194,80,63,0.12)", color: BRICK }}>Phản biện</span>{t}</div>)}
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
  const refs = [["[1] Nghiên cứu về mạng xã hội và học tập, 2021", false], ["[2] baocao-khongtontai.org/tt-2023", true], ["[3] doi:10.0000/khong.ton.tai", true]] as const;
  return (
    <Frame url="tai-lieu/tieu-luan.doc" refEl={ref}>
      <div className="mb-2 text-[15px] font-semibold" style={{ color: INK }}>Tài liệu tham khảo</div>
      <div className="space-y-2">
        {refs.map(([r, bad]) => (
          <motion.div key={r} animate={bad && seen ? { backgroundColor: ["rgba(194,80,63,0)", "rgba(194,80,63,0.16)", "rgba(194,80,63,0.07)", "rgba(194,80,63,0.16)"] } : {}} transition={{ duration: 1.6, delay: 0.6, times: [0, 0.3, 0.6, 1], repeat: Infinity, repeatType: "reverse" }} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: bad && seen ? "rgba(194,80,63,0.55)" : "rgba(0,0,0,0.1)", color: INK }}>
            <span className={bad ? "underline decoration-dotted" : ""}>{r}</span>
            {bad && seen && <span className="inline-flex shrink-0 items-center gap-1 text-[11px]" style={{ color: BRICK }}><TriangleAlert className="h-3 w-3" />không tìm thấy</span>}
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={seen ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 1.8, duration: 0.4 }} className="absolute inset-x-6 bottom-5 rounded-xl border border-black/10 bg-white p-4 shadow-2xl">
        <div className="text-[12px] font-semibold" style={{ color: COBALT }}>Hmm…</div>
        <div className="mt-1 text-[16px] font-semibold" style={{ color: INK }}>Bạn chứng minh luận điểm này thế nào?</div>
        <div className="mt-2 rounded-lg border border-black/10 bg-[#f1f6fb] px-3 py-1.5 text-[12px]" style={{ color: MUTED }}>Nhập dẫn chứng của bạn…</div>
      </motion.div>
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

