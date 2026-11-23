# TraceEdu: Product & Engineering Spec

> **Less Paste, More Trace.** Nền tảng lớp học nơi AI biết lùi lại đúng lúc để tư duy độc lập được phép bắt đầu.

| | |
|---|---|
| Phiên bản | 2.0, 23/11/2026 (thay thế "Tài liệu sản phẩm" v1.0 ngày 20/11/2026) |
| Repo | `lauyennhi/trace-ai` |
| Stack | React 19 + TypeScript + Vite 6 + Tailwind 4 · Express 4 (`server.ts`) · Gemini (`@google/genai`) · Supabase/Firestore/file · Vercel |
| Đối tượng đọc | **Claude Code** (và người phát triển) để code tiếp |

## 0. Cách dùng tài liệu này

1. Đọc mục 1–3 trước (nguyên tắc, vai trò, hành trình). Mục 4 là **đặc tả mới cần code**.
2. Tài liệu viết dựa trên bản v1.0 và ghi chú thiết kế của chủ dự án. **Mình (người viết spec) chưa đọc code.** Tên trường, đường dẫn API ở mục 8–9 là **đề xuất**: hãy đối chiếu với code hiện có và đi theo quy ước sẵn có, không tạo song song.
3. Nhãn trạng thái: ✅ đã có · 🟡 một phần · ⛔ chưa có · 🔬 có tính năng nhưng chưa kiểm chứng hiệu quả.
4. Khi gặp điểm chưa rõ, dùng **mặc định** ở mục 12 (Quyết định còn mở), rồi ghi lại bạn đã chọn gì. Đừng dừng lại hỏi.
5. Trước khi sửa một hành vi ✅, đọc test liên quan (`scripts/coach.test.ts`, `scripts/api-smoke.sh`) và giữ test xanh.

---

## 1. Nguyên tắc bất biến (không được phá khi code)

| # | Nguyên tắc | Hệ quả khi code |
|---|---|---|
| P1 | **Ép buộc ở máy chủ, không ở giao diện.** | Mọi "khóa" (nghĩ trước, che mờ, thứ tự chặng, giới hạn lượt) phải kiểm tra ở API. Giao diện chỉ phản ánh. |
| P2 | **Phần bị che không bao giờ gửi về trình duyệt sinh viên** (đáp án bị che, đáp án lỗi L2, nội dung tài liệu lớp). | Không đưa vào JSON trả về, kể cả ẩn bằng CSS. Có test rò rỉ. |
| P3 | **AI chỉ đề xuất, giảng viên quyết điểm.** | Điểm AI luôn gắn nhãn "đề xuất". Điểm cuối là điểm giảng viên. |
| P4 | **Không tin AI về bằng chứng.** | Mọi trích dẫn AI đưa ra phải nằm thật trong văn bản nguồn (tin nhắn, bản nháp), nếu không bị loại. Áp dụng cho cả chặng mới. |
| P5 | **Việc quyết định chắc chắn do code làm, không nhờ AI đoán** (cắt che mờ, chặn dán, đếm lượt, so khớp lỗi L2, độ giống văn bản). | Dùng thuật toán, có test. |
| P6 | **Trung thực với người dùng.** | Không hiển thị tính năng chưa có. Dữ liệu demo luôn có nhãn. Không dùng từ "chống gian lận", dùng "ngăn dán, ghi nhận hành vi". |
| P7 | **Không bịa nguồn.** | Tính năng nào hiện link/nguồn học thuật chỉ hiện nguồn đã xác minh tồn tại. Nếu không có nguồn thì ghi rõ "lập luận do AI soạn, chưa có nguồn". |
| P8 | **Riêng tư tối thiểu.** | Thống kê hành vi ẩn danh, chỉ hiện từ 5 sinh viên. Hồ sơ công khai không có email, điểm học phần, nhật ký chat. |
| P9 | **Dùng từ thận trọng về nhân quả.** | Giao diện và báo cáo dùng "liên quan", "chỉ báo", không dùng "chứng minh tư duy". |

---

## 2. Vai trò và phân quyền ✅

| Vai trò | Làm gì |
|---|---|
| **Sinh viên** | Vào lớp bằng mã mời, làm bài qua các chặng, nộp, xem kết quả, hồ sơ tư duy, chia sẻ liên kết chỉ-xem |
| **Giảng viên** | Tạo môn, mã mời, tài liệu lớp, giao bài và chọn các chặng, đọc bằng chứng, chốt điểm, thống kê lớp, độ tin cậy điểm AI |
| **Quản trị viên** | Người dùng, môn học, phân quyền theo vai trò, nhật ký, cài đặt đăng ký, dữ liệu demo |

Đăng nhập email + mật khẩu (scrypt có muối), phiên bằng token ký (`AUTH_SECRET`). Đăng ký có thể bật/tắt toàn hệ thống. Có tài khoản demo (xem mục 14).

---

## 3. Hành trình người dùng từ đầu đến cuối

```
Vào web → Đăng nhập
   │
   ├─ GIẢNG VIÊN: Tạo môn → mã mời → (tài liệu lớp) → Giao bài + chọn các chặng
   │
   └─ SINH VIÊN:  Vào lớp bằng mã → "Việc cần làm" → Xem đề, yêu cầu, rubric
         ↓
      [1] Think First      Viết ý riêng trước                       ✅
         ↓
      [2] Co-Think         Hỏi → (Mở khóa) → Chốt ý, có Nhận xét ngay  ✅
         ↓ (≥ 3 lượt)
      [3] Perspective Lab  Chọn đoạn văn → xem góc nhìn khác → sửa lại   ⛔ MỚI
         ↓
      [4] Are you sure?    AI chất vấn N câu                         🟡 MỞ RỘNG
         ↓
      Nộp bài
         ↓
   AI chấm quá trình theo rubric 5 tiêu chí (đề xuất)                ✅ (mở rộng nguồn bằng chứng)
         ↓
   GIẢNG VIÊN: xem bằng chứng → chốt điểm 0–10 (hoặc bảo AI chấm lại)  ✅
         ↓
   SINH VIÊN: điểm, radar 5 tiêu chí, dấu vết, hồ sơ tư duy, liên kết chia sẻ  ✅
   GIẢNG VIÊN: thống kê lớp, sinh viên nguy cơ, độ tin cậy điểm AI    ✅
```

**Tên hiển thị (UI sinh viên) và tên kỹ thuật**

