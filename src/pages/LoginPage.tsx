import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, Mail, Lock, User as UserIcon, GraduationCap, BookOpen, ArrowRight, Eye, EyeOff, Brain, MessageSquareText, ShieldCheck } from "lucide-react";
import { api, setToken } from "../lib/api";
import { User } from "../types";

interface Props { onAuthed: (user: User) => void; }

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg overflow-hidden">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-ink overflow-hidden bg-[#e8f0fe] dark:bg-[#1b2433]">
        <div className="blob blob-1 w-96 h-96 bg-[#a8c7fa] -top-24 -left-20 opacity-60" />
        <div className="blob blob-2 w-[28rem] h-[28rem] bg-[#d3bffa] bottom-[-8rem] right-[-6rem] opacity-60" />
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand text-white dark:text-[#062e6f] flex items-center justify-center"><Sparkles className="w-6 h-6" /></div>
          <span className="text-2xl font-normal tracking-tight">Trace</span>
        </div>

        <div className="relative space-y-8 max-w-lg">
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-5xl font-normal leading-[1.15] tracking-tight">
            Chấm <span className="text-brand">quá trình tư duy</span>, không chỉ kết quả.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-lg text-ink-2">
            Quản lý lớp học, giao bài và xem sinh viên đối thoại với AI như thế nào — phản biện, đào sâu hay chỉ xin đáp án.
          </motion.p>

          {/* floating mock chat */}
          <div className="relative h-52">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0, y: [0, -6, 0] }} transition={{ delay: 0.5, y: { repeat: Infinity, duration: 5 } }}
              className="absolute left-0 top-0 max-w-[16rem] rounded-2xl rounded-bl-md bg-surface text-ink border border-line px-4 py-3 text-sm shadow-2xl">
              Vì sao Demographic Parity lại gây thiệt thòi cho ứng viên giỏi?
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0, y: [0, 6, 0] }} transition={{ delay: 1.1, y: { repeat: Infinity, duration: 6 } }}
              className="absolute left-24 top-20 max-w-[16rem] rounded-2xl rounded-br-md bg-surface border border-line px-4 py-3 text-sm shadow-xl">
              Câu hỏi hay! Bạn thử nghĩ xem tỷ lệ tuyển ngang nhau có nghĩa là gì…
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1, rotate: [0, 3, 0] }} transition={{ delay: 1.6, rotate: { repeat: Infinity, duration: 7 } }}
              className="absolute right-0 bottom-0 rounded-2xl bg-surface px-5 py-4 shadow-xl border border-line">
              <div className="text-[11px] uppercase tracking-wider text-mute">Process Score</div>
              <div className="text-4xl font-normal text-brand">92<span className="text-base text-mute">/100</span></div>
            </motion.div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            {[[Brain, "Chấm 5 tiêu chí tư duy"], [MessageSquareText, "Nhật ký chat minh bạch"], [ShieldCheck, "Chống nhờ AI làm hộ"]].map(([I, t]: any, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + i * 0.12 }} className="rounded-2xl bg-surface/80 border border-line p-3">
                <I className="w-5 h-5 mb-2" />{t}
              </motion.div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-mute">© Trace · Nền tảng đánh giá tư duy quá trình cho giáo dục Việt Nam</div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6 sm:p-12">
        <div className="blob blob-1 w-72 h-72 bg-indigo-300/40 dark:bg-indigo-500/20 -top-10 -right-10 lg:hidden" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center"><Sparkles className="w-5 h-5 text-white dark:text-[#062e6f]" /></div>
            <span className="text-xl font-medium">Trace</span>
          </div>
          <h2 className="text-3xl font-normal tracking-tight">{mode === "login" ? "Chào mừng trở lại 👋" : "Tạo tài khoản mới"}</h2>
          <p className="text-ink-2 mt-2">{mode === "login" ? "Đăng nhập để vào lớp học của bạn." : "Chỉ mất chưa đến một phút."}</p>

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
                    <input className="input pl-10" placeholder="Họ và tên" value={name} onChange={(e) => setName(e.target.value)} required={mode === "register"} autoComplete="name" /></div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative"><Mail className="w-4 h-4 text-mute absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input className="input pl-10" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
            <div className="relative"><Lock className="w-4 h-4 text-mute absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input className="input pl-10 pr-11" type={show ? "text" : "password"} placeholder="Mật khẩu (tối thiểu 6 ký tự)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
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
