import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
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

/** Calls Gemini, retrying overloaded/rate-limited responses and falling back to other models. */
async function generateWithFallback(params: { contents: any; config?: any }, timeoutMs = 30000) {
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACKS.filter((m) => m !== GEMINI_MODEL)];
  let lastErr: any;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await Promise.race([
          getGenAI().models.generateContent({ model, ...params }),
          new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error(`Model ${model} không phản hồi trong ${timeoutMs / 1000}s`), { code: 503 })), timeoutMs)),
        ]);
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
  users: Array<{ id: string; name: string; email: string; role: 'teacher' | 'student' | 'admin'; avatar: string; pwd?: string; active?: boolean; last_seen?: string }>;
  courses: Array<any>;
  course_members: Array<any>;
  assignments: Array<any>;
  submissions: Array<any>;
  chat_sessions: Array<any>;
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
  notifications: [],
  audit_logs: [],
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  users: [
    {
      id: "u_admin_1",
      name: "Quản trị viên Trace",
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

const DOC_COLLECTIONS = ["users", "courses", "course_members", "assignments", "submissions", "chat_sessions", "notifications", "audit_logs"] as const;
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
  return { users: [], courses: [], course_members: [], assignments: [], submissions: [], chat_sessions: [], notifications: [], audit_logs: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) };
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
    console.error("[Supabase] Load failed:", e.message);
    return res.status(503).json({ success: false, message: "Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau ít phút." });
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
const publicUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, active: u.active !== false, last_seen: u.last_seen, permissions: permsFor(u) });
function audit(actor: any, action: string, target: string, detail = "") {
  const log = { id: uid("log"), actor_id: actor?.id || "", actor_name: actor?.name || "Hệ thống", action, target, detail, created_at: nowIso() };
  db.audit_logs.unshift(log);
  if (db.audit_logs.length > 500) db.audit_logs.length = 500;
  saveDocument("audit_logs", log.id, log);
}
const denied = (res: express.Response) => fail(res, 403, "Bạn chưa được cấp quyền thực hiện thao tác này. Hãy liên hệ quản trị viên.");
const fail = (res: express.Response, code: number, message: string) => res.status(code).json({ success: false, message });

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
  res.json({ success: true, data: course, message: "Cập nhật thông tin môn học thành công!" });
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
      const out: any = { ...a };
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
  res.json({ success: true, data: { ...(owner ? course : rest), members, assignments } });
});

// ---- Assignments ----
function sanitizeAssignmentInput(body: any) {
  const { title, description, rubric, due_date, attachments, submission_mode, ai_submode, allow_late } = body || {};
  return {
    title: typeof title === "string" ? title.trim() : title,
    description: description ?? "",
    rubric: rubric ?? "",
    due_date,
    attachments: Array.isArray(attachments) ? attachments : [],
    submission_mode: ["file_only", "ai_chat_only", "both"].includes(submission_mode) ? submission_mode : "both",
    ai_submode: ai_submode === "normal" ? "normal" : "socratic",
    allow_late: allow_late === false ? false : true,
  };
}

