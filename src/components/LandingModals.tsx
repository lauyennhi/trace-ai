import React, { useEffect, useState } from "react";
import { Check, X, GraduationCap, BookOpen, ArrowRight } from "lucide-react";

export type LandingModalKind = "approach" | "methods" | "journey" | "account" | null;
export type JourneyRole = "student" | "teacher";

const PILLARS = [
  { n: "01", t: "Nghĩ trước, hỏi sau", d: "Sinh viên ghi luận điểm và mức tự tin của mình trước khi hỏi AI (giảng viên bật theo từng bài). AI dùng chính ý đó để nâng cấp lập luận, không viết thay." },
  { n: "02", t: "Thấy một phần, mở bằng ý của mình", d: "AI soạn đáp án đầy đủ nhưng chỉ lộ vài dòng đầu. Phần còn lại được giữ ở máy chủ cho tới khi sinh viên nói ý của mình." },
  { n: "03", t: "Dấu vết tư duy có bằng chứng", d: "Từng lượt trao đổi được ghi lại. AI chấm theo 5 tiêu chí kèm trích đoạn; giảng viên đọc bằng chứng và là người quyết định điểm." },
];

const METHODS = [
  { id: "socratic", tab: "Trợ lý Socratic", cadence: "Theo từng bài", meta: "Từ 3 lượt", title: "Trợ lý Socratic",
    summary: "AI hỏi gợi mở thay vì đưa đáp án ngay. Sinh viên phải trao đổi ít nhất 3 lượt với trợ lý trước khi nộp được bài.",
    benefits: ["Giảng viên chọn kiểu Socratic hoặc trợ lý thường cho từng bài", "Giới hạn 25 tin nhắn mỗi 5 phút để chống lạm dụng", "Nhật ký trao đổi được lưu đầy đủ làm bằng chứng"] },
  { id: "friction", tab: "Ma sát đầu vào", cadence: "Giảng viên bật", meta: "3 mức", title: "Ma sát đầu vào",
    summary: "Trước khi hỏi AI, sinh viên viết vài dòng về luận điểm của mình. Giảng viên chọn: không có, nhắc nhẹ (được bỏ qua, có ghi nhận) hoặc bắt buộc.",
    benefits: ["Câu hỏi định hướng do giảng viên sửa được", "Ghi mức tự tin trước khi xem câu trả lời của AI", "Máy chủ khóa khung chat cho tới khi sinh viên ghi ý"] },
  { id: "gate", tab: "Che mờ và mở khóa", cadence: "Giảng viên bật", meta: "3-4 dòng đầu", title: "Che mờ và mở khóa",
    summary: "AI soạn đáp án đầy đủ nhưng chỉ cho xem phần mở đầu. Sinh viên nói ý của mình để mở phần còn lại; AI viết lại theo ý đó, vẫn đúng kiến thức, kèm các hướng khác để cân nhắc.",
    benefits: ["Phần bị che không được gửi về trình duyệt của sinh viên", "Có thể cho phép xem luôn, việc bỏ qua được ghi nhận", "Giảng viên xem được bản nháp gốc và ý của sinh viên"] },
  { id: "l2", tab: "Viết L2", cadence: "3 bước", meta: "5 chiều chấm", title: "Viết L2",
    summary: "Bài viết ngoại ngữ có AI hỗ trợ: viết prompt, tìm lỗi cài sẵn trong văn bản AI, rồi chỉnh sửa. Chấm theo 5 chiều, đối chiếu lỗi do chương trình tính.",
    benefits: ["Bước sau chỉ mở khi đã chốt bước trước, kiểm tra ở máy chủ", "Đáp án lỗi không gửi về sinh viên", "Giảng viên chỉnh được điểm từng chiều"] },
] as const;

const JOURNEY: Record<JourneyRole, { title: string; steps: string[] }> = {
  student: { title: "Dành cho sinh viên", steps: ["Vào lớp bằng mã mời của giảng viên", "Làm bài cùng trợ lý AI, ghi ý riêng của mình", "Xem dấu vết tư duy và điểm của chính mình"] },
  teacher: { title: "Dành cho giảng viên", steps: ["Tạo môn học và giao bài, chọn mức ma sát và che mờ", "Đọc bằng chứng từng lượt trao đổi, chấm điểm", "Xem thống kê lớp ẩn danh để chỉnh cách ra đề"] },
};

