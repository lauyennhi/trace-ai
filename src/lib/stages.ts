/**
 * Shared by server and frontend: the three stages of a chat assignment and the rules that open, close and require them.
 *   1 Think First (Nghĩ trước)   friction: the student writes their own ideas first
 *   2 Co-Think (Cùng nghĩ)       chat + blur-to-unlock + live feedback
 *   3 Are you sure? (Bạn chắc chứ?) the AI challenges the final position for N turns (default 3) before submitting
 * The Perspective Lab ("Góc nhìn khác") is NOT a stage of an assignment: it is a separate mode (see LAB_LIMITS below).
 * The server uses these functions to ENFORCE order and submission rules (principle P1); the UI only reflects them.
 */

export type StageId = "think_first" | "co_think" | "are_you_sure";
export const STAGE_LABEL: Record<StageId, { name: string; en: string; hint: string }> = {
  think_first: { name: "Nghĩ trước", en: "Think First", hint: "Viết ý riêng của bạn trước khi AI lên tiếng" },
  co_think: { name: "Cùng nghĩ", en: "Co-Think", hint: "Hỏi, mở khóa, chốt đáp án cùng trợ lý" },
  are_you_sure: { name: "Bạn chắc chứ?", en: "Are you sure?", hint: "AI hỏi ngược dựa trên bài bạn làm, trước khi nộp" },
};

export const MIN_COTHINK_TURNS = 3;
export const AYS_TURNS = { min: 1, max: 5, default: 3 };

/** Perspective Lab (separate mode): lengths enforced by the server. */
export const LAB_LIMITS = { minText: 80, maxText: 20000, minSel: 20, maxSel: 1500, minRebut: 20, minAfter: 10, maxAfter: 3000, maxTitle: 80, maxTopic: 200 };

export interface StageConfig {
  are_you_sure: { enabled: boolean; required: boolean; turns: number };
}

/** Reads an assignment's stage settings. Assignments created before stages existed have "Are you sure?" switched off. */
export function stageConfig(a: any): StageConfig {
  const ays = a?.stages?.are_you_sure || {};
  const turns = Math.round(Number(ays.turns));
  return { are_you_sure: { enabled: ays.enabled === true, required: ays.required !== false, turns: Number.isFinite(turns) ? Math.min(AYS_TURNS.max, Math.max(AYS_TURNS.min, turns)) : AYS_TURNS.default } };
}

/** Cleans what a teacher sends. Only chat assignments can have the stage. Returns the object to store on the assignment. */
export function cleanStages(raw: any, submissionMode: string) {
  const chat = submissionMode === "ai_chat_only" || submissionMode === "both";
  const cfg = stageConfig({ stages: raw });
  return { are_you_sure: { enabled: chat && cfg.are_you_sure.enabled, required: cfg.are_you_sure.required, turns: cfg.are_you_sure.turns } };
}

type Msg = { role: string; kind?: string; stage?: string };
export const isCoThinkTurn = (m: Msg) => m.role === "user" && m.kind !== "intent" && m.stage !== "are_you_sure";
export const coThinkTurns = (chat: any): number => (chat?.messages || []).filter(isCoThinkTurn).length;
export const aysAnswered = (chat: any): number => (chat?.messages || []).filter((m: Msg) => m.role === "user" && m.stage === "are_you_sure").length;

export interface StageView { id: StageId; name: string; en: string; hint: string; enabled: boolean; required: boolean; status: "locked" | "open" | "done"; detail: string }

export function computeStages(a: any, chat: any): StageView[] {
  const cfg = stageConfig(a);
  const thinkOn = !!a?.friction && a.friction !== "none";
  const thinkDone = !thinkOn || !!chat?.intent;
  const turns = coThinkTurns(chat), coDone = turns >= MIN_COTHINK_TURNS;
  const answered = aysAnswered(chat), aysDone = answered >= cfg.are_you_sure.turns;
  const mk = (id: StageId, enabled: boolean, required: boolean, status: StageView["status"], detail: string): StageView => ({ id, ...STAGE_LABEL[id], enabled, required, status, detail });
  return [
    mk("think_first", thinkOn, a?.friction === "required", thinkDone ? "done" : "open", thinkDone ? (chat?.intent?.skipped ? "Đã bỏ qua" : "Đã ghi ý") : "Viết ý riêng"),
    mk("co_think", true, true, !thinkDone ? "locked" : coDone ? "done" : "open", `${Math.min(turns, MIN_COTHINK_TURNS)}/${MIN_COTHINK_TURNS} lượt`),
    mk("are_you_sure", cfg.are_you_sure.enabled, cfg.are_you_sure.required, aysDone ? "done" : coDone ? "open" : "locked", `${Math.min(answered, cfg.are_you_sure.turns)}/${cfg.are_you_sure.turns} câu hỏi`),
  ].filter((s) => s.enabled || s.id === "co_think");
}

/** Why the student cannot submit yet, or null. Called by the server on submit; chat-less (file-only) assignments never call it. */
export function submitBlocker(a: any, chat: any): string | null {
  if (coThinkTurns(chat) < MIN_COTHINK_TURNS) return `Bạn cần trao đổi ít nhất ${MIN_COTHINK_TURNS} lượt với trợ lý AI trước khi nộp.`;
  const cfg = stageConfig(a);
  if (cfg.are_you_sure.enabled && cfg.are_you_sure.required && aysAnswered(chat) < cfg.are_you_sure.turns) return "Bạn cần trả lời hết các câu hỏi “Bạn chắc chứ?” trước khi nộp.";
  return null;
}

/** Why "Are you sure?" cannot be used right now, or null (the server calls this before it accepts any request to it). */
export function stageBlocker(a: any, chat: any): string | null {
  if (!stageConfig(a).are_you_sure.enabled) return "Bài tập này không có chặng này.";
  if (coThinkTurns(chat) < MIN_COTHINK_TURNS) return `Chặng này mở sau ${MIN_COTHINK_TURNS} lượt Cùng nghĩ.`;
  return null;
}
