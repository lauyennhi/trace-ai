import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Users, BarChart3, Plus, Copy, Check, RefreshCw, Pencil, Trash2, LogOut, UserMinus, Search } from "lucide-react";
import { User, Assignment, ClassStats } from "../types";
import { AssignmentCard } from "../components/AssignmentCard";
import { CourseStatsView } from "../components/CourseStatsView";
import { Avatar, EmptyState, Skeleton, fmtDate, pageVariants, riseItem, staggerParent } from "../components/ui";

interface Props {
  user: User; course: any | null; stats: ClassStats | null; tab: string;
  onTab: (t: string) => void; onOpenAssignment: (id: string) => void;
  onCreateAssignment: () => void; onEditAssignment: (a: Assignment) => void; onDeleteAssignment: (a: Assignment) => void;
  onEditCourse: () => void; onDeleteCourse: () => void; onRegenerateCode: () => void; onLeave: () => void; onRemoveMember: (m: any) => void;
}

export const CoursePage: React.FC<Props> = ({ user, course, stats, tab, onTab, onOpenAssignment, onCreateAssignment, onEditAssignment, onDeleteAssignment, onEditCourse, onDeleteCourse, onRegenerateCode, onLeave, onRemoveMember }) => {
  const teacher = user.role === "teacher";
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState("");
  if (!course) return <div className="space-y-4"><Skeleton className="h-44 rounded-3xl" /><Skeleton className="h-12 w-80" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div>;

  const tabs = [
    { id: "assignments", label: "Bài tập", icon: BookOpen, count: course.assignments?.length || 0 },
    { id: "students", label: "Sinh viên", icon: Users, count: course.members?.length || 0 },
    ...(teacher ? [{ id: "stats", label: "Thống kê", icon: BarChart3 }] : []),
  ] as { id: string; label: string; icon: any; count?: number }[];
  const active = tabs.some((t) => t.id === tab) ? tab : "assignments";
  const copy = () => { navigator.clipboard?.writeText(course.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const members = (course.members || []).filter((m: any) => (m.student_name + m.student_email).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`relative isolate overflow-hidden [transform:translateZ(0)] rounded-[1.75rem] bg-gradient-to-br ${course.accent_color || "from-indigo-500 to-violet-600"} p-6 md:p-8 text-white shadow-xl`}>
        <div className="blob blob-1 w-64 h-64 bg-white/40 -top-16 right-0" /><div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3"><span className="px-2.5 py-1 rounded-lg bg-white/25 backdrop-blur text-xs font-bold font-mono tracking-wider">{course.code}</span><span className="text-sm text-white/80">{course.semester}</span></div>
            <h1 className="text-3xl font-extrabold tracking-tight">{course.name}</h1>
            {course.description && <p className="text-white/85 mt-2 text-sm leading-relaxed">{course.description}</p>}
            <p className="text-white/70 text-xs mt-3">Giảng viên: {course.teacher_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {teacher ? (<>
              <div className="rounded-2xl bg-white/20 backdrop-blur border border-white/25 px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-white/70">Mã mời lớp</div>
                <div className="flex items-center gap-2 font-mono font-extrabold text-xl tracking-widest">{course.invite_code}
                  <button onClick={copy} className="p-1 rounded-lg hover:bg-white/20" aria-label="Sao chép mã">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
                  <button onClick={onRegenerateCode} className="p-1 rounded-lg hover:bg-white/20" aria-label="Tạo mã mới" title="Tạo mã mời mới"><RefreshCw className="w-4 h-4" /></button></div>
              </div>
              <button onClick={onEditCourse} className="btn bg-white/20 hover:bg-white/30 text-white backdrop-blur btn-icon" aria-label="Chỉnh sửa môn học" title="Chỉnh sửa"><Pencil className="w-4 h-4" /></button>
              <button onClick={onDeleteCourse} className="btn bg-white/20 hover:bg-rose-500 text-white backdrop-blur btn-icon" aria-label="Xóa môn học" title="Xóa môn"><Trash2 className="w-4 h-4" /></button>
            </>) : <button onClick={onLeave} className="btn bg-white/20 hover:bg-white/30 text-white backdrop-blur btn-sm"><LogOut className="w-4 h-4" />Rời lớp</button>}
          </div>
        </div>
      </motion.section>

      <div className="flex items-center justify-between gap-3 border-b border-line">
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onTab(t.id)} className={`relative px-4 py-3 text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${active === t.id ? "text-brand" : "text-ink-2 hover:text-ink"}`}>
              <t.icon className="w-4 h-4" />{t.label}{t.count !== undefined && <span className="chip chip-gray !py-0">{t.count}</span>}
              {active === t.id && <motion.span layoutId="course-tab" className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-brand to-brand-2" />}
            </button>
          ))}
        </div>
        {teacher && active === "assignments" && <button onClick={onCreateAssignment} className="btn btn-primary btn-sm mb-2 shrink-0"><Plus className="w-4 h-4" />Giao bài mới</button>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={active} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          {active === "assignments" && (
            course.assignments?.length ? (
              <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-3">
                {course.assignments.map((a: Assignment) => <AssignmentCard key={a.id} assignment={a} role={user.role} onSelect={onOpenAssignment} onEdit={onEditAssignment} onDelete={onDeleteAssignment} />)}
              </motion.div>
            ) : <EmptyState icon={<BookOpen className="w-8 h-8" />} title="Chưa có bài tập nào" text={teacher ? "Giao bài đầu tiên để sinh viên bắt đầu trao đổi với trợ lý AI." : "Giảng viên chưa giao bài tập nào."}
              action={teacher ? <button className="btn btn-primary" onClick={onCreateAssignment}><Plus className="w-4 h-4" />Giao bài tập</button> : undefined} />
          )}

          {active === "students" && (
            <div className="card p-5 space-y-4">
              <div className="relative max-w-xs"><Search className="w-4 h-4 text-mute absolute left-3.5 top-1/2 -translate-y-1/2" /><input className="input pl-10" placeholder="Tìm sinh viên…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              {members.length === 0 ? <p className="text-sm text-mute py-8 text-center">{course.members?.length ? "Không tìm thấy sinh viên phù hợp." : teacher ? `Chưa có sinh viên. Chia sẻ mã mời ${course.invite_code} để mời tham gia.` : "Chưa có sinh viên nào."}</p> : (
                <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map((m: any) => (
                    <motion.div variants={riseItem} key={m.student_id} className="group rounded-2xl border border-line p-3.5 flex items-center gap-3 hover:border-brand/40 transition-colors">
                      <Avatar name={m.student_name} src={m.student_avatar} size={42} />
                      <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{m.student_name}</div><div className="text-xs text-mute truncate">{m.student_email}</div><div className="text-[11px] text-mute">Tham gia {fmtDate(m.joined_at).split(" ").pop()}</div></div>
                      {teacher && <button onClick={() => onRemoveMember(m)} className="p-2 rounded-lg text-mute opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-surface-2 transition-all" aria-label={`Xóa ${m.student_name} khỏi lớp`} title="Xóa khỏi lớp"><UserMinus className="w-4 h-4" /></button>}
                    </motion.div>))}
                </motion.div>)}
            </div>
          )}

          {active === "stats" && teacher && (stats ? <CourseStatsView stats={stats} /> : <div className="grid grid-cols-4 gap-4"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
