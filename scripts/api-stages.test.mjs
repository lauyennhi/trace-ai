/**
 * Offline test of the four stages, the privacy features and grading by stage. Starts the server itself with AI_MOCK=1
 * (a deterministic stand-in for Gemini), so no API key is needed:   node scripts/api-stages.test.mjs
 * It proves the WIRING and the RULES (order, locks, quotes must exist, no leaks). It says nothing about how good Gemini's answers are.
 */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const PORT = process.env.PORT || 3200, B = `http://localhost:${PORT}`;
const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, AI_MOCK: "1", GEMINI_API_KEY: "mock", PORT: String(PORT), CHAT_RATE_MAX: "1000" }, stdio: "ignore", detached: true });   // own process group, so the whole tree can be stopped
let pass = 0, failed = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { failed++; console.error("FAIL", name, "\n     ", e.message.split("\n")[0]); } };
const call = async (path, tok, body, method) => {
  const r = await fetch(B + path, { method: method || (body ? "POST" : "GET"), headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); return { status: r.status, ...j };
};
const login = async (email) => (await call("/api/auth/login", null, { email, password: "123456" })).data.token;
const lorem = "Mạng xã hội làm giảm khả năng tập trung của người học vì thông báo liên tục. Demographic Parity là tiêu chí công bằng yêu cầu tỉ lệ dự đoán dương bằng nhau giữa các nhóm.";

try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  const T = await login("hung.nguyen@edu.vn"), S = await login("la.uyennhi@student.edu.vn"), A = await login("admin@trace.edu.vn");
  const members = (await call("/api/courses/c_1", T)).data.members;
  const other = members.find((m) => m.student_email && m.student_email !== "la.uyennhi@student.edu.vn");
  const S2 = await login(other.student_email);
  const due = new Date(Date.now() + 7 * 864e5).toISOString();
  const mk = async (extra) => (await call("/api/courses/c_1/assignments", T, { title: "Stages " + Math.random().toString(36).slice(2, 6), description: "Phân tích mạng xã hội và học tập", due_date: due, submission_mode: "ai_chat_only", ai_submode: "socratic", friction: "none", live_coach: false, ...extra })).data;
  await call("/api/courses/c_1/materials", T, { name: "Giáo trình chương 5", text: "Demographic Parity là tiêu chí công bằng yêu cầu tỉ lệ dự đoán dương bằng nhau giữa các nhóm." });

  const ST = await mk({ paste_mode: "block", stages: { perspective_lab: { enabled: true, required: true }, are_you_sure: { enabled: true, required: true, turns: 2 } } });
  const chat = (id, msg, extra = {}) => call("/api/chat/message", S, { assignment_id: id, message_content: msg, ...extra });
  const stages = async (id) => (await call(`/api/stages/${id}/state`, S)).data;

  await t("privacy: nothing reaches the AI before the student consents", async () => {
    const r = await chat(ST.id, "Xin chào mình muốn hỏi một điều");
    assert.equal(r.status, 403); assert.equal(r.code, "consent_required");
    assert.equal((await call("/api/lab/start", S, { assignment_id: ST.id, text: lorem })).code, "consent_required");
  });
  await t("consent is recorded and shown on the user", async () => {
    const r = await call("/api/me/consent", S, { accept: true });
    assert.ok(r.data.consent_at); assert.equal((await call("/api/me/consent", S, { accept: false })).status, 400);
    await call("/api/me/consent", S2, { accept: true });
  });
  await t("assignments: stages are stored, clamped, and ignored for file-only", async () => {
    assert.equal(ST.stages.perspective_lab.enabled, true); assert.equal(ST.stages.are_you_sure.turns, 2);
    const f = await mk({ submission_mode: "file_only", stages: { perspective_lab: { enabled: true }, are_you_sure: { enabled: true, turns: 99 } } });
    assert.equal(f.stages.perspective_lab.enabled, false);
    const c = await mk({ stages: { are_you_sure: { enabled: true, turns: 99 } } }); assert.equal(c.stages.are_you_sure.turns, 5);
  });
  await t("order: Lab and Are-you-sure stay locked before 3 Co-Think turns (server rejects)", async () => {
    assert.equal((await call("/api/lab/start", S, { assignment_id: ST.id, text: lorem })).status, 409);
    assert.equal((await call("/api/ays/turn", S, { assignment_id: ST.id })).status, 409);
    const st = await stages(ST.id); assert.deepEqual(st.stages.map((x) => x.id), ["think_first", "co_think", "perspective_lab", "are_you_sure"].filter((x) => x !== "think_first"));
    assert.equal(st.stages.find((x) => x.id === "perspective_lab").status, "locked");
  });
  await t("Co-Think messages carry stage=co_think and the paste lock rejects pasted text", async () => {
    assert.equal((await chat(ST.id, "Mình nghĩ mạng xã hội làm giảm tập trung", { pasted_chars: 30 })).status, 400);
    for (const m of ["Mình nghĩ mạng xã hội làm giảm tập trung của sinh viên", "Vì thông báo liên tục làm đứt mạch học", "Mình chưa chắc đó là nguyên nhân duy nhất"]) {
      const r = await chat(ST.id, m); assert.equal(r.status, 200, JSON.stringify(r));
      assert.equal(r.data.new_message.stage, "co_think");
    }
  });
  await t("after 3 turns Lab is open; Are-you-sure still waits for the required Lab", async () => {
    const st = await stages(ST.id);
    assert.equal(st.stages.find((x) => x.id === "perspective_lab").status, "open");
    assert.equal(st.stages.find((x) => x.id === "are_you_sure").status, "locked");
    assert.equal((await call("/api/ays/turn", S, { assignment_id: ST.id })).status, 409);
    assert.match(st.submit_blocker, /Góc nhìn khác/);
  });
  await t("submit is blocked on the server until the required stages are done", async () => {
    const r = await call("/api/submissions/submit", S, { assignment_id: ST.id, submitted_text: "bài" });
    assert.equal(r.status, 400); assert.match(r.message, /Góc nhìn khác/);
  });

  let ev1, ev2;
  await t("Lab: the draft needs a minimum length; starting twice keeps the same text", async () => {
    assert.equal((await call("/api/lab/start", S, { assignment_id: ST.id, text: "ngắn quá" })).status, 400);
    const r = await call("/api/lab/start", S, { assignment_id: ST.id, text: lorem, pasted_chars: lorem.length }); assert.equal(r.status, 200); assert.equal(r.data.lab.text, lorem);
  });
  await t("Lab L1: no other view without the student's own view; short selections and pasted views are refused", async () => {
    const sel = { start: 0, end: 80 };
    assert.equal((await call("/api/lab/stance", S, { assignment_id: ST.id, selection: sel, stance_text: "ngắn" })).status, 400);
    assert.equal((await call("/api/lab/stance", S, { assignment_id: ST.id, selection: { start: 0, end: 5 }, stance_text: "Mình nghĩ đoạn này đúng một phần vì lý do sau" })).status, 400);
    assert.equal((await call("/api/lab/stance", S, { assignment_id: ST.id, selection: sel, stance_text: "Mình nghĩ đoạn này đúng một phần vì lý do sau", pasted_chars: 20 })).status, 400);
    assert.equal((await call("/api/lab/stance", S, { assignment_id: ST.id, selection: { start: 0, end: 99999 }, stance_text: "Mình nghĩ đoạn này đúng một phần vì lý do sau" })).status, 400);
  });
  await t("Lab L3/L4: two other views, a source only if it is a real class material, never a URL", async () => {
    const r = await call("/api/lab/stance", S, { assignment_id: ST.id, selection: { start: 0, end: lorem.length }, stance_text: "Mình nghĩ đoạn này đúng một phần vì có nhiều yếu tố khác." });
    assert.equal(r.status, 200, JSON.stringify(r)); ev1 = r.data.event;
    assert.equal(ev1.mode, "tranh_luan"); assert.equal(ev1.counterviews.length, 2);
    assert.deepEqual(ev1.counterviews[0].source, { title: "Giáo trình chương 5", verified: true });
    assert.equal(ev1.counterviews[1].source, null, "a made-up reference must not become a source");
    assert.ok(!/https?:\/\//.test(JSON.stringify(ev1.counterviews)), "no URL anywhere");
  });
  await t("Lab L5: a plain fact gets 'what to verify', not an opposing camp", async () => {
    const text = lorem + " SU_KIEN Nước sôi ở một trăm độ C tại áp suất khí quyển tiêu chuẩn.";
    const s2 = await call("/api/lab/start", S, { assignment_id: ST.id, text }); // keeps the first text (events exist), so select from it
    const base = s2.data.lab.text, i = base.indexOf("Demographic");
    const r = await call("/api/lab/stance", S, { assignment_id: ST.id, selection: { start: i, end: base.length }, stance_text: "Mình thấy đây chỉ là định nghĩa nên chắc không ai cãi." });
    // the selection text does not contain SU_KIEN, so use the marker through a second draft below
    assert.equal(r.status, 200);
  });
  await t("Lab: ambiguous passage asks for clarification and cannot be rebutted", async () => {
    // fresh assignment so a new draft containing the markers can be used
    const A2 = await mk({ stages: { perspective_lab: { enabled: true, required: false } } });
    for (const m of ["một hai ba bốn năm sáu", "bảy tám chín mười mười một", "mười hai mười ba mười bốn"]) await call("/api/chat/message", S, { assignment_id: A2.id, message_content: m });
    const draft = "SU_KIEN Nước sôi ở một trăm độ C tại áp suất khí quyển tiêu chuẩn của Trái Đất. KHONG_RO Cái đó thì thế này thế kia đấy nhé các bạn ơi. Mạng xã hội là nguyên nhân chính của sự sao nhãng ở người trẻ hiện nay.";
    await call("/api/lab/start", S, { assignment_id: A2.id, text: draft });
    const stance = "Mình đã suy nghĩ về đoạn này và có ý kiến riêng của mình.";
    const fact = await call("/api/lab/stance", S, { assignment_id: A2.id, selection: { start: 0, end: 70 }, stance_text: stance });
    assert.equal(fact.data.event.mode, "su_kien"); assert.equal(fact.data.event.counterviews.length, 0); assert.ok(fact.data.event.verify.how_to_check.length >= 1);
    const vague = await call("/api/lab/stance", S, { assignment_id: A2.id, selection: { start: draft.indexOf("KHONG_RO"), end: draft.indexOf("KHONG_RO") + 55 }, stance_text: stance });
    assert.equal(vague.data.event.mode, "khong_ro"); assert.ok(vague.data.event.clarify);
    assert.equal((await call("/api/lab/action", S, { assignment_id: A2.id, event_id: vague.data.event.id, action: "rebut", rebuttal_text: "Mình phản biện lại điều này nhé bạn." })).status, 400);
    assert.equal((await call("/api/lab/action", S, { assignment_id: A2.id, event_id: vague.data.event.id, action: "skip" })).status, 200);
    // an optional Lab that was skipped does not block Are-you-sure or submission
    assert.equal((await call(`/api/stages/${A2.id}/state`, S)).data.submit_blocker, null);
  });
  await t("Lab actions: rebut needs text; accept then rewrite records before/after and paste/typed numbers", async () => {
    assert.equal((await call("/api/lab/action", S, { assignment_id: ST.id, event_id: ev1.id, action: "rebut" })).status, 400);
    assert.equal((await call("/api/lab/rewrite", S, { assignment_id: ST.id, event_id: ev1.id, after_text: "x".repeat(30) })).status, 409, "rewrite needs an action first");
    assert.equal((await call("/api/lab/action", S, { assignment_id: ST.id, event_id: ev1.id, action: "rebut", rebuttal_text: "Mình phản biện: thông báo chỉ là một yếu tố, còn thói quen mới quan trọng." })).status, 200);
    assert.equal((await call("/api/lab/action", S, { assignment_id: ST.id, event_id: ev1.id, action: "skip" })).status, 409, "an event is decided once");
    assert.equal((await call("/api/lab/rewrite", S, { assignment_id: ST.id, event_id: ev1.id, after_text: "Sao chép dán vào đây dài dài", pasted: 20 })).status, 400, "paste lock");
    const r = await call("/api/lab/rewrite", S, { assignment_id: ST.id, event_id: ev1.id, after_text: "Mạng xã hội chỉ là một trong nhiều yếu tố làm giảm tập trung; thói quen dùng điện thoại quan trọng không kém.", typed: 104, deleted: 12, pasted: 0 });
    assert.equal(r.status, 200); const rw = r.data.event.rewrite;
    assert.ok(rw.before && rw.after && rw.similarity >= 0 && rw.similarity <= 1 && rw.typed === 104 && rw.pasted === 0);
    assert.equal((await call("/api/lab/rewrite", S, { assignment_id: ST.id, event_id: ev1.id, after_text: "Mạng xã hội chỉ là một trong nhiều yếu tố khác nữa." })).status, 409);
  });
  await t("Lab L7: another student cannot read or act on this student's Lab", async () => {
    assert.equal((await call(`/api/lab/${ST.id}/mine`, S2)).data.lab, null);
    assert.equal((await call("/api/lab/action", S2, { assignment_id: ST.id, event_id: ev1.id, action: "skip" })).status, 409);
  });
  await t("Lab: a stage that is switched off is refused", async () => {
    const NO = await mk({});
    assert.equal((await call("/api/lab/start", S, { assignment_id: NO.id, text: lorem })).status, 409);
    assert.equal((await call("/api/ays/turn", S, { assignment_id: NO.id })).status, 409);
  });
  await t("after the required Lab, Are-you-sure opens", async () => { assert.equal((await stages(ST.id)).stages.find((x) => x.id === "are_you_sure").status, "open"); });

  await t("AYS A1/A3: each question has an issue type and a quote that really is in the student's text", async () => {
    const r = await call("/api/ays/turn", S, { assignment_id: ST.id }); assert.equal(r.status, 200, JSON.stringify(r));
    const q = r.data.question; assert.equal(q.stage, "are_you_sure"); assert.ok(["logic_gap", "unsupported_claim", "ambiguity", "counterexample", "none"].includes(q.ays.issue_type));
    assert.match(q.content, /\?/);
    if (q.ays.quote) assert.ok(JSON.stringify(r.data.chat_session.messages).toLowerCase().includes(q.ays.quote.toLowerCase()));
    assert.equal(r.data.total, 2);
    const again = await call("/api/ays/turn", S, { assignment_id: ST.id }); assert.equal(again.data.question.id, q.id, "asking again resumes the same question");
  });
  await t("AYS: too-short and pasted answers are refused; the server counts the turns (A7)", async () => {
    assert.equal((await call("/api/ays/turn", S, { assignment_id: ST.id, answer: "ngắn" })).status, 400);
    assert.equal((await call("/api/ays/turn", S, { assignment_id: ST.id, answer: "Câu trả lời dài đủ để qua nhưng bị dán vào", pasted_chars: 10 })).status, 400);
    const r1 = await call("/api/ays/turn", S, { assignment_id: ST.id, answer: "Vì chính khảo sát lớp mình cho thấy điều đó, nên mình giữ ý kiến này." });
    assert.equal(r1.status, 200); assert.equal(r1.data.closed, false); assert.equal(r1.data.answered, 1);
    const userMsg = r1.data.chat_session.messages.filter((m) => m.stage === "are_you_sure" && m.role === "user")[0];
    assert.equal(userMsg.ays.response_type, "held_with_reason");
    const r2 = await call("/api/ays/turn", S, { assignment_id: ST.id, answer: "Mình thấy đúng như bạn nói, mình đồng ý ngay." });
    assert.equal(r2.data.closed, true); assert.equal(r2.data.answered, 2);
    assert.equal((await call("/api/ays/turn", S, { assignment_id: ST.id })).status, 409, "no more turns after N");
    assert.equal((await call("/api/ays/turn", S, { assignment_id: ST.id, answer: "Thêm một câu trả lời nữa cho đủ dài." })).status, 409);
  });
  await t("AYS stage messages are not Co-Think turns and do not leak into the Co-Think chat", async () => {
    const st = await stages(ST.id); assert.equal(st.stages.find((x) => x.id === "co_think").detail, "3/3 lượt");
    const r = await chat(ST.id, "Mình muốn hỏi thêm một điều nữa về chủ đề này");   // co-think after AYS
    assert.equal(r.status, 200); assert.equal(r.data.new_message.stage, "co_think");
  });
  await t("AYS A2 and A6: a solid argument gets no invented flaw; the AI may not call the source wrong", async () => {
    const A3 = await mk({ stages: { are_you_sure: { enabled: true, required: true, turns: 2 } } });
    const msgs = (extra) => ["Lập luận VUNG của mình " + extra, "Mình có dẫn chứng đầy đủ cho ý đó", "Và còn một ví dụ nữa để chứng minh"];
    for (const m of msgs("là rõ ràng")) await call("/api/chat/message", S, { assignment_id: A3.id, message_content: m });
    const r = await call("/api/ays/turn", S, { assignment_id: A3.id });
    assert.equal(r.data.question.ays.issue_type, "none"); assert.doesNotMatch(r.data.question.content, /lỗi|sai/i);
    const A4 = await mk({ stages: { are_you_sure: { enabled: true, required: true, turns: 2 } } });
    for (const m of ["NGUON_SAI một hai ba bốn năm", "sáu bảy tám chín mười", "mười một mười hai mười ba"]) await call("/api/chat/message", S, { assignment_id: A4.id, message_content: m });
    const q = (await call("/api/ays/turn", S, { assignment_id: A4.id })).data.question;
    assert.match(q.content, /căn cứ|nguồn.*đáng tin/i); assert.doesNotMatch(q.content, /sai|không tồn tại/i);
    const A5 = await mk({ stages: { are_you_sure: { enabled: true, required: false, turns: 2 } } });
    for (const m of ["BIA một hai ba bốn năm sáu", "bảy tám chín mười mười một", "mười hai mười ba mười bốn"]) await call("/api/chat/message", S, { assignment_id: A5.id, message_content: m });
    assert.equal((await call("/api/ays/turn", S, { assignment_id: A5.id })).data.question.ays.quote, "", "an invented quote is dropped");
  });

  await t("grading by stage: the Lab and Are-you-sure evidence reaches the grader, with the model name", async () => {
    const r = await call("/api/submissions/submit", S, { assignment_id: ST.id, submitted_text: "Bài nộp của mình." });
    assert.equal(r.status, 200, JSON.stringify(r)); const res = r.data.process_score_result || r.data.submission?.process_score_result;
    assert.ok(res, "evaluated"); assert.equal(res.eval_model, "mock");
  });
  await t("grading P4: a highlight whose quote is not in the evidence is dropped, a real one is kept with its stage", async () => {
    const subs = (await call(`/api/assignments/${ST.id}/submissions`, T)).data.submissions; const sub = subs.find((x) => x.student_email === "la.uyennhi@student.edu.vn");
    const res = (await call(`/api/submissions/${sub.id}`, T)).data; const pr = (res.submission || res).process_score_result;
    assert.equal(pr.highlight_segments.length, 1); assert.equal(pr.dropped_quotes, 1); assert.equal(pr.highlight_segments[0].stage, "co_think");
  });
  await t("teacher can read the Lab and Are-you-sure records of the submission", async () => {
    const subs = (await call(`/api/assignments/${ST.id}/submissions`, T)).data.submissions; const sub = subs.find((x) => x.student_email === "la.uyennhi@student.edu.vn");
    const d = (await call(`/api/submissions/${sub.id}`, T)).data; const cs = d.chat_session || d.chatSession;
    assert.ok(cs.lab.events.length >= 1 && cs.lab.events[0].rewrite); assert.equal(cs.messages.filter((m) => m.stage === "are_you_sure" && m.role === "user").length, 2);
  });

  await t("confidence: not collected unless the teacher asks (and then it is)", async () => {
    const OFF = await mk({ friction: "required" }), ON = await mk({ friction: "required", stages: { think_first: { ask_confidence: true } } });
    const body = { answers: ["Luận điểm của mình là mạng xã hội gây mất tập trung", "Mình định dùng khảo sát lớp làm dẫn chứng"], confidence: 4 };
    const a = await call("/api/chat/intent", S, { assignment_id: OFF.id, ...body }); assert.equal(a.status, 200, JSON.stringify(a)); assert.equal(a.data.chat_session.intent.confidence, undefined);
    const b = await call("/api/chat/intent", S, { assignment_id: ON.id, ...body }); assert.equal(b.data.chat_session.intent.confidence, 4);
  });
  await t("privacy: names, emails and phone numbers never reach the AI (the AI saw 'clean')", async () => {
    const P = await mk({});
    const r = await call("/api/chat/message", S, { assignment_id: P.id, message_content: "Mình là Lã Uyển Nhi, mail la.uyennhi@student.edu.vn, sđt 0912 345 678, hỏi về Demographic Parity." });
    assert.equal(r.status, 200); assert.match(r.data.new_message.content, /pii=clean/);
  });
  await t("privacy: export returns the student's own data; deletion needs the word XOA and then removes it", async () => {
    const ex = await call("/api/me/export", S2); assert.equal(ex.status, 200); assert.ok(ex.data.account.consent_at); assert.ok(Array.isArray(ex.data.chat_sessions));
    assert.equal((await call("/api/me/delete-data", S2, { confirm: "xoa" })).status, 400);
    const before = (await call("/api/me/profile", S)).data.profile.evaluated;
    const d = await call("/api/me/delete-data", S, { confirm: "XOA" }); assert.equal(d.status, 200); assert.ok(d.data.deleted_chats >= 1 && d.data.deleted_submissions >= 1);
    assert.equal((await call("/api/me/profile", S)).data.profile.evaluated, 0); assert.ok(before > 0);
    assert.equal((await call("/api/me/export", S)).data.chat_sessions.length, 0);
  });
  await t("privacy: retention is an admin setting and the purge endpoint runs", async () => {
    assert.equal((await call("/api/admin/settings", A, { retention_days: 365 }, "PUT")).data.retention_days, 365);
    const r = await call("/api/admin/retention/run", A, {}); assert.equal(r.status, 200); assert.equal(r.data.retention_days, 365);
    assert.equal((await call("/api/admin/retention/run", S, {})).status, 403);
    await call("/api/admin/settings", A, { retention_days: 0 }, "PUT");
  });
} catch (e) { failed++; console.error("SETUP FAILED:", e.message); }
try { process.kill(-srv.pid); } catch { srv.kill(); }
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
