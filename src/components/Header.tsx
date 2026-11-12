import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, Sun, Moon, Bell, ChevronRight, Plus, Sparkles, LogOut, Settings, BookPlus, KeyRound, UserPlus } from "lucide-react";
import { AppNotification, User } from "../types";
import { Avatar, relTime } from "./ui";

interface Props {
  user: User;
  crumbs: { label: string; onClick?: () => void }[];
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onToggleMenu: () => void;
  onGoHome: () => void;
  notifications: AppNotification[];
  unread: number;
  onOpenNotifications: () => void;
  onNotificationClick: (n: AppNotification) => void;
  onCreateCourse?: () => void;
  onJoinCourse?: () => void;
  onCreateUser?: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return ref;
}

const Pop: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.14 }}
    className={`absolute right-0 mt-2 card shadow-2xl overflow-hidden origin-top-right z-50 ${className}`}>{children}</motion.div>
);

export const Header: React.FC<Props> = ({ user, crumbs, theme, onToggleTheme, onToggleMenu, onGoHome, notifications, unread, onOpenNotifications, onNotificationClick, onCreateCourse, onJoinCourse, onCreateUser, onOpenSettings, onLogout }) => {
  const [bell, setBell] = useState(false);
  const [plus, setPlus] = useState(false);
  const [me, setMe] = useState(false);
  const bellRef = useOutside(bell, () => setBell(false));
  const plusRef = useOutside(plus, () => setPlus(false));
  const meRef = useOutside(me, () => setMe(false));
  const plusItems = [
    ...(user.role === "student" ? [{ icon: KeyRound, label: "Tham gia môn học", fn: onJoinCourse }] : []),
    ...(user.role !== "student" && onCreateCourse ? [{ icon: BookPlus, label: "Tạo môn học", fn: onCreateCourse }] : []),
    ...(user.role === "admin" && onCreateUser ? [{ icon: UserPlus, label: "Thêm người dùng", fn: onCreateUser }] : []),
  ].filter((i) => i.fn);
  const roleLabel = user.role === "admin" ? "Quản trị viên" : user.role === "teacher" ? "Giảng viên" : "Sinh viên";

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-16 bg-bg/90 backdrop-blur-md">
      <div className="h-full flex items-center justify-between gap-3 px-3 md:px-4">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={onToggleMenu} className="p-3 rounded-full text-ink-2 hover:bg-surface-2" aria-label="Mở/đóng menu"><Menu className="w-6 h-6" /></button>
          <button onClick={onGoHome} className="flex items-center gap-2 px-1 rounded-lg shrink-0">
            <span className="w-9 h-9 rounded-xl bg-brand text-white dark:text-[#062e6f] flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
            <span className="text-[1.4rem] font-normal tracking-tight text-ink-2 hidden sm:inline">Trace</span>
          </button>
          {crumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-sm min-w-0 ml-1 sm:ml-3" aria-label="Breadcrumb">
              <span className="w-px h-6 bg-line mr-2 hidden sm:block" />
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight className="w-4 h-4 text-mute shrink-0" />}
                  <button onClick={c.onClick} disabled={!c.onClick}
                    className={`truncate max-w-[9rem] sm:max-w-[14rem] ${i === crumbs.length - 1 ? "text-ink text-[1.05rem]" : "text-mute hover:text-ink"} ${i < crumbs.length - 1 && i > 0 ? "hidden md:block" : ""}`}>{c.label}</button>
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-1">
          {plusItems.length > 0 && (
            <div className="relative" ref={plusRef}>
              <button onClick={() => setPlus(!plus)} className="p-3 rounded-full text-ink-2 hover:bg-surface-2" aria-label="Tạo mới"><Plus className="w-6 h-6" /></button>
              <AnimatePresence>{plus && (
                <Pop className="w-60 py-2">
                  {plusItems.map((i) => <button key={i.label} onClick={() => { setPlus(false); i.fn?.(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2 text-left"><i.icon className="w-5 h-5 text-ink-2" />{i.label}</button>)}
                </Pop>)}</AnimatePresence>
            </div>
          )}
          <button onClick={onToggleTheme} className="p-3 rounded-full text-ink-2 hover:bg-surface-2" aria-label="Đổi giao diện sáng/tối">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={theme} className="block" initial={{ rotate: -60, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 60, opacity: 0 }} transition={{ duration: 0.18 }}>
                {theme === "dark" ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <div className="relative" ref={bellRef}>
            <button onClick={() => { setBell(!bell); if (!bell) onOpenNotifications(); }} className="p-3 rounded-full text-ink-2 hover:bg-surface-2 relative" aria-label="Thông báo">
              <Bell className="w-6 h-6" />
              {unread > 0 && <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#d93025] text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
            </button>
            <AnimatePresence>{bell && (
              <Pop className="w-[22rem] max-w-[92vw]">
                <div className="px-5 py-3.5 text-base font-medium border-b border-line">Thông báo</div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 && <p className="p-8 text-sm text-mute text-center">Chưa có thông báo nào.</p>}
                  {notifications.map((n) => (
                    <button key={n.id} onClick={() => { setBell(false); onNotificationClick(n); }} className="w-full text-left px-5 py-3 hover:bg-surface-2 border-b border-line last:border-0 flex gap-3">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-line" : "bg-brand"}`} />
                      <span className="min-w-0"><span className="block text-sm font-medium">{n.title}</span><span className="block text-xs text-ink-2 line-clamp-2">{n.body}</span><span className="block text-[11px] text-mute mt-0.5">{relTime(n.created_at)}</span></span>
                    </button>
                  ))}
                </div>
              </Pop>)}</AnimatePresence>
          </div>
          <div className="relative ml-1" ref={meRef}>
            <button onClick={() => setMe(!me)} className="rounded-full" aria-label="Tài khoản"><Avatar name={user.name} src={user.avatar} size={36} /></button>
            <AnimatePresence>{me && (
              <Pop className="w-72">
                <div className="p-5 flex flex-col items-center text-center gap-1 border-b border-line">
                  <Avatar name={user.name} src={user.avatar} size={64} />
                  <div className="font-medium mt-2">{user.name}</div>
                  <div className="text-xs text-mute">{user.email}</div>
                  <span className="chip chip-brand mt-1">{roleLabel}</span>
                </div>
                <button onClick={() => { setMe(false); onOpenSettings(); }} className="w-full flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2"><Settings className="w-5 h-5 text-ink-2" />Cài đặt tài khoản</button>
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2 border-t border-line"><LogOut className="w-5 h-5 text-ink-2" />Đăng xuất</button>
              </Pop>)}</AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
