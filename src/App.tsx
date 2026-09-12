import React, { useState, useEffect } from "react";
import { User, Course, Assignment, Submission, UserRole, ClassStats } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { CourseCard } from "./components/CourseCard";
import { CreateCourseModal } from "./components/CreateCourseModal";
import { EditCourseModal } from "./components/EditCourseModal";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { JoinCourseModal } from "./components/JoinCourseModal";
import { CreateAssignmentModal } from "./components/CreateAssignmentModal";
import { SupabaseModal } from "./components/SupabaseModal";
import { AssignmentCard } from "./components/AssignmentCard";
import { StudentWorkspaceView } from "./components/StudentWorkspaceView";
import { TeacherSubmissionView } from "./components/TeacherSubmissionView";
import { CourseStatsView } from "./components/CourseStatsView";
import { 
  googleSignIn, 
  getAccessToken, 
  exportSubmissionsToSheets,
  downloadGradebookCSV
} from "./lib/workspace";
import { 
  BookOpen, 
  Plus, 
  Users, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  ArrowLeft,
  Copy,
  Check,
  Search,
  FileText,
  UserPlus,
  FileSpreadsheet,
  ExternalLink,
  Loader2,
  Download,
  Share2,
  Edit3,
  Trash2
} from "lucide-react";

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>({
    id: "u_teacher_1",
    name: "TS. Nguyễn Văn Hùng",
    email: "hung.nguyen@edu.vn",
    role: "teacher",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeCourse, setActiveCourse] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"assignments" | "students" | "stats">("assignments");

  // Assignment selection & viewing
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [activeAssignmentDetail, setActiveAssignmentDetail] = useState<any>(null);

  // Submissions list for teacher
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<any>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [activeSubmissionDetail, setActiveSubmissionDetail] = useState<any>(null);

  // Course Stats
  const [courseStats, setCourseStats] = useState<ClassStats | null>(null);

  // Google Sheets Export States
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const [sheetsStatus, setSheetsStatus] = useState<string | null>(null);
  const [sheetsErrorRequiresNewTab, setSheetsErrorRequiresNewTab] = useState(false);

  const handleExportSheets = async () => {
    if (!assignmentSubmissions?.submissions || !activeAssignmentDetail) return;
    setIsExportingSheets(true);
    setSheetsStatus(null);
    setSheetsErrorRequiresNewTab(false);
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (authRes) token = authRes.accessToken;
      }
      if (!token) throw new Error("Cần đăng nhập Google Workspace để tiếp tục.");

      const courseTitle = activeCourse?.name || "Môn học";
      const assignmentTitle = activeAssignmentDetail.assignment.title;
      const res = await exportSubmissionsToSheets(
        token,
        courseTitle,
        assignmentTitle,
        assignmentSubmissions.submissions
      );

      setSheetsUrl(res.spreadsheetUrl);
      setSheetsStatus("Xuất dữ liệu bảng điểm ra Google Sheets thành công!");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Không thể khởi tạo Google Sheets.";
      setSheetsStatus("Lỗi xuất Google Sheets: " + msg);
      if (msg.includes("Tab mới") || msg.includes("Popup") || msg.includes("popup")) {
        setSheetsErrorRequiresNewTab(true);
      }
    } finally {
      setIsExportingSheets(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!assignmentSubmissions?.submissions || !activeAssignmentDetail) return;
    const courseTitle = activeCourse?.name || "Mon_hoc";
    const assignmentTitle = activeAssignmentDetail.assignment.title;
    downloadGradebookCSV(courseTitle, assignmentTitle, assignmentSubmissions.submissions);
  };

  // Modals & UI States
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [isJoinCourseOpen, setIsJoinCourseOpen] = useState(false);
  const [isCreateAssignmentOpen, setIsCreateAssignmentOpen] = useState(false);
  const [isEditCourseOpen, setIsEditCourseOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
  const [isDeleteCourseOpen, setIsDeleteCourseOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Theme State: 'dark' | 'light'
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("trace_theme");
    return (saved as "dark" | "light") || "dark";
  });

  useEffect(() => {
    localStorage.setItem("trace_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Fetch Users on Load
  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          setUsers(data.data);
        }
      })
      .catch((err) => console.error("Error loading users:", err));
  }, []);

  // Fetch Courses when Current User/Role Changes
  const loadCourses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/courses?role=${currentUser.role}&userId=${currentUser.id}`);
      const data = await res.json();
      if (data.success) {
        setCourses(data.data);
      }
    } catch (err) {
      console.error("Error loading courses:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    setActiveCourseId(null);
    setActiveCourse(null);
    setActiveAssignmentId(null);
    setActiveSubmissionId(null);
  }, [currentUser]);

  // Load Single Course Detail when Selected
  const loadCourseDetail = async (courseId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}?studentId=${currentUser.id}`);
      const data = await res.json();
      if (data.success) {
        setActiveCourse(data.data);
      }
    } catch (err) {
      console.error("Error loading course detail:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeCourseId) {
      loadCourseDetail(activeCourseId);
      if (currentUser.role === "teacher") {
        loadCourseStats(activeCourseId);
      }
    }
  }, [activeCourseId, currentUser]);

  // Load Course Stats for Teacher
  const loadCourseStats = async (courseId: string) => {
    try {
      const res = await fetch(`/api/courses/${courseId}/stats`);
      const data = await res.json();
      if (data.success) {
        setCourseStats(data.data);
      }
    } catch (err) {
      console.error("Error loading course stats:", err);
    }
  };

  // Load Assignment Detail
  const loadAssignmentDetail = async (assignmentId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}?studentId=${currentUser.id}`);
      const data = await res.json();
      if (data.success) {
        setActiveAssignmentDetail(data.data);
      }

      if (currentUser.role === "teacher") {
        const subRes = await fetch(`/api/assignments/${assignmentId}/submissions`);
        const subData = await subRes.json();
        if (subData.success) {
          setAssignmentSubmissions(subData.data);
        }
      }
    } catch (err) {
      console.error("Error loading assignment detail:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeAssignmentId) {
      loadAssignmentDetail(activeAssignmentId);
    }
  }, [activeAssignmentId]);

  // Load Submission Detail for Teacher
  const loadSubmissionDetail = async (subId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/submissions/${subId}`);
      const data = await res.json();
      if (data.success) {
        setActiveSubmissionDetail(data.data);
      }
    } catch (err) {
      console.error("Error loading submission detail:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubmissionId) {
      loadSubmissionDetail(activeSubmissionId);
    }
  }, [activeSubmissionId]);

  // Switch Role Handler
  const handleSwitchRole = (newRole: UserRole) => {
    if (newRole === "teacher") {
      const teacherUser = users.find((u) => u.role === "teacher") || {
        id: "u_teacher_1",
        name: "TS. Nguyễn Văn Hùng",
        email: "hung.nguyen@edu.vn",
        role: "teacher" as UserRole,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      };
      setCurrentUser(teacherUser);
    } else {
      const studentUser = users.find((u) => u.role === "student") || {
        id: "u_student_1",
        name: "Lã Uyển Nhi",
        email: "la.uyennhi@student.edu.vn",
        role: "student" as UserRole,
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      };
      setCurrentUser(studentUser);
    }
  };

  // Create Course Action
  const handleCreateCourse = async (courseData: { name: string; code: string; semester: string; description: string }) => {
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...courseData, teacher_id: currentUser.id }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    await loadCourses();
    setActiveCourseId(data.data.id);
  };

  // Edit Course Action
  const handleEditCourse = async (courseData: { name: string; code: string; semester: string; description: string }) => {
    if (!courseToEdit) return;
    const res = await fetch(`/api/courses/${courseToEdit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(courseData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    await loadCourses();
    if (activeCourseId === courseToEdit.id) {
      await loadCourseDetail(courseToEdit.id);
    }
  };

  // Delete Course Action
  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    const res = await fetch(`/api/courses/${courseToDelete.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    if (activeCourseId === courseToDelete.id) {
      setActiveCourseId(null);
      setActiveCourse(null);
      setActiveAssignmentId(null);
      setActiveSubmissionId(null);
    }
    await loadCourses();
  };

  // Join Course Action
  const handleJoinCourse = async (inviteCode: string) => {
    const res = await fetch("/api/courses/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: inviteCode, student_id: currentUser.id }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    await loadCourses();
    setActiveCourseId(data.data.id);
  };

  // Create Assignment Action
  const handleCreateAssignment = async (assignmentData: any) => {
    if (!activeCourseId) return;
    const res = await fetch(`/api/courses/${activeCourseId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignmentData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    await loadCourseDetail(activeCourseId);
  };

  // Send Chat Message Action
  const handleSendMessage = async (msgData: any) => {
    const res = await fetch("/api/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msgData),
    });
    return await res.json();
  };

  // Submit Assignment Action
  const handleSubmitAssignment = async (subData: any) => {
    const res = await fetch("/api/submissions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    if (activeAssignmentId) {
      await loadAssignmentDetail(activeAssignmentId);
    }
  };

  const copyInviteCode = () => {
    if (activeCourse?.invite_code) {
      navigator.clipboard.writeText(activeCourse.invite_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex font-sans antialiased selection:bg-zinc-800 selection:text-white transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        courses={courses}
        activeCourseId={activeCourseId}
        onSelectCourse={(id) => {
          setActiveCourseId(id);
          setActiveAssignmentId(null);
          setActiveSubmissionId(null);
        }}
        onSwitchRole={handleSwitchRole}
        onOpenCreateCourse={() => setIsCreateCourseOpen(true)}
        onOpenJoinCourse={() => setIsJoinCourseOpen(true)}
        onOpenSupabase={() => setIsSupabaseModalOpen(true)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Header */}
        <Header
          currentUser={currentUser}
          onToggleMobileMenu={() => setIsMobileOpen(!isMobileOpen)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSupabase={() => setIsSupabaseModalOpen(true)}
          title={
            activeCourseId
              ? `${activeCourse?.code || ""} - ${activeCourse?.name || "Chi tiết môn học"}`
              : currentUser.role === "teacher"
              ? "Quản lý Các Môn Giảng Dạy"
              : "Danh Sách Môn Học Tham Gia"
          }
          subtitle={
            activeCourseId
              ? `${activeCourse?.semester || ""} • Giảng viên: ${activeCourse?.teacher_name || ""}`
              : "Nền tảng gom toàn bộ luồng dạy-học & Đánh giá quá trình tư duy AI"
          }
        />

        {/* Page Container */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
          {/* VIEW 1: Teacher Viewing Detailed Process Score Submission */}
          {activeSubmissionId && activeSubmissionDetail ? (
            <TeacherSubmissionView
              submission={activeSubmissionDetail.submission}
              assignment={activeSubmissionDetail.assignment}
              chatSession={activeSubmissionDetail.chat_session}
              onBack={() => setActiveSubmissionId(null)}
            />
          ) : activeAssignmentId && activeAssignmentDetail ? (
            /* VIEW 2: Student Workspace or Teacher Assignment Submissions Table */
            currentUser.role === "student" ? (
              <StudentWorkspaceView
                assignment={activeAssignmentDetail.assignment}
                courseName={activeAssignmentDetail.course_name}
                studentId={currentUser.id}
                submission={activeAssignmentDetail.submission}
                chatSession={activeAssignmentDetail.chat_session}
                onBack={() => setActiveAssignmentId(null)}
                onSubmitAssignment={handleSubmitAssignment}
                onSendMessage={handleSendMessage}
              />
            ) : (
              /* Teacher View Submissions Table */
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveAssignmentId(null)}
                      className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        Danh sách bài nộp sinh viên
                      </div>
                      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        {activeAssignmentDetail.assignment.title}
                      </h2>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Hạn nộp:{" "}
                    <strong className="text-zinc-800 dark:text-zinc-200">
                      {new Date(activeAssignmentDetail.assignment.due_date).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                </div>

                {/* Submissions Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Thành viên lớp ({assignmentSubmissions?.submissions?.length || 0})
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleDownloadCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
                        title="Tải bảng điểm dạng file CSV trực tiếp"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Tải file CSV
                      </button>

                      <button
                        onClick={handleExportSheets}
                        disabled={isExportingSheets}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50 shrink-0"
                      >
                        {isExportingSheets ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-white" />
                        )}
                        Xuất sang Google Sheets
                      </button>
                    </div>
                  </div>

                  {sheetsStatus && (
                    <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex flex-wrap items-center justify-between gap-2 px-4">
                      <div className="flex items-center gap-2">
                        <span>{sheetsStatus}</span>
                        {sheetsErrorRequiresNewTab && (
                          <a
                            href={window.location.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 hover:underline ml-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Mở app trong Tab mới
                          </a>
                        )}
                      </div>
                      {sheetsUrl && (
                        <a
                          href={sheetsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 shrink-0"
                        >
                          Mở Google Sheets <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-100/70 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-3 px-4">Sinh viên</th>
                          <th className="py-3 px-4">Trạng thái</th>
                          <th className="py-3 px-4">Thời gian nộp</th>
                          <th className="py-3 px-4">AI Process Score</th>
                          <th className="py-3 px-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                        {assignmentSubmissions?.submissions?.map((sub: Submission) => (
                          <tr
                            key={sub.id}
                            onClick={() => {
                              if (sub.status === "submitted" || sub.status === "late") {
                                setActiveSubmissionId(sub.id);
                              }
                            }}
                            className={`hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer ${
                              sub.status === "submitted" || sub.status === "late" ? "" : "opacity-60"
                            }`}
                          >
                            <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                                {sub.student_name.slice(0, 1)}
                              </div>
                              <div>
                                <div>{sub.student_name}</div>
                                <div className="text-[10px] text-zinc-400 font-normal">{sub.student_email}</div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {sub.status === "submitted" && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Đã nộp bài
                                </span>
                              )}
                              {sub.status === "late" && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Nộp trễ
                                </span>
                              )}
                              {sub.status === "not_submitted" && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  Chưa nộp
                                </span>
                              )}
                              {sub.status === "draft" && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                                  Đang nháp
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                              {sub.submitted_at
                                ? new Date(sub.submitted_at).toLocaleString("vi-VN")
                                : "—"}
                            </td>
                            <td className="py-3.5 px-4">
                              {sub.process_score_result ? (
                                <span className="px-2.5 py-1 rounded-full font-extrabold text-[11px] bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-950 border border-zinc-800 dark:border-zinc-200 inline-flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-400 dark:text-amber-600 fill-amber-400 dark:fill-amber-600" />
                                  {sub.process_score_result.process_score}/100
                                </span>
                              ) : (
                                <span className="text-zinc-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {sub.status === "submitted" || sub.status === "late" ? (
                                <button className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 font-bold text-xs transition-colors">
                                  Xem chi tiết & Process
                                </button>
                              ) : (
                                <span className="text-zinc-400 text-xs">Chưa nộp</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : activeCourseId && activeCourse ? (
            /* VIEW 3: Inside a Specific Course (3 Tabs for Teacher, List for Student) */
            <div className="space-y-6">
              {/* Course Detail Banner */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                      {activeCourse.code}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{activeCourse.semester}</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">{activeCourse.name}</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{activeCourse.description}</p>
                </div>

                {/* Invite Code Badge & Teacher Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {currentUser.role === "teacher" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCourseToEdit(activeCourse);
                          setIsEditCourseOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
                        title="Chỉnh sửa thông tin môn học"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Chỉnh sửa</span>
                      </button>

                      <button
                        onClick={() => {
                          setCourseToDelete(activeCourse);
                          setIsDeleteCourseOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors border border-rose-200 dark:border-rose-900/50"
                        title="Xóa môn học"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa môn</span>
                      </button>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-right">
                    <div className="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Mã mời lớp học</div>
                    <div className="text-lg font-mono font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      {activeCourse.invite_code}
                      <button
                        onClick={copyInviteCode}
                        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                        title="Sao chép mã"
                      >
                        {codeCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs (Teacher: 3 tabs; Student: 2 tabs) */}
              <div className="border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("assignments")}
                    className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                      activeTab === "assignments"
                        ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                        : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Bài tập ({activeCourse.assignments?.length || 0})
                  </button>

                  <button
                    onClick={() => setActiveTab("students")}
                    className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                      activeTab === "students"
                        ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                        : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Sinh viên ({activeCourse.members?.length || 0})
                  </button>

                  {currentUser.role === "teacher" && (
                    <button
                      onClick={() => setActiveTab("stats")}
                      className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === "stats"
                          ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                          : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      Thống kê & AI Progress
                    </button>
                  )}
                </div>

                {/* Teacher button to create assignment */}
                {currentUser.role === "teacher" && activeTab === "assignments" && (
                  <button
                    onClick={() => setIsCreateAssignmentOpen(true)}
                    className="mb-2 flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Giao bài tập mới</span>
                  </button>
                )}
              </div>

              {/* Tab 1: Assignments List */}
              {activeTab === "assignments" && (
                <div className="space-y-3">
                  {activeCourse.assignments?.length > 0 ? (
                    activeCourse.assignments.map((assignment: Assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        role={currentUser.role}
                        onSelect={(id) => setActiveAssignmentId(id)}
                      />
                    ))
                  ) : (
                    <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Chưa có bài tập nào</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {currentUser.role === "teacher"
                          ? "Hãy tạo bài tập mới để học sinh bắt đầu làm bài và tương tác với Trợ lý AI."
                          : "Giảng viên chưa giao bài tập nào trong môn học này."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Class Members List */}
              {activeTab === "students" && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                    Danh sách sinh viên đã tham gia môn học
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeCourse.members?.map((m: any) => (
                      <div
                        key={m.student_id}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-950 font-bold flex items-center justify-center text-sm">
                          {m.student_name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{m.student_name}</div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{m.student_email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Class Statistics (Teacher Only) */}
              {activeTab === "stats" && currentUser.role === "teacher" && courseStats && (
                <CourseStatsView stats={courseStats} />
              )}
            </div>
          ) : (
            /* VIEW 4: Main Home Course Grid Dashboard */
            <div className="space-y-6">
              {/* Top Banner / USP Intro */}
              <div className="p-6 md:p-8 rounded-2xl bg-zinc-900 dark:bg-zinc-900 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-zinc-800">
                <div className="space-y-2 relative z-10 max-w-2xl">
                  <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 text-[11px] font-mono uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-100" />
                    TRACE PLATFORM
                  </span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                    LMS Quản Lý Dạy & Học Tập Trung
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                    Gom toàn bộ môn học, bài tập và theo dõi <strong>quá trình tư duy AI</strong> của sinh viên minh bạch về một nơi duy nhất.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 relative z-10">
                  {currentUser.role === "teacher" ? (
                    <button
                      onClick={() => setIsCreateCourseOpen(true)}
                      className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tạo môn học mới</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsJoinCourseOpen(true)}
                      className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Nhập mã tham gia lớp</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Easy Guidance Guide for Teachers */}
              {currentUser.role === "teacher" && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                  <div className="font-extrabold text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    💡 Hướng dẫn nhanh sử dụng dành cho Giảng viên (3 Bước đơn giản):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-amber-500/20 space-y-1">
                      <strong className="text-zinc-900 dark:text-zinc-100 font-bold block">1. Chọn / Tạo môn học</strong>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Bấm <strong>+ Tạo môn học mới</strong> để lấy Mã mời gửi cho sinh viên tham gia lớp.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-amber-500/20 space-y-1">
                      <strong className="text-zinc-900 dark:text-zinc-100 font-bold block">2. Giao bài tập AI Socratic</strong>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Nhấp vào môn học &rarr; Bấm <strong>+ Giao bài tập mới</strong> để cho sinh viên làm bài & tranh luận AI.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-amber-500/20 space-y-1">
                      <strong className="text-zinc-900 dark:text-zinc-100 font-bold block">3. Xem Process Score & Xuất file</strong>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Xem điểm tư duy tự động, nhấn <strong>Xuất Bảng Điểm sang Google Sheets</strong> hoặc **Xuất Doc**.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Course Grid Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {currentUser.role === "teacher" ? "Môn học bạn đang giảng dạy" : "Môn học bạn đã tham gia"}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {currentUser.role === "teacher"
                      ? "Chọn môn học để giao bài tập, chấm bài hoặc xem thống kê AI"
                      : "Chọn môn học để làm bài tập và tương tác với Trợ lý AI"}
                  </p>
                </div>
              </div>

              {/* Course Grid Cards */}
              {courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {courses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      role={currentUser.role}
                      onSelect={(id) => setActiveCourseId(id)}
                      onEdit={(c) => {
                        setCourseToEdit(c);
                        setIsEditCourseOpen(true);
                      }}
                      onDelete={(c) => {
                        setCourseToDelete(c);
                        setIsDeleteCourseOpen(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center mx-auto">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Chưa có môn học nào trong danh sách</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {currentUser.role === "teacher"
                        ? "Bấm 'Tạo môn học mới' để cấp mã tham gia cho sinh viên."
                        : "Bấm 'Nhập mã tham gia lớp' và điền mã 6 ký tự do giảng viên cấp."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateCourseModal
        isOpen={isCreateCourseOpen}
        onClose={() => setIsCreateCourseOpen(false)}
        onSubmit={handleCreateCourse}
      />

      <EditCourseModal
        isOpen={isEditCourseOpen}
        course={courseToEdit}
        onClose={() => {
          setIsEditCourseOpen(false);
          setCourseToEdit(null);
        }}
        onSubmit={handleEditCourse}
      />

      <DeleteConfirmModal
        isOpen={isDeleteCourseOpen}
        title="Xác nhận xóa môn học"
        itemName={courseToDelete?.name || ""}
        itemType="môn học"
        onClose={() => {
          setIsDeleteCourseOpen(false);
          setCourseToDelete(null);
        }}
        onConfirm={handleDeleteCourse}
      />

      <JoinCourseModal
        isOpen={isJoinCourseOpen}
        onClose={() => setIsJoinCourseOpen(false)}
        onSubmit={handleJoinCourse}
      />

      <CreateAssignmentModal
        isOpen={isCreateAssignmentOpen}
        onClose={() => setIsCreateAssignmentOpen(false)}
        onSubmit={handleCreateAssignment}
      />

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onDataChanged={loadCourses}
      />
    </div>
  );
}
