import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import {
  DEFAULT_L2_DIMENSIONS, L2_ERROR_TYPES, findPhraseRange, matchErrors, wordSimilarity, normWs,
  type L2Config, type L2Error, type L2Highlight, type L2Work, type L2ErrorReport, type L2Result,
} from "./src/lib/l2.ts";
import { generateDemoData, DEMO_PREFIX } from "./src/lib/demoData.ts";
import { isAnswerGate, makeTeaser, GATE_MIN_ANSWERS, GATE_MIN_CHARS, type GateInfo } from "./src/lib/gate.ts";
import { isPasteMode } from "./src/lib/paste.ts";
import { CRITERIA, buildProfile, memoryNote, cleanCoach, materialsBlock, MATERIAL_LIMITS, detectPressure, SOCRATIC_RULES, looksLikeFullAnswer, SOCRATIC_FALLBACK, agreement, spread, quoteIn, quoteInLoose, safeChallenge, ISSUE_TYPES, RESPONSE_TYPES, scrub, pickPassages, type IssueType, type ResponseType, type LearningProfile, type CoachNote } from "./src/lib/coach.ts";
import { stageConfig, cleanStages, computeStages, submitBlocker, stageBlocker, coThinkTurns, aysAnswered, LAB_LIMITS } from "./src/lib/stages.ts";
import { isFrictionLevel, cleanFrictionPrompts, FRICTION_MIN_ANSWERS, FRICTION_MIN_CHARS, type ChatIntent } from "./src/lib/friction.ts";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  checkSupabaseConnection,
  SUPABASE_SCHEMA_SQL,
  runAutoSetupSql,
  getSupabaseProjectRef
} from "./src/lib/supabase-service.ts";


// --- Auth helpers (scrypt password hashing + HMAC signed tokens) ---
const AUTH_SECRET = process.env.AUTH_SECRET || "trace-dev-secret-change-me";
if (!process.env.AUTH_SECRET) console.warn("[Auth] AUTH_SECRET is not set. Using an insecure development secret.");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash,gemini-flash-lite-latest").split(",").map((m) => m.trim()).filter(Boolean);

let mockRuns = 0;
/** Deterministic stand-in for Gemini, used only when AI_MOCK=1 so the wiring can be tested without a key. */
function mockAi(params: { contents: any; config?: any }): { text: string } {
  const sys = String(params.config?.systemInstruction || "");
  const last = String(params.contents?.[params.contents.length - 1]?.parts?.[0]?.text || "");
  if (params.config?.responseSchema?.properties?.criterion) {
    const mine = last.split("LƯỢT MỚI NHẤT CỦA SINH VIÊN:\n")[1] || last;
    const word = mine.split(" ").slice(0, 4).join(" ");
    return { text: JSON.stringify({ level: "weak", criterion: "kiem_chung_thong_tin", quote: /BỊA/.test(mine) ? "câu mà sinh viên chưa từng viết" : word, note: "Ý này chưa có dẫn chứng.", tip: "Hãy nêu một ví dụ cụ thể." }) };
  }
  const sch = params.config?.responseSchema?.properties || {};
  const mineOf = (k: string) => (last.split(k)[1] || last);
  if (sch.text && Object.keys(sch).length === 1) return { text: JSON.stringify({ text: "Học sinh nên được tự chọn môn học vì điều đó chắc chắn làm các em học tốt hơn. Mọi nghiên cứu đều cho thấy sự tự do luôn dẫn tới thành công, nên nhà trường không cần can thiệp nữa." }) };   // Lab: AI-written paragraph
  if (sch.mode) {   // Perspective Lab: classify the passage
    const sel = mineOf("ĐOẠN ĐƯỢC CHỌN:");
    return { text: JSON.stringify({ mode: /SU_KIEN/.test(sel) ? "su_kien" : /KHONG_RO/.test(sel) ? "khong_ro" : "tranh_luan", reason: "mock" }) };
  }
  if (sch.counterviews) {   // Perspective Lab: two other views; cites a class material only if the prompt shows one
    const src = (last.match(/\[(Giáo trình[^\]]*)\]/) || [])[1] || "";
    return { text: JSON.stringify({ counterviews: [{ stance: "Góc nhìn A", argument: "Lập luận A.", source_ref: src }, { stance: "Góc nhìn B", argument: "Lập luận B.", source_ref: "https://bia-dat.example/fake" }, { stance: "Thừa", argument: "x", source_ref: "" }] }) };
  }
  if (sch.claim_to_check) return { text: JSON.stringify({ claim_to_check: "Số liệu trong đoạn.", how_to_check: ["Tìm nguồn gốc số liệu.", "Đối chiếu một nguồn thứ hai."] }) };
  if (sch.issue_type && sch.question) {   // Are you sure?: challenge
    const mine = mineOf("LẬP TRƯỜNG HIỆN TẠI CỦA SINH VIÊN:");
    const none = /VUNG/.test(mine);
    return { text: JSON.stringify({ issue_type: none ? "none" : "unsupported_claim", question: /NGUON_SAI/.test(mine) ? "Nguồn của bạn là sai." : none ? "Lập luận của bạn khá vững. Nếu đổi bối cảnh thì nó còn đúng không?" : "Bạn dựa vào đâu để nói điều đó?", quote: /BIA/.test(mine) ? "câu chưa từng viết" : mine.trim().split(" ").slice(0, 4).join(" ") }) };
  }
  if (sch.response_type) {
    const ans = mineOf("CÂU TRẢ LỜI CỦA SINH VIÊN:");
    return { text: JSON.stringify({ response_type: /DODGE/.test(ans) ? "dodged" : /CONCEDE/.test(ans) ? "conceded_without_reason" : "held_with_reason", quote: ans.trim().split(" ").slice(0, 4).join(" ") }) };
  }
  if (params.config?.responseSchema?.properties?.process_score) {
    mockRuns += 1;   // varies a little between calls so the stability report has something to measure
    const base = 60 + (mockRuns % 3) * 2;
    // one real quote (from the transcript) and one invented quote, so the "quote must exist" rule can be tested
    const real = ((last.match(/Sinh viên: ([^\n]{12,})/) || [])[1] || "").slice(0, 30);
    return { text: JSON.stringify({ process_score: base, tieu_chi: { tu_duy_phan_bien: base, dao_sau_van_de: base, kiem_chung_thong_tin: base - 10, noi_hoa_kien_thuc: base, tinh_chu_dong: base }, noi_dung_ngoai_luong: "", nhan_xet_ngan: "mock", highlight_segments: [{ doan_van_ban: real || "không có", mau: "xanh", ly_do: "thật", stage: "co_think" }, { doan_van_ban: "một câu sinh viên chưa từng viết ra", mau: "xanh", ly_do: "bịa", stage: "perspective_lab" }] }) };
  }
  const piiFlag = /@|0912\s?345/.test(JSON.stringify(params.contents)) ? "LEAK" : "clean";
  const flags = [`pii=${piiFlag}`, `mem=${/TRÍ NHỚ VỀ SINH VIÊN/.test(sys) ? "yes" : "no"}`, `mat=${/TÀI LIỆU CỦA LỚP/.test(sys) ? "yes" : "no"}`, `rules=${/QUY TẮC BẤT BIẾN/.test(sys) ? "yes" : "no"}`, `retry=${/BẠN VỪA ĐƯA ĐÁP ÁN/.test(sys) ? "yes" : "no"}`];
  if (/MOCK_GIVEAWAY/.test(last) && !/BẠN VỪA ĐƯA ĐÁP ÁN/.test(sys)) return { text: `Đây là bài hoàn chỉnh cho bạn, chép lại là xong. ${flags.join(" ")}` };
  if (/MOCK_STUBBORN/.test(last)) return { text: `Đây là toàn bộ lời giải, không có câu hỏi nào cả. ${flags.join(" ")}` };
  return { text: `Bạn nghĩ sao về điều đó? [${flags.join(" ")}]` };
}

/** Calls Gemini, retrying overloaded/rate-limited responses and falling back to other models. */
async function generateWithFallback(params: { contents: any; config?: any }, timeoutMs = 30000) {
  if (process.env.AI_MOCK === "1") return Object.assign(mockAi(params), { __model: "mock" });   // offline tests only: never set in production
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACKS.filter((m) => m !== GEMINI_MODEL)];
  let lastErr: any;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out: any = await Promise.race([
          getGenAI().models.generateContent({ model, ...params }),
          new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error(`Model ${model} không phản hồi trong ${timeoutMs / 1000}s`), { code: 503 })), timeoutMs)),
        ]);
        try { out.__model = model; } catch { /* response objects may be frozen */ }
        return out;
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err);
        const code = Number(err?.status || err?.code || (msg.match(/"code":\s*(\d+)/) || [])[1]);
        if (code === 503 || code === 429 || code === 500) { await new Promise((r) => setTimeout(r, 700 * (attempt + 1))); continue; }
        if (code === 404) break; // model unavailable for this key -> try next model
        throw err; // auth / bad request: no point retrying
      }
    }
  }
  throw lastErr;
}

function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString("hex")}`;
}
function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = crypto.scryptSync(pw, salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function signToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function readToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data.uid : null;
  } catch { return null; }
}
function requireAuth(req: any, res: express.Response, next: express.NextFunction) {
  const header = String(req.headers.authorization || "");
  const uid = header.startsWith("Bearer ") ? readToken(header.slice(7)) : null;
  const user = uid ? db.users.find((u: any) => u.id === uid) : null;
  if (!user) return res.status(401).json({ success: false, message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại." });
  if (user.active === false) return res.status(401).json({ success: false, message: "Tài khoản đã bị vô hiệu hóa." });
  if (!user.last_seen || Date.now() - new Date(user.last_seen).getTime() > 5 * 60 * 1000) { user.last_seen = new Date().toISOString(); saveDocument("users", user.id, user); }
  req.user = user;
  next();
}

// Never let a background gRPC/credential failure take the whole server down
process.on("unhandledRejection", (reason: any) => {
  console.warn("[Server] Unhandled rejection ignored:", reason?.message || reason);
});

const _dirname = typeof __dirname !== "undefined" ? __dirname : process.cwd();

let firestoreDb: FirebaseFirestore.Firestore | null = null;

// Lazy initialization for Gemini SDK server-side
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const aiKey = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({
      apiKey: aiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Mock Initial DB Setup in memory with file backup
interface DB {
  users: Array<{ id: string; name: string; email: string; role: 'teacher' | 'student' | 'admin'; avatar: string; pwd?: string; active?: boolean; last_seen?: string; profile_share?: { token: string; include_quotes: boolean; created_at: string }; consent_at?: string }>;
  courses: Array<any>;
  course_members: Array<any>;
  assignments: Array<any>;
  submissions: Array<any>;
  chat_sessions: Array<any>;
  lab_sessions: Array<any>;
  notifications: Array<any>;
  audit_logs: Array<any>;
  settings: any;
}

const DEFAULT_SETTINGS = {
  allow_registration: true,
  teacher_self_register: true,
  permissions: {
    teacher: { create_course: true, manage_assignments: true, grade: true, manage_members: true },
    student: { join_course: true, use_ai_chat: true, submit: true },
  } as Record<string, Record<string, boolean>>,
};

const initialDb: DB = {
  lab_sessions: [],
  notifications: [],
  audit_logs: [],
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  users: [
    {
      id: "u_admin_1",
      name: "Quản trị viên Trace Edu",
      email: "admin@trace.edu.vn",
      role: "admin",
      avatar: "",
    },
    {
      id: "u_teacher_1",
      name: "TS. Nguyễn Văn Hùng",
      email: "hung.nguyen@edu.vn",
      role: "teacher",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "u_student_1",
      name: "Lã Uyển Nhi",
      email: "la.uyennhi@student.edu.vn",
      role: "student",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "u_student_2",
      name: "Phạm Quốc Bảo",
      email: "quocbao.pham@student.edu.vn",
      role: "student",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    }
  ],
  courses: [
    {
      id: "c_1",
      name: "Lập Trình & Tư Duy AI",
      code: "CS101",
      teacher_id: "u_teacher_1",
      teacher_name: "TS. Nguyễn Văn Hùng",
      semester: "Học kỳ I (2025-2026)",
      description: "Học cách đặt câu hỏi, phân tích giải thuật và phản biện cùng Trợ lý AI để làm chủ tri thức.",
      invite_code: "AI2025",
      accent_color: "from-indigo-500 to-violet-600",
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: "c_2",
      name: "Đạo Đức AI & Xã Hội",
      code: "ETH201",
      teacher_id: "u_teacher_1",
      teacher_name: "TS. Nguyễn Văn Hùng",
      semester: "Học kỳ I (2025-2026)",
      description: "Đánh giá tác động của AI trong đời sống, hiện tượng thiên vị dữ liệu và xây dựng giải pháp trách nhiệm.",
      invite_code: "ETH999",
      accent_color: "from-sky-500 to-blue-600",
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: "c_3",
      name: "Lập Trình Web Modern",
      code: "WEB301",
      teacher_id: "u_teacher_1",
      teacher_name: "TS. Nguyễn Văn Hùng",
      semester: "Học kỳ I (2025-2026)",
      description: "Xây dựng ứng dụng Web Full-stack với React, Express, REST API và tích hợp mô hình ngôn ngữ lớn.",
      invite_code: "WEB2025",
      accent_color: "from-emerald-500 to-teal-600",
      created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    }
  ],
  course_members: [
    { course_id: "c_1", student_id: "u_student_1", student_name: "Lã Uyển Nhi", student_email: "la.uyennhi@student.edu.vn", joined_at: new Date().toISOString() },
    { course_id: "c_1", student_id: "u_student_2", student_name: "Phạm Quốc Bảo", student_email: "quocbao.pham@student.edu.vn", joined_at: new Date().toISOString() },
    { course_id: "c_2", student_id: "u_student_1", student_name: "Lã Uyển Nhi", student_email: "la.uyennhi@student.edu.vn", joined_at: new Date().toISOString() },
    { course_id: "c_3", student_id: "u_student_1", student_name: "Lã Uyển Nhi", student_email: "la.uyennhi@student.edu.vn", joined_at: new Date().toISOString() },
  ],
  assignments: [
    {
      id: "a_1",
      course_id: "c_1",
      title: "Bài tập 1: Phân Tích Đạo Đức AI trong Lọc CV Tuyển Dụng",
      description: `Yêu cầu đơn giản & trọng tâm:
1. Phân tích nguyên nhân khiến thuật toán AI lọc hồ sơ bị thiên vị giới tính.
2. Trao đổi với Trợ lý AI ở Chế độ Socratic để tranh luận hai chỉ số: Demographic Parity vs Equalized Odds.
3. Rút ra kết luận và tự tổng hợp góc nhìn của cá nhân.`,
      rubric: `- Tư duy phản biện (30%): Thách thức giả định của mô hình AI
- Đào sâu vấn đề (25%): Đặt câu hỏi truy xuất căn nguyên
- Kiểm chứng thông tin (20%): Đối chiếu khái niệm học thuật
- Tự diễn giải (15%): Trình bày bằng ngôn từ cá nhân
- Tính chủ động (10%): Mở rộng câu hỏi nghiên cứu`,
      due_date: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      attachments: [
        { id: "f1", name: "De_bai_Dao_duc_AI_2025.pdf", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", size: "1.2 MB", type: "pdf" }
      ],
      submission_mode: "both",
      ai_submode: "socratic",
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: "a_2",
      course_id: "c_1",
      title: "Bài tập 2: Tối Ưu Hàm Mất Mát (Loss Function) trong Mạng Nơ-ron",
      description: "So sánh Cross-Entropy Loss và MSE cho bài toán Phân loại. Giải thích hiện tượng Triệt tiêu Đạo hàm (Vanishing Gradient).",
      rubric: "Hiểu bản chất toán học 50%, Giải thích rõ ràng 50%",
      due_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      attachments: [],
      submission_mode: "ai_chat_only",
      ai_submode: "socratic",
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: "a_3",
      course_id: "c_2",
      title: "Đồ án Giữa kỳ: Thiết Kế Bộ Tiêu Chí Đánh Giá AI Trách Nhiệm",
      description: "Xây dựng khung tiêu chí 5 bước đánh giá sản phẩm AI trong giáo dục.",
      rubric: "Tính ứng dụng 40%, Khả thi 30%, Báo cáo 30%",
      due_date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      attachments: [],
      submission_mode: "file_only",
      ai_submode: "normal",
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    }
  ],
  submissions: [
    {
      id: "sub_1",
      assignment_id: "a_1",
      student_id: "u_student_1",
      student_name: "Lã Uyển Nhi",
      student_email: "la.uyennhi@student.edu.vn",
      student_avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      submitted_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      submitted_files: [
        { id: "f2", name: "Bai_Nop_UyenNhi_DaoDucAI.pdf", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", size: "850 KB", type: "pdf" }
      ],
      submitted_text: "Em chỉ ra nguyên nhân thiên vị là do tập dữ liệu huấn luyện lịch sử 10 năm trước có tỷ lệ nam giới vượt trội. Để xử lý, em chọn Equalized Odds vì nó đảm bảo tỷ lệ Dương tính Giả (FPR) công bằng giữa các nhóm.",
      chat_session_id: "cs_1",
      status: "submitted",
      process_score_result: {
        process_score: 92,
        tieu_chi: {
          tu_duy_phan_bien: 90,
          dao_sau_van_de: 95,
          kiem_chung_thong_tin: 88,
          noi_hoa_kien_thuc: 92,
          tinh_chu_dong: 95
        },
        noi_dung_ngoai_luong: null,
        nhan_xet_ngan: "Sinh viên thể hiện tư duy phản biện xuất sắc, không chép đáp án có sẵn mà chủ động đặt câu hỏi so sánh giữa Demographic Parity và Equalized Odds.",
        highlight_segments: [
          {
            doan_van_ban: "Tại sao Demographic Parity lại có thể gây thiệt thòi cho ứng viên xuất sắc nếu tỷ lệ nền không đồng đều?",
            mau: "xanh",
            ly_do: "Câu hỏi phản biện sắc bén, xoáy sâu vào toán học của chỉ số công bằng."
          },
          {
            doan_van_ban: "Cho mình xin công thức tóm tắt để áp dụng luôn được không?",
            mau: "vang",
            ly_do: "Muốn lấy công thức nhanh nhưng ngay sau đó đã tự suy luận áp dụng."
          }
        ]
      }
    },
    {
      id: "sub_2",
      assignment_id: "a_2",
      student_id: "u_student_1",
      student_name: "Lã Uyển Nhi",
      student_email: "la.uyennhi@student.edu.vn",
      student_avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      submitted_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      submitted_files: [],
      submitted_text: `| Tiêu chí | Mean Squared Error (MSE) | Cross-Entropy Loss |
|---|---|---|
| **Mục đích sử dụng chính** | Dành cho bài toán **Hồi quy** (Regression - dự đoán số thực liên tục như giá nhà, nhiệt độ). | Dành cho bài toán **Phân loại** (Classification - dự đoán xác suất thuộc về lớp nào). |
| **Dạng bề mặt tối ưu (Loss Landscape)** | Khi kết hợp với hàm Sigmoid/Softmax, hàm MSE tạo ra bề mặt **Phi lồi (Non-convex)** $\\rightarrow$ Có nhiều cực trị địa phương (Local Minima), khiến thuật toán dễ bị "kẹt", khó tìm ra đáp án tốt nhất. | Tạo ra bề mặt **Lồi (Convex)** khi kết hợp với Sigmoid/Softmax $\\rightarrow$ Có duy nhất một điểm cực tiểu toàn cục (Global Minimum), giúp thuật toán Gradient Descent dễ dàng hội tụ. |
| **Tốc độ học khi đoán SAI nặng** | **Rất chậm**: Do đạo hàm của Sigmoid bị triệt tiêu ở các vùng biên, làm Gradient tiến về 0 khiến mô hình gần như "ngừng học". | **Rất nhanh**: Đạo hàm của Cross-Entropy tỉ lệ thuận trực tiếp với độ sai lệch $(p - y)$. Mô hình đoán càng sai thì bị "phạt" càng nặng và học càng nhanh. |

---

## 2. Giải thích hiện tượng Triệt tiêu Đạo hàm (Vanishing Gradient)

### a. Khái niệm:
Hiện tượng các tầng sâu trong mạng nơ-ron học rất chậm hoặc ngừng cập nhật trọng số do đạo hàm lan truyền ngược bị suy giảm dần về 0.

### b. Nguyên nhân (Gắn với hàm kích hoạt Sigmoid):
1. **Đặc điểm hàm Sigmoid**: Công thức $\\sigma(z) = \\frac{1}{1 + e^{-z}}$. Đồ thị hàm Sigmoid có dạng đường cong chữ S, bị nén trong khoảng $(0, 1)$.
2. **Đạo hàm của Sigmoid**: $\\sigma'(z) = \\sigma(z)(1 - \\sigma(z))$.
   * Giá trị lớn nhất của đạo hàm này chỉ là **0.25** (khi $z = 0$).
   * Khi $|z|$ rất lớn (vùng mô hình rất tự tin hoặc đoán sai nghiêm trọng), đồ thị nằm ngang và đạo hàm $\\sigma'(z)$ **sẽ bằng 0**.