| Tên hiển thị | English | Tên kỹ thuật/nội bộ |
|---|---|---|
| Nghĩ trước (Hmm…) | Think First | ma sát đầu vào (`friction`) |
| Cùng nghĩ | Co-Think | chat + `answer_gate` (che mờ) + chế độ Socratic |
|   ↳ Hỏi | Ask | gửi tin nhắn |
|   ↳ Mở khóa | Unlock | trả lời câu hỏi để xem phần bị che |
|   ↳ Chốt ý | Refine | AI viết lại theo ý sinh viên |
| Nhận xét ngay | Live Feedback | `live_coach` |
| Góc nhìn khác | Perspective Lab | module mới (mục 4.3) |
| Bạn chắc chứ? | Are you sure? | module mở rộng (mục 4.4) |

Giảng viên thấy tên kỹ thuật kèm giải thích ở màn giao bài. Sinh viên chỉ thấy tên hiển thị.

---

## 4. Đặc tả bốn chặng

### 4.0 Mở bài ✅
Sinh viên vào lớp (mã mời), mở bài từ "Việc cần làm". Màn hình đầu hiện đề, yêu cầu, rubric, hạn nộp và **thanh tiến trình các chặng đã bật** cho bài này. Chặng nào giảng viên không bật thì không hiện.

### 4.1 Think First ✅ (cần chỉnh nhỏ)

**Mục đích:** buộc sinh viên có ý riêng trước khi AI lên tiếng, để AI nâng cấp ý đó thay vì thay bằng ý của máy.

**Hiện có (giữ nguyên):**
- 3 mức: Không có / Nhắc nhẹ (cho bỏ qua, có ghi nhận) / Bắt buộc.
- Câu hỏi định hướng tối đa 3 câu, giảng viên sửa được. Mặc định: luận điểm cốt lõi; dẫn chứng định dùng; điều còn băn khoăn.
- Bắt buộc: trả lời ≥ 2 câu, tổng ≥ 40 ký tự. Máy chủ từ chối tin nhắn hỏi AI nếu chưa đủ.
- Ý ghi trước được đưa vào lệnh gửi AI.

**Thay đổi cần làm (P0):**
- **Mức tự tin 1–5 trở thành tùy chọn**, mặc định **ẩn** ở giao diện sinh viên. Thêm cài đặt giảng viên `ask_confidence` (mặc định `false`). Nếu tắt thì không thu, không hiển thị.
- Nếu không có dữ liệu tự tin thì thẻ "hiệu chỉnh tự tin" trong thống kê lớp phải ẩn hoặc báo "chưa bật thu thập", không được lỗi hay hiện 0.

**Tiêu chí chấp nhận:**
- [ ] Bài `ask_confidence=false`: giao diện không có ô tự tin; API không đòi trường này.
- [ ] Bài `ask_confidence=true`: hành vi như hiện tại.
- [ ] Dữ liệu cũ có tự tin vẫn hiển thị đúng.
- [ ] Test API: gửi ý riêng không kèm tự tin vẫn qua khi tắt.

### 4.2 Co-Think ✅ (giữ, ghi để tham chiếu)

Gồm ba bước lặp mỗi lượt hỏi:

1. **Hỏi:** sinh viên gửi tin nhắn. AI trả lời theo chế độ **Socratic** (hỏi gợi mở, không đưa đáp án) hoặc **Thường**. Ba lớp bảo vệ: quy tắc bất biến cuối lệnh · nhận diện áp lực (9 kiểu ép AI) · cổng chặn đầu ra (nếu trông như đưa đáp án thì yêu cầu trả lời lại, vẫn vi phạm thì thay bằng câu hỏi dẫn dắt có sẵn).
2. **Mở khóa** (nếu `answer_gate` bật): AI soạn đáp án đầy đủ (250–400 từ) + 2–3 câu hỏi. Máy chủ **cắt đoạn đầu bằng thuật toán cố định** (khoảng 30%), phần còn lại giữ ở máy chủ. Sinh viên trả lời câu hỏi (≥ 2 câu, ≥ 30 ký tự) mới đọc tiếp.
3. **Chốt ý:** AI viết lại đáp án theo ý sinh viên, sửa chỗ sai, gợi ý hướng khác.

**Nhận xét ngay** (`live_coach`): sau mỗi lượt, một nhận xét ngắn theo một trong 5 tiêu chí, **trích nguyên văn** câu của sinh viên, kèm một việc nhỏ nên làm tiếp. Trích dẫn không có thật thì bị bỏ. Tốn thêm 1 lần gọi AI mỗi tin nhắn.

**Khóa dán** (`paste_mode`): chặn dán, thả, sao chép, cắt; máy chủ từ chối tin nhắn có ký tự dán. Ghi nhận số ký tự dán và số lần thử.

**Điều kiện chuyển chặng:** ≥ 3 lượt trao đổi (theo hiện tại là điều kiện nộp). Từ nay đây cũng là **điều kiện mở khóa chặng 3 và 4** (mục 5.2).

**Việc cần làm ở chặng này:** chỉ gắn thẻ `stage: "co_think"` cho tin nhắn (mục 8) để chấm và thống kê phân biệt được các chặng.

### 4.3 Perspective Lab ⛔ MỚI (P1)

**Mục đích:** rèn **Phản biện**. Sinh viên chọn một đoạn văn, nghĩ ý của mình trước, rồi mới xem góc nhìn khác, sau đó **sửa lại đoạn đó**. Bằng chứng đo được là bản trước và bản sau.

**Đầu vào (mặc định):** bản nháp của **chính sinh viên** (dán hoặc tải `.txt`/`.md`, tối đa 20.000 ký tự). Xem quyết định mở số 3.

**Luồng:**

```
Tải/dán văn bản → Bôi đen một đoạn (≥ 20 ký tự, ≤ 1.500 ký tự)
   → Hộp: "Muốn xem góc nhìn khác không?"  [Có]
   → Hmm… Viết 1–2 câu: bạn nghĩ gì về đoạn này? (≥ 20 ký tự)   ← server khóa đến khi đủ
   → Máy chủ phân loại đoạn:
        • "tranh luận" (ý kiến, giá trị, cách tiếp cận)  → trả 2 góc nhìn khác
        • "sự kiện đã có đồng thuận"                   → chế độ KIỂM CHỨNG (không dựng phe phản biện)
        • "không rõ"                                    → hỏi lại sinh viên làm rõ ý
   → Sinh viên chọn: [Ghi nhận] [Phản biện lại] [Bỏ qua]
   → Sửa lại đoạn vừa bôi đen (trình soạn thảo, ghi nhận từng lần sửa)
   → Lưu sự kiện, hiển thị vào dấu vết
```

