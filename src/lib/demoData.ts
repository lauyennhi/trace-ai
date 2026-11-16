/**
 * Deterministic fake data for demos and manual testing: ~30 students, several assignments,
 * chats (with intents, pastes, confidence), AI process scores with highlights, grades.
 * Everything created here has an id starting with "demo_" so it can be removed again.
 * Pure (no I/O); the caller supplies the password hash and the clock.
 */

export const DEMO_PREFIX = "demo_";

const NAMES = [
  "Nguyễn Minh Triết", "Trần Thị Phương Anh", "Lê Quốc Hưng", "Phạm Hoàng Long", "Võ Ngọc Hân", "Đặng Gia Bảo", "Bùi Thanh Tâm", "Hoàng Khánh Linh",
  "Phan Đức Thịnh", "Vũ Mai Chi", "Đỗ Anh Khoa", "Ngô Thu Hà", "Dương Tuấn Kiệt", "Lý Bảo Châu", "Trịnh Hải Đăng", "Mai Ngọc Ánh",
  "Cao Minh Quân", "Tô Diễm My", "Lương Gia Huy", "Châu Thảo Vy", "Huỳnh Nhật Nam", "Đinh Yến Nhi", "Quách Thế Vinh", "Kiều Phương Thảo",
  "La Hoàng Phúc", "Tạ Ngân Hà", "Chu Văn Toàn", "Lâm Thùy Dung", "Thái Bình An", "Diệp Kim Ngân",
];

const TOPICS = [
  { title: "Bài tập 3: Thiên lệch dữ liệu trong hệ thống gợi ý", what: "thiên lệch dữ liệu" },
  { title: "Bài tập 4: Quyền riêng tư và dữ liệu cá nhân", what: "quyền riêng tư" },
  { title: "Bài tập 5: Trách nhiệm khi AI ra quyết định", what: "trách nhiệm của hệ thống tự động" },
  { title: "Bài tập 6: AI trong giáo dục, trợ giúp hay lệ thuộc", what: "việc phụ thuộc vào AI" },
  { title: "Bài tập 7: Minh bạch và giải thích được của mô hình", what: "tính giải thích được" },
  { title: "Bài tập 8: Phân tích một tình huống đạo đức AI", what: "tình huống đạo đức" },
];

