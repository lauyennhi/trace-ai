export type UserRole = 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  teacher_name: string;
  semester: string;
  description: string;
  invite_code?: string;
  accent_color: string; // Hex or tailwind class for card visual differentiation
  created_at: string;
  member_count?: number;
  open_assignments_count?: number;
  assignments_count?: number;
  ungraded_count?: number;
  todo_count?: number;
}

export interface CourseMember {
  course_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_avatar?: string;
  joined_at: string;
}

export type SubmissionMode = 'file_only' | 'ai_chat_only' | 'both';
export type AISubmode = 'normal' | 'socratic';

export interface AssignmentAttachment {
  id: string;
  name: string;
  url: string;
  size?: string;
  type?: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description: string;
  rubric: string;
  due_date: string; // ISO string
  attachments: AssignmentAttachment[];
  submission_mode: SubmissionMode;
  ai_submode: AISubmode;
  allow_late?: boolean;
  created_at: string;
  submitted_count?: number;
  ungraded_count?: number;
  member_count?: number;
  my_grade?: number;
  // Computed for current student
  submission_status?: SubmissionStatus;
  submitted_at?: string;
  my_process_score?: number;
}

export type SubmissionStatus = 'draft' | 'submitted' | 'late' | 'not_submitted';

export interface ProcessCriteria {
  tu_duy_phan_bien: number; // 0-100
  dao_sau_van_de: number; // 0-100
  kiem_chung_thong_tin: number; // 0-100
  noi_hoa_kien_thuc: number; // 0-100
  tinh_chu_dong: number; // 0-100
}

export interface HighlightSegment {
  doan_van_ban: string;
  mau: 'xanh' | 'vang' | 'do';
  ly_do: string;
}

export interface ProcessScoreResult {
  process_score: number;
  tieu_chi: ProcessCriteria;
  noi_dung_ngoai_luong: string | null;
  nhan_xet_ngan: string;
  highlight_segments: HighlightSegment[];
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_avatar?: string;
  submitted_at?: string;
  submitted_files: AssignmentAttachment[];
  submitted_text: string;
  chat_session_id?: string;
  process_score?: number;
  process_score_result?: ProcessScoreResult;
  status: SubmissionStatus;
  notes?: string;
  grade?: number;
  feedback?: string;
  graded_at?: string;
  eval_status?: 'ok' | 'failed' | 'skipped';
  eval_error?: string;
  draft_saved_at?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  submission_id?: string;
  assignment_id: string;
  student_id: string;
  messages: ChatMessage[];
}

export interface StudentStat {
  student_id: string;
  student_name: string;
  student_email: string;
  student_avatar?: string;
  submitted: number;
  total: number;
  late: number;
  avg_process_score: number | null;
  avg_grade: number | null;
  needs_attention: boolean;
}

export interface ClassStats {
  total_students: number;
  total_assignments: number;
  submission_rate: number;
  on_time_rate: number;
  late_rate: number;
  not_submitted_rate: number;
  average_process_score: number | null;
  evaluated_count: number;
  score_distribution: { range: string; label: string; count: number }[];
  per_assignment: {
    assignment_id: string;
    title: string;
    submitted: number;
    total: number;
    avg_score: number | null;
    recommendation: string;
  }[];
  students: StudentStat[];
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  created_at: string;
}
