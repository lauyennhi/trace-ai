import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { User, Course, Assignment, ClassStats, AppNotification, Submission } from "./types";
import { api, apiRaw, getToken, setToken, setUnauthorizedHandler } from "./lib/api";
import { parseRoute, useHashRoute } from "./lib/router";
import { googleSignIn, getAccessToken, exportSubmissionsToSheets, downloadGradebookCSV } from "./lib/workspace";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { CourseFormModal } from "./components/CourseFormModal";
import { JoinCourseModal } from "./components/JoinCourseModal";
import { AssignmentFormModal, AssignmentFormData } from "./components/AssignmentFormModal";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { SupabaseModal } from "./components/SupabaseModal";
import { StudentWorkspaceView } from "./components/StudentWorkspaceView";
import { TeacherSubmissionView } from "./components/TeacherSubmissionView";
import { ToastProvider, useToast, Skeleton, pageVariants, hasPerm } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CoursePage } from "./pages/CoursePage";
import { AssignmentSubmissionsPage } from "./pages/AssignmentSubmissionsPage";
import { AdminPage } from "./pages/AdminPage";
import { CoursesPage, TodoPage } from "./pages/ListPages";
import { SettingsModal } from "./components/SettingsModal";

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

type Pending = { kind: "course" | "assignment" | "member" | "leave" | "regen"; payload: any } | null;