app.post("/api/courses/:id/assignments", (req: AuthedRequest, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Không tìm thấy môn học.");
  if (!isOwner(course, req.user)) return fail(res, 403, "Bạn không có quyền giao bài cho môn này.");
  if (!can(req.user, "manage_assignments")) return denied(res);
  const input = sanitizeAssignmentInput(req.body);
  if (!input.title || !input.due_date || isNaN(new Date(input.due_date).getTime())) return fail(res, 400, "Tiêu đề và hạn nộp hợp lệ là bắt buộc.");
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
  const input = sanitizeAssignmentInput({ ...a, ...req.body });
  if (!input.title || !input.due_date || isNaN(new Date(input.due_date).getTime())) return fail(res, 400, "Tiêu đề và hạn nộp hợp lệ là bắt buộc.");
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
  res.json({ success: true, data: { assignment, course_name: course.name, submission, chat_session: chatSession } });
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
  res.json({ success: true, data: { submission: sub, assignment, chat_session: chatSession } });
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
  return chat.messages.map((m: any) => `${m.role === "user" ? "Sinh viên" : "AI Assistant"}: ${m.content}`).join("\n");
}

async function evaluateProcess(assignment: any, chat: any, submittedText: string) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
  const transcript = transcriptOf(chat).slice(-60000);
  const evalPrompt = `Bạn được cung cấp transcript cuộc trò chuyện giữa sinh viên và AI khi làm bài tập [${assignment.title}], cùng bài nộp cuối cùng (nếu có: "${submittedText || "Không có văn bản nộp trực tiếp"}"). Hãy đánh giá QUÁ TRÌNH TƯ DUY của sinh viên một cách nghiêm khắc, trung thực: nếu sinh viên chỉ xin đáp án, copy-paste, hoặc làm hộ thì điểm phải thấp. Trả về JSON theo schema:
- process_score: số nguyên 0-100
- tieu_chi: tu_duy_phan_bien (chất vấn/phản bác AI), dao_sau_van_de (refine câu hỏi từ chung chung sang cụ thể), kiem_chung_thong_tin (yêu cầu dẫn nguồn/verify), noi_hoa_kien_thuc (tự diễn giải bằng lời riêng), tinh_chu_dong (mở rộng vấn đề thay vì chỉ nhận đáp án); mỗi tiêu chí 0-100
- noi_dung_ngoai_luong: mô tả nếu bài nộp có đoạn không khớp transcript, hoặc chuỗi rỗng
- nhan_xet_ngan: 2-3 câu tiếng Việt tóm tắt kiểu tư duy
- highlight_segments: danh sách {doan_van_ban (trích NGUYÊN VĂN câu của sinh viên), mau: "xanh"|"vang"|"do", ly_do}
Màu: xanh = phản biện/tư duy sâu/tự tổng hợp; vang = tò mò, cần làm rõ; do = copy hoàn toàn hoặc nhờ AI làm hộ.`;
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
              properties: { doan_van_ban: { type: Type.STRING }, mau: { type: Type.STRING }, ly_do: { type: Type.STRING } },
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
  parsed.highlight_segments = (parsed.highlight_segments || []).map((h: any) => ({ ...h, mau: ["xanh", "vang", "do"].includes(h.mau) ? h.mau : "vang" }));
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

// ---- AI chat ----
const chatHits = new Map<string, number[]>();
function chatRateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (chatHits.get(userId) || []).filter((t) => now - t < 5 * 60 * 1000);
  if (hits.length >= 25) { chatHits.set(userId, hits); return true; }
  hits.push(now);
  chatHits.set(userId, hits);
  return false;
}

