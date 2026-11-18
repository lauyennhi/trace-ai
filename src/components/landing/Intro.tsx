import React, { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { ArrowRight, Pause, Volume2 } from "lucide-react";
import { TraceLogo } from "../TraceLogo";
import { playHmm } from "../HmmBrand";
import { NAVY, COBALT, SKY, SOFT, MUTED, MIST, SKY_TEXT, WavyHmm, ScrollWords, Eyebrow, TraceLine, reduced } from "./shared";

// Optional recording of the founder's voice. Put the file in /public and set VITE_HMM_VOICE=/hmm-voice.mp3
const VOICE: string = (import.meta as any).env?.VITE_HMM_VOICE ?? "";

/* =============================================================== HERO */
export const Hero: React.FC<{ onStart: () => void; onListen: () => void }> = ({ onStart, onListen }) => (
  <section id="top" className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-40 pt-28 text-center text-white" style={{ background: `radial-gradient(110% 80% at 50% 0%, #0b3558 0%, ${NAVY} 62%)` }} aria-label="TraceEdu">
    <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "30px 30px", maskImage: "radial-gradient(60% 55% at 50% 42%, #000, transparent)", WebkitMaskImage: "radial-gradient(60% 55% at 50% 42%, #000, transparent)" }} />
    <TraceLine className="absolute inset-x-0 bottom-0 h-[34%] w-full" />
    <div className="relative z-10 flex flex-col items-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}><TraceLogo tone="dark" className="h-9 w-auto sm:h-11" /></motion.div>
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }} className="mt-10 font-medium tracking-[-0.05em] leading-[0.98] text-[clamp(2.8rem,8.4vw,7.4rem)]">
        Tư duy không có<br />
        <span className="relative inline-block">
          <span className="text-white/90">đường tắt.</span>
          {/* the shortcut gets crossed out */}
          <svg className="pointer-events-none absolute -left-[3%] top-[48%] h-[0.35em] w-[106%] overflow-visible" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <motion.path d="M1 7 L99 3" stroke={SKY} strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 1.3, ease: "easeOut" }} />
          </svg>
        </span>
      </motion.h1>
      <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }} className="mt-7 max-w-xl text-[16px] font-normal leading-relaxed sm:text-[19px]" style={{ color: SOFT }}>Trở thành tiêu chuẩn kiểm định nhận thức mới của giáo dục hiện đại.</motion.h2>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }} className="mt-10 flex flex-wrap justify-center gap-3">
        <button onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium transition hover:bg-white/90" style={{ color: NAVY }}>Bắt đầu thử thách <ArrowRight className="h-4 w-4" /></button>
        <button onClick={onListen} className="liquid-glass inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-medium text-white transition hover:bg-white/10"><Volume2 className="h-4 w-4" />Nghe tiếng Hmm</button>
      </motion.div>
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
    <section ref={wrap} id="hmm" className="relative" style={{ height: still ? "auto" : "260svh", background: NAVY }} aria-label="Âm thanh của tư duy">
      <div className={`${still ? "" : "sticky top-0"} flex h-[100svh] flex-col items-center justify-center overflow-hidden px-5 text-center text-white`}>
        <div className="absolute left-1/2 top-1/2 h-[30rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[140px]" style={{ background: COBALT }} />
        <WavyHmm m={still ? 4 : m} className="relative font-medium tracking-[-0.04em] text-[clamp(3rem,10vw,8.5rem)] leading-none whitespace-nowrap" style={SKY_TEXT} />
        {/* waveform: louder as the reader scrolls in, loudest while the sound plays */}
        <motion.div className="relative mt-8 flex h-16 items-center gap-[3px] sm:gap-1" style={{ scaleY: playing ? 1.35 : amp }} aria-hidden="true">
          {Array.from({ length: BARS }, (_, i) => {
            const base = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11));
            return <span key={i} className="hmm-bar block w-[3px] rounded-full sm:w-1" style={{ height: `${base * 100}%`, background: i % 3 ? SKY : "#cfe6ff", animationDelay: `${(i % 14) * -0.09}s`, animationDuration: playing ? "0.45s" : "1.4s" }} />;
          })}
        </motion.div>
        <p className="relative mt-12 max-w-3xl text-[clamp(1.35rem,3.2vw,2.5rem)] font-medium leading-[1.3] tracking-[-0.02em]">
          {SENT.map((w, i) => <FWord key={i} w={w} p={p} a={0.12 + (i / SENT.length) * 0.66} />)}
        </p>
        <button onClick={play} className="liquid-glass relative mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-medium text-white transition hover:bg-white/10">
          {playing ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{playing ? "Đang phát" : "Nghe âm thanh này"}
        </button>
        <style>{`.hmm-bar{animation:hmmbar 1.4s ease-in-out infinite alternate;transform-origin:center}@keyframes hmmbar{from{transform:scaleY(.35)}to{transform:scaleY(1)}}@media (prefers-reduced-motion:reduce){.hmm-bar{animation:none}}`}</style>
      </div>
    </section>
  );
});

