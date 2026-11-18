import React, { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Mail, MapPin, Phone, Send } from "lucide-react";
import { TraceLogo } from "../TraceLogo";
import { HmmLoader } from "../HmmBrand";
import { NAVY, COBALT, SKY, SOFT, MUTED, MIST, GREEN, SKY_TEXT, Eyebrow, TraceLine } from "./shared";

export type Role = "student" | "teacher";

/* =============================================================== H.M.M */
const LETTERS = [["H", "Human", "Con người"], ["M", "Machine", "Công cụ"], ["M", "Mind", "Trí tuệ"]] as const;

const Node: React.FC<{ x: number; y: number; label: string; glow?: boolean; dim?: boolean }> = ({ x, y, label, glow, dim }) => (
  <g opacity={dim ? 0.55 : 1}>
    {glow && <circle cx={x} cy={y} r="40" fill={SKY} opacity="0.25"><animate attributeName="r" values="34;44;34" dur="3s" repeatCount="indefinite" /></circle>}
    <circle cx={x} cy={y} r="30" fill={glow ? SKY : "rgba(255,255,255,0.06)"} stroke={glow ? "#cfe6ff" : "rgba(255,255,255,0.35)"} strokeWidth="1.5" />
    <text x={x} y={y + 52} textAnchor="middle" fontSize="13" fill={glow ? "#ffffff" : SOFT}>{label}</text>
    <text x={x} y={y + 5} textAnchor="middle" fontSize="15" fontWeight="600" fill={glow ? NAVY : "#ffffff"}>{label[0]}</text>
  </g>
);

export const HMM: React.FC = () => (
  <section id="hmm-meaning" className="relative overflow-hidden px-5 py-28 text-white sm:px-8 md:px-14 md:py-40" style={{ background: NAVY }} aria-label="Human · Machine · Mind">
    <div className="absolute -right-40 top-10 h-[30rem] w-[40rem] rounded-full opacity-25 blur-[150px]" style={{ background: COBALT }} />
    <div className="relative mx-auto max-w-[1150px]">
      <Eyebrow dark>Ý nghĩa cốt lõi</Eyebrow>
      <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-8">
        {LETTERS.map(([l, w, vi], i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, delay: i * 0.18 }} className="relative">
            <div className="text-[clamp(4.5rem,17vw,13rem)] font-medium leading-[0.85] tracking-[-0.06em]" style={i === 2 ? SKY_TEXT : { color: "#ffffff" }}>{l}</div>
            <motion.div initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 + i * 0.18 }} className="mt-4 text-[clamp(1rem,2.4vw,1.8rem)] font-medium tracking-[-0.02em]">{w}</motion.div>
            <div className="mt-1 text-[12px] sm:text-[14px]" style={{ color: SOFT }}>{vi}</div>
          </motion.div>
        ))}
      </div>
      <p className="mt-14 max-w-2xl text-[17px] leading-relaxed md:text-[20px]" style={{ color: "#d4e3f2" }}>Không chỉ là công cụ (Machine), không chỉ là người dùng (Human), mà là <span style={{ color: "#ffffff" }}>sự giao thoa tạo ra trí tuệ (Mind)</span>.</p>

      <div className="mt-16 grid gap-5 md:grid-cols-2">
        {/* other tools: one-way */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7 }} className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:p-9">
          <div className="text-[12px] uppercase tracking-[0.18em]" style={{ color: SOFT }}>Các công cụ khác</div>
          <svg viewBox="0 0 360 150" className="mt-4 w-full" aria-hidden="true">
            <line x1="110" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="5 5"><animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" /></line>
            <path d="M232 54 L242 60 L232 66" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <Node x={80} y={60} label="Human" dim /><Node x={280} y={60} label="Machine" dim />
          </svg>
          <div className="mt-2 text-[22px] font-medium tracking-[-0.02em] text-white/70">Human asks Machine</div>
          <div className="mt-1 text-[14px]" style={{ color: SOFT }}>Người hỏi, máy trả lời. Hết.</div>
        </motion.div>
        {/* Trace: a loop that builds the mind */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, delay: 0.15 }} className="rounded-3xl border p-7 md:p-9" style={{ borderColor: "rgba(66,140,212,0.5)", background: "linear-gradient(160deg,rgba(0,78,154,0.35),rgba(66,140,212,0.08))", boxShadow: "0 30px 80px -30px rgba(66,140,212,0.6)" }}>
          <div className="text-[12px] uppercase tracking-[0.18em]" style={{ color: SKY }}>TraceEdu</div>
          <svg viewBox="0 0 360 150" className="mt-4 w-full" aria-hidden="true">
            <path d="M80 60 C 110 20, 150 20, 180 40 M180 40 C 150 70, 110 100, 80 60" fill="none" stroke={SKY} strokeWidth="1.5" strokeDasharray="5 5"><animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.9s" repeatCount="indefinite" /></path>
            <path d="M80 60 C 120 110, 160 110, 180 90 M180 90 C 200 70, 230 60, 280 60" fill="none" stroke="#cfe6ff" strokeWidth="1.8" strokeDasharray="5 5"><animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.9s" repeatCount="indefinite" /></path>
            <Node x={80} y={60} label="Human" /><Node x={180} y={65} label="Machine" /><Node x={280} y={60} label="Mind" glow />
          </svg>
          <div className="mt-2 text-[22px] font-medium tracking-[-0.02em]">Human meets Machine <span style={SKY_TEXT}>to build the Mind</span></div>
          <div className="mt-1 text-[14px]" style={{ color: "#d4e3f2" }}>Người và máy tương tác qua lại, để rèn luyện trí óc.</div>
        </motion.div>
      </div>
    </div>
  </section>
);

