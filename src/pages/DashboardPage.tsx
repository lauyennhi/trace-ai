import React from "react";
import { motion } from "motion/react";
import { Plus, KeyRound, BookOpen, Users, ClipboardCheck, AlertTriangle, CalendarClock, Award, Sparkles, ArrowRight, GraduationCap, Brain } from "lucide-react";
import { User, Course } from "../types";
import { CourseCard } from "../components/CourseCard";
import { AnimatedNumber, EmptyState, Skeleton, relTime, riseItem, staggerParent } from "../components/ui";

interface Props {
  user: User; courses: Course[]; overview: any | null; loading: boolean;
  onSelectCourse: (id: string) => void; onOpenAssignment: (courseId: string, assignmentId: string) => void; onOpenSubmission: (courseId: string, assignmentId: string, submissionId: string) => void;
  onCreateCourse: () => void; onJoinCourse: () => void; onEditCourse: (c: Course) => void; onDeleteCourse: (c: Course) => void;
}

const greeting = () => { const h = new Date().getHours(); return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối"; };

export const DashboardPage: React.FC<Props> = ({ user, courses, overview: o, loading, onSelectCourse, onOpenAssignment, onOpenSubmission, onCreateCourse, onJoinCourse, onEditCourse, onDeleteCourse }) => {
  const teacher = user.role === "teacher";
  const firstName = user.name.split(" ").slice(-1)[0];
  const kpis = teacher && o ? [
    { l: "Môn giảng dạy", v: o.course_count, i: BookOpen, t: "from-indigo-500 to-violet-500" },
    { l: "Sinh viên", v: o.student_count, i: Users, t: "from-sky-500 to-blue-500" },
    { l: "Bài tập đã giao", v: o.assignment_count, i: ClipboardCheck, t: "from-emerald-500 to-teal-500" },
    { l: "Chờ chấm", v: o.to_grade_count, i: AlertTriangle, t: "from-rose-500 to-orange-500" },
  ] : o ? [
    { l: "Môn đang học", v: o.course_count, i: BookOpen, t: "from-indigo-500 to-violet-500" },
    { l: "Cần làm", v: o.pending_count, i: ClipboardCheck, t: "from-amber-500 to-orange-500" },
    { l: "Quá hạn", v: o.overdue_count, i: AlertTriangle, t: "from-rose-500 to-pink-500" },
    { l: "Điểm trung bình", v: o.avg_grade ?? 0, i: Award, t: "from-emerald-500 to-teal-500", dec: 1, none: o.avg_grade === null },
  ] : [];

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-8">
      {/* Hero */}
      <motion.section variants={riseItem} className="relative isolate overflow-hidden rounded-[1.75rem] [transform:translateZ(0)] p-7 md:p-9 text-white animated-gradient bg-gradient-to-br from-[#4338ca] via-[#7c3aed] to-[#c026d3] shadow-[0_30px_60px_-24px_rgba(91,91,240,0.6)]">
        <div className="blob blob-1 w-72 h-72 bg-sky-300 -top-20 right-10" />
        <div className="blob blob-2 w-64 h-64 bg-pink-300 -bottom-24 left-1/3" />
        <div className="absolute inset-0 dot-grid opacity-25" />
        <motion.div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:block opacity-90" animate={{ y: [0, -10, 0], rotate: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 6 }}>
          {teacher ? <GraduationCap className="w-32 h-32 text-white/25" /> : <Brain className="w-32 h-32 text-white/25" />}
        </motion.div>
        <div className="relative max-w-xl">
          <p className="text-white/80 text-sm font-medium">{greeting()},</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">{firstName} 👋</h1>
          <p className="text-white/80 mt-2">{teacher
            ? (o?.to_grade_count ? `Có ${o.to_grade_count} bài nộp đang chờ bạn chấm.` : "Mọi bài nộp đã được chấm. Tuyệt vời!")
            : (o?.pending_count ? `Bạn có ${o.pending_count} bài tập cần hoàn thành.` : "Bạn đã hoàn thành hết bài tập hiện có.")}</p>
          <div className="flex flex-wrap gap-3 mt-6">
            {teacher
              ? <button onClick={onCreateCourse} className="btn bg-white text-[#4338ca] hover:bg-white/90 shadow-xl"><Plus className="w-4 h-4" />Tạo môn học mới</button>
              : <button onClick={onJoinCourse} className="btn bg-white text-[#4338ca] hover:bg-white/90 shadow-xl"><KeyRound className="w-4 h-4" />Nhập mã tham gia lớp</button>}
          </div>
        </div>
      </motion.section>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading && !o ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />) : kpis.map((k: any) => (
          <motion.div key={k.l} variants={riseItem} whileHover={{ y: -4 }} className="card p-5 relative overflow-hidden">
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${k.t} opacity-15`} />
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.t} text-white flex items-center justify-center mb-3 shadow-lg`}><k.i className="w-5 h-5" /></div>
            <div className="text-3xl font-extrabold tracking-tight">{k.none ? "—" : <AnimatedNumber value={k.v} decimals={k.dec || 0} />}</div>
            <div className="text-sm text-ink-2 font-medium">{k.l}</div>
          </motion.div>
        ))}
      </div>

      {/* Work queues */}
      {o && (
        <div className="grid lg:grid-cols-2 gap-5">
          {teacher ? (
            <motion.div variants={riseItem} className="card p-5 min-w-0">
              <h3 className="font-bold flex items-center gap-2 mb-3"><ClipboardCheck className="w-5 h-5 text-rose-500" />Bài nộp chờ chấm</h3>
              {o.to_grade.length === 0 ? <p className="text-sm text-mute py-6 text-center">Không có bài nào đang chờ 🎉</p> : (
                <div className="space-y-1">{o.to_grade.map((s: any) => (
                  <button key={s.submission_id} onClick={() => onOpenSubmission(s.course_id, s.assignment_id, s.submission_id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 text-left transition-colors group">
                    <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{s.student_name}</div><div className="text-xs text-mute truncate">{s.assignment_title} · {relTime(s.submitted_at)}</div></div>
                    {s.process_score !== undefined && <span className="chip chip-brand"><Sparkles className="w-3 h-3" />{s.process_score}</span>}
                    <ArrowRight className="w-4 h-4 text-mute group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                  </button>))}</div>)}
            </motion.div>
          ) : (
            <motion.div variants={riseItem} className="card p-5 min-w-0">
              <h3 className="font-bold flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5 text-amber-500" />Cần làm ngay</h3>
              {o.overdue.length + o.upcoming.length === 0 ? <p className="text-sm text-mute py-6 text-center">Không có bài tập nào đang chờ 🎉</p> : (
                <div className="space-y-1">{[...o.overdue.map((a: any) => ({ ...a, od: true })), ...o.upcoming].map((a: any) => (
                  <button key={a.id} onClick={() => onOpenAssignment(a.course_id, a.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 text-left transition-colors group">
                    <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{a.title}</div><div className="text-xs text-mute truncate">{a.course_name}</div></div>
                    <span className={`chip ${a.od ? "chip-rose" : "chip-amber"}`}>{a.od ? "Quá hạn" : relTime(a.due_date)}</span>
                  </button>))}</div>)}
            </motion.div>
          )}

          <motion.div variants={riseItem} className="card p-5 min-w-0">
            {teacher ? (<>
              <h3 className="font-bold flex items-center gap-2 mb-3"><CalendarClock className="w-5 h-5 text-brand" />Hạn nộp sắp tới</h3>
              {o.upcoming.length === 0 ? <p className="text-sm text-mute py-6 text-center">Chưa có bài tập nào sắp đến hạn.</p> : (
                <div className="space-y-1">{o.upcoming.map((a: any) => (
                  <button key={a.id} onClick={() => onOpenAssignment(a.course_id, a.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 text-left transition-colors">
                    <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{a.title}</div><div className="text-xs text-mute truncate">{a.course_name}</div></div><span className="chip chip-gray">{relTime(a.due_date)}</span>
                  </button>))}</div>)}
            </>) : (<>
              <h3 className="font-bold flex items-center gap-2 mb-3"><Award className="w-5 h-5 text-emerald-500" />Kết quả gần đây</h3>
              {o.recent_graded.length === 0 ? <p className="text-sm text-mute py-6 text-center">Chưa có bài nào được chấm.</p> : (
                <div className="space-y-1">{o.recent_graded.map((g: any) => (
                  <button key={g.assignment_id} onClick={() => onOpenAssignment(g.course_id, g.assignment_id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 text-left transition-colors">
                    <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{g.title}</div>{g.feedback && <div className="text-xs text-mute truncate">{g.feedback}</div>}</div><span className="chip chip-green">{g.grade}/10</span>
                  </button>))}</div>)}
            </>)}
          </motion.div>
        </div>
      )}

      {/* Courses */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div><h2 className="text-xl font-extrabold">{teacher ? "Môn học của bạn" : "Môn học đang tham gia"}</h2><p className="text-sm text-mute">Chọn một môn để xem bài tập{teacher ? ", chấm bài và thống kê" : " và làm bài"}.</p></div>
          <button onClick={teacher ? onCreateCourse : onJoinCourse} className="btn btn-soft btn-sm">{teacher ? <Plus className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}{teacher ? "Tạo môn" : "Nhập mã"}</button>
        </div>
        {loading && courses.length === 0 ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
        ) : courses.length === 0 ? (
          <EmptyState icon={<BookOpen className="w-8 h-8" />} title={teacher ? "Chưa có môn học nào" : "Bạn chưa tham gia môn nào"}
            text={teacher ? "Tạo môn học đầu tiên để lấy mã mời và giao bài." : "Nhập mã mời từ giảng viên để vào lớp học."}
            action={<button className="btn btn-primary" onClick={teacher ? onCreateCourse : onJoinCourse}>{teacher ? "Tạo môn học" : "Nhập mã tham gia"}</button>} />
        ) : (
          <motion.div variants={staggerParent} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {courses.map((c) => <CourseCard key={c.id} course={c} role={user.role} onSelect={onSelectCourse} onEdit={onEditCourse} onDelete={onDeleteCourse} />)}
          </motion.div>
        )}
      </section>
    </motion.div>
  );
};
