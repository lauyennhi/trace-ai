import React from "react";
import { motion } from "motion/react";
import { Clock, Bot, FileText, Sparkles, CheckCircle2, AlertTriangle, ChevronRight, Pencil, Trash2, Award, Users } from "lucide-react";
import { Assignment, UserRole } from "../types";
import { fmtDate, relTime, riseItem } from "./ui";

interface Props {
  assignment: Assignment; role: UserRole;
  onSelect: (id: string) => void; onEdit?: (a: Assignment) => void; onDelete?: (a: Assignment) => void;
}

export const AssignmentCard: React.FC<Props> = ({ assignment: a, role, onSelect, onEdit, onDelete }) => {
  const pastDue = new Date(a.due_date) < new Date();
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const done = a.submission_status === "submitted" || a.submission_status === "late";

  const status = () => {
    if (role === "teacher") {
      return (
        <span className="chip chip-gray"><Users className="w-3 h-3" />{a.submitted_count ?? 0}/{a.member_count ?? 0} đã nộp</span>
      );
    }
    if (done) return <span className={`chip ${a.submission_status === "late" ? "chip-amber" : "chip-green"}`}><CheckCircle2 className="w-3 h-3" />{a.submission_status === "late" ? "Đã nộp trễ" : "Đã nộp"}</span>;
    if (a.submission_status === "draft") return <span className="chip chip-brand"><Clock className="w-3 h-3" />Đang làm nháp</span>;
    if (pastDue) return <span className="chip chip-rose"><AlertTriangle className="w-3 h-3" />Quá hạn</span>;
    return <span className="chip chip-amber"><Clock className="w-3 h-3" />Chưa làm</span>;
  };

  const ModeIcon = a.submission_mode === "file_only" ? FileText : Bot;
  const modeLabel = a.submission_mode === "file_only" ? "Chỉ nộp file" : a.submission_mode === "ai_chat_only" ? "AI Chat" : "AI Chat + File";

  return (
    <motion.div variants={riseItem} onClick={() => onSelect(a.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect(a.id)}
      className="group card card-hover cursor-pointer p-5 flex flex-col md:flex-row md:items-center gap-4">
      <div className={`hidden md:flex w-12 h-12 rounded-2xl items-center justify-center shrink-0 ${done ? "bg-[#e7f8ef] text-[#0f8a55] dark:bg-[#0e2a1f]" : pastDue && role === "student" ? "bg-[#ffe9ec] text-[#d6264f] dark:bg-[#3a1320]" : "bg-brand-soft text-brand"}`}>
        <ModeIcon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {status()}
          <span className="chip chip-gray"><ModeIcon className="w-3 h-3" />{modeLabel}</span>
          {a.submission_mode !== "file_only" && a.ai_submode === "socratic" && <span className="chip chip-brand"><Sparkles className="w-3 h-3" />Socratic</span>}
          {role === "teacher" && (a.ungraded_count || 0) > 0 && <span className="chip chip-rose">{a.ungraded_count} chờ chấm</span>}
          {role === "student" && a.my_grade !== undefined && <span className="chip chip-green"><Award className="w-3 h-3" />{a.my_grade}/10</span>}
          {role === "student" && a.my_process_score !== undefined && <span className="chip chip-brand">Tư duy {a.my_process_score}/100</span>}
        </div>
        <h4 className="text-base font-bold group-hover:text-brand transition-colors">{a.title}</h4>
        <p className="text-xs text-mute flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />Hạn {fmtDate(a.due_date)} · <span className={!pastDue && new Date(a.due_date).getTime() - Date.now() < 86400000 ? "text-amber-600 font-semibold" : ""}>{relTime(a.due_date)}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {role === "teacher" && (
          <>
            <button onClick={stop(() => onEdit?.(a))} className="btn btn-ghost btn-icon" title="Sửa bài tập" aria-label="Sửa bài tập"><Pencil className="w-4 h-4" /></button>
            <button onClick={stop(() => onDelete?.(a))} className="btn btn-ghost btn-icon hover:!text-rose-500" title="Xóa bài tập" aria-label="Xóa bài tập"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
        <span className="btn btn-soft btn-sm">{role === "teacher" ? "Bài nộp" : done ? "Xem lại" : "Làm bài"}<ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </motion.div>
  );
};
