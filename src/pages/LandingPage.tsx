import React, { useEffect, useState } from "react";
import { Menu, X, UserRound } from "lucide-react";
import { TraceJourney } from "../components/TraceJourney";
import { SocraticSection, PortfolioSection } from "../components/LandingVisuals";
import { LandingModals, type LandingModalKind, type JourneyRole } from "../components/LandingModals";

interface Props { onLogin: () => void; onRegister: (role?: JourneyRole) => void; }

const GRAD = "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)";
const GLASS = "bg-[#0b0f1c]/65 backdrop-blur-xl border border-white/10";
const FONT = "Inter, 'Be Vietnam Pro', system-ui, sans-serif";
type NavItem = { label: string; to: string } | { label: string; modal: Exclude<LandingModalKind, null> };
const NAV: NavItem[] = [{ label: "Trang chủ", to: "top" }, { label: "Cách tiếp cận", modal: "approach" }, { label: "Phương pháp", modal: "methods" }, { label: "Hồ sơ", to: "ho-so" }];
const LOGO = "M 128 128 C 198.692 128 256 185.308 256 256 L 151.883 256 C 149.812 220.307 120.213 192 84 192 C 47.787 192 18.188 220.307 16.117 256 L 0 256 C 0 185.308 57.308 128 128 128 Z M 104.117 0 C 106.188 35.694 135.787 64 172 64 C 208.213 64 237.812 35.694 239.883 0 L 256 0 C 256 70.692 198.692 128 128 128 C 57.308 128 0 70.692 0 0 Z";

export const LandingPage: React.FC<Props> = ({ onLogin, onRegister }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<LandingModalKind>(null);
  useEffect(() => { document.body.style.overflow = menuOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [menuOpen]);
  const pick = (n: NavItem) => {
    setMenuOpen(false);
    if ("modal" in n) setModal(n.modal);
    else if (n.to === "top") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(n.to)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#060914] text-white" style={{ fontFamily: FONT }}>
      <header className="fixed top-0 inset-x-0 z-50 px-4 pt-4 sm:px-8 md:px-12 pointer-events-none">
        <div className="mx-auto max-w-[1500px] flex items-center justify-between gap-3">
          <div className={`${GLASS} pointer-events-auto rounded-full pl-3 pr-4 py-2 flex items-center gap-2.5`}>
            <svg viewBox="0 0 256 256" className="h-7 w-7" fill="white" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d={LOGO} /></svg>
            <span className="text-[17px] font-medium tracking-tight">Trace</span>
          </div>
          <nav aria-label="Trang chủ" className={`${GLASS} pointer-events-auto hidden md:flex rounded-full px-7 py-2.5 items-center gap-7`}>
            {NAV.map((n, i) => <button key={n.label} onClick={() => pick(n)} className={`text-sm font-medium transition-colors ${i === 0 ? "text-white" : "text-white/70 hover:text-white"}`}>{n.label}</button>)}
          </nav>
          <div className="pointer-events-auto flex items-center gap-2">
            <div className={`${GLASS} hidden md:flex rounded-full p-1.5 items-center gap-1.5`}>
              <button onClick={onLogin} className="rounded-full px-4 py-2 text-[13px] font-medium text-white/90 hover:bg-white/10 transition-colors">Đăng nhập</button>
              <button onClick={() => onRegister()} className="rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110" style={{ background: GRAD }}>Đăng ký</button>
            </div>
            <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen} className={`${GLASS} relative z-[70] flex h-10 w-10 items-center justify-center rounded-full md:hidden`}>
              <Menu className={`absolute h-5 w-5 transition-all duration-300 ${menuOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} strokeWidth={1.5} />
              <X className={`absolute h-5 w-5 transition-all duration-300 ${menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-[55] flex items-center justify-center bg-black/80 backdrop-blur-xl transition-opacity duration-500 ease-out md:hidden ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!menuOpen}>
        <div className={`flex flex-col items-center gap-8 transition-transform duration-500 ease-out ${menuOpen ? "translate-y-0" : "-translate-y-8"}`}>
          {NAV.map((n, i) => <button key={n.label} onClick={() => pick(n)} className={`text-2xl font-medium ${i === 0 ? "text-white" : "text-white/70"}`}>{n.label}</button>)}
          <div className="flex items-center gap-3">
            <button onClick={() => { setMenuOpen(false); onLogin(); }} className={`${GLASS} rounded-full px-6 py-3 text-sm font-medium`}>Đăng nhập</button>
            <button onClick={() => { setMenuOpen(false); onRegister(); }} className="rounded-full px-6 py-3 text-sm font-semibold" style={{ background: GRAD }}>Đăng ký</button>
          </div>
          <button onClick={() => { setMenuOpen(false); setModal("account"); }} className="flex items-center gap-3"><span className={`${GLASS} flex h-10 w-10 items-center justify-center rounded-full`}><UserRound className="h-5 w-5 text-white/80" strokeWidth={1.5} /></span><span className="text-sm font-light text-white/60">Tài khoản</span></button>
        </div>
      </div>

      <div id="top"><TraceJourney onStart={() => setModal("journey")} onMethods={() => setModal("methods")} /></div>

      <SocraticSection />
      <PortfolioSection />

      <section className="relative overflow-hidden px-5 md:px-12 py-20" style={{ background: "linear-gradient(120deg,#0b2a6b,#4f2fc9 55%,#a21caf)" }}>
        <div className="relative max-w-[1300px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <h2 className="text-[clamp(1.8rem,4vw,3.2rem)] font-medium tracking-[-0.03em] leading-[1.08] max-w-2xl">Sẵn sàng đọc dấu vết tư duy của lớp học?</h2>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => setModal("journey")} className="rounded-full bg-white text-[#2a1a7a] px-6 py-3 text-[14px] font-semibold hover:bg-white/90 transition-colors">Bắt đầu với Trace</button>
            <button onClick={onLogin} className="rounded-full border border-white/40 px-6 py-3 text-[14px] font-medium hover:bg-white/10 transition-colors">Đăng nhập</button>
          </div>
        </div>
      </section>
      <footer className="px-5 md:px-12 py-8 text-xs text-white/45">
        <div className="max-w-[1300px] mx-auto flex flex-wrap items-center justify-between gap-2"><span>Trace. Less paste, more Trace.</span><span>Hình minh họa trên trang này không phải số liệu thật.</span></div>
      </footer>

      <LandingModals kind={modal} onClose={() => setModal(null)} onSwitch={setModal} onLogin={() => { setModal(null); onLogin(); }} onRegister={(r) => { setModal(null); onRegister(r); }} />
    </div>
  );
};
