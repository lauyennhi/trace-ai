import React from "react";
import { User, Course, UserRole } from "../types";
import { 
  BookOpen, 
  GraduationCap, 
  PlusCircle, 
  ChevronRight,
  Code2,
  Sparkles,
  Database
} from "lucide-react";

interface SidebarProps {
  currentUser: User;
  courses: Course[];
  activeCourseId: string | null;
  onSelectCourse: (courseId: string | null) => void;
  onSwitchRole: (role: UserRole) => void;
  onOpenCreateCourse?: () => void;
  onOpenJoinCourse?: () => void;
  onOpenSupabase?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  courses,
  activeCourseId,
  onSelectCourse,
  onSwitchRole,
  onOpenCreateCourse,
  onOpenJoinCourse,
  onOpenSupabase,
  isMobileOpen,
  onCloseMobile,
}) => {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 flex flex-col border-r border-zinc-800 transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Basic, Iconic Memorable Logo */}
      <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectCourse(null)}>
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-100 text-zinc-950 font-black flex items-center justify-center text-base shadow-sm">
            <Sparkles className="w-5 h-5 text-zinc-950 fill-zinc-950" />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              TRACE
              <span className="text-[9px] font-mono tracking-wider font-semibold uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-normal">AI Process Assessment</p>
          </div>
        </div>
      </div>

      {/* Role Switcher Widget */}
      <div className="px-4 py-3 bg-zinc-950/60 dark:bg-zinc-900/60 border-b border-zinc-800/80">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
          <span>Vai trò trải nghiệm</span>
          <span className="text-zinc-300 font-bold text-[10px]">Demo</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 dark:bg-zinc-950 rounded-lg border border-zinc-800">
          <button
            onClick={() => onSwitchRole("teacher")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
              currentUser.role === "teacher"
                ? "bg-zinc-100 text-zinc-950 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Giảng viên
          </button>
          <button
            onClick={() => onSwitchRole("student")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
              currentUser.role === "student"
                ? "bg-zinc-100 text-zinc-950 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Sinh viên
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <button
            onClick={() => {
              onSelectCourse(null);
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              activeCourseId === null
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
            }`}
          >
            <BookOpen className="w-4 h-4 text-zinc-200" />
            Trang chủ môn học
          </button>
        </div>

        {/* Courses Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              {currentUser.role === "teacher" ? "Môn học giảng dạy" : "Môn học tham gia"} ({courses.length})
            </span>
            {currentUser.role === "teacher" && onOpenCreateCourse && (
              <button
                onClick={onOpenCreateCourse}
                className="text-zinc-400 hover:text-white transition-colors p-1"
                title="Tạo môn học mới"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            )}
            {currentUser.role === "student" && onOpenJoinCourse && (
              <button
                onClick={onOpenJoinCourse}
                className="text-zinc-400 hover:text-white transition-colors p-1"
                title="Tham gia môn học"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {courses.map((course) => {
              const isActive = activeCourseId === course.id;
              return (
                <button
                  key={course.id}
                  onClick={() => {
                    onSelectCourse(course.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center justify-between group ${
                    isActive
                      ? "bg-zinc-800 text-white font-bold border-l-2 border-white shadow-xs"
                      : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100"
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-semibold truncate flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0"></span>
                      {course.code} - {course.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {course.semester}
                    </div>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-zinc-600 shrink-0 group-hover:translate-x-0.5 transition-transform ${isActive ? "text-zinc-100" : ""}`} />
                </button>
              );
            })}

            {courses.length === 0 && (
              <div className="px-3 py-4 text-center rounded-lg border border-dashed border-zinc-800 text-zinc-500 text-xs">
                {currentUser.role === "teacher"
                  ? "Chưa có môn học nào."
                  : "Chưa tham gia môn học nào."}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions button */}
        <div className="pt-2">
          {currentUser.role === "teacher" ? (
            <button
              onClick={onOpenCreateCourse}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Tạo môn học mới
            </button>
          ) : (
            <button
              onClick={onOpenJoinCourse}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs transition-all shadow-sm"
            >
              <Code2 className="w-4 h-4" />
              Nhập mã tham gia lớp
            </button>
          )}

          {onOpenSupabase && (
            <button
              onClick={() => {
                onOpenSupabase();
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-700/60 transition-all"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cơ sở dữ liệu Supabase</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer User Info */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center gap-3">
        <img
          src={currentUser.avatar}
          alt={currentUser.name}
          className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-700"
        />
        <div className="flex-1 truncate">
          <div className="text-xs font-bold text-zinc-100 truncate">{currentUser.name}</div>
          <div className="text-[10px] text-zinc-400 truncate">{currentUser.email}</div>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500" title="Đang kết nối"></div>
      </div>
    </aside>
  );
};