interface Props {
  kind: LandingModalKind;
  onClose: () => void;
  onSwitch: (k: LandingModalKind) => void;
  onLogin: () => void;
  onRegister: (role: JourneyRole) => void;
}

export const LandingModals: React.FC<Props> = ({ kind, onClose, onSwitch, onLogin, onRegister }) => {
  const [method, setMethod] = useState<string>(METHODS[0].id);
  const [role, setRole] = useState<JourneyRole>("student");
  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);
  if (!kind) return null;
  const m = METHODS.find((x) => x.id === method) ?? METHODS[0];
  const title = { approach: "Cách tiếp cận của hmm", methods: "Phương pháp", journey: "Bắt đầu với hmm", account: "Tài khoản hmm" }[kind];
  const btn = "liquid-glass rounded-full px-6 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition cursor-pointer";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="landing-modal-title" className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-[#120d2b]/60 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="landing-modal">
      <div className="liquid-glass bg-[#16113a]/85 rounded-2xl w-full max-w-lg max-h-[88svh] overflow-y-auto p-6 sm:p-8 text-white shadow-2xl" style={{ fontFamily: "Inter, 'Be Vietnam Pro', system-ui, sans-serif" }}>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div><p className="text-xs font-medium text-white/50 tracking-wide">hmm</p><h2 id="landing-modal-title" className="text-2xl font-normal tracking-tight mt-1">{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="liquid-glass h-9 w-9 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"><X className="h-4 w-4" strokeWidth={1.75} /></button>
        </div>

        {kind === "approach" && (
          <div className="space-y-5">
            <p className="text-sm font-light text-white/75 leading-relaxed">hmm không cấm AI và cũng không đoán xem văn bản có do AI viết hay không. hmm ghi lại quá trình sinh viên nghĩ cùng AI, để giảng viên đọc được bằng chứng.</p>
            <div className="space-y-4 pt-1">{PILLARS.map((p) => (
              <div key={p.n} className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-baseline gap-3"><span className="text-xs font-medium text-white/45 tabular-nums">{p.n}.</span><h3 className="text-sm font-medium">{p.t}</h3></div>
                <p className="mt-1.5 pl-6 text-xs sm:text-sm font-light text-white/65 leading-relaxed">{p.d}</p>
              </div>))}</div>
            <div className="pt-2 flex justify-end"><button type="button" onClick={() => onSwitch("journey")} className={btn}>Bắt đầu với hmm</button></div>
          </div>
        )}

        {kind === "methods" && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Phương pháp">{METHODS.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === m.id} onClick={() => setMethod(x.id)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${x.id === m.id ? "bg-white text-[#16113a]" : "liquid-glass text-white/70 hover:text-white hover:bg-white/10"}`}>{x.tab}</button>))}</div>
            <div className="border-t border-white/10 pt-5 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-white/55"><span>{m.cadence}</span><span aria-hidden="true">·</span><span>{m.meta}</span></div>
              <h3 className="text-lg font-normal">{m.title}</h3>
              <p className="text-sm font-light text-white/75 leading-relaxed">{m.summary}</p>
              <ul className="space-y-1.5 pt-1">{m.benefits.map((b) => <li key={b} className="flex items-start gap-2 text-xs text-white/75"><Check className="h-3.5 w-3.5 text-white/70 shrink-0 mt-0.5" /><span>{b}</span></li>)}</ul>
            </div>
            <div className="pt-2 flex justify-end"><button type="button" onClick={() => onSwitch("journey")} className={btn}>Thử với hmm</button></div>
          </div>
        )}

        {kind === "journey" && (
          <div className="space-y-5">
            <p className="text-sm font-light text-white/75 leading-relaxed">Bạn dùng hmm với vai trò nào? Nội dung bên dưới đổi theo lựa chọn của bạn.</p>
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

        {kind === "account" && (
          <div className="space-y-5">
            <p className="text-sm font-light text-white/75 leading-relaxed">Đăng nhập để vào lớp học, làm bài cùng AI và xem dấu vết tư duy của mình. Chưa có tài khoản thì đăng ký chỉ mất một phút.</p>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button type="button" onClick={() => onSwitch("journey")} className="text-xs text-white/60 hover:text-white transition cursor-pointer px-3 py-2">Tôi mới dùng hmm</button>
              <button type="button" onClick={onLogin} className={btn}>Đăng nhập</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
