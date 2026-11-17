import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HmmMark, LETTERS, MARK_LIGHT_BG, MARK_DARK_BG } from "./HmmBrand";

/**
 * The opening story, one sticky stage driven by scroll:
 * giant "hmm..." → it tilts → stands up as a column h / m / m on the left → Human · Machine · Mind →
 * "Human meets Machine to build the Mind." → the positioning sentence, revealed word by word.
 */
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, k: number) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(lerp(v, B[i], k)).toString(16).padStart(2, "0")).join(""); };
const at3 = (c: [string, string, string], f: number) => (f < 0.5 ? mixHex(c[0], c[1], f * 2) : mixHex(c[1], c[2], (f - 0.5) * 2));

const WORDS = ["Human", "Machine", "Mind"] as const;
const POSITION = "Đây là âm thanh của một bộ óc đang tư duy. Và nền tảng của chúng tôi được sinh ra để bảo vệ âm thanh này trong kỷ nguyên AI.".split(" ");
const GRAD = "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)";

export const StoryHmm: React.FC = () => {
  const wrap = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [size, setSize] = useState({ w: 1440, h: 860 });
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    const f = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
  }, []);
  useEffect(() => {
    if (still) { setP(0.72); return; }
    let raf = 0;
    const update = () => { raf = 0; if (!wrap.current) return; const r = wrap.current.getBoundingClientRect(); setP(clamp(-r.top / Math.max(1, r.height - window.innerHeight))); };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [still]);

  const { w: vw, h: vh } = size, small = vw < 700;
  // geometry of the giant logo (units: the logo's own drawing space, origin 150,150, 830 x 290)
  const u = Math.min(vw * 0.9, 1150) / 830;
  const ox = (vw - 830 * u) / 2, oy = vh / 2 - 145 * u;
  // geometry of the column
  const es = Math.min((vh * 0.2) / 158, (vw * 0.3) / 224);
  const gap = vh * 0.045, colH = (220 + 158 + 158) * es + 2 * gap;
  const colX = small ? vw * 0.07 : vw * 0.09, colY = (vh - colH) / 2;
  const colTop = [colY, colY + 220 * es + gap, colY + (220 + 158) * es + 2 * gap];
  const textX = colX + 224 * es + (small ? 16 : 40);

  const dark = sm(0.2, 0.38, p);
  const colors = MARK_LIGHT_BG.map((c, i) => mixHex(c, MARK_DARK_BG[i], dark)) as [string, string, string];
  const bg = mixHex("#ffffff", "#060914", dark);
  const tilt = -11 * sm(0.07, 0.14, p), stand = sm(0.15, 0.3, p);
  const rot = tilt * (1 - stand);
  const joined = 1 - sm(0.04, 0.07, p);
  const letters = sm(0.04, 0.07, p) * (1 - sm(0.62, 0.68, p));
  const wordsK = [sm(0.31, 0.36, p), sm(0.37, 0.42, p), sm(0.43, 0.48, p)];
  const wordsOut = sm(0.52, 0.57, p);
  const sentence = sm(0.55, 0.6, p) * (1 - sm(0.64, 0.69, p));
  const posOn = sm(0.66, 0.7, p), posOut = sm(0.93, 0.99, p);
  const fontW = Math.min(vh * 0.13, vw * 0.11), fontS = Math.min(vh * 0.075, vw * 0.075);

  return (
    <section ref={wrap} id="top" className="relative" style={{ height: still ? "100svh" : "620svh" }} aria-label="hmm: Human, Machine, Mind">
      <div className="sticky top-0 h-[100svh] overflow-hidden" style={{ background: bg }}>
        {/* tilt + stand-up wrapper */}
        <div className="absolute inset-0" style={{ transform: `rotate(${rot}deg)`, transformOrigin: "50% 55%" }}>
          <div className="absolute" style={{ left: ox, top: oy, width: 830 * u, opacity: joined, pointerEvents: "none" }}>
            <HmmMark className="w-full h-auto block" colors={colors} dots draw />
          </div>
          {LETTERS.map((l, i) => {
            const s = lerp(u, es, stand);
            const x = lerp(ox + (l.bx - 150) * u, colX, stand), y = lerp(oy + (l.by - 150) * u, colTop[i], stand);
            const c0 = at3(colors, i / 3), c1 = at3(colors, (i + 1) / 3 - 0.001);
            return (
              <svg key={l.key} viewBox={`${l.bx} ${l.by} ${l.bw} ${l.bh}`} className="absolute" aria-hidden="true" style={{ left: x, top: y, width: l.bw * s, height: l.bh * s, opacity: letters }} overflow="visible">
                <defs><linearGradient id={`st-${l.key}`} gradientUnits="userSpaceOnUse" x1={l.bx} y1="0" x2={l.bx + l.bw} y2="0"><stop offset="0" stopColor={c0} /><stop offset="1" stopColor={c1} /></linearGradient></defs>
                <path d={l.d} fill="none" stroke={`url(#st-${l.key})`} strokeWidth="40" />
              </svg>
            );
          })}
        </div>

        {/* Human / Machine / Mind, one per letter */}
        {WORDS.map((w, i) => {
          const centre = colTop[i] + (LETTERS[i].bh * es) / 2;
          return (
            <div key={w} className="absolute font-semibold tracking-[-0.04em] leading-none text-white whitespace-nowrap" style={{ left: textX, top: centre, fontSize: fontW, transform: `translate(${(1 - wordsK[i]) * 40}px,-50%)`, opacity: wordsK[i] * (1 - wordsOut) }}>
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>{w[0]}</span>{w.slice(1)}
            </div>
          );
        })}

        {/* the sentence */}
        <div className="absolute" style={{ left: textX, right: small ? 20 : 56, top: "50%", transform: `translateY(calc(-50% + ${(1 - sentence) * 24}px))`, opacity: sentence }}>
          <p className="font-semibold tracking-[-0.035em] leading-[1.1] text-white/90" style={{ fontSize: fontS }}>
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>Human</span> meets <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>Machine</span> to build the <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>Mind</span>.
          </p>
        </div>

        {/* positioning, word by word */}
        <div className="absolute inset-0 flex items-center px-6 md:px-16 lg:px-24" style={{ opacity: posOn * (1 - posOut), pointerEvents: "none" }}>
          <p className="max-w-[1100px] font-semibold tracking-[-0.03em] leading-[1.14] text-[clamp(1.6rem,4.2vw,3.7rem)]">
            {POSITION.map((word, i) => {
              const a = 0.66 + (i / POSITION.length) * 0.22, k = sm(a, a + 0.03, p) * 1;
              const strong = i < 10;
              return <span key={i} className={strong ? "text-white" : "text-white/70"} style={{ opacity: 0.12 + 0.88 * k * (posOn > 0 ? 1 : 0) }}>{word} </span>;
            })}
          </p>
        </div>

        <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-2 text-[12px] tracking-[0.2em] uppercase text-gray-500" style={{ opacity: 1 - sm(0.02, 0.1, p) }}>
          <span>cuộn xuống</span><span className="block h-6 w-px bg-current" />
        </div>
      </div>
    </section>
  );
};