app.post("/api/chat/message", async (req: AuthedRequest, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Chỉ sinh viên mới trò chuyện trong bài tập.");
  if (!can(req.user, "use_ai_chat")) return denied(res);
  const { assignment_id, message_content } = req.body || {};
  if (!assignment_id || !message_content || typeof message_content !== "string") return fail(res, 400, "Thiếu thông tin tin nhắn.");
  if (message_content.length > 30000) return fail(res, 413, "Tin nhắn quá dài (tối đa 30.000 ký tự).");
  const assignment = db.assignments.find((a: any) => a.id === assignment_id);
  if (!assignment) return fail(res, 404, "Bài tập không tìm thấy.");
  const course = findCourse(assignment.course_id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 403, "Bạn không thuộc môn học này.");
  if (assignment.submission_mode === "file_only") return fail(res, 400, "Bài tập này chỉ nộp file, không có AI chat.");
  const existing = db.submissions.find((s: any) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (existing && isSubmitted(existing)) return fail(res, 409, "Bài đã nộp, cuộc trò chuyện đã được khóa.");
  if (chatRateLimited(req.user.id)) return fail(res, 429, "Bạn gửi quá nhanh, vui lòng đợi vài phút rồi thử lại.");

  let chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  if (!chatSession) {
    chatSession = { id: uid("cs"), assignment_id, student_id: req.user.id, messages: [] };
    db.chat_sessions.push(chatSession);
  }
  const userMsg = { id: uid("m"), role: "user" as const, content: message_content, timestamp: nowIso() };
  chatSession.messages.push(userMsg);

  const systemInstruction = assignment.ai_submode === "socratic"
    ? `Bạn là trợ lý học tập AI trong môn ${course.name}, hỗ trợ sinh viên làm bài tập: ${assignment.title}. Mô tả bài tập: ${assignment.description}.
Khi sinh viên hỏi, đừng đưa đáp án ngay. Đặt 1-2 câu hỏi gợi mở để sinh viên tự suy nghĩ trước. Chỉ đưa đáp án/hướng dẫn chi tiết sau khi sinh viên đã thử trả lời. Nếu sinh viên yêu cầu đáp án ngay, nhắc nhẹ nhàng về lợi ích tự tư duy trước, sau đó vẫn hỗ trợ nếu họ thực sự cần.
Trả lời bằng tiếng Việt thân thiện, rõ ràng, mang tính giáo dục.`
    : `Bạn là trợ lý học tập AI nhiệt tình trong môn ${course.name}, hỗ trợ sinh viên làm bài tập: ${assignment.title}.
Giải đáp thắc mắc, gợi ý hướng giải quyết và cung cấp tài liệu tham khảo chính xác. Trả lời bằng tiếng Việt chuyên nghiệp, ngắn gọn.`;

  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
    const response = await generateWithFallback({
      contents: chatSession.messages.map((m: any) => ({ role: m.role, parts: [{ text: m.content }] })),
      config: { systemInstruction, temperature: 0.7 },
    });
    const replyText = response.text;
    if (!replyText) throw new Error("AI trả về nội dung rỗng.");
    const aiMsg = { id: uid("m"), role: "model" as const, content: replyText, timestamp: nowIso() };
    chatSession.messages.push(aiMsg);
    saveDocument("chat_sessions", chatSession.id, chatSession);
    res.json({ success: true, data: { chat_session: chatSession, new_message: aiMsg } });
  } catch (err: any) {
    console.error("Gemini Chat Error:", err?.message || err);
    // Roll back the unanswered message so the student can simply retry
    chatSession.messages = chatSession.messages.filter((m: any) => m.id !== userMsg.id);
    fail(res, 502, "Trợ lý AI tạm thời không phản hồi được. Tin nhắn chưa được ghi nhận, hãy thử gửi lại.");
  }
});

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

  const chatSession = db.chat_sessions.find((cs: any) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  const userTurns = chatSession ? chatSession.messages.filter((m: any) => m.role === "user").length : 0;
  if (assignment.submission_mode !== "file_only" && userTurns < 3) return fail(res, 400, "Bạn cần trao đổi ít nhất 3 lượt với trợ lý AI trước khi nộp.");
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
    const aScores = aSubs.filter((s: any) => s.process_score_result).map((s: any) => s.process_score_result.process_score);
    const avgScore = avg(aScores);
    return {
      assignment_id: a.id,
      title: a.title,
      submitted: aSubs.length,
      total: members.length,
      avg_score: avgScore,
      recommendation: avgScore === null
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
      avg_grade: myGrades.length ? Math.round((myGrades.reduce((a: number, b: number) => a + b, 0) / myGrades.length) * 10) / 10 : null,
      needs_attention: (myScores.length > 0 && (avg(myScores) as number) < 60) || (assignments.length > 0 && mine.length < assignments.length / 2),
    };
  });

  res.json({
    success: true,
    data: {
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
  const { allow_registration, teacher_self_register, permissions } = req.body || {};
  const next = JSON.parse(JSON.stringify(db.settings));
  if (typeof allow_registration === "boolean") next.allow_registration = allow_registration;
  if (typeof teacher_self_register === "boolean") next.teacher_self_register = teacher_self_register;
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

app.get("/api/admin/audit", (req, res) => res.json({ success: true, data: db.audit_logs.slice(0, 200) }));

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
  });
}

// Only start standalone server if not running inside a serverless environment (e.g. Vercel)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };
