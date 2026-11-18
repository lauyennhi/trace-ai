import React, { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { ArrowRight, BadgeCheck, Brain, MessageSquareText, Pause, ShieldCheck, Volume2 } from "lucide-react";
import { INFINITY_CLOSED } from "../TraceLogo";
import { InkTrail } from "../InkTrail";
import { playHmm } from "../HmmBrand";
import { NAVY, COBALT, SKY, MUTED, MIST, BLUE_TEXT, LIGHT_BG, WavyHmm, ScrollWords, Eyebrow, reduced } from "./shared";

// Optional recording of the founder's voice. Put the file in /public and set VITE_HMM_VOICE=/hmm-voice.mp3
const VOICE: string = (import.meta as any).env?.VITE_HMM_VOICE ?? "";

/* =============================================================== HERO */
const BLOBS = [["#428CD4", "8%", "12%", 34, 0], ["#004E9A", "62%", "4%", 30, -6], ["#7db8ee", "70%", "58%", 26, -11], ["#428CD4", "18%", "64%", 22, -3]] as const;
export const Blobs: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    {BLOBS.map(([c, l, t, size, d], i) => <span key={i} className="hero-blob absolute rounded-full" style={{ background: c, left: l, top: t, width: `${size}rem`, height: `${size}rem`, animationDelay: `${d}s` }} />)}
    <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "radial-gradient(rgba(4,27,45,0.18) 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(75% 70% at 40% 45%, #000, transparent)", WebkitMaskImage: "radial-gradient(75% 70% at 40% 45%, #000, transparent)" }} />
    <style>{`.hero-blob{filter:blur(90px);opacity:.28;animation:blobdrift 18s ease-in-out infinite alternate}@keyframes blobdrift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(6%,-8%) scale(1.15)}100%{transform:translate(-6%,6%) scale(.92)}}.float-y{animation:floaty 6s ease-in-out infinite}@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@media (prefers-reduced-motion:reduce){.hero-blob,.float-y{animation:none}}`}</style>
  </div>
);

