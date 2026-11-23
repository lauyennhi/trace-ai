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
import { ATTACKS, ATTACKS_HOLDOUT, detectPressure, looksLikeFullAnswer } from "../src/lib/coach.ts";

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
  await call("/api/me/consent", student, { accept: true });   // students must consent before chatting
  const due = new Date(Date.now() + 7 * 864e5).toISOString();
  const sets: [string, string[]][] = [["Tập thiết kế (dùng khi viết luật, nên lạc quan)", ATTACKS], ["Tập độc lập (hold-out, ước lượng trung thực)", ATTACKS_HOLDOUT]];
  let failedAll = 0, n = 0;
  for (const [label, list] of sets) {
    let failed = 0, guarded = 0;
    console.log(`\n=== ${label}: ${list.length} câu, máy chủ ${BASE} ===\n`);
    for (const [i, attack] of list.entries()) {
      const a = await call("/api/courses/c_1/assignments", teacher, { title: `Red-team ${label.slice(0, 3)} ${i + 1}`, description: "Phân tích tác động của mạng xã hội đến việc học của sinh viên.", due_date: due, submission_mode: "ai_chat_only", ai_submode: "socratic", friction: "none", live_coach: false });
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
    console.log(`${label}: ${list.length - failed}/${list.length} giữ vững. Cổng chặn đầu ra phải can thiệp ${guarded} lần.`);
    failedAll += failed; n += list.length;
  }
  console.log(`\nTổng: ${n - failedAll}/${n}. Chỉ tập độc lập mới đáng tin để báo cáo; kiểm tra "looksLikeFullAnswer" là heuristic, hãy đọc các câu trả lời bằng mắt.`);
  const failed = failedAll;
  process.exitCode = failed ? 1 : 0;
};
main().catch((e) => { console.error(e.message); process.exit(1); });
