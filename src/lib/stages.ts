/**
 * Shared by server and frontend: the four stages of a chat assignment and the rules that open, close and require them.
 *   1 Think First (Nghĩ trước)      friction: the student writes their own ideas first
 *   2 Co-Think (Cùng nghĩ)          chat + blur-to-unlock + live feedback
 *   3 Perspective Lab (Góc nhìn khác) pick a passage, state a view, see other views, rewrite
 *   4 Are you sure? (Bạn chắc chứ?) the AI challenges the student's position for N turns
 * The server uses these functions to ENFORCE order and submission rules (principle P1); the UI only reflects them.
 */

export type StageId = "think_first" | "co_think" | "perspective_lab" | "are_you_sure";
export const STAGE_LABEL: Record<StageId, { name: string; en: string; hint: string }> = {
  think_first: { name: "Nghĩ trước", en: "Think First", hint: "Viết ý riêng của bạn trước khi AI lên tiếng" },
  co_think: { name: "Cùng nghĩ", en: "Co-Think", hint: "Hỏi, mở khóa, chốt ý cùng trợ lý" },
  perspective_lab: { name: "Góc nhìn khác", en: "Perspective Lab", hint: "Chọn một đoạn, nói ý của bạn, xem góc nhìn khác rồi sửa lại" },
  are_you_sure: { name: "Bạn chắc chứ?", en: "Are you sure?", hint: "AI chất vấn lập trường của bạn vài lượt" },
};

export const MIN_COTHINK_TURNS = 3;
export const LAB_LIMITS = { minText: 40, maxText: 20000, minSel: 20, maxSel: 1500, minStance: 20, minRebut: 20, minAfter: 10, maxAfter: 3000 };
export const AYS_TURNS = { min: 1, max: 5, default: 3 };

export interface StageConfig {
  ask_confidence: boolean;
  perspective_lab: { enabled: boolean; required: boolean };
  are_you_sure: { enabled: boolean; required: boolean; turns: number };
}

/** Reads an assignment's stage settings. Assignments created before stages existed have the two new stages switched off. */
export function stageConfig(a: any): StageConfig {
  const s = a?.stages || {};
  const lab = s.perspective_lab || {}, ays = s.are_you_sure || {};
  const turns = Math.round(Number(ays.turns));
  return {
    ask_confidence: s.think_first?.ask_confidence === true,
    perspective_lab: { enabled: lab.enabled === true, required: lab.required !== false },
    are_you_sure: { enabled: ays.enabled === true, required: ays.required !== false, turns: Number.isFinite(turns) ? Math.min(AYS_TURNS.max, Math.max(AYS_TURNS.min, turns)) : AYS_TURNS.default },
  };
}

/** Cleans what a teacher sends. Only chat assignments can have the new stages. Returns the object to store on the assignment. */
export function cleanStages(raw: any, submissionMode: string) {
  const chat = submissionMode === "ai_chat_only" || submissionMode === "both";
  const cfg = stageConfig({ stages: raw });
  return {
    think_first: { ask_confidence: chat ? cfg.ask_confidence : false },
    perspective_lab: { enabled: chat && cfg.perspective_lab.enabled, required: cfg.perspective_lab.required },
    are_you_sure: { enabled: chat && cfg.are_you_sure.enabled, required: cfg.are_you_sure.required, turns: cfg.are_you_sure.turns },
  };
}

type Msg = { role: string; kind?: string; stage?: string };
export const isCoThinkTurn = (m: Msg) => m.role === "user" && m.kind !== "intent" && m.stage !== "are_you_sure";
export const coThinkTurns = (chat: any): number => (chat?.messages || []).filter(isCoThinkTurn).length;
export const aysAnswered = (chat: any): number => (chat?.messages || []).filter((m: Msg) => m.role === "user" && m.stage === "are_you_sure").length;
export const labCompleted = (chat: any): number => (chat?.lab?.events || []).filter((e: any) => e.rewrite || e.action === "skip").length;