/* =============================================================== AHA */
const AXES = [["Phản biện", 86], ["Đào sâu", 74], ["Kiểm chứng", 68], ["Nội hóa", 78], ["Chủ động", 82]] as const;
const C = 160, R = 112;
const pt = (i: number, f: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
const poly = (f: (i: number) => number) => AXES.map((_, i) => pt(i, f(i)).join(",")).join(" ");

export const Aha: React.FC = () => (
  <section id="aha" className="relative overflow-hidden bg-white px-5 py-28 text-center sm:px-8 md:px-14 md:py-40" aria-label="Khoảnh khắc Aha">
    <div className="relative mx-auto max-w-3xl">
      <Eyebrow>Kết quả</Eyebrow>
      <h2 className="mt-6 text-[clamp(2.6rem,7vw,5.6rem)] font-medium leading-[1] tracking-[-0.05em]" style={{ color: NAVY }}>Và rồi… <motion.span initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.3 }} className="inline-block" style={{ color: COBALT }}>“Aha!”</motion.span></h2>
      <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed md:text-[19px]" style={{ color: MUTED }}>Mọi nỗ lực tư duy của bạn không bị bỏ phí. Nó được số hóa thành Hồ sơ Minh bạch — minh chứng cho thấy bạn thực sự làm chủ tri thức.</p>
    </div>
    <div className="relative mx-auto mt-14 w-full max-w-[480px]">
      <div className="absolute inset-[15%] rounded-full opacity-40 blur-[60px]" style={{ background: SKY }} />
      <svg viewBox="0 0 320 320" className="relative w-full" role="img" aria-label="Biểu đồ radar 5 tiêu chí tư duy">
        {[0.33, 0.66, 1].map((f) => <polygon key={f} points={poly(() => f)} fill="none" stroke="rgba(4,27,45,0.1)" />)}
        {AXES.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(4,27,45,0.08)" />; })}
        <motion.polygon points={poly((i) => AXES[i][1] / 100)} fill="rgba(66,140,212,0.22)" stroke={COBALT} strokeWidth="2.5" strokeLinejoin="round" style={{ transformOrigin: `${C}px ${C}px` }} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: [0, 1.08, 1], opacity: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }} />
        {AXES.map(([label, v], i) => { const [x, y] = pt(i, v / 100), [lx, ly] = pt(i, 1.24); return (
          <g key={label}>
            <motion.circle cx={x} cy={y} r="5" fill={COBALT} stroke="#fff" strokeWidth="2" initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.1 + i * 0.08 }} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="500" fill={NAVY}>{label}</text>
            <motion.text x={lx} y={ly + 15} textAnchor="middle" fontSize="11" fill={COBALT} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.3 + i * 0.08 }}>{v}</motion.text>
          </g>
        ); })}
      </svg>
      {/* the stamp lands last */}
      <motion.svg viewBox="0 0 120 120" className="absolute -bottom-16 right-0 h-[96px] w-[96px] sm:-bottom-4 sm:-right-10 sm:h-[140px] sm:w-[140px]" initial={{ opacity: 0, scale: 2.4, rotate: -30 }} whileInView={{ opacity: 1, scale: 1, rotate: -12 }} viewport={{ once: true }} transition={{ delay: 1.8, type: "spring", stiffness: 200, damping: 13 }} aria-label="Dấu mộc Verified Mind">
        <defs><path id="vm-circle" d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" /></defs>
        <circle cx="60" cy="60" r="56" fill="rgba(22,163,74,0.08)" stroke={GREEN} strokeWidth="2.5" />
        <circle cx="60" cy="60" r="36" fill="none" stroke={GREEN} strokeWidth="1.2" strokeDasharray="2 3" />
        <text fontSize="9.5" fontWeight="700" letterSpacing="2.6" fill={GREEN}><textPath href="#vm-circle">VERIFIED MIND · TRACEEDU · VERIFIED MIND ·</textPath></text>
        <path d="M44 61 l11 11 l22 -24" fill="none" stroke={GREEN} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    </div>
    <div className="mt-20 inline-flex items-center gap-2 sm:mt-8 text-[12px]" style={{ color: MUTED }}><span style={{ color: COBALT }}><HmmLoader count={4} label="Đang tổng hợp hồ sơ" /></span>đang tổng hợp hồ sơ · Minh họa</div>
  </section>
);

