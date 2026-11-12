import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, Mail, Lock, User as UserIcon, GraduationCap, BookOpen, ArrowRight, Eye, EyeOff, Brain, MessageSquareText, ShieldCheck } from "lucide-react";
import { api, setToken } from "../lib/api";
import { InkTrail } from "../components/InkTrail";
import { User } from "../types";

interface Props { onAuthed: (user: User) => void; }

const rise = (i: number) => ({
  initial: { y: "105%", opacity: 0 }, animate: { y: 0, opacity: 1 },
  transition: { delay: 0.15 + i * 0.16, duration: 0.85, ease: [0.2, 0.8, 0.2, 1] as any },
});

const DEMOS = [
  { label: "Giảng viên demo", email: "hung.nguyen@edu.vn", icon: GraduationCap, sub: "TS. Nguyễn Văn Hùng" },
  { label: "Sinh viên demo", email: "la.uyennhi@student.edu.vn", icon: BookOpen, sub: "Lã Uyển Nhi" },
  { label: "Quản trị viên demo", email: "admin@trace.edu.vn", icon: ShieldCheck, sub: "Quản trị hệ thống" },
];

export const LoginPage: React.FC<Props> = ({ onAuthed }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const data = creds || mode === "login"
        ? await api("/api/auth/login", { method: "POST", body: creds || { email, password } })
        : await api("/api/auth/register", { method: "POST", body: { name, email, password, role } });
      setToken(data.token);
      onAuthed(data.user);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.25fr_1fr] bg-bg overflow-hidden">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 text-ink overflow-hidden bg-[#e8f0fe] dark:bg-[#1b2433]">
        <div className="blob blob-1 w-96 h-96 bg-[#a8c7fa] -top-24 -left-20 opacity-60" />
        <div className="blob blob-2 w-[30rem] h-[30rem] bg-[#d3bffa] bottom-[-9rem] right-[-7rem] opacity-60" />
        <div className="absolute inset-0 dot-grid opacity-30" />
        <InkTrail strength={0.3} blur={22} />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand text-white dark:text-[#062e6f] flex items-center justify-center"><Sparkles className="w-6 h-6" /></div>
          <span className="text-2xl font-normal tracking-tight">Trace</span>
        </div>

        {/* floating score card */}
        <motion.div initial={{ opacity: 0, scale: 0.7, rotate: 8 }} animate={{ opacity: 1, scale: 1, rotate: [6, 3, 6], y: [0, -10, 0] }} transition={{ delay: 1.7, rotate: { repeat: Infinity, duration: 7 }, y: { repeat: Infinity, duration: 6 } }}
          className="absolute bottom-44 right-10 hidden min-[1400px]:block [@media(max-height:820px)]:hidden rounded-3xl bg-surface px-6 py-5 shadow-2xl border border-line">
          <div className="text-[11px] uppercase tracking-wider text-mute">Process Score</div>
          <div className="text-6xl font-semibold text-brand leading-none mt-1">92<span className="text-lg text-mute font-normal">/100</span></div>
          <div className="mt-3 flex gap-1">{[88, 95, 80, 92, 90].map((v, i) => <span key={i} className="h-1.5 rounded-full bg-brand/70" style={{ width: v / 4 }} />)}</div>
        </motion.div>

        <div className="relative">
          <h1 className="font-semibold tracking-[-0.045em] leading-[0.92] text-[clamp(3.6rem,7.4vw,8.5rem)]">
            <span className="block overflow-hidden pb-[0.12em]">
              <motion.span className="block" {...rise(0)}>
                Less{" "}
                <span className="relative inline-block text-mute">paste
                  <svg className="absolute -left-[3%] top-[56%] w-[106%] h-[0.32em] -translate-y-1/2 overflow-visible" viewBox="0 0 100 10" preserveAspectRatio="none" fill="none" aria-hidden>
                    <motion.path d="M1 6 C 30 1, 60 9, 99 3" stroke="#e5484d" strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinecap="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.05, duration: 0.55, ease: "easeOut" }} />
                  </svg>
                </span>,
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.22em]">
              <motion.span className="block" {...rise(1)}>
                more{" "}
                <span className="relative inline-block">
                  <span className="gradient-text animated-gradient" style={{ backgroundImage: "linear-gradient(100deg,#0b57d0 0%,#7c4dff 35%,#ec4899 65%,#0b57d0 100%)" }}>Trace.</span>
                  <svg className="absolute left-0 -bottom-[0.02em] w-full h-[0.3em] overflow-visible" viewBox="0 0 320 36" preserveAspectRatio="none" fill="none" aria-hidden>
                    <defs><linearGradient id="trace-grad" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#0b57d0" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>
                    <motion.path d="M6 24 C 38 4, 62 34, 100 18 S 160 4, 198 20 S 262 30, 312 10" stroke="url(#trace-grad)" strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: [0, 1, 1, 1], opacity: [1, 1, 1, 0] }}
                      transition={{ delay: 1.6, duration: 3.6, times: [0, 0.5, 0.85, 1], repeat: Infinity, repeatDelay: 0.9, ease: "easeInOut" }} />
                    <motion.circle cx="312" cy="10" r="8" fill="#ec4899" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.3, 0.3, 1.25, 1, 0.3] }}
                      style={{ transformOrigin: "312px 10px" }} transition={{ delay: 1.6, duration: 3.6, times: [0, 0.48, 0.55, 0.85, 1], repeat: Infinity, repeatDelay: 0.9 }} />
                  </svg>
                </span>
              </motion.span>
            </span>
          </h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.6 }} className="mt-8 max-w-xl text-xl xl:text-[1.65rem] leading-snug text-ink-2">
            Đọc vị từng <span className="text-ink font-medium">dấu vết tư duy</span> từ chính cuộc trò chuyện với AI.
          </motion.p>
        </div>

        <div className="relative space-y-5">
          <div className="relative h-36 max-w-md [@media(max-height:820px)]:hidden">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0, y: [0, -5, 0] }} transition={{ delay: 1.4, y: { repeat: Infinity, duration: 5 } }}
              className="absolute left-0 top-0 max-w-[15rem] rounded-2xl rounded-bl-md bg-surface text-ink border border-line px-4 py-2.5 text-sm shadow-xl">
              Vì sao Demographic Parity lại gây thiệt thòi cho ứng viên giỏi?
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0, y: [0, 5, 0] }} transition={{ delay: 1.9, y: { repeat: Infinity, duration: 6 } }}
              className="absolute left-20 top-[4.4rem] max-w-[15rem] rounded-2xl rounded-br-md bg-surface border border-line px-4 py-2.5 text-sm shadow-lg">
              Câu hỏi hay! Bạn thử nghĩ xem tỷ lệ tuyển ngang nhau có nghĩa là gì…
            </motion.div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {[[Brain, "Chấm 5 tiêu chí tư duy"], [MessageSquareText, "Nhật ký chat minh bạch"], [ShieldCheck, "Chống nhờ AI làm hộ"]].map(([I, t]: any, i) => (
              <motion.span key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.1 + i * 0.1 }} className="inline-flex items-center gap-2 rounded-full bg-surface/80 border border-line px-3.5 py-1.5">
                <I className="w-4 h-4 text-brand" />{t}
              </motion.span>
            ))}
          </div>
          <div className="text-xs text-mute">© Trace · Nền tảng đánh giá tư duy quá trình cho giáo dục Việt Nam</div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6 sm:p-12 overflow-hidden">
        <InkTrail strength={0.22} blur={22} />
        <div className="blob blob-1 w-72 h-72 bg-indigo-300/40 dark:bg-indigo-500/20 -top-10 -right-10 lg:hidden" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-lg">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center"><Sparkles className="w-5 h-5 text-white dark:text-[#062e6f]" /></div>
            <span className="text-xl font-medium">Trace</span>
          </div>
          <div className="lg:hidden mb-8">
            <div className="text-[3.4rem] sm:text-6xl font-semibold tracking-[-0.04em] leading-[0.95]">
              Less <span className="relative text-mute">paste<span className="absolute left-[-2%] top-[55%] w-[104%] h-[5px] rounded-full bg-[#e5484d] -rotate-3" /></span>,<br />
              more <span className="gradient-text animated-gradient" style={{ backgroundImage: "linear-gradient(100deg,#0b57d0,#7c4dff,#ec4899,#0b57d0)" }}>Trace.</span>
            </div>
            <p className="mt-4 text-ink-2 text-lg leading-snug">Đọc vị từng <strong className="text-ink font-medium">dấu vết tư duy</strong> từ chính cuộc trò chuyện với AI.</p>
          </div>
          <h2 className="text-4xl font-normal tracking-tight">{mode === "login" ? "Chào mừng trở lại 👋" : "Tạo tài khoản mới"}</h2>
          <p className="text-ink-2 mt-2 text-lg">{mode === "login" ? "Đăng nhập để vào lớp học của bạn." : "Chỉ mất chưa đến một phút."}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <AnimatePresence initial={false}>
              {mode === "register" && (
                <motion.div key="reg" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-surface-2 rounded-2xl border border-line">
                    {([["student", "Sinh viên", BookOpen], ["teacher", "Giảng viên", GraduationCap]] as const).map(([id, l, I]) => (
                      <button type="button" key={id} onClick={() => setRole(id)} className="relative py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                        {role === id && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-xl bg-surface shadow-md border border-line" />}
                        <span className={`relative flex items-center gap-2 ${role === id ? "text-brand" : "text-ink-2"}`}><I className="w-4 h-4" />{l}</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative"><UserIcon className="w-4 h-4 text-mute absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input className="input pl-10 !py-3.5 !text-base" placeholder="Họ và tên" value={name} onChange={(e) => setName(e.target.value)} required={mode === "register"} autoComplete="name" /></div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative"><Mail className="w-4 h-4 text-mute absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input className="input pl-10 !py-3.5 !text-base" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
            <div className="relative"><Lock className="w-4 h-4 text-mute absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input className="input pl-10 pr-11 !py-3.5 !text-base" type={show ? "text" : "password"} placeholder="Mật khẩu (tối thiểu 6 ký tự)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink" aria-label="Hiện/ẩn mật khẩu">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>

            <AnimatePresence>
              {error && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }} exit={{ opacity: 0 }} className="chip chip-rose w-full rounded-xl px-3 py-2.5 text-sm" role="alert">{error}</motion.div>}
            </AnimatePresence>

            <button type="submit" className="btn btn-primary w-full py-3.5 text-base" disabled={busy}>
              {busy ? "Đang xử lý…" : <>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"} <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-sm text-ink-2 text-center mt-5">
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <button className="font-semibold text-brand hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
              {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
            </button>
          </p>

          <div className="mt-8">
            <div className="flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-line" />Dùng thử nhanh với tài khoản demo<span className="h-px flex-1 bg-line" /></div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {DEMOS.map((d) => (
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} key={d.email} disabled={busy} onClick={() => submit(undefined, { email: d.email, password: "123456" })}
                  className="card card-hover p-3 text-left">
                  <d.icon className="w-5 h-5 text-brand mb-2" />
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className="text-xs text-mute truncate">{d.sub}</div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
