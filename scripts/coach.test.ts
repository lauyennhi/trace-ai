import assert from "node:assert/strict";
import { ATTACKS, ATTACKS_HOLDOUT, detectPressure, looksLikeFullAnswer, cleanCoach, pickPassages, agreement, buildProfile, memoryNote, spread, chunkText, quoteIn, safeChallenge, SAFE_SOURCE_QUESTION, scrub } from "../src/lib/coach.ts";
import { computeStages, submitBlocker, stageBlocker, cleanStages, stageConfig } from "../src/lib/stages.ts";

let pass = 0; const t = (name: string, fn: () => void) => { try { fn(); pass++; console.log("ok  ", name); } catch (e: any) { console.error("FAIL", name, "\n    ", e.message); process.exitCode = 1; } };

t("detects every attack prompt (or reports which are missed)", () => {
  const missed = ATTACKS.filter((a) => !detectPressure(a));
  console.log("      attacks:", ATTACKS.length, "missed by regex:", missed.length, missed.map((m) => `\n        - ${m}`).join(""));
  assert.ok(missed.length <= 3, "too many attacks slip past the detector");
});
t("does not flag ordinary study messages", () => {
  for (const ok of ["Em nghĩ luận điểm chính là mạng xã hội làm giảm tập trung vì thông báo liên tục.", "Bạn có thể giải thích thêm về Demographic Parity không?", "Nguồn của thông tin này là gì ạ?", "Em chưa hiểu bước thứ hai, cho em gợi ý được không?", "Theo em đáp án có thể là phương án B vì lý do sau."]) assert.equal(detectPressure(ok), null, ok);
});
t("looksLikeFullAnswer: no question = giving the answer", () => {
  assert.equal(looksLikeFullAnswer("Đây là bài luận hoàn chỉnh cho bạn: Mạng xã hội ảnh hưởng đến học tập ở nhiều khía cạnh, trước hết là sự tập trung."), true);
  assert.equal(looksLikeFullAnswer("Bạn nghĩ nguyên nhân chính là gì? Hãy thử nêu một ví dụ từ lớp của bạn."), false);
  assert.equal(looksLikeFullAnswer("Ừ."), false);
});
t("cleanCoach drops a quote the student never wrote", () => {
  const c = cleanCoach({ level: "weak", criterion: "kiem_chung_thong_tin", quote: "tôi đã kiểm tra nguồn", note: "Ý này chưa có dẫn chứng." }, "Mạng xã hội làm giảm tập trung.");
  assert.equal(c?.quote, ""); assert.equal(c?.criterion, "kiem_chung_thong_tin");
});
t("cleanCoach keeps a real quote (case and spacing tolerant)", () => {
  const c = cleanCoach({ level: "good", criterion: "tu_duy_phan_bien", quote: "mạng xã hội  làm giảm", note: "Có phản biện." }, "Mạng xã hội làm giảm tập trung.");
  assert.equal(c?.quote, "mạng xã hội  làm giảm");
});
t("cleanCoach rejects junk", () => { assert.equal(cleanCoach(null, "x"), null); assert.equal(cleanCoach({ level: "good", criterion: "nope", note: "x" }, "x"), null); });
t("pickPassages finds the relevant passage and ignores the rest", () => {
  const m = [{ id: "1", name: "Giáo trình", text: "Demographic Parity là tiêu chí công bằng yêu cầu tỉ lệ dự đoán dương bằng nhau giữa các nhóm.\n\nGradient descent cập nhật trọng số theo hướng ngược đạo hàm của hàm mất mát." }];
  const p = pickPassages(m, "Demographic Parity là gì?");
  assert.equal(p.length, 1); assert.match(p[0].text, /Demographic Parity/); assert.equal(p[0].name, "Giáo trình");
  assert.deepEqual(pickPassages(m, "bóng đá hôm nay"), []);
});
t("chunkText keeps long text in bounded pieces", () => { const c = chunkText("a ".repeat(3000)); assert.ok(c.length > 3 && c.every((x) => x.length <= 1300)); });
t("agreement: perfect, biased, and empty", () => {
  const perfect = agreement([{ ai: 80, teacher: 8 }, { ai: 60, teacher: 6 }, { ai: 90, teacher: 9 }]);
  assert.equal(perfect.mae, 0); assert.equal(perfect.within1, 1); assert.equal(perfect.pearson, 1);
  const generous = agreement([{ ai: 90, teacher: 7 }, { ai: 80, teacher: 6 }, { ai: 70, teacher: 5 }]);
  assert.ok(generous.bias! > 1.5, "AI more generous"); assert.equal(generous.within1, 0);
  assert.equal(agreement([]).n, 0);
});
t("buildProfile: weakest/strongest/trend/delta and memory note", () => {
  const p = buildProfile([
    { assignment_title: "A", at: "2026-01-01", process_score: 50, tieu_chi: { tu_duy_phan_bien: 60, dao_sau_van_de: 50, kiem_chung_thong_tin: 20, noi_hoa_kien_thuc: 55, tinh_chu_dong: 70 } },
    { assignment_title: "B", at: "2026-02-01", process_score: 70, tieu_chi: { tu_duy_phan_bien: 70, dao_sau_van_de: 60, kiem_chung_thong_tin: 30, noi_hoa_kien_thuc: 65, tinh_chu_dong: 80 } },
  ]);
  assert.equal(p.weakest, "kiem_chung_thong_tin"); assert.equal(p.strongest, "tinh_chu_dong"); assert.deepEqual(p.trend, [50, 70]); assert.equal(p.delta, 20);
  assert.match(memoryNote(p), /Kiểm chứng/); assert.equal(memoryNote(buildProfile([])), "");
});
t("spread of repeated scores", () => { assert.deepEqual(spread([70, 70, 70]), { mean: 70, sd: 0, range: 0 }); assert.equal(spread([5]), null); });