/* =============================================================== CTA */
export const CTA: React.FC<{ onPick: (r: Role) => void }> = ({ onPick }) => (
  <section className="relative overflow-hidden px-5 pb-56 pt-28 text-center text-white sm:px-8 md:pt-36" style={{ background: `radial-gradient(110% 100% at 50% 0%, #0b3558 0%, ${NAVY} 65%)` }} aria-label="Bắt đầu">
    <TraceLine flip className="absolute inset-x-0 bottom-0 h-[50%] w-full" />
    <div className="relative mx-auto max-w-3xl">
      <h2 className="text-[clamp(2.3rem,6vw,4.8rem)] font-medium leading-[1.02] tracking-[-0.045em]">Tư duy không có đường tắt.<br /><span style={SKY_TEXT}>Nhưng có người đồng hành.</span></h2>
      <p className="mx-auto mt-6 max-w-md text-[16px] md:text-[18px]" style={{ color: SOFT }}>Bắt đầu bằng một bài. Phần còn lại, bạn sẽ tự nhìn thấy.</p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button onClick={() => onPick("student")} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium transition hover:bg-white/90" style={{ color: NAVY }}>Tôi là sinh viên <ArrowRight className="h-4 w-4" /></button>
        <button onClick={() => onPick("teacher")} className="liquid-glass rounded-full px-7 py-3.5 text-[15px] font-medium text-white transition hover:bg-white/10">Tôi là giảng viên</button>
      </div>
    </div>
  </section>
);

/* =============================================================== CONTACT + FOOTER */
const env = (k: string): string => (import.meta as any).env?.[k] ?? "";
const EMAIL = env("VITE_CONTACT_EMAIL"), PHONE = env("VITE_CONTACT_PHONE"), ADDRESS = env("VITE_CONTACT_ADDRESS");

