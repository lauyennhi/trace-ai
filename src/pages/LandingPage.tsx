import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, PenLine, Eye, Unlock, Route, GraduationCap, BookOpen, ShieldCheck, CheckCircle2, Menu, X, Sparkles, UserRound } from "lucide-react";
import { GlassHead } from "../components/GlassHead";

interface Props { onLogin: () => void; onRegister: () => void; }

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
const GRAD = "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)";
const GLASS = "bg-[#0b0f1c]/70 backdrop-blur-xl border border-white/10";
const NAV = [["Trang chủ", "top"], ["Cách hoạt động", "cach-hoat-dong"], ["Dữ liệu", "du-lieu"]] as const;
const BADGE_ICONS = [BookOpen, GraduationCap, Sparkles, ShieldCheck];
const TRI = [[15, 0], [10, 5], [15, 5], [5, 10], [10, 10], [15, 10], [0, 15], [5, 15], [10, 15]];

/** Full-screen hero: a pastel sky, a glass head with a red brain turning on its own, liquid-glass UI on top. */
const Hero: React.FC<Props> = ({ onLogin, onRegister }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = menuOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [menuOpen]);
  const go = (id: string) => { setMenuOpen(false); if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" }); else scrollTo(id); };

  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden text-white" style={{ fontFamily: "Inter, 'Be Vietnam Pro', system-ui, sans-serif", background: "radial-gradient(70% 55% at 50% -5%, #f7c9e6 0%, rgba(247,201,230,0) 70%), radial-gradient(60% 60% at 85% 95%, #8fa9f5 0%, rgba(143,169,245,0) 70%), linear-gradient(180deg, #c3b9f2 0%, #a9b2f6 55%, #94a8f4 100%)" }} aria-label="Giới thiệu Trace">
      <div className="absolute left-0 right-0 top-[27%] h-px bg-white/40 pointer-events-none" aria-hidden="true" />
      <div className="absolute top-0 bottom-0 left-[70%] w-px bg-white/40 pointer-events-none hidden md:block" aria-hidden="true" />
      <GlassHead className="absolute inset-0 pointer-events-none" />

      <div className="relative z-20 flex items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8 md:px-16 lg:px-20">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 md:h-9 md:w-9 rounded-full flex items-center justify-center" style={{ background: GRAD }}><Sparkles className="h-4 w-4 text-white" /></span>
          <span className="text-lg font-medium tracking-tight">Trace<span className="text-[#ec4899]">.</span></span>
        </div>
        <nav aria-label="Trang chủ" className="liquid-glass hidden md:flex items-center gap-8 rounded-full px-8 py-3">
          {NAV.map(([label, id], i) => <button key={id} onClick={() => go(id)} className={`text-sm font-medium ${i === 0 ? "text-white" : "text-white/70 hover:text-white"} transition-colors`}>{label}</button>)}
        </nav>
        <div className="hidden md:flex items-center gap-2.5">
          <button onClick={onLogin} className="liquid-glass rounded-full px-5 py-2.5 text-sm font-medium text-white transition duration-300 hover:bg-white/10">Đăng nhập</button>
          <button onClick={onRegister} className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110" style={{ background: GRAD }}>Đăng ký</button>
        </div>
        <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen} className="liquid-glass relative z-50 flex h-10 w-10 items-center justify-center rounded-full md:hidden">
          <Menu className={`absolute h-5 w-5 text-white transition-all duration-300 ${menuOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} strokeWidth={1.5} />
          <X className={`absolute h-5 w-5 text-white transition-all duration-300 ${menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} strokeWidth={1.5} />
        </button>
      </div>

      <div className={`fixed inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-xl transition-opacity duration-500 ease-out md:hidden ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!menuOpen}>
        <div className={`flex flex-col items-center gap-8 transition-transform duration-500 ease-out ${menuOpen ? "translate-y-0" : "-translate-y-8"}`}>
          {NAV.map(([label, id], i) => <button key={id} onClick={() => go(id)} className={`text-2xl font-medium ${i === 0 ? "text-white" : "text-white/70"}`}>{label}</button>)}
          <div className="flex items-center gap-3">
            <button onClick={() => { setMenuOpen(false); onLogin(); }} className="liquid-glass rounded-full px-6 py-3 text-sm font-medium text-white">Đăng nhập</button>
            <button onClick={() => { setMenuOpen(false); onRegister(); }} className="rounded-full px-6 py-3 text-sm font-semibold text-white" style={{ background: GRAD }}>Đăng ký</button>
          </div>
          <div className="flex items-center gap-3"><span className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full"><UserRound className="h-5 w-5 text-white/80" strokeWidth={1.5} /></span><span className="text-sm font-light text-white/60">Tài khoản</span></div>
        </div>
      </div>

      <div className={`relative z-10 flex min-h-[calc(100svh-4.5rem)] flex-col justify-between px-5 pb-8 sm:px-8 sm:pb-10 md:px-16 lg:px-20 transition-opacity duration-300 ${menuOpen ? "pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100" : ""}`}>
        <div className="mt-14 max-w-2xl sm:mt-20 md:mt-28">
          <div className="liquid-glass mb-5 inline-flex items-center gap-2.5 rounded-full px-3 py-1.5 sm:mb-6 sm:gap-3 sm:px-4 sm:py-2">
            <div className="flex -space-x-2">
              {BADGE_ICONS.map((I, i) => <span key={i} className="liquid-glass flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border-2 border-white/20"><I className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white/90" strokeWidth={1.75} /></span>)}
            </div>
            <span className="text-xs font-light text-white/80 sm:text-sm">đọc vị tư duy cùng AI</span>
          </div>
          <h1 className="text-4xl font-normal leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-7xl" style={{ letterSpacing: "-0.05em", textShadow: "0 2px 24px rgba(70,50,170,0.35)" }}>
            Less <span className="relative inline-block text-white/60">paste<span className="absolute left-[-2%] right-[-2%] top-[56%] h-[0.06em] rounded-full bg-[#f43f5e]" /></span>,<br />more Trace.
          </h1>
          <p className="mt-4 text-sm font-light text-white/90 sm:mt-5 sm:text-base md:text-lg">Đọc vị từng dấu vết tư duy từ chính cuộc trò chuyện với AI.</p>
          <button onClick={onRegister} className="liquid-glass mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white transition duration-300 hover:bg-white/10 sm:mt-8 sm:px-7 sm:py-3.5">Bắt đầu với Trace <ArrowRight className="h-4 w-4" /></button>
        </div>

        <div className="mt-10 flex items-end gap-6 sm:gap-10 md:gap-16">
          <div className="flex items-end gap-3 sm:gap-4">
            <div className="relative h-5 w-5 shrink-0 mb-1.5" aria-hidden="true">{TRI.map(([x, y], i) => <span key={i} className="absolute h-[2.5px] w-[2.5px] bg-white/60" style={{ left: x, top: y }} />)}</div>
            <div><div className="text-xl font-normal text-white sm:text-2xl md:text-3xl">5 tiêu chí</div><div className="text-xs font-light text-white/85 sm:text-sm">Chấm quá trình tư duy</div></div>
          </div>
          <div className="flex items-end gap-3 sm:gap-4">
            <div className="grid grid-cols-3 gap-[2px] shrink-0 mb-1.5" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} className={`h-1 w-1 rounded-[1px] ${i % 2 === 0 ? "bg-white/60" : "bg-white/0"}`} />)}</div>
            <div><div className="text-xl font-normal text-white sm:text-2xl md:text-3xl">30% hiện trước</div><div className="text-xs font-light text-white/85 sm:text-sm">Phần còn lại mở bằng ý của em</div></div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Panel: React.FC<{ title: string; chip?: string; className?: string; children: React.ReactNode }> = ({ title, chip = "Minh họa", className = "", children }) => (
  <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7 }} className={`${GLASS} rounded-3xl p-6 text-white ${className}`}>
    <div className="flex items-center justify-between mb-5"><h3 className="text-[15px] font-medium">{title}</h3><span className="text-[10.5px] rounded-full bg-white/10 px-2.5 py-1 text-white/60">{chip}</span></div>
    {children}
  </motion.div>
);

const BARS = [58, 66, 63, 74, 71, 82, 88];
const HEAT = [[0, 1, 3, 2], [1, 3, 4, 2], [1, 2, 2, 0], [2, 1, 0, 0], [1, 0, 0, 0]];

const DataSection: React.FC = () => (
  <section id="du-lieu" className="relative bg-[#070a14] text-white py-20 md:py-28 px-5 md:px-12 overflow-hidden">
    <div className="absolute top-0 left-1/4 w-[34rem] h-[24rem] rounded-full bg-[#7c4dff] opacity-[0.12] blur-[120px]" />
    <div className="relative max-w-[1300px] mx-auto">
      <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#a78bfa]">Dữ liệu tư duy</div>
      <h2 className="mt-3 text-[clamp(2rem,4.6vw,3.8rem)] font-medium tracking-[-0.03em] leading-[1.05] max-w-3xl">Nhìn thấy cách cả lớp suy nghĩ, <span className="text-white/45">không chỉ bài nộp cuối.</span></h2>
      <p className="mt-4 text-white/60 max-w-xl text-[15px]">Mọi biểu đồ được tính từ nhật ký trao đổi và điểm quá trình. Số liệu bên dưới là minh họa.</p>
      <div className="mt-10 grid lg:grid-cols-3 gap-5">
        <Panel title="Điểm quá trình qua các bài">
          <div className="flex items-end gap-2.5 h-40">
            {BARS.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <motion.div className="w-full rounded-lg" style={{ background: i === BARS.length - 1 ? "#34d399" : "#c4b5fd" }} initial={{ height: 0 }} whileInView={{ height: `${v}%` }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 mt-2 text-[10px] text-white/45">{BARS.map((_, i) => <span key={i} className="flex-1 text-center">{i === BARS.length - 1 ? "NAY" : `B${i + 1}`}</span>)}</div>
          <p className="mt-4 text-[12px] text-white/55">Điểm tư duy trung bình của lớp tăng dần theo từng bài tập.</p>
        </Panel>
        <Panel title="Bản đồ nhiệt: số lượt × điểm tư duy">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {HEAT.flatMap((row, ri) => row.map((c, ci) => (
              <motion.div key={`${ri}-${ci}`} className="h-9 rounded-lg" style={{ background: c ? `rgba(${ri === 0 ? "52,211,153" : ri < 3 ? "124,77,255" : "236,72,153"},${0.12 + c * 0.17})` : "rgba(255,255,255,0.05)" }} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: (ri + ci) * 0.05 }} />
            )))}
          </div>
          <div className="flex justify-between text-[10px] text-white/45 mt-2"><span>3 lượt</span><span>8+ lượt →</span></div>
          <p className="mt-3 text-[12px] text-white/55">Tổng hợp ẩn danh, không hiện tên từng bạn.</p>
        </Panel>
        <Panel title="Ý riêng ghi trước khi hỏi AI">
          <div className="flex items-end gap-2"><span className="text-6xl font-medium tracking-tight leading-none">84</span><span className="text-xl text-white/50 pb-1">%</span></div>
          <div className="mt-4 h-2.5 rounded-full bg-white/10 overflow-hidden"><motion.div className="h-full rounded-full" style={{ background: GRAD }} initial={{ width: 0 }} whileInView={{ width: "84%" }} viewport={{ once: true }} transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }} /></div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-[#10b981]/20 text-[#6ee7b7] px-2.5 py-1">Tự nghĩ trước 84%</span><span className="rounded-full bg-[#f59e0b]/20 text-[#fcd34d] px-2.5 py-1">Bấm xem luôn 6%</span><span className="rounded-full bg-[#f43f5e]/20 text-[#fda4af] px-2.5 py-1">Dán nhiều chữ 12%</span></div>
          <p className="mt-4 text-[12px] text-white/55">Chỉ báo hành vi, giúp giảng viên chỉnh cách ra đề.</p>
        </Panel>
      </div>
    </div>
  </section>
);

const STEPS = [
  { icon: PenLine, t: "Ghi ý riêng trước", d: "Sinh viên viết vài dòng về luận điểm của mình và mức tự tin trước khi hỏi AI (giảng viên bật theo từng bài)." },
  { icon: Eye, t: "Hỏi AI, thấy phần mở đầu", d: "AI soạn câu trả lời đầy đủ nhưng chỉ lộ vài dòng đầu hấp dẫn. Phần còn lại được giữ ở máy chủ." },
  { icon: Unlock, t: "Nói ý để mở khóa", d: "Sinh viên trả lời vài câu hỏi. AI viết lại đáp án theo ý của chính họ, vẫn đúng kiến thức, kèm các hướng khác." },
  { icon: Route, t: "Dấu vết tư duy", d: "Cả quá trình được ghi lại. AI chấm theo 5 tiêu chí kèm bằng chứng; giảng viên là người quyết định điểm." },
];
const ROLES = [
  { icon: BookOpen, t: "Sinh viên", items: ["Làm bài cùng trợ lý AI Socratic", "Xem dấu vết tư duy và điểm của chính mình", "Nhận gợi ý hướng khác sau khi nói ý"] },
  { icon: GraduationCap, t: "Giảng viên", items: ["Giao bài, chọn mức ma sát và che mờ", "Đọc bằng chứng từng lượt, chấm điểm", "Xem thống kê lớp ẩn danh để chỉnh đề bài"] },
  { icon: ShieldCheck, t: "Quản trị viên", items: ["Quản lý người dùng, vai trò, phân quyền", "Không đọc được bài nộp và chat của sinh viên", "Nhật ký thao tác minh bạch"] },
];

const Light: React.FC<Props> = ({ onLogin, onRegister }) => (
  <>
    <section id="cach-hoat-dong" className="bg-bg text-ink py-20 md:py-28 px-5 md:px-12">
      <div className="max-w-[1300px] mx-auto">
        <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-brand">Cách Trace hoạt động</div>
        <h2 className="mt-3 text-[clamp(2rem,4.4vw,3.6rem)] font-medium tracking-[-0.03em] leading-[1.05] max-w-3xl">Không cấm AI. <span className="text-mute">Chỉ cần thấy cách bạn nghĩ cùng AI.</span></h2>
        <div className="mt-10 grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <motion.div key={s.t} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: i * 0.08, duration: 0.6 }} className="card p-6">
              <div className="flex items-center justify-between"><span className="w-11 h-11 rounded-2xl bg-brand-soft text-brand flex items-center justify-center"><s.icon className="w-5 h-5" /></span><span className="text-4xl font-medium text-line">{i + 1}</span></div>
              <h3 className="mt-5 font-semibold text-[17px]">{s.t}</h3>
              <p className="mt-2 text-sm text-ink-2 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
    <section id="vai-tro" className="bg-surface-2 text-ink py-20 md:py-24 px-5 md:px-12">
      <div className="max-w-[1300px] mx-auto">
        <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-violet-500">Cho từng vai trò</div>
        <h2 className="mt-3 text-[clamp(1.8rem,3.8vw,3rem)] font-medium tracking-[-0.03em] leading-[1.08]">Một nền tảng, ba góc nhìn.</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {ROLES.map((r) => (
            <div key={r.t} className="card p-6">
              <span className="w-11 h-11 rounded-2xl text-white flex items-center justify-center" style={{ background: GRAD }}><r.icon className="w-5 h-5" /></span>
              <h3 className="mt-4 font-semibold text-lg">{r.t}</h3>
              <ul className="mt-3 space-y-2 text-sm text-ink-2">{r.items.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </section>
    <section className="relative overflow-hidden text-white py-20 px-5 md:px-12" style={{ background: "linear-gradient(120deg,#0b2a6b,#4f2fc9 55%,#a21caf)" }}>
      <div className="relative max-w-[1300px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <h2 className="text-[clamp(1.8rem,4vw,3.2rem)] font-medium tracking-[-0.03em] leading-[1.08] max-w-2xl">Sẵn sàng đọc dấu vết tư duy của lớp học?</h2>
        <div className="flex gap-3 flex-wrap">
          <button onClick={onRegister} className="rounded-full bg-white text-[#2a1a7a] px-6 py-3 text-[14px] font-semibold hover:bg-white/90 transition-colors">Đăng ký</button>
          <button onClick={onLogin} className="rounded-full border border-white/40 px-6 py-3 text-[14px] font-medium hover:bg-white/10 transition-colors">Đăng nhập</button>
        </div>
      </div>
    </section>
    <footer className="bg-bg text-mute px-5 md:px-12 py-8 text-xs">
      <div className="max-w-[1300px] mx-auto flex flex-wrap items-center justify-between gap-2"><span>Trace. Less paste, more Trace.</span><span>Biểu đồ và số liệu trên trang này là minh họa.</span></div>
    </footer>
  </>
);

export const LandingPage: React.FC<Props> = (props) => (
  <div className="min-h-screen bg-bg">
    <Hero {...props} />
    <DataSection />
    <Light {...props} />
  </div>
);