function Shell() {
  const toast = useToast();
  const { path, navigate } = useHashRoute();
  const route = useMemo(() => parseRoute(path), [path]);

  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(!!getToken());
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("trace_theme") as "dark" | "light") || "light"; } catch { return "light"; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<boolean>(() => { try { return localStorage.getItem("trace_rail") === "1"; } catch { return false; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 768px)").matches) setExpanded((v) => { try { localStorage.setItem("trace_rail", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
    else setMobileOpen((v) => !v);
  };

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const [course, setCourse] = useState<any>(null);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<any>(null);
  const [subList, setSubList] = useState<Submission[] | null>(null);
  const [subDetail, setSubDetail] = useState<any>(null);

  const [courseModal, setCourseModal] = useState<{ open: boolean; course: Course | null }>({ open: false, course: null });
  const [joinOpen, setJoinOpen] = useState(false);
  const [assignmentModal, setAssignmentModal] = useState<{ open: boolean; assignment: Assignment | null }>({ open: false, assignment: null });
  const [supabaseOpen, setSupabaseOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const [exporting, setExporting] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);

  /* ---------- theme ---------- */
  useEffect(() => {
    try { localStorage.setItem("trace_theme", theme); } catch { /* ignore */ }
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  /* ---------- auth ---------- */
  const logout = useCallback(() => {
    setToken(null); setUser(null); setCourses([]); setOverview(null); setCourse(null); setNotifications([]);
    window.location.hash = "/";
  }, []);
  useEffect(() => { setUnauthorizedHandler(() => { logout(); toast.info("Phiên đăng nhập đã hết hạn."); }); }, [logout]);
  useEffect(() => {
    if (!getToken()) return;
    api<User>("/api/auth/me").then(setUser).catch(() => setToken(null)).finally(() => setBooting(false));
  }, []);

  /* ---------- loaders ---------- */
  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    try { setCourses(await api<Course[]>("/api/courses")); } catch (e: any) { toast.error(e.message); } finally { setCoursesLoading(false); }
  }, []);
  const loadOverview = useCallback(() => api("/api/overview").then(setOverview).catch(() => {}), []);
  const loadNotifications = useCallback(async () => {
    try { const r = await apiRaw("/api/notifications"); if (r.success) { setNotifications(r.data); setUnread(r.unread); } } catch { /* ignore */ }
  }, []);
  const loadCourse = useCallback(async (id: string, withStats: boolean) => {
    try {
      setCourse(await api(`/api/courses/${id}`));
      if (withStats) api<ClassStats>(`/api/courses/${id}/stats`).then(setStats).catch(() => setStats(null));
    } catch (e: any) { toast.error(e.message); navigate("/"); }
  }, []);

  useEffect(() => { if (user) { loadCourses(); loadOverview(); loadNotifications(); } }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    const t = setInterval(loadNotifications, 30000);
    return () => clearInterval(t);
  }, [user?.id]);

  // route-driven data
  useEffect(() => {
    if (!user) return;
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
    if (route.name === "home" || route.name === "courses" || route.name === "todo") { loadCourses(); loadOverview(); return; }
    if (route.name === "admin") return;
    const teacher = user.role !== "student";
    if (route.name === "course") { setCourse(null); setStats(null); loadCourse(route.courseId, teacher); return; }
    if (route.name === "assignment" || route.name === "submission") {
      if (!course || course.id !== route.courseId) loadCourse(route.courseId, false);
    }
    if (route.name === "assignment") {
      setAssignmentDetail(null); setSubList(null); setSheetsUrl(null);
      api(`/api/assignments/${route.assignmentId}`).then(setAssignmentDetail).catch((e) => { toast.error(e.message); navigate(`/course/${route.courseId}`); });
      if (teacher) api(`/api/assignments/${route.assignmentId}/submissions`).then((d: any) => setSubList(d.submissions)).catch(() => {});
    }
    if (route.name === "submission") {
      setSubDetail(null);
      if (!teacher) { navigate(`/course/${route.courseId}/assignment/${route.assignmentId}`); return; }
      api(`/api/submissions/${route.submissionId}`).then(setSubDetail).catch((e) => { toast.error(e.message); navigate(`/course/${route.courseId}/assignment/${route.assignmentId}`); });
    }
  }, [path, user?.id]);

  /* ---------- actions ---------- */
  const refreshCourseViews = async (id: string) => { await Promise.all([loadCourses(), loadCourse(id, user?.role === "teacher")]); };

  const saveCourse = async (data: { name: string; code: string; semester: string; description: string }) => {
    if (courseModal.course) {
      await api(`/api/courses/${courseModal.course.id}`, { method: "PUT", body: data });
      toast.success("Đã cập nhật môn học.");
      await loadCourses();
      if (route.name === "course" && route.courseId === courseModal.course.id) loadCourse(route.courseId, true);
    } else {
      const c = await api<Course>("/api/courses", { method: "POST", body: data });
      toast.success(`Đã tạo môn học. Mã mời: ${c.invite_code}`);
      await loadCourses(); navigate(`/course/${c.id}`);
    }
  };
  const joinCourse = async (code: string) => {
    const c = await api<Course>("/api/courses/join", { method: "POST", body: { invite_code: code } });
    toast.success(`Đã tham gia ${c.name}!`);
    await loadCourses(); navigate(`/course/${c.id}`);
  };
  const saveAssignment = async (data: AssignmentFormData) => {
    if (assignmentModal.assignment) {
      await api(`/api/assignments/${assignmentModal.assignment.id}`, { method: "PUT", body: data });
      toast.success("Đã cập nhật bài tập.");
      if (route.name === "assignment") { api(`/api/assignments/${route.assignmentId}`).then(setAssignmentDetail); }
    } else if (route.name === "course") {
      await api(`/api/courses/${route.courseId}/assignments`, { method: "POST", body: data });
      toast.success("Đã giao bài tập. Sinh viên đã nhận thông báo.");
    }
    const cid = route.name === "course" || route.name === "assignment" ? route.courseId : null;
    if (cid) await refreshCourseViews(cid);
  };

  const confirmPending = async () => {
    if (!pending) return;
    const p = pending.payload;
    if (pending.kind === "course") {
      await api(`/api/courses/${p.id}`, { method: "DELETE" });
      toast.success("Đã xóa môn học."); await loadCourses(); if (route.name !== "home") navigate("/");
    } else if (pending.kind === "assignment") {
      await api(`/api/assignments/${p.id}`, { method: "DELETE" });
      toast.success("Đã xóa bài tập."); const cid = course?.id; if (route.name === "assignment") navigate(`/course/${route.courseId}`); if (cid) await refreshCourseViews(cid);
    } else if (pending.kind === "member") {
      await api(`/api/courses/${course.id}/members/${p.student_id}`, { method: "DELETE" });
      toast.success("Đã xóa sinh viên khỏi lớp."); await refreshCourseViews(course.id);
    } else if (pending.kind === "leave") {
      await api(`/api/courses/${p.id}/leave`, { method: "POST" });
      toast.success("Bạn đã rời lớp."); await loadCourses(); navigate("/");
    } else if (pending.kind === "regen") {
      const r = await api<{ invite_code: string }>(`/api/courses/${p.id}/regenerate-code`, { method: "POST" });
      toast.success(`Mã mời mới: ${r.invite_code}`); await refreshCourseViews(p.id);
    }
  };

  const exportSheets = async () => {
    if (!subList || !assignmentDetail) return;
    setExporting(true);
    try {
      let token = await getAccessToken();
      if (!token) token = (await googleSignIn())?.accessToken || null;
      if (!token) throw new Error("Cần đăng nhập Google Workspace để tiếp tục.");
      const r = await exportSubmissionsToSheets(token, course?.name || "Môn học", assignmentDetail.assignment.title, subList);
      setSheetsUrl(r.spreadsheetUrl); toast.success("Đã xuất bảng điểm ra Google Sheets.");
    } catch (e: any) { toast.error(e.message || "Không xuất được Google Sheets."); } finally { setExporting(false); }
  };

  const notificationClick = (n: AppNotification) => { if (n.link) navigate(n.link); };
  const readNotifications = async () => { if (unread > 0) { await api("/api/notifications/read", { method: "POST" }).catch(() => {}); setUnread(0); setTimeout(loadNotifications, 4000); } };

  /* ---------- render ---------- */
  if (booting) return <div className="min-h-screen flex items-center justify-center bg-bg"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} className="w-10 h-10 rounded-full border-4 border-line border-t-brand" /></div>;
  if (!user) return <LoginPage onAuthed={(u) => { setUser(u); navigate("/"); }} />;

  const manage = user.role !== "student";
  const cid = "courseId" in route ? route.courseId : null;
  const goCourse = () => cid && navigate(`/course/${cid}`);
  const crumbs: { label: string; onClick?: () => void }[] = [];
  if (route.name === "courses") crumbs.push({ label: "Tất cả môn học" });
  if (route.name === "todo") crumbs.push({ label: manage ? "Bài nộp cần chấm" : "Việc cần làm" });
  if (route.name === "admin") crumbs.push({ label: "Quản trị hệ thống" });
  if (cid) crumbs.push({ label: course?.name || "Môn học", onClick: route.name === "course" ? undefined : goCourse });
  if (route.name === "assignment" || route.name === "submission") crumbs.push({ label: assignmentDetail?.assignment?.title || "Bài tập", onClick: route.name === "assignment" ? undefined : () => navigate(`/course/${route.courseId}/assignment/${(route as any).assignmentId}`) });
  if (route.name === "submission") crumbs.push({ label: subDetail?.submission?.student_name || "Bài nộp" });

  const back = (to: string) => <button onClick={() => navigate(to)} className="btn btn-ghost btn-sm mb-4"><ArrowLeft className="w-4 h-4" />Quay lại</button>;
  const pendingConfig = pending && ({
    course: { title: "Xóa môn học", itemType: "môn học", itemName: pending.payload.name, confirmLabel: "Xóa môn học" },
    assignment: { title: "Xóa bài tập", itemType: "bài tập", itemName: pending.payload.title, confirmLabel: "Xóa bài tập" },
    member: { title: "Xóa khỏi lớp", itemType: "sinh viên", itemName: pending.payload.student_name, confirmLabel: "Xóa khỏi lớp", warning: "Sinh viên sẽ mất quyền truy cập môn học này. Bài nộp đã có vẫn được giữ lại." },
    leave: { title: "Rời khỏi lớp", itemType: "môn học", itemName: pending.payload.name, confirmLabel: "Rời lớp", warning: "Bạn có thể tham gia lại bằng mã mời. Bài nộp của bạn vẫn được giữ lại." },
    regen: { title: "Tạo mã mời mới", itemType: "mã mời của môn", itemName: pending.payload.name, confirmLabel: "Tạo mã mới", warning: "Mã cũ sẽ không còn hiệu lực. Sinh viên đã trong lớp không bị ảnh hưởng." },
  } as const)[pending.kind];
  const todoCount = overview ? (manage ? overview.to_grade_count : overview.pending_count + overview.overdue_count) : 0;
  const canCreateCourse = manage && hasPerm(user, "create_course");
  const openCourse = (id: string, tab?: string) => navigate(`/course/${id}${tab ? "/" + tab : ""}`);
  const pageKey = route.name === "course" ? `course-${route.courseId}` : path.split("?")[0];

  return (
    <div className="min-h-screen bg-bg text-ink antialiased">
      <Header user={user} crumbs={crumbs} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onToggleMenu={toggleMenu} onGoHome={() => navigate("/")}
        notifications={notifications} unread={unread} onOpenNotifications={readNotifications} onNotificationClick={notificationClick}
        onCreateCourse={canCreateCourse ? () => setCourseModal({ open: true, course: null }) : undefined} onJoinCourse={() => setJoinOpen(true)}
        onCreateUser={user.role === "admin" ? () => navigate("/admin/users") : undefined} onOpenSettings={() => setSettingsOpen(true)} onLogout={logout} />
      <Sidebar user={user} courses={courses} expanded={expanded} mobileOpen={mobileOpen} routeName={route.name} activeCourseId={cid} todoCount={todoCount}
        onNavigate={navigate} onOpenSettings={() => setSettingsOpen(true)} onCloseMobile={() => setMobileOpen(false)} />

      <div className={`pt-16 min-h-screen flex flex-col min-w-0 transition-[padding] duration-300 ${expanded ? "md:pl-72" : "md:pl-[72px]"}`}>
        <main className="flex-1 w-full min-w-0 max-w-[88rem] mx-auto px-4 md:px-6 py-4 md:py-5 overflow-x-clip">
          <AnimatePresence mode="wait">
            <motion.div key={pageKey} variants={pageVariants} initial="initial" animate="animate" exit="exit">
              {route.name === "home" && (
                <DashboardPage user={user} courses={courses} overview={overview} loading={coursesLoading}
                  onSelectCourse={openCourse} onOpenAssignment={(c, a) => navigate(`/course/${c}/assignment/${a}`)}
                  onOpenSubmission={(c, a, s) => navigate(`/course/${c}/assignment/${a}/submission/${s}`)}
                  onCreateCourse={() => setCourseModal({ open: true, course: null })} onJoinCourse={() => setJoinOpen(true)}
                  onEditCourse={(c) => setCourseModal({ open: true, course: c })} onDeleteCourse={(c) => setPending({ kind: "course", payload: c })}
                  onGoAdmin={() => navigate("/admin")} onGoCourses={() => navigate("/courses")} />
              )}

              {route.name === "courses" && (
                <CoursesPage user={user} courses={courses} loading={coursesLoading} onSelect={openCourse} onEdit={(c) => setCourseModal({ open: true, course: c })}
                  onDelete={(c) => setPending({ kind: "course", payload: c })} onCreate={() => setCourseModal({ open: true, course: null })} onJoin={() => setJoinOpen(true)} />
              )}

              {route.name === "todo" && (
                <TodoPage user={user} overview={overview} onOpenAssignment={(c, a) => navigate(`/course/${c}/assignment/${a}`)} onOpenSubmission={(c, a, s) => navigate(`/course/${c}/assignment/${a}/submission/${s}`)} />
              )}

              {route.name === "admin" && user.role === "admin" && (
                <AdminPage me={user} tab={route.tab || "overview"} onTab={(t) => navigate(`/admin${t === "overview" ? "" : "/" + t}`)} onOpenSupabase={() => setSupabaseOpen(true)} />
              )}
              {route.name === "admin" && user.role !== "admin" && <div className="panel text-center text-ink-2">Bạn không có quyền truy cập khu vực quản trị.</div>}

              {route.name === "course" && (
                <CoursePage user={user} course={course} stats={stats} tab={route.tab || "assignments"} onTab={(t) => navigate(`/course/${route.courseId}${t === "assignments" ? "" : "/" + t}`)}
                  onOpenAssignment={(id) => navigate(`/course/${route.courseId}/assignment/${id}`)}
                  onCreateAssignment={() => setAssignmentModal({ open: true, assignment: null })} onEditAssignment={(a) => setAssignmentModal({ open: true, assignment: a })}
                  onDeleteAssignment={(a) => setPending({ kind: "assignment", payload: a })}
                  onEditCourse={() => setCourseModal({ open: true, course })} onDeleteCourse={() => setPending({ kind: "course", payload: course })}
                  onRegenerateCode={() => setPending({ kind: "regen", payload: course })} onLeave={() => setPending({ kind: "leave", payload: course })}
                  onRemoveMember={(m) => setPending({ kind: "member", payload: m })} />
              )}

              {route.name === "assignment" && (
                <div>
                  {back(`/course/${route.courseId}`)}
                  {!assignmentDetail ? <div className="space-y-4"><Skeleton className="h-24 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div>
                    : manage ? (
                      subList ? <AssignmentSubmissionsPage assignment={assignmentDetail.assignment} submissions={subList}
                        onOpen={(s) => navigate(`/course/${route.courseId}/assignment/${route.assignmentId}/submission/${s.id}`)}
                        onEdit={() => setAssignmentModal({ open: true, assignment: assignmentDetail.assignment })}
                        onCsv={() => downloadGradebookCSV(course?.name || "Mon_hoc", assignmentDetail.assignment.title, subList)}
                        onSheets={exportSheets} exporting={exporting} sheetsUrl={sheetsUrl} /> : <Skeleton className="h-96 rounded-3xl" />
                    ) : (
                      <StudentWorkspaceView key={assignmentDetail.assignment.id} assignment={assignmentDetail.assignment} courseName={assignmentDetail.course_name}
                        userName={user.name} userAvatar={user.avatar} submission={assignmentDetail.submission} chatSession={assignmentDetail.chat_session}
                        onSendMessage={(d) => api("/api/chat/message", { method: "POST", body: d })}
                        onSaveDraft={async (d) => { await api("/api/submissions/draft", { method: "POST", body: d }); }}
                        onSubmitAssignment={async (d) => { const s = await api<Submission>("/api/submissions/submit", { method: "POST", body: d }); loadOverview(); loadCourses(); return s; }} />
                    )}
                </div>
              )}

              {route.name === "submission" && (
                <div>
                  {back(`/course/${route.courseId}/assignment/${route.assignmentId}`)}
                  {!subDetail ? <div className="space-y-4"><Skeleton className="h-24 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div> : (
                    <TeacherSubmissionView key={subDetail.submission.id} submission={subDetail.submission} assignment={subDetail.assignment} chatSession={subDetail.chat_session}
                      onGrade={async (grade, feedback) => { const s = await api<Submission>(`/api/submissions/${subDetail.submission.id}/grade`, { method: "PUT", body: { grade, feedback } }); setSubDetail({ ...subDetail, submission: s }); loadCourses(); loadOverview(); }}
                      onReevaluate={async () => { const s = await api<Submission>(`/api/submissions/${subDetail.submission.id}/reevaluate`, { method: "POST" }); setSubDetail({ ...subDetail, submission: s }); }} />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CourseFormModal isOpen={courseModal.open} course={courseModal.course} onClose={() => setCourseModal({ open: false, course: null })} onSubmit={saveCourse} />
      <JoinCourseModal isOpen={joinOpen} onClose={() => setJoinOpen(false)} onSubmit={joinCourse} />
      <AssignmentFormModal isOpen={assignmentModal.open} assignment={assignmentModal.assignment} onClose={() => setAssignmentModal({ open: false, assignment: null })} onSubmit={saveAssignment} />
      <SupabaseModal isOpen={supabaseOpen} onClose={() => setSupabaseOpen(false)} onDataChanged={loadCourses} />
      <SettingsModal open={settingsOpen} user={user} onClose={() => setSettingsOpen(false)} onUpdated={setUser} />
      {pendingConfig && <DeleteConfirmModal isOpen={!!pending} {...pendingConfig} onClose={() => setPending(null)} onConfirm={confirmPending} />}
    </div>
  );
}
