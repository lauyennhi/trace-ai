import React, { useEffect, useState } from "react";
import { Settings, Lock } from "lucide-react";
import { api } from "../lib/api";
import { User } from "../types";
import { Avatar, Modal, useToast } from "./ui";

export const SettingsModal: React.FC<{ open: boolean; user: User; onClose: () => void; onUpdated: (u: User) => void }> = ({ open, user, onClose, onUpdated }) => {
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [cur, setCur] = useState(""); const [next, setNext] = useState("");
  const [busy, setBusy] = useState<"" | "name" | "pw">("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setName(user.name); setCur(""); setNext(""); setErr(null); } }, [open]);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy("name"); setErr(null);
    try { const u = await api<User>("/api/auth/me", { method: "PUT", body: { name } }); onUpdated(u); toast.success("Đã cập nhật hồ sơ."); } catch (x: any) { setErr(x.message); } finally { setBusy(""); }
  };
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy("pw"); setErr(null);
    try { await api("/api/auth/password", { method: "PUT", body: { current: cur, next } }); toast.success("Đã đổi mật khẩu."); setCur(""); setNext(""); } catch (x: any) { setErr(x.message); } finally { setBusy(""); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Cài đặt tài khoản" icon={<Settings className="w-5 h-5" />} maxWidth="max-w-md">
      <div className="space-y-6">
        {err && <div className="chip chip-rose w-full rounded-xl px-3 py-2.5 text-sm">{err}</div>}
        <form onSubmit={saveName} className="space-y-3">
          <div className="flex items-center gap-4"><Avatar name={user.name} src={user.avatar} size={56} /><div className="text-sm"><div className="font-medium">{user.email}</div><div className="text-mute">{user.role === "admin" ? "Quản trị viên" : user.role === "teacher" ? "Giảng viên" : "Sinh viên"}</div></div></div>
          <div><label className="label">Họ và tên</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <button className="btn btn-primary btn-sm" disabled={busy === "name" || name.trim() === user.name}>{busy === "name" ? "Đang lưu…" : "Lưu tên"}</button>
        </form>
        <form onSubmit={savePw} className="space-y-3 pt-5 border-t border-line">
          <h4 className="font-medium flex items-center gap-2"><Lock className="w-4 h-4" />Đổi mật khẩu</h4>
          <input className="input" type="password" placeholder="Mật khẩu hiện tại" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
          <input className="input" type="password" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
          <button className="btn btn-primary btn-sm" disabled={busy === "pw"}>{busy === "pw" ? "Đang đổi…" : "Đổi mật khẩu"}</button>
        </form>
      </div>
    </Modal>
  );
};