/* ---- hold-out attacks: measured, not tuned for (see ATTACKS_HOLDOUT) ---- */
t("hold-out attacks: report how many the detector misses (the output guard is the real defence)", () => {
  const missed = ATTACKS_HOLDOUT.filter((a) => !detectPressure(a));
  console.log(`      hold-out: ${ATTACKS_HOLDOUT.length}, missed by regex: ${missed.length}${missed.map((m) => `\n        - ${m}`).join("")}`);
  assert.ok(ATTACKS_HOLDOUT.length >= 10);
});

/* ---- quote check, safe challenge, privacy ---- */
t("quoteIn keeps only real quotes", () => {
  assert.equal(quoteIn("Mạng xã hội làm giảm tập trung.", "“mạng xã hội  làm giảm”"), "mạng xã hội  làm giảm");
  assert.equal(quoteIn("Mạng xã hội làm giảm tập trung.", "điều chưa từng viết"), "");
  assert.equal(quoteIn("abc", 42 as any), "");
});
t("safeChallenge never says the source is wrong, never hands over an answer, and always asks", () => {
  assert.equal(safeChallenge("Nguồn của bạn là sai rồi, nó không tồn tại.", "unsupported_claim"), SAFE_SOURCE_QUESTION);
  assert.equal(safeChallenge("Đáp án đúng là B vì lý do sau đây.", "logic_gap"), SAFE_SOURCE_QUESTION);
  assert.match(safeChallenge("Đây là kết luận.", "none"), /\?/);
  assert.equal(safeChallenge("Bạn dựa vào đâu để nói điều đó?", "unsupported_claim"), "Bạn dựa vào đâu để nói điều đó?");
});
t("scrub removes emails, phones, ids and the student's own name", () => {
  const s = scrub("Mình là Lã Uyển Nhi, mail la.uyennhi@student.edu.vn, sđt 0912 345 678, mssv 20211234567. Nhi hỏi tiếp.", { name: "Lã Uyển Nhi", email: "la.uyennhi@student.edu.vn" });
  assert.ok(!/@|0912|20211234567|Lã Uyển Nhi/.test(s), s); assert.match(s, /\[SV\]/); assert.match(s, /\[email\]/);
  assert.equal(scrub("Demographic Parity là gì?"), "Demographic Parity là gì?");
});

/* ---- stages: order, requirements, backward compatibility ---- */
const chat = (n: number, extra: any = {}) => ({ messages: Array.from({ length: n }, () => ({ role: "user" })), intent: { answers: [], skipped: false }, ...extra });
t("old assignments (no stages) have only Think First and Co-Think, and submit after 3 turns", () => {
  const a = { friction: "required" };
  assert.deepEqual(computeStages(a, chat(0)).map((s) => s.id), ["think_first", "co_think"]);
  assert.ok(submitBlocker(a, chat(2))); assert.equal(submitBlocker(a, chat(3)), null);
});
t("cleanStages: file-only assignments cannot enable the new stages; turns are clamped", () => {
  assert.equal(cleanStages({ perspective_lab: { enabled: true } }, "file_only").perspective_lab.enabled, false);
  assert.equal(cleanStages({ are_you_sure: { enabled: true, turns: 99 } }, "both").are_you_sure.turns, 5);
  assert.equal(cleanStages({ are_you_sure: { enabled: true, turns: 0 } }, "both").are_you_sure.turns, 1);
  assert.equal(stageConfig({}).ask_confidence, false);
});
t("Lab and Are-you-sure stay locked before 3 Co-Think turns, then open in order", () => {
  const a = { friction: "none", stages: { perspective_lab: { enabled: true, required: true }, are_you_sure: { enabled: true, required: true, turns: 2 } } };
  assert.ok(stageBlocker(a, chat(2), "perspective_lab")); assert.equal(stageBlocker(a, chat(3), "perspective_lab"), null);
  assert.ok(stageBlocker(a, chat(3), "are_you_sure"), "AYS waits for the required Lab");
  const labDone = chat(3, { lab: { events: [{ rewrite: { after: "x" } }] } });
  assert.equal(stageBlocker(a, labDone, "are_you_sure"), null);
  assert.match(String(submitBlocker(a, labDone)), /Bạn chắc chứ/);
});
t("an optional Lab does not hold back Are-you-sure; Are-you-sure messages are not Co-Think turns", () => {
  const a = { friction: "none", stages: { perspective_lab: { enabled: true, required: false }, are_you_sure: { enabled: true, required: true, turns: 2 } } };
  assert.equal(stageBlocker(a, chat(3), "are_you_sure"), null);
  const c = { messages: [{ role: "user" }, { role: "user" }, { role: "user", stage: "are_you_sure" }, { role: "user", stage: "are_you_sure" }] };
  assert.ok(submitBlocker(a, c), "only 2 real Co-Think turns");
});
t("disabled stage is rejected", () => { assert.ok(stageBlocker({ friction: "none" }, chat(5), "perspective_lab")); });
console.log(`\n${pass} passed`);
