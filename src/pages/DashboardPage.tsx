import React from "react";
import { motion } from "motion/react";
import { Plus, KeyRound, ClipboardList, Check, UserX, TrendingDown, EyeOff, Sparkles, BarChart3, UserPlus, Award, BookOpen, ArrowRight } from "lucide-react";
import { User, Course } from "../types";
import { CourseCard } from "../components/CourseCard";
import { EmptyState, Section, Skeleton, courseTheme, hasPerm, relTime, riseItem, staggerParent } from "../components/ui";

interface Props {
  user: User; courses: Course[]; overview: any | null; loading: boolean;
  onSelectCourse: (id: string, tab?: string) => void; onOpenAssignment: (courseId: string, assignmentId: string) => void; onOpenSubmission: (courseId: string, assignmentId: string, submissionId: string) => void;
  onCreateCourse: () => void; onJoinCourse: () => void; onEditCourse: (c: Course) => void; onDeleteCourse: (c: Course) => void; onGoAdmin: () => void; onGoCourses: () => void;
}

const insightIcon: Record<string, { i: any; c: string }> = { missed: { i: UserX, c: "#7c5cd6" }, low: { i: TrendingDown, c: "#1e9e5a" }, idle: { i: EyeOff, c: "#2b7de0" } };

export const DashboardPage: React.FC<Props> = ({ user, courses, overview: o, loading, onSelectCourse, onOpenAssignment, onOpenSubmission, onCreateCourse, onJoinCourse, onEditCourse, onDeleteCourse, onGoAdmin, onGoCourses }) => {
  const manage = user.role !== "student";
  const admin = user.role === "admin";
  const canCreate = manage && hasPerm(user, "create_course");
  const firstName = admin ? "quản trị viên" : user.name.split(" ").slice(-1)[0];
  const h = new Date().getHours();
  const greet = h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-5">
      <motion.div variants={riseItem} className="flex flex-wrap items-center gap-2">
        {admin && <button onClick={onGoAdmin} className="pill"><span>Quản trị</span></button>}
        <span className="pill pill-active"><Check className="w-4 h-4" />{admin ? "Tất cả môn học" : manage ? "Giảng dạy" : "Đang học"}</span>
        <span className="ml-auto text-sm text-mute hidden sm:block">{greet}, {firstName} 👋</span>
      </motion.div>

      <div className="grid xl:grid-cols-[1.15fr_1fr] gap-5">
        {/* Recently due / Upcoming */}
        <motion.div variants={riseItem}>
          <Section title={manage ? "Gần đến hạn" : "Việc cần làm"} storageKey="due" action={<button onClick={() => (manage ? onGoCourses() : onGoCourses())} className="text-sm font-medium text-brand hover:underline px-2 hidden sm:block">{manage ? "Xem tất cả môn" : "Xem môn học"}</button>}>
            {!o ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div> : manage ? (
              o.recent_due.length === 0 ? <p className="text-sm text-mute py-6 text-center">Không có bài tập nào đến hạn gần đây.</p> : (
                <div>
                  <div className="hidden sm:grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem_2rem] gap-2 px-2 pb-1 text-[11px] text-mute"><span /><span className="text-center">Đã nộp</span><span className="text-center">Được giao</span><span className="text-center">Đã chấm</span><span /></div>
                  {o.recent_due.map((a: any) => {
                    const t = courseTheme(a.course_id);
                    return (
                      <button key={a.id} onClick={() => onOpenAssignment(a.course_id, a.id)} className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_4.5rem_4.5rem_4.5rem_2rem] items-center gap-2 px-2 py-2.5 rounded-2xl hover:bg-surface-2 text-left transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: t.bg, color: t.color }}><ClipboardList className="w-5 h-5" /></span>
                          <div className="min-w-0"><div className="text-sm truncate">{a.title}</div><div className="text-xs text-mute truncate">{a.course_name} · {relTime(a.due_date)}</div></div>
                        </div>
                        <span className="hidden sm:block text-center text-lg">{a.turned_in}</span>
                        <span className="hidden sm:block text-center text-lg">{a.assigned}</span>
                        <span className="hidden sm:block text-center text-lg">{a.graded}</span>
                        <Check className={`w-5 h-5 justify-self-end ${a.graded >= a.turned_in && a.turned_in > 0 ? "text-emerald-600" : "text-mute"}`} />
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              [...o.overdue.map((a: any) => ({ ...a, od: true })), ...o.upcoming].length === 0 ? <p className="text-sm text-mute py-6 text-center">Bạn đã hoàn thành hết bài tập 🎉</p> : (
                <div>{[...o.overdue.map((a: any) => ({ ...a, od: true })), ...o.upcoming].map((a: any) => {
                  const t = courseTheme(a.course_id);
                  return (
                    <button key={a.id} onClick={() => onOpenAssignment(a.course_id, a.id)} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-surface-2 text-left transition-colors">
                      <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: t.bg, color: t.color }}><ClipboardList className="w-5 h-5" /></span>
                      <div className="min-w-0 flex-1"><div className="text-sm truncate">{a.title}</div><div className="text-xs text-mute truncate">{a.course_name}</div></div>
                      <span className={`chip ${a.od ? "chip-rose" : "chip-amber"}`}>{a.od ? "Quá hạn" : relTime(a.due_date)}</span>
                    </button>
                  );
                })}</div>
              )
            )}
          </Section>
        </motion.div>

        {/* Class insights / Recent results */}
        <motion.div variants={riseItem}>
          <Section title={manage ? "Phân tích lớp học" : "Kết quả gần đây"} storageKey="insights">
            {!o ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : manage ? (
              o.insights.length === 0 ? <div className="tonal p-6 text-sm text-ink-2 text-center">Chưa có điểm cần chú ý. Mọi thứ đang ổn 👍</div> : (
                <div className="space-y-3">{o.insights.map((n: any, i: number) => {
                  const ic = insightIcon[n.kind] || insightIcon.idle;
                  return (
                    <button key={i} onClick={() => onSelectCourse(n.course_id, "stats")} className="tonal w-full flex items-center gap-4 p-4 text-left hover:brightness-[0.98] transition" style={{ background: "color-mix(in srgb, var(--brand) 9%, var(--surface))" }}>
                      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${ic.c} 16%, var(--surface))`, color: ic.c }}><ic.i className="w-5 h-5" /></span>
                      <div className="min-w-0"><div className="text-[0.95rem]"><strong className="font-semibold">{n.count} sinh viên</strong> {n.text.replace(/^\d+ sinh viên /, "")}</div><div className="text-xs text-ink-2 mt-0.5 truncate">{n.course}</div></div>
                    </button>
                  );
                })}</div>
              )
            ) : (
              o.recent_graded.length === 0 ? <div className="tonal p-6 text-sm text-ink-2 text-center">Chưa có bài nào được chấm.</div> : (
                <div className="space-y-3">{o.recent_graded.map((g: any) => (
                  <button key={g.assignment_id} onClick={() => onOpenAssignment(g.course_id, g.assignment_id)} className="tonal w-full flex items-center gap-4 p-4 text-left hover:brightness-[0.98] transition" style={{ background: "color-mix(in srgb, var(--brand) 9%, var(--surface))" }}>
                    <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#e7f8ef] text-[#0f8a55] dark:bg-[#0e2a1f]"><Award className="w-5 h-5" /></span>
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{g.title}</div>{g.feedback && <div className="text-xs text-ink-2 truncate">{g.feedback}</div>}</div>
                    <span className="chip chip-green text-sm">{g.grade}/10</span>
                  </button>))}</div>
              )
            )}
          </Section>
        </motion.div>
      </div>

      {/* Spotlight / quick actions */}
      <motion.div variants={riseItem}>
        <Section title="Bắt đầu nhanh" storageKey="spot">
          <div className="grid md:grid-cols-3 gap-4">
            {(manage ? [
              { icon: Sparkles, c: "#5b6cff", title: "Giao bài tập Socratic", text: "Trợ lý AI gợi mở bằng câu hỏi, giúp sinh viên tự tư duy thay vì xin đáp án.", btn: courses.length ? "Chọn môn học" : "Tạo môn học", fn: () => (courses.length ? onGoCourses() : canCreate && onCreateCourse()) },
              { icon: BarChart3, c: "#1e9e5a", title: "Xem phân tích tư duy", text: "Radar 5 tiêu chí, nhật ký chat và cảnh báo sinh viên cần chú ý theo từng lớp.", btn: "Mở thống kê", fn: () => courses[0] ? onSelectCourse(courses[0].id, "stats") : onGoCourses() },
              admin ? { icon: UserPlus, c: "#d98a00", title: "Quản lý người dùng", text: "Cấp vai trò, vô hiệu hóa tài khoản và cấu hình phân quyền cho toàn hệ thống.", btn: "Vào khu vực quản trị", fn: onGoAdmin }
                : { icon: UserPlus, c: "#d98a00", title: "Mời sinh viên vào lớp", text: "Chia sẻ mã mời của môn học. Bạn có thể đổi mã bất cứ lúc nào.", btn: "Xem mã mời", fn: () => (courses[0] ? onSelectCourse(courses[0].id) : onGoCourses()) },
            ] : [
              { icon: KeyRound, c: "#5b6cff", title: "Tham gia môn học mới", text: "Nhập mã mời do giảng viên cung cấp để vào lớp và nhận bài tập.", btn: "Nhập mã lớp", fn: onJoinCourse },
              { icon: Sparkles, c: "#1e9e5a", title: "Luyện tư duy cùng AI", text: "Hỏi, phản biện và diễn giải bằng lời của bạn — đó là điều được đánh giá.", btn: "Chọn bài tập", fn: onGoCourses },
              { icon: Award, c: "#d98a00", title: "Xem điểm của bạn", text: "Điểm giảng viên, điểm tư duy và nhận xét chi tiết cho từng bài.", btn: "Mở môn học", fn: onGoCourses },
            ]).map((c) => (
              <div key={c.title} className="tonal p-5 flex flex-col gap-3">
                <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${c.c} 18%, var(--surface))`, color: c.c }}><c.icon className="w-6 h-6" /></span>
                <div className="text-lg leading-snug">{c.title}</div>
                <p className="text-sm text-ink-2 flex-1">{c.text}</p>
                <button onClick={c.fn} className="btn btn-ghost btn-sm self-start bg-surface">{c.btn}<ArrowRight className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Section>
      </motion.div>

      {/* Classes */}
      <motion.div variants={riseItem}>
        <Section title={admin ? "Tất cả môn học" : manage ? "Môn học của bạn" : "Môn học đang tham gia"} storageKey="classes"
          action={(canCreate || !manage) && <button onClick={manage ? onCreateCourse : onJoinCourse} className="flex items-center gap-1.5 text-sm font-medium text-brand hover:bg-brand-soft/60 px-3 py-2 rounded-full">{manage ? <Plus className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}{manage ? "Thêm môn" : "Tham gia"}</button>}>
          {loading && courses.length === 0 ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60 rounded-3xl" />)}</div>
          ) : courses.length === 0 ? (
            <EmptyState icon={<BookOpen className="w-8 h-8" />} title={manage ? "Chưa có môn học nào" : "Bạn chưa tham gia môn nào"}
              text={manage ? "Tạo môn học đầu tiên để lấy mã mời và giao bài." : "Nhập mã mời từ giảng viên để vào lớp học."}
              action={(canCreate || !manage) ? <button className="btn btn-primary" onClick={manage ? onCreateCourse : onJoinCourse}>{manage ? "Tạo môn học" : "Nhập mã tham gia"}</button> : undefined} />
          ) : (
            <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {courses.map((c) => <CourseCard key={c.id} course={c} role={user.role} onSelect={onSelectCourse} onEdit={onEditCourse} onDelete={onDeleteCourse} />)}
            </motion.div>
          )}
        </Section>
      </motion.div>
    </motion.div>
  );
};