const INDEPENDENT = [
  "Em nghĩ AI đang ngầm định rằng {x} chỉ có một nguyên nhân, nhưng điều này có thể sai vì dữ liệu lịch sử cũng phản ánh thiên kiến của con người.",
  "Em không đồng ý với kết luận đó. Nếu tỷ lệ nền không đồng đều thì tiêu chí công bằng ở trên có thể gây thiệt cho nhóm thiểu số, em muốn kiểm tra lại giả định này.",
  "Vậy em tự tóm tắt lại nhé: {x} xảy ra khi dữ liệu huấn luyện lệch, và cách giảm là kiểm tra theo từng nhóm trước khi triển khai.",
  "Em thấy ví dụ của bạn chưa bao quát. Nếu áp dụng vào bối cảnh doanh nghiệp nhỏ thì chi phí kiểm toán có còn khả thi không, và đâu là điểm đánh đổi?",
  "Em muốn phản biện điểm thứ hai: việc loại bỏ biến nhạy cảm chưa chắc đủ, vì các biến khác vẫn có thể thay thế gián tiếp. Em đề xuất kiểm tra tương quan.",
  "Theo cách hiểu của em thì {x} giống như một tấm gương phản chiếu quá khứ, nên muốn khác đi phải thay đổi dữ liệu chứ không chỉ thay thuật toán.",
];
const CURIOUS = [
  "Cho em hỏi thêm, nguồn nào đáng tin để kiểm chứng nhận định này ạ?",
  "Em chưa rõ khái niệm đó khác gì với cách hiểu thông thường, bạn giải thích thêm giúp em được không?",
  "Có nghiên cứu nào đối chiếu hai cách tiếp cận này không, để em tự đọc thêm?",
  "Em đang phân vân giữa hai hướng, bạn gợi ý cho em câu hỏi để tự quyết định được không?",
];
const DELEGATING = [
  "Cho em xin đáp án luôn đi, viết giúp em đoạn kết luận cho bài này.",
  "Bạn viết hộ em phần phân tích hoàn chỉnh nhé, em sẽ nộp luôn.",
  "Làm giúp em cả bài, khoảng 300 từ, em không có thời gian.",
];
const PASTE_BLOCKS = [
  "Trong những năm gần đây, các hệ thống học máy được triển khai rộng rãi trong tuyển dụng, tín dụng và giáo dục. Tuy nhiên nhiều nghiên cứu cho thấy dữ liệu huấn luyện lịch sử có thể mang theo thiên kiến, dẫn tới kết quả bất công đối với một số nhóm người dùng nếu không được kiểm soát và đánh giá thường xuyên.",
  "Theo tài liệu hướng dẫn, nguyên tắc minh bạch yêu cầu tổ chức phải công bố mục đích sử dụng dữ liệu, thời gian lưu trữ và quyền của chủ thể dữ liệu, đồng thời có cơ chế khiếu nại khi quyết định tự động ảnh hưởng đến quyền lợi của họ.",
];
const AI_REPLIES = [
  "Câu hỏi hay. Trước khi đi tiếp, em thử nêu giả định nào đang nằm sau nhận định này? Sau đó mình cùng kiểm tra giả định đó bằng một ví dụ cụ thể.",
  "Em đã chạm tới một điểm quan trọng. Em thử diễn đạt lại bằng lời của mình, rồi mình xem còn thiếu mắt xích nào không nhé.",
  "Đây là một hướng tiếp cận hợp lý. Em có thể dẫn thêm một trường hợp đối lập để thử thách lập luận của mình không?",
  "Mình gợi ý em so sánh hai cách tiếp cận theo ba tiêu chí: tác động, chi phí và rủi ro. Em thấy tiêu chí nào đáng ưu tiên nhất, và vì sao?",
];
const FEEDBACKS = [
  "Lập luận phản biện rất sắc ở giữa bài, em cần thêm dẫn chứng thực tế để thuyết phục hơn.",
  "Bài làm có chiều sâu. Hãy chú ý trích nguồn rõ ràng cho các số liệu em đưa ra.",
  "Em đã biết đặt câu hỏi ngược lại với AI, rất tốt. Lần sau hãy tự tóm tắt kết luận bằng lời của mình.",
  "Cần tự suy nghĩ nhiều hơn trước khi hỏi AI. Hãy thử ghi ý riêng trước rồi mới trao đổi.",
  "Nội dung ổn nhưng còn phụ thuộc nhiều vào câu trả lời của AI. Cô/thầy mong thấy lập trường riêng của em.",
];
const SUMMARIES = {
  indep: "Sinh viên chủ động chất vấn các giả định của AI, tự tóm tắt và kiểm chứng; hầu như không nhờ AI viết hộ.",
  mixed: "Sinh viên có đặt câu hỏi và phản biện ở một số lượt, nhưng cũng có lúc nhận câu trả lời của AI mà chưa kiểm chứng.",
  deleg: "Sinh viên chủ yếu xin đáp án hoặc nhờ AI viết hộ, ít tự lập luận; cần khuyến khích suy nghĩ trước khi hỏi.",
};

type Persona = "indep" | "mixed" | "deleg" | "absent";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoOptions { hash: string; now: number; teacherId: string; courseId: string; existing: { assignmentIds: string[]; submissionKeys: Set<string> } }
export interface DemoData { users: any[]; course_members: any[]; assignments: any[]; submissions: any[]; chat_sessions: any[] }