3. **Quy tắc chuỗi (Chain Rule)**: Khi lan truyền ngược qua $L$ tầng ẩn, Gradient tại tầng đầu tiên bị nhân liên tiếp bởi $L$ số nhỏ hơn hoặc bằng 0.25:
$$\\frac{\\partial L}{\\partial w_1} = \\frac{\\partial L}{\\partial a_L} \\cdot \\prod_{i=1}^{L} \\sigma'(z_i) W_i$$
Kết quả là Gradient triệt tiêu gần như bằng 0, khiến mạng không thể học được các đặc trưng trừu tượng ở các tầng đầu.`,
      chat_session_id: "cs_2",
      status: "submitted",
      process_score_result: {
        process_score: 95,
        tieu_chi: {
          tu_duy_phan_bien: 95,
          dao_sau_van_de: 98,
          kiem_chung_thong_tin: 92,
          noi_hoa_kien_thuc: 96,
          tinh_chu_dong: 94
        },
        noi_dung_ngoai_luong: null,
        nhan_xet_ngan: "Sinh viên nắm vững bản chất toán học của các hàm mất mát và hiện tượng suy giảm đạo hàm. Tự xây dựng bảng so sánh trực quan và phân tích công thức chuỗi lan truyền ngược rất thuyết phục.",
        highlight_segments: [
          {
            doan_van_ban: "Tại sao khi kết hợp với Sigmoid, hàm MSE lại tạo ra bề mặt phi lồi (Non-convex) trong khi Cross-Entropy lại lồi?",
            mau: "xanh",
            ly_do: "Câu hỏi đào sâu vào bản chất hình học tối ưu hóa của Loss Landscape."
          },
          {
            doan_van_ban: "sẽ bằng 0",
            mau: "vang",
            ly_do: "Tò mò / Yêu cầu giải đáp về đạo hàm tại vùng biên bão hòa của Sigmoid."
          },
          {
            doan_van_ban: "trả lời cho tôi nộp bài",
            mau: "do",
            ly_do: "Nguy cơ dùng AI làm hộ / chép nguyên văn nếu yêu cầu AI giải toàn bộ mà không tự tư duy."
          }
        ]
      }
    }
  ],
  chat_sessions: [
    {
      id: "cs_1",
      assignment_id: "a_1",
      student_id: "u_student_1",
      submission_id: "sub_1",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Chào bạn, mình đang phân tích case AI tuyển dụng. Tại sao mô hình lọc CV lại tự động bị thiên vị giới tính?",
          timestamp: new Date(Date.now() - 1000000).toISOString()
        },
        {
          id: "m2",
          role: "model",
          content: "Chào Uyển Nhi! Đây là bài toán Data Bias điển hình. Theo bạn, nếu tập dữ liệu huấn luyện trong 10 năm trước hầu hết là hồ sơ nam giới, AI sẽ học được quy luật gì?",
          timestamp: new Date(Date.now() - 980000).toISOString()
        },
        {
          id: "m3",
          role: "user",
          content: "Nó sẽ hiểu nhầm rằng nam giới có tỷ lệ thành công cao hơn! Nhưng tại sao Demographic Parity lại có thể gây thiệt thòi cho ứng viên xuất sắc nếu tỷ lệ nền không đồng đều?",
          timestamp: new Date(Date.now() - 950000).toISOString()
        },
        {
          id: "m4",
          role: "model",
          content: "Phản biện rất chính xác! Demographic Parity buộc tỷ lệ trúng tuyển ngang nhau bất kể năng lực nền. Vì vậy chỉ số Equalized Odds được ưu tiên hơn. Bạn suy nghĩ thế nào về hướng giải quyết này?",
          timestamp: new Date(Date.now() - 900000).toISOString()
        }
      ]
    },
    {
      id: "cs_2",
      assignment_id: "a_2",
      student_id: "u_student_1",
      submission_id: "sub_2",
      messages: [
        {
          id: "m2_1",
          role: "user",
          content: "Chào Trợ lý, mình đang làm bài tập 2 về so sánh MSE và Cross-Entropy. Tại sao bài toán phân loại lại không dùng MSE?",
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: "m2_2",
          role: "model",
          content: "Chào bạn! Để trả lời câu hỏi này, hãy thử xem xét điều gì xảy ra với hàm mất mát MSE khi kết hợp với hàm kích hoạt Sigmoid $\\sigma(z) = \\frac{1}{1 + e^{-z}}$ lúc mô hình dự đoán hoàn toàn sai (ví dụ nhãn $y=1$ nhưng dự đoán $p=0$). Đạo hàm lúc đó sẽ như thế nào?",
          timestamp: new Date(Date.now() - 3500000).toISOString()
        },
        {
          id: "m2_3",
          role: "user",
          content: "Đạo hàm của Sigmoid là $\\sigma'(z) = \\sigma(z)(1 - \\sigma(z))$. Khi dự đoán sai nặng ($z \\rightarrow -\\infty$), $\\sigma(z) \\rightarrow 0$, nên đạo hàm $\\sigma'(z)$ sẽ bằng 0! Gradient biến mất khiến mô hình không học được!",
          timestamp: new Date(Date.now() - 3400000).toISOString()
        },
        {
          id: "m2_4",
          role: "model",
          content: "Tuyệt vời! Hiện tượng đó liên quan mật thiết đến Vanishing Gradient. Còn với Cross-Entropy Loss $L = -y \\ln(p) - (1-y)\\ln(1-p)$, đạo hàm theo $z$ sẽ rút gọn thành gì?",
          timestamp: new Date(Date.now() - 3300000).toISOString()
        },
        {
          id: "m2_5",
          role: "user",
          content: "Đạo hàm rút gọn thành $\\frac{\\partial L}{\\partial z} = p - y$. Khi đoán càng sai, độ chênh lệch $(p - y)$ càng lớn, Gradient càng mạnh giúp cập nhật trọng số nhanh chóng!",
          timestamp: new Date(Date.now() - 3200000).toISOString()
        }
      ]
    }
  ]
};

// Demo accounts (password: 123456)
for (const u of initialDb.users) u.pwd = hashPassword("123456");

/** Appends the large fake data set (ids "demo_*") to a db-shaped object. Returns the counts, or null if already present. */
function appendDemoData(target: any, now = Date.now()) {
  if (target.users.some((u: any) => String(u.id).startsWith(DEMO_PREFIX))) return null;
  const courseId = "c_1";
  const d = generateDemoData({
    hash: hashPassword("123456"), now, teacherId: "u_teacher_1", courseId,
    existing: {
      assignmentIds: target.assignments.filter((a: any) => a.course_id === courseId && a.submission_mode !== "file_only" && a.submission_mode !== "writing_l2").map((a: any) => a.id),
      submissionKeys: new Set(target.submissions.map((x: any) => `${x.assignment_id}:${x.student_id}`)),
    },
  });
  target.users.push(...d.users); target.course_members.push(...d.course_members); target.assignments.unshift(...d.assignments);
  target.submissions.push(...d.submissions); target.chat_sessions.push(...d.chat_sessions);
  return d;
}
// Large demo data set is on by default in demo mode; set SEED_DEMO_SCALE=small to keep only the 3 original accounts.
if (process.env.SEED_DEMO_SCALE !== "small") appendDemoData(initialDb);

let db: DB = JSON.parse(JSON.stringify(initialDb));
function ensureSeedCredentials() {
  for (const seed of initialDb.users as any[]) {
    const u = db.users.find((x: any) => x.id === seed.id);
    if (u && !u.pwd) u.pwd = seed.pwd;
    if (!u && seed.role === "admin") db.users.push(JSON.parse(JSON.stringify(seed)));
  }
  db.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}), permissions: { ...DEFAULT_SETTINGS.permissions, ...((db.settings || {}).permissions || {}) } };
}

async function initFirestore() {
  try {
    const configPath = path.join(_dirname, "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (!getApps().length) {
        initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
      const dbId = firebaseConfig.firestoreDatabaseId || undefined;
      const testDb = getFirestore(dbId);

      // Verify if Cloud Firestore API is actually enabled & accessible in this GCP project
      try {
        await Promise.race([
          testDb.collection("users").limit(1).get(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("Firestore check timed out")), 6000)),
        ]);
        firestoreDb = testDb;
        console.log(`[Firestore] Connected successfully with database: ${dbId || 'default'}`);
        await loadFromFirestore();
      } catch (checkErr: any) {
        firestoreDb = null;
        const msg = checkErr.message || "";
        if (msg.includes("PERMISSION_DENIED") || msg.includes("has not been used") || msg.includes("7")) {
          console.log("[Firestore] Cloud Firestore API is not enabled in this GCP project. Using in-memory state & Supabase.");
        } else {
          console.log("[Firestore] Connection check failed, using in-memory state & Supabase:", msg);
        }
      }
    } else {
      console.log("[Firestore] Config file not found, running with in-memory store.");
    }
  } catch (err) {
    firestoreDb = null;
    console.log("[Firestore] Initialization skipped, using in-memory state & Supabase.");
  }
}

async function loadFromFirestore() {
  if (!firestoreDb) return;
  try {
    // 1. Users
    const usersSnap = await firestoreDb.collection("users").get();
    if (!usersSnap.empty) {
      db.users = usersSnap.docs.map((doc) => doc.data() as any);
    } else {
      for (const u of initialDb.users) {
        await firestoreDb.collection("users").doc(u.id).set(u);
      }
    }

    // 2. Courses
    const coursesSnap = await firestoreDb.collection("courses").get();
    if (!coursesSnap.empty) {
      db.courses = coursesSnap.docs.map((doc) => doc.data() as any);
    } else {
      for (const c of initialDb.courses) {
        await firestoreDb.collection("courses").doc(c.id).set(c);
      }
    }

    // 3. Course Members
    const membersSnap = await firestoreDb.collection("course_members").get();
    if (!membersSnap.empty) {
      db.course_members = membersSnap.docs.map((doc) => doc.data() as any);
    } else {
      for (const m of initialDb.course_members) {
        const id = `${m.course_id}_${m.student_id}`;
        await firestoreDb.collection("course_members").doc(id).set(m);
      }
    }

    // 4. Assignments
    const assignmentsSnap = await firestoreDb.collection("assignments").get();
    if (!assignmentsSnap.empty) {
      db.assignments = assignmentsSnap.docs.map((doc) => doc.data() as any);
    } else {
      for (const a of initialDb.assignments) {
        await firestoreDb.collection("assignments").doc(a.id).set(a);
      }
    }

    // 5. Submissions
    const subsSnap = await firestoreDb.collection("submissions").get();
    if (!subsSnap.empty) {
      db.submissions = subsSnap.docs.map((doc) => doc.data() as any);
      for (const s of initialDb.submissions) {
        if (!db.submissions.some((item) => item.id === s.id)) {
          await firestoreDb.collection("submissions").doc(s.id).set(s);
          db.submissions.push(s);
        }
      }
    } else {
      for (const s of initialDb.submissions) {
        await firestoreDb.collection("submissions").doc(s.id).set(s);
      }
      db.submissions = [...initialDb.submissions];
    }

    // 6. Chat Sessions
    const chatSnap = await firestoreDb.collection("chat_sessions").get();
    if (!chatSnap.empty) {
      db.chat_sessions = chatSnap.docs.map((doc) => doc.data() as any);
      for (const cs of initialDb.chat_sessions) {
        if (!db.chat_sessions.some((item) => item.id === cs.id)) {
          await firestoreDb.collection("chat_sessions").doc(cs.id).set(cs);
          db.chat_sessions.push(cs);
        }
      }
    } else {
      for (const cs of initialDb.chat_sessions) {
        await firestoreDb.collection("chat_sessions").doc(cs.id).set(cs);
      }
      db.chat_sessions = [...initialDb.chat_sessions];
    }

    const notifSnap = await firestoreDb.collection("notifications").get();
    db.notifications = notifSnap.docs.map((doc) => doc.data() as any);
    const settingsDoc = await firestoreDb.collection("settings").doc("global").get();
    if (settingsDoc.exists) db.settings = settingsDoc.data() as any;
    const auditSnap = await firestoreDb.collection("audit_logs").orderBy("created_at", "desc").limit(300).get();
    db.audit_logs = auditSnap.docs.map((doc) => doc.data() as any);
    ensureSeedCredentials();
    console.log("[Firestore] Collections synchronized and loaded into memory.");
  } catch (err: any) {
    firestoreDb = null;
    console.log("[Firestore] Firestore load skipped:", err.message || err);
  }
}

// ---------------------------------------------------------------------------
// Persistence. Source of truth = Supabase table `documents` (when configured);
// Firestore stays an optional mirror. Every record is one JSON row, keyed by
// (collection, id). Deletions are soft ("tombstones") so other server instances
// can pick them up. All writes issued during a request are awaited before the
// response is sent, because serverless platforms freeze the process afterwards.
// ---------------------------------------------------------------------------
const reqStore = new AsyncLocalStorage<{ pending: Promise<any>[] }>();
const track = <T,>(p: Promise<T>): Promise<T> => { reqStore.getStore()?.pending.push(p.catch(() => {})); return p; };

const DOC_COLLECTIONS = ["users", "courses", "course_members", "assignments", "submissions", "chat_sessions", "lab_sessions", "notifications", "audit_logs"] as const;
const docKey = (collection: string, d: any) => (collection === "course_members" ? `${d.course_id}_${d.student_id}` : d.id);

async function saveDocumentInner(collectionName: string, docId: string, data: any) {
  const snapshot = JSON.parse(JSON.stringify(data)); // freeze the value now; the caller may keep mutating it
  const supabase = getSupabaseClient();
  const writes: Promise<any>[] = [];

  if (supabase) {
    writes.push((async () => {
      try {
        const { error } = await supabase.from("documents").upsert({ collection: collectionName, id: docId, data: snapshot, deleted: false }, { onConflict: "collection,id" });
        if (error) console.warn(`[Supabase] Save ${collectionName}/${docId} failed:`, error.message);
      } catch (err: any) { console.error(`[Supabase] Error saving ${collectionName}/${docId}:`, err?.message || err); }
    })());
  }
  if (firestoreDb) {
    writes.push((async () => {
      try {
        await firestoreDb!.collection(collectionName).doc(docId).set(snapshot, { merge: true });
      } catch (err: any) {
        const msg = err.message || "";
        if (msg.includes("PERMISSION_DENIED") || msg.includes("has not been used") || msg.includes("7")) firestoreDb = null;
        console.warn(`[Firestore] Unable to save to ${collectionName}/${docId}:`, msg);
      }
    })());
  }
  await Promise.all(writes);
}
const saveDocument = (collectionName: string, docId: string, data: any) => track(saveDocumentInner(collectionName, docId, data));

async function deleteDocumentInner(collectionName: string, docId: string) {
  const supabase = getSupabaseClient();
  const writes: Promise<any>[] = [];
  if (supabase) {
    writes.push((async () => {
      try {
        const { error } = await supabase.from("documents").upsert({ collection: collectionName, id: docId, data: {}, deleted: true }, { onConflict: "collection,id" });
        if (error) console.warn(`[Supabase] Delete ${collectionName}/${docId} failed:`, error.message);
      } catch (err: any) { console.error(`[Supabase] Error deleting ${collectionName}/${docId}:`, err?.message || err); }
    })());
  }
  if (firestoreDb) {
    writes.push((async () => {
      try {
        await firestoreDb!.collection(collectionName).doc(docId).delete();
      } catch (err: any) {
        const msg = err.message || "";
        if (msg.includes("PERMISSION_DENIED") || msg.includes("has not been used") || msg.includes("7")) firestoreDb = null;
        console.warn(`[Firestore] Unable to delete from ${collectionName}/${docId}:`, msg);
      }
    })());
  }
  await Promise.all(writes);
}
const deleteDocument = (collectionName: string, docId: string) => track(deleteDocumentInner(collectionName, docId));

// ---- Supabase -> memory sync ----
let syncCursor = 0;            // newest updated_at (ms) seen so far
let lastRefresh = 0;
let initialLoad: Promise<void> | null = null;
let supabaseLoaded = false;
let refreshing: Promise<void> | null = null;

function emptyDb(): DB {
  return { users: [], courses: [], course_members: [], assignments: [], submissions: [], chat_sessions: [], lab_sessions: [], notifications: [], audit_logs: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) };
}

function applyRow(row: { collection: string; id: string; data: any; deleted: boolean }) {
  if (row.collection === "settings") { if (!row.deleted) db.settings = row.data; return; }
  const arr = (db as any)[row.collection] as any[] | undefined;
  if (!arr) return;
  const idx = arr.findIndex((x) => docKey(row.collection, x) === row.id);
  if (row.deleted) { if (idx >= 0) arr.splice(idx, 1); return; }
  const incoming = row.data || {};
  if (idx >= 0) {
    const cur = arr[idx];
    // last_seen is refreshed in memory more often than it is saved: never move it backwards
    if (row.collection === "users" && cur.last_seen && (!incoming.last_seen || cur.last_seen > incoming.last_seen)) incoming.last_seen = cur.last_seen;
    for (const k of Object.keys(cur)) delete cur[k]; // mutate in place so existing references stay valid
    Object.assign(cur, incoming);
  } else {
    arr.push(incoming);
  }
}

async function pullFromSupabase(full = false) {
  const sb = getSupabaseClient();
  if (!sb) return;
  const since = full || !syncCursor ? null : new Date(syncCursor - 3000).toISOString(); // small overlap; applying a row twice is harmless
  const page = 1000;
  let from = 0;
  let maxTs = syncCursor;
  for (;;) {
    let q = sb.from("documents").select("collection,id,data,deleted,updated_at").order("updated_at", { ascending: true }).order("collection").order("id").range(from, from + page - 1);
    if (since) q = q.gte("updated_at", since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const r of data || []) {
      applyRow(r as any);
      const t = Date.parse((r as any).updated_at);
      if (t > maxTs) maxTs = t;
    }
    if (!data || data.length < page) break;
    from += page;
  }
  syncCursor = maxTs;
}

async function pushAllToSupabase(): Promise<Record<string, number>> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Chưa cấu hình Supabase.");
  const rows: any[] = [];
  const counts: Record<string, number> = {};
  for (const c of DOC_COLLECTIONS) {
    const list = ((db as any)[c] as any[]) || [];
    counts[c] = list.length;
    for (const d of list) rows.push({ collection: c, id: docKey(c, d), data: JSON.parse(JSON.stringify(d)), deleted: false });
  }
  rows.push({ collection: "settings", id: "global", data: JSON.parse(JSON.stringify(db.settings)), deleted: false });
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await sb.from("documents").upsert(rows.slice(i, i + 100), { onConflict: "collection,id" });
    if (error) throw new Error(error.message);
  }
  return counts;
}

async function seedIfEmpty() {
  if (db.users.length > 0) return;
  const demo = process.env.SEED_DEMO_DATA !== "false";
  const seed: DB = JSON.parse(JSON.stringify(initialDb));
  const admin = seed.users.find((u) => u.role === "admin")!;
  if (process.env.ADMIN_PASSWORD) admin.pwd = hashPassword(process.env.ADMIN_PASSWORD);
  db.users = demo ? seed.users : [admin];
  if (demo) {
    db.courses = seed.courses; db.course_members = seed.course_members; db.assignments = seed.assignments;
    db.submissions = seed.submissions; db.chat_sessions = seed.chat_sessions;
  }
  await pushAllToSupabase();
  console.log(`[Supabase] Database was empty: seeded ${demo ? "demo data" : "admin account only"}.`);
}

async function loadFromSupabase() {
  db = emptyDb();           // never mix leftover demo data with what is really stored
  syncCursor = 0;
  await pullFromSupabase(true);
  await seedIfEmpty();
  ensureSeedCredentials();
  supabaseLoaded = true;
  lastRefresh = Date.now();
  console.log(`[Supabase] Loaded ${db.users.length} users, ${db.courses.length} courses, ${db.submissions.length} submissions.`);
}

/** A token or login for an account this instance has not seen yet usually means it was created on another instance. */
function needsFreshData(req: express.Request): boolean {
  const header = String(req.headers.authorization || "");
  if (header.startsWith("Bearer ")) {
    const uid = readToken(header.slice(7));
    if (uid && !db.users.some((u: any) => u.id === uid)) return true;
  }
  if (req.path === "/auth/login" && req.body?.email) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!db.users.some((u: any) => u.email.toLowerCase() === email)) return true;
  }
  return false;
}

/** Runs before every API request: wait for the first load, then refresh changes made by other instances. */
async function syncMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isSupabaseConfigured()) return next();
  try {
    if (!supabaseLoaded) {
      if (!initialLoad) initialLoad = loadFromSupabase().finally(() => { if (!supabaseLoaded) initialLoad = null; });
      await initialLoad;
    } else if (needsFreshData(req) || Date.now() - lastRefresh > 1500) {
      if (!refreshing) refreshing = pullFromSupabase().catch((e) => console.warn("[Supabase] Refresh failed:", e.message)).finally(() => { lastRefresh = Date.now(); refreshing = null; });
      await refreshing;
    }
  } catch (e: any) {
    const reason = String(e?.cause?.message || e?.message || e).slice(0, 200);
    console.error("[Supabase] Load failed:", reason);
    return res.status(503).json({ success: false, message: `Không kết nối được cơ sở dữ liệu: ${reason}` });
  }
  next();
}


// Utility helper to generate 6-character random invite codes
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

// Safe diagnostics (never returns secrets): is Supabase reachable and is the table there?

// Public, read-only thinking profile. Reachable only with the random token the student created, and revocable by them.
app.get("/api/public/profile/:token", (req, res) => {
  const token = String(req.params.token || "");
  const user = token.length >= 16 ? db.users.find((u: any) => u.profile_share?.token === token && u.active !== false) : null;
  if (!user) return fail(res, 404, "Liên kết hồ sơ không tồn tại hoặc đã bị thu hồi.");
  const d = studentProfileData(user.id, !!user.profile_share.include_quotes);
  res.json({ success: true, data: { name: user.name, shared_at: user.profile_share.created_at, profile: d.profile, quotes: d.quotes, note: "Điểm do AI chấm theo 5 tiêu chí tư duy trên nhật ký làm bài, kèm đánh giá của giảng viên. Đây không phải điểm học phần." } });
});

app.get("/api/health", async (req, res) => {
  const url = process.env.SUPABASE_URL?.trim() || "";
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  const out: any = {
    ok: true,
    supabase: {
      configured: isSupabaseConfigured(),
      url_host: url ? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
      key_type: !key ? null : key.startsWith("sb_secret_") ? "secret (đúng)" : key.startsWith("sb_publishable_") ? "publishable (SAI - cần secret)" : key.startsWith("eyJ") ? "legacy JWT (service_role hoặc anon)" : "không nhận dạng được",
      using_service_role_env: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      loaded: supabaseLoaded,
      error: null as string | null,
    },
    gemini_configured: !!process.env.GEMINI_API_KEY,
    auth_secret_configured: !!process.env.AUTH_SECRET,
  };
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { error } = await sb.from("documents").select("id").limit(1);
      if (error) out.supabase.error = error.message;
    } catch (e: any) { out.supabase.error = String(e?.cause?.message || e?.message || e); }
  }
  res.json(out);
});

// Hold the response until every database write started by this request has finished
app.use("/api", (req, res, next) => {
  const store = { pending: [] as Promise<any>[] };
  const origEnd = res.end;
  (res as any).end = function (this: any, ...args: any[]) {
    const go = () => origEnd.apply(this, args as any);
    if (store.pending.length) Promise.allSettled([...store.pending]).then(go); else go();
    return this;
  };
  reqStore.run(store, next);
});
app.use("/api", syncMiddleware);

// Supabase admin endpoints require a logged-in teacher
app.use("/api/supabase", requireAuth, (req: any, res, next) =>
  req.user?.role === "admin" ? next() : res.status(403).json({ success: false, message: "Chỉ quản trị viên mới được quản lý cơ sở dữ liệu." }));

// --- SUPABASE INTEGRATION API ENDPOINTS ---

// Check Supabase connection and table readiness
app.get("/api/supabase/status", async (req, res) => {
  try {
    const status = await checkSupabaseConnection();
    res.json({
      success: true,
      data: {
        ...status,
        counts: {
          courses: db.courses.length,
          assignments: db.assignments.length,
          submissions: db.submissions.length,
          chat_sessions: db.chat_sessions.length,
          users: db.users.length,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get SQL Schema for Supabase
app.get("/api/supabase/schema", (req, res) => {
  res.json({ success: true, sql: SUPABASE_SCHEMA_SQL });
});

// Push/Sync all current courses, assignments, and submissions into Supabase
app.post("/api/supabase/sync", async (req, res) => {
  if (!getSupabaseClient()) return res.status(400).json({ success: false, message: "Chưa cấu hình Supabase. Hãy đặt SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY." });
  try {
    const results = await pushAllToSupabase();
    res.json({ success: true, message: "Đã ghi toàn bộ dữ liệu hiện tại lên Supabase.", results });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Lỗi ghi dữ liệu: ${err.message}. Bạn đã chạy SQL Schema chưa?` });
  }
});

app.post("/api/supabase/pull", async (req, res) => {
  if (!getSupabaseClient()) return res.status(400).json({ success: false, message: "Chưa cấu hình Supabase." });
  try {
    await pullFromSupabase(true);
    res.json({ success: true, message: "Đã nạp lại dữ liệu từ Supabase.", stats: { users: db.users.length, courses: db.courses.length, assignments: db.assignments.length, submissions: db.submissions.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Lỗi đọc dữ liệu từ Supabase" });
  }
});

// Auto-setup database tables in Supabase directly
app.post("/api/supabase/auto-setup", async (req, res) => {
  const { db_password, connection_string } = req.body || {};
  const password = db_password || process.env.SUPABASE_DB_PASSWORD;
  const connStr = connection_string || process.env.DATABASE_URL;

  if (!password && !connStr) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập Database Password của Supabase (mật khẩu đã tạo khi tạo project).",
    });
  }

  try {
    const result = await runAutoSetupSql({
      dbPassword: password,
      connectionString: connStr,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Automatically trigger initial push sync to seed the newly created tables!
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        if (db.users.length > 0) await supabase.from("users").upsert(db.users);
        if (db.courses.length > 0) await supabase.from("courses").upsert(db.courses);
        if (db.course_members.length > 0) {
          const formatted = db.course_members.map((m) => ({
            ...m,
            id: m.id || `${m.course_id}_${m.student_id}`,
          }));
          await supabase.from("course_members").upsert(formatted);
        }
        if (db.assignments.length > 0) await supabase.from("assignments").upsert(db.assignments);
        if (db.submissions.length > 0) await supabase.from("submissions").upsert(db.submissions);
        if (db.chat_sessions.length > 0) await supabase.from("chat_sessions").upsert(db.chat_sessions);
      } catch (syncErr) {
        console.warn("[Supabase Auto-Setup] Initial sync note:", syncErr);
      }
    }

    res.json({
      success: true,
      message: "Tuyệt vời! Toàn bộ bảng đã được tự động tạo và đồng bộ dữ liệu lên Supabase thành công!",
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Lỗi trong quá trình kích hoạt tự động Supabase.",
    });
  }
});

// --- API ENDPOINTS ---

type AuthedRequest = express.Request & { user?: any };

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const PERMISSION_KEYS = ["create_course", "manage_assignments", "grade", "manage_members", "join_course", "use_ai_chat", "submit"];
const can = (user: any, perm: string) => user.role === "admin" || db.settings?.permissions?.[user.role]?.[perm] === true;
const permsFor = (user: any) => PERMISSION_KEYS.filter((k) => can(user, k));
const publicUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, active: u.active !== false, last_seen: u.last_seen, consent_at: u.consent_at, permissions: permsFor(u) });
function audit(actor: any, action: string, target: string, detail = "") {
  const log = { id: uid("log"), actor_id: actor?.id || "", actor_name: actor?.name || "Hệ thống", action, target, detail, created_at: nowIso() };
  db.audit_logs.unshift(log);
  if (db.audit_logs.length > 500) db.audit_logs.length = 500;
  saveDocument("audit_logs", log.id, log);
}
const denied = (res: express.Response) => fail(res, 403, "Bạn chưa được cấp quyền thực hiện thao tác này. Hãy liên hệ quản trị viên.");
const fail = (res: express.Response, code: number, message: string, errCode?: string) => res.status(code).json({ success: false, message, ...(errCode ? { code: errCode } : {}) });

function addNotification(userId: string, title: string, body: string, link?: string) {
  const n = { id: uid("n"), user_id: userId, title, body, link: link || "", read: false, created_at: nowIso() };
  db.notifications.unshift(n);
  if (db.notifications.length > 500) db.notifications.length = 500;
  saveDocument("notifications", n.id, n);
}

