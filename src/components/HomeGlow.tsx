import React, { useEffect, useRef } from "react";

/** Very faint, blurry light that eases after the cursor. Mounted on the home page only. */
export const HomeGlow: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(hover: hover)").matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, visible = false;
    const loop = () => {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      el.style.transform = `translate3d(${x - 280}px, ${y - 280}px, 0)`;
      raf = Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    const move = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY;
      if (!visible) { x = tx; y = ty; visible = true; el.style.opacity = "1"; }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const leave = () => { visible = false; el.style.opacity = "0"; };
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => { window.removeEventListener("pointermove", move); document.documentElement.removeEventListener("mouseleave", leave); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed left-0 top-0 z-30 w-[560px] h-[560px] rounded-full opacity-0 transition-opacity duration-700"
      style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--brand) 15%, transparent) 0%, color-mix(in srgb, var(--brand-2) 7%, transparent) 38%, transparent 68%)", filter: "blur(26px)", willChange: "transform" }} />
  );
};

/** Delegated handler: gives every `.spotlight` element (and its spotlight ancestors) the cursor position as CSS variables. */
export function useSpotlight(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onMove = (e: PointerEvent) => {
      let el = (e.target as HTMLElement | null)?.closest?.(".spotlight") as HTMLElement | null;
      while (el) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        el = el.parentElement?.closest(".spotlight") as HTMLElement | null;
      }
    };
    root.addEventListener("pointermove", onMove);
    return () => root.removeEventListener("pointermove", onMove);
  }, [containerRef]);
}