const DAY = 24 * 3600 * 1000;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function generateDemoData(o: DemoOptions): DemoData {
  const rand = rng(20260);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const iso = (t: number) => new Date(t).toISOString();

  const users: any[] = [], members: any[] = [], assignments: any[] = [], submissions: any[] = [], chats: any[] = [];
  const personas: Persona[] = [];
  NAMES.forEach((name, i) => {
    const id = `${DEMO_PREFIX}u${String(i + 1).padStart(2, "0")}`;
    const r = rand();
    personas.push(r < 0.34 ? "indep" : r < 0.84 ? "mixed" : r < 0.96 ? "deleg" : "absent");
    users.push({ id, name, email: `sv${String(i + 1).padStart(2, "0")}.demo@student.edu.vn`, role: "student", avatar: "", pwd: o.hash, demo: true });
    members.push({ course_id: o.courseId, student_id: id, student_name: name, student_email: `sv${String(i + 1).padStart(2, "0")}.demo@student.edu.vn`, joined_at: iso(o.now - between(20, 28) * DAY), demo: true });
  });

  // Assignments of the demo course: a mix of friction levels and due dates (4 past, 1 soon, 1 later)
  const plan: { due: number; mode: string; friction: string; ai: string }[] = [
    { due: -22, mode: "both", friction: "none", ai: "normal" },
    { due: -15, mode: "ai_chat_only", friction: "nudge", ai: "socratic" },
    { due: -9, mode: "both", friction: "nudge", ai: "socratic" },
    { due: -4, mode: "ai_chat_only", friction: "required", ai: "socratic" },
    { due: 3, mode: "both", friction: "required", ai: "socratic" },
    { due: 10, mode: "ai_chat_only", friction: "nudge", ai: "socratic" },
  ];
  plan.forEach((p, i) => {
    assignments.push({
      id: `${DEMO_PREFIX}a${i + 1}`, course_id: o.courseId, title: TOPICS[i].title,
      description: `Phân tích **${TOPICS[i].what}** trong một tình huống thực tế.\n\nYêu cầu: nêu ít nhất hai luận điểm, một phản biện, và kết luận của riêng em.`,
      rubric: "- Luận điểm rõ ràng (30%)\n- Phản biện và kiểm chứng (40%)\n- Diễn giải bằng lời của em (30%)",
      due_date: iso(o.now + p.due * DAY), attachments: [], submission_mode: p.mode, ai_submode: p.ai, allow_late: true,
      friction: p.friction, friction_prompts: ["Luận điểm cốt lõi của em về đề bài này là gì?", "Em định dùng dẫn chứng hoặc ví dụ nào?", "Điểm nào em còn băn khoăn hoặc chưa chắc?"],
      created_at: iso(o.now + (p.due - 6) * DAY), demo: true,
    });
  });

  // Existing seeded assignments of the course also get class-wide activity
  const targets = [
    ...o.existing.assignmentIds.map((id) => ({ id, due: null as number | null, topic: TOPICS[0], friction: "none", mode: "both", existing: true })),
    ...assignments.map((a, i) => ({ id: a.id, due: new Date(a.due_date).getTime(), topic: TOPICS[i], friction: a.friction, mode: a.submission_mode, existing: false })),
  ];

  const trend = (idx: number) => Math.min(8, idx * 1.5); // students slowly improve over the term
  let uid = 0;
  const mid = () => `${DEMO_PREFIX}m${++uid}`;

  targets.forEach((t, ti) => {
    const dueMs = t.due ?? o.now + 3 * DAY;
    const isFuture = dueMs > o.now;
    users.forEach((u, si) => {
      const persona = personas[si];
      if (o.existing.submissionKeys.has(`${t.id}:${u.id}`)) return;
      const partic = { indep: 0.96, mixed: 0.86, deleg: 0.78, absent: 0.3 }[persona] * (isFuture ? 0.72 : 1);
      if (rand() > partic) return;
      if (!members.some((m) => m.student_id === u.id)) return;

      const turns = persona === "indep" ? between(5, 9) : persona === "mixed" ? between(4, 7) : between(3, 4);
      const submittedAt = isFuture ? o.now - between(1, 20) * 3600 * 1000 : dueMs - between(2, 60) * 3600 * 1000 + (rand() < 0.12 ? between(20, 60) * 3600 * 1000 : 0);
      const startAt = submittedAt - turns * between(4, 9) * 60 * 1000 - 20 * 60 * 1000;
      const draft = isFuture && rand() < 0.22;
      const msgs: any[] = [];
      let clock = startAt;
      const tick = () => (clock += between(1, 5) * 60 * 1000 + between(0, 50) * 1000);
      const userMsgs: any[] = [];
      let intent: any = undefined;

      if (t.friction !== "none") {
        const skip = t.friction === "nudge" && (persona === "deleg" ? rand() < 0.7 : persona === "mixed" ? rand() < 0.15 : false);
        const conf = persona === "deleg" ? between(4, 5) : persona === "indep" ? between(3, 4) : between(2, 5);
        if (skip) intent = { answers: [], confidence: conf, skipped: true, at: iso(clock) };
        else {
          const answers = [
            { q: "Luận điểm cốt lõi của em về đề bài này là gì?", a: persona === "deleg" ? `Em nghĩ ${t.topic.what} là vấn đề quan trọng.` : `Luận điểm của em là ${t.topic.what} xuất phát từ cách dữ liệu và quy trình được thiết kế, chứ không chỉ do công nghệ.` },
            { q: "Em định dùng dẫn chứng hoặc ví dụ nào?", a: persona === "deleg" ? "Em chưa nghĩ ra." : "Em định dùng ví dụ về hệ thống lọc hồ sơ và một báo cáo kiểm toán thuật toán." },
          ];
          intent = { answers, confidence: conf, skipped: false, at: iso(clock), pasted_chars: persona === "deleg" && rand() < 0.3 ? 120 : undefined };
          const m = { id: mid(), role: "user", kind: "intent", timestamp: iso(clock), content: "**Ý ban đầu của em (trước khi hỏi AI)**\n\n" + answers.map((x) => `- ${x.q}\n  ${x.a}`).join("\n") };
          msgs.push(m); tick(); msgs.push({ id: mid(), role: "model", timestamp: iso(clock), content: pick(AI_REPLIES) });
        }
      }
      for (let k = 0; k < turns; k++) {
        let kind: "indep" | "curious" | "deleg";
        if (persona === "indep") kind = rand() < 0.65 ? "indep" : "curious";
        else if (persona === "mixed") kind = rand() < 0.4 ? "indep" : rand() < 0.7 ? "curious" : "deleg";
        else kind = rand() < 0.65 ? "deleg" : "curious";
        let text = (kind === "indep" ? pick(INDEPENDENT) : kind === "curious" ? pick(CURIOUS) : pick(DELEGATING)).replace("{x}", t.topic.what);
        let pasted = 0;
        if (kind === "deleg" && rand() < 0.6) { const blk = pick(PASTE_BLOCKS); text = `${text}\n\n${blk}`; pasted = blk.length; }
        else if (persona === "mixed" && rand() < 0.1) { const blk = pick(PASTE_BLOCKS); text = `${text} ${blk}`; pasted = blk.length; }
        tick();
        const m: any = { id: mid(), role: "user", timestamp: iso(clock), content: text, kind_demo: kind };
        if (pasted) m.pasted_chars = pasted;
        msgs.push(m); userMsgs.push(m); tick();
        msgs.push({ id: mid(), role: "model", timestamp: iso(clock), content: pick(AI_REPLIES) });
      }
      const chatId = `${DEMO_PREFIX}cs${chats.length + 1}`, subId = `${DEMO_PREFIX}sub${submissions.length + 1}`;
      const cleanMsgs = msgs.map(({ kind_demo, ...m }) => m);
      const chat: any = { id: chatId, assignment_id: t.id, student_id: u.id, submission_id: draft ? undefined : subId, messages: cleanMsgs, demo: true };
      if (intent) chat.intent = intent;
      chats.push(chat);

      const late = !isFuture && submittedAt > dueMs;
      const sub: any = {
        id: subId, assignment_id: t.id, student_id: u.id, student_name: u.name, student_email: u.email, student_avatar: "",
        submitted_files: [], submitted_text: draft ? "" : `Em tổng hợp lại: ${t.topic.what} cần được xem xét cả về dữ liệu lẫn quy trình ra quyết định.`,
        chat_session_id: chatId, status: draft ? "draft" : late ? "late" : "submitted", notes: "", demo: true,
      };
      if (!draft) sub.submitted_at = iso(submittedAt); else sub.draft_saved_at = iso(o.now - 3600 * 1000);
      if (draft) { submissions.push(sub); return; }

      // AI process score
      if (rand() < 0.04) { sub.eval_status = "failed"; sub.eval_error = "Mô hình AI quá tải, vui lòng chấm lại."; }
      else {
        const base = persona === "indep" ? between(80, 95) : persona === "mixed" ? between(60, 80) : persona === "deleg" ? between(28, 56) : between(40, 65);
        const sc = clamp(base + trend(ti) - (persona === "deleg" ? 0.5 * trend(ti) : 0), 8, 98);
        const c = (d: number) => clamp(Math.round(sc + d + between(-7, 7)), 5, 100);
        const hl: any[] = [];
        const take = (m: any, mau: string, why: string) => { const q = m.content.split("\n")[0].slice(0, 130).trim(); if (q.length >= 12 && !hl.some((h) => h.doan_van_ban === q)) hl.push({ doan_van_ban: q, mau, ly_do: why }); };
        userMsgs.forEach((m) => {
          const f = INDEPENDENT.some((s) => m.content.startsWith(s.replace("{x}", t.topic.what).slice(0, 25))), cu = CURIOUS.some((s) => m.content.startsWith(s.slice(0, 20))), de = DELEGATING.some((s) => m.content.startsWith(s.slice(0, 20)));
          if (f && hl.filter((h) => h.mau === "xanh").length < 2) take(m, "xanh", "Chất vấn giả định của AI và đưa ra lập luận riêng.");
          else if (cu && hl.filter((h) => h.mau === "vang").length < 1) take(m, "vang", "Tò mò, muốn làm rõ hoặc kiểm chứng thêm.");
          else if (de && hl.filter((h) => h.mau === "do").length < 1) take(m, "do", "Nhờ AI viết hộ hoặc xin đáp án trực tiếp.");
        });
        sub.process_score_result = {
          process_score: Math.round(sc),
          tieu_chi: { tu_duy_phan_bien: c(persona === "deleg" ? -10 : 2), dao_sau_van_de: c(0), kiem_chung_thong_tin: c(-4), noi_hoa_kien_thuc: c(persona === "indep" ? 4 : -2), tinh_chu_dong: c(persona === "deleg" ? -8 : 3) },
          noi_dung_ngoai_luong: null,
          nhan_xet_ngan: persona === "indep" ? SUMMARIES.indep : persona === "mixed" ? SUMMARIES.mixed : SUMMARIES.deleg,
          highlight_segments: hl,
        };
        sub.eval_status = "ok";
        // teacher grade for most older submissions
        if (!isFuture && rand() < 0.78) {
          sub.grade = Math.round(clamp(sc / 10 + (rand() - 0.5) * 1.6, 3, 10) * 2) / 2;
          sub.graded_at = iso(Math.min(o.now, submittedAt + between(3, 40) * 3600 * 1000));
          if (rand() < 0.5) sub.feedback = persona === "deleg" ? FEEDBACKS[between(3, 4)] : FEEDBACKS[between(0, 2)];
        }
      }
      submissions.push(sub);
    });
  });
  return { users, course_members: members, assignments, submissions, chat_sessions: chats };
}
