/**
 * Offline test of the assignment flow (Think First -> Co-Think -> Are you sure?), the separate Perspective Lab mode, privacy and grading. Starts the server itself with AI_MOCK=1
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

  const ST = await mk({ paste_mode: "block", stages: { are_you_sure: { enabled: true, required: true, turns: 3 } } });
  const chat = (id, msg, extra = {}) => call("/api/chat/message", S, { assignment_id: id, message_content: msg, ...extra });
  const stages = async (id) => (await call(`/api/stages/${id}/state`, S)).data;
  const sampleText = (await call("/api/lab/samples", S)).data;

  await t("privacy: nothing reaches the AI or the Lab before the student consents", async () => {
    const r = await chat(ST.id, "Xin chào mình muốn hỏi một điều");
    assert.equal(r.status, 403); assert.equal(r.code, "consent_required");
    assert.equal((await call("/api/lab/sessions", S, { course_id: "c_1", kind: "sample", sample_id: "mxh" })).code, "consent_required");
  });
  await t("consent is recorded and shown on the user", async () => {
    const r = await call("/api/me/consent", S, { accept: true });
    assert.ok(r.data.consent_at); assert.equal((await call("/api/me/consent", S, { accept: false })).status, 400);
    await call("/api/me/consent", S2, { accept: true });
  });
  await t("assignments: only Are-you-sure is a stage; clamped; ignored for file-only; Viết L2 can no longer be created", async () => {
    assert.deepEqual(Object.keys(ST.stages), ["are_you_sure"]); assert.equal(ST.stages.are_you_sure.turns, 3);
    const f = await mk({ submission_mode: "file_only", stages: { are_you_sure: { enabled: true, turns: 99 } } });
    assert.equal(f.stages.are_you_sure.enabled, false);
    const c = await mk({ stages: { are_you_sure: { enabled: true, turns: 99 } } }); assert.equal(c.stages.are_you_sure.turns, 5);
    const l2 = await call("/api/courses/c_1/assignments", T, { title: "L2 cũ", description: "x", due_date: due, submission_mode: "writing_l2" }); assert.equal(l2.status, 400);
  });
  await t("order: Are-you-sure stays locked before 3 Co-Think turns (server rejects)", async () => {
    assert.equal((await call("/api/ays/turn", S, { assignment_id: ST.id })).status, 409);
    const st = await stages(ST.id); assert.deepEqual(st.stages.map((x) => x.id), ["co_think", "are_you_sure"]);
    assert.equal(st.stages.find((x) => x.id === "are_you_sure").status, "locked");
  });
  await t("Co-Think messages carry stage=co_think and the paste lock rejects pasted text", async () => {
    assert.equal((await chat(ST.id, "Mình nghĩ mạng xã hội làm giảm tập trung", { pasted_chars: 30 })).status, 400);
    for (const m of ["Mình nghĩ mạng xã hội làm giảm tập trung của sinh viên", "Vì thông báo liên tục làm đứt mạch học", "Mình chưa chắc đó là nguyên nhân duy nhất"]) {
      const r = await chat(ST.id, m); assert.equal(r.status, 200, JSON.stringify(r));
      assert.equal(r.data.new_message.stage, "co_think");
    }
  });
  await t("after 3 turns Are-you-sure opens, and submit is blocked on the server until it is done", async () => {
    const st = await stages(ST.id);
    assert.equal(st.stages.find((x) => x.id === "are_you_sure").status, "open");
    assert.match(st.submit_blocker, /Bạn chắc chứ/);
    const r = await call("/api/submissions/submit", S, { assignment_id: ST.id, submitted_text: "bài" });
    assert.equal(r.status, 400); assert.match(r.message, /Bạn chắc chứ/);
  });
  await t("the stage-state endpoint is for students only", async () => { assert.equal((await call(`/api/stages/${ST.id}/state`, T)).status, 403); });


  /* ------------------------------------------------------------ Perspective Lab: separate mode */
  let lab, ev1;
  await t("Lab: samples exist, a text needs a minimum length, the source kinds work", async () => {
    assert.ok(sampleText.length >= 3);
    assert.equal((await call("/api/lab/sessions", S, { course_id: "c_1", kind: "own", text: "ngắn quá" })).status, 400);
    assert.equal((await call("/api/lab/sessions", S, { course_id: "c_1", kind: "ai", topic: "ab" })).status, 400);
    assert.equal((await call("/api/lab/sessions", S, { course_id: "c_1", kind: "nope" })).status, 400);
    const ai = await call("/api/lab/sessions", S, { course_id: "c_1", kind: "ai", topic: "Có nên cho học sinh tự chọn môn học?" }); assert.equal(ai.status, 200, JSON.stringify(ai)); assert.ok(ai.data.text.length >= 80);
    const own = await call("/api/lab/sessions", S, { course_id: "c_1", kind: "own", text: lorem, pasted_chars: lorem.length, title: "Nháp" }); assert.equal(own.status, 200); assert.equal(own.data.pasted_chars, lorem.length);
    const smp = await call("/api/lab/sessions", S, { course_id: "c_1", kind: "sample", sample_id: "mxh" }); assert.equal(smp.status, 200); lab = smp.data;
    assert.equal(lab.title, sampleText[0].title); assert.deepEqual(lab.events, []);
  });
  await t("Lab: a student outside the course cannot create a session there", async () => {
    const lonely = (await call("/api/courses/join", S, { invite_code: "ZZZZZZ" })).status; assert.ok(lonely >= 400);
    assert.equal((await call("/api/lab/sessions", S, { course_id: "c_does_not_exist", kind: "sample", sample_id: "mxh" })).status, 403);
  });
  await t("Lab: selection rules (too short, out of range) and the lens returns 1-2 views aimed at the passage", async () => {
    assert.equal((await call(`/api/lab/sessions/${lab.id}/lens`, S, { start: 0, end: 5 })).status, 400);
    assert.equal((await call(`/api/lab/sessions/${lab.id}/lens`, S, { start: 0, end: 99999 })).status, 400);
    const r = await call(`/api/lab/sessions/${lab.id}/lens`, S, { start: 0, end: 120 }); assert.equal(r.status, 200, JSON.stringify(r));
    ev1 = r.data.event; assert.equal(ev1.mode, "tranh_luan"); assert.ok(ev1.counterviews.length >= 1 && ev1.counterviews.length <= 2);
    assert.ok(ev1.counterviews.every((v) => ["phan_bien", "he_qua_dai_han", "gia_dinh_ngam"].includes(v.kind)));
    assert.equal(ev1.selection.text, lab.text.slice(0, 120), "the AI is shown and keeps exactly the highlighted text; it never rewrites");
    assert.ok(!/https?:\/\//.test(JSON.stringify(ev1.counterviews)), "no URL anywhere");
    assert.equal(ev1.counterviews.filter((v) => v.source).length <= 1, true, "a made-up reference never becomes a source");
  });
  await t("Lab friction: no second highlight until the first is defended or adjusted", async () => {
    const r = await call(`/api/lab/sessions/${lab.id}/lens`, S, { start: 200, end: 300 }); assert.equal(r.status, 409);
    assert.match(r.message, /đối chất/);
  });
  await t("Lab friction: only 'defend' or 'adjust'; text is required; pasted text is refused; an unchanged sentence is refused", async () => {
    const R = (b) => call(`/api/lab/sessions/${lab.id}/respond`, S, { event_id: ev1.id, ...b });
    assert.equal((await R({ action: "skip" })).status, 400); assert.equal((await R({ action: "accept" })).status, 400);
    assert.equal((await R({ action: "defend", text: "ngắn" })).status, 400);
    assert.equal((await R({ action: "defend", text: "Mình bảo vệ luận điểm này vì lý do dài đủ.", pasted: 12 })).status, 400, "paste is refused");
    assert.equal((await R({ action: "adjust", after_text: ev1.selection.text })).status, 400, "no change");
    assert.equal((await call(`/api/lab/sessions/${lab.id}/respond`, S, { event_id: "ev_none", action: "defend", text: "x".repeat(30) })).status, 404);
  });
  await t("Lab friction: adjust records before/after, similarity and typed/deleted; it can only be done once", async () => {
    const after = "Mạng xã hội có thể làm giảm tập trung ở một số người, nhưng tác động còn phụ thuộc cách dùng và mục đích học.";
    const r = await call(`/api/lab/sessions/${lab.id}/respond`, S, { event_id: ev1.id, action: "adjust", after_text: after, typed: 104, deleted: 12 });
    assert.equal(r.status, 200, JSON.stringify(r)); const rw = r.data.event.rewrite;
    assert.equal(rw.before, ev1.selection.text); assert.equal(rw.after, after); assert.ok(rw.similarity >= 0 && rw.similarity < 0.97); assert.equal(rw.typed, 104);
    assert.equal(r.data.event.action, "adjust");
    assert.equal((await call(`/api/lab/sessions/${lab.id}/respond`, S, { event_id: ev1.id, action: "defend", text: "Mình muốn đổi ý sang bảo vệ luận điểm." })).status, 409);
  });
  await t("Lab: a highlight overlapping a finished one is refused; a new one works; defend is recorded", async () => {
    assert.equal((await call(`/api/lab/sessions/${lab.id}/lens`, S, { start: 50, end: 160 })).status, 409);
    const r = await call(`/api/lab/sessions/${lab.id}/lens`, S, { start: 140, end: 260 }); assert.equal(r.status, 200, JSON.stringify(r));
    const d = await call(`/api/lab/sessions/${lab.id}/respond`, S, { event_id: r.data.event.id, action: "defend", text: "Mình vẫn giữ ý này vì khảo sát lớp mình cho thấy điều đó.", typed: 55 });
    assert.equal(d.status, 200); assert.equal(d.data.event.defense.text.startsWith("Mình vẫn giữ"), true);
    const mine = (await call("/api/lab/sessions?course_id=c_1", S)).data.find((x) => x.id === lab.id); assert.equal(mine.events.length, 2);
  });
  await t("Lab: a plain fact gets 'what to verify'; a vague passage asks for clarification and stores nothing", async () => {
    const draft = "SU_KIEN Nước sôi ở một trăm độ C tại áp suất khí quyển tiêu chuẩn của Trái Đất. KHONG_RO Cái đó thì thế này thế kia đấy nhé các bạn ơi. Mạng xã hội là nguyên nhân chính của sự sao nhãng ở người trẻ hiện nay.";
    const s2 = (await call("/api/lab/sessions", S, { course_id: "c_1", kind: "own", text: draft })).data;
    const fact = await call(`/api/lab/sessions/${s2.id}/lens`, S, { start: 0, end: 80 });
    assert.equal(fact.data.event.mode, "su_kien"); assert.equal(fact.data.event.counterviews.length, 0); assert.ok(fact.data.event.verify.how_to_check.length >= 1);
    assert.equal((await call(`/api/lab/sessions/${s2.id}/respond`, S, { event_id: fact.data.event.id, action: "defend", text: "Mình có nguồn kiểm chứng từ sách giáo khoa vật lý." })).status, 200);
    const i = draft.indexOf("KHONG_RO"), vague = await call(`/api/lab/sessions/${s2.id}/lens`, S, { start: i, end: i + 55 });
    assert.equal(vague.status, 200); assert.equal(vague.data.event, null); assert.ok(vague.data.clarify);
    assert.equal((await call(`/api/lab/sessions/${s2.id}`, S)).data.events.length, 1, "nothing is stored for a vague passage");
  });
  await t("Lab: privacy and access — another student cannot read or act; the teacher of the course can read; delete works", async () => {
    assert.equal((await call(`/api/lab/sessions/${lab.id}`, S2)).status, 403);
    assert.equal((await call(`/api/lab/sessions/${lab.id}/lens`, S2, { start: 0, end: 60 })).status, 404);
    assert.equal((await call("/api/lab/sessions?course_id=c_1", S2)).data.some((x) => x.id === lab.id), false);
    assert.equal((await call(`/api/lab/sessions/${lab.id}`, T)).status, 200);
    const list = await call("/api/courses/c_1/lab", T); assert.equal(list.status, 200); assert.ok(list.data.some((x) => x.id === lab.id && x.student_name));
    assert.equal((await call("/api/courses/c_1/lab", S)).status, 403);
    const tmp = (await call("/api/lab/sessions", S, { course_id: "c_1", kind: "sample", sample_id: "ai" })).data;
    assert.equal((await call(`/api/lab/sessions/${tmp.id}`, S, null, "DELETE")).status, 200);
    assert.equal((await call(`/api/lab/sessions/${tmp.id}`, S)).status, 404);
  });
  await t("Lab is not part of an assignment any more: the old endpoints are gone", async () => {
    assert.equal((await call("/api/lab/start", S, { assignment_id: ST.id, text: lorem })).status, 404);
  });

  await t("AYS A1/A3: each question has an issue type and a quote that really is in the student's text", async () => {
    const r = await call("/api/ays/turn", S, { assignment_id: ST.id }); assert.equal(r.status, 200, JSON.stringify(r));
    const q = r.data.question; assert.equal(q.stage, "are_you_sure"); assert.ok(["logic_gap", "unsupported_claim", "ambiguity", "counterexample", "none"].includes(q.ays.issue_type));
    assert.match(q.content, /\?/);
    if (q.ays.quote) assert.ok(JSON.stringify(r.data.chat_session.messages).toLowerCase().includes(q.ays.quote.toLowerCase()));
    assert.equal(r.data.total, 3);
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
    assert.equal(r2.data.closed, false); assert.equal(r2.data.answered, 2);
    const r3 = await call("/api/ays/turn", S, { assignment_id: ST.id, answer: "Còn nữa, mình có thêm một ví dụ cụ thể từ lớp học." });
    assert.equal(r3.data.closed, true); assert.equal(r3.data.answered, 3);
    assert.equal((await call("/api/ays/turn", S, { assignment_id: ST.id })).status, 409, "no more turns after N (3)");
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

  await t("grading: the Are-you-sure evidence reaches the grader, with the model name", async () => {
    const r = await call("/api/submissions/submit", S, { assignment_id: ST.id, submitted_text: "Bài nộp của mình." });
    assert.equal(r.status, 200, JSON.stringify(r)); const res = r.data.process_score_result || r.data.submission?.process_score_result;
    assert.ok(res, "evaluated"); assert.equal(res.eval_model, "mock");
  });
  await t("grading P4: a highlight whose quote is not in the evidence is dropped, a real one is kept with its stage", async () => {
    const subs = (await call(`/api/assignments/${ST.id}/submissions`, T)).data.submissions; const sub = subs.find((x) => x.student_email === "la.uyennhi@student.edu.vn");
    const res = (await call(`/api/submissions/${sub.id}`, T)).data; const pr = (res.submission || res).process_score_result;
    assert.equal(pr.highlight_segments.length, 1); assert.equal(pr.dropped_quotes, 1); assert.equal(pr.highlight_segments[0].stage, "co_think");
  });
  await t("teacher can read the Are-you-sure record of the submission", async () => {
    const subs = (await call(`/api/assignments/${ST.id}/submissions`, T)).data.submissions; const sub = subs.find((x) => x.student_email === "la.uyennhi@student.edu.vn");
    const d = (await call(`/api/submissions/${sub.id}`, T)).data; const cs = d.chat_session || d.chatSession;
    assert.equal(cs.messages.filter((m) => m.stage === "are_you_sure" && m.role === "user").length, 3);
  });
  await t("confidence is gone: the server never stores it", async () => {
    const OFF = await mk({ friction: "required" });
    const body = { answers: ["Luận điểm của mình là mạng xã hội gây mất tập trung", "Mình định dùng khảo sát lớp làm dẫn chứng"], confidence: 4 };
    const a = await call("/api/chat/intent", S, { assignment_id: OFF.id, ...body }); assert.equal(a.status, 200, JSON.stringify(a)); assert.equal(a.data.chat_session.intent.confidence, undefined);
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
    assert.equal((await call("/api/me/export", S)).data.lab_sessions.length, 0, "Lab sessions are deleted with the rest"); assert.ok(d.data.deleted_labs >= 1);
    assert.equal((await call("/api/courses/c_1/lab", T)).data.some((x) => x.student_name === "Lã Uyển Nhi"), false, "and they disappear from the teacher view");
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
