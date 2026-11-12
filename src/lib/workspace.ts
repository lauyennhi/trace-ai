import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/documents");
provider.addScope("https://www.googleapis.com/auth/gmail.send");
provider.addScope("https://www.googleapis.com/auth/drive.file");

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    return localStorage.getItem("trace_google_access_token");
  } catch {
    return null;
  }
})();

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn && onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Không lấy được OAuth Access Token từ Google. Vui lòng thử lại.");
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem("trace_google_access_token", cachedAccessToken);
    } catch {}

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Lỗi đăng nhập Google Workspace:", error);
    if (
      error.code === "auth/popup-blocked" ||
      error.code === "auth/cancelled-popup-request" ||
      error.message?.includes("popup")
    ) {
      throw new Error(
        "Trình duyệt đã chặn cửa sổ đăng nhập Google (Popup). Nếu bạn đang mở trong khung xem trước iframe, vui lòng mở ứng dụng sang Tab mới hoặc cho phép hiển thị Pop-up để đăng nhập tài khoản Google."
      );
    }
    if (error.code === "auth/unauthorized-domain") {
      throw new Error(
        "Tên miền hiện tại cần được cấp quyền trong Firebase Authentication. Hãy đảm bảo bạn đã mở ứng dụng từ đường dẫn chính thức."
      );
    }
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.");
    }
    throw new Error(error.message || "Không thể hoàn tất xác thực Google Workspace");
  } finally {
    isSigningIn = false;
  }
};

export const googleSignOut = async () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem("trace_google_access_token");
  } catch {}
  await auth.signOut();
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const saved = localStorage.getItem("trace_google_access_token");
    if (saved) {
      cachedAccessToken = saved;
      return saved;
    }
  } catch {}
  return null;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Đã nộp đúng hạn",
  late: "Nộp trễ",
  not_submitted: "Chưa nộp",
  draft: "Chưa nộp",
};

/** Single source of truth for gradebook exports (CSV + Google Sheets). */
const GRADEBOOK_HEADERS = [
  "Họ và tên sinh viên", "Email", "Trạng thái", "Ngày nộp", "Điểm giảng viên (/10)", "Nhận xét giảng viên",
  "Process Score (/100)", "Tư duy phản biện", "Đào sâu vấn đề", "Nhận xét của AI",
];
const gradebookRows = (submissions: any[]): (string | number)[][] =>
  submissions.map((s) => [
    s.student_name || "Sinh viên",
    s.student_email || "",
    STATUS_LABEL[s.status] || "Chưa nộp",
    s.submitted_at ? new Date(s.submitted_at).toLocaleString("vi-VN") : "",
    s.grade ?? "",
    s.feedback || "",
    s.process_score_result?.process_score ?? "",
    s.process_score_result?.tieu_chi?.tu_duy_phan_bien ?? "",
    s.process_score_result?.tieu_chi?.dao_sau_van_de ?? "",
    s.process_score_result?.nhan_xet_ngan || "",
  ]);

// 0. Fallback: Export CSV directly for instant local download
export const downloadGradebookCSV = (
  courseName: string,
  assignmentTitle: string,
  submissions: any[]
) => {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const headers = GRADEBOOK_HEADERS.map(esc);
  const rows = gradebookRows(submissions).map((r) => r.map(esc));

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Bang_diem_${courseName}_${assignmentTitle}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 1. Export Submissions Gradebook to Google Sheets
export const exportSubmissionsToSheets = async (
  token: string,
  courseName: string,
  assignmentTitle: string,
  submissions: any[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  // Step 1: Create a new Spreadsheet via Google Sheets API
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: `Bảng điểm Process Score - ${courseName} - ${assignmentTitle}`,
      },
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json();
    throw new Error(errData.error?.message || "Không thể tạo Google Sheet");
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // Step 2: Populate rows
  const rows = [GRADEBOOK_HEADERS, ...gradebookRows(submissions)];

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:J${rows.length}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json();
    throw new Error(errData.error?.message || "Lỗi ghi dữ liệu vào Google Sheet");
  }

  return { spreadsheetId, spreadsheetUrl };
};

