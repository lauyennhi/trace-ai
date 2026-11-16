import React from "react";
import { motion } from "motion/react";
import { Award, Quote, AlertTriangle, Sparkles, Clock } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { ChatMessage, ProcessScoreResult, Submission } from "../types";
import { ThinkingTrace } from "./ThinkingTrace";
import { Bar } from "./ui";

const CRITERIA: { key: keyof ProcessScoreResult["tieu_chi"]; label: string; short: string; desc: string; from: string; to: string }[] = [
  { key: "tu_duy_phan_bien", label: "Phản biện", short: "Phản biện", desc: "Chất vấn, phản bác câu trả lời của AI thay vì chấp nhận ngay.", from: "#0b57d0", to: "#1a73e8" },
  { key: "dao_sau_van_de", label: "Đào sâu vấn đề", short: "Đào sâu", desc: "Đi từ câu hỏi chung chung đến cụ thể, truy tìm căn nguyên.", from: "#5b5bf0", to: "#7c4dff" },
  { key: "kiem_chung_thong_tin", label: "Kiểm chứng thông tin", short: "Kiểm chứng", desc: "Yêu cầu dẫn nguồn, đối chiếu và xác minh thông tin.", from: "#f59e0b", to: "#f97316" },
  { key: "noi_hoa_kien_thuc", label: "Nội hóa kiến thức", short: "Nội hóa", desc: "Diễn giải lại bằng lời của chính mình.", from: "#10b981", to: "#14b8a6" },
  { key: "tinh_chu_dong", label: "Tính chủ động", short: "Chủ động", desc: "Mở rộng vấn đề thay vì chỉ nhận đáp án.", from: "#ec4899", to: "#f43f5e" },
];
const TONE = { xanh: { chip: "chip-green", card: "bg-[#e7f8ef] dark:bg-[#0e2a1f]", label: "Tư duy độc lập" }, vang: { chip: "chip-amber", card: "bg-[#fff4de] dark:bg-[#33260c]", label: "Tò mò, cần làm rõ" }, do: { chip: "chip-rose", card: "bg-[#ffe9ec] dark:bg-[#3a1320]", label: "Nhờ làm hộ / sao chép" } } as const;

/** Picks up to three highlights, one per colour first, so the student sees a balanced story of their own chat. */
function keyMoments(result?: ProcessScoreResult) {
  const hl = result?.highlight_segments || [];
  const picked = (["xanh", "vang", "do"] as const).map((m) => hl.find((h) => h.mau === m)).filter(Boolean) as typeof hl;
  for (const h of hl) if (picked.length < 3 && !picked.includes(h)) picked.push(h);
  return picked.slice(0, 3);
}

