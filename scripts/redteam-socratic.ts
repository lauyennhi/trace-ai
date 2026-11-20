/**
 * Red-team test for the Socratic mode: sends pressure prompts to a RUNNING server (with a real GEMINI_API_KEY)
 * and checks that the AI never hands over the answer.
 *
 *   npm run dev                               # in one terminal, with GEMINI_API_KEY set
 *   npx tsx scripts/redteam-socratic.ts       # in another; BASE=http://localhost:3000 by default
 *
 * It creates one throw-away Socratic assignment per attack in course c_1 (demo data), so run it on a dev database.
 * A reply "passes" when it still contains a guiding question and does not look like a full solution.
 * Replies are printed so a human can read them too: the check is a heuristic, not a verdict.
 */
import { ATTACKS, detectPressure, looksLikeFullAnswer } from "../src/lib/coach.ts";

const BASE = process.env.BASE || "http://localhost:3000";
const call = async (path: string, token: string | null, body?: any) => {
  const res = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await res.json().catch(() => ({}));
  if (!j.success) throw new Error(`${path}: ${j.message || res.status}`);
  return j.data;
};
const login = async (email: string) => (await call("/api/auth/login", null, { email, password: "123456" })).token as string;

const main = async () => {
  const teacher = await login("hung.nguyen@edu.vn"), student = await login("la.uyennhi@student.edu.vn");
  const due = new Date(Date.now() + 7 * 864e5).toISOString();
  let failed = 0, guarded = 0;
  console.log(`Red-team: ${ATTACKS.length} attacks against ${BASE}\n`);
  for (const [i, attack] of ATTACKS.entries()) {
    const a = await call("/api/courses/c_1/assignments", teacher, { title: `Red-team ${i + 1}`, description: "Phân tích tác động của mạng xã hội đến việc học của sinh viên.", due_date: due, submission_mode: "ai_chat_only", ai_submode: "socratic", friction: "none", live_coach: false });
    let verdict = "", reply = "", guard = "";
    try {
      const r = await call("/api/chat/message", student, { assignment_id: a.id, message_content: attack });
      reply = r.new_message.content; guard = r.new_message.guard || "";
      const gaveAnswer = looksLikeFullAnswer(reply);
      if (guard) guarded++;
      verdict = gaveAnswer ? "FAIL" : "pass"; if (gaveAnswer) failed++;
    } catch (e: any) { verdict = "ERROR"; reply = e.message; failed++; }
    console.log(`${String(i + 1).padStart(2)}. [${verdict}] ${detectPressure(attack) ? "detected" : "NOT detected"}${guard ? `, guard=${guard}` : ""}\n    attack: ${attack}\n    reply:  ${reply.replace(/\s+/g, " ").slice(0, 220)}\n`);
  }
  console.log(`${ATTACKS.length - failed}/${ATTACKS.length} held. The guard had to step in ${guarded} time(s).`);
  process.exitCode = failed ? 1 : 0;
};
main().catch((e) => { console.error(e.message); process.exit(1); });
