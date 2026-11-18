import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookOpen, Check, GraduationCap, X } from "lucide-react";
import { TraceLogo, COBALT, SKY } from "./TraceLogo";

export type LandingModalKind = "journey" | "account" | "contact" | null;
export type JourneyRole = "student" | "teacher";

const ROLES: Record<JourneyRole, { label: string; icon: typeof BookOpen; lead: string; steps: string[] }> = {
  student: { label: "Sinh viên", icon: BookOpen, lead: "Học cùng AI mà không để AI nghĩ thay.", steps: ["Vào lớp bằng mã mời của giảng viên", "Làm bài cùng trợ lý AI, nói ra ý của mình trước", "Xem dấu vết tư duy và hồ sơ của chính mình"] },
  teacher: { label: "Giảng viên", icon: GraduationCap, lead: "Thấy được quá trình, không chỉ bài nộp.", steps: ["Tạo môn học, giao bài, chọn mức ma sát", "Đọc bằng chứng từng lượt trao đổi, chấm điểm", "Xem thống kê tư duy của cả lớp"] },
};
const CONTACT_EMAIL: string = (import.meta as any).env?.VITE_CONTACT_EMAIL ?? "";

interface Props { kind: LandingModalKind; onClose: () => void; onSwitch: (k: LandingModalKind) => void; onLogin: () => void; onRegister: (role: JourneyRole) => void; }

export const LandingModals: React.FC<Props> = ({ kind, onClose, onSwitch, onLogin, onRegister }) => {
  const [role, setRole] = useState<JourneyRole>("student");
  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);
  const title = kind ? { journey: "Bắt đầu thử thách", account: "Tài khoản TraceEdu", contact: "Liên hệ" }[kind] : "";
  const primary = "inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(0,78,154,0.7)] transition hover:brightness-110";
  const R = ROLES[role];
  return (
    <AnimatePresence>
      {kind && (
        <motion.div role="dialog" aria-modal="true" aria-labelledby="landing-modal-title" data-testid="landing-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-[#041B2D]/35 p-4 backdrop-blur-sm sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" }}>
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 28 }} className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] bg-white text-[#041B2D] shadow-[0_40px_120px_-30px_rgba(4,27,45,0.5)]">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-[70px]" style={{ background: SKY }} />
            <div className="relative max-h-[88svh] overflow-y-auto p-7 sm:p-9">
              <div className="flex items-start justify-between gap-4">
                <div><TraceLogo className="h-5 w-auto" /><h2 id="landing-modal-title" className="mt-4 text-[26px] font-semibold tracking-[-0.03em]">{title}</h2></div>
                <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f5fa] text-[#3c5268] transition hover:bg-[#e3ecf6]"><X className="h-4 w-4" /></button>
              </div>

              {kind === "journey" && (
                <div className="mt-6">
                  <p className="text-[14px] text-[#4a6178]">Bạn dùng TraceEdu với vai trò nào?</p>
                  <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Vai trò">
                    {(Object.keys(ROLES) as JourneyRole[]).map((id) => { const r = ROLES[id], on = role === id, I = r.icon; return (
                      <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setRole(id)} className="relative rounded-2xl border-2 p-4 text-left transition" style={{ borderColor: on ? COBALT : "#e3ecf6", background: on ? "#f0f6fd" : "#ffffff" }}>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: on ? `linear-gradient(135deg,${COBALT},${SKY})` : "#f1f5fa" }}><I className="h-5 w-5" style={{ color: on ? "#fff" : COBALT }} /></span>
                        <div className="mt-3 text-[15px] font-semibold">{r.label}</div>
                        {on && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: COBALT }}><Check className="h-3 w-3 text-white" /></span>}
                      </button>
                    ); })}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div key={role} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-6 rounded-2xl bg-[#f5f9fd] p-5">
                      <div className="text-[15px] font-semibold" style={{ color: COBALT }}>{R.lead}</div>
                      <ol className="mt-4 space-y-3">{R.steps.map((s, i) => <li key={s} className="flex items-start gap-3 text-[14px] text-[#3c5268]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white" style={{ background: i === 0 ? COBALT : SKY }}>{i + 1}</span><span className="pt-0.5">{s}</span></li>)}</ol>
                    </motion.div>
                  </AnimatePresence>
                  <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
                    <button type="button" onClick={onLogin} className="rounded-full px-4 py-2.5 text-[14px] font-medium text-[#4a6178] transition hover:text-[#041B2D]">Đã có tài khoản</button>
                    <button type="button" onClick={() => onRegister(role)} className={primary} style={{ background: `linear-gradient(90deg,${COBALT},${SKY})` }}>Đăng ký {R.label.toLowerCase()} <ArrowRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}

              {kind === "contact" && (
                <div className="mt-6 space-y-5">
                  <p className="text-[15px] leading-relaxed text-[#3c5268]">Bạn là giảng viên muốn thử trên lớp, nhà trường đang tìm cách dùng AI cho tử tế, hay chỉ tò mò? Viết cho chúng tôi vài dòng.</p>
                  {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`} className={primary} style={{ background: `linear-gradient(90deg,${COBALT},${SKY})` }}>{CONTACT_EMAIL}</a> : <p className="text-[13px] text-[#8a9bb0]">Địa chỉ liên hệ đang được cập nhật.</p>}
                </div>
              )}

              {kind === "account" && (
                <div className="mt-6 space-y-6">
                  <p className="text-[15px] leading-relaxed text-[#3c5268]">Đăng nhập để vào lớp học, làm bài cùng AI và xem dấu vết tư duy của mình.</p>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button type="button" onClick={() => onSwitch("journey")} className="rounded-full px-4 py-2.5 text-[14px] font-medium text-[#4a6178] hover:text-[#041B2D]">Tôi mới dùng TraceEdu</button>
                    <button type="button" onClick={onLogin} className={primary} style={{ background: `linear-gradient(90deg,${COBALT},${SKY})` }}>Đăng nhập</button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
