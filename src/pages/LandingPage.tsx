import React, { useEffect, useState } from "react";
import { Menu, X, UserRound } from "lucide-react";
import { HmmLogo } from "../components/HmmBrand";
import { HeroHmm, LoopHmm, AhaHmm, FinalHmm } from "../components/LandingHmm";
import { LandingModals, type LandingModalKind, type JourneyRole } from "../components/LandingModals";

interface Props { onLogin: () => void; onRegister: (role?: JourneyRole) => void; }

const GRAD = "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)";
const GLASS = "bg-[#0b0f1c]/65 backdrop-blur-xl border border-white/10";
const FONT = "Inter, 'Be Vietnam Pro', system-ui, sans-serif";
type NavItem = { label: string; to: string } | { label: string; modal: Exclude<LandingModalKind, null> };
const NAV: NavItem[] = [{ label: "Trang chủ", to: "top" }, { label: "Vòng lặp", to: "vong-lap" }, { label: "Cách tiếp cận", modal: "approach" }, { label: "Phương pháp", modal: "methods" }, { label: "Hồ sơ", to: "aha" }];

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
            <HmmLogo />
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

      <HeroHmm onExperience={() => document.getElementById("vong-lap")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <LoopHmm />
      <AhaHmm />
      <FinalHmm onStart={() => setModal("journey")} />
      <footer className="px-5 md:px-12 py-8 text-xs text-white/45">
        <div className="max-w-[1300px] mx-auto flex flex-wrap items-center justify-between gap-2"><span>hmm. Less paste, more hmm. · H.M.M. = Human · Machine · Mind</span><span>Hình minh họa trên trang này không phải số liệu thật.</span></div>
      </footer>

      <LandingModals kind={modal} onClose={() => setModal(null)} onSwitch={setModal} onLogin={() => { setModal(null); onLogin(); }} onRegister={(r) => { setModal(null); onRegister(r); }} />
    </div>
  );
};
