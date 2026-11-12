import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, animate, useInView, type Variants } from "motion/react";
import { X, CheckCircle2, AlertCircle, Info, BookOpen, FlaskConical, Calculator, Globe2, Music2, Palette, Code2, Brain, ChevronsDownUp, ChevronsUpDown } from "lucide-react";

/* ---------- Motion presets ---------- */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};
export const staggerParent: Variants = { animate: { transition: { staggerChildren: 0.06 } } };
export const riseItem: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

/* ---------- Avatar (never a broken image) ---------- */
const GRADS = [
  "from-indigo-500 to-violet-500", "from-sky-500 to-indigo-500", "from-emerald-500 to-teal-500",
  "from-rose-500 to-orange-400", "from-fuchsia-500 to-pink-500", "from-amber-500 to-orange-500",
];
export const Avatar: React.FC<{ name: string; src?: string; size?: number; className?: string }> = ({ name, src, size = 36, className = "" }) => {
  const [broken, setBroken] = useState(false);
  const initials = name.replace(/^(TS\.|ThS\.|PGS\.|GS\.)\s*/i, "").trim().split(/\s+/).slice(-2).map((w) => w[0]).join("").toUpperCase();
  const g = GRADS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src && !broken) {
    return <img src={src} alt={name} onError={() => setBroken(true)} style={style} className={`rounded-full object-cover shrink-0 ring-2 ring-surface ${className}`} />;
  }
  return (
    <div style={style} className={`rounded-full bg-gradient-to-br ${g} text-white font-bold flex items-center justify-center shrink-0 ring-2 ring-surface ${className}`}>
      {initials || "?"}
    </div>
  );
};

/* ---------- Skeleton ---------- */
export const Skeleton: React.FC<{ className?: string }> = ({ className = "h-4 w-full" }) => <div className={`skeleton ${className}`} />;

/* ---------- Count-up number ---------- */
export const AnimatedNumber: React.FC<{ value: number; decimals?: number; suffix?: string; className?: string }> = ({ value, decimals = 0, suffix = "", className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const c = animate(0, value, {
      duration: 1.1, ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = v.toFixed(decimals) + suffix; },
    });
    return () => c.stop();
  }, [inView, value, decimals, suffix]);
  return <span ref={ref} className={className}>{(0).toFixed(decimals)}{suffix}</span>;
};

/* ---------- Progress ring ---------- */
export const Ring: React.FC<{ value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }> = ({ value, size = 96, stroke = 9, color = "var(--brand)", children }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(100, value)) / 100) }}
          transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

/* ---------- Bar ---------- */
export const Bar: React.FC<{ value: number; className?: string; from?: string; to?: string }> = ({ value, className = "", from = "var(--brand)", to = "var(--brand-2)" }) => (
  <div className={`h-2 rounded-full bg-line overflow-hidden ${className}`}>
    <motion.div className="h-full rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }}
      initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
  </div>
);

/* ---------- Empty state ---------- */
export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card border-dashed py-14 px-6 text-center">
    <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
      className="w-16 h-16 mx-auto rounded-3xl bg-brand-soft text-brand flex items-center justify-center mb-4">{icon}</motion.div>
    <h4 className="text-base font-bold">{title}</h4>
    {text && <p className="text-sm text-ink-2 mt-1 max-w-sm mx-auto">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </motion.div>
);

/* ---------- Modal ---------- */
export const Modal: React.FC<{
  open: boolean; onClose: () => void; title: string; subtitle?: string; icon?: React.ReactNode;
  children: React.ReactNode; maxWidth?: string;
}> = ({ open, onClose, title, subtitle, icon, children, maxWidth = "max-w-lg" }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#0b0c1f]/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`relative card w-full ${maxWidth} max-h-[92vh] overflow-hidden flex flex-col rounded-b-none sm:rounded-b-[1.25rem] shadow-2xl`}>
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
              <div className="flex items-center gap-3">
                {icon && <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand flex items-center justify-center">{icon}</div>}
                <div>
                  <h3 className="text-base font-bold leading-tight">{title}</h3>
                  {subtitle && <p className="text-xs text-mute mt-0.5">{subtitle}</p>}
                </div>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-icon border-0 bg-transparent" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ---------- Toasts ---------- */
type Toast = { id: number; type: "success" | "error" | "info"; text: string };
const ToastCtx = createContext<{ push: (type: Toast["type"], text: string) => void }>({ push: () => {} });
export const useToast = () => {
  const { push } = useContext(ToastCtx);
  return { success: (t: string) => push("success", t), error: (t: string) => push("error", t), info: (t: string) => push("info", t) };
};
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((type: Toast["type"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, type, text }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 4200);
  }, []);
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  const tone = { success: "text-emerald-500", error: "text-rose-500", info: "text-brand" };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[80] flex flex-col gap-2 items-end pointer-events-none" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const I = Icon[t.type];
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}
                className="pointer-events-auto card glass px-4 py-3 flex items-start gap-3 max-w-sm shadow-2xl">
                <I className={`w-5 h-5 mt-0.5 shrink-0 ${tone[t.type]}`} />
                <p className="text-sm font-medium flex-1">{t.text}</p>
                <button onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))} className="text-mute hover:text-ink"><X className="w-4 h-4" /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
};

