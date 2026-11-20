import assert from "node:assert/strict";
import { ATTACKS, detectPressure, looksLikeFullAnswer, cleanCoach, pickPassages, agreement, buildProfile, memoryNote, spread, chunkText } from "../src/lib/coach.ts";

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
console.log(`\n${pass} passed`);