export interface StageView { id: StageId; name: string; en: string; hint: string; enabled: boolean; required: boolean; status: "locked" | "open" | "done"; detail: string }

export function computeStages(a: any, chat: any): StageView[] {
  const cfg = stageConfig(a);
  const thinkOn = !!a?.friction && a.friction !== "none";
  const thinkDone = !thinkOn || !!chat?.intent;
  const turns = coThinkTurns(chat), coDone = turns >= MIN_COTHINK_TURNS;
  const labDone = labCompleted(chat) >= 1;
  const labGate = !cfg.perspective_lab.enabled || labDone || !cfg.perspective_lab.required;
  const answered = aysAnswered(chat), aysDone = answered >= cfg.are_you_sure.turns;
  const mk = (id: StageId, enabled: boolean, required: boolean, status: StageView["status"], detail: string): StageView => ({ id, ...STAGE_LABEL[id], enabled, required, status, detail });
  return [
    mk("think_first", thinkOn, a?.friction === "required", thinkDone ? "done" : "open", thinkDone ? (chat?.intent?.skipped ? "Đã bỏ qua" : "Đã ghi ý") : "Viết ý riêng"),
    mk("co_think", true, true, !thinkDone ? "locked" : coDone ? "done" : "open", `${Math.min(turns, MIN_COTHINK_TURNS)}/${MIN_COTHINK_TURNS} lượt`),
    mk("perspective_lab", cfg.perspective_lab.enabled, cfg.perspective_lab.required, labDone ? "done" : coDone ? "open" : "locked", labDone ? `${labCompleted(chat)} đoạn` : coDone ? "Chưa làm" : `Mở sau ${MIN_COTHINK_TURNS} lượt Cùng nghĩ`),
    mk("are_you_sure", cfg.are_you_sure.enabled, cfg.are_you_sure.required, aysDone ? "done" : coDone && labGate ? "open" : "locked", `${Math.min(answered, cfg.are_you_sure.turns)}/${cfg.are_you_sure.turns} lượt`),
  ].filter((s) => s.enabled || s.id === "co_think");
}

/** Why the student cannot submit yet, or null. Called by the server on submit; chat-less (file-only) assignments never call it. */
export function submitBlocker(a: any, chat: any): string | null {
  if (coThinkTurns(chat) < MIN_COTHINK_TURNS) return `Bạn cần trao đổi ít nhất ${MIN_COTHINK_TURNS} lượt với trợ lý AI trước khi nộp.`;
  const cfg = stageConfig(a);
  if (cfg.perspective_lab.enabled && cfg.perspective_lab.required && labCompleted(chat) < 1) return "Bạn cần hoàn thành chặng “Góc nhìn khác” trước khi nộp.";
  if (cfg.are_you_sure.enabled && cfg.are_you_sure.required && aysAnswered(chat) < cfg.are_you_sure.turns) return "Bạn cần hoàn thành chặng “Bạn chắc chứ?” trước khi nộp.";
  return null;
}

/** Why a stage cannot be used right now, or null (used by the server before it accepts any Lab / Are-you-sure request). */
export function stageBlocker(a: any, chat: any, id: "perspective_lab" | "are_you_sure"): string | null {
  const cfg = stageConfig(a);
  if (!cfg[id].enabled) return "Bài tập này không có chặng này.";
  const st = computeStages(a, chat).find((s) => s.id === id);
  if (!st || st.status === "locked") return id === "perspective_lab" ? `Chặng này mở sau ${MIN_COTHINK_TURNS} lượt Cùng nghĩ.` : cfg.perspective_lab.enabled && cfg.perspective_lab.required && labCompleted(chat) < 1 ? "Hãy hoàn thành chặng “Góc nhìn khác” trước." : `Chặng này mở sau ${MIN_COTHINK_TURNS} lượt Cùng nghĩ.`;
  return null;
}
