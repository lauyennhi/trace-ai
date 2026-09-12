import React from "react";
import { Assignment, UserRole, SubmissionStatus } from "../types";
import { Clock, Bot, FileText, Sparkles, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";

interface AssignmentCardProps {
  assignment: Assignment;
  role: UserRole;
  onSelect: (assignmentId: string) => void;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({ assignment, role, onSelect }) => {
  const isPastDue = new Date(assignment.due_date) < new Date();
  
  // Format due date in Vietnamese locale
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderStatusBadge = () => {
    if (role === "teacher") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          Hạn: {formatDate(assignment.due_date)}
        </span>
      );
    }

    const status = assignment.submission_status || (isPastDue ? "late" : "not_submitted");

    switch (status) {
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Đã nộp bài
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Đang làm (Nháp)
          </span>
        );
      case "late":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Trễ hạn
          </span>
        );
      case "not_submitted":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Clock className="w-3.5 h-3.5 text-rose-500" />
            Chưa làm
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect(assignment.id)}
      className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 p-5 shadow-xs transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {renderStatusBadge()}

          {/* Submission mode badge */}
          {assignment.submission_mode === "both" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold">
              <Bot className="w-3 h-3 text-zinc-500" />
              AI Chat + File
            </span>
          )}
          {assignment.submission_mode === "ai_chat_only" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold">
              <Bot className="w-3 h-3 text-zinc-500" />
              Làm qua AI Chat
            </span>
          )}
          {assignment.submission_mode === "file_only" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold">
              <FileText className="w-3 h-3 text-zinc-500" />
              Chỉ nộp file
            </span>
          )}

          {/* Socratic indicator */}
          {assignment.submission_mode !== "file_only" && assignment.ai_submode === "socratic" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-bold">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Ghi nhận tư duy AI Socratic
            </span>
          )}
        </div>

        <h4 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
          {assignment.title}
        </h4>

        {assignment.description && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
            {assignment.description}
          </p>
        )}

        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
          <span>Hạn nộp: <strong className="text-zinc-800 dark:text-zinc-200">{formatDate(assignment.due_date)}</strong></span>
          {assignment.attachments?.length > 0 && (
            <span>• {assignment.attachments.length} tài liệu đính kèm</span>
          )}
          {role === "student" && assignment.my_process_score !== undefined && (
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded font-bold">
              Điểm quá trình: {assignment.my_process_score}/100
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
        <button className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-zinc-800 dark:hover:bg-white shadow-xs">
          <span>{role === "teacher" ? "Quản lý bài nộp" : "Làm bài tập"}</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