/* =============================================================== VISION */
export const Vision: React.FC = () => (
  <section id="vision" className="relative bg-white px-5 py-28 sm:px-8 md:px-14 md:py-44" aria-label="Tầm nhìn">
    <div className="mx-auto max-w-[1100px]">
      <Eyebrow>Tầm nhìn</Eyebrow>
      <ScrollWords className="mt-8 text-[clamp(1.7rem,4.2vw,3.6rem)] font-medium leading-[1.2] tracking-[-0.03em]" text="Tầm nhìn của chúng tôi không phải là một thế giới nơi AI làm tốt hơn con người. Đó là một hệ sinh thái học thuật nơi công nghệ biết lùi lại đúng lúc, để nhường chỗ cho tư duy độc lập được phép bắt đầu." highlight="để nhường chỗ cho tư duy độc lập được phép bắt đầu." />
    </div>
  </section>
);

/* =============================================================== ABOUT */
type Seg = string | { hi: string } | { hmm: true };
const PARAS: Seg[][] = [
  ["Có một nghịch lý của thời đại: Khi đáp án được kết xuất chỉ trong chớp mắt, tư duy của chúng ta lại lướt đi quá vội vàng. Giữa một thế giới ồn ào nơi máy móc tranh nhau mớm lời, TraceEdu xin ", { hi: "một nhịp lùi lại" }, ", để tâm trí của bạn thực sự cất tiếng."],
  ["Chúng tôi tin rằng, vẻ đẹp thực sự của tri thức không nằm ở một văn bản hoàn hảo được sinh ra từ phím tắt. Nó nằm ở ", { hi: "những nốt trầm ngập ngừng" }, ". Là khoảnh khắc ngón tay bạn dừng lại trên bàn phím, nhíu mày hoài nghi, và một tiếng '", { hmm: true }, "' khe khẽ vang lên."],
  ["Đó là lúc tư duy bắt đầu nảy mầm. Là khi bạn tự tay nhặt nhạnh từng mảnh ghép, lần theo những dấu vết nguyên sơ nhất để dệt nên thế giới quan của riêng mình. TraceEdu không tạo ra cỗ máy thông minh hơn con người. Chúng tôi chỉ nâng niu những khoảng lặng, để giữ gìn ", { hi: "thứ ánh sáng độc bản mà không một thuật toán nào có thể sao chép" }, "."],
];

export const About: React.FC = () => {
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", () => {
    const mid = window.innerHeight * 0.55; let best = 0, bd = Infinity;
    els.current.forEach((el, i) => { if (!el) return; const r = el.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = i; } });
    setActive(best);
  });
  return (
    <section id="about" className="relative px-5 py-28 sm:px-8 md:px-14 md:py-40" style={{ background: MIST }} aria-label="About Trace">
      <div className="mx-auto grid max-w-[1150px] gap-12 md:grid-cols-[0.75fr_1.25fr] md:gap-20">
        <div className="md:sticky md:top-[22vh] md:self-start">
          <Eyebrow>About Trace</Eyebrow>
          <h2 className="mt-6 text-[clamp(2.2rem,4.6vw,3.8rem)] font-medium leading-[1.02] tracking-[-0.04em]" style={{ color: NAVY }}>Triết lý<br />vận hành</h2>
          <div className="mt-10 hidden items-center gap-4 md:flex">
            <span className="text-[44px] font-medium tabular-nums tracking-[-0.04em]" style={{ color: COBALT }}>0{active + 1}</span>
            <div className="flex flex-col gap-1.5">{PARAS.map((_, i) => <span key={i} className="h-[3px] rounded-full transition-all duration-500" style={{ width: i === active ? 40 : 16, background: i === active ? COBALT : "rgba(4,27,45,0.15)" }} />)}</div>
          </div>
        </div>
        <div className="space-y-16 md:space-y-28">
          {PARAS.map((segs, i) => (
            <motion.div key={i} ref={(el) => { els.current[i] = el; }} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-15% 0px" }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}>
              <p className="text-[19px] leading-[1.7] sm:text-[22px] md:text-[24px]" style={{ color: i === active ? NAVY : MUTED, transition: "color .5s" }}>
                {segs.map((s, k) => typeof s === "string" ? <React.Fragment key={k}>{s}</React.Fragment> : "hi" in s ? <span key={k} className="font-medium" style={{ color: COBALT }}>{s.hi}</span> : <WavyHmm key={k} m={2} className="font-semibold" style={{ color: COBALT }} />)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
