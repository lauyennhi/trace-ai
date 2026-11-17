import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { HmmLogo } from "../components/HmmBrand";
import { ThinRibbon, HeroLight, LoopLight, AhaLight, AboutLight, FinalLight, INK, COBALT } from "../components/LandingLight";
import { MARK_LIGHT_BG } from "../components/HmmBrand";
import { LandingModals, type LandingModalKind, type JourneyRole } from "../components/LandingModals";

interface Props { onLogin: () => void; onRegister: (role?: JourneyRole) => void; }

const GLASS = "bg-white/80 backdrop-blur-xl border border-black/10";
const FONT = "Inter, 'Be Vietnam Pro', system-ui, sans-serif";
type NavItem = { label: string; to: string } | { label: string; modal: Exclude<LandingModalKind, null> };
const NAV: NavItem[] = [{ label: "Home", to: "top" }, { label: "About Hmm", to: "about" }, { label: "Contact", modal: "contact" }];

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

  const pickRole = (r: JourneyRole) => onRegister(r);
  return (
    <div className="relative min-h-screen bg-[#fbfbfc]" style={{ fontFamily: FONT, color: INK }}>
      <ThinRibbon />
      <header className="fixed top-0 inset-x-0 z-50 px-4 pt-4 sm:px-8 md:px-12 pointer-events-none">
        <div className="mx-auto max-w-[1500px] flex items-center justify-between gap-3">
          <div className={`${GLASS} pointer-events-auto rounded-full px-4 py-2.5`}><HmmLogo colors={MARK_LIGHT_BG} /></div>
          <nav aria-label="Điều hướng" className={`${GLASS} pointer-events-auto hidden md:flex rounded-full px-7 py-2.5 items-center gap-7`}>
            {NAV.map((n, i) => <button key={n.label} onClick={() => pick(n)} className={`text-sm font-medium transition-colors ${i === 0 ? "text-[#1f2328]" : "text-[#5b6470] hover:text-[#1f2328]"}`}>{n.label}</button>)}
          </nav>
          <div className="pointer-events-auto flex items-center gap-2">
            <div className={`${GLASS} hidden md:flex rounded-full p-1.5 items-center gap-1.5`}>
              <button onClick={onLogin} className="rounded-full px-4 py-2 text-[13px] font-medium text-[#1f2328] hover:bg-black/5 transition-colors">Đăng nhập</button>
              <button onClick={() => onRegister()} className="rounded-full px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110" style={{ background: COBALT }}>Đăng ký</button>
            </div>
            <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen} className={`${GLASS} relative z-[70] flex h-10 w-10 items-center justify-center rounded-full md:hidden`}>
              <Menu className={`absolute h-5 w-5 transition-all duration-300 ${menuOpen ? "rotate-90 scale-0 opacity-0" : "scale-100 opacity-100"}`} strokeWidth={1.5} />
              <X className={`absolute h-5 w-5 transition-all duration-300 ${menuOpen ? "scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-[55] flex items-center justify-center bg-white/95 backdrop-blur-xl transition-opacity duration-500 md:hidden ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!menuOpen}>
        <div className="flex flex-col items-center gap-8">
          {NAV.map((n) => <button key={n.label} onClick={() => pick(n)} className="text-2xl font-medium">{n.label}</button>)}
          <div className="flex items-center gap-3">
            <button onClick={() => { setMenuOpen(false); onLogin(); }} className={`${GLASS} rounded-full px-6 py-3 text-sm font-medium`}>Đăng nhập</button>
            <button onClick={() => { setMenuOpen(false); onRegister(); }} className="rounded-full px-6 py-3 text-sm font-semibold text-white" style={{ background: COBALT }}>Đăng ký</button>
          </div>
        </div>
      </div>

      <HeroLight onPick={pickRole} />
      <LoopLight />
      <AhaLight />
      <AboutLight />
      <FinalLight onPick={pickRole} onLogin={onLogin} onContact={() => setModal("contact")} />

      <LandingModals kind={modal} onClose={() => setModal(null)} onSwitch={setModal} onLogin={() => { setModal(null); onLogin(); }} onRegister={(r) => { setModal(null); onRegister(r); }} />
    </div>
  );
};
