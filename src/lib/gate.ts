/**
 * Shared by server and frontend: "answer gate" (Blur-to-Unlock) for AI-chat assignments.
 * The AI writes a full answer, but the student only sees the first ~30% (the hook). The rest
 * stays on the server until the student answers a few guiding questions; then the AI rewrites
 * the answer around the student's own ideas (still factually correct) and suggests other angles.
 *   none      - the AI answer is shown in full (previous behaviour)
 *   optional  - the student may open the full answer without answering, and the skip is recorded
 *   required  - the student must answer the questions to read the rest
 */
export type AnswerGate = "none" | "optional" | "required";
export const ANSWER_GATES: AnswerGate[] = ["none", "optional", "required"];

export const GATE_LABEL: Record<AnswerGate, { label: string; hint: string }> = {
  none: { label: "Không che", hint: "Hiện đầy đủ câu trả lời của AI" },
  optional: { label: "Che mờ, có thể bỏ qua", hint: "Hiện 30%, che 70%; cho xem luôn nhưng có ghi nhận" },
  required: { label: "Che mờ, bắt buộc", hint: "Phải trả lời câu hỏi mới đọc được phần còn lại" },
};

export const GATE_SHOW_RATIO = 0.3;
export const GATE_MIN_ANSWERS = 2;
export const GATE_MIN_CHARS = 30;

export const isAnswerGate = (v: any): v is AnswerGate => ANSWER_GATES.includes(v);

export interface GateInfo {
  state: "locked" | "unlocked";
  /** The student's guiding questions for this answer. */
  questions: string[];
  /** Locked, student side: how many characters are hidden (so the blur block has the right height). Never the text itself. */
  hidden_chars?: number;
  /** The opening ~30% that was shown. */
  teaser?: string;
  /** Server and teacher only: the full draft written before unlocking. Always stripped for students. */
  draft?: string;
  answers?: { q: string; a: string }[];
  skipped?: boolean;
  used_ideas?: string[];
  alternatives?: string[];
  /** Gentle factual correction when a student idea was not accurate. */
  correction?: string;
  unlocked_at?: string;
}

/**
 * Cuts the visible opening at a sentence boundary so it reads as a complete hook: as many whole
 * sentences as fit in about GATE_SHOW_RATIO of the text, never less than one sentence and never
 * more than 40%. Pure and deterministic, so the model cannot leak extra text by ignoring a limit.
 */
export function makeTeaser(full: string, ratio = GATE_SHOW_RATIO): string {
  const text = full.trim();
  if (!text) return "";
  // Candidate cut points: right after a sentence end, or at a paragraph break (keeps lists and line breaks intact)
  const ends: number[] = [];
  const re = /[.!?…。](?=\s)|\n{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) ends.push(m[0].length === 1 ? m.index + 1 : m.index);
  const target = text.length * ratio, hard = text.length * 0.4;
  const usable = ends.filter((e) => e > 20 && e < text.length);
  if (usable.length === 0) return text.slice(0, Math.max(40, Math.floor(target))).trim() + "…";
  const reach = usable.find((e) => e >= target && e <= hard);
  const under = [...usable].reverse().find((e) => e <= hard);
  const cut = reach ?? under ?? usable[0];
  return text.slice(0, cut).trim() + "…";
}
