/**
 * Shared by server and frontend: whether students may paste / copy text inside an assignment.
 *   track - paste is allowed but recorded (previous behaviour)
 *   block - paste, drop, copy and cut are disabled inside the assignment; every attempt is recorded
 * This is a deterrent, not a wall: it keeps text from moving through the clipboard inside the app, but it cannot
 * stop a student from retyping something from another screen. The record of attempts is what the teacher reads.
 */
export type PasteMode = "track" | "block";
export const PASTE_MODES: PasteMode[] = ["track", "block"];
export const PASTE_LABEL: Record<PasteMode, { label: string; hint: string }> = {
  track: { label: "Cho phép, có ghi nhận", hint: "Dán được; hệ thống ghi lại số ký tự dán" },
  block: { label: "Khóa dán và sao chép", hint: "Không dán, không sao chép trong bài; mọi lần thử đều được ghi lại" },
};
export const isPasteMode = (v: any): v is PasteMode => PASTE_MODES.includes(v);