/* ---------- Helpers ---------- */
export function relTime(iso?: string): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff), m = Math.round(abs / 60000), h = Math.round(abs / 3600000), d = Math.round(abs / 86400000);
  const text = m < 1 ? "vài giây" : m < 60 ? `${m} phút` : h < 24 ? `${h} giờ` : `${d} ngày`;
  return diff > 0 ? `còn ${text}` : `${text} trước`;
}
export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";


/* ---------- Course themes (Classroom-style tonal colours) ---------- */
const THEMES = [
  { color: "#7c5cd6", icon: BookOpen }, { color: "#e5694f", icon: Calculator }, { color: "#1e9e5a", icon: FlaskConical },
  { color: "#2b7de0", icon: Globe2 }, { color: "#d98a00", icon: Music2 }, { color: "#d1357d", icon: Palette },
  { color: "#0e8f8f", icon: Code2 }, { color: "#5b6cff", icon: Brain },
];
export function courseTheme(id: string) {
  const t = THEMES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % THEMES.length];
  return { ...t, bg: `color-mix(in srgb, ${t.color} 16%, var(--surface))`, soft: `color-mix(in srgb, ${t.color} 12%, var(--surface))` };
}
export const CourseArt: React.FC<{ id: string; className?: string }> = ({ id, className = "" }) => {
  const t = courseTheme(id);
  const Icon = t.icon;
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      <div className="absolute -right-6 -top-10 w-40 h-40 rounded-full" style={{ background: t.color, opacity: 0.13 }} />
      <div className="absolute right-20 -bottom-12 w-28 h-28 rounded-[2rem] rotate-12" style={{ background: t.color, opacity: 0.1 }} />
      <div className="absolute right-4 bottom-3 w-3 h-3 rounded-full" style={{ background: t.color, opacity: 0.5 }} />
      <div className="absolute right-28 top-4 w-2 h-2 rounded-full" style={{ background: t.color, opacity: 0.4 }} />
      <motion.div className="absolute right-6 top-1/2 -translate-y-1/2" animate={{ y: [0, -6, 0], rotate: [-4, 4, -4] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in srgb, " + t.color + " 22%, var(--surface))", color: t.color }}>
          <Icon className="w-9 h-9" strokeWidth={1.6} />
        </div>
      </motion.div>
    </div>
  );
};

/* ---------- Collapsible section (Classroom home style) ---------- */
export const Section: React.FC<{ title: string; storageKey?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; large?: boolean; spot?: boolean }> = ({ title, storageKey, action, children, className = "", large, spot }) => {
  const [open, setOpen] = useState(() => {
    try { return storageKey ? localStorage.getItem("sec_" + storageKey) !== "0" : true; } catch { return true; }
  });
  const toggle = () => { setOpen(!open); try { storageKey && localStorage.setItem("sec_" + storageKey, open ? "0" : "1"); } catch { /* ignore */ } };
  return (
    <section className={`panel ${spot ? "spotlight" : ""} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.65rem] leading-tight font-normal tracking-tight">{title}</h2>
        <div className="flex items-center gap-1">
          {action}
          <button onClick={toggle} className="p-2 rounded-full text-ink-2 hover:bg-surface-2" aria-label={open ? "Thu gọn" : "Mở rộng"} aria-expanded={open}>
            {open ? <ChevronsDownUp className="w-5 h-5" /> : <ChevronsUpDown className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export const hasPerm = (user: { role: string; permissions?: string[] } | null, perm: string) => !!user && (user.role === "admin" || !!user.permissions?.includes(perm));
