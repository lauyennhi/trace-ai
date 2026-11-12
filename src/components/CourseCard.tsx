import React, { useState } from "react";
import { motion } from "motion/react";
import { Users, ClipboardList, Copy, Check, ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { Course, UserRole } from "../types";
import { riseItem } from "./ui";

interface Props {
  course: Course; role: UserRole;
  onSelect: (id: string) => void; onEdit?: (c: Course) => void; onDelete?: (c: Course) => void;
}

export const CourseCard: React.FC<Props> = ({ course, role, onSelect, onEdit, onDelete }) => {
  const [copied, setCopied] = useState(false);
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const copy = () => {
    if (!course.invite_code) return;
    navigator.clipboard?.writeText(course.invite_code);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const teacher = role === "teacher";
  return (
    <motion.div variants={riseItem} whileTap={{ scale: 0.99 }} onClick={() => onSelect(course.id)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(course.id)}
      className="group card card-hover cursor-pointer overflow-hidden flex flex-col">
      <div className={`relative h-28 bg-gradient-to-br ${course.accent_color || "from-indigo-500 to-violet-600"} p-4 overflow-hidden`}>
        <div className="absolute -right-6 -top-8 w-32 h-32 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-125" />
        <div className="absolute right-10 -bottom-10 w-24 h-24 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-150" />
        <div className="relative flex items-start justify-between">
          <span className="px-2.5 py-1 rounded-lg bg-white/25 backdrop-blur text-white text-xs font-bold font-mono tracking-wider">{course.code}</span>
          {teacher && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button onClick={stop(() => onEdit?.(course))} className="p-1.5 rounded-lg bg-white/25 hover:bg-white/40 text-white backdrop-blur" title="Chỉnh sửa" aria-label="Chỉnh sửa môn học"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={stop(() => onDelete?.(course))} className="p-1.5 rounded-lg bg-white/25 hover:bg-rose-500 text-white backdrop-blur" title="Xóa" aria-label="Xóa môn học"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
        <h3 className="relative mt-3 text-white font-bold text-lg leading-tight line-clamp-1 drop-shadow-sm">{course.name}</h3>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">
        <p className="text-xs text-mute">{course.semester} · {course.teacher_name}</p>
        {course.description && <p className="text-sm text-ink-2 line-clamp-2 leading-relaxed">{course.description}</p>}
        <div className="mt-auto pt-3 border-t border-line flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
          <div className="flex items-center gap-3 text-xs text-ink-2 font-medium">
            <span className="flex items-center gap-1.5 whitespace-nowrap"><Users className="w-4 h-4 text-mute" />{course.member_count || 0}</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap"><ClipboardList className="w-4 h-4 text-mute" />{course.assignments_count ?? 0} bài</span>
          </div>
          <div className="flex items-center gap-2">
            {teacher && (course.ungraded_count || 0) > 0 && <span className="chip chip-rose whitespace-nowrap">{course.ungraded_count} chờ chấm</span>}
            {!teacher && (course.todo_count || 0) > 0 && <span className="chip chip-amber whitespace-nowrap">{course.todo_count} cần làm</span>}
            {teacher && course.invite_code && (
              <button onClick={stop(copy)} className="chip chip-gray font-mono hover:border-brand/50 transition-colors" title="Sao chép mã mời">
                {course.invite_code}{copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
            <ArrowUpRight className="w-4 h-4 text-mute group-hover:text-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
