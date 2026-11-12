import React from "react";
import { motion } from "motion/react";
import { Home, LayoutGrid, ListTodo, ShieldCheck, Settings, GraduationCap, BookOpen, Users, ScrollText } from "lucide-react";
import { User, Course } from "../types";
import { courseTheme } from "./ui";

interface Props {
  user: User;
  courses: Course[];
  expanded: boolean;
  mobileOpen: boolean;
  routeName: string;
  adminTab?: string;
  activeCourseId: string | null;
  todoCount: number;
  onNavigate: (to: string) => void;
  onOpenSettings: () => void;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<Props> = ({ user, courses, expanded, mobileOpen, routeName, adminTab, activeCourseId, todoCount, onNavigate, onOpenSettings, onCloseMobile }) => {
  const teacher = user.role === "teacher";
  const admin = user.role === "admin";
  const tab = adminTab || "overview";
  const items = admin ? [
    { id: "a-overview", label: "Tổng quan hệ thống", icon: Home, to: "/admin", on: routeName === "admin" && tab === "overview" },
    { id: "a-users", label: "Người dùng", icon: Users, to: "/admin/users", on: routeName === "admin" && tab === "users" },
    { id: "a-courses", label: "Môn học", icon: BookOpen, to: "/admin/courses", on: routeName === "admin" && tab === "courses" },
    { id: "a-perms", label: "Phân quyền", icon: ShieldCheck, to: "/admin/permissions", on: routeName === "admin" && tab === "permissions" },
    { id: "a-audit", label: "Nhật ký", icon: ScrollText, to: "/admin/audit", on: routeName === "admin" && tab === "audit" },
  ] : [
    { id: "home", label: "Trang chủ", icon: Home, to: "/", on: routeName === "home" },
    { id: "courses", label: "Tất cả môn học", icon: LayoutGrid, to: "/courses", on: routeName === "courses" },
    { id: "todo", label: teacher ? "Cần chấm" : "Việc cần làm", icon: ListTodo, to: "/todo", on: routeName === "todo", badge: todoCount },
  ];
  const go = (to: string) => { onNavigate(to); onCloseMobile(); };
  const wide = expanded || mobileOpen;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onCloseMobile} />}
      <aside className={`fixed top-16 bottom-0 left-0 z-40 bg-bg flex flex-col overflow-hidden transition-[width,transform] duration-300 ease-out
        ${mobileOpen ? "translate-x-0 w-72 shadow-2xl bg-surface" : "-translate-x-full w-72"} md:translate-x-0 ${expanded ? "md:w-72" : "md:w-[72px]"}`}>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1">
          {items.map((i) => (
            <button key={i.id} onClick={() => go(i.to)} title={i.label} aria-current={i.on ? "page" : undefined}
              className={`relative w-full h-12 flex items-center gap-4 pl-[14px] pr-4 rounded-full text-sm transition-colors ${i.on ? "text-[#0842a0] dark:text-[#d3e3fd] font-medium" : "text-ink-2 hover:bg-surface-2"}`}>
              {i.on && <motion.span layoutId="rail-active" className="absolute inset-0 rounded-full bg-brand-soft" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <span className="relative shrink-0 w-6 h-6 flex items-center justify-center">
                <i.icon className="w-[22px] h-[22px]" strokeWidth={i.on ? 2.2 : 1.8} />
                {!!i.badge && !wide && <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#d93025] text-white text-[9px] font-bold flex items-center justify-center">{i.badge}</span>}
              </span>
              {wide && <span className="relative truncate">{i.label}</span>}
              {wide && !!i.badge && <span className="relative ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[#d93025] text-white text-[11px] font-bold flex items-center justify-center">{i.badge}</span>}
            </button>
          ))}

          {wide && !admin && (
            <div className="pt-3">
              <div className="mx-3 mb-2 border-t border-line" />
              <div className="px-4 py-1 flex items-center gap-2 text-xs font-medium text-mute">
                {teacher ? <GraduationCap className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}{user.role === "admin" ? "Tất cả môn học" : teacher ? "Giảng dạy" : "Đang học"}
              </div>
              {courses.length === 0 && <p className="px-4 py-2 text-xs text-mute">Chưa có môn học nào.</p>}
              {courses.map((c) => {
                const t = courseTheme(c.id), active = activeCourseId === c.id;
                return (
                  <button key={c.id} onClick={() => go(`/course/${c.id}`)} className={`relative w-full h-12 flex items-center gap-4 pl-[14px] pr-3 rounded-full text-sm text-left transition-colors ${active ? "text-[#0842a0] dark:text-[#d3e3fd] font-medium" : "text-ink-2 hover:bg-surface-2"}`}>
                    {active && <motion.span layoutId="rail-active" className="absolute inset-0 rounded-full bg-brand-soft" />}
                    <span className="relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: t.color }}>{c.name[0]}</span>
                    <span className="relative truncate flex-1">{c.name}</span>
                    {(c.ungraded_count || 0) > 0 && teacher && <span className="relative w-2 h-2 rounded-full bg-[#d93025]" title={`${c.ungraded_count} chờ chấm`} />}
                  </button>
                );
              })}
            </div>
          )}
        </nav>
        <div className="px-3 py-3">
          <button onClick={() => { onOpenSettings(); onCloseMobile(); }} title="Cài đặt" className="w-full h-12 flex items-center gap-4 pl-[14px] pr-4 rounded-full text-sm text-ink-2 hover:bg-surface-2">
            <span className="w-6 h-6 flex items-center justify-center shrink-0"><Settings className="w-[22px] h-[22px]" strokeWidth={1.8} /></span>
            {wide && <span>Cài đặt</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
