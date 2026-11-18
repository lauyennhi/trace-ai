import React, { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { TraceLogo } from "../components/TraceLogo";
import { Hero, HmmVoice, Vision, About } from "../components/landing/Intro";
import { Loop } from "../components/landing/Loop";
import { HMM, Aha, CTA, Contact } from "../components/landing/Outro";
import { LandingModals, type LandingModalKind, type JourneyRole } from "../components/LandingModals";

interface Props { onLogin: () => void; onRegister: (role?: JourneyRole) => void; }

const FONT = "'Geist', 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const GLASS = "liquid-glass nav-glass";
const NAV = [["Home", "top"], ["Tầm nhìn", "vision"], ["About Trace", "about"], ["H.M.M", "hmm-meaning"], ["Liên hệ", "contact"]] as const;

export const LandingPage: React.FC<Props> = ({ onLogin, onRegister }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<LandingModalKind>(null);
  const [scrolled, setScrolled] = useState(false);
  const voice = useRef<{ play: () => void }>(null);
  useEffect(() => { document.body.style.overflow = menuOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [menuOpen]);
  useEffect(() => { const on = () => setScrolled(window.scrollY > window.innerHeight * 0.6); on(); window.addEventListener("scroll", on, { passive: true }); return () => window.removeEventListener("scroll", on); }, []);
  const go = (id: string) => { setMenuOpen(false); if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" }); else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const listen = () => { go("hmm"); setTimeout(() => voice.current?.play(), 700); };

  return (
    <div className="relative min-h-screen bg-[#041B2D] text-white" style={{ fontFamily: FONT }}>
      <style>{`.liquid-glass.nav-glass{background:rgba(4,27,45,0.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}`}</style>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-8 md:px-12">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <button onClick={() => go("top")} className={`${GLASS} pointer-events-auto rounded-full px-4 py-2.5 transition-all duration-500 ${scrolled ? "opacity-100" : "md:pointer-events-none md:-translate-y-2 md:opacity-0"}`} aria-label="TraceEdu, về đầu trang"><TraceLogo tone="dark" className="h-6 w-auto" /></button>
          <nav aria-label="Điều hướng" className={`${GLASS} pointer-events-auto hidden items-center gap-6 rounded-full px-7 py-2.5 md:flex`}>
            {NAV.map(([l, id]) => <button key={id} onClick={() => go(id)} className="text-sm font-medium text-white/70 transition-colors hover:text-white">{l}</button>)}
          </nav>
          <div className="pointer-events-auto flex items-center gap-2">
            <div className={`${GLASS} hidden items-center gap-1.5 rounded-full p-1.5 md:flex`}>
              <button onClick={onLogin} className="rounded-full px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/10">Đăng nhập</button>
              <button onClick={() => onRegister()} className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#041B2D] transition hover:bg-white/90">Đăng ký</button>
            </div>
            <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen} className={`${GLASS} relative z-[70] flex h-10 w-10 items-center justify-center rounded-full md:hidden`}>
              {menuOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-[55] flex items-center justify-center bg-[#041B2D]/95 backdrop-blur-xl transition-opacity duration-500 md:hidden ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!menuOpen}>
        <div className="flex flex-col items-center gap-7">
          {NAV.map(([l, id]) => <button key={id} onClick={() => go(id)} className="text-2xl font-medium">{l}</button>)}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => { setMenuOpen(false); onLogin(); }} className={`${GLASS} rounded-full px-6 py-3 text-sm font-medium`}>Đăng nhập</button>
            <button onClick={() => { setMenuOpen(false); onRegister(); }} className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#041B2D]">Đăng ký</button>
          </div>
        </div>
      </div>

      <Hero onStart={() => setModal("journey")} onListen={listen} />
      <HmmVoice ref={voice} />
      <Vision />
      <About />
      <HMM />
      <Loop />
      <Aha />
      <CTA onPick={(r) => onRegister(r)} />
      <Contact onLogin={onLogin} />

      <LandingModals kind={modal} onClose={() => setModal(null)} onSwitch={setModal} onLogin={() => { setModal(null); onLogin(); }} onRegister={(r) => { setModal(null); onRegister(r); }} />
    </div>
  );
};