/** The signature: the infinity loop of the logo, big, with two lights (Human and Machine) chasing each other through it. */
const InfinityStage: React.FC = () => {
  const still = reduced();
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[560px]" aria-hidden="true">
      <svg viewBox="150 20 250 140" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="inf-g" x1="170" x2="330" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={COBALT} /><stop offset="1" stopColor={SKY} /></linearGradient>
          <filter id="inf-glow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="5" /></filter>
          <radialGradient id="orb-g"><stop offset="0" stopColor="#ffffff" /><stop offset="0.4" stopColor="#bfe0ff" /><stop offset="1" stopColor={SKY} stopOpacity="0" /></radialGradient>
          <path id="inf-path" d={INFINITY_CLOSED} />
        </defs>
        <motion.path d={INFINITY_CLOSED} fill="none" stroke={SKY} strokeOpacity="0.35" strokeWidth="18" filter="url(#inf-glow)" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease: "easeInOut" }} />
        <motion.path d={INFINITY_CLOSED} fill="none" stroke="url(#inf-g)" strokeWidth="11" strokeLinecap="round" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease: "easeInOut" }} />
        {!still && [0, -3.5].map((begin, i) => (
          <g key={i}>
            <circle r="9" fill="url(#orb-g)"><animateMotion dur="7s" repeatCount="indefinite" begin={`${2.2 + begin}s`} rotate="auto"><mpath href="#inf-path" /></animateMotion></circle>
            <circle r="2.6" fill="#ffffff"><animateMotion dur="7s" repeatCount="indefinite" begin={`${2.2 + begin}s`}><mpath href="#inf-path" /></animateMotion></circle>
          </g>
        ))}
        <text x="208" y="83" textAnchor="middle" fontSize="8" fontWeight="600" fill={NAVY}>Human</text>
        <text x="292" y="83" textAnchor="middle" fontSize="8" fontWeight="600" fill={NAVY}>Machine</text>
        <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.3, type: "spring" }} style={{ transformOrigin: "250px 80px" }}>
          <rect x="232" y="128" width="36" height="14" rx="7" fill={COBALT} /><text x="250" y="137.5" textAnchor="middle" fontSize="7" fontWeight="600" fill="#ffffff">Mind</text>
        </motion.g>
      </svg>
      {/* floating evidence cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }} className="float-y absolute left-[2%] top-[4%] rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-[0_18px_40px_-18px_rgba(4,27,45,0.35)] backdrop-blur" style={{ animationDelay: "-1s" }}>
        <div className="text-[11px]" style={{ color: MUTED }}>AI đang nghĩ cùng bạn</div>
        <div className="text-[18px] font-semibold" style={{ color: COBALT }}><WavyHmm m={4} /></div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.8 }} className="float-y absolute right-[0%] top-[14%] rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-[0_18px_40px_-18px_rgba(4,27,45,0.35)] backdrop-blur" style={{ animationDelay: "-3s" }}>
        <div className="text-[11px]" style={{ color: MUTED }}>Phản biện</div>
        <div className="flex items-baseline gap-1.5"><span className="text-[20px] font-semibold" style={{ color: NAVY }}>86</span><span className="text-[12px] font-semibold text-[#16a34a]">+12</span></div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.1 }} className="float-y absolute bottom-[6%] right-[8%] inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-2 text-[13px] font-semibold shadow-[0_18px_40px_-18px_rgba(4,27,45,0.35)] backdrop-blur" style={{ color: "#16a34a", animationDelay: "-2s" }}>
        <BadgeCheck className="h-4 w-4" />Verified Mind
      </motion.div>
    </div>
  );
};

const PILLS = [[Brain, "Chấm 5 tiêu chí tư duy"], [MessageSquareText, "Nhật ký chat minh bạch"], [ShieldCheck, "Chống nhờ AI làm hộ"]] as const;

export const Hero: React.FC<{ onStart: () => void; onListen: () => void }> = ({ onStart, onListen }) => (
  <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden px-5 pb-16 pt-32 sm:px-8 md:px-14" style={{ background: LIGHT_BG, color: NAVY }} aria-label="TraceEdu">
    <Blobs />
    <InkTrail strength={0.55} blur={20} />
    <div className="relative z-10 mx-auto grid w-full max-w-[1320px] items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 text-[12px] font-medium shadow-sm backdrop-blur" style={{ color: COBALT }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: SKY }} />Human · Machine · Mind</motion.div>
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="mt-7 font-semibold leading-[1.02] tracking-[-0.045em] text-[clamp(2.6rem,5.4vw,5.4rem)]">
          Tư duy không có<br />
          <span className="relative inline-block text-[#8a9bb0]">đường tắt
            <motion.span className="absolute left-[-2%] top-[50%] h-[0.075em] w-[48%] -rotate-3 rounded-full bg-[#e5484d]" style={{ originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.1, duration: 0.35 }} />
            <motion.span className="absolute left-[54%] top-[56%] h-[0.075em] w-[48%] -rotate-2 rounded-full bg-[#e5484d]" style={{ originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.45, duration: 0.35 }} />
          </span><span>.</span>
        </motion.h1>
        {/* the real path: a looping trace instead of a straight shortcut */}
        <svg viewBox="0 0 420 46" className="mt-1 h-[clamp(28px,4vw,46px)] w-auto overflow-visible" aria-hidden="true">
          <defs><linearGradient id="hero-tr" x1="0" x2="1"><stop offset="0" stopColor={COBALT} /><stop offset="1" stopColor={SKY} /></linearGradient></defs>
          <motion.path d="M4 30 C 60 30, 80 8, 120 14 C 160 20, 150 42, 128 38 C 104 34, 122 6, 170 10 S 260 40, 300 24 S 380 8, 410 18" fill="none" stroke="url(#hero-tr)" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.8, duration: 1.4, ease: "easeInOut" }} />
          <motion.circle cx="410" cy="18" r="7" fill={SKY} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: [0, 1.3, 1] }} transition={{ delay: 3.1, duration: 0.5 }} />
        </svg>
        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }} className="mt-6 max-w-xl text-[17px] font-normal leading-relaxed sm:text-[20px]" style={{ color: "#3c5268" }}>Trở thành tiêu chuẩn kiểm định nhận thức mới của <b className="font-semibold" style={{ color: NAVY }}>giáo dục hiện đại</b>.</motion.h2>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55 }} className="mt-9 flex flex-wrap gap-3">
          <button onClick={onStart} className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(0,78,154,0.7)] transition hover:brightness-110" style={{ background: `linear-gradient(90deg,${COBALT},${SKY})` }}>Bắt đầu thử thách <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
          <button onClick={onListen} className="inline-flex items-center gap-2 rounded-full border border-[#004E9A]/15 bg-white/80 px-7 py-3.5 text-[15px] font-semibold backdrop-blur transition hover:bg-white" style={{ color: NAVY }}><Volume2 className="h-4 w-4" style={{ color: COBALT }} />Nghe tiếng Hmm</button>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-10 flex flex-wrap gap-2.5">
          {PILLS.map(([Icon, t]) => <span key={t} className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-[13px] font-medium shadow-sm backdrop-blur" style={{ color: NAVY }}><Icon className="h-4 w-4" style={{ color: COBALT }} />{t}</span>)}
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.2 }}><InfinityStage /></motion.div>
    </div>
  </section>
);

