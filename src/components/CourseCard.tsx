import React, { useState } from "react";
import { Course, UserRole } from "../types";
import { Users, BookCheck, AlertCircle, Copy, Check, ArrowRight, Edit3, Trash2 } from "lucide-react";

interface CourseCardProps {
  course: Course;
  role: UserRole;
  onSelect: (courseId: string) => void;
  onEdit?: (course: Course) => void;
  onDelete?: (course: Course) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({ 
  course, 
  role, 
  onSelect,
  onEdit,
  onDelete
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(course.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(course);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(course);
  };

  return (
    <div
      onClick={() => onSelect(course.id)}
      className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col h-full relative"
    >
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Header Row: Code, Invite Code, and Teacher Actions */}
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shrink-0">
              {course.code}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Invite code badge with copy button */}
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-[11px] font-mono font-bold border border-zinc-200 dark:border-zinc-700 transition-colors"
                title="Nhấp để sao chép mã mời"
              >
                <span>Mã: {course.invite_code}</span>
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
              </button>

              {/* Teacher Edit & Delete Quick Actions */}
              {role === "teacher" && (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={handleEdit}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Chỉnh sửa môn học"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Xóa môn học"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Course Name */}
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors line-clamp-2">
            {course.name}
          </h3>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{course.semester} • {course.teacher_name}</p>

          {/* Description */}
          {course.description && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2.5 line-clamp-2 leading-relaxed">
              {course.description}
            </p>
          )}
        </div>

        {/* Footer Metrics */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" title="Số lượng sinh viên">
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{course.member_count || 0}</span>
            </div>

            <div className="flex items-center gap-1.5" title="Bài tập đang mở">
              <BookCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{course.open_assignments_count || 0} bài</span>
            </div>

            {role === "teacher" && (course.ungraded_count || 0) > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold" title="Bài chưa chấm">
                <AlertCircle className="w-3 h-3 text-rose-500" />
                <span>{course.ungraded_count} chưa nộp</span>
              </div>
            )}
          </div>

          <div className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:translate-x-1 transition-all">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