export const Contact: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [f, setF] = useState({ name: "", email: "", role: "Giảng viên", msg: "" });
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL) return;
    const body = `Họ tên: ${f.name}\nEmail: ${f.email}\nVai trò: ${f.role}\n\n${f.msg}`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Liên hệ TraceEdu")}&body=${encodeURIComponent(body)}`;
  };
  const input = "w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none transition focus:border-[#428CD4] focus:bg-white/[0.08]";
  const info = [[Mail, "Email", EMAIL], [Phone, "Điện thoại", PHONE], [MapPin, "Địa chỉ", ADDRESS]] as const;
  return (
    <footer id="contact" className="px-5 pb-10 pt-24 text-white sm:px-8 md:px-14 md:pt-32" style={{ background: "#03141f" }} aria-label="Liên hệ">
      <div className="mx-auto grid max-w-[1150px] gap-14 md:grid-cols-2">
        <div>
          <Eyebrow dark>Liên hệ</Eyebrow>
          <h2 className="mt-6 text-[clamp(2rem,4.4vw,3.4rem)] font-medium leading-[1.05] tracking-[-0.04em]">Cùng nhau giữ<br />tiếng <span style={SKY_TEXT}>Hmm…</span></h2>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed" style={{ color: SOFT }}>Bạn là giảng viên muốn thử trên lớp, nhà trường đang tìm cách dùng AI cho tử tế, hay nhà đầu tư muốn nghe thêm? Chúng tôi luôn sẵn lòng.</p>
          <ul className="mt-10 space-y-4">
            {info.map(([Icon, k, v]) => (
              <li key={k} className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"><Icon className="h-5 w-5" style={{ color: SKY }} /></span>
                <div><div className="text-[12px]" style={{ color: SOFT }}>{k}</div><div className="text-[15px]">{v ? (k === "Email" ? <a href={`mailto:${v}`} className="hover:underline">{v}</a> : v) : <span className="text-white/40">Đang cập nhật</span>}</div></div>
              </li>
            ))}
          </ul>
        </div>
        <form onSubmit={send} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[12px]" style={{ color: SOFT }}>Họ tên</span><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} placeholder="Nguyễn Văn A" /></label>
            <label className="block"><span className="mb-1.5 block text-[12px]" style={{ color: SOFT }}>Email</span><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} placeholder="ban@truong.edu.vn" /></label>
          </div>
          <label className="mt-4 block"><span className="mb-1.5 block text-[12px]" style={{ color: SOFT }}>Bạn là</span>
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={input}>{["Giảng viên", "Sinh viên", "Nhà trường", "Nhà đầu tư", "Khác"].map((r) => <option key={r} className="text-black">{r}</option>)}</select>
          </label>
          <label className="mt-4 block"><span className="mb-1.5 block text-[12px]" style={{ color: SOFT }}>Lời nhắn</span><textarea required rows={4} value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} className={`${input} resize-none`} placeholder="Viết cho chúng tôi vài dòng…" /></label>
          <button type="submit" disabled={!EMAIL} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: `linear-gradient(90deg,${COBALT},${SKY})` }}><Send className="h-4 w-4" />Gửi lời nhắn</button>
          {!EMAIL && <p className="mt-3 text-center text-[12px] text-white/40">Địa chỉ nhận thư đang được cập nhật.</p>}
        </form>
      </div>
      <div className="mx-auto mt-20 flex max-w-[1150px] flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 text-[13px]" style={{ color: SOFT }}>
        <TraceLogo tone="dark" className="h-6 w-auto" />
        <span>Human · Machine · Mind</span>
        <nav className="flex gap-5" aria-label="Chân trang">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-white">Lên đầu trang</button>
          <button onClick={onLogin} className="hover:text-white">Đăng nhập</button>
        </nav>
        <span className="w-full text-[12px] text-white/35 md:w-auto">© TraceEdu. Hình minh họa trên trang không phải số liệu thật.</span>
      </div>
    </footer>
  );
};