**Quy tắc máy chủ:**

| # | Quy tắc |
|---|---|
| L1 | Không trả góc nhìn nào trước khi nhận `stance_text` đủ điều kiện (cùng tinh thần Think First). |
| L2 | Phân loại bằng AI (nhiệt độ 0,2, đầu ra JSON `{mode, reason}`), kết quả lưu để giảng viên xem. |
| L3 | Mode `tranh_luan`: trả đúng 2 góc nhìn `{stance, argument, source}`. `source` là `null` hoặc `{title, url, verified:true}`. **Cấm đưa URL chưa xác minh.** |
| L4 | **Nguồn v1:** chỉ lấy từ **tài liệu lớp** (tái dùng bộ chọn đoạn theo từ khóa). Khi không có nguồn phù hợp, giao diện ghi "Lập luận do AI soạn, chưa có nguồn". |
| L5 | Mode `su_kien`: hiện "Điều cần kiểm chứng" + gợi ý cách tìm bằng chứng, không dựng phản biện. |
| L6 | Ghi nhận thay đổi khi sửa: bản trước, bản sau, độ giống, ký tự gõ/xóa/dán, có viết lại từ đầu không. **Tái dùng cơ chế chụp nhanh của bài L2.** |
| L7 | Văn bản tải lên và nội dung phản biện không được lộ cho sinh viên khác. |
| L8 | Giới hạn tần suất áp dụng như chat. |

**Dữ liệu ghi nhận cho chấm điểm:** số đoạn đã xem góc nhìn khác, số lần Phản biện lại, nội dung phản biện, số đoạn đã sửa, mức thay đổi đoạn văn.

**Hiển thị cho giảng viên (chip):** *"Góc nhìn khác: xem N, phản biện M, sửa lại K"*, kèm bản trước/sau.

**Tiêu chí chấp nhận:**
- [ ] Gọi API lấy góc nhìn mà chưa có `stance_text` đủ điều kiện → bị từ chối (test API).
- [ ] Đoạn thuộc mode `su_kien` không trả về "phe phản biện" (test với AI giả lập trả mode đó).
- [ ] Không có `url` nào trong phản hồi mà không `verified:true` (test).
- [ ] Sửa đoạn: có bản trước/bản sau, số liệu dán/gõ đúng.
- [ ] Sinh viên B không đọc được dữ liệu Lab của sinh viên A (test phân quyền).
- [ ] Tắt chặng này ở bài giao thì không hiện và API từ chối.

**Ngoài phạm vi (làm sau):** tìm nguồn web có kiểm tra link ([CẦN XÁC MINH công cụ tìm kiếm, chi phí, điều khoản]), tiện ích trình duyệt (P3).

### 4.4 Are you sure? 🟡 MỞ RỘNG (P1)

**Mục đích:** rèn **Kiểm chứng/Phản biện**. AI chất vấn lập trường hiện tại của sinh viên trong N lượt.

**Luồng:** sau khi hoàn tất chặng 3 (hoặc chặng 2 nếu chặng 3 tắt), sinh viên bấm "Bạn chắc chứ?". AI nêu một thách thức mỗi lượt, sinh viên trả lời, lặp tối đa N lượt (mặc định 3, giảng viên đặt 1–5).

**Quy tắc máy chủ:**

| # | Quy tắc |
|---|---|
| A1 | Mỗi lượt AI trả về JSON: `{issue_type, question}` với `issue_type` ∈ `logic_gap | unsupported_claim | ambiguity | counterexample | none`. |
| A2 | **AI chỉ chất vấn điểm yếu có thật.** Nếu `none` (lập luận vững), AI nói rõ lập luận vững chỗ nào và hỏi một câu **mở rộng**, không bịa lỗi. |
| A3 | Chất vấn phải bám vào câu của sinh viên (trích nguyên văn, kiểm theo P4). |
| A4 | Sau mỗi câu trả lời của sinh viên, phân loại `response_type` ∈ `held_with_reason | revised | conceded_without_reason | dodged`, kèm trích dẫn. Hiển thị cho giảng viên. |
| A5 | Cổng chặn đầu ra (không đưa đáp án) áp dụng như Co-Think. |
| A6 | **Chưa** phán "nguồn sai" nếu chưa có kiểm tra nguồn thật. Bản đầu chỉ hỏi "Nguồn của bạn là gì? Làm sao biết nó đáng tin?". |
| A7 | Số lượt do máy chủ đếm, không do giao diện. |

**Chấm:** rubric phải **thưởng cả việc giữ vững lập trường có lý lẽ** (`held_with_reason`), không chỉ việc sửa lại. `conceded_without_reason` là tín hiệu yếu, không phải tín hiệu tốt.

**Tiêu chí chấp nhận:**
- [ ] Đủ N lượt thì chặng đóng; gửi thêm bị từ chối (test API).
- [ ] Với đầu vào lập luận tốt (AI giả lập), `issue_type=none` và không có câu "tìm lỗi".
- [ ] `response_type` có trích dẫn nằm thật trong câu trả lời sinh viên.
- [ ] Không có câu nào khẳng định "nguồn của bạn sai" ở bản v1.

### 4.5 Nộp bài ✅
Điều kiện nộp do máy chủ kiểm tra: đủ lượt Co-Think, các chặng giảng viên đặt `required` đã xong (mục 5.2), đã đủ Think First nếu mức Bắt buộc. Có lưu nháp tự động; đính kèm file nếu bài cho phép.

---

## 5. Cài đặt của giảng viên khi giao bài

### 5.1 Hiện có ✅
Kiểu nộp (chỉ nộp file · chỉ chat AI · cả hai · Viết ngoại ngữ L2) · Chế độ AI (Socratic/Thường) · Ma sát đầu vào (Không/Nhắc nhẹ/Bắt buộc) · Câu hỏi định hướng · Che mờ (Không/Bỏ qua được/Bắt buộc) · Dán và sao chép (Cho phép có ghi nhận/Khóa) · Nhận xét trực tiếp · Hạn nộp, nộp trễ · Đề bài, tiêu chí chấm, file đính kèm.

### 5.2 Cần thêm (P0/P1)
Tên trường đề xuất, đối chiếu quy ước trong code:

```jsonc
"stages": {
  "think_first":      { "mode": "none|soft|required", "ask_confidence": false },
  "perspective_lab":  { "enabled": false, "required": true },
  "are_you_sure":     { "enabled": false, "required": true, "turns": 3 }
}
```

