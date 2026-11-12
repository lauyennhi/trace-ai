import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, Sun, Moon, Bell, ChevronRight } from "lucide-react";
import { AppNotification } from "../types";
import { relTime } from "./ui";

interface Props {
  crumbs: { label: string; onClick?: () => void }[];
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onToggleMobileMenu: () => void;
  notifications: AppNotification[];
  unread: number;
  onOpenNotifications: () => void;
  onNotificationClick: (n: AppNotification) => void;
}

export const Header: React.FC<Props> = ({ crumbs, theme, onToggleTheme, onToggleMobileMenu, notifications, unread, onOpenNotifications, onNotificationClick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <header className="sticky top-0 z-30 glass border-b border-line">
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 h-16">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onToggleMobileMenu} className="md:hidden btn btn-ghost btn-icon" aria-label="Mở menu"><Menu className="w-5 h-5" /></button>
          <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-4 h-4 text-mute shrink-0" />}
                <button onClick={c.onClick} disabled={!c.onClick}
                  className={`truncate max-w-[10rem] sm:max-w-xs ${i === crumbs.length - 1 ? "font-bold text-ink" : "text-mute hover:text-ink"} ${i < crumbs.length - 1 && i > 0 ? "hidden sm:block" : ""}`}>{c.label}</button>
              </React.Fragment>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleTheme} className="btn btn-ghost btn-icon relative overflow-hidden" aria-label="Đổi giao diện sáng/tối">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={theme} initial={{ y: 16, opacity: 0, rotate: -40 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -16, opacity: 0, rotate: 40 }} transition={{ duration: 0.2 }}>
                {theme === "dark" ? <Sun className="w-[18px] h-[18px] text-amber-400" /> : <Moon className="w-[18px] h-[18px]" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <div className="relative" ref={ref}>
            <button onClick={() => { setOpen(!open); if (!open) onOpenNotifications(); }} className="btn btn-ghost btn-icon relative" aria-label="Thông báo">
              <Bell className="w-[18px] h-[18px]" />
              {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center" style={{ animation: "pulse-ring 1.6s infinite" }}>{unread}</span>}
            </button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] card shadow-2xl overflow-hidden origin-top-right">
                  <div className="px-4 py-3 border-b border-line text-sm font-bold">Thông báo</div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 && <p className="p-6 text-sm text-mute text-center">Chưa có thông báo nào.</p>}
                    {notifications.map((n) => (
                      <button key={n.id} onClick={() => { setOpen(false); onNotificationClick(n); }} className="w-full text-left px-4 py-3 hover:bg-surface-2 border-b border-line last:border-0 flex gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-line" : "bg-brand"}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{n.title}</span>
                          <span className="block text-xs text-ink-2 line-clamp-2">{n.body}</span>
                          <span className="block text-[11px] text-mute mt-0.5">{relTime(n.created_at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
