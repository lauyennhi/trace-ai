import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, ClipboardList, Sparkles, BookOpen, Plus, KeyRound, Award } from "lucide-react";
import { Course, User } from "../types";
import { CourseCard } from "../components/CourseCard";
import { EmptyState, Section, courseTheme, hasPerm, relTime, riseItem, staggerParent, Skeleton } from "../components/ui";

export const CoursesPage: React.FC<{ user: User; courses: Course[]; loading: boolean; onSelect: (id: string, tab?: string) => void; onEdit: (c: Course) => void; onDelete: (c: Course) => void; onCreate: () => void; onJoin: () => void }> = ({ user, courses, loading, onSelect, onEdit, onDelete, onCreate, onJoin }) => {
  const [q, setQ] = useState("");
  const manage = user.role !== "student";
  const list = useMemo(() => courses.filter((c) => (c.name + c.code + c.teacher_name).toLowerCase().includes(q.toLowerCase())), [courses, q]);
  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-5">
      <motion.div variants={riseItem} className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-normal tracking-tight mr-auto">Tất cả môn học</h1>
        <div className="relative"><Search className="w-4 h-4 text-mute absolute left-3.5 top-1/2 -translate-y-1/2" /><input className="input !pl-10 w-64" placeholder="Tìm môn học…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {(manage ? hasPerm(user, "create_course") : true) && <button className="btn btn-primary" onClick={manage ? onCreate : onJoin}>{manage ? <Plus className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}{manage ? "Tạo môn học" : "Tham gia"}</button>}
      </motion.div>
      {loading && courses.length === 0 ? <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60 rounded-3xl" />)}</div>
        : list.length === 0 ? <EmptyState icon={<BookOpen className="w-8 h-8" />} title={q ? "Không tìm thấy môn học" : "Chưa có môn học nào"} text={q ? "Thử từ khóa khác." : manage ? "Tạo môn học đầu tiên để bắt đầu." : "Nhập mã mời để tham gia lớp."} />
        : <motion.div variants={staggerParent} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{list.map((c) => <CourseCard key={c.id} course={c} role={user.role} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />)}</motion.div>}
    </motion.div>
  );
};

export const TodoPage: React.FC<{ user: User; overview: any | null; onOpenAssignment: (c: string, a: string) => void; onOpenSubmission: (c: string, a: string, s: string) => void }> = ({ user, overview: o, onOpenAssignment, onOpenSubmission }) => {
  const manage = user.role !== "student";
  if (!o) return <div className="space-y-3"><Skeleton className="h-16 rounded-3xl" /><Skeleton className="h-16 rounded-3xl" /></div>;
  const row = (key: string, color: string, title: string, sub: string, right: React.ReactNode, fn: () => void, Icon = ClipboardList) => (
    <button key={key} onClick={fn} className="w-full flex items-center gap-4 px-2 py-3 rounded-2xl hover:bg-surface-2 text-left transition-colors">
      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: courseTheme(color).bg, color: courseTheme(color).color }}><Icon className="w-5 h-5" /></span>
      <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{title}</div><div className="text-xs text-mute truncate">{sub}</div></div>{right}
    </button>
  );
  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-5">
      <motion.h1 variants={riseItem} className="text-3xl font-normal tracking-tight">{manage ? "Bài nộp cần chấm" : "Việc cần làm"}</motion.h1>
      {manage ? (
        <motion.div variants={riseItem}><Section title={`Chờ chấm (${o.to_grade_count})`} storageKey="todo-grade">
          {o.to_grade.length === 0 ? <p className="text-sm text-mute py-8 text-center">Mọi bài nộp đã được chấm 🎉</p> : o.to_grade.map((s: any) => row(s.submission_id, s.course_id, s.student_name, `${s.assignment_title} · nộp ${relTime(s.submitted_at)}`, s.process_score !== undefined ? <span className="chip chip-brand"><Sparkles className="w-3 h-3" />{s.process_score}</span> : null, () => onOpenSubmission(s.course_id, s.assignment_id, s.submission_id)))}
        </Section></motion.div>
      ) : (<>
        <motion.div variants={riseItem}><Section title={`Quá hạn (${o.overdue_count})`} storageKey="todo-od">
          {o.overdue.length === 0 ? <p className="text-sm text-mute py-6 text-center">Không có bài quá hạn.</p> : o.overdue.map((a: any) => row(a.id, a.course_id, a.title, a.course_name, <span className="chip chip-rose">Quá hạn</span>, () => onOpenAssignment(a.course_id, a.id)))}
        </Section></motion.div>
        <motion.div variants={riseItem}><Section title={`Sắp đến hạn (${o.pending_count})`} storageKey="todo-up">
          {o.upcoming.length === 0 ? <p className="text-sm text-mute py-6 text-center">Bạn đã hoàn thành hết bài tập 🎉</p> : o.upcoming.map((a: any) => row(a.id, a.course_id, a.title, a.course_name, <span className="chip chip-amber">{relTime(a.due_date)}</span>, () => onOpenAssignment(a.course_id, a.id)))}
        </Section></motion.div>
        <motion.div variants={riseItem}><Section title="Đã chấm gần đây" storageKey="todo-gr">
          {o.recent_graded.length === 0 ? <p className="text-sm text-mute py-6 text-center">Chưa có bài nào được chấm.</p> : o.recent_graded.map((g: any) => row(g.assignment_id, g.course_id, g.title, g.feedback || "Chưa có nhận xét", <span className="chip chip-green">{g.grade}/10</span>, () => onOpenAssignment(g.course_id, g.assignment_id), Award))}
        </Section></motion.div>
      </>)}
    </motion.div>
  );
};