// 2. Export Detailed Evaluation Report to Google Docs
export const exportReportToDocs = async (
  token: string,
  studentName: string,
  assignmentTitle: string,
  submission: any,
  chatMessages: any[]
): Promise<{ documentId: string; documentUrl: string }> => {
  // Step 1: Create a Google Doc via Google Docs API
  const title = `Báo cáo Đánh giá Phản biện Socratic - ${studentName} - ${assignmentTitle}`;
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json();
    throw new Error(errData.error?.message || "Không thể tạo Google Doc");
  }

  const docData = await createRes.json();
  const documentId = docData.documentId;
  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  // Construct text content
  const resData = submission.process_score_result;
  let text = `BÁO CÁO ĐÁNH GIÁ TƯ DUY PHẢN BIỆN (PROCESS SCORE)\n`;
  text += `====================================================\n\n`;
  text += `Sinh viên: ${studentName}\n`;
  text += `Bài tập: ${assignmentTitle}\n`;
  text += `Thời gian nộp: ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("vi-VN") : "N/A"}\n`;
  text += `Điểm Process Score tổng kết: ${submission.process_score || "N/A"}/100\n\n`;

  if (resData?.tieu_chi) {
    text += `[ĐIỂM CHI TIẾT THEO TIÊU CHÍ]\n`;
    text += `- Tư duy phản biện: ${resData.tieu_chi.tu_duy_phan_bien}/100\n`;
    text += `- Đào sâu vấn đề: ${resData.tieu_chi.dao_sau_van_de}/100\n`;
    text += `- Kiểm chứng thông tin: ${resData.tieu_chi.kiem_chung_thong_tin}/100\n`;
    text += `- Nội hóa kiến thức: ${resData.tieu_chi.noi_hoa_kien_thuc}/100\n`;
    text += `- Tính chủ động: ${resData.tieu_chi.tinh_chu_dong}/100\n\n`;
  }

  if (resData?.nhan_xet_ngan) {
    text += `[NHẬN XÉT TỔNG QUAN TỪ AI SOCRATIC TUTOR]\n`;
    text += `${resData.nhan_xet_ngan}\n\n`;
  }

  if (resData?.diem_manh?.length) {
    text += `[ĐIỂM MẠNH LỚN NHẤT]\n`;
    resData.diem_manh.forEach((m: string, i: number) => {
      text += `${i + 1}. ${m}\n`;
    });
    text += `\n`;
  }

  if (resData?.diem_can_cai_thien?.length) {
    text += `[ĐIỂM CẦN CẢI THIỆN]\n`;
    resData.diem_can_cai_thien.forEach((c: string, i: number) => {
      text += `${i + 1}. ${c}\n`;
    });
    text += `\n`;
  }

  if (chatMessages && chatMessages.length > 0) {
    text += `[LỊCH SỬ HỘI THOẠI PHẢN BIỆN SOCRATIC VỚI AI TUTOR]\n`;
    chatMessages.forEach((m: any, idx: number) => {
      const sender = m.sender === "user" ? studentName : "AI Socratic Tutor";
      text += `${idx + 1}. ${sender}: ${m.content}\n\n`;
    });
  }

  // Insert text into Google Doc
  const insertRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text,
          },
        },
      ],
    }),
  });

  if (!insertRes.ok) {
    const errData = await insertRes.json();
    throw new Error(errData.error?.message || "Không thể chèn nội dung vào Google Doc");
  }

  return { documentId, documentUrl };
};

// 3. Send Notification Email via Gmail API
export const sendResultEmailViaGmail = async (
  token: string,
  recipientEmail: string,
  studentName: string,
  assignmentTitle: string,
  score: number,
  feedbackText: string
): Promise<boolean> => {
  const subject = `[TRACE AI] Kết quả đánh giá bài tập: ${assignmentTitle}`;
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

  const emailLines = [
    `To: ${recipientEmail}`,
    `Subject: ${utf8Subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    `Chào ${studentName},`,
    ``,
    `Giảng viên và Hệ thống TRACE AI vừa hoàn tất đánh giá bài tập "${assignmentTitle}" của bạn.`,
    ``,
    `📊 TỔNG ĐIỂM PROCESS SCORE: ${score}/100`,
    ``,
    `📝 Nhận xét chi tiết từ AI Socratic Tutor:`,
    `${feedbackText}`,
    ``,
    `Bạn có thể truy cập hệ thống TRACE để xem chi tiết biểu đồ phản biện và lộ trình phát triển tư duy của mình.`,
    ``,
    `Trân trọng,`,
    `Đội ngũ TRACE AI & Giảng viên bộ môn`,
  ];

  const emailRaw = emailLines.join("\r\n");
  const encodedEmail = btoa(unescape(encodeURIComponent(emailRaw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error?.message || "Lỗi gửi email qua Gmail API");
  }

  return true;
};