- Giữ tương thích: các trường cũ (`friction`, `friction_prompts`...) vẫn là nguồn sự thật cho Think First và Co-Think. `stages` chỉ thêm phần mới. Bài cũ không có `stages` thì coi như hai chặng mới tắt.
- **Thứ tự ép bởi máy chủ:** chặng 3 và 4 chỉ mở sau ≥ 3 lượt Co-Think; chặng 4 mở sau chặng 3 (nếu chặng 3 bật). Sinh viên được quay lại Co-Think bất cứ lúc nào.
- `required=false` nghĩa là sinh viên làm hoặc bỏ qua được, có ghi nhận.

---

## 6. Chấm điểm

**Năm tiêu chí (0–100), giữ nguyên:** Phản biện · Đào sâu · Kiểm chứng · Nội hóa · Chủ động. Cộng điểm quá trình tổng. Mỗi nhận định phải kèm đoạn trích nguyên văn của sinh viên (xanh: tư duy tốt, vàng: cần làm rõ, đỏ: nhờ làm hộ hoặc sao chép).

**Ánh xạ chặng → tiêu chí → bằng chứng (đề xuất, đưa vào lệnh chấm):**

| Chặng | Tiêu chí chính | Bằng chứng đưa cho bộ chấm |
|---|---|---|
| Think First | Chủ động, Nội hóa | Ý ghi trước, so với nội dung bài nộp |
| Co-Think | Đào sâu, Nội hóa | Các lượt hỏi, câu trả lời mở khóa, thay đổi sau Chốt ý |
| Perspective Lab | Phản biện | `stance_text`, nội dung phản biện, bản trước/sau của đoạn |
| Are you sure? | Kiểm chứng, Phản biện | `issue_type`, `response_type` kèm trích dẫn |

**Việc cần làm:**
- Mở rộng đầu vào bộ chấm để nhận bằng chứng có gắn nhãn chặng; mỗi mục bằng chứng có thể có trường `stage`.
- Giữ nguyên định dạng đầu ra để giao diện cũ vẫn chạy; thêm `stage` tùy chọn cho từng trích dẫn.
- Kiểm tra trích dẫn có thật (P4) trên **mọi** nguồn văn bản mới.
- Tiếp tục cắt bằng chứng ở 60.000 ký tự và báo khi bị cắt.
- Ghi tên mô hình dùng kèm mỗi kết quả chấm (để so khi đổi mô hình).

**Phát hiện nội dung ngoài luồng:** phần bài nộp không khớp với những gì xuất hiện trong chat. Giữ, và cân nhắc tính cả bản nháp ở Perspective Lab.

**Giảng viên chốt điểm 0–10;** có thể bảo AI chấm lại. **Độ tin cậy điểm AI** 🔬: so với điểm giảng viên (lệch trung bình, tỉ lệ trong ±1, tương quan), độ ổn định (chấm lại 3 lần), cảnh báo khi < 30 bài, nhãn "Dữ liệu demo".

---

## 7. Kết quả sau khi chấm ✅

**Sinh viên:** điểm, radar 5 tiêu chí, nhận xét, dấu vết tư duy theo lượt (nay theo cả chặng). **Hồ sơ tư duy:** radar trung bình, mạnh/cần luyện, xu hướng; trí nhớ AI về điểm yếu thường gặp (nhắc đúng một lần ở bài sau). **Liên kết chia sẻ:** chỉ-xem, không đăng nhập, mã ngẫu nhiên 24 ký tự, thu hồi được, không email/điểm học phần/nhật ký chat, tùy chọn kèm tối đa 3 trích đoạn tư duy tốt.

**Giảng viên:** điểm trung bình, phân bố, sinh viên có nguy cơ (chưa nộp, điểm dưới ngưỡng, lâu không truy cập). Chỉ báo hành vi ẩn danh (từ 5 sinh viên): tỉ lệ viết ý riêng trước, tỉ lệ bỏ qua, tỉ lệ tin nhắn dán ≥ 200 ký tự, tỉ lệ trả lời câu hỏi mở khóa, hiệu chỉnh tự tin (khi có dữ liệu). **Thêm mới:** tỉ lệ sinh viên dùng Perspective Lab, phân bố `response_type` ở Are you sure?. Chi tiết bài từng sinh viên: nhật ký, dấu vết, chip hành vi (đã thử dán, ép AI, AI tự sửa, nhận xét tốt/cần cải thiện, **góc nhìn khác**, **phản hồi khi bị chất vấn**).

**Hồ sơ tư duy tổng hợp hiện chưa tính bài L2** (nợ kỹ thuật, P3).

---

## 8. Kiến trúc và mô hình dữ liệu

**Lưu trữ:** mọi bản ghi là một dòng JSON trong `documents(collection, id, data, deleted, updated_at)`. Thêm collection mới **không cần migration**.

| Collection | Thay đổi |
|---|---|
| `assignments` | Thêm trường `stages` (mục 5.2). Cho phép thiếu trường (bài cũ). |
| `chat_sessions` | Mỗi tin nhắn thêm `stage: "co_think" \| "are_you_sure"`. Tin nhắn cũ coi là `co_think`. Thêm `ays: { issue_type, response_type, quote }` ở các lượt chất vấn. |
| `lab_sessions` (MỚI) | `id, assignment_id, user_id, text, created_at, updated_at` |
| `lab_events` (MỚI) | `id, lab_id, user_id, selection:{start,end,text}, stance_text, mode, reason, counterviews[], action, rebuttal_text, rewrite:{before,after,similarity,typed,deleted,pasted,rewritten_from_scratch}, ts` |
| `submissions` | `process_score_result` thêm `stage` tùy chọn cho trích dẫn |
| còn lại | `users, courses, course_members, notifications, audit_logs, settings` giữ nguyên |

**AI:** chỉ Gemini; mô hình mặc định `gemini-3.5-flash`, dự phòng cấu hình qua env. Thử lại 2 lần với 503/429/500 rồi chuyển mô hình; hết thời gian chờ 30 giây; lỗi khóa/yêu cầu hỏng thì dừng ngay. Không tinh chỉnh mô hình; hành vi đến từ lệnh và lớp bọc máy chủ.

| Việc AI làm | Nhiệt độ | Đầu ra |
|---|---|---|
| Chat | 0,7 | Văn bản |
| Soạn đáp án che mờ | 0,8 | JSON `{answer, questions}` |
| Viết lại sau mở khóa | 0,6 | JSON `{answer, used_ideas, alternatives}` |
| Nhận xét trực tiếp | 0,2 | JSON `{level, criterion, quote, note, tip}` |
| Chấm quá trình | 0,2 | JSON 5 tiêu chí + trích dẫn |
| **Phân loại đoạn (Lab) (MỚI)** | 0,2 | JSON `{mode, reason}` |
| **Góc nhìn khác (Lab) (MỚI)** | 0,6 | JSON `{counterviews:[{stance, argument, source_ref}]}` |
| **Chất vấn (Are you sure?) (MỚI)** | 0,5 | JSON `{issue_type, question, quote}` |
| **Phân loại phản hồi (MỚI)** | 0,2 | JSON `{response_type, quote}` |
| Chấm L2 | 0,2 | JSON 5 chiều |

Lệnh gửi AI gồm nhiều lớp theo thứ tự: vai trò → tiêu chí chấm của giảng viên → đoạn tài liệu lớp liên quan → trí nhớ về sinh viên → ý riêng đã ghi → quy tắc (quy tắc đặt cuối cùng).

---

## 9. API

**Giữ nguyên (nhóm chính):** `/api/auth/*`, `/api/courses/*`, `/api/courses/:id/assignments`, `/api/assignments/:id`, `/api/chat/message|intent|unlock`, `/api/submissions/submit|draft|:id/reevaluate`, `PUT /api/submissions/:id/grade`, `/api/l2/*`, `/api/me/profile*`, `/api/public/profile/:mã`, `/api/analytics/*`, `/api/overview`, `/api/notifications`, `/api/admin/*`, `/api/health`.

**Đề xuất thêm (đối chiếu quy ước đặt tên trong `server.ts`):**

| Method | Đường dẫn | Việc |
|---|---|---|
| POST | `/api/lab/start` | Tạo `lab_session` từ văn bản (kiểm tra độ dài, quyền, chặng đã bật) |
| POST | `/api/lab/stance` | Nhận `{lab_id, selection, stance_text}`, kiểm tra điều kiện, phân loại, trả góc nhìn hoặc chế độ kiểm chứng |
| POST | `/api/lab/action` | `{event_id, action: accept\|rebut\|skip, rebuttal_text?}` |
| POST | `/api/lab/rewrite` | `{event_id, after_text, typed, deleted, pasted}` |
| GET | `/api/lab/:assignmentId/mine` | Lịch sử Lab của sinh viên |
| POST | `/api/ays/turn` | Lượt chất vấn: nhận câu trả lời, trả lượt kế hoặc đóng chặng (máy chủ đếm lượt). Có thể tái dùng `/api/chat/message` với `stage` nếu code hiện tại thuận lợi hơn |
| GET | `/api/stages/:assignmentId/state` | Trạng thái các chặng, mở/khóa, tiến độ, để giao diện hiển thị |

Mọi API mới: kiểm tra vai trò và quyền, áp giới hạn tần suất, ghi nhật ký khi cần, không rò rỉ dữ liệu của sinh viên khác.

---

## 10. Giao diện và thương hiệu

- **Màu:** Deep Navy `#041B2D`, Cobalt Blue `#004E9A`, Sky Blue `#428CD4`; phụ: xanh lá `#16a34a` (đạt), đỏ gạch `#c2503f` (lỗi, cảnh báo). **Font:** Be Vietnam Pro.
- **Chữ ký chuyển động:** chữ **"h m m m…"** nhấp nhô thay vòng quay chờ ở mọi chỗ AI đang xử lý. Tôn trọng "giảm chuyển động".
- **Giọng chữ:** ngắn, sắc, xưng "bạn", tránh thuật ngữ AI sáo rỗng.
- **Sáng/tối:** hai bộ biến màu. **Thành phần:** thẻ, chip, nút, hộp thoại, thanh tiến độ, khung xương, thông báo nổi. Router hash tự viết.
- **Trang chủ công khai:** hero, âm thanh của tư duy, tầm nhìn, About Trace, H.M.M, Vòng lặp Hmm (3 cảnh: góc nhìn khác, nghĩ trước, bạn chắc chứ), "Aha!", CTA.

**Việc cần làm ở giao diện:**
1. **(P0) Trang chủ phải khớp thực tế.** Cảnh "tiện ích bôi đen" và "quét nguồn giả" gắn nhãn **"Sắp ra mắt"** (hoặc bỏ). Con dấu **"Verified Mind"** đổi thành nhãn **"Giảng viên đã xác nhận"** và chỉ hiện sau khi giảng viên chốt điểm, hoặc bỏ. Cảnh "Góc nhìn khác" nên trỏ tới Perspective Lab khi đã có.
2. **(P0) Thẻ độ tin cậy điểm AI:** khi toàn bộ là dữ liệu demo thì **ẩn các con số**, chỉ hiện watermark "Dữ liệu demo, không phải bằng chứng". Không để số demo xuất hiện ở nơi có thể bị chụp làm bằng chứng.
3. **(P1)** Thanh tiến trình các chặng ở màn làm bài; màn Perspective Lab (soạn thảo + bôi đen + hộp góc nhìn); màn Are you sure? (giống chat nhưng có đếm lượt).
4. **(P1)** Màn giao bài của giảng viên: nhóm cài đặt "Các chặng" với mô tả ngắn bằng tiếng Việt cho từng chặng.

---

## 11. Bảng trạng thái và backlog

### 11.1 Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Tài khoản, vai trò, phân quyền, nhật ký | ✅ |
| Môn học, mã mời, tài liệu lớp | ✅ (🟡 chưa đọc PDF/Word, tìm đoạn theo từ khóa) |
| Bài tập 4 kiểu nộp + cài đặt giảng viên | ✅ |
| Think First | ✅ (cần chỉnh: mức tự tin tùy chọn) |
| Co-Think (Socratic + che mờ + Chốt ý + Nhận xét ngay + khóa dán) | ✅ 🔬 |
| **Perspective Lab** | ⛔ |
| **Are you sure?** (chế độ nhiều lượt có cấu trúc) | 🟡 (có chất vấn Socratic, chưa có luồng riêng) |
| Chấm quá trình 5 tiêu chí | ✅ 🔬 |
| Chấm theo từng chặng | ⛔ |
| Bài L2 3 bước | ✅ 🔬 |
| Hồ sơ tư duy + liên kết chia sẻ | ✅ (🟡 chưa tính L2) |
| Thống kê lớp, độ tin cậy điểm AI | ✅ 🔬 |
| Tiện ích trình duyệt | ⛔ |
| Quét nguồn/DOI | ⛔ |
| Chính sách riêng tư, xuất/xóa dữ liệu | ⛔ |

### 11.2 Backlog theo ưu tiên

| P | Việc | Chấp nhận khi |
|---|---|---|
| **P0** | Sửa trang chủ khớp thực tế (mục 10.1) | Không còn cảnh nào hứa tính năng chưa có mà không có nhãn |
| **P0** | Ẩn số demo của thẻ độ tin cậy (10.2) | Chế độ demo không hiện r, độ lệch, n |
| **P0** | Mức tự tin tùy chọn (4.1) | Tiêu chí ở 4.1 |
| **P0** | Trường `stages` + thứ tự ép ở máy chủ + `GET /api/stages/.../state` (5.2) | Test thứ tự và bài cũ vẫn chạy |
| **P0** | Gắn `stage` cho tin nhắn chat (8) | Tin nhắn cũ vẫn hiển thị đúng |
| **P1** | **Perspective Lab v1** (4.3), nguồn từ tài liệu lớp | Tiêu chí ở 4.3 |
| **P1** | **Are you sure? v1** (4.4) | Tiêu chí ở 4.4 |
| **P1** | Chấm theo chặng + ánh xạ tiêu chí (6) | Kết quả chấm có trường `stage`, trích dẫn được kiểm |
| **P1** | Bộ red-team Socratic **độc lập** (tách tập viết luật và tập kiểm tra; thêm câu do người khác viết) rồi chạy với Gemini thật | Báo cáo tỉ lệ giữ vững kèm cấu hình |
| **P1** | Quyền riêng tư: màn đồng ý của sinh viên, bỏ tên/email khỏi nội dung gửi AI, xuất và xóa dữ liệu, thời hạn lưu | Có màn hình và API; nội dung gửi AI không chứa tên/email (test) |
| **P2** | Kiểm tra link/DOI có tồn tại (bản đầu); cho Lab dùng nguồn web đã xác minh | Không hiện URL chưa xác minh |
| **P2** | Đọc PDF/Word cho tài liệu lớp; tìm đoạn bằng embedding | Giáo trình PDF dùng được |
| **P3** | Hồ sơ tư duy tính cả bài L2 | Gộp dữ liệu L2 |
| **P3** | Tách `server.ts` thành module; thêm kiểm thử đơn vị | Không đổi hành vi, test xanh |
| **P3** | Tích hợp LMS, SSO; tiện ích trình duyệt | Sau khi P1 có người dùng thật |

---

## 12. Quyết định còn mở (chủ dự án chưa chốt) và mặc định để code tiếp

| # | Câu hỏi | Mặc định dùng để code |
|---|---|---|
| 1 | Cả 4 chặng bắt buộc hay tùy chọn? | Giảng viên bật/tắt từng chặng khi giao bài; chặng đã bật thì mặc định `required: true`, giảng viên đổi được |
| 2 | Giữ hay bỏ mức tự tin? | Ẩn mặc định, giảng viên bật được (`ask_confidence`) |
| 3 | Perspective Lab dùng văn bản nào? | Bản nháp của sinh viên; tài liệu lớp là nguồn phản biện |
| 4 | Thứ tự chặng | Think First → Co-Think → Lab → Are you sure; Lab và AYS mở sau ≥ 3 lượt Co-Think |
| 5 | Số lượt Are you sure? | 3, giảng viên đặt 1–5 |
| 6 | Nguồn của Lab ở v1 | Chỉ tài liệu lớp; không có nguồn thì ghi rõ "chưa có nguồn" |

Khi bạn chọn khác mặc định, ghi lại trong mục này (một dòng, kèm ngày).

---

## 13. Kiểm thử bắt buộc

Giữ xanh: `npx tsx scripts/coach.test.ts` (11 phép thử), `bash scripts/api-smoke.sh` (19 phép thử, `AI_MOCK=1`). **`AI_MOCK=1` chỉ dùng kiểm thử, không bật ở môi trường chạy thật.**

**Thêm khi code các chặng mới (dùng AI giả lập):**
- Lab: không trả góc nhìn khi thiếu `stance_text`; mode `su_kien` không có phản biện; không có `url` chưa xác minh; phân quyền giữa sinh viên; chặng tắt thì từ chối.
- AYS: máy chủ đếm đúng số lượt; `issue_type=none` không "tìm lỗi"; `response_type` có trích dẫn thật; không có câu khẳng định "nguồn sai".
- Thứ tự chặng: chặng 3/4 bị từ chối khi chưa đủ 3 lượt Co-Think.
- Chấm: trích dẫn ở chặng mới phải nằm thật trong nguồn; bài cũ không có `stage` vẫn chấm được.
- Rò rỉ: không có phần bị che, đáp án lỗi, nội dung tài liệu lớp trong bất kỳ phản hồi nào gửi sinh viên.

**Chỉ có thể kiểm chứng với khóa Gemini thật và người dùng thật (🔬):** `scripts/redteam-socratic.ts`, `scripts/ai-reliability.ts`. Đừng báo "đã kiểm chứng" khi chỉ chạy bằng AI giả lập.

---

## 14. Chạy thử và môi trường

```bash
npm install
npm run dev     # máy chủ + giao diện tại http://localhost:3000
```

Cần `GEMINI_API_KEY` để chat AI và chấm điểm chạy. **Tài khoản demo** (mật khẩu `123456`): giảng viên `hung.nguyen@edu.vn`, sinh viên `la.uyennhi@student.edu.vn`, quản trị `admin@trace.edu.vn`. Dữ liệu demo lớn (30 sinh viên, 6 bài) nạp/xóa từ trang quản trị.

| Biến môi trường | Tác dụng |
|---|---|
| `GEMINI_API_KEY` | Khóa Gemini (bắt buộc cho AI) |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | Mô hình chính và dự phòng |
| `AUTH_SECRET` | Khóa ký phiên (**bắt buộc khi chạy thật**) |
| `SEED_DEMO_DATA`, `SEED_DEMO_SCALE` | Dữ liệu demo |
| `PORT`, `NODE_ENV`, `VERCEL` | Cổng, chế độ, nhận biết Vercel |
| `VITE_CONTACT_*` | Thông tin liên hệ trang chủ |
| `VITE_HMM_VOICE` | File giọng "Hmm" (đặt trong `public/`) |
| `AI_MOCK=1` | **Chỉ kiểm thử** |

