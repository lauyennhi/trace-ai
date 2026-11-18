import React, { useEffect, useState } from "react";
import { Check, X, GraduationCap, BookOpen, ArrowRight } from "lucide-react";

export type LandingModalKind = "journey" | "account" | "contact" | null;
export type JourneyRole = "student" | "teacher";

const JOURNEY: Record<JourneyRole, { title: string; steps: string[] }> = {
  student: { title: "Dành cho sinh viên", steps: ["Vào lớp bằng mã mời của giảng viên", "Làm bài cùng trợ lý AI, ghi ý riêng của mình", "Xem dấu vết tư duy và điểm của chính mình"] },
  teacher: { title: "Dành cho giảng viên", steps: ["Tạo môn học và giao bài, chọn mức ma sát và che mờ", "Đọc bằng chứng từng lượt trao đổi, chấm điểm", "Xem thống kê lớp ẩn danh để chỉnh cách ra đề"] },
};

const CONTACT_EMAIL: string = (import.meta as any).env?.VITE_CONTACT_EMAIL ?? "";

interface Props {
  kind: LandingModalKind;
  onClose: () => void;
  onSwitch: (k: LandingModalKind) => void;
  onLogin: () => void;
  onRegister: (role: JourneyRole) => void;
}

export const LandingModals: React.FC<Props> = ({ kind, onClose, onSwitch, onLogin, onRegister }) => {
  const [role, setRole] = useState<JourneyRole>("student");
  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);
  if (!kind) return null;
  const title = { journey: "Thử nghĩ một lần", account: "Tài khoản Trace Edu", contact: "Liên hệ" }[kind];
  const btn = "liquid-glass rounded-full px-6 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition cursor-pointer";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="landing-modal-title" className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-[#041B2D]/70 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="landing-modal">
      <div className="liquid-glass bg-[#06263f]/95 rounded-2xl w-full max-w-lg max-h-[88svh] overflow-y-auto p-6 sm:p-8 text-white shadow-2xl" style={{ fontFamily: "Inter, 'Be Vietnam Pro', system-ui, sans-serif" }}>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div><p className="text-xs font-medium text-white/50 tracking-wide">Trace Edu</p><h2 id="landing-modal-title" className="text-2xl font-normal tracking-tight mt-1">{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="liquid-glass h-9 w-9 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"><X className="h-4 w-4" strokeWidth={1.75} /></button>
        </div>

        {kind === "journey" && (
          <div className="space-y-5">
            <p className="text-sm font-light text-white/75 leading-relaxed">Bạn dùng Trace Edu với vai trò nào? Nội dung bên dưới đổi theo lựa chọn của bạn.</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Vai trò">
              {([["student", "Sinh viên", BookOpen], ["teacher", "Giảng viên", GraduationCap]] as const).map(([id, label, I]) => (
                <button key={id} type="button" role="radio" aria-checked={role === id} onClick={() => setRole(id)} className={`rounded-xl border px-4 py-3 text-left text-sm transition cursor-pointer ${role === id ? "border-white/60 bg-white/10" : "border-white/15 hover:bg-white/5"}`}><I className="h-4 w-4 mb-1.5 text-white/80" strokeWidth={1.5} />{label}</button>))}
            </div>
            <div className="border-t border-white/10 pt-4"><h3 className="text-sm font-medium mb-2">{JOURNEY[role].title}</h3>
              <ol className="space-y-2">{JOURNEY[role].steps.map((s, i) => <li key={s} className="flex gap-3 text-xs sm:text-sm font-light text-white/75"><span className="text-white/45 tabular-nums">{i + 1}.</span>{s}</li>)}</ol></div>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button type="button" onClick={onLogin} className="text-xs text-white/60 hover:text-white transition cursor-pointer px-3 py-2">Đã có tài khoản</button>
              <button type="button" onClick={() => onRegister(role)} className={`${btn} inline-flex items-center gap-2`}>Đăng ký <ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {kind === "contact" && (
          <div className="space-y-5">
            <p className="text-sm font-light text-white/75 leading-relaxed">Bạn là giảng viên muốn thử trên lớp, là nhà trường đang tìm cách dùng AI cho tử tế, hay chỉ tò mò? Viết cho chúng mình vài dòng, bao lâu cũng được.</p>
            {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Chào Trace Edu")}`} className={`${btn} inline-flex items-center gap-2`}>{CONTACT_EMAIL}</a> : <p className="text-xs text-white/50">Địa chỉ liên hệ đang được cập nhật.</p>}
          </div>
        )}

        {kind === "account" && (
          <div className="space-y-5">
            <p className="text-sm font-light text-white/75 leading-relaxed">Đăng nhập để vào lớp học, làm bài cùng AI và xem dấu vết tư duy của mình. Chưa có tài khoản thì đăng ký chỉ mất một phút.</p>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button type="button" onClick={() => onSwitch("journey")} className="text-xs text-white/60 hover:text-white transition cursor-pointer px-3 py-2">Tôi mới dùng Trace Edu</button>
              <button type="button" onClick={onLogin} className={btn}>Đăng nhập</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
