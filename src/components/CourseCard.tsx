import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { BarChart3, Users, FolderOpen, MoreVertical, Copy, Check, Pencil, Trash2, ClipboardList } from "lucide-react";
import { Course, UserRole } from "../types";
import { CourseArt, courseTheme, relTime, riseItem } from "./ui";

interface Props {
  course: Course; role: UserRole;
  onSelect: (id: string, tab?: string) => void; onEdit?: (c: Course) => void; onDelete?: (c: Course) => void; large?: boolean; spot?: boolean;
}

export const CourseCard: React.FC<Props> = ({ course, role, onSelect, onEdit, onDelete, large, spot }) => {
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = courseTheme(course.id);
  const manage = role !== "student";
  useEffect(() => {
    if (!menu) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menu]);
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const copy = () => { if (course.invite_code) { navigator.clipboard?.writeText(course.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  const iconBtn = "p-2.5 rounded-full text-ink-2 hover:bg-surface-2 transition-colors";
  return (
    <motion.article variants={riseItem} onClick={() => onSelect(course.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect(course.id)}
      className={`group card card-hover cursor-pointer overflow-visible flex flex-col rounded-[1.5rem] ${spot ? "spotlight" : ""}`} style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={`relative ${large ? "h-[9.5rem] px-6 pt-5" : "h-[7.5rem] px-5 pt-4"} rounded-t-[1.5rem]`} style={{ background: t.bg }}>
        <CourseArt id={course.id} className="rounded-t-[1.5rem]" />
        <h3 className="relative text-[1.35rem] leading-snug font-normal line-clamp-2 pr-24 group-hover:underline underline-offset-4" style={{ color: "color-mix(in srgb, " + t.color + " 70%, var(--ink))" }}>{course.name}</h3>
        <p className={`relative ${large ? "text-base mt-1.5" : "text-sm mt-0.5"} text-ink-2 truncate`}>{course.code} · {course.semester}</p>
      </div>
      <div className={`${large ? "px-6 pt-5 pb-4 min-h-[6.5rem] text-base" : "px-5 pt-4 pb-3 min-h-[5.5rem]"} flex-1`}>
        {course.next_due ? (
          <>
            <div className="text-sm font-medium">Sắp đến hạn · <span className="text-ink-2 font-normal">{relTime(course.next_due.due_date)}</span></div>
            <div className="text-sm text-ink-2 truncate mt-0.5">{course.next_due.title}</div>
          </>
        ) : <div className="text-sm text-mute">Không có bài tập sắp đến hạn</div>}
        {manage && (course.ungraded_count || 0) > 0 && <span className="chip chip-rose mt-2">{course.ungraded_count} bài chờ chấm</span>}
        {!manage && (course.todo_count || 0) > 0 && <span className="chip chip-amber mt-2">{course.todo_count} bài cần làm</span>}
      </div>
      <div className="relative border-t border-line px-3 py-1.5 flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
        {manage && course.invite_code && (
          <button onClick={copy} className="mr-auto ml-2 chip chip-gray font-mono hover:border-brand/40" title="Sao chép mã mời">{course.invite_code}{copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}</button>
        )}
        {manage && <button className={iconBtn} title="Thống kê lớp" aria-label="Thống kê lớp" onClick={stop(() => onSelect(course.id, "stats"))}><BarChart3 className="w-5 h-5" /></button>}
        <button className={iconBtn} title="Sinh viên" aria-label="Sinh viên" onClick={stop(() => onSelect(course.id, "students"))}><Users className="w-5 h-5" /></button>
        <button className={iconBtn} title="Bài tập" aria-label="Bài tập" onClick={stop(() => onSelect(course.id))}>{manage ? <FolderOpen className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}</button>
        {manage && (
          <div className="relative" ref={ref}>
            <button className={iconBtn} aria-label="Thêm tùy chọn" onClick={stop(() => setMenu(!menu))}><MoreVertical className="w-5 h-5" /></button>
            {menu && (
              <div className="absolute right-0 bottom-full mb-1 w-44 card shadow-2xl py-1.5 z-20">
                <button onClick={stop(() => { setMenu(false); onEdit?.(course); })} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2"><Pencil className="w-4 h-4" />Chỉnh sửa</button>
                <button onClick={stop(() => { setMenu(false); onDelete?.(course); })} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d93025] hover:bg-surface-2"><Trash2 className="w-4 h-4" />Xóa môn học</button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
};