Triển khai Vercel: hàm `api/index.mjs` tối đa 60 giây. **Luôn cấu hình Supabase hoặc Firestore khi chạy thật** (mặc định lưu bộ nhớ + file, Vercel không giữ file). Supabase: chạy `supabase/schema.sql`.

---

## 15. Giới hạn đã biết và việc không được làm

**Giới hạn trung thực (không che giấu trong giao diện hay tài liệu):**
- Chưa có bằng chứng thực nghiệm về hiệu quả học tập và độ tin cậy điểm AI. Số trong dữ liệu demo do hệ thống tự sinh, không phải bằng chứng.
- Khóa dán là rào chắn, không phải bức tường: gõ lại từ màn hình khác vẫn được.
- Điểm AI do mô hình diễn giải rubric tiếng Việt, có thể dao động giữa các lần chấm. Chưa kiểm chứng riêng cho người viết không phải bản ngữ.
- Chọn 5 tiêu chí và các ngưỡng (30%, ≥ 2 câu, ≥ 40 ký tự, ≥ 3 lượt) là giá trị khởi điểm, chưa có cơ sở thực nghiệm. Phải cấu hình được và ghi log để so sánh khi thí điểm.
- Điểm quá trình là **chỉ báo (proxy)** của tư duy, không phải phép đo tư duy. Nhận xét trực tiếp nêu tiêu chí có nguy cơ khiến sinh viên "diễn" theo rubric (xem câu hỏi thí điểm ở mục 16).
- Phụ thuộc một nhà cung cấp AI (Gemini).

**Không làm:**
- Không thêm tính năng lên giao diện mà chưa có trong code, không dùng từ "chống gian lận" hay "chứng minh".
- Không gửi phần bị che, đáp án lỗi hay nội dung tài liệu lớp về trình duyệt sinh viên.
- Không hiển thị URL/nguồn chưa xác minh tồn tại.
- Không để AI tự ý đưa điểm cuối.
- Không bật `AI_MOCK=1` ở môi trường chạy thật.
- Không lưu hay hiển thị dữ liệu cá nhân ngoài phạm vi cần thiết; không đưa email/điểm học phần vào liên kết công khai.

---

## 16. Thí điểm (để biến 🔬 thành số liệu), thông tin cho người thiết kế

Mục tiêu: ≥ 30 bài có cả điểm AI và điểm giảng viên; 3–4 lớp, 8–10 tuần. Dùng bật/tắt từng chặng để so sánh.

| Câu hỏi | Cách kiểm |
|---|---|
| Nhận xét trực tiếp có làm sinh viên "diễn" theo rubric không? | Nhóm A: nhận xét **không nêu tên tiêu chí**; nhóm B: nêu tên. So điểm quá trình với điểm giảng viên và vấn đáp ngắn trên mẫu ngẫu nhiên |
| Khóa dán có giảm làm hộ không? | Lớp khóa và không khóa; so tỉ lệ đoạn "nhờ làm hộ"; khảo sát ẩn danh việc dùng AI ngoài app |
| AI có đủ gần giảng viên không? | Độ đồng thuận **giữa hai giảng viên** làm nền, rồi so AI với mức đó |
| Chặng nào thực sự có tác dụng? | So lớp bật khác nhau Perspective Lab / Are you sure? |

Gợi ý kỹ thuật: tách bộ chấm khỏi bộ nhận xét (prompt riêng, nên dùng mô hình khác); ghi log mọi cấu hình và tham số cho từng bài để phân tích sau.

---

## 17. Thuật ngữ

| Từ | Nghĩa |
|---|---|
| Ma sát nhận thức | Cản trở có chủ đích để người học phải nghĩ trước khi nhận đáp án |
| Dấu vết tư duy (trace) | Bản ghi từng lượt hỏi, phản biện, viết lại của sinh viên |
| Process Score | Điểm quá trình (0–100) do AI chấm theo 5 tiêu chí; chỉ là đề xuất |
| Blur-to-Unlock | Che mờ ~70% đáp án AI, mở khi sinh viên nói ý của mình |
| Socratic | Hỏi gợi mở thay vì đưa đáp án |
| L2 | Ngôn ngữ thứ hai; bài viết ngoại ngữ có AI hỗ trợ |
| H.M.M | **H**uman meets **M**achine to build the **M**ind |

---

## 18. Ghi chú triển khai (23/11/2026): đã code gì, chọn gì, còn gì

> Mục này do người code thêm. Đã đọc code thật trước khi sửa; các tên trường và đường dẫn dưới đây là **cái đã được làm**.

### 18.1 Đã làm (có test)

| Hạng mục spec | Trạng thái | Ghi chú |
|---|---|---|
| P0 Trang chủ khớp thực tế (10.1) | ✅ | Cảnh "Góc nhìn khác" nay là Perspective Lab trong app; cảnh "Bạn chắc chứ?" nay là chất vấn nhiều lượt (bỏ link giả nháy đỏ, bỏ "quét nguồn"); con dấu đổi thành **"Giảng viên xác nhận"** (vẫn là hình minh họa); thẻ hero "Verified Mind" đổi thành "Giảng viên đã xác nhận"; nhãn "Chống nhờ AI làm hộ" đổi thành "Ngăn dán, ghi nhận hành vi" |
| P0 Ẩn số demo ở thẻ độ tin cậy (10.2) | ✅ | Khi toàn bộ là dữ liệu demo, thẻ chỉ hiện khung "Dữ liệu demo, không phải bằng chứng" |
| P0 Mức tự tin tùy chọn (4.1) | ✅ | `stages.think_first.ask_confidence`, mặc định `false`. Máy chủ **bỏ qua** trường `confidence` nếu giảng viên không bật. Thẻ hiệu chỉnh tự tin báo "chưa có dữ liệu, bật hỏi mức tự tin để thu thập" |
| P0 `stages` + thứ tự do máy chủ ép + `GET /api/stages/:id/state` | ✅ | Logic dùng chung ở `src/lib/stages.ts` (máy chủ và giao diện cùng dùng) |
| P0 Gắn `stage` cho tin nhắn | ✅ | `co_think` / `are_you_sure`; tin cũ không có `stage` coi là `co_think` |
| P1 Perspective Lab v1 | ✅ | `POST /api/lab/start|stance|action|rewrite`, `GET /api/lab/:id/mine` |
| P1 Are you sure? v1 | ✅ | `POST /api/ays/turn` |
| P1 Chấm theo chặng + trích dẫn phải có thật | ✅ | Bằng chứng Lab và chất vấn đưa vào bộ chấm; mỗi trích dẫn có `stage` tùy chọn; **trích dẫn không nằm trong bằng chứng bị loại** (`dropped_quotes`); ghi tên mô hình (`eval_model`) |
| P1 Quyền riêng tư | ✅ | Màn đồng ý (máy chủ chặn chat/Lab/chất vấn nếu chưa đồng ý); lược tên/email/số điện thoại trước khi gửi AI; tải dữ liệu (`GET /api/me/export`); xóa dữ liệu (`POST /api/me/delete-data`, gõ `XOA`); thời hạn lưu (`retention_days`, quản trị, dọn hằng ngày + nút "Dọn ngay") |
| P1 Bộ red-team độc lập | 🟡 | **Đã viết và tách tập** (`ATTACKS` vs `ATTACKS_HOLDOUT`, báo cáo riêng); **chưa chạy với Gemini thật** (xem 18.4) |