export const StudentResultSection: React.FC<{ userName: string; submission: Submission; messages: ChatMessage[]; late?: boolean }> = ({ userName, submission, messages, late }) => {
  const result = submission.process_score_result;
  const graded = submission.grade !== undefined;
  const radar = result ? CRITERIA.map((c) => ({ subject: c.short, v: result.tieu_chi[c.key] })) : [];
  const moments = keyMoments(result);
  const submittedAt = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";

  return (
    <div className="space-y-5" data-testid="student-result">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6 overflow-hidden relative">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-[0.08]" style={{ background: "conic-gradient(from 90deg, #0b57d0, #7c4dff, #ec4899, #0b57d0)" }} />
        <div className="relative">
          <div className="text-[11px] font-bold tracking-wider uppercase text-mute">Hồ sơ tư duy cá nhân</div>
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight mt-1">Hành trình tư duy của <span className="gradient-text">{userName}</span></h2>
          <p className="text-xs text-mute mt-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Đã nộp {submittedAt}{late ? " (trễ hạn)" : ""}</p>
          <div className="grid md:grid-cols-3 gap-4 mt-5">
            <div className="rounded-2xl bg-surface-2 p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-ink-2"><span>Điểm chính thức của giảng viên</span><Award className="w-4 h-4 text-amber-500" /></div>
              <div className="mt-2 text-5xl font-medium gradient-text leading-tight">{graded ? submission.grade : "—"}{graded && <span className="text-lg text-mute font-semibold"> / 10</span>}</div>
              {!graded && <p className="text-xs text-mute mt-1">Giảng viên chưa chấm. Bạn sẽ nhận thông báo khi có kết quả.</p>}
            </div>
            <div className="rounded-2xl bg-surface-2 p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-ink-2"><span>Điểm tiến trình tư duy (AI)</span><Sparkles className="w-4 h-4 text-violet-500" /></div>
              {result ? <div className="mt-2 text-5xl font-medium gradient-text leading-tight">{result.process_score}<span className="text-lg text-mute font-semibold"> / 100</span></div>
                : <div className="mt-3 text-sm text-ink-2 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />AI chưa chấm được phần này. Giảng viên sẽ chạy lại sau, bài nộp của bạn vẫn được lưu đầy đủ.</div>}
              {result && <p className="text-xs text-mute mt-1">Chỉ mang tính tham khảo, giảng viên là người quyết định điểm.</p>}
            </div>
            <div className="rounded-2xl bg-brand-soft/60 p-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand"><Quote className="w-4 h-4" />Lời nhận xét</div>
              {submission.feedback ? <p className="text-sm italic mt-2 text-ink">“{submission.feedback}”</p>
                : result ? <p className="text-sm mt-2 text-ink-2">{result.nhan_xet_ngan}</p> : <p className="text-sm mt-2 text-mute">Chưa có nhận xét.</p>}
              {submission.feedback && result && <p className="text-xs text-mute mt-2">Nhận xét của AI: {result.nhan_xet_ngan}</p>}
            </div>
          </div>
        </div>
      </motion.div>

      {messages.some((m) => m.role === "user") && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="card p-6">
          <div className="text-[11px] font-bold tracking-wider uppercase text-violet-500">Bản đồ dấu vết tư duy</div>
          <h3 className="text-xl font-medium tracking-tight mt-0.5">Cách bạn đã đi qua cuộc trao đổi</h3>
          <p className="text-xs text-mute mt-1 mb-4">Mỗi điểm là một lượt của bạn. Khi AI đã nhận định, đường đi lên nếu bạn tự suy nghĩ và phản biện, đi xuống nếu nhờ AI làm hộ.</p>
          <ThinkingTrace messages={messages} highlights={result?.highlight_segments} studentLabel="bạn" />
        </motion.div>
      )}

      {result && (
        <div className="grid lg:grid-cols-5 gap-5">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="card p-6 lg:col-span-2">
            <h3 className="text-lg font-medium">Ngũ giác năng lực</h3>
            <p className="text-xs text-mute">5 chiều tư duy do AI phân tích</p>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart outerRadius="68%" data={radar}><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink-2)", fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="v" stroke="#5b5bf0" fill="#7c4dff" fillOpacity={0.25} animationDuration={900} /></RadarChart></ResponsiveContainer></div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6 lg:col-span-3">
            <h3 className="text-lg font-medium">Chi tiết từng năng lực</h3>
            <p className="text-xs text-mute mb-4">Mỗi thanh cho biết bạn thể hiện năng lực đó đến đâu trong cuộc trao đổi</p>
            <div className="space-y-4">
              {CRITERIA.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold">{c.label}</span><span className="font-bold" style={{ color: c.from }}>{result.tieu_chi[c.key]}%</span></div>
                  <Bar value={result.tieu_chi[c.key]} from={c.from} to={c.to} className="mt-1.5" />
                  <p className="text-xs text-mute mt-1">{c.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {moments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} className="card p-6">
          <div className="text-[11px] font-bold tracking-wider uppercase text-mute">Nhật ký điểm nhấn</div>
          <h3 className="text-xl font-medium tracking-tight mt-0.5">Những khoảnh khắc đáng nhớ trong cuộc trao đổi</h3>
          <p className="text-xs text-mute mb-4">Các đoạn AI trích ra từ chính lời bạn, kèm lý do</p>
          <div className="grid md:grid-cols-3 gap-4">
            {moments.map((m, i) => { const t = TONE[m.mau as keyof typeof TONE] || TONE.vang; return (
              <div key={i} className={`rounded-2xl p-4 flex flex-col ${t.card}`}>
                <span className={`chip ${t.chip} self-start`}>{t.label}</span>
                <p className="text-sm italic mt-3 flex-1">“{m.doan_van_ban}”</p>
                <p className="text-xs text-ink-2 mt-3 pt-3 border-t border-black/5 dark:border-white/10">{m.ly_do}</p>
              </div>
            ); })}
          </div>
        </motion.div>
      )}
    </div>
  );
};
