import React, { useRef, useState } from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { useToast } from "./ui";
import { api } from "../lib/api";
import { MATERIAL_LIMITS } from "../lib/coach";

type Mat = { id: string; name: string; chars: number; added_at?: string };

/** Class materials: text the AI must stay close to when it answers this class's students. Teachers add and remove; students only see the names. */
export const MaterialsPanel: React.FC<{ courseId: string; initial: Mat[]; canEdit: boolean }> = ({ courseId, initial, canEdit }) => {
  const toast = useToast();
  const [list, setList] = useState<Mat[]>(initial);
  const [name, setName] = useState(""), [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const add = async () => {
    setBusy(true);
    try { setList(await api(`/api/courses/${courseId}/materials`, { method: "POST", body: { name, text } })); setName(""); setText(""); toast.success("Đã thêm tài liệu. Trợ lý AI sẽ bám theo từ lượt hỏi tiếp theo."); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const del = async (m: Mat) => { try { setList(await api(`/api/courses/${courseId}/materials/${m.id}`, { method: "DELETE" })); } catch (e: any) { toast.error(e.message); } };
  const pick = async (f?: File) => {
    if (!f) return;
    if (!/\.(txt|md|markdown|csv)$/i.test(f.name)) { toast.error("Hiện chỉ đọc được file .txt, .md hoặc .csv. Với PDF/Word, hãy dán nội dung vào ô bên dưới."); return; }
    setText(await f.text()); if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold">Tài liệu của lớp</h3>
        <p className="mt-1 text-sm text-ink-2">{canEdit ? "Giáo trình, đề cương, tiêu chí chấm. Khi sinh viên hỏi, trợ lý AI ưu tiên bám theo các đoạn liên quan trong tài liệu này và ghi rõ tên tài liệu khi dùng. Nếu câu hỏi nằm ngoài tài liệu, AI sẽ nói rõ thay vì tự suy đoán." : "Trợ lý AI của lớp này bám theo các tài liệu dưới đây khi trả lời bạn."}</p>
        {list.length === 0 ? <p className="mt-4 text-sm text-mute">Chưa có tài liệu nào.</p> : (
          <ul className="mt-4 divide-y divide-line">{list.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5"><FileText className="h-4 w-4 text-brand shrink-0" /><span className="flex-1 truncate text-sm font-medium">{m.name}</span><span className="text-xs text-mute">{m.chars.toLocaleString("vi-VN")} ký tự</span>{canEdit && <button className="btn btn-ghost btn-icon" aria-label={`Xóa ${m.name}`} onClick={() => del(m)}><Trash2 className="h-4 w-4" /></button>}</li>
          ))}</ul>
        )}
      </div>
      {canEdit && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Thêm tài liệu</h3><span className="text-xs text-mute">Tối đa {MATERIAL_LIMITS.files} tài liệu, {MATERIAL_LIMITS.perFile.toLocaleString("vi-VN")} ký tự mỗi tài liệu</span></div>
          <input className="input" placeholder="Tên tài liệu, ví dụ: Giáo trình chương 5" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Tên tài liệu" />
          <textarea className="input min-h-[160px] resize-y" placeholder="Dán nội dung tài liệu vào đây (văn bản thuần)…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Nội dung tài liệu" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><input ref={file} type="file" accept=".txt,.md,.markdown,.csv,text/plain" className="hidden" onChange={(e) => pick(e.target.files?.[0])} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => file.current?.click()}><Upload className="h-4 w-4" />Chọn file .txt / .md</button></div>
            <button className="btn btn-primary" disabled={busy || !name.trim() || text.trim().length < 20} onClick={add}><Plus className="h-4 w-4" />Thêm tài liệu</button>
          </div>
        </div>
      )}
    </div>
  );
};