### 18.2 Quyết định khác với đề xuất của spec (và lý do)

1. **Dữ liệu Lab nằm trong tài liệu `chat_sessions`** (`chatSession.lab = {text, events[]}`), **không** tạo collection `lab_sessions`/`lab_events`. Lý do: `server.ts` có danh sách collection cố định cho cả ba backend (file, Supabase, Firestore); thêm collection mới phải sửa nhiều chỗ và dễ mất dữ liệu ở một backend. Để chung trong chat session thì Lab được lưu, xóa (khi xóa bài/xóa dữ liệu sinh viên) và xuất cùng chat. Tên API giữ như spec.
2. **Chất vấn có endpoint riêng `/api/ays/turn`** (không tái dùng `/api/chat/message`), để đếm lượt và các quy tắc A1–A7 nằm ở một chỗ. Tin nhắn vẫn nằm trong `chatSession.messages` với `stage: "are_you_sure"` và `ays: {issue_type | response_type, quote}`.
3. **Văn bản nháp ở Lab được phép dán ngay cả khi bài khóa dán** (đó là tài liệu của chính sinh viên; nếu khóa thì không có đầu vào). Số ký tự dán được ghi lại (`lab.pasted_chars`). Các ô còn lại (ý của sinh viên, phản biện, đoạn sửa, câu trả lời chất vấn) vẫn tuân theo khóa dán.
4. **Nguồn ở Lab (L3/L4):** chỉ là *tên tài liệu của lớp*, không bao giờ có URL (tài liệu lớp không có URL). Nguồn chỉ hiện nếu khớp đúng tên một tài liệu thật được chọn cho câu hỏi; nếu không thì ghi "Lập luận do AI soạn, chưa có nguồn".
5. **Sinh viên không thấy phân loại `response_type`** của chính mình trong lúc làm (chỉ giảng viên thấy), để tránh "diễn" theo nhãn; sinh viên thấy loại vấn đề AI nêu (`issue_type`) và câu trích của mình.
6. **Chặng chất vấn mở khi:** ≥ 3 lượt Cùng nghĩ **và** (Lab tắt, hoặc Lab xong, hoặc Lab không bắt buộc). Chặng đã đóng thì máy chủ từ chối thêm lượt (A7).
7. **Giới hạn tần suất** (25 tin/5 phút) giờ áp dụng chung cho cả Lab và chất vấn; chỉnh được bằng biến `CHAT_RATE_MAX` (dùng khi kiểm thử).

Các mặc định ở mục 12 (1 đến 6) được giữ nguyên.

### 18.3 Số liệu đo được khi làm (đừng bỏ qua)

- **Bộ nhận diện áp lực bằng regex chỉ bắt 3/10 câu ở tập độc lập** (bắt được 12/12 ở tập thiết kế, vì luật được viết dựa trên tập đó). Nghĩa là lớp "nhận diện áp lực" **không đáng tin để báo cáo** như một biện pháp bảo vệ; nó chỉ ghi nhận hành vi cho giảng viên. Hai lớp thực sự bảo vệ là **quy tắc bất biến cuối lệnh** và **cổng chặn đầu ra** (`looksLikeFullAnswer`), mà hiệu quả **chưa được đo với Gemini thật**. Không sửa luật để vừa tập độc lập (làm vậy sẽ phá giá trị đo).
- Bộ kiểm thử tự động: `scripts/coach.test.ts` 20 phép thử, `scripts/api-smoke.sh` 19, **`scripts/api-stages.test.mjs` 27** (thứ tự chặng, Lab, chất vấn, chấm theo chặng, đồng ý/xuất/xóa/lưu giữ, không lộ tên/email cho AI). Tất cả chạy với **AI giả lập** (`AI_MOCK=1`): chứng minh *luật và đường nối*, **không** nói gì về chất lượng câu trả lời của Gemini.
- Duyệt thử bằng trình duyệt tự động: đồng ý → thanh chặng → Lab (chọn đoạn, xem 2 góc nhìn, ghi nhận, sửa) → chất vấn → mở nút Nộp bài → giảng viên thấy bản ghi Lab và chất vấn. Không có lỗi trang.

### 18.4 Còn lại, việc chỉ người có khóa/người dùng thật làm được

1. Chạy `npx tsx scripts/redteam-socratic.ts` với `GEMINI_API_KEY` thật, đọc câu trả lời bằng mắt, **báo cáo riêng tập độc lập**.
2. Chạy `npx tsx scripts/ai-reliability.ts` với bài thật (≥ 30 bài có cả điểm AI và điểm giảng viên).
3. Thí điểm (mục 16). Chưa có dữ liệu thật nào về hiệu quả của Lab và chất vấn.
4. Với Lab: **chưa kiểm tra chất lượng "góc nhìn khác" của Gemini** (có nghiêm túc hay là "bù nhìn", có bịa nguồn không); mới kiểm tra được rằng máy chủ không để lộ URL/nguồn giả.

### 18.5 Chưa làm (đúng ưu tiên của spec)

- P2: kiểm tra link/DOI; nguồn web đã xác minh cho Lab; đọc PDF/Word cho tài liệu lớp; embedding.
- P3: hồ sơ tư duy tính cả bài L2; tách `server.ts`; tích hợp LMS, SSO; tiện ích trình duyệt.
- Bộ chấm và bộ nhận xét vẫn dùng chung cấu hình mô hình (khuyến nghị mục 16: tách, dùng mô hình khác); chưa làm.
- Quyền riêng tư: chưa có trang chính sách đầy đủ (chỉ màn đồng ý tóm tắt), chưa có quy trình xóa theo yêu cầu qua quản trị viên, chưa có "xóa tài khoản".
