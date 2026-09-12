import React from "react";
import { User } from "../types";
import { Menu, Sun, Moon, GraduationCap, BookOpen, Sparkles, Database } from "lucide-react";

interface HeaderProps {
  currentUser: User;
  onToggleMobileMenu: () => void;
  title?: string;
  subtitle?: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenSupabase?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onToggleMobileMenu,
  title = "Trang tổng quan môn học",
  subtitle = "Quản lý tiến độ giảng dạy và bài tập tích hợp AI",
  theme,
  onToggleTheme,
  onOpenSupabase,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-4 py-3 md:px-6 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white md:hidden rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base md:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block font-normal">{subtitle}</p>}
          </div>
        </div>

        {/* User Right Section + Supabase + Theme Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Supabase Button */}
          {onOpenSupabase && (
            <button
              onClick={onOpenSupabase}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Quản lý liên kết cơ sở dữ liệu Supabase"
            >
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Supabase</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 text-xs font-medium"
            title={theme === "dark" ? "Chuyển sang Chế độ Sáng" : "Chuyển sang Chế độ Tối"}
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">Sáng</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-zinc-600" />
                <span className="hidden md:inline">Tối</span>
              </>
            )}
          </button>

          {/* Role badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-zinc-700">
            {currentUser.role === "teacher" ? (
              <>
                <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Giảng viên</span>
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Sinh viên</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-300 dark:ring-zinc-700"
            />
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{currentUser.name}</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{currentUser.email}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

