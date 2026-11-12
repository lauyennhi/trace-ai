import React from "react";
import { motion } from "motion/react";
import { LayoutDashboard, Plus, KeyRound, Sparkles, Database, LogOut, X } from "lucide-react";
import { User, Course } from "../types";
import { Avatar } from "./ui";

interface Props {
  currentUser: User;
  courses: Course[];
  activeCourseId: string | null;
  onGoHome: () => void;
  onSelectCourse: (id: string) => void;
  onOpenCreateCourse: () => void;
  onOpenJoinCourse: () => void;
  onOpenSupabase: () => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<Props> = ({ currentUser, courses, activeCourseId, onGoHome, onSelectCourse, onOpenCreateCourse, onOpenJoinCourse, onOpenSupabase, onLogout, isMobileOpen, onCloseMobile }) => {
  const teacher = currentUser.role === "teacher";
  const go = (fn: () => void) => () => { fn(); onCloseMobile(); };
  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={onCloseMobile} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-surface border-r border-line flex flex-col transition-transform duration-300 md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <button onClick={go(onGoHome)} className="flex items-center gap-2.5 group">
            <motion.div whileHover={{ rotate: 12, scale: 1.08 }} className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center shadow-lg shadow-brand/30">
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div className="text-left leading-tight">
              <div className="text-lg font-extrabold tracking-tight">Trace</div>
              <div className="text-[11px] text-mute -mt-0.5">AI Process Assessment</div>
            </div>
          </button>
          <button className="md:hidden btn btn-ghost btn-icon border-0" onClick={onCloseMobile} aria-label="Đóng menu"><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          <button onClick={go(onGoHome)} className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeCourseId === null ? "text-brand" : "text-ink-2 hover:bg-surface-2"}`}>
            {activeCourseId === null && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-brand-soft" />}
            <LayoutDashboard className="w-[18px] h-[18px] relative" /><span className="relative">Tổng quan</span>
          </button>

          <div>
            <div className="flex items-center justify-between px-3 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-mute">{teacher ? "Môn giảng dạy" : "Môn đang học"} · {courses.length}</span>
              <button onClick={go(teacher ? onOpenCreateCourse : onOpenJoinCourse)} className="p-1 rounded-lg text-mute hover:text-brand hover:bg-brand-soft transition-colors" title={teacher ? "Tạo môn học" : "Tham gia môn học"}>
                {teacher ? <Plus className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
              </button>
            </div>
            <div className="space-y-0.5">
              {courses.length === 0 && <p className="px-3 py-2 text-xs text-mute">{teacher ? "Chưa có môn học. Nhấn + để tạo." : "Chưa tham gia môn nào. Nhấn chìa khóa để nhập mã mời."}</p>}
              {courses.map((c) => {
                const active = activeCourseId === c.id;
                return (
                  <button key={c.id} onClick={go(() => onSelectCourse(c.id))} className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${active ? "text-brand" : "text-ink-2 hover:bg-surface-2"}`}>
                    {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-brand-soft" />}
                    <span className={`relative w-8 h-8 rounded-lg bg-gradient-to-br ${c.accent_color || "from-indigo-500 to-violet-600"} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>{c.code.slice(0, 3)}</span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{c.name}</span>
                      <span className="block text-[11px] text-mute truncate">{c.code}</span>
                    </span>
                    {teacher && (c.ungraded_count || 0) > 0 && <span className="relative min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{c.ungraded_count}</span>}
                    {!teacher && (c.todo_count || 0) > 0 && <span className="relative min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{c.todo_count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-line space-y-2">
          {teacher && (
            <button onClick={go(onOpenSupabase)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-mute hover:text-ink hover:bg-surface-2 transition-colors">
              <Database className="w-4 h-4" /> Kết nối cơ sở dữ liệu
            </button>
          )}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-2">
            <Avatar name={currentUser.name} src={currentUser.avatar} size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{currentUser.name}</div>
              <div className="text-[11px] text-mute">{teacher ? "Giảng viên" : "Sinh viên"}</div>
            </div>
            <button onClick={onLogout} className="p-2 rounded-lg text-mute hover:text-rose-500 hover:bg-surface transition-colors" title="Đăng xuất" aria-label="Đăng xuất"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>
    </>
  );
};
