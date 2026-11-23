export type UserRole = 'teacher' | 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  active?: boolean;
  last_seen?: string;
  permissions?: string[];
  /** When a student accepted how their learning data is stored and processed. */
  consent_at?: string;
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
  /** Class materials the AI stays close to. The client only ever receives names and sizes. */
  materials?: { id: string; name: string; chars: number; added_at?: string }[];
  created_at: string;
  member_count?: number;
  open_assignments_count?: number;
  assignments_count?: number;
  ungraded_count?: number;
  todo_count?: number;
  next_due?: { id: string; title: string; due_date: string } | null;
}

export interface CourseMember {
  course_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_avatar?: string;
  joined_at: string;
}

import type { PasteMode } from "./lib/paste";
import type { CoachNote } from "./lib/coach";
import type { L2Config, L2Work, L2Result, L2ErrorReport } from './lib/l2';
import type { FrictionLevel, ChatIntent } from './lib/friction';
import type { AnswerGate, GateInfo } from './lib/gate';

export type SubmissionMode = 'file_only' | 'ai_chat_only' | 'both' | 'writing_l2';
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
  /** Input friction for AI-chat assignments: how much the student must write before the AI answers. Missing = "none". */
  friction?: FrictionLevel;
  /** Whether pasting / copying is blocked inside this assignment. Missing = "track". */
  paste_mode?: PasteMode;
  /** Live coaching note under each student turn. Missing = on. */
  live_coach?: boolean;
  /** Stage settings: Think First's optional confidence question, Perspective Lab, Are you sure?. Missing = the two new stages are off. */
  stages?: {
    think_first?: { ask_confidence?: boolean };
    perspective_lab?: { enabled: boolean; required: boolean };
    are_you_sure?: { enabled: boolean; required: boolean; turns: number };
  };
  friction_prompts?: string[];
  /** Blur-to-Unlock: how the AI's answer is gated. Missing = "none". */
  answer_gate?: AnswerGate;
  /** Only for submission_mode 'writing_l2'. The answer key (errors) is stripped for students. */
  l2?: L2Config;
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
  /** Which stage the quote comes from (optional; older results have none). */
  stage?: 'think_first' | 'co_think' | 'perspective_lab' | 'are_you_sure';
}

export interface ProcessScoreResult {
  process_score: number;
  tieu_chi: ProcessCriteria;
  noi_dung_ngoai_luong: string | null;
  nhan_xet_ngan: string;
  highlight_segments: HighlightSegment[];
  /** Highlights the grader proposed whose quote was not in the evidence, and were therefore dropped. */
  dropped_quotes?: number;
  /** Model that produced this grade. */
  eval_model?: string;
  evidence_truncated?: boolean;
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
  l2_work?: L2Work;
  l2_result?: L2Result;
  l2_report?: L2ErrorReport;
  l2_teacher_scores?: Record<string, number>;
  eval_status?: 'ok' | 'failed' | 'skipped';
  eval_error?: string;
  draft_saved_at?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  phase?: 'prompt' | 'critique';
  /** "intent" = the student's own first ideas written before the AI answered (input friction). */
  kind?: 'intent';
  /** Characters pasted into this message (not typed). */
  pasted_chars?: number;
  /** Times the student tried to paste/copy while the teacher had blocked it. */
  paste_attempts?: number;
  /** Live coaching note the system attached to this student turn. */
  coach?: CoachNote;
  /** Set when the student pushed the AI to hand over the answer (Socratic mode). */
  pressure?: string;
  /** Set on AI replies the Socratic guard had to redo or replace. */
  guard?: 'regenerated' | 'fallback';
  /** Which stage this message belongs to. Missing = Co-Think (older messages). */
  stage?: 'co_think' | 'are_you_sure';
  /** Are-you-sure metadata: the AI's issue type on a question, the classification of the student's answer. */
  ays?: { issue_type?: string; response_type?: string; quote?: string };
  /** Present on AI answers that were gated (Blur-to-Unlock). */
  gate?: GateInfo;
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  submission_id?: string;
  assignment_id: string;
  student_id: string;
  messages: ChatMessage[];
  intent?: ChatIntent;
  /** Perspective Lab: the student's draft and what they did with it. */
  lab?: LabData | null;
}

export interface LabEvent {
  id: string;
  selection: { start: number; end: number; text: string };
  stance_text: string;
  mode: 'tranh_luan' | 'su_kien' | 'khong_ro';
  reason?: string;
  counterviews: { stance: string; argument: string; source: { title: string; verified: boolean } | null }[];
  verify?: { claim_to_check: string; how_to_check: string[] };
  clarify?: string;
  action?: 'accept' | 'rebut' | 'skip';
  rebuttal_text?: string;
  rewrite?: { before: string; after: string; similarity: number; typed: number; deleted: number; pasted: number; rewritten_from_scratch: boolean };
  ts: string;
}
export interface LabData { text: string; created_at: string; pasted_chars?: number; events: LabEvent[] }

export interface StudentStat {
  /** AI process score of each evaluated submission, oldest first (for the sparkline). */
  scores?: number[];
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
  average_grade?: number | null;
  heatmap?: { enough: boolean; evaluated: number; min?: number; cols?: string[]; rows?: string[]; cells?: number[][]; share?: { high: number; mid: number; low: number } };
  /** Anonymous, aggregated behaviour indicators (never per student; hidden below a minimum cohort). */
  behavior?: {
    enough: boolean;
    students: number;
    min_students?: number;
    gate?: { total: number; answered_rate: number | null; skipped_rate: number | null } | null;
    friction_sessions?: number;
    wrote_first_rate?: number | null;
    skipped_rate?: number | null;
    paste_heavy_rate?: number | null;
    paste_heavy_chars?: number;
    lab?: { sessions: number; used_rate: number | null; rewrote_rate: number | null } | null;
    ays?: { answered: number; distribution: Record<string, number> } | null;
    calibration?: { n: number; avg_confidence: number | null; avg_process_score: number | null } | null;
  };
  l2?: {
    assignments: number;
    evaluated: number;
    dimensions: { key: string; name: string; avg: number | null; distribution: number[] }[];
    missed_errors: { assignment_title: string; type: string; text: string; missed: number; total: number }[];
  };
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  created_at: string;
}
