/**
 * Shared by server and frontend: "input friction" for AI-chat assignments.
 * The teacher picks, per assignment, how much the student must think before the AI answers.
 *   none     - chat freely (previous behaviour)
 *   nudge    - the student is asked to write their own first ideas, but may skip (the skip is recorded)
 *   required - the student must write their own first ideas before the AI replies
 */
export type FrictionLevel = "none" | "nudge" | "required";
export const FRICTION_LEVELS: FrictionLevel[] = ["none", "nudge", "required"];

export const FRICTION_LABEL: Record<FrictionLevel, { label: string; hint: string }> = {
  none: { label: "Không có", hint: "Chat tự do như trước" },
  nudge: { label: "Nhắc nhẹ", hint: "Mời viết ý riêng trước, cho phép bỏ qua (có ghi nhận)" },
  required: { label: "Bắt buộc", hint: "Phải viết ý riêng trước khi AI trả lời" },
};

export const DEFAULT_FRICTION_PROMPTS = [
  "Luận điểm cốt lõi của em về đề bài này là gì?",
  "Em định dùng dẫn chứng hoặc ví dụ nào?",
  "Điểm nào em còn băn khoăn hoặc chưa chắc?",
];

export const FRICTION_MIN_ANSWERS = 2;
export const FRICTION_MIN_CHARS = 40;

export interface ChatIntent {
  answers: { q: string; a: string }[];
  /** Self-rated confidence 1-5 before seeing any AI answer (used for calibration). */
  confidence?: number;
  skipped: boolean;
  pasted_chars?: number;
  paste_attempts?: number;
  at: string;
}

export const isFrictionLevel = (v: any): v is FrictionLevel => FRICTION_LEVELS.includes(v);

/** Cleans teacher-provided guiding questions: 1-3 non-empty strings, falling back to defaults. */
export function cleanFrictionPrompts(v: any): string[] {
  const list = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim().slice(0, 200) : "")).filter(Boolean).slice(0, 3) : [];
  return list.length ? list : [...DEFAULT_FRICTION_PROMPTS];
}
