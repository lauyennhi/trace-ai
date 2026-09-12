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
  invite_code: string;
  accent_color: string; // Hex or tailwind class for card visual differentiation
  created_at: string;
  member_count?: number;
  open_assignments_count?: number;
  ungraded_count?: number;
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
  created_at: string;
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

export interface ClassStats {
  total_students: number;
  submission_rate: number; // 0-100
  on_time_rate: number; // 0-100
  late_rate: number; // 0-100
  not_submitted_rate: number; // 0-100
  average_process_score: number;
  score_distribution: {
    range: string;
    count: number;
  }[];
  low_process_score_assignments: {
    assignment_id: string;
    title: string;
    avg_score: number;
    recommendation: string;
  }[];
}