/* =============================================================== THE SOUND OF THINKING */
const SENT = "Đây là âm thanh của một bộ óc đang tư duy. Và nền tảng của chúng tôi được sinh ra để bảo vệ âm thanh này trong kỷ nguyên AI.".split(" ");
const FWord: React.FC<{ w: string; p: MotionValue<number>; a: number }> = ({ w, p, a }) => {
  const o = useTransform(p, [a, a + 0.05], [0.14, 1]);
  return <motion.span style={{ opacity: o }}>{w} </motion.span>;
};
const BARS = 56;

export const HmmVoice = React.forwardRef<{ play: () => void }>((_, api) => {
  const wrap = useRef<HTMLElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const { scrollYProgress: p } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  const [m, setM] = useState(2), [playing, setPlaying] = useState(false);
  useMotionValueEvent(p, "change", (v) => setM(2 + Math.round(Math.min(1, v / 0.55) * 5)));
  const amp = useTransform(p, [0, 0.5], [0.25, 1]);
  const play = () => {
    if (playing) { audio.current?.pause(); setPlaying(false); return; }
    setPlaying(true);
    if (VOICE) {
      audio.current = audio.current ?? new Audio(VOICE);
      audio.current.currentTime = 0; audio.current.onended = () => setPlaying(false);
      audio.current.play().catch(() => { playHmm(); setTimeout(() => setPlaying(false), 1600); });
    } else { playHmm(); setTimeout(() => setPlaying(false), 1600); }
  };
  React.useImperativeHandle(api, () => ({ play }));
  const still = reduced();
  return (
    <section ref={wrap} id="hmm" className="relative" style={{ height: still ? "auto" : "240svh", background: "linear-gradient(180deg,#f8fbff,#eef5fc)" }} aria-label="Âm thanh của tư duy">
      <div className={`${still ? "" : "sticky top-0"} flex h-[100svh] flex-col items-center justify-center overflow-hidden px-5 text-center`} style={{ color: NAVY }}>
        <div className="absolute left-1/2 top-1/2 h-[30rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[140px]" style={{ background: SKY }} />
        <WavyHmm m={still ? 4 : m} className="relative font-medium tracking-[-0.04em] text-[clamp(3rem,10vw,8.5rem)] leading-none whitespace-nowrap" style={BLUE_TEXT} />
        {/* waveform: louder as the reader scrolls in, loudest while the sound plays */}
        <motion.div className="relative mt-8 flex h-16 items-center gap-[3px] sm:gap-1" style={{ scaleY: playing ? 1.35 : amp }} aria-hidden="true">
          {Array.from({ length: BARS }, (_, i) => {
            const base = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11));
            return <span key={i} className="hmm-bar block w-[3px] rounded-full sm:w-1" style={{ height: `${base * 100}%`, background: i % 3 ? SKY : COBALT, animationDelay: `${(i % 14) * -0.09}s`, animationDuration: playing ? "0.45s" : "1.4s" }} />;
          })}
        </motion.div>
        <p className="relative mt-12 max-w-3xl text-[clamp(1.35rem,3.2vw,2.5rem)] font-medium leading-[1.3] tracking-[-0.02em]">
          {SENT.map((w, i) => <FWord key={i} w={w} p={p} a={0.12 + (i / SENT.length) * 0.66} />)}
        </p>
        <button onClick={play} className="relative mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(0,78,154,0.7)] transition hover:brightness-110" style={{ background: `linear-gradient(90deg,${COBALT},${SKY})` }}>
          {playing ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{playing ? "Đang phát" : "Nghe âm thanh này"}
        </button>
        <style>{`.hmm-bar{animation:hmmbar 1.4s ease-in-out infinite alternate;transform-origin:center}@keyframes hmmbar{from{transform:scaleY(.35)}to{transform:scaleY(1)}}@media (prefers-reduced-motion:reduce){.hmm-bar{animation:none}}`}</style>
      </div>
    </section>
  );
});

/* =============================================================== VISION */
export const Vision: React.FC = () => (
  <section id="vision" className="relative bg-white text-[#041B2D] px-5 py-28 sm:px-8 md:px-14 md:py-44" aria-label="Tầm nhìn">
    <div className="mx-auto max-w-[1100px]">
      <Eyebrow>Tầm nhìn</Eyebrow>
      <ScrollWords className="mt-8 text-[clamp(1.7rem,4.2vw,3.6rem)] font-medium leading-[1.2] tracking-[-0.03em]" text="Tầm nhìn của chúng tôi không phải là một thế giới nơi AI làm tốt hơn con người. Đó là một hệ sinh thái học thuật nơi công nghệ biết lùi lại đúng lúc, để nhường chỗ cho tư duy độc lập được phép bắt đầu." highlight="để nhường chỗ cho tư duy độc lập được phép bắt đầu." />
    </div>
  </section>
);