// ---- Auth ----
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 400, "Vui lòng nhập email và mật khẩu.");
  const user = db.users.find((u: any) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || !user.pwd || !verifyPassword(String(password), user.pwd)) {
    return fail(res, 401, "Email hoặc mật khẩu không đúng.");
  }
  if (user.active === false) return fail(res, 403, "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
  user.last_seen = nowIso();
  res.json({ success: true, data: { token: signToken(user.id), user: publicUser(user) } });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return fail(res, 400, "Vui lòng điền đầy đủ họ tên, email và mật khẩu.");
  if (!/^\S+@\S+\.\S+$/.test(String(email))) return fail(res, 400, "Email không hợp lệ.");
  if (String(password).length < 6) return fail(res, 400, "Mật khẩu cần ít nhất 6 ký tự.");
  if (role !== "teacher" && role !== "student") return fail(res, 400, "Vai trò không hợp lệ.");
  if (db.settings.allow_registration === false) return fail(res, 403, "Hệ thống đang đóng đăng ký tài khoản mới. Hãy liên hệ quản trị viên.");
  if (role === "teacher" && db.settings.teacher_self_register === false) return fail(res, 403, "Tài khoản giảng viên cần được quản trị viên cấp. Hãy đăng ký sinh viên hoặc liên hệ quản trị viên.");
  const cleanEmail = String(email).trim().toLowerCase();
  if (db.users.some((u: any) => u.email.toLowerCase() === cleanEmail)) return fail(res, 409, "Email này đã được đăng ký.");
  const cleanName = String(name).trim().slice(0, 80);
  const user = {
    id: uid("u"),
    name: cleanName,
    email: cleanEmail,
    role,
    avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundType=gradientLinear`,
    pwd: hashPassword(String(password)),
  };
  db.users.push(user);
  saveDocument("users", user.id, user);
  audit(user, "register", user.email, `Đăng ký tài khoản ${role}`);
  res.json({ success: true, data: { token: signToken(user.id), user: publicUser(user) } });
});

app.use("/api", requireAuth);

app.get("/api/auth/me", (req: AuthedRequest, res) => res.json({ success: true, data: publicUser(req.user) }));

app.put("/api/auth/password", (req: AuthedRequest, res) => {
  const { current, next } = req.body || {};
  if (!current || !next) return fail(res, 400, "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.");
  if (!verifyPassword(String(current), req.user.pwd || "")) return fail(res, 400, "Mật khẩu hiện tại không đúng.");
  if (String(next).length < 6) return fail(res, 400, "Mật khẩu mới cần ít nhất 6 ký tự.");
  req.user.pwd = hashPassword(String(next));
  saveDocument("users", req.user.id, req.user);
  res.json({ success: true, message: "Đã đổi mật khẩu." });
});

app.put("/api/auth/me", (req: AuthedRequest, res) => {
  const { name } = req.body || {};
  if (name && String(name).trim()) req.user.name = String(name).trim().slice(0, 80);
  saveDocument("users", req.user.id, req.user);
  res.json({ success: true, data: publicUser(req.user) });
});

// ---- Helpers ----
const findCourse = (id: string) => db.courses.find((c: any) => c.id === id);
const isOwner = (course: any, user: any) => !!course && user.role === "teacher" && course.teacher_id === user.id;
const isMember = (courseId: string, user: any) => db.course_members.some((m: any) => m.course_id === courseId && m.student_id === user.id);
const canViewCourse = (course: any, user: any) => isOwner(course, user) || (user.role === "student" && isMember(course.id, user));
const gradedState = (s: any) => s.grade !== undefined && s.grade !== null;
const isSubmitted = (s: any) => s.status === "submitted" || s.status === "late";

function teacherOnly(req: AuthedRequest, res: express.Response): boolean {
  if (req.user.role !== "teacher") { fail(res, 403, "Chức năng này chỉ dành cho giảng viên."); return false; }
  return true;
}

function courseWithCounts(course: any, user: any) {
  const courseAssignments = db.assignments.filter((a: any) => a.course_id === course.id);
  const openAssignments = courseAssignments.filter((a: any) => new Date(a.due_date) > new Date());
  const base: any = {
    ...course,
    materials: (course.materials || []).map((m: any) => ({ id: m.id, name: m.name, chars: String(m.text || "").length, added_at: m.added_at })),
    accent_color: !course.accent_color || /zinc|slate|gray/.test(course.accent_color)
      ? COURSE_COLORS[[...course.id].reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % COURSE_COLORS.length]
      : course.accent_color,
    member_count: db.course_members.filter((m: any) => m.course_id === course.id).length,
    open_assignments_count: openAssignments.length,
    assignments_count: courseAssignments.length,
  };
  if (user.role !== "student") {
    const subs = db.submissions.filter((s: any) => courseAssignments.some((a: any) => a.id === s.assignment_id));
    base.ungraded_count = subs.filter((s: any) => isSubmitted(s) && !gradedState(s)).length;
  } else {
    delete base.invite_code;
    const mine = db.submissions.filter((s: any) => s.student_id === user.id && isSubmitted(s));
    base.todo_count = courseAssignments.filter((a: any) => !mine.some((s: any) => s.assignment_id === a.id) && new Date(a.due_date) > new Date()).length;
  }
  const mineDone = user.role === "student" ? db.submissions.filter((s: any) => s.student_id === user.id && isSubmitted(s)) : [];
  const next = courseAssignments
    .filter((a: any) => new Date(a.due_date) > new Date() && !mineDone.some((s: any) => s.assignment_id === a.id))
    .sort((a: any, b: any) => +new Date(a.due_date) - +new Date(b.due_date))[0];
  base.next_due = next ? { id: next.id, title: next.title, due_date: next.due_date } : null;
  return base;
}

// ---- Courses ----
app.get("/api/courses", (req: AuthedRequest, res) => {
  const user = req.user;
  const list = user.role === "admin"
    ? []
    : user.role === "teacher"
    ? db.courses.filter((c: any) => c.teacher_id === user.id)
    : db.courses.filter((c: any) => isMember(c.id, user));
  res.json({ success: true, data: list.map((c: any) => courseWithCounts(c, user)) });
});

const COURSE_COLORS = ["from-indigo-500 to-violet-600", "from-sky-500 to-blue-600", "from-emerald-500 to-teal-600", "from-rose-500 to-pink-600", "from-amber-500 to-orange-600", "from-fuchsia-500 to-purple-600"];

app.post("/api/courses", (req: AuthedRequest, res) => {
  if (!teacherOnly(req, res)) return;
  if (!can(req.user, "create_course")) return denied(res);
  const { name, code, semester, description } = req.body || {};
  if (!name?.trim() || !code?.trim()) return fail(res, 400, "Tên môn học và Mã môn là bắt buộc.");
  let invite = generateInviteCode();
  while (db.courses.some((c: any) => c.invite_code === invite)) invite = generateInviteCode();
  const newCourse = {
    id: uid("c"),
    name: name.trim(),
    code: code.trim().toUpperCase(),
    teacher_id: req.user.id,
    teacher_name: req.user.name,
    semester: semester || "Học kỳ I (2025-2026)",
    description: description || "",
    invite_code: invite,
    accent_color: COURSE_COLORS[db.courses.length % COURSE_COLORS.length],
    created_at: nowIso(),
  };
  db.courses.unshift(newCourse);
  saveDocument("courses", newCourse.id, newCourse);
  res.json({ success: true, data: courseWithCounts(newCourse, req.user) });
});

app.put("/api/courses/:id", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Bạn không có quyền sửa môn học này.");
  const { name, code, semester, description } = req.body || {};
  if (!name?.trim() || !code?.trim()) return fail(res, 400, "Tên môn học và Mã môn là bắt buộc.");
  Object.assign(course, {
    name: name.trim(),
    code: code.trim().toUpperCase(),
    semester: semester || course.semester,
    description: description !== undefined ? String(description).trim() : course.description,
    updated_at: nowIso(),
  });
  saveDocument("courses", course.id, course);
  res.json({ success: true, data: { ...course, materials: (course.materials || []).map((m: any) => ({ id: m.id, name: m.name, chars: String(m.text || "").length, added_at: m.added_at })) }, message: "Cập nhật thông tin môn học thành công!" });
});

app.post("/api/courses/:id/regenerate-code", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Bạn không có quyền.");
  if (!can(req.user, "manage_members")) return denied(res);
  let invite = generateInviteCode();
  while (db.courses.some((c: any) => c.invite_code === invite)) invite = generateInviteCode();
  course.invite_code = invite;
  saveDocument("courses", course.id, course);
  res.json({ success: true, data: { invite_code: invite }, message: "Đã tạo mã mời mới. Mã cũ không còn hiệu lực." });
});

app.delete("/api/courses/:id", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học để xóa.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Bạn không có quyền xóa môn học này.");
  audit(req.user, "course.delete", course.name, `Mã ${course.code}`);
  deleteCourseCascade(course.id);
  res.json({ success: true, message: `Đã xóa môn học "${course.name}" và các dữ liệu liên quan.` });
});

function deleteCourseCascade(courseId: string) {
  db.courses = db.courses.filter((c: any) => c.id !== courseId);
  deleteDocument("courses", courseId);
  const assignmentIds = db.assignments.filter((a: any) => a.course_id === courseId).map((a: any) => a.id);
  for (const id of assignmentIds) deleteAssignmentCascade(id);
  const members = db.course_members.filter((m: any) => m.course_id === courseId);
  db.course_members = db.course_members.filter((m: any) => m.course_id !== courseId);
  for (const m of members) deleteDocument("course_members", `${courseId}_${m.student_id}`);
  for (const l of db.lab_sessions.filter((x: any) => x.course_id === courseId)) deleteDocument("lab_sessions", l.id);
  db.lab_sessions = db.lab_sessions.filter((x: any) => x.course_id !== courseId);
}

function deleteAssignmentCascade(assignmentId: string) {
  db.assignments = db.assignments.filter((a: any) => a.id !== assignmentId);
  deleteDocument("assignments", assignmentId);
  for (const s of db.submissions.filter((x: any) => x.assignment_id === assignmentId)) deleteDocument("submissions", s.id);
  db.submissions = db.submissions.filter((s: any) => s.assignment_id !== assignmentId);
  for (const cs of db.chat_sessions.filter((x: any) => x.assignment_id === assignmentId)) deleteDocument("chat_sessions", cs.id);
  db.chat_sessions = db.chat_sessions.filter((cs: any) => cs.assignment_id !== assignmentId);
}

app.post("/api/courses/join", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên mới tham gia lớp bằng mã mời.");
  if (!can(req.user, "join_course")) return denied(res);
  const { invite_code } = req.body || {};
  if (!invite_code) return fail(res, 400, "Vui lòng nhập mã mời.");
  const course = db.courses.find((c: any) => c.invite_code === String(invite_code).trim().toUpperCase());
  if (!course) return fail(res, 404, "Không tìm thấy môn học với mã mời này.");
  if (isMember(course.id, req.user)) return fail(res, 400, "Bạn đã tham gia môn học này rồi!");
  const member = {
    course_id: course.id,
    student_id: req.user.id,
    student_name: req.user.name,
    student_email: req.user.email,
    student_avatar: req.user.avatar,
    joined_at: nowIso(),
  };
  db.course_members.push(member);
  saveDocument("course_members", `${course.id}_${req.user.id}`, member);
  addNotification(course.teacher_id, "Sinh viên mới tham gia", `${req.user.name} vừa tham gia ${course.name}.`);
  res.json({ success: true, data: courseWithCounts(course, req.user), message: `Tham gia môn học "${course.name}" thành công!` });
});

app.post("/api/courses/:id/leave", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 404, "Bạn không thuộc môn học này.");
  db.course_members = db.course_members.filter((m: any) => !(m.course_id === course.id && m.student_id === req.user.id));
  deleteDocument("course_members", `${course.id}_${req.user.id}`);
  res.json({ success: true, message: "Bạn đã rời khỏi môn học." });
});

app.delete("/api/courses/:id/members/:studentId", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Bạn không có quyền.");
  if (!can(req.user, "manage_members")) return denied(res);
  const before = db.course_members.length;
  db.course_members = db.course_members.filter((m: any) => !(m.course_id === course.id && m.student_id === req.params.studentId));
  if (db.course_members.length === before) return fail(res, 404, "Sinh viên không thuộc lớp.");
  deleteDocument("course_members", `${course.id}_${req.params.studentId}`);
  res.json({ success: true, message: "Đã xóa sinh viên khỏi lớp." });
});

app.get("/api/courses/:id", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Môn học không tồn tại.");
  if (!canViewCourse(course, req.user)) return fail(res, 403, "Bạn không thuộc môn học này.");
  const owner = isOwner(course, req.user);
  const members = db.course_members.filter((m: any) => m.course_id === course.id);
  const assignments = db.assignments
    .filter((a: any) => a.course_id === course.id)
    .map((a: any) => {
      const out: any = { ...publicAssignment(a, req.user) };
      if (!owner) {
        const sub = db.submissions.find((s: any) => s.assignment_id === a.id && s.student_id === req.user.id);
        out.submission_status = sub ? sub.status : "not_submitted";
        out.submitted_at = sub?.submitted_at;
        out.my_process_score = sub?.process_score_result?.process_score;
        out.my_grade = sub?.grade;
      } else {
        const subs = db.submissions.filter((s: any) => s.assignment_id === a.id && isSubmitted(s));
        out.submitted_count = subs.length;
        out.ungraded_count = subs.filter((s: any) => !gradedState(s)).length;
        out.member_count = members.length;
      }
      return out;
    })
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const { invite_code, ...rest } = course;
  // class materials are text for the AI only: the client gets names and sizes, never the text
  const materials = (course.materials || []).map((m: any) => ({ id: m.id, name: m.name, chars: String(m.text || "").length, added_at: m.added_at }));
  res.json({ success: true, data: { ...(owner ? course : rest), materials, members, assignments } });
});

// ---- Assignments ----
/** Validates the "Viết L2" configuration. Positions of planted errors are always recomputed from the AI text. */
function sanitizeL2(raw: any): { l2?: L2Config; error?: string } {
  const ai_text = String(raw?.ai_text ?? "").replace(/\r\n/g, "\n").trimEnd().slice(0, 8000);
  if (ai_text.trim().length < 20) return { error: "Văn bản AI quá ngắn (tối thiểu 20 ký tự)." };
  const rawErrors = Array.isArray(raw?.errors) ? raw.errors.slice(0, 25) : [];
  const errors: L2Error[] = [];
  for (const e of rawErrors) {
    const phrase = String(e?.text ?? "").trim();
    if (!phrase) continue;
    const range = findPhraseRange(ai_text, phrase);
    if (!range) return { error: `Không tìm thấy đoạn lỗi “${phrase.slice(0, 40)}” trong văn bản AI. Hãy chọn lại đoạn lỗi từ chính văn bản.` };
    if (errors.some((x) => range.start < x.end && range.end > x.start)) return { error: `Đoạn lỗi “${phrase.slice(0, 40)}” bị chồng lên một lỗi khác.` };
    errors.push({
      id: typeof e?.id === "string" && e.id ? e.id : uid("err"),
      type: L2_ERROR_TYPES.includes(e?.type) ? e.type : "language",
      text: ai_text.slice(range.start, range.end),
      answer: String(e?.answer ?? "").trim().slice(0, 1000),
      start: range.start, end: range.end,
    });
  }
  if (errors.length === 0) return { error: "Cần đánh dấu ít nhất một lỗi cài sẵn trong văn bản AI." };
  errors.sort((a, b) => a.start - b.start);
  const rawDims = Array.isArray(raw?.dimensions) ? raw.dimensions : [];
  const dimensions = DEFAULT_L2_DIMENSIONS.map((d) => {
    const r = rawDims.find((x: any) => x?.key === d.key);
    const levels = Array.isArray(r?.levels) && r.levels.length === 5 ? r.levels.map((l: any, i: number) => String(l ?? "").trim().slice(0, 400) || d.levels[i]) : d.levels;
    return { key: d.key, name: String(r?.name ?? "").trim().slice(0, 80) || d.name, description: String(r?.description ?? "").trim().slice(0, 600) || d.description, levels };
  });
  return { l2: { ai_text, errors, dimensions, prompt_language: raw?.prompt_language === "bilingual" ? "bilingual" : "en" } };
}

/** Students must never receive the answer key. */
function publicAssignment(a: any, user: any) {
  if (a?.l2 && user?.role === "student") return { ...a, l2: { ...a.l2, errors: [] } };
  return a;
}

function sanitizeAssignmentInput(body: any) {
  const { title, description, rubric, due_date, attachments, submission_mode, ai_submode, allow_late, friction, friction_prompts, answer_gate, paste_mode, live_coach, stages } = body || {};
  const mode = ["file_only", "ai_chat_only", "both", "writing_l2"].includes(submission_mode) ? submission_mode : "both";
  // Input friction only applies to plain AI-chat assignments (not file-only, not the 3-step L2 flow)
  const level = (mode === "ai_chat_only" || mode === "both") && isFrictionLevel(friction) ? friction : "none";
  return {
    title: typeof title === "string" ? title.trim() : title,
    description: description ?? "",
    rubric: rubric ?? "",
    due_date,
    attachments: Array.isArray(attachments) ? attachments : [],
    submission_mode: mode,
    ai_submode: ai_submode === "normal" ? "normal" : "socratic",
    allow_late: allow_late === false ? false : true,
    friction: level,
    paste_mode: isPasteMode(paste_mode) ? paste_mode : "track",
    live_coach: live_coach === false ? false : true,
    stages: cleanStages(stages, mode),
    friction_prompts: cleanFrictionPrompts(friction_prompts),
    answer_gate: (mode === "ai_chat_only" || mode === "both") && isAnswerGate(answer_gate) ? answer_gate : "none",
  };
}

app.post("/api/courses/:id/assignments", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Bạn không có quyền giao bài cho môn này.");
  if (!can(req.user, "manage_assignments")) return denied(res);
  const input: any = sanitizeAssignmentInput(req.body);
  if (!input.title || !input.due_date || isNaN(new Date(input.due_date).getTime())) return fail(res, 400, "Tiêu đề và hạn nộp hợp lệ là bắt buộc.");
  if (input.submission_mode === "writing_l2") return fail(res, 400, "Chế độ Viết L2 đã được gỡ. Hãy chọn chat với AI, nộp tệp, hoặc cả hai.");   // old L2 assignments still open and grade; no new ones
  const a = { id: uid("a"), course_id: course.id, ...input, created_at: nowIso() };
  db.assignments.unshift(a);
  saveDocument("assignments", a.id, a);
  for (const m of db.course_members.filter((m: any) => m.course_id === course.id)) {
    addNotification(m.student_id, "Bài tập mới", `${course.name}: ${a.title}`, `/course/${course.id}/assignment/${a.id}`);
  }
  res.json({ success: true, data: a });
});

app.put("/api/assignments/:id", (req: AuthedRequest, res) => {
  const a = db.assignments.find((x: any) => x.id === req.params.id);
  if (!a) return fail(res, 404, "Bài tập không tồn tại.");
  if (!isOwner(findCourse(a.course_id), req.user)) return fail(res, 403, "Bạn không có quyền sửa bài tập này.");
  if (!can(req.user, "manage_assignments")) return denied(res);
  const input: any = sanitizeAssignmentInput({ ...a, ...req.body });
  if (!input.title || !input.due_date || isNaN(new Date(input.due_date).getTime())) return fail(res, 400, "Tiêu đề và hạn nộp hợp lệ là bắt buộc.");
  const hasWork = db.submissions.some((x: any) => x.assignment_id === a.id && (x.l2_work || isSubmitted(x)));
  if (input.submission_mode !== a.submission_mode && hasWork) return fail(res, 409, "Đã có sinh viên làm bài nên không thể đổi hình thức bài tập.");
  if (input.submission_mode === "writing_l2") {
    const r = sanitizeL2(req.body?.l2 ?? a.l2);
    if (r.error) return fail(res, 400, r.error);
    if (hasWork && a.l2 && r.l2!.ai_text !== a.l2.ai_text) return fail(res, 409, "Đã có sinh viên làm bài nên không thể đổi văn bản AI.");
    input.l2 = r.l2;
    input.ai_submode = "socratic";
  } else {
    input.l2 = undefined;
  }
  Object.assign(a, input, { updated_at: nowIso() });
  saveDocument("assignments", a.id, a);
  res.json({ success: true, data: a, message: "Đã cập nhật bài tập." });
});

app.delete("/api/assignments/:id", (req: AuthedRequest, res) => {
  const a = db.assignments.find((x: any) => x.id === req.params.id);
  if (!a) return fail(res, 404, "Bài tập không tồn tại.");
  if (!isOwner(findCourse(a.course_id), req.user)) return fail(res, 403, "Bạn không có quyền xóa bài tập này.");
  if (!can(req.user, "manage_assignments")) return denied(res);
  deleteAssignmentCascade(a.id);
  res.json({ success: true, message: "Đã xóa bài tập và các bài nộp liên quan." });
});

app.get("/api/assignments/:id", (req: AuthedRequest, res) => {
  const assignment = db.assignments.find((a: any) => a.id === req.params.id);
  if (!assignment) return fail(res, 404, "Bài tập không tồn tại.");
  const course = findCourse(assignment.course_id);
  if (!course || !canViewCourse(course, req.user)) return fail(res, 403, "Bạn không thuộc môn học này.");
  let submission = null, chatSession = null;
  if (req.user.role === "student") {
    submission = db.submissions.find((s: any) => s.assignment_id === assignment.id && s.student_id === req.user.id) || null;
    chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment.id && cs.student_id === req.user.id) || null;
  }
  const extra: any = {};
  if (req.user.role === "student" && assignment.l2 && submission && isSubmitted(submission)) extra.l2_feedback = studentL2Feedback(assignment, submission);
  res.json({ success: true, data: { assignment: publicAssignment(assignment, req.user), course_name: course.name, submission, chat_session: publicChat(chatSession, req.user), ...extra } });
});

app.get("/api/assignments/:id/submissions", (req: AuthedRequest, res) => {
  const assignment = db.assignments.find((a: any) => a.id === req.params.id);
  if (!assignment) return fail(res, 404, "Bài tập không tồn tại.");
  if (!isOwner(findCourse(assignment.course_id), req.user)) return fail(res, 403, "Bạn không có quyền xem bài nộp.");
  const isPastDue = new Date(assignment.due_date) < new Date();
  const submissions = db.course_members
    .filter((m: any) => m.course_id === assignment.course_id)
    .map((m: any) => {
      const sub = db.submissions.find((s: any) => s.assignment_id === assignment.id && s.student_id === m.student_id);
      return sub || {
        id: `stub_${m.student_id}_${assignment.id}`,
        assignment_id: assignment.id,
        student_id: m.student_id,
        student_name: m.student_name,
        student_email: m.student_email,
        student_avatar: m.student_avatar,
        submitted_files: [],
        submitted_text: "",
        status: isPastDue ? "not_submitted" : "draft",
      };
    });
  res.json({ success: true, data: { assignment, submissions } });
});

// ---- Submissions ----
app.get("/api/submissions/:id", (req: AuthedRequest, res) => {
  const sub = db.submissions.find((s: any) => s.id === req.params.id);
  if (!sub) return fail(res, 404, "Bài nộp không tồn tại.");
  const assignment = db.assignments.find((a: any) => a.id === sub.assignment_id);
  const course = assignment && findCourse(assignment.course_id);
  if (!isOwner(course, req.user) && sub.student_id !== req.user.id) return fail(res, 403, "Bạn không có quyền xem bài nộp này.");
  const chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === sub.assignment_id && cs.student_id === sub.student_id);
  res.json({ success: true, data: { submission: sub, assignment: publicAssignment(assignment, req.user), chat_session: publicChat(chatSession, req.user) } });
});

app.put("/api/submissions/:id/grade", (req: AuthedRequest, res) => {
  const sub = db.submissions.find((s: any) => s.id === req.params.id);
  if (!sub) return fail(res, 404, "Bài nộp không tồn tại.");
  const assignment = db.assignments.find((a: any) => a.id === sub.assignment_id);
  if (!isOwner(assignment && findCourse(assignment.course_id), req.user)) return fail(res, 403, "Bạn không có quyền chấm bài này.");
  if (!can(req.user, "grade")) return denied(res);
  const grade = Number(req.body?.grade);
  if (!Number.isFinite(grade) || grade < 0 || grade > 10) return fail(res, 400, "Điểm phải nằm trong khoảng 0 - 10.");
  sub.grade = Math.round(grade * 100) / 100;
  sub.feedback = String(req.body?.feedback || "").slice(0, 5000);
  sub.graded_at = nowIso();
  saveDocument("submissions", sub.id, sub);
  addNotification(sub.student_id, "Bài tập đã được chấm", `${assignment.title}: ${sub.grade}/10`, `/course/${assignment.course_id}/assignment/${assignment.id}`);
  res.json({ success: true, data: sub, message: "Đã lưu điểm và nhận xét." });
});

app.post("/api/submissions/:id/reevaluate", async (req: AuthedRequest, res) => {
  const sub = db.submissions.find((s: any) => s.id === req.params.id);
  if (!sub) return fail(res, 404, "Bài nộp không tồn tại.");
  const assignment = db.assignments.find((a: any) => a.id === sub.assignment_id);
  if (!isOwner(assignment && findCourse(assignment.course_id), req.user)) return fail(res, 403, "Bạn không có quyền.");
  if (!can(req.user, "grade")) return denied(res);
  const chat = db.chat_sessions.find((cs: any) => cs.assignment_id === sub.assignment_id && cs.student_id === sub.student_id);
  if (assignment?.l2 && sub.l2_work) {
    try {
      sub.l2_report = computeL2Report(assignment, sub);
      sub.l2_result = await evaluateL2(assignment, sub, chat, sub.l2_report);
      sub.eval_status = "ok"; sub.eval_error = undefined;
      saveDocument("submissions", sub.id, sub);
      return res.json({ success: true, data: sub, message: "Đã chấm lại bằng AI." });
    } catch (e: any) {
      sub.eval_status = "failed"; sub.eval_error = e.message;
      saveDocument("submissions", sub.id, sub);
      return fail(res, 502, "AI chưa chấm được: " + e.message);
    }
  }
  if (!chat || !chat.messages.some((m: any) => m.role === "user")) return fail(res, 400, "Bài nộp này không có nhật ký chat để chấm.");
  try {
    sub.process_score_result = await evaluateProcess(assignment, chat, sub.submitted_text);
    sub.eval_status = "ok";
    sub.eval_error = undefined;
    saveDocument("submissions", sub.id, sub);
    res.json({ success: true, data: sub, message: "Đã chấm lại bằng AI." });
  } catch (e: any) {
    sub.eval_status = "failed";
    sub.eval_error = e.message;
    saveDocument("submissions", sub.id, sub);
    fail(res, 502, "AI chưa chấm được: " + e.message);
  }
});

function transcriptOf(chat: any) {
  return chat.messages.map((m: any) => {
    const g: GateInfo | undefined = m.gate;
    if (m.stage === "are_you_sure") {
      const meta = m.role === "user" ? (m.ays?.response_type ? ` (phân loại phản hồi: ${m.ays.response_type})` : "") : (m.ays?.issue_type ? ` (loại vấn đề: ${m.ays.issue_type})` : "");
      return `[Chặng Bạn chắc chứ?] ${m.role === "user" ? "Sinh viên" : "AI chất vấn"}: ${m.content}${meta}`;
    }
    if (m.role === "user" || !g) return `${m.role === "user" ? "Sinh viên" : "AI Assistant"}: ${m.content}`;
    // Gated answers: the grader must see what the student actually did to read the rest
    if (g.state === "locked") return `AI Assistant: ${m.content} [phần còn lại chưa được mở khóa]`;
    if (g.skipped) return `AI Assistant: ${m.content}\n(Sinh viên bỏ qua các câu hỏi mở khóa và xem luôn đáp án.)`;
    const ans = (g.answers || []).map((x) => `- ${x.q} ${x.a}`).join("\n");
    return `AI Assistant (phần đầu bản nháp, phần còn lại bị che): ${g.teaser}\nSinh viên tự trả lời các câu hỏi để mở khóa:\n${ans}\nAI Assistant (đáp án đã tinh chỉnh theo ý của sinh viên): ${m.content}`;
  }).join("\n");
}

async function evaluateProcess(assignment: any, chat: any, submittedText: string) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
  const who = whoIs(chat.student_id);
  const transcript = scrub(transcriptOf(chat), who).slice(-60000);
  submittedText = scrub(submittedText || "", who);
  const evalPrompt = `Bạn được cung cấp transcript cuộc trò chuyện giữa sinh viên và AI khi làm bài tập [${assignment.title}], cùng bài nộp cuối cùng (nếu có: "${submittedText || "Không có văn bản nộp trực tiếp"}"). Hãy đánh giá QUÁ TRÌNH TƯ DUY của sinh viên một cách nghiêm khắc, trung thực: nếu sinh viên chỉ xin đáp án, copy-paste, hoặc làm hộ thì điểm phải thấp. Trả về JSON theo schema:
- process_score: số nguyên 0-100
- tieu_chi: tu_duy_phan_bien (chất vấn/phản bác AI), dao_sau_van_de (refine câu hỏi từ chung chung sang cụ thể), kiem_chung_thong_tin (yêu cầu dẫn nguồn/verify), noi_hoa_kien_thuc (tự diễn giải bằng lời riêng), tinh_chu_dong (mở rộng vấn đề thay vì chỉ nhận đáp án); mỗi tiêu chí 0-100
- noi_dung_ngoai_luong: mô tả nếu bài nộp có đoạn không khớp transcript, hoặc chuỗi rỗng
- nhan_xet_ngan: 2-3 câu tiếng Việt tóm tắt kiểu tư duy
- highlight_segments: danh sách {doan_van_ban (trích NGUYÊN VĂN câu của sinh viên), mau: "xanh"|"vang"|"do", ly_do}
Màu: xanh = phản biện/tư duy sâu/tự tổng hợp; vang = tò mò, cần làm rõ; do = copy hoàn toàn hoặc nhờ AI làm hộ.
Mỗi highlight có thể kèm "stage": think_first | co_think | are_you_sure, tùy đoạn trích nằm ở chặng nào (các đoạn bắt đầu bằng [Chặng …] cho biết chặng). Chỉ trích những câu có thật trong transcript.
Cách dùng bằng chứng theo chặng: chặng "Bạn chắc chứ?" cho Kiểm chứng và Phản biện: HÃY THƯỞNG việc giữ vững lập trường có lý lẽ (held_with_reason) và việc điều chỉnh có lý do (revised); nhượng bộ không lý do (conceded_without_reason) hoặc né tránh (dodged) là tín hiệu yếu, không phải tín hiệu tốt.`;
  const response = await generateWithFallback({
    contents: [{ role: "user", parts: [{ text: `Transcript:\n${transcript}\n\n${evalPrompt}` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          process_score: { type: Type.INTEGER },
          tieu_chi: {
            type: Type.OBJECT,
            properties: {
              tu_duy_phan_bien: { type: Type.INTEGER },
              dao_sau_van_de: { type: Type.INTEGER },
              kiem_chung_thong_tin: { type: Type.INTEGER },
              noi_hoa_kien_thuc: { type: Type.INTEGER },
              tinh_chu_dong: { type: Type.INTEGER },
            },
            required: ["tu_duy_phan_bien", "dao_sau_van_de", "kiem_chung_thong_tin", "noi_hoa_kien_thuc", "tinh_chu_dong"],
          },
          noi_dung_ngoai_luong: { type: Type.STRING },
          nhan_xet_ngan: { type: Type.STRING },
          highlight_segments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { doan_van_ban: { type: Type.STRING }, mau: { type: Type.STRING }, ly_do: { type: Type.STRING }, stage: { type: Type.STRING } },
              required: ["doan_van_ban", "mau", "ly_do"],
            },
          },
        },
        required: ["process_score", "tieu_chi", "nhan_xet_ngan", "highlight_segments"],
      },
    },
  });
  if (!response.text) throw new Error("AI trả về nội dung rỗng.");
  const parsed = JSON.parse(response.text.trim());
  const clamp = (n: any) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  parsed.process_score = clamp(parsed.process_score);
  for (const k of Object.keys(parsed.tieu_chi || {})) parsed.tieu_chi[k] = clamp(parsed.tieu_chi[k]);
  parsed.noi_dung_ngoai_luong = parsed.noi_dung_ngoai_luong?.trim() ? parsed.noi_dung_ngoai_luong : null;
  // Principle P4: the AI does not get to invent evidence. A highlight whose quote is not in the transcript is dropped.
  const STAGES = ["think_first", "co_think", "are_you_sure"];
  const all: any[] = parsed.highlight_segments || [];
  parsed.highlight_segments = all.filter((h) => quoteInLoose(transcript, h.doan_van_ban)).map((h) => ({ ...h, mau: ["xanh", "vang", "do"].includes(h.mau) ? h.mau : "vang", stage: STAGES.includes(h.stage) ? h.stage : undefined }));
  parsed.dropped_quotes = all.length - parsed.highlight_segments.length;
  parsed.eval_model = (response as any).__model || undefined;
  parsed.evidence_truncated = transcript.length >= 60000;
  return parsed;
}

// Draft saving (does not submit)
app.post("/api/submissions/draft", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên mới lưu nháp.");
  const { assignment_id, submitted_files, submitted_text, notes } = req.body || {};
  const assignment = db.assignments.find((a: any) => a.id === assignment_id);
  if (!assignment || !isMember(assignment.course_id, req.user)) return fail(res, 404, "Không tìm thấy bài tập.");
  let sub = db.submissions.find((s: any) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (sub && isSubmitted(sub)) return fail(res, 409, "Bài đã được nộp, không thể lưu nháp.");
  if (!sub) {
    sub = {
      id: uid("sub"), assignment_id, student_id: req.user.id, student_name: req.user.name,
      student_email: req.user.email, student_avatar: req.user.avatar, submitted_files: [], submitted_text: "", status: "draft",
    };
    db.submissions.push(sub);
  }
  sub.submitted_files = Array.isArray(submitted_files) ? submitted_files : sub.submitted_files;
  sub.submitted_text = submitted_text ?? sub.submitted_text;
  sub.notes = notes ?? sub.notes;
  sub.draft_saved_at = nowIso();
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: { draft_saved_at: sub.draft_saved_at } });
});

// ---- "Viết L2": prompt -> critique -> revise ----------------------------------
const l2Lang = (a: any) => (a.l2?.prompt_language === "bilingual"
  ? "Reply in the language the student used (English or Vietnamese)."
  : "Reply in English only. If the student writes in another language, still answer in English and remind them to write prompts in English.");

function l2ChatInstruction(assignment: any, course: any, phase: "prompt" | "critique") {
  if (phase === "prompt") {
    return `You are an AI writing assistant in a second-language (L2) writing course (${course?.name || "course"}). The student must complete this writing task: """${assignment.description}""".
In this step you may ONLY help with planning: brainstorm ideas and give a short bullet-point OUTLINE (at most 6 bullets, phrases not sentences).
NEVER write full sentences or paragraphs of the final text, even if asked; say that in this step you can only help with an outline.
If the request is vague, ask ONE short clarifying question about the goal, the reader or the constraints.
${l2Lang(assignment)}`;
  }
  return `You are a Socratic tutor. The student is critically reading the following AI-generated text to find hidden problems (language errors, logical errors, invented facts).
TEXT: """${assignment.l2.ai_text}"""
Rules: NEVER say which word, sentence or claim is wrong, never list errors, and never confirm or deny that a specific phrase is an error. Ask one or two short guiding questions and suggest strategies (check articles and agreement, check connectors and logic, verify numbers, names and sources). Keep answers brief.
${l2Lang(assignment)}`;
}

/** What a student may see about their own result: caught errors with the answer; missed ones only after the deadline. */
function studentL2Feedback(assignment: any, sub: any) {
  const errors: L2Error[] = assignment.l2?.errors || [];
  const rep: L2ErrorReport | undefined = sub.l2_report;
  if (!rep) return null;
  const byId = new Map(errors.map((e) => [e.id, e]));
  const afterDeadline = Date.now() > new Date(assignment.due_date).getTime();
  return {
    total: rep.total,
    caught: rep.caught.map((c) => { const e = byId.get(c.error_id); return { type: e?.type, text: e?.text, answer: e?.answer, note: c.note }; }),
    missed_count: rep.missed.length,
    missed: afterDeadline ? rep.missed.map((id) => { const e = byId.get(id); return { type: e?.type, text: e?.text, answer: e?.answer }; }) : [],
    false_positive_count: rep.false_positives.length,
    recall: rep.recall, precision: rep.precision,
  };
}

function computeL2Report(assignment: any, sub: any): L2ErrorReport {
  const l2: L2Config = assignment.l2;
  const work: L2Work = sub.l2_work;
  const m = matchErrors(l2.errors, work.highlights || []);
  const finalText = work.revision?.text || "";
  const normFinal = normWs(finalText).toLowerCase();
  const sim = wordSimilarity(l2.ai_text, finalText);
  const snaps = (work.revision?.snapshots || []).slice(-40);
  for (const sn of snaps) sn.sim = Math.round(wordSimilarity(l2.ai_text, sn.text) * 100) / 100;
  return {
    total: l2.errors.length,
    caught: m.caught.map((c) => ({ error_id: c.error.id, highlight_id: c.highlight.id, note: c.highlight.note })),
    missed: m.missed.map((e) => e.id),
    false_positives: m.false_positives.map((h) => h.id),
    recall: Math.round(m.recall * 100) / 100,
    precision: Math.round(m.precision * 100) / 100,
    remained: l2.errors.filter((e) => normFinal.includes(normWs(e.text).toLowerCase())).map((e) => e.id),
    similarity_to_original: Math.round(sim * 100) / 100,
    timeline: snaps.map((sn) => ({ t: sn.t, sim: sn.sim ?? 0 })),
    rewritten_from_scratch: sim < 0.35,
  };
}

async function evaluateL2(assignment: any, sub: any, chat: any, report: L2ErrorReport): Promise<L2Result> {
  if (!process.env.GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
  const l2: L2Config = assignment.l2;
  const work: L2Work = sub.l2_work;
  const msgs = (chat?.messages || []) as any[];
  const transcript = (phase: string) => msgs.filter((m) => m.phase === phase).map((m) => `${m.role === "user" ? "STUDENT" : "AI"}: ${m.content}`).join("\n").slice(-12000);
  const errById = new Map(l2.errors.map((e) => [e.id, e]));
  const evidence = {
    writing_task: assignment.description,
    prompt_language_policy: l2.prompt_language === "en" ? "English only" : "English or Vietnamese allowed",
    prompt_history: (work.prompt_history || []).map((p) => p.text),
    final_prompt: work.final_prompt,
    prompt_phase_chat: transcript("prompt"),
    ai_text: l2.ai_text,
    planted_errors: l2.errors.map((e) => ({ id: e.id, type: e.type, text: e.text, teacher_answer: e.answer })),
    student_highlights: (work.highlights || []).map((h) => ({ id: h.id, text: h.text, note: h.note })),
    critique_phase_chat: transcript("critique"),
    automatic_matching: {
      caught: report.caught.map((c) => ({ error_id: c.error_id, error_text: errById.get(c.error_id)?.text, student_note: c.note })),
      missed_error_ids: report.missed,
      false_positive_highlight_ids: report.false_positives,
      recall: report.recall, precision: report.precision,
    },
    final_text: work.revision?.text,
    similarity_to_original_0_to_1: report.similarity_to_original,
    planted_errors_still_in_final_text: report.remained,
    rewritten_from_scratch: report.rewritten_from_scratch,
  };
  const rubric = l2.dimensions.map((d, i) => `${i + 1}. ${d.key} — ${d.name}: ${d.description}\n` + d.levels.map((lv, k) => `   ${k + 1} = ${lv}`).join("\n")).join("\n");
  const instruction = `Bạn chấm một bài "Viết L2" (viết bằng ngoại ngữ có AI hỗ trợ) theo 5 chiều, thang 1-5, đúng theo bảng tiêu chí dưới đây. Hãy nghiêm khắc và trung thực, chỉ dựa trên bằng chứng được cung cấp.

BẢNG TIÊU CHÍ:
${rubric}

QUY TẮC:
- Chiều prompt_quality và prompt_iteration chỉ chấm từ nhật ký prompt. Đánh giá ý định, bối cảnh, ràng buộc và chiến lược; KHÔNG trừ điểm vì ngữ pháp hay trình độ ngoại ngữ.
- Chiều error_detection: dùng kết quả đối chiếu tự động ("automatic_matching") làm căn cứ chính, không tự đoán lại lỗi nào được bắt. Nếu recall = 0 thì điểm tối đa là 2. Precision thấp (đánh dấu nhầm nhiều) thì hạ điểm.
- Chiều critical_reasoning: chỉ xét các lỗi đã bắt; so ghi chú của sinh viên với "teacher_answer" (gọi đúng loại lỗi? giải thích đúng? đề xuất cách sửa/kiểm chứng?). Không có ghi chú nào thì điểm 1.
- Chiều revision_ownership: dựa trên final_text so với ai_text, "planted_errors_still_in_final_text" và "similarity_to_original". Lỗi còn nguyên thì hạ điểm; rewritten_from_scratch = true thì điểm tối đa là 2.
- Mỗi chiều: "score" (số nguyên 1-5), "comment" (2 câu tiếng Việt, nêu lý do), "evidence" (1-3 mục: "quote" trích NGUYÊN VĂN từ bằng chứng, "mau" = xanh (điểm mạnh) | vang (cần làm rõ) | do (vấn đề), "ly_do").
- "overall_comment": 2-3 câu tiếng Việt tóm tắt điểm mạnh và việc cần cải thiện.
- Phải trả đủ cả 5 chiều với đúng "key" như bảng.`;
  const response = await generateWithFallback({
    contents: [{ role: "user", parts: [{ text: `${instruction}\n\nBẰNG CHỨNG (JSON):\n${scrub(JSON.stringify(evidence), whoIs(sub.student_id))}` }] }],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dimensions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING }, score: { type: Type.INTEGER }, comment: { type: Type.STRING },
                evidence: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { quote: { type: Type.STRING }, mau: { type: Type.STRING }, ly_do: { type: Type.STRING } }, required: ["quote", "mau", "ly_do"] } },
              },
              required: ["key", "score", "comment", "evidence"],
            },
          },
          overall_comment: { type: Type.STRING },
        },
        required: ["dimensions", "overall_comment"],
      },
    },
  }, 60000);
  if (!response.text) throw new Error("AI trả về nội dung rỗng.");
  const parsed = JSON.parse(response.text.trim());
  const dims = DEFAULT_L2_DIMENSIONS.map((d) => {
    const r = (parsed.dimensions || []).find((x: any) => x?.key === d.key);
    if (!r) throw new Error(`AI không trả về chiều "${d.key}".`);
    return {
      key: d.key,
      score: Math.max(1, Math.min(5, Math.round(Number(r.score) || 1))),
      comment: String(r.comment || ""),
      evidence: (Array.isArray(r.evidence) ? r.evidence : []).slice(0, 3).map((ev: any) => ({ quote: String(ev?.quote || ""), mau: ["xanh", "vang", "do"].includes(ev?.mau) ? ev.mau : "vang", ly_do: String(ev?.ly_do || "") })),
    };
  });
  // Hard guard-rails so that a lenient model cannot contradict the objective evidence
  const d3 = dims.find((d) => d.key === "error_detection")!;
  if (report.recall === 0) d3.score = Math.min(d3.score, 2);
  const d5 = dims.find((d) => d.key === "revision_ownership")!;
  if (report.rewritten_from_scratch) d5.score = Math.min(d5.score, 2);
  return { dimensions: dims, overall_comment: String(parsed.overall_comment || "") };
}

/** Common checks for the student-side L2 endpoints. Returns the draft submission (created on demand). */
function l2Student(req: AuthedRequest, res: express.Response): { assignment: any; sub: any } | null {
  if (req.user.role !== "student") { fail(res, 403, "Chỉ sinh viên mới làm bài này."); return null; }
  if (!can(req.user, "submit")) { denied(res); return null; }
  const assignment = db.assignments.find((a: any) => a.id === req.params.id);
  if (!assignment || assignment.submission_mode !== "writing_l2" || !assignment.l2) { fail(res, 404, "Không tìm thấy bài tập Viết L2."); return null; }
  if (!isMember(assignment.course_id, req.user)) { fail(res, 403, "Bạn không thuộc môn học này."); return null; }
  if (new Date() > new Date(assignment.due_date) && assignment.allow_late === false) { fail(res, 403, "Bài tập đã khóa sau hạn nộp."); return null; }
  let sub = db.submissions.find((s: any) => s.assignment_id === assignment.id && s.student_id === req.user.id);
  if (sub && isSubmitted(sub)) { fail(res, 409, "Bạn đã nộp bài này rồi."); return null; }
  if (!sub) {
    sub = { id: uid("sub"), assignment_id: assignment.id, student_id: req.user.id, student_name: req.user.name, student_email: req.user.email, student_avatar: req.user.avatar, submitted_files: [], submitted_text: "", status: "draft" };
    db.submissions.push(sub);
  }
  if (!sub.l2_work) sub.l2_work = { step: 1, highlights: [], revision: { text: "", snapshots: [], stats: { typed: 0, deleted: 0, pasted: 0 } }, step_times: { s1: nowIso() } };
  return { assignment, sub };
}

app.post("/api/l2/:id/lock-prompt", (req: AuthedRequest, res) => {
  const ctx = l2Student(req, res); if (!ctx) return;
  const { assignment, sub } = ctx;
  const work: L2Work = sub.l2_work;
  if (work.step !== 1) return fail(res, 409, "Bước 1 đã được chốt.");
  const finalPrompt = String(req.body?.final_prompt ?? "").trim();
  if (finalPrompt.length < 5) return fail(res, 400, "Hãy nhập prompt cuối cùng của bạn (tối thiểu 5 ký tự).");
  const chat = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment.id && cs.student_id === req.user.id);
  const prompts = (chat?.messages || []).filter((m: any) => m.phase === "prompt" && m.role === "user");
  if (prompts.length < 1) return fail(res, 400, "Hãy trao đổi với trợ lý AI ít nhất một lần trước khi chốt prompt.");
  work.final_prompt = finalPrompt.slice(0, 4000);
  work.prompt_history = prompts.map((m: any) => ({ text: String(m.content).slice(0, 4000), at: m.timestamp }));
  work.step = 2;
  work.step_times = { ...work.step_times, s2: nowIso() };
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: sub });
});

app.put("/api/l2/:id/critique", (req: AuthedRequest, res) => {
  const ctx = l2Student(req, res); if (!ctx) return;
  const { assignment, sub } = ctx;
  const work: L2Work = sub.l2_work;
  if (work.step !== 2) return fail(res, 409, "Bước phản biện chưa mở hoặc đã đóng.");
  const text: string = assignment.l2.ai_text;
  const raw = Array.isArray(req.body?.highlights) ? req.body.highlights.slice(0, 40) : [];
  const out: L2Highlight[] = [];
  for (const h of raw) {
    const start = Number(h?.start), end = Number(h?.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || end <= start) return fail(res, 400, "Vùng đánh dấu không hợp lệ.");
    out.push({ id: typeof h?.id === "string" && h.id ? h.id : uid("hl"), start, end, text: text.slice(start, end), note: String(h?.note ?? "").trim().slice(0, 500) });
  }
  out.sort((a, b) => a.start - b.start);
  for (let i = 1; i < out.length; i++) if (out[i].start < out[i - 1].end) return fail(res, 400, "Hai vùng đánh dấu không được chồng lên nhau.");
  work.highlights = out;
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: { highlights: out } });
});

app.post("/api/l2/:id/finish-critique", (req: AuthedRequest, res) => {
  const ctx = l2Student(req, res); if (!ctx) return;
  const { assignment, sub } = ctx;
  const work: L2Work = sub.l2_work;
  if (work.step !== 2) return fail(res, 409, "Bước phản biện chưa mở hoặc đã đóng.");
  if (!work.highlights.length) return fail(res, 400, "Hãy đánh dấu ít nhất một đoạn nghi ngờ trước khi sang bước chỉnh sửa.");
  if (work.highlights.some((h) => !h.note)) return fail(res, 400, "Mỗi đoạn đánh dấu cần có ghi chú lý do.");
  work.step = 3;
  work.revision = { text: assignment.l2.ai_text, snapshots: [{ t: nowIso(), text: assignment.l2.ai_text }], stats: { typed: 0, deleted: 0, pasted: 0 } };
  work.step_times = { ...work.step_times, s3: nowIso() };
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: sub });
});

app.put("/api/l2/:id/revision", (req: AuthedRequest, res) => {
  const ctx = l2Student(req, res); if (!ctx) return;
  const { sub } = ctx;
  const work: L2Work = sub.l2_work;
  if (work.step !== 3) return fail(res, 409, "Bước chỉnh sửa chưa mở.");
  const text = String(req.body?.text ?? "");
  if (text.length > 20000) return fail(res, 413, "Văn bản quá dài.");
  const snaps = (Array.isArray(req.body?.snapshots) ? req.body.snapshots : []).slice(-60).map((x: any) => ({ t: String(x?.t || nowIso()), text: String(x?.text ?? "").slice(0, 6000) }));
  const n = (v: any) => Math.max(0, Math.min(1e7, Math.floor(Number(v) || 0)));
  work.revision = { text, snapshots: snaps.length ? snaps : work.revision.snapshots, stats: { typed: n(req.body?.stats?.typed), deleted: n(req.body?.stats?.deleted), pasted: n(req.body?.stats?.pasted) } };
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: { saved_at: nowIso() } });
});

async function submitL2(req: AuthedRequest, res: express.Response, assignment: any, sub: any | undefined, isLate: boolean) {
  const work: L2Work | undefined = sub?.l2_work;
  if (!sub || !work || work.step !== 3) return fail(res, 400, "Bạn cần hoàn thành cả 3 bước trước khi nộp.");
  if (!work.revision.text.trim()) return fail(res, 400, "Bản chỉnh sửa đang trống.");
  const chat = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment.id && cs.student_id === req.user.id);
  const report = computeL2Report(assignment, sub);
  let result: L2Result | undefined, evalStatus = "ok", evalError: string | undefined;
  try { result = await evaluateL2(assignment, sub, chat, report); }
  catch (e: any) { console.error("L2 evaluation error:", e?.message || e); evalStatus = "failed"; evalError = e?.message || "Lỗi không xác định"; }
  Object.assign(sub, {
    submitted_at: nowIso(), submitted_text: work.revision.text, submitted_files: [], chat_session_id: chat?.id,
    l2_report: report, l2_result: result, eval_status: evalStatus, eval_error: evalError, status: isLate ? "late" : "submitted",
  });
  if (chat) { chat.submission_id = sub.id; saveDocument("chat_sessions", chat.id, chat); }
  saveDocument("submissions", sub.id, sub);
  const course = findCourse(assignment.course_id);
  if (course) addNotification(course.teacher_id, "Có bài nộp mới", `${req.user.name} đã nộp "${assignment.title}"${isLate ? " (trễ hạn)" : ""}.`, `/course/${course.id}/assignment/${assignment.id}`);
  res.json({ success: true, data: sub, message: evalStatus === "failed" ? "Nộp bài thành công. Phần chấm bằng AI sẽ được giảng viên chạy lại sau." : "Nộp bài thành công!" });
}

app.put("/api/submissions/:id/l2-scores", (req: AuthedRequest, res) => {
  const sub = db.submissions.find((s: any) => s.id === req.params.id);
  if (!sub) return fail(res, 404, "Bài nộp không tồn tại.");
  const assignment = db.assignments.find((a: any) => a.id === sub.assignment_id);
  if (!assignment?.l2 || !isOwner(findCourse(assignment.course_id), req.user)) return fail(res, 403, "Bạn không có quyền chấm bài này.");
  if (!can(req.user, "grade")) return denied(res);
  const scores: Record<string, number> = {};
  for (const d of DEFAULT_L2_DIMENSIONS) {
    const v = req.body?.scores?.[d.key];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) return fail(res, 400, "Điểm mỗi chiều phải là số nguyên từ 1 đến 5.");
    scores[d.key] = n;
  }
  sub.l2_teacher_scores = scores;
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: sub, message: "Đã lưu điểm từng chiều." });
});

// ---- AI chat ----
const chatHits = new Map<string, number[]>();
function chatRateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (chatHits.get(userId) || []).filter((t) => now - t < 5 * 60 * 1000);
  if (hits.length >= (Number(process.env.CHAT_RATE_MAX) || 25)) { chatHits.set(userId, hits); return true; }
  hits.push(now);
  chatHits.set(userId, hits);
  return false;
}

/**
 * What a user may see of a chat. Students never receive the hidden part of a gated answer:
 * the server keeps the full draft, and sends only the opening plus how many characters are hidden.
 */
function publicChat(cs: any, user: any) {
  if (!cs || user?.role !== "student") return cs;
  return {
    ...cs,
    messages: cs.messages.map((m: any) => {
      const g: GateInfo | undefined = m.gate;
      if (!g) return m;
      if (g.state === "locked") return { ...m, content: g.teaser, gate: { state: "locked", questions: g.questions, teaser: g.teaser, hidden_chars: Math.max(0, (g.draft?.length || 0) - (g.teaser?.length || 0)) } };
      const { draft, ...rest } = g;
      return { ...m, gate: rest };
    }),
  };
}

const parseJson = (t: string | undefined) => { try { return JSON.parse(t || ""); } catch { return null; } };
const strList = (v: any, max: number, len = 400): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim().slice(0, len) : "")).filter(Boolean).slice(0, max) : []);

/** Writes a complete, correct answer whose first ~30% is the most intriguing part, plus the questions that unlock the rest. */
async function generateGatedAnswer(assignment: any, course: any, chatSession: any): Promise<{ answer: string; questions: string[] }> {
  const addendum = `
QUY TẮC RIÊNG CHO LƯỢT NÀY (ưu tiên hơn các chỉ dẫn trên): câu trả lời của bạn sẽ được chia hai phần. Khoảng 30% đầu sinh viên đọc ngay; phần còn lại bị khóa cho tới khi sinh viên nêu ý riêng.
- Viết câu trả lời ĐẦY ĐỦ và CHÍNH XÁC về kiến thức, khoảng 250-400 từ, markdown gọn, không dùng tiêu đề ở đầu.
- Phần ĐẦU (khoảng 60-90 từ, tức 3-4 dòng) phải là phần hay nhất và gây tò mò: mở bằng một nhận định bất ngờ, một ví dụ sống động hoặc một câu hỏi sắc; dừng ở chỗ khiến người đọc muốn biết tiếp, nhưng vẫn đúng và tự đủ nghĩa. Không tiết lộ kết luận ở phần này, không chiêu trò câu khách.
- Đưa 2-3 "questions": mỗi câu ngắn, cụ thể cho chủ đề này, để sinh viên nêu quan điểm của chính mình (ví dụ: em nghiêng về hướng nào và vì sao; em định dùng ví dụ nào). Không hỏi chung chung.`;
  const response = await generateWithFallback({
    contents: aiContents(chatSession),
    config: {
      systemInstruction: chatInstruction(assignment, course, chatSession) + addendum,
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { answer: { type: Type.STRING }, questions: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["answer", "questions"] },
    },
  });
  const j = parseJson(response.text);
  const answer = typeof j?.answer === "string" ? j.answer.trim() : "";
  const questions = strList(j?.questions, 3, 200);
  if (answer.length < 120 || questions.length === 0) throw new Error("AI trả về câu trả lời không hợp lệ.");
  return { answer, questions };
}

/** Rewrites the draft around the student's own ideas, keeping it correct, and suggests other angles. */
async function generatePersonalized(assignment: any, course: any, chatSession: any, askedBy: string, draft: string, answers: { q: string; a: string }[]) {
  const rules = `
NHIỆM VỤ: sinh viên đã đọc phần mở đầu của một câu trả lời nháp và đã nêu ý riêng của họ. Hãy viết ĐÁP ÁN CUỐI CÙNG cho sinh viên đọc:
- Dùng chính ý tưởng, quan điểm và cách đặt vấn đề của sinh viên làm khung; tinh chỉnh bản nháp cho khớp với ý họ, giọng văn tự nhiên, gọi sinh viên là "em" nếu hợp.
- NỘI DUNG PHẢI CHÍNH XÁC. Nếu ý nào của sinh viên chưa đúng hoặc thiếu căn cứ, đừng chiều theo: nêu nhẹ nhàng trong "correction" điều cần chỉnh, và đáp án vẫn phải đúng.
- "used_ideas": 1-4 ý của sinh viên mà đáp án đã dùng (diễn đạt ngắn).
- "alternatives": 2-3 hướng khác sinh viên có thể cân nhắc khi trả lời bài này, mỗi hướng 1-2 câu, nêu vì sao đáng thử.
- "correction": chuỗi rỗng nếu ý của sinh viên đều ổn.`;
  const prompt = `Câu hỏi của sinh viên: ${askedBy}\n\nBản nháp câu trả lời của AI:\n${draft}\n\nÝ riêng của sinh viên:\n${answers.map((x) => `- ${x.q}\n  ${x.a}`).join("\n")}`;
  const response = await generateWithFallback({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: chatInstruction(assignment, course, chatSession) + rules,
      temperature: 0.6,
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { answer: { type: Type.STRING }, used_ideas: { type: Type.ARRAY, items: { type: Type.STRING } }, alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }, correction: { type: Type.STRING } }, required: ["answer", "used_ideas", "alternatives", "correction"] },
    },
  });
  const j = parseJson(response.text);
  const answer = typeof j?.answer === "string" ? j.answer.trim() : "";
  if (answer.length < 80) throw new Error("AI trả về đáp án không hợp lệ.");
  return { answer, used_ideas: strList(j?.used_ideas, 4, 200), alternatives: strList(j?.alternatives, 3, 400), correction: typeof j?.correction === "string" ? j.correction.trim().slice(0, 600) : "" };
}

/** System prompt for plain (non-L2) assignment chat. When the student wrote their own ideas first, the AI builds on them. */
/** Students must accept how their learning data is stored and processed before anything of theirs reaches the AI. */
function needConsent(req: AuthedRequest, res: express.Response): boolean {
  if (req.user.role === "student" && !req.user.consent_at) { fail(res, 403, "Bạn cần đồng ý với cách TraceEdu lưu và xử lý dữ liệu học tập trước khi tiếp tục.", "consent_required"); return true; }
  return false;
}
const whoIs = (studentId?: string) => { const u = db.users.find((x: any) => x.id === studentId); return { name: u?.name, email: u?.email }; };
/** Messages as the AI sees them: Are-you-sure turns belong to their own stage, and names / emails / phone numbers never leave the server. */
function aiContents(chat: any, keep: (m: any) => boolean = () => true) {
  const who = whoIs(chat?.student_id);
  return (chat?.messages || []).filter((m: any) => m.stage !== "are_you_sure" && keep(m)).map((m: any) => ({ role: m.role, parts: [{ text: m.role === "user" ? scrub(m.content, who) : m.content }] }));
}

/** One short, evidence-based observation about the student's latest turn. Returns null on any failure: coaching is optional. */
async function coachTurn(assignment: any, chatSession: any, text: string): Promise<CoachNote | null> {
  if (text.trim().length < 12 || !(process.env.GEMINI_API_KEY || process.env.AI_MOCK === "1")) return null;
  try {
    const recent = chatSession.messages.slice(-7, -1).map((m: any) => `${m.role === "user" ? "SV" : "AI"}: ${scrub(String(m.content).slice(0, 400), whoIs(chatSession.student_id))}`).join("\n");
    const who = whoIs(chatSession.student_id); text = scrub(text, who);
    const prompt = `Bạn là người quan sát quá trình tư duy của sinh viên khi làm bài "${assignment.title}" cùng trợ lý AI. Chỉ nhận xét LƯỢT MỚI NHẤT của sinh viên (bên dưới), dựa trên 5 tiêu chí: tu_duy_phan_bien, dao_sau_van_de, kiem_chung_thong_tin, noi_hoa_kien_thuc, tinh_chu_dong.
Chọn đúng MỘT tiêu chí nổi bật nhất ở lượt này.
- level: "good" nếu lượt này thể hiện tốt tiêu chí đó; "weak" nếu còn yếu hoặc thiếu; "warn" nếu sinh viên đang nhờ AI làm hộ hoặc xin đáp án.
- quote: trích NGUYÊN VĂN một cụm từ 3-12 chữ có trong lượt mới nhất làm bằng chứng (để trống nếu không có cụm nào phù hợp).
- note: một câu tiếng Việt, nói rõ vì sao, không khen chung chung.
- tip: một việc nhỏ cụ thể sinh viên có thể làm ngay ở lượt sau. Tuyệt đối không đưa đáp án của bài.
Ngữ cảnh gần đây:\n${recent || "(đầu cuộc trò chuyện)"}\n\nLƯỢT MỚI NHẤT CỦA SINH VIÊN:\n${text.slice(0, 1200)}`;
    const call = generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.2, responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { level: { type: Type.STRING }, criterion: { type: Type.STRING }, quote: { type: Type.STRING }, note: { type: Type.STRING }, tip: { type: Type.STRING } }, required: ["level", "criterion", "note"] } },
    }, 9000);
    const r: any = await Promise.race([call, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("coach timeout")), 12000))]);
    return cleanCoach(JSON.parse(String(r.text || "").trim()), text);
  } catch (e: any) { console.warn("[Coach] skipped:", e?.message || e); return null; }
}

/** What this student has shown across the assignments that were already evaluated (not counting the current one). */
function profileFor(studentId: string, excludeAssignmentId?: string): LearningProfile {
  const items = db.submissions
    .filter((x: any) => x.student_id === studentId && x.process_score_result?.tieu_chi && x.assignment_id !== excludeAssignmentId)
    .map((x: any) => ({ assignment_title: db.assignments.find((a: any) => a.id === x.assignment_id)?.title || "", at: x.submitted_at, process_score: x.process_score_result.process_score, tieu_chi: x.process_score_result.tieu_chi }));
  return buildProfile(items);
}

function chatInstruction(assignment: any, course: any, chatSession: any, extra: { query?: string; retry?: boolean } = {}): string {
  const base = assignment.ai_submode === "socratic"
    ? `Bạn là trợ lý học tập AI trong môn ${course.name}, hỗ trợ sinh viên làm bài tập: ${assignment.title}. Mô tả bài tập: ${assignment.description}.
Khi sinh viên hỏi, đừng đưa đáp án ngay. Đặt 1-2 câu hỏi gợi mở để sinh viên tự suy nghĩ trước. Chỉ đưa đáp án/hướng dẫn chi tiết sau khi sinh viên đã thử trả lời. Nếu sinh viên yêu cầu đáp án ngay, nhắc nhẹ nhàng về lợi ích tự tư duy trước, sau đó vẫn hỗ trợ nếu họ thực sự cần.
Trả lời bằng tiếng Việt thân thiện, rõ ràng, mang tính giáo dục.`
    : `Bạn là trợ lý học tập AI nhiệt tình trong môn ${course.name}, hỗ trợ sinh viên làm bài tập: ${assignment.title}.
Giải đáp thắc mắc, gợi ý hướng giải quyết và cung cấp tài liệu tham khảo chính xác. Trả lời bằng tiếng Việt chuyên nghiệp, ngắn gọn.`;
  const rubric = assignment.rubric?.trim() ? `\nTiêu chí chấm của giảng viên cho bài này: ${String(assignment.rubric).slice(0, 1500)}\nHãy dẫn dắt sinh viên theo hướng đáp ứng các tiêu chí đó, nhưng đừng làm hộ.` : "";
  const query = extra.query ?? [...(chatSession?.messages || [])].reverse().find((m: any) => m.role === "user")?.content ?? "";
  const mats = materialsBlock(course.materials, `${assignment.title} ${query}`);
  const mem = chatSession?.student_id ? memoryNote(profileFor(chatSession.student_id, assignment.id)) : "";
  const rules = assignment.ai_submode === "socratic" ? SOCRATIC_RULES : "";
  const retry = extra.retry ? "\nBẠN VỪA ĐƯA ĐÁP ÁN trực tiếp ở lần trả lời trước, và điều đó vi phạm chế độ Socratic. Hãy trả lời lại: chỉ ghi nhận, đặt câu hỏi gợi mở và đưa tối đa một gợi ý nhỏ, không đưa lời giải." : "";
  const full = base + rubric + mats + mem;
  const intent: ChatIntent | undefined = chatSession?.intent;
  if (!intent || intent.skipped || !intent.answers?.length) return full + rules + retry;
  return `${full}
Sinh viên đã tự ghi ý riêng của mình TRƯỚC khi hỏi bạn (tin nhắn đầu tiên của họ). Hãy dùng chính ý của họ làm nền: ghi nhận điểm đúng, chỉ ra điểm còn yếu hoặc thiếu, rồi giúp họ NÂNG CẤP lập luận của chính họ thay vì viết lại từ đầu. Không đưa bài hoàn chỉnh thay họ.` + rules + retry;
}

app.post("/api/chat/intent", async (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên mới trò chuyện trong bài tập.");
  if (!can(req.user, "use_ai_chat")) return denied(res);
  if (needConsent(req, res)) return;
  const { assignment_id } = req.body || {};
  const assignment = db.assignments.find((a: any) => a.id === assignment_id);
  if (!assignment) return fail(res, 404, "Bài tập không tìm thấy.");
  const course = findCourse(assignment.course_id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 403, "Bạn không thuộc môn học này.");
  if (!assignment.friction || assignment.friction === "none") return fail(res, 400, "Bài tập này không yêu cầu ghi ý trước.");
  const existing = db.submissions.find((s: any) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (existing && isSubmitted(existing)) return fail(res, 409, "Bài đã nộp, cuộc trò chuyện đã được khóa.");
  if (chatRateLimited(req.user.id)) return fail(res, 429, "Bạn gửi quá nhanh, vui lòng đợi vài phút rồi thử lại.");

  let chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  if (chatSession?.intent) return fail(res, 409, "Bạn đã ghi ý ban đầu cho bài này rồi.");
  const pasted = Math.max(0, Math.round(Number(req.body?.pasted_chars) || 0));
  if (assignment.paste_mode === "block" && pasted > 0) return fail(res, 400, "Bài này khóa dán và sao chép. Hãy tự viết bằng lời của bạn.");
  const pasteAttempts = Math.min(50, Math.max(0, Math.round(Number(req.body?.paste_attempts) || 0)));
  const prompts: string[] = assignment.friction_prompts?.length ? assignment.friction_prompts : cleanFrictionPrompts(undefined);

  // Skipping is only allowed at the "nudge" level, and the skip itself is recorded
  if (req.body?.skip === true) {
    if (assignment.friction === "required") return fail(res, 400, "Bài tập này yêu cầu bạn ghi ý riêng trước.");
    if (!chatSession) { chatSession = { id: uid("cs"), assignment_id, student_id: req.user.id, messages: [] }; db.chat_sessions.push(chatSession); }
    chatSession.intent = { answers: [], skipped: true, at: nowIso() } satisfies ChatIntent;
    saveDocument("chat_sessions", chatSession.id, chatSession);
    return res.json({ success: true, data: { chat_session: publicChat(chatSession, req.user) } });
  }

  const raw = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const answers = prompts.map((q, i) => ({ q, a: typeof raw[i] === "string" ? raw[i].trim().slice(0, 2000) : "" })).filter((x) => x.a);
  const need = Math.min(FRICTION_MIN_ANSWERS, prompts.length);
  if (answers.length < need || answers.reduce((n, x) => n + x.a.length, 0) < FRICTION_MIN_CHARS) {
    return fail(res, 400, `Hãy trả lời ít nhất ${need} câu và viết đủ ý (tối thiểu ${FRICTION_MIN_CHARS} ký tự) để mở trợ lý AI.`);
  }

  const isNew = !chatSession;
  if (!chatSession) { chatSession = { id: uid("cs"), assignment_id, student_id: req.user.id, messages: [] }; db.chat_sessions.push(chatSession); }
  const content = "**Ý ban đầu của em (trước khi hỏi AI)**\n\n" + answers.map((x) => `- ${x.q}\n  ${x.a.replace(/\n/g, "\n  ")}`).join("\n");
  const userMsg: any = { id: uid("m"), role: "user" as const, kind: "intent", content, timestamp: nowIso() };
  const prevMessages = chatSession.messages;
  const prevIntent = chatSession.intent;
  chatSession.intent = { answers, skipped: false, pasted_chars: pasted || undefined, paste_attempts: pasteAttempts || undefined, at: nowIso() } satisfies ChatIntent;
  chatSession.messages = [...prevMessages, userMsg];

  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
    const response = await generateWithFallback({
      contents: aiContents(chatSession),
      config: { systemInstruction: chatInstruction(assignment, course, chatSession), temperature: 0.7 },
    });
    const replyText = response.text;
    if (!replyText) throw new Error("AI trả về nội dung rỗng.");
    const aiMsg: any = { id: uid("m"), role: "model" as const, content: replyText, timestamp: nowIso() };
    chatSession.messages.push(aiMsg);
    saveDocument("chat_sessions", chatSession.id, chatSession);
    res.json({ success: true, data: { chat_session: publicChat(chatSession, req.user), new_message: aiMsg } });
  } catch (err: any) {
    console.error("Gemini Intent Error:", err?.message || err);
    // Roll back so the student can simply retry
    chatSession.messages = prevMessages; chatSession.intent = prevIntent;
    if (isNew) db.chat_sessions = db.chat_sessions.filter((cs: any) => cs.id !== chatSession.id);
    fail(res, 502, "Trợ lý AI tạm thời không phản hồi được. Ý của bạn chưa được ghi nhận, hãy thử gửi lại.");
  }
});

app.post("/api/chat/unlock", async (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên mới trò chuyện trong bài tập.");
  if (!can(req.user, "use_ai_chat")) return denied(res);
  if (needConsent(req, res)) return;
  const { assignment_id, message_id } = req.body || {};
  const assignment = db.assignments.find((a: any) => a.id === assignment_id);
  if (!assignment) return fail(res, 404, "Bài tập không tìm thấy.");
  const course = findCourse(assignment.course_id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 403, "Bạn không thuộc môn học này.");
  if (!assignment.answer_gate || assignment.answer_gate === "none") return fail(res, 400, "Bài tập này không che câu trả lời của AI.");
  const existing = db.submissions.find((s: any) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (existing && isSubmitted(existing)) return fail(res, 409, "Bài đã nộp, cuộc trò chuyện đã được khóa.");
  const chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  const idx = chatSession ? chatSession.messages.findIndex((m: any) => m.id === message_id) : -1;
  const msg = idx >= 0 ? chatSession.messages[idx] : null;
  if (!msg || msg.role !== "model" || !msg.gate) return fail(res, 404, "Không tìm thấy câu trả lời cần mở khóa.");
  const g: GateInfo = msg.gate;
  if (g.state !== "locked") return fail(res, 409, "Câu trả lời này đã được mở khóa rồi.");
  if (chatRateLimited(req.user.id)) return fail(res, 429, "Bạn gửi quá nhanh, vui lòng đợi vài phút rồi thử lại.");

  // Optional gate: the student may read the full draft without answering; the skip is recorded
  if (req.body?.skip === true) {
    if (assignment.answer_gate === "required") return fail(res, 400, "Bài tập này yêu cầu bạn trả lời các câu hỏi trước.");
    msg.content = g.draft;
    msg.gate = { ...g, state: "unlocked", skipped: true, unlocked_at: nowIso() };
    saveDocument("chat_sessions", chatSession.id, chatSession);
    return res.json({ success: true, data: { chat_session: publicChat(chatSession, req.user) } });
  }

  const raw = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const answers = g.questions.map((q, i) => ({ q, a: typeof raw[i] === "string" ? raw[i].trim().slice(0, 2000) : "" })).filter((x) => x.a);
  const need = Math.min(GATE_MIN_ANSWERS, g.questions.length);
  if (answers.length < need || answers.reduce((n, x) => n + x.a.length, 0) < GATE_MIN_CHARS) {
    return fail(res, 400, `Hãy trả lời ít nhất ${need} câu và viết đủ ý (tối thiểu ${GATE_MIN_CHARS} ký tự) để mở khóa.`);
  }
  const askedBy = [...chatSession.messages.slice(0, idx)].reverse().find((m: any) => m.role === "user" && m.kind !== "intent")?.content || "";
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
    const out = await generatePersonalized(assignment, course, chatSession, askedBy, g.draft || "", answers);
    msg.content = out.answer;
    msg.gate = { ...g, state: "unlocked", answers, used_ideas: out.used_ideas, alternatives: out.alternatives, correction: out.correction || undefined, unlocked_at: nowIso() } satisfies GateInfo;
    saveDocument("chat_sessions", chatSession.id, chatSession);
    res.json({ success: true, data: { chat_session: publicChat(chatSession, req.user) } });
  } catch (err: any) {
    console.error("Gemini Unlock Error:", err?.message || err);
    fail(res, 502, "Trợ lý AI tạm thời không phản hồi được. Ý của bạn chưa được ghi nhận, hãy thử gửi lại.");
  }
});

app.post("/api/chat/message", async (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên mới trò chuyện trong bài tập.");
  if (!can(req.user, "use_ai_chat")) return denied(res);
  if (needConsent(req, res)) return;
  const { assignment_id, message_content } = req.body || {};
  const phase: "prompt" | "critique" | undefined = req.body?.phase === "critique" ? "critique" : req.body?.phase === "prompt" ? "prompt" : undefined;
  if (!assignment_id || !message_content || typeof message_content !== "string") return fail(res, 400, "Thiếu thông tin tin nhắn.");
  if (message_content.length > 30000) return fail(res, 413, "Tin nhắn quá dài (tối đa 30.000 ký tự).");
  const assignment = db.assignments.find((a: any) => a.id === assignment_id);
  if (!assignment) return fail(res, 404, "Bài tập không tìm thấy.");
  const course = findCourse(assignment.course_id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 403, "Bạn không thuộc môn học này.");
  if (assignment.submission_mode === "file_only") return fail(res, 400, "Bài tập này chỉ nộp file, không có AI chat.");
  const existing = db.submissions.find((s: any) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (existing && isSubmitted(existing)) return fail(res, 409, "Bài đã nộp, cuộc trò chuyện đã được khóa.");
  const isL2 = assignment.submission_mode === "writing_l2" && !!assignment.l2;
  if (isL2) {
    if (!phase) return fail(res, 400, "Thiếu thông tin bước làm bài.");
    const step = existing?.l2_work?.step ?? 1;
    if ((phase === "prompt" && step !== 1) || (phase === "critique" && step !== 2)) return fail(res, 409, "Bước này chưa mở hoặc đã được chốt.");
  }
  if (chatRateLimited(req.user.id)) return fail(res, 429, "Bạn gửi quá nhanh, vui lòng đợi vài phút rồi thử lại.");

  let chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  if (!chatSession) {
    chatSession = { id: uid("cs"), assignment_id, student_id: req.user.id, messages: [] };
    db.chat_sessions.push(chatSession);
  }
  // Input friction: the server (not the UI) enforces that the student wrote their own ideas first
  if (!isL2 && assignment.friction && assignment.friction !== "none" && !chatSession.intent) {
    if (!chatSession.messages.length) db.chat_sessions = db.chat_sessions.filter((cs: any) => cs.id !== chatSession.id);
    return fail(res, 409, "Hãy ghi ý riêng của bạn trước khi hỏi trợ lý AI.");
  }
  const gated = !isL2 && !!assignment.answer_gate && assignment.answer_gate !== "none";
  if (gated) {
    const lastModel = [...chatSession.messages].reverse().find((m: any) => m.role === "model");
    if (lastModel?.gate?.state === "locked") return fail(res, 409, "Hãy trả lời các câu hỏi để mở khóa câu trả lời trước, rồi mới hỏi tiếp.");
  }
  const userMsg: any = { id: uid("m"), role: "user" as const, content: message_content, timestamp: nowIso() };
  if (isL2) userMsg.phase = phase; else userMsg.stage = "co_think";
  const pasted = Number(req.body?.pasted_chars);
  if (assignment.paste_mode === "block" && Number.isFinite(pasted) && pasted > 0) return fail(res, 400, "Bài này khóa dán và sao chép. Hãy tự viết bằng lời của bạn.");
  if (Number.isFinite(pasted) && pasted > 0) userMsg.pasted_chars = Math.min(Math.round(pasted), message_content.length);
  const attempts = Math.round(Number(req.body?.paste_attempts));
  if (Number.isFinite(attempts) && attempts > 0) userMsg.paste_attempts = Math.min(attempts, 50);
  const pressure = !isL2 ? detectPressure(message_content) : null;
  if (pressure) userMsg.pressure = pressure;
  chatSession.messages.push(userMsg);
  // The live coach reads the student's turn while the main answer is being written, so it adds no waiting time
  const coachPromise: Promise<CoachNote | null> = !isL2 && assignment.live_coach !== false ? coachTurn(assignment, chatSession, message_content) : Promise.resolve(null);

  const systemInstruction = isL2 ? l2ChatInstruction(assignment, course, phase!) : chatInstruction(assignment, course, chatSession);

  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
    let aiMsg: any;
    if (gated) {
      // Full answer stays on the server; the student gets the opening ~30% and the unlock questions
      const { answer, questions } = await generateGatedAnswer(assignment, course, chatSession);
      const teaser = makeTeaser(answer);
      aiMsg = { id: uid("m"), role: "model" as const, content: teaser, timestamp: nowIso(), stage: "co_think", gate: { state: "locked", questions, teaser, draft: answer } satisfies GateInfo };
    } else {
      const contents = aiContents(chatSession, (m: any) => !isL2 || m.phase === phase);
      const response = await generateWithFallback({ contents, config: { systemInstruction, temperature: 0.7 } });
      let replyText = response.text;
      if (!replyText) throw new Error("AI trả về nội dung rỗng.");
      let guard: "regenerated" | "fallback" | undefined;
      // Socratic guard: if the reply just hands over the answer, ask once more with a stricter instruction, then fall back
      if (!isL2 && assignment.ai_submode === "socratic" && looksLikeFullAnswer(replyText)) {
        const again = await generateWithFallback({ contents, config: { systemInstruction: chatInstruction(assignment, course, chatSession, { retry: true }), temperature: 0.4 } });
        if (again.text && !looksLikeFullAnswer(again.text)) { replyText = again.text; guard = "regenerated"; } else { replyText = SOCRATIC_FALLBACK; guard = "fallback"; }
      }
      aiMsg = { id: uid("m"), role: "model" as const, content: replyText, timestamp: nowIso() };
      if (!isL2) aiMsg.stage = "co_think";
      if (guard) aiMsg.guard = guard;
      if (isL2) aiMsg.phase = phase;
    }
    const coach = await coachPromise;
    if (coach) userMsg.coach = coach;
    chatSession.messages.push(aiMsg);
    saveDocument("chat_sessions", chatSession.id, chatSession);
    const pub = publicChat(chatSession, req.user);
    res.json({ success: true, data: { chat_session: pub, new_message: pub.messages.find((m: any) => m.id === aiMsg.id) } });
  } catch (err: any) {
    console.error("Gemini Chat Error:", err?.message || err);
    // Roll back the unanswered message so the student can simply retry
    chatSession.messages = chatSession.messages.filter((m: any) => m.id !== userMsg.id);
    fail(res, 502, "Trợ lý AI tạm thời không phản hồi được. Tin nhắn chưa được ghi nhận, hãy thử gửi lại.");
  }
});

/** Per-dimension scores of a submission: the teacher's override wins over the AI's score. */
function l2DimScores(sub: any): number[] {
  return DEFAULT_L2_DIMENSIONS.map((d) => sub.l2_teacher_scores?.[d.key] ?? sub.l2_result?.dimensions?.find((x: any) => x.key === d.key)?.score ?? 0);
}

function l2ClassStats(assignments: any[], subs: any[]) {
  const l2Assignments = assignments.filter((a: any) => a.submission_mode === "writing_l2" && a.l2);
  if (l2Assignments.length === 0) return undefined;
  const scored = subs.filter((s: any) => s.l2_result && l2Assignments.some((a: any) => a.id === s.assignment_id));
  const dimensions = DEFAULT_L2_DIMENSIONS.map((d, i) => {
    const vals = scored.map((s: any) => l2DimScores(s)[i]).filter((v: number) => v > 0);
    const distribution = [1, 2, 3, 4, 5].map((n) => vals.filter((v: number) => v === n).length);
    return { key: d.key, name: d.name, avg: vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null, distribution };
  });
  const missed_errors: any[] = [];
  for (const a of l2Assignments) {
    const done = subs.filter((s: any) => s.assignment_id === a.id && s.l2_report);
    if (!done.length) continue;
    for (const e of a.l2.errors as L2Error[]) {
      const missed = done.filter((s: any) => s.l2_report.missed.includes(e.id)).length;
      if (missed > 0) missed_errors.push({ assignment_title: a.title, type: e.type, text: e.text, missed, total: done.length });
    }
  }
  missed_errors.sort((x, y) => y.missed / y.total - x.missed / x.total);
  return { assignments: l2Assignments.length, evaluated: scored.length, dimensions, missed_errors: missed_errors.slice(0, 10) };
}

// ---- Submit ----
app.post("/api/submissions/submit", async (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên mới nộp bài.");
  if (!can(req.user, "submit")) return denied(res);
  const { assignment_id, submitted_files, submitted_text, notes } = req.body || {};
  const assignment = db.assignments.find((a: any) => a.id === assignment_id);
  if (!assignment || !isMember(assignment.course_id, req.user)) return fail(res, 404, "Không tìm thấy bài tập.");

  let sub = db.submissions.find((s: any) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (sub && isSubmitted(sub)) return fail(res, 409, "Bạn đã nộp bài này rồi, không thể nộp lại.");
  const isLate = new Date() > new Date(assignment.due_date);
  if (isLate && assignment.allow_late === false) return fail(res, 403, "Đã quá hạn nộp và bài tập này không nhận bài trễ.");
  if (assignment.submission_mode === "writing_l2" && assignment.l2) return submitL2(req, res, assignment, sub, isLate);

  const chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  // The student's own first-ideas message (input friction) is not counted as a chat turn
  const userTurns = coThinkTurns(chatSession);
  if (assignment.submission_mode !== "file_only") { const blocked = submitBlocker(assignment, chatSession); if (blocked) return fail(res, 400, blocked); }
  if (assignment.submission_mode === "file_only" && !(submitted_files?.length || submitted_text?.trim())) return fail(res, 400, "Vui lòng đính kèm file hoặc nhập nội dung bài làm.");

  let processScoreResult: any = undefined;
  let evalStatus: string = "skipped";
  let evalError: string | undefined;
  if (assignment.submission_mode !== "file_only" && chatSession && userTurns > 0) {
    try {
      processScoreResult = await evaluateProcess(assignment, chatSession, submitted_text);
      evalStatus = "ok";
    } catch (e: any) {
      console.error("Gemini Evaluation error:", e?.message || e);
      evalStatus = "failed";
      evalError = e?.message || "Lỗi không xác định";
    }
  }

  if (!sub) {
    sub = { id: uid("sub"), assignment_id, student_id: req.user.id, student_name: req.user.name, student_email: req.user.email, student_avatar: req.user.avatar };
    db.submissions.push(sub);
  }
  Object.assign(sub, {
    submitted_at: nowIso(),
    submitted_files: Array.isArray(submitted_files) ? submitted_files : [],
    submitted_text: submitted_text || "",
    chat_session_id: chatSession?.id,
    process_score_result: processScoreResult,
    eval_status: evalStatus,
    eval_error: evalError,
    status: isLate ? "late" : "submitted",
    notes: notes || "",
  });
  if (chatSession) {
    chatSession.submission_id = sub.id;
    saveDocument("chat_sessions", chatSession.id, chatSession);
  }
  saveDocument("submissions", sub.id, sub);
  const course = findCourse(assignment.course_id);
  if (course) addNotification(course.teacher_id, "Có bài nộp mới", `${req.user.name} đã nộp "${assignment.title}"${isLate ? " (trễ hạn)" : ""}.`, `/course/${course.id}/assignment/${assignment.id}`);
  res.json({
    success: true,
    data: sub,
    message: evalStatus === "failed" ? "Nộp bài thành công. Phần chấm quá trình bằng AI sẽ được giảng viên chạy lại sau." : "Nộp bài thành công!",
  });
});

// ---- Stats (real data only) ----
/** Anonymous class heatmap: how many submissions fall in each (number of chat turns x AI process score band) cell. */
const HEAT_COLS = ["3 lượt", "4 – 5 lượt", "6 – 7 lượt", "8+ lượt"];
const HEAT_ROWS = ["80 – 100", "60 – 79", "40 – 59", "20 – 39", "0 – 19"];
function heatmapStats(subs: any[]) {
  const scored = subs.filter((s: any) => s.process_score_result && s.chat_session_id);
  if (scored.length < BEHAVIOR_MIN_STUDENTS) return { enough: false, evaluated: scored.length, min: BEHAVIOR_MIN_STUDENTS };
  const cells = HEAT_ROWS.map(() => HEAT_COLS.map(() => 0));
  for (const sub of scored) {
    const cs = db.chat_sessions.find((c: any) => c.id === sub.chat_session_id);
    const turns = cs ? cs.messages.filter((m: any) => m.role === "user" && m.kind !== "intent").length : 0;
    const col = turns <= 3 ? 0 : turns <= 5 ? 1 : turns <= 7 ? 2 : 3;
    const v = sub.process_score_result.process_score;
    cells[v >= 80 ? 0 : v >= 60 ? 1 : v >= 40 ? 2 : v >= 20 ? 3 : 4][col]++;
  }
  const band = (a: number, b: number) => Math.round((cells.slice(a, b).flat().reduce((x, y) => x + y, 0) / scored.length) * 100);
  return { enough: true, evaluated: scored.length, cols: HEAT_COLS, rows: HEAT_ROWS, cells, share: { high: band(0, 1), mid: band(1, 3), low: band(3, 5) } };
}

/** Aggregated, anonymous behaviour indicators. Never per student; hidden below this many students. */
const BEHAVIOR_MIN_STUDENTS = 5;
const PASTE_HEAVY_CHARS = 200;

function behaviorStats(courseId: string, assignments: any[], members: any[], subs: any[]) {
  const chatAssignments = assignments.filter((a: any) => a.submission_mode === "ai_chat_only" || a.submission_mode === "both");
  const memberIds = new Set(members.map((m: any) => m.student_id));
  const sessions = db.chat_sessions.filter((cs: any) => chatAssignments.some((a: any) => a.id === cs.assignment_id) && memberIds.has(cs.student_id)
    && cs.messages.some((m: any) => m.role === "user"));
  const students = new Set(sessions.map((cs: any) => cs.student_id)).size;
  if (students < BEHAVIOR_MIN_STUDENTS) return { enough: false, students, min_students: BEHAVIOR_MIN_STUDENTS };

  const frictionSessions = sessions.filter((cs: any) => chatAssignments.find((a: any) => a.id === cs.assignment_id)?.friction !== "none"
    && chatAssignments.find((a: any) => a.id === cs.assignment_id)?.friction);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
  const wrote = frictionSessions.filter((cs: any) => cs.intent && !cs.intent.skipped).length;
  const skipped = frictionSessions.filter((cs: any) => cs.intent?.skipped).length;

  const userMsgs = sessions.flatMap((cs: any) => cs.messages.filter((m: any) => m.role === "user" && m.kind !== "intent"));
  const heavy = userMsgs.filter((m: any) => (m.pasted_chars || 0) >= PASTE_HEAVY_CHARS).length;


  // Lab (separate mode) and Are-you-sure usage
  const labList = db.lab_sessions.filter((l: any) => l.course_id === courseId && memberIds.has(l.student_id));
  const labStudents = new Set(labList.filter((l: any) => l.events.length).map((l: any) => l.student_id));
  const labEvents = labList.flatMap((l: any) => l.events.filter((e: any) => e.action));
  const aysMsgs = sessions.flatMap((cs: any) => cs.messages.filter((m: any) => m.stage === "are_you_sure" && m.role === "user" && m.ays?.response_type));
  const aysDist = Object.fromEntries(RESPONSE_TYPES.map((t) => [t, aysMsgs.filter((m: any) => m.ays.response_type === t).length]));
  const gatedMsgs = sessions.flatMap((cs: any) => cs.messages.filter((m: any) => m.role === "model" && m.gate && m.gate.state === "unlocked"));
  const gateAnswered = gatedMsgs.filter((m: any) => !m.gate.skipped).length;
  return {
    enough: true,
    students,
    gate: gatedMsgs.length ? { total: gatedMsgs.length, answered_rate: pct(gateAnswered, gatedMsgs.length), skipped_rate: pct(gatedMsgs.length - gateAnswered, gatedMsgs.length) } : null,
    friction_sessions: frictionSessions.length,
    wrote_first_rate: pct(wrote, frictionSessions.length),
    skipped_rate: pct(skipped, frictionSessions.length),
    paste_heavy_rate: pct(heavy, userMsgs.length),
    paste_heavy_chars: PASTE_HEAVY_CHARS,
    lab: labStudents.size >= BEHAVIOR_MIN_STUDENTS ? { students: labStudents.size, events: labEvents.length, defend_rate: pct(labEvents.filter((e: any) => e.action === "defend").length, labEvents.length), adjust_rate: pct(labEvents.filter((e: any) => e.action === "adjust").length, labEvents.length) } : null,
    ays: aysMsgs.length >= BEHAVIOR_MIN_STUDENTS ? { answered: aysMsgs.length, distribution: aysDist } : null,
  };
}

app.get("/api/courses/:id/stats", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Môn học không tồn tại.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Bạn không có quyền xem thống kê.");
  const members = db.course_members.filter((m: any) => m.course_id === course.id);
  const assignments = db.assignments.filter((a: any) => a.course_id === course.id);
  const subs = db.submissions.filter((s: any) => assignments.some((a: any) => a.id === s.assignment_id) && isSubmitted(s) && members.some((m: any) => m.student_id === s.student_id));
  const totalPossible = members.length * assignments.length;
  const pct = (n: number) => (totalPossible ? Math.round((n / totalPossible) * 100) : 0);
  const onTime = subs.filter((s: any) => s.status === "submitted").length;
  const late = subs.filter((s: any) => s.status === "late").length;
  const scored = subs.filter((s: any) => s.process_score_result);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  const distribution = [
    { range: "90-100", label: "Xuất sắc", count: 0 },
    { range: "80-89", label: "Giỏi", count: 0 },
    { range: "70-79", label: "Khá", count: 0 },
    { range: "50-69", label: "Trung bình", count: 0 },
    { range: "<50", label: "Yếu / nhờ AI làm hộ", count: 0 },
  ];
  for (const s of scored) {
    const v = s.process_score_result.process_score;
    distribution[v >= 90 ? 0 : v >= 80 ? 1 : v >= 70 ? 2 : v >= 50 ? 3 : 4].count++;
  }

  const per_assignment = assignments.map((a: any) => {
    const aSubs = subs.filter((s: any) => s.assignment_id === a.id);
    const isL2a = a.submission_mode === "writing_l2";
    // For L2 the "score" is the mean of the five dimensions (1-5) scaled to 0-100
    const aScores = isL2a
      ? aSubs.filter((s: any) => s.l2_result).map((s: any) => (l2DimScores(s).reduce((x: number, y: number) => x + y, 0) / 5) * 20)
      : aSubs.filter((s: any) => s.process_score_result).map((s: any) => s.process_score_result.process_score);
    const avgScore = avg(aScores);
    return {
      assignment_id: a.id,
      title: a.title,
      submitted: aSubs.length,
      total: members.length,
      avg_score: avgScore,
      recommendation: isL2a
        ? (avgScore === null ? "Chưa có bài Viết L2 nào được chấm." : "Xem phân tích theo từng chiều và các lỗi cả lớp hay bỏ sót ở phần Viết L2 bên dưới.")
        : avgScore === null
        ? "Chưa có bài nộp nào được chấm quá trình."
        : avgScore < 75
        ? "Sinh viên có xu hướng xin đáp án trực tiếp. Cân nhắc chuyển sang chế độ Socratic và bổ sung yêu cầu phản biện trường hợp biên."
        : "Đề bài kích thích tư duy tốt, sinh viên tương tác chủ động.",
    };
  }).sort((a: any, b: any) => (a.avg_score ?? 999) - (b.avg_score ?? 999));

  const students = members.map((m: any) => {
    const mine = subs.filter((s: any) => s.student_id === m.student_id);
    const myScores = mine.filter((s: any) => s.process_score_result).map((s: any) => s.process_score_result.process_score);
    const myGrades = mine.filter(gradedState).map((s: any) => s.grade);
    return {
      student_id: m.student_id,
      student_name: m.student_name,
      student_email: m.student_email,
      student_avatar: m.student_avatar,
      submitted: mine.length,
      total: assignments.length,
      late: mine.filter((s: any) => s.status === "late").length,
      avg_process_score: avg(myScores),
      scores: mine.filter((x: any) => x.process_score_result).sort((a: any, b: any) => String(a.submitted_at).localeCompare(String(b.submitted_at))).map((x: any) => x.process_score_result.process_score),
      avg_grade: myGrades.length ? Math.round((myGrades.reduce((a: number, b: number) => a + b, 0) / myGrades.length) * 10) / 10 : null,
      needs_attention: (myScores.length > 0 && (avg(myScores) as number) < 60) || (assignments.length > 0 && mine.length < assignments.length / 2),
    };
  });

  res.json({
    success: true,
    data: {
      behavior: behaviorStats(course.id, assignments, members, subs),
      heatmap: heatmapStats(subs.filter((s: any) => !assignments.find((a: any) => a.id === s.assignment_id && a.submission_mode === "writing_l2"))),
      average_grade: (() => { const g = subs.filter(gradedState).map((s: any) => s.grade); return g.length ? Math.round((g.reduce((a: number, b: number) => a + b, 0) / g.length) * 10) / 10 : null; })(),
      total_students: members.length,
      total_assignments: assignments.length,
      submission_rate: pct(subs.length),
      on_time_rate: pct(onTime),
      late_rate: pct(late),
      not_submitted_rate: totalPossible ? 100 - pct(subs.length) : 0,
      average_process_score: avg(scored.map((s: any) => s.process_score_result.process_score)),
      evaluated_count: scored.length,
      score_distribution: distribution,
      per_assignment,
      students,
      l2: l2ClassStats(assignments, subs),
    },
  });
});

// ---- Dashboard & notifications ----
app.get("/api/overview", (req: AuthedRequest, res) => {
  const user = req.user;
  const now = Date.now();
  if (user.role === "admin") return res.json({ success: true, data: {} });
  if (user.role === "teacher") {
    const myCourses = db.courses.filter((c: any) => c.teacher_id === user.id);
    const myAssignments = db.assignments.filter((a: any) => myCourses.some((c: any) => c.id === a.course_id));
    const toGrade = db.submissions
      .filter((s: any) => isSubmitted(s) && !gradedState(s) && myAssignments.some((a: any) => a.id === s.assignment_id))
      .map((s: any) => {
        const a = myAssignments.find((x: any) => x.id === s.assignment_id);
        return { submission_id: s.id, assignment_id: a.id, course_id: a.course_id, assignment_title: a.title, student_name: s.student_name, submitted_at: s.submitted_at, process_score: s.process_score_result?.process_score };
      })
      .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
      .slice(0, 8);
    const students = new Set(db.course_members.filter((m: any) => myCourses.some((c: any) => c.id === m.course_id)).map((m: any) => m.student_id));
    const upcoming = myAssignments.filter((a: any) => new Date(a.due_date).getTime() > now).sort((a: any, b: any) => +new Date(a.due_date) - +new Date(b.due_date)).slice(0, 5)
      .map((a: any) => ({ id: a.id, course_id: a.course_id, title: a.title, due_date: a.due_date, course_name: myCourses.find((c: any) => c.id === a.course_id)?.name }));
    // "Recently due": assignments due in the last 30 days or the next 7 days, newest first
    const recentDue = myAssignments
      .filter((a: any) => { const t = new Date(a.due_date).getTime(); return t < now + 7 * 86400000 && t > now - 30 * 86400000; })
      .sort((a: any, b: any) => +new Date(b.due_date) - +new Date(a.due_date)).slice(0, 5)
      .map((a: any) => {
        const subs = db.submissions.filter((s: any) => s.assignment_id === a.id && isSubmitted(s));
        return {
          id: a.id, course_id: a.course_id, title: a.title, due_date: a.due_date, mode: a.submission_mode,
          course_name: myCourses.find((c: any) => c.id === a.course_id)?.name,
          turned_in: subs.length, graded: subs.filter(gradedState).length,
          assigned: db.course_members.filter((m: any) => m.course_id === a.course_id).length,
        };
      });
    // Class insights computed from real data only
    const insights: any[] = [];
    for (const c of myCourses) {
      const members = db.course_members.filter((m: any) => m.course_id === c.id);
      if (members.length === 0) continue;
      const past = db.assignments.filter((a: any) => a.course_id === c.id && new Date(a.due_date).getTime() < now)
        .sort((a: any, b: any) => +new Date(b.due_date) - +new Date(a.due_date)).slice(0, 2);
      if (past.length === 2) {
        const missed = members.filter((m: any) => past.every((a: any) => !db.submissions.some((s: any) => s.assignment_id === a.id && s.student_id === m.student_id && isSubmitted(s)))).length;
        if (missed > 0) insights.push({ kind: "missed", count: missed, text: `${missed} sinh viên chưa nộp 2 bài gần nhất`, course: c.name, course_id: c.id });
      }
      const low = members.filter((m: any) => {
        const sc = db.submissions.filter((s: any) => s.student_id === m.student_id && s.process_score_result && db.assignments.some((a: any) => a.id === s.assignment_id && a.course_id === c.id)).map((s: any) => s.process_score_result.process_score);
        return sc.length > 0 && sc.reduce((a: number, b: number) => a + b, 0) / sc.length < 60;
      }).length;
      if (low > 0) insights.push({ kind: "low", count: low, text: `${low} sinh viên có điểm tư duy trung bình dưới 60`, course: c.name, course_id: c.id });
      const idle = members.filter((m: any) => { const u = db.users.find((x: any) => x.id === m.student_id); return !u?.last_seen || now - new Date(u.last_seen).getTime() > 7 * 86400000; }).length;
      if (idle > 0) insights.push({ kind: "idle", count: idle, text: `${idle} sinh viên chưa truy cập trong 7 ngày qua`, course: c.name, course_id: c.id });
    }
    return res.json({ success: true, data: { course_count: myCourses.length, student_count: students.size, assignment_count: myAssignments.length, to_grade_count: toGrade.length, to_grade: toGrade, upcoming, recent_due: recentDue, insights: insights.slice(0, 4) } });
  }
  const myCourseIds = db.course_members.filter((m: any) => m.student_id === user.id).map((m: any) => m.course_id);
  const mySubs = db.submissions.filter((s: any) => s.student_id === user.id);
  const withCourse = (a: any) => ({ id: a.id, course_id: a.course_id, title: a.title, due_date: a.due_date, course_name: findCourse(a.course_id)?.name });
  const pending = db.assignments.filter((a: any) => myCourseIds.includes(a.course_id) && !mySubs.some((s: any) => s.assignment_id === a.id && isSubmitted(s)));
  const grades = mySubs.filter(gradedState).map((s: any) => s.grade);
  const scores = mySubs.filter((s: any) => s.process_score_result).map((s: any) => s.process_score_result.process_score);
  const recentGraded = mySubs.filter(gradedState).sort((a: any, b: any) => +new Date(b.graded_at) - +new Date(a.graded_at)).slice(0, 5)
    .map((s: any) => { const a = db.assignments.find((x: any) => x.id === s.assignment_id); return { assignment_id: a?.id, course_id: a?.course_id, title: a?.title, grade: s.grade, feedback: s.feedback }; });
  res.json({
    success: true,
    data: {
      course_count: myCourseIds.length,
      submitted_count: mySubs.filter(isSubmitted).length,
      pending_count: pending.filter((a: any) => new Date(a.due_date).getTime() > now).length,
      overdue_count: pending.filter((a: any) => new Date(a.due_date).getTime() <= now).length,
      avg_grade: grades.length ? Math.round((grades.reduce((a: number, b: number) => a + b, 0) / grades.length) * 10) / 10 : null,
      avg_process_score: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null,
      upcoming: pending.filter((a: any) => new Date(a.due_date).getTime() > now).sort((a: any, b: any) => +new Date(a.due_date) - +new Date(b.due_date)).slice(0, 5).map(withCourse),
      overdue: pending.filter((a: any) => new Date(a.due_date).getTime() <= now).slice(0, 5).map(withCourse),
      recent_graded: recentGraded,
    },
  });
});

app.get("/api/notifications", (req: AuthedRequest, res) => {
  const list = db.notifications.filter((n: any) => n.user_id === req.user.id).slice(0, 30);
  res.json({ success: true, data: list, unread: list.filter((n: any) => !n.read).length });
});

app.post("/api/notifications/read", (req: AuthedRequest, res) => {
  for (const n of db.notifications.filter((n: any) => n.user_id === req.user.id && !n.read)) {
    n.read = true;
    saveDocument("notifications", n.id, n);
  }
  res.json({ success: true });
});

// ---- Admin console ----
function requireAdmin(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  if (req.user?.role !== "admin") return fail(res, 403, "Chỉ quản trị viên mới truy cập được khu vực này.");
  next();
}
app.use("/api/admin", requireAdmin);

const adminUserRow = (u: any) => {
  const courses = db.courses.filter((c: any) => c.teacher_id === u.id).length;
  const enrolled = db.course_members.filter((m: any) => m.student_id === u.id).length;
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, active: u.active !== false, last_seen: u.last_seen, course_count: u.role === "teacher" ? courses : enrolled };
};

app.get("/api/admin/overview", (req: AuthedRequest, res) => {
  const subs = db.submissions.filter(isSubmitted);
  res.json({
    success: true,
    data: {
      users: { total: db.users.length, admin: db.users.filter((u: any) => u.role === "admin").length, teacher: db.users.filter((u: any) => u.role === "teacher").length, student: db.users.filter((u: any) => u.role === "student").length, inactive: db.users.filter((u: any) => u.active === false).length },
      courses: db.courses.length, assignments: db.assignments.length, submissions: subs.length,
      ungraded: subs.filter((s: any) => !gradedState(s)).length,
      ai_failed: subs.filter((s: any) => s.eval_status === "failed").length,
      recent_audit: db.audit_logs.slice(0, 6),
      storage: { firestore: !!firestoreDb, supabase: isSupabaseConfigured(), gemini: !!process.env.GEMINI_API_KEY },
    },
  });
});

app.get("/api/admin/users", (req, res) => res.json({ success: true, data: db.users.map(adminUserRow) }));

app.post("/api/admin/users", (req: AuthedRequest, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return fail(res, 400, "Vui lòng nhập họ tên, email và mật khẩu.");
  if (!/^\S+@\S+\.\S+$/.test(String(email))) return fail(res, 400, "Email không hợp lệ.");
  if (String(password).length < 6) return fail(res, 400, "Mật khẩu cần ít nhất 6 ký tự.");
  if (!["admin", "teacher", "student"].includes(role)) return fail(res, 400, "Vai trò không hợp lệ.");
  const cleanEmail = String(email).trim().toLowerCase();
  if (db.users.some((u: any) => u.email.toLowerCase() === cleanEmail)) return fail(res, 409, "Email này đã tồn tại.");
  const user = { id: uid("u"), name: String(name).trim().slice(0, 80), email: cleanEmail, role, avatar: "", pwd: hashPassword(String(password)), active: true };
  db.users.push(user);
  saveDocument("users", user.id, user);
  audit(req.user, "user.create", user.email, `Tạo tài khoản ${role}`);
  res.json({ success: true, data: adminUserRow(user) });
});

app.put("/api/admin/users/:id", (req: AuthedRequest, res) => {
  const u = db.users.find((x: any) => x.id === req.params.id);
  if (!u) return fail(res, 404, "Không tìm thấy người dùng.");
  const { role, active, name } = req.body || {};
  const isSelf = u.id === req.user.id;
  const otherAdmins = db.users.filter((x: any) => x.role === "admin" && x.active !== false && x.id !== u.id).length;
  if (role !== undefined && role !== u.role) {
    if (!["admin", "teacher", "student"].includes(role)) return fail(res, 400, "Vai trò không hợp lệ.");
    if (isSelf) return fail(res, 400, "Bạn không thể tự đổi vai trò của chính mình.");
    if (u.role === "admin" && otherAdmins === 0) return fail(res, 400, "Phải còn ít nhất một quản trị viên.");
    if (u.role === "teacher" && db.courses.some((c: any) => c.teacher_id === u.id)) return fail(res, 400, "Giảng viên này đang phụ trách môn học. Hãy chuyển giao môn học trước khi đổi vai trò.");
    audit(req.user, "user.role", u.email, `${u.role} → ${role}`);
    u.role = role;
  }
  if (active !== undefined && (active !== false) !== (u.active !== false)) {
    if (isSelf) return fail(res, 400, "Bạn không thể tự vô hiệu hóa tài khoản của mình.");
    if (active === false && u.role === "admin" && otherAdmins === 0) return fail(res, 400, "Phải còn ít nhất một quản trị viên hoạt động.");
    u.active = active !== false;
    audit(req.user, u.active ? "user.enable" : "user.disable", u.email);
  }
  if (name !== undefined && String(name).trim()) u.name = String(name).trim().slice(0, 80);
  saveDocument("users", u.id, u);
  res.json({ success: true, data: adminUserRow(u) });
});

app.post("/api/admin/users/:id/reset-password", (req: AuthedRequest, res) => {
  const u = db.users.find((x: any) => x.id === req.params.id);
  if (!u) return fail(res, 404, "Không tìm thấy người dùng.");
  const temp = crypto.randomBytes(5).toString("hex");
  u.pwd = hashPassword(temp);
  saveDocument("users", u.id, u);
  audit(req.user, "user.reset_password", u.email);
  res.json({ success: true, data: { temp_password: temp }, message: "Đã đặt lại mật khẩu." });
});

app.delete("/api/admin/users/:id", (req: AuthedRequest, res) => {
  const u = db.users.find((x: any) => x.id === req.params.id);
  if (!u) return fail(res, 404, "Không tìm thấy người dùng.");
  if (u.id === req.user.id) return fail(res, 400, "Bạn không thể xóa chính mình.");
  if (u.role === "admin" && db.users.filter((x: any) => x.role === "admin" && x.id !== u.id).length === 0) return fail(res, 400, "Phải còn ít nhất một quản trị viên.");
  if (u.role === "teacher" && db.courses.some((c: any) => c.teacher_id === u.id)) return fail(res, 400, "Giảng viên này đang phụ trách môn học. Hãy chuyển giao môn học trước khi xóa.");
  for (const m of db.course_members.filter((m: any) => m.student_id === u.id)) deleteDocument("course_members", `${m.course_id}_${m.student_id}`);
  db.course_members = db.course_members.filter((m: any) => m.student_id !== u.id);
  for (const sb of db.submissions.filter((x: any) => x.student_id === u.id)) deleteDocument("submissions", sb.id);
  db.submissions = db.submissions.filter((x: any) => x.student_id !== u.id);
  for (const cs of db.chat_sessions.filter((x: any) => x.student_id === u.id)) deleteDocument("chat_sessions", cs.id);
  db.chat_sessions = db.chat_sessions.filter((x: any) => x.student_id !== u.id);
  for (const l of db.lab_sessions.filter((x: any) => x.student_id === u.id)) deleteDocument("lab_sessions", l.id);
  db.lab_sessions = db.lab_sessions.filter((x: any) => x.student_id !== u.id);
  db.users = db.users.filter((x: any) => x.id !== u.id);
  deleteDocument("users", u.id);
  audit(req.user, "user.delete", u.email, `Vai trò ${u.role}`);
  res.json({ success: true, message: "Đã xóa người dùng và dữ liệu liên quan." });
});

app.get("/api/admin/courses", (req, res) => {
  res.json({
    success: true,
    data: db.courses.map((c: any) => ({
      id: c.id, name: c.name, code: c.code, semester: c.semester, teacher_id: c.teacher_id, teacher_name: c.teacher_name, invite_code: c.invite_code,
      member_count: db.course_members.filter((m: any) => m.course_id === c.id).length,
      assignment_count: db.assignments.filter((a: any) => a.course_id === c.id).length,
    })),
  });
});

app.put("/api/admin/courses/:id/teacher", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  const teacher = db.users.find((u: any) => u.id === req.body?.teacher_id && u.role === "teacher" && u.active !== false);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!teacher) return fail(res, 400, "Giảng viên không hợp lệ.");
  audit(req.user, "course.transfer", course.name, `${course.teacher_name} → ${teacher.name}`);
  course.teacher_id = teacher.id;
  course.teacher_name = teacher.name;
  saveDocument("courses", course.id, course);
  addNotification(teacher.id, "Bạn được giao phụ trách môn học", course.name, `/course/${course.id}`);
  res.json({ success: true, data: course });
});

app.delete("/api/admin/courses/:id", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  audit(req.user, "course.delete", course.name, `Mã ${course.code} (bởi quản trị viên)`);
  deleteCourseCascade(course.id);
  res.json({ success: true, message: `Đã xóa môn học "${course.name}" và các dữ liệu liên quan.` });
});

app.get("/api/admin/settings", (req, res) => res.json({ success: true, data: db.settings }));

app.put("/api/admin/settings", (req: AuthedRequest, res) => {
  const { allow_registration, teacher_self_register, permissions, retention_days } = req.body || {};
  const next = JSON.parse(JSON.stringify(db.settings));
  if (typeof allow_registration === "boolean") next.allow_registration = allow_registration;
  if (typeof teacher_self_register === "boolean") next.teacher_self_register = teacher_self_register;
  if (retention_days !== undefined) { const d = Math.round(Number(retention_days)); next.retention_days = Number.isFinite(d) ? Math.min(3650, Math.max(0, d)) : 0; }
  if (permissions && typeof permissions === "object") {
    for (const role of ["teacher", "student"]) {
      for (const key of Object.keys(DEFAULT_SETTINGS.permissions[role])) {
        if (typeof permissions[role]?.[key] === "boolean") next.permissions[role][key] = permissions[role][key];
      }
    }
  }
  db.settings = next;
  saveDocument("settings", "global", { ...next });
  audit(req.user, "settings.update", "Cài đặt hệ thống", JSON.stringify({ allow_registration: next.allow_registration, teacher_self_register: next.teacher_self_register }));
  res.json({ success: true, data: next, message: "Đã lưu cấu hình phân quyền." });
});

app.post("/api/admin/demo-data", (req: AuthedRequest, res) => {
  if (!db.courses.some((c: any) => c.id === "c_1")) return fail(res, 409, "Cần có môn học mẫu (mã CS101) để nạp dữ liệu demo.");
  const d = appendDemoData(db);
  if (!d) return fail(res, 409, "Dữ liệu demo đã được nạp rồi. Hãy xóa trước nếu muốn nạp lại.");
  for (const u of d.users) saveDocument("users", u.id, u);
  for (const m of d.course_members) saveDocument("course_members", `${m.course_id}_${m.student_id}`, m);
  for (const a of d.assignments) saveDocument("assignments", a.id, a);
  for (const x of d.submissions) saveDocument("submissions", x.id, x);
  for (const c of d.chat_sessions) saveDocument("chat_sessions", c.id, c);
  audit(req.user, "demo.load", "Dữ liệu demo", `${d.users.length} sinh viên, ${d.submissions.length} bài nộp`);
  res.json({ success: true, data: { students: d.users.length, assignments: d.assignments.length, submissions: d.submissions.length, chats: d.chat_sessions.length }, message: "Đã nạp dữ liệu demo." });
});

app.delete("/api/admin/demo-data", (req: AuthedRequest, res) => {
  const isDemo = (id: any) => String(id).startsWith(DEMO_PREFIX);
  const demoUsers = new Set(db.users.filter((u: any) => isDemo(u.id)).map((u: any) => u.id));
  // Also drop demo-student work that was added to the original seeded assignments
  const rmSubs = db.submissions.filter((x: any) => isDemo(x.id) || demoUsers.has(x.student_id));
  const rmChats = db.chat_sessions.filter((c: any) => isDemo(c.id) || demoUsers.has(c.student_id));
  const rmAssign = db.assignments.filter((a: any) => isDemo(a.id));
  const rmMembers = db.course_members.filter((m: any) => demoUsers.has(m.student_id));
  const rmNotif = db.notifications.filter((n: any) => demoUsers.has(n.user_id));
  for (const u of db.users.filter((u: any) => demoUsers.has(u.id))) deleteDocument("users", u.id);
  for (const m of rmMembers) deleteDocument("course_members", `${m.course_id}_${m.student_id}`);
  for (const a of rmAssign) deleteDocument("assignments", a.id);
  for (const x of rmSubs) deleteDocument("submissions", x.id);
  for (const c of rmChats) deleteDocument("chat_sessions", c.id);
  for (const n of rmNotif) deleteDocument("notifications", n.id);
  db.users = db.users.filter((u: any) => !demoUsers.has(u.id));
  db.course_members = db.course_members.filter((m: any) => !demoUsers.has(m.student_id));
  db.assignments = db.assignments.filter((a: any) => !isDemo(a.id));
  db.submissions = db.submissions.filter((x: any) => !rmSubs.includes(x));
  db.chat_sessions = db.chat_sessions.filter((c: any) => !rmChats.includes(c));
  db.notifications = db.notifications.filter((n: any) => !rmNotif.includes(n));
  audit(req.user, "demo.clear", "Dữ liệu demo", `${demoUsers.size} sinh viên`);
  res.json({ success: true, data: { students: demoUsers.size }, message: "Đã xóa dữ liệu demo." });
});

app.get("/api/admin/audit", (req, res) => res.json({ success: true, data: db.audit_logs.slice(0, 200) }));



// =====================================================================================================================
// Perspective Lab ("Góc nhìn khác") is a SEPARATE MODE, not a stage of an assignment.
//   1 Canvas: a text (a deliberately one-sided sample, a paragraph the AI just wrote, or the student's own draft)
//   2 Highlight a claim -> "Hmm... góc nhìn khác thì sao?"
//   3 Counter-lens: 1-2 opposing views aimed at exactly that passage (the AI never rewrites the text)
//   4 Friction: the student MUST defend (1-2 sentences) or adjust the passage before the next highlight
// Sessions are stored in their own collection (lab_sessions). Every rule below is enforced on the server.
// =====================================================================================================================

/** One JSON answer from the model. Throws if the model fails or returns something unusable. */
async function aiJson(prompt: string, properties: Record<string, any>, required: string[], temperature: number): Promise<any> {
  if (!process.env.GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
  const r: any = await generateWithFallback({ contents: [{ role: "user", parts: [{ text: prompt }] }], config: { temperature, responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties, required } } });
  if (!r.text) throw new Error("AI trả về nội dung rỗng.");
  return JSON.parse(String(r.text).trim());
}
const STR = { type: Type.STRING };
const cap = (v: any, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const clampInt = (v: any, max = 100000) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));

/** Texts a student can load into the Lab. They are one-sided on purpose, so there is always something to challenge. */
const LAB_SAMPLES = [
  { id: "mxh", title: "Mạng xã hội đang làm hỏng giới trẻ", text: "Mạng xã hội là nguyên nhân chính khiến giới trẻ ngày nay sống ảo, thiếu tập trung và mất khả năng giao tiếp thật. Ai dành hơn hai giờ mỗi ngày trên mạng đều bị trầm cảm. Vì vậy cách duy nhất để bảo vệ thế hệ trẻ là cấm hoàn toàn học sinh dùng mạng xã hội trước 18 tuổi. Những người phản đối chỉ là các công ty công nghệ muốn kiếm tiền, nên ý kiến của họ không đáng nghe." },
  { id: "online", title: "Học trực tuyến luôn tốt hơn học trên lớp", text: "Học trực tuyến hiệu quả hơn học trên lớp ở mọi môn học vì sinh viên được học vào bất cứ lúc nào họ muốn. Không còn mất thời gian đi lại nên ai cũng có nhiều thời gian học hơn và điểm số chắc chắn sẽ tăng. Giảng viên chỉ cần quay video một lần là đủ cho cả chục năm. Vì thế các trường đại học nên đóng cửa giảng đường và chuyển toàn bộ sang học trực tuyến." },
  { id: "ai", title: "AI sẽ thay thế giáo viên", text: "Trí tuệ nhân tạo trả lời nhanh hơn, kiên nhẫn hơn và biết nhiều hơn bất kỳ giáo viên nào, nên chẳng bao lâu nữa giáo viên sẽ không còn cần thiết. Học sinh chỉ cần hỏi AI là có ngay đáp án đúng, không cần ai chấm bài hay giảng bài. Những giáo viên lo lắng về điều này chỉ đang sợ mất việc. Mọi nước tiến bộ đều đã bắt đầu giảm số giáo viên." },
];
const LAB_KINDS = ["phan_bien", "he_qua_dai_han", "gia_dinh_ngam"] as const;
const LAB_KIND_LABEL: Record<string, string> = { phan_bien: "Góc nhìn phản biện", he_qua_dai_han: "Hệ quả dài hạn", gia_dinh_ngam: "Giả định ngầm bị bỏ sót" };
const PASTE_MSG = "Phần này cần bạn tự gõ bằng lời của mình, không dán.";

function labStudent(req: AuthedRequest, res: express.Response): boolean {
  if (req.user.role !== "student") { fail(res, 403, "Chỉ sinh viên mới dùng Phòng Lab."); return false; }
  if (!can(req.user, "use_ai_chat")) { denied(res); return false; }
  if (needConsent(req, res)) return false;
  return true;
}
function labOwn(req: AuthedRequest, res: express.Response) {
  const s = db.lab_sessions.find((x: any) => x.id === req.params.id && x.student_id === req.user.id);
  if (!s) { fail(res, 404, "Không tìm thấy phiên Lab này."); return null; }
  return s;
}
const labSave = (s: any) => saveDocument("lab_sessions", s.id, s);

app.get("/api/lab/samples", (_req, res) => res.json({ success: true, data: LAB_SAMPLES.map((s) => ({ id: s.id, title: s.title, preview: s.text.slice(0, 90) + "…" })) }));

app.get("/api/lab/sessions", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên xem được Phòng Lab của mình.");
  const cid = req.query.course_id;
  const list = db.lab_sessions.filter((s: any) => s.student_id === req.user.id && (!cid || s.course_id === cid)).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
  res.json({ success: true, data: list });
});

app.post("/api/lab/sessions", async (req: AuthedRequest, res) => {
  if (!labStudent(req, res)) return;
  const course = findCourse(req.body?.course_id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 403, "Bạn không thuộc môn học này.");
  if (db.lab_sessions.filter((s: any) => s.student_id === req.user.id && s.course_id === course.id).length >= 30) return fail(res, 400, "Mỗi môn tối đa 30 phiên Lab. Hãy xóa bớt phiên cũ.");
  if (chatRateLimited(req.user.id)) return fail(res, 429, "Bạn gửi quá nhanh, vui lòng đợi vài phút rồi thử lại.");
  const kind = req.body?.kind;
  let text = "", title = cap(req.body?.title, LAB_LIMITS.maxTitle), pasted = 0;
  if (kind === "sample") {
    const s = LAB_SAMPLES.find((x) => x.id === req.body?.sample_id);
    if (!s) return fail(res, 400, "Không tìm thấy văn bản mẫu.");
    text = s.text; title = title || s.title;
  } else if (kind === "own") {
    text = String(req.body?.text ?? "").replace(/\r\n/g, "\n").trim(); pasted = clampInt(req.body?.pasted_chars);   // it is the student's own document: pasting is allowed, the amount is recorded
    title = title || "Bài nháp của tôi";
  } else if (kind === "ai") {
    const topic = cap(req.body?.topic, LAB_LIMITS.maxTopic);
    if (topic.length < 5) return fail(res, 400, "Hãy nhập chủ đề (ít nhất 5 ký tự).");
    try {
      const out = await aiJson(`Viết MỘT đoạn văn nghị luận tiếng Việt khoảng 90-130 chữ về chủ đề dưới đây, giọng tự tin của một bài luận sinh viên, có ít nhất hai câu khẳng định mạnh. Chỉ trả đoạn văn, không tiêu đề.\n\nChủ đề: ${scrub(topic, whoIs(req.user.id))}`, { text: STR }, ["text"], 0.8);
      text = cap(out.text, LAB_LIMITS.maxText); title = title || topic.slice(0, LAB_LIMITS.maxTitle);
    } catch (e: any) { console.error("Lab ai text error:", e?.message || e); return fail(res, 502, "Trợ lý AI tạm thời không viết được đoạn văn. Hãy thử lại."); }
  } else return fail(res, 400, "Nguồn văn bản không hợp lệ.");
  if (text.length < LAB_LIMITS.minText) return fail(res, 400, `Văn bản cần ít nhất ${LAB_LIMITS.minText} ký tự.`);
  if (text.length > LAB_LIMITS.maxText) return fail(res, 400, `Văn bản tối đa ${LAB_LIMITS.maxText.toLocaleString("vi-VN")} ký tự.`);
  const s = { id: uid("lab"), student_id: req.user.id, course_id: course.id, title, kind, text, pasted_chars: pasted, events: [] as any[], created_at: nowIso() };
  db.lab_sessions.push(s); labSave(s);
  res.json({ success: true, data: s });
});

app.get("/api/lab/sessions/:id", (req: AuthedRequest, res) => {
  const s = db.lab_sessions.find((x: any) => x.id === req.params.id);
  if (!s) return fail(res, 404, "Không tìm thấy phiên Lab này.");
  const course = findCourse(s.course_id);
  const ok = s.student_id === req.user.id || (course && (req.user.role === "admin" || (req.user.role === "teacher" && isOwner(course, req.user))));
  if (!ok) return fail(res, 403, "Bạn không có quyền xem phiên này.");
  res.json({ success: true, data: s });
});

app.delete("/api/lab/sessions/:id", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên xóa được phiên Lab của mình.");
  const s = labOwn(req, res); if (!s) return;
  db.lab_sessions = db.lab_sessions.filter((x: any) => x.id !== s.id); deleteDocument("lab_sessions", s.id);
  res.json({ success: true, data: { id: s.id } });
});

/** Step 2-3: the student highlighted a passage. Returns 1-2 opposing views aimed at exactly that passage. */
app.post("/api/lab/sessions/:id/lens", async (req: AuthedRequest, res) => {
  if (!labStudent(req, res)) return;
  const s = labOwn(req, res); if (!s) return;
  const course = findCourse(s.course_id);
  if (!course) return fail(res, 404, "Môn học không còn tồn tại.");
  if (s.events.some((e: any) => !e.action)) return fail(res, 409, "Hãy đối chất với góc nhìn đang mở (bảo vệ hoặc điều chỉnh) trước khi bôi đen đoạn khác.");
  const start = Math.round(Number(req.body?.start)), end = Math.round(Number(req.body?.end));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > s.text.length || start >= end) return fail(res, 400, "Vùng chọn không hợp lệ.");
  const selText = s.text.slice(start, end);
  if (selText.trim().length < LAB_LIMITS.minSel) return fail(res, 400, `Hãy bôi đen một câu hoặc đoạn dài ít nhất ${LAB_LIMITS.minSel} ký tự.`);
  if (selText.length > LAB_LIMITS.maxSel) return fail(res, 400, `Đoạn chọn tối đa ${LAB_LIMITS.maxSel.toLocaleString("vi-VN")} ký tự.`);
  if (s.events.some((e: any) => start < e.selection.end && end > e.selection.start)) return fail(res, 409, "Đoạn này trùng với một đoạn bạn đã đối chất. Hãy chọn đoạn khác.");
  if (chatRateLimited(req.user.id)) return fail(res, 429, "Bạn gửi quá nhanh, vui lòng đợi vài phút rồi thử lại.");

  const passage = scrub(selText, whoIs(req.user.id)), context = scrub(s.text, whoIs(req.user.id)).slice(0, 6000);
  try {
    const cls = await aiJson(`Phân loại ĐOẠN ĐƯỢC CHỌN theo bản chất của nó.
- "tranh_luan": ý kiến, giá trị, cách tiếp cận, dự đoán, nơi nhiều quan điểm hợp lý có thể cùng tồn tại.
- "su_kien": khẳng định sự kiện, số liệu hoặc định nghĩa có thể kiểm chứng.
- "khong_ro": quá mơ hồ hoặc quá ngắn để biết đang khẳng định điều gì.
Trả JSON {mode, reason} (reason: một câu tiếng Việt).

ĐOẠN ĐƯỢC CHỌN:
${passage}`, { mode: STR, reason: STR }, ["mode", "reason"], 0.2);
    const mode: "tranh_luan" | "su_kien" | "khong_ro" = ["tranh_luan", "su_kien", "khong_ro"].includes(cls.mode) ? cls.mode : "khong_ro";
    if (mode === "khong_ro") return res.json({ success: true, data: { event: null, clarify: "Mình chưa rõ đoạn này đang khẳng định điều gì. Bạn thử bôi đen một câu khẳng định cụ thể hơn nhé.", session: s } });   // nothing is stored: no friction is owed for a passage that got no counter-view
    const ev: any = { id: uid("ev"), selection: { start, end, text: selText }, mode, reason: cap(cls.reason, 300), counterviews: [], ts: nowIso() };

    if (mode === "tranh_luan") {
      // The only sources are the class materials; no URL is ever produced. A source is shown only if it is a real material of this class.
      const passages = pickPassages(course.materials || [], passage, 3500, 3);
      const mats = passages.length ? passages.map((p) => `[${p.name}]\n${p.text}`).join("\n---\n") : "(Lớp này chưa có tài liệu phù hợp. Để source_ref trống.)";
      const out = await aiJson(`Bạn giúp một sinh viên nhìn lại MỘT đoạn trong văn bản từ góc khác. KHÔNG viết lại văn bản. Hãy đưa 1 đến 2 góc nhìn KHÁC, mỗi góc nhìn nhắm thẳng vào đoạn được chọn, là một lập luận nghiêm túc (không bù nhìn, không công kích).
Mỗi góc nhìn có: kind (một trong: phan_bien = góc nhìn phản biện; he_qua_dai_han = hệ quả dài hạn nếu điều này đúng; gia_dinh_ngam = giả định ngầm bị bỏ sót), stance (một câu), argument (2-3 câu tiếng Việt), source_ref (tên tài liệu trong ngoặc vuông dưới đây nếu bạn dựa vào nó, nếu không thì để trống). KHÔNG đưa đường link, KHÔNG bịa nguồn.

TÀI LIỆU CỦA LỚP:
${mats}

TOÀN VĂN (chỉ để hiểu ngữ cảnh):
${context}

ĐOẠN ĐƯỢC CHỌN:
${passage}`, { counterviews: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { kind: STR, stance: STR, argument: STR, source_ref: STR }, required: ["kind", "stance", "argument", "source_ref"] } } }, ["counterviews"], 0.6);
      ev.counterviews = (Array.isArray(out.counterviews) ? out.counterviews : []).slice(0, 2).map((v: any) => {
        const ref = cap(v.source_ref, 120).toLowerCase();
        const hit = ref && passages.find((p) => p.name.toLowerCase() === ref);
        const kind = (LAB_KINDS as readonly string[]).includes(v.kind) ? v.kind : "phan_bien";
        return { kind, stance: cap(v.stance, 200), argument: cap(v.argument, 700), source: hit ? { title: hit.name, verified: true } : null };
      }).filter((v: any) => v.stance && v.argument);
      if (!ev.counterviews.length) throw new Error("AI chưa đưa được góc nhìn nào.");
    } else {
      const out = await aiJson(`Đoạn sau khẳng định điều có thể kiểm chứng. Đừng dựng "phe phản biện". Hãy nêu: claim_to_check (điều cụ thể cần kiểm chứng, một câu) và how_to_check (2-3 gợi ý cách tìm bằng chứng, mỗi gợi ý một câu). Tiếng Việt.\n\nĐOẠN ĐƯỢC CHỌN:\n${passage}`, { claim_to_check: STR, how_to_check: { type: Type.ARRAY, items: STR } }, ["claim_to_check", "how_to_check"], 0.4);
      ev.verify = { claim_to_check: cap(out.claim_to_check, 300), how_to_check: (Array.isArray(out.how_to_check) ? out.how_to_check : []).slice(0, 3).map((x: any) => cap(x, 250)).filter(Boolean) };
    }
    s.events.push(ev); labSave(s);
    res.json({ success: true, data: { event: ev, session: s } });
  } catch (err: any) {
    console.error("Lab lens error:", err?.message || err);
    fail(res, 502, "Trợ lý AI tạm thời không phản hồi được. Hãy thử lại.");
  }
});

/** Step 4, the friction: defend the claim or adjust the sentence. Reading the counter-view and closing it is not enough. */
app.post("/api/lab/sessions/:id/respond", (req: AuthedRequest, res) => {
  if (!labStudent(req, res)) return;
  const s = labOwn(req, res); if (!s) return;
  const ev = s.events.find((e: any) => e.id === req.body?.event_id);
  if (!ev) return fail(res, 404, "Không tìm thấy đoạn này.");
  if (ev.action) return fail(res, 409, "Bạn đã đối chất đoạn này rồi.");
  const action = req.body?.action;
  if (action !== "defend" && action !== "adjust") return fail(res, 400, "Hãy chọn Bảo vệ luận điểm hoặc Điều chỉnh câu gốc.");
  if (clampInt(req.body?.pasted) > 0) return fail(res, 400, PASTE_MSG);
  if (action === "defend") {
    const t = cap(req.body?.text, 2000);
    if (t.length < LAB_LIMITS.minRebut) return fail(res, 400, `Hãy viết 1-2 câu phản bác (ít nhất ${LAB_LIMITS.minRebut} ký tự).`);
    ev.defense = { text: t, typed: clampInt(req.body?.typed), ts: nowIso() };
  } else {
    const after = cap(req.body?.after_text, LAB_LIMITS.maxAfter);
    if (after.length < LAB_LIMITS.minAfter) return fail(res, 400, "Đoạn sau khi sửa quá ngắn.");
    const sim = Math.round(wordSimilarity(ev.selection.text, after) * 100) / 100;
    if (sim >= 0.97) return fail(res, 400, "Bạn chưa thay đổi gì ở đoạn này. Hãy sửa cho chặt chẽ, đa chiều hơn.");
    ev.rewrite = { before: ev.selection.text, after, similarity: sim, typed: clampInt(req.body?.typed), deleted: clampInt(req.body?.deleted), rewritten_from_scratch: sim < 0.35, ts: nowIso() };
  }
  ev.action = action;
  labSave(s);
  res.json({ success: true, data: { event: ev, session: s } });
});

/** Teacher view: every student's Lab sessions in one course. */
app.get("/api/courses/:id/lab", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!(req.user.role === "admin" || (req.user.role === "teacher" && isOwner(course, req.user)))) return fail(res, 403, "Chỉ giảng viên phụ trách mới xem được Phòng Lab của lớp.");
  const list = db.lab_sessions.filter((s: any) => s.course_id === course.id).map((s: any) => ({ ...s, student_name: db.users.find((u: any) => u.id === s.student_id)?.name || "Sinh viên" })).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
  res.json({ success: true, data: list });
});

// ---- Are you sure? ----
/** Common checks for the Are-you-sure endpoint. Sends the error response itself and returns null when something is wrong. */
function aysContext(req: AuthedRequest, res: express.Response, assignmentId: any) {
  if (req.user.role !== "student") { fail(res, 403, "Chỉ sinh viên mới làm bài tập."); return null; }
  if (!can(req.user, "use_ai_chat")) { denied(res); return null; }
  if (needConsent(req, res)) return null;
  const assignment = db.assignments.find((a: any) => a.id === assignmentId);
  if (!assignment) { fail(res, 404, "Bài tập không tìm thấy."); return null; }
  const course = findCourse(assignment.course_id);
  if (!course || !isMember(course.id, req.user)) { fail(res, 403, "Bạn không thuộc môn học này."); return null; }
  if (assignment.submission_mode !== "ai_chat_only" && assignment.submission_mode !== "both") { fail(res, 400, "Bài tập này không có chặng này."); return null; }
  const existing = db.submissions.find((x: any) => x.assignment_id === assignment.id && x.student_id === req.user.id);
  if (existing && isSubmitted(existing)) { fail(res, 409, "Bài đã nộp, các chặng đã được khóa."); return null; }
  const chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment.id && cs.student_id === req.user.id);
  const block = stageBlocker(assignment, chatSession);
  if (block) { fail(res, 409, block); return null; }
  if (chatRateLimited(req.user.id)) { fail(res, 429, "Bạn gửi quá nhanh, vui lòng đợi vài phút rồi thử lại."); return null; }
  return { assignment, course, chatSession };
}
function pasteBlocked(assignment: any, body: any): boolean { return assignment.paste_mode === "block" && Number(body?.pasted_chars) > 0; }
const ASSIGN_PASTE_MSG = "Bài này khóa dán và sao chép. Hãy tự viết bằng lời của bạn.";

/** What the student has argued so far: the raw text (to check quotes against) and the same text with names removed (to send to the AI). */
function positionOf(chat: any) {
  const parts: string[] = [];
  for (const m of chat.messages) if (m.role === "user" && m.kind !== "intent" && m.stage !== "are_you_sure") parts.push(m.content);
  if (chat.intent?.answers?.length) parts.push(...chat.intent.answers.map((x: any) => x.a));
  for (const m of chat.messages) if (m.role === "user" && m.stage === "are_you_sure") parts.push(m.content);
  const raw = parts.join("\n");
  return { raw, safe: scrub(raw, whoIs(chat.student_id)).slice(-6000) };
}

app.post("/api/ays/turn", async (req: AuthedRequest, res) => {
  const ctx = aysContext(req, res, req.body?.assignment_id); if (!ctx) return;
  const { assignment, chatSession } = ctx;
  const N = stageConfig(assignment).are_you_sure.turns;
  const answered = aysAnswered(chatSession);
  if (answered >= N) return fail(res, 409, "Chặng này đã đủ số lượt, bạn có thể nộp bài.");   // A7: the server counts turns
  const ays = chatSession.messages.filter((m: any) => m.stage === "are_you_sure");
  const last = ays[ays.length - 1];
  const pending = last && last.role === "model" ? last : null;
  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
  const state = (closed: boolean, q: any) => res.json({ success: true, data: { chat_session: publicChat(chatSession, req.user), question: q, answered: aysAnswered(chatSession), total: N, closed } });

  if (!answer) {   // start, or resume the pending question
    if (pending) return state(false, pending);
  } else {
    if (!pending) return fail(res, 400, "Chưa có câu chất vấn để trả lời.");
    if (answer.length < 10) return fail(res, 400, "Hãy trả lời kỹ hơn một chút (ít nhất 10 ký tự).");
    if (answer.length > 3000) return fail(res, 413, "Câu trả lời tối đa 3.000 ký tự.");
    if (pasteBlocked(assignment, req.body)) return fail(res, 400, ASSIGN_PASTE_MSG);
  }

  const who = whoIs(req.user.id);
  try {
    let userMsg: any = null;
    if (answer) {
      const cls = await aiJson(`Phân loại CÂU TRẢ LỜI của sinh viên trước một câu chất vấn.
- "held_with_reason": giữ lập trường VÀ đưa lý lẽ hoặc dẫn chứng.
- "revised": điều chỉnh hoặc làm rõ lập trường, có nêu lý do.
- "conceded_without_reason": đồng ý ngay hoặc nhượng bộ mà không giải thích.
- "dodged": không trả lời vào câu hỏi.
Trả JSON {response_type, quote}; quote là cụm từ 3-12 chữ trích NGUYÊN VĂN từ câu trả lời.

CÂU HỎI CHẤT VẤN: ${scrub(pending.content, who)}

CÂU TRẢ LỜI CỦA SINH VIÊN:
${scrub(answer, who)}`, { response_type: STR, quote: STR }, ["response_type", "quote"], 0.2);
      const rt: ResponseType = (RESPONSE_TYPES as string[]).includes(cls.response_type) ? cls.response_type : "dodged";
      userMsg = { id: uid("m"), role: "user" as const, stage: "are_you_sure", content: answer, timestamp: nowIso(), ays: { response_type: rt, quote: quoteIn(answer, cls.quote) } };
      const p = Number(req.body?.pasted_chars); if (Number.isFinite(p) && p > 0) userMsg.pasted_chars = Math.min(Math.round(p), answer.length);
      const at = clampInt(req.body?.paste_attempts, 50); if (at) userMsg.paste_attempts = at;
    }
    const nowAnswered = answered + (userMsg ? 1 : 0);
    if (userMsg && nowAnswered >= N) {   // last answer: close the stage, no new question
      chatSession.messages.push(userMsg);
      saveDocument("chat_sessions", chatSession.id, chatSession);
      return state(true, null);
    }
    const pos = positionOf(chatSession);
    const prior = chatSession.messages.filter((m: any) => m.stage === "are_you_sure" && m.role === "model").map((m: any) => `- ${m.content}`).join("\n");
    const posText = scrub(pos.raw + (userMsg ? "\n" + userMsg.content : ""), who).slice(-6000);
    const ch = await aiJson(`Bạn là người phản biện thân thiện và giỏi lập luận. Đọc LẬP TRƯỜNG HIỆN TẠI của sinh viên và chọn MỘT điểm yếu CÓ THẬT để chất vấn.
- issue_type: logic_gap (hở logic) | unsupported_claim (khẳng định chưa có dẫn chứng) | ambiguity (chưa rõ nghĩa) | counterexample (có phản ví dụ) | none.
- Chỉ chọn "none" khi lập luận THẬT SỰ vững. Khi đó nói ngắn lập luận vững ở đâu và đặt một câu hỏi MỞ RỘNG (sang tình huống khác), TUYỆT ĐỐI không bịa lỗi.
- question: MỘT câu hỏi tiếng Việt, có dấu "?", bám vào câu của sinh viên, không đưa đáp án. Bạn KHÔNG kiểm tra được nguồn, nên không được khẳng định nguồn của sinh viên là sai hay không tồn tại; chỉ được hỏi "nguồn của bạn là gì, làm sao biết nó đáng tin".
- quote: trích NGUYÊN VĂN 3-12 chữ từ câu sinh viên mà bạn chất vấn.
${prior ? `Các câu đã hỏi (đừng lặp lại):\n${prior}\n` : ""}
LẬP TRƯỜNG HIỆN TẠI CỦA SINH VIÊN:
${posText}`, { issue_type: STR, question: STR, quote: STR }, ["issue_type", "question", "quote"], 0.5);
    const issue: IssueType = (ISSUE_TYPES as string[]).includes(ch.issue_type) ? ch.issue_type : "logic_gap";
    const corpus = pos.raw + (userMsg ? "\n" + userMsg.content : "");
    const qMsg = { id: uid("m"), role: "model" as const, stage: "are_you_sure", content: safeChallenge(cap(ch.question, 600), issue), timestamp: nowIso(), ays: { issue_type: issue, quote: quoteIn(corpus, ch.quote) } };
    if (userMsg) chatSession.messages.push(userMsg);
    chatSession.messages.push(qMsg);
    saveDocument("chat_sessions", chatSession.id, chatSession);
    state(false, qMsg);
  } catch (err: any) {
    console.error("AYS error:", err?.message || err);
    fail(res, 502, "Trợ lý AI tạm thời không phản hồi được. Câu trả lời của bạn chưa được ghi nhận, hãy gửi lại.");
  }
});

app.get("/api/stages/:assignmentId/state", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên xem được tiến độ chặng của mình.");
  const assignment = db.assignments.find((a: any) => a.id === req.params.assignmentId);
  if (!assignment || !isMember(assignment.course_id, req.user)) return fail(res, 404, "Bài tập không tìm thấy.");
  const cs = db.chat_sessions.find((c: any) => c.assignment_id === assignment.id && c.student_id === req.user.id);
  res.json({ success: true, data: { stages: computeStages(assignment, cs), config: stageConfig(assignment), submit_blocker: submitBlocker(assignment, cs) } });
});

// =====================================================================================================================
// Privacy: consent, export, deletion, retention
// =====================================================================================================================
app.post("/api/me/consent", (req: AuthedRequest, res) => {
  if (req.body?.accept !== true) return fail(res, 400, "Cần xác nhận đồng ý để tiếp tục.");
  if (!req.user.consent_at) { req.user.consent_at = nowIso(); saveDocument("users", req.user.id, req.user); audit(req.user, "privacy.consent", req.user.email, ""); }
  res.json({ success: true, data: publicUser(req.user) });
});

app.get("/api/me/export", (req: AuthedRequest, res) => {
  const u = req.user;
  const chats = db.chat_sessions.filter((c: any) => c.student_id === u.id);
  const subs = db.submissions.filter((x: any) => x.student_id === u.id);
  const labs = db.lab_sessions.filter((x: any) => x.student_id === u.id);
  res.setHeader("Content-Disposition", `attachment; filename="traceedu-du-lieu-cua-toi.json"`);
  res.json({ success: true, data: { exported_at: nowIso(), account: { name: u.name, email: u.email, role: u.role, consent_at: u.consent_at || null }, chat_sessions: chats, lab_sessions: labs, submissions: subs, profile_share: u.profile_share || null, note: "Đây là toàn bộ dữ liệu học tập TraceEdu lưu về bạn." } });
});

app.post("/api/me/delete-data", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chức năng này dành cho sinh viên.");
  if (req.body?.confirm !== "XOA") return fail(res, 400, "Hãy gõ XOA để xác nhận.");
  const chats = db.chat_sessions.filter((c: any) => c.student_id === req.user.id), subs = db.submissions.filter((x: any) => x.student_id === req.user.id);
  const labs = db.lab_sessions.filter((x: any) => x.student_id === req.user.id);
  for (const l of labs) deleteDocument("lab_sessions", l.id);
  db.lab_sessions = db.lab_sessions.filter((x: any) => x.student_id !== req.user.id);
  for (const c of chats) deleteDocument("chat_sessions", c.id);
  for (const x of subs) deleteDocument("submissions", x.id);
  db.chat_sessions = db.chat_sessions.filter((c: any) => c.student_id !== req.user.id);
  db.submissions = db.submissions.filter((x: any) => x.student_id !== req.user.id);
  delete req.user.profile_share;
  saveDocument("users", req.user.id, req.user);
  audit(req.user, "privacy.delete", req.user.email, `${chats.length} cuộc chat, ${subs.length} bài nộp`);
  res.json({ success: true, data: { deleted_chats: chats.length, deleted_labs: labs.length, deleted_submissions: subs.length }, message: "Đã xóa dữ liệu học tập của bạn. Tài khoản vẫn còn." });
});

/** Deletes chat logs of submitted work older than the retention period (days). Scores and grades are kept. Returns how many were deleted. */
function purgeExpired(days: number): number {
  if (!days || days < 1) return 0;
  const cutoff = Date.now() - days * 86400000;
  const old = db.chat_sessions.filter((c: any) => {
    const sub = db.submissions.find((x: any) => x.assignment_id === c.assignment_id && x.student_id === c.student_id);
    const lastTs = Math.max(0, ...c.messages.map((m: any) => new Date(m.timestamp || 0).getTime()));
    return sub && isSubmitted(sub) && lastTs > 0 && lastTs < cutoff;
  });
  for (const c of old) {
    deleteDocument("chat_sessions", c.id);
    const sub = db.submissions.find((x: any) => x.assignment_id === c.assignment_id && x.student_id === c.student_id);
    if (sub) { sub.chat_purged_at = nowIso(); saveDocument("submissions", sub.id, sub); }
  }
  db.chat_sessions = db.chat_sessions.filter((c: any) => !old.includes(c));
  const oldLabs = db.lab_sessions.filter((l: any) => new Date(l.created_at).getTime() < cutoff);
  for (const l of oldLabs) deleteDocument("lab_sessions", l.id);
  db.lab_sessions = db.lab_sessions.filter((l: any) => !oldLabs.includes(l));
  return old.length + oldLabs.length;
}
app.post("/api/admin/retention/run", (req: AuthedRequest, res) => {
  const n = purgeExpired(Number(db.settings.retention_days) || 0);
  audit(req.user, "privacy.retention", "Dọn dữ liệu quá hạn", `${n} cuộc chat`);
  res.json({ success: true, data: { deleted: n, retention_days: db.settings.retention_days || 0 } });
});

// ---- Class materials: text the teacher gives the AI to ground its answers in ----
app.post("/api/courses/:id/materials", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Chỉ giảng viên phụ trách mới thêm được tài liệu.");
  if (!can(req.user, "manage_assignments")) return denied(res);
  const name = String(req.body?.name || "").trim().slice(0, 80);
  const text = String(req.body?.text || "").replace(/\r\n/g, "\n").trim();
  if (!name) return fail(res, 400, "Hãy đặt tên cho tài liệu.");
  if (text.length < 20) return fail(res, 400, "Nội dung tài liệu quá ngắn.");
  if (text.length > MATERIAL_LIMITS.perFile) return fail(res, 400, `Mỗi tài liệu tối đa ${MATERIAL_LIMITS.perFile.toLocaleString("vi-VN")} ký tự. Hãy tách thành nhiều tài liệu.`);
  const list: any[] = course.materials || [];
  if (list.length >= MATERIAL_LIMITS.files) return fail(res, 400, `Mỗi môn tối đa ${MATERIAL_LIMITS.files} tài liệu.`);
  if (list.reduce((t, m) => t + m.text.length, 0) + text.length > MATERIAL_LIMITS.total) return fail(res, 400, "Tổng dung lượng tài liệu của môn đã vượt giới hạn.");
  course.materials = [...list, { id: uid("mat"), name, text, added_at: nowIso() }];
  saveDocument("courses", course.id, course);
  audit(req.user, "course.material.add", course.name, name);
  res.json({ success: true, data: courseWithCounts(course, req.user).materials });
});

app.delete("/api/courses/:id/materials/:mid", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Chỉ giảng viên phụ trách mới xóa được tài liệu.");
  const before = (course.materials || []).length;
  course.materials = (course.materials || []).filter((m: any) => m.id !== req.params.mid);
  if (course.materials.length === before) return fail(res, 404, "Không tìm thấy tài liệu.");
  saveDocument("courses", course.id, course);
  res.json({ success: true, data: courseWithCounts(course, req.user).materials });
});

// ---- Learning profile: the student's own record, and an optional read-only link they control ----
function studentProfileData(studentId: string, includeQuotes: boolean) {
  const subs = db.submissions.filter((x: any) => x.student_id === studentId && x.process_score_result?.tieu_chi);
  const items = subs.map((x: any) => ({ assignment_title: db.assignments.find((a: any) => a.id === x.assignment_id)?.title || "Bài tập", at: x.submitted_at, process_score: x.process_score_result.process_score, tieu_chi: x.process_score_result.tieu_chi }));
  const profile = buildProfile(items);
  let quotes: { text: string; reason: string }[] = [];
  if (includeQuotes) {
    const newest = [...subs].sort((a: any, b: any) => String(b.submitted_at || "").localeCompare(String(a.submitted_at || "")));
    for (const x of newest) for (const h of x.process_score_result.highlight_segments || []) {
      if (h.mau === "xanh" && h.doan_van_ban && quotes.length < 3) quotes.push({ text: String(h.doan_van_ban).slice(0, 200), reason: String(h.ly_do || "").slice(0, 200) });
    }
  }
  return { profile, quotes, recent: items.sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 6).map((i) => ({ title: i.assignment_title, score: i.process_score, at: i.at })) };
}

app.get("/api/me/profile", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Hồ sơ tư duy dành cho sinh viên.");
  const d = studentProfileData(req.user.id, !!req.user.profile_share?.include_quotes);
  res.json({ success: true, data: { ...d, share: req.user.profile_share ? { token: req.user.profile_share.token, include_quotes: !!req.user.profile_share.include_quotes, created_at: req.user.profile_share.created_at } : null } });
});

app.post("/api/me/profile/share", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Hồ sơ tư duy dành cho sinh viên.");
  const include = req.body?.include_quotes === true;
  req.user.profile_share = { token: req.user.profile_share?.token || crypto.randomBytes(12).toString("hex"), include_quotes: include, created_at: req.user.profile_share?.created_at || nowIso() };
  saveDocument("users", req.user.id, req.user);
  res.json({ success: true, data: req.user.profile_share });
});

app.delete("/api/me/profile/share", (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Hồ sơ tư duy dành cho sinh viên.");
  delete req.user.profile_share;
  saveDocument("users", req.user.id, req.user);
  res.json({ success: true, data: null });
});

// ---- Does the AI's score agree with the teacher's? (teacher: own courses, admin: everything) ----
app.get("/api/analytics/ai-reliability", (req: AuthedRequest, res) => {
  if (req.user.role !== "teacher" && req.user.role !== "admin") return fail(res, 403, "Chỉ giảng viên hoặc quản trị viên xem được thống kê này.");
  const courses = db.courses.filter((c: any) => req.user.role === "admin" || c.teacher_id === req.user.id);
  const rows: { course: string; sub: any }[] = [];
  for (const c of courses) {
    const ids = new Set(db.assignments.filter((a: any) => a.course_id === c.id && a.submission_mode !== "writing_l2").map((a: any) => a.id));
    for (const sub of db.submissions) if (ids.has(sub.assignment_id) && sub.process_score_result && gradedState(sub)) rows.push({ course: c.name, sub });
  }
  const pairs = rows.map((r) => ({ ai: r.sub.process_score_result.process_score, teacher: r.sub.grade }));
  const byCourse = [...new Set(rows.map((r) => r.course))].map((name) => ({ course: name, ...agreement(rows.filter((r) => r.course === name).map((r) => ({ ai: r.sub.process_score_result.process_score, teacher: r.sub.grade }))) }));
  const demo = rows.length > 0 && rows.every((r) => String(r.sub.id).startsWith(DEMO_PREFIX));
  res.json({ success: true, data: { overall: agreement(pairs), by_course: byCourse, demo, min_recommended: 30 } });
});


app.get("/api/analytics/ai-reliability/sample", (req: AuthedRequest, res) => {
  if (req.user.role !== "teacher" && req.user.role !== "admin") return fail(res, 403, "Không có quyền.");
  const mine = new Set(db.courses.filter((c: any) => req.user.role === "admin" || c.teacher_id === req.user.id).map((c: any) => c.id));
  const ids = db.submissions.filter((x: any) => x.process_score_result && x.student_id && (() => { const a = db.assignments.find((q: any) => q.id === x.assignment_id); return a && mine.has(a.course_id) && a.submission_mode !== "writing_l2" && db.chat_sessions.some((cs: any) => cs.assignment_id === x.assignment_id && cs.student_id === x.student_id); })()).slice(0, 3).map((x: any) => x.id);
  res.json({ success: true, data: ids });
});

// ---- Stability: grade the same work several times, WITHOUT saving, to see how much the AI's score moves ----
app.post("/api/analytics/ai-retest", async (req: AuthedRequest, res) => {
  if (req.user.role !== "teacher" && req.user.role !== "admin") return fail(res, 403, "Chỉ giảng viên hoặc quản trị viên chạy được kiểm tra này.");
  const ids: string[] = (Array.isArray(req.body?.submission_ids) ? req.body.submission_ids : []).slice(0, 5);
  const runs = Math.min(4, Math.max(2, Math.round(Number(req.body?.runs) || 3)));
  if (!ids.length) return fail(res, 400, "Chọn ít nhất một bài nộp.");
  if (!process.env.GEMINI_API_KEY) return fail(res, 400, "Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
  const out: any[] = [];
  for (const id of ids) {
    const sub = db.submissions.find((x: any) => x.id === id);
    const assignment = sub && db.assignments.find((a: any) => a.id === sub.assignment_id);
    if (!sub || !assignment || assignment.submission_mode === "writing_l2") continue;
    const course = findCourse(assignment.course_id);
    if (req.user.role !== "admin" && !isOwner(course, req.user)) continue;
    const chat = db.chat_sessions.find((cs: any) => cs.assignment_id === sub.assignment_id && cs.student_id === sub.student_id);
    if (!chat?.messages.some((m: any) => m.role === "user")) continue;
    const scores: number[] = [];
    for (let i = 0; i < runs; i++) { try { scores.push((await evaluateProcess(assignment, chat, sub.submitted_text)).process_score); } catch { /* a failed run is simply not counted */ } }
    out.push({ submission_id: id, title: assignment.title, scores, ...(spread(scores) || {}) });
  }
  res.json({ success: true, data: { runs, results: out, note: "Các lần chấm này không được lưu và không thay đổi điểm của bài." } });
});

app.use("/api", (req, res) => fail(res, 404, "API không tồn tại."));


// Lazy initialization for serverless / Vercel
let isServerlessInitialized = false;
app.use(async (req, res, next) => {
  if (process.env.VERCEL && !isServerlessInitialized) {
    isServerlessInitialized = true;
    try {
      await initFirestore();
    } catch {}
  }
  next();
});

// Vite & Static file handling
async function startServer() {
  await initFirestore();

  if (isSupabaseConfigured()) {
    console.log("[Supabase] Configuration detected. Checking connection...");
    checkSupabaseConnection().then((res) => {
      if (res.connected) {
        console.log(`[Supabase] Connected to Supabase at ${res.url}`);
      } else {
        console.log(`[Supabase] Note: ${res.error}`);
      }
    }).catch((e) => {
      console.warn("[Supabase] Check warning:", e.message);
    });
  } else {
    console.log("[Supabase] Not configured yet. (Set SUPABASE_URL and SUPABASE_ANON_KEY to connect).");
  }

  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Trace Server] Running on http://0.0.0.0:${PORT}`);
    const sweep = () => { try { const n = purgeExpired(Number(db.settings.retention_days) || 0); if (n) console.log(`[Privacy] Retention: deleted ${n} expired chat log(s).`); } catch (e: any) { console.warn("[Privacy] retention sweep failed:", e?.message || e); } };
    sweep(); setInterval(sweep, 24 * 3600 * 1000).unref?.();
  });
}

// Only start standalone server if not running inside a serverless environment (e.g. Vercel)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };
