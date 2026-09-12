import React, { useState } from "react";
import { Submission, Assignment, ChatSession, ProcessScoreResult } from "../types";
import { 
  ArrowLeft, 
  Award, 
  FileText, 
  Paperclip, 
  Bot, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  Clock,
  Sparkles,
  Info,
  Mail,
  ExternalLink,
  Loader2,
  Share2
} from "lucide-react";
import {
  googleSignIn,
  getAccessToken,
  exportReportToDocs,
  sendResultEmailViaGmail
} from "../lib/workspace";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { normalizeVietnameseText } from "../lib/formatText";

interface TeacherSubmissionViewProps {
  submission: Submission;
  assignment: Assignment;
  chatSession: ChatSession | null;
  onBack: () => void;
}

export const TeacherSubmissionView: React.FC<TeacherSubmissionViewProps> = ({
  submission,
  assignment,
  chatSession,
  onBack,
}) => {
  const result: ProcessScoreResult | undefined = submission.process_score_result;

  const radarData = result?.tieu_chi
    ? [
        { subject: "Phản biện", score: result.tieu_chi.tu_duy_phan_bien, fullMark: 100 },
        { subject: "Đào sâu", score: result.tieu_chi.dao_sau_van_de, fullMark: 100 },
        { subject: "Kiểm chứng", score: result.tieu_chi.kiem_chung_thong_tin, fullMark: 100 },
        { subject: "Nội hóa", score: result.tieu_chi.noi_hoa_kien_thuc, fullMark: 100 },
        { subject: "Chủ động", score: result.tieu_chi.tinh_chu_dong, fullMark: 100 },
      ]
    : [];

  const getHighlightStyle = (color: "xanh" | "vang" | "do" | string) => {
    switch (color) {
      case "xanh":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
      case "vang":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
      case "do":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
      default:
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700";
    }
  };

  const getHighlightLabel = (color: "xanh" | "vang" | "do" | string) => {
    switch (color) {
      case "xanh":
        return "Tư duy độc lập & phản biện sâu";
      case "vang":
        return "Tò mò / Yêu cầu giải đáp";
      case "do":
        return "Nguy cơ dùng AI làm hộ / chép nguyên văn";
      default:
        return "Đoạn điểm nhấn";
    }
  };

  const [isExportingDoc, setIsExportingDoc] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExportDoc = async () => {
    setIsExportingDoc(true);
    setStatusMessage(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (authRes) token = authRes.accessToken;
      }
      if (!token) throw new Error("Cần đăng nhập Google Workspace để tiếp tục.");

      const result = await exportReportToDocs(
        token,
        submission.student_name,
        assignment.title,
        submission,
        chatSession?.messages || []
      );
      setDocUrl(result.documentUrl);
      setStatusMessage("Tạo file Google Doc thành công! Bạn có thể nhấp để xem báo cáo.");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("Lỗi xuất Google Doc: " + (err.message || "Không thể kết nối."));
    } finally {
      setIsExportingDoc(false);
    }
  };

  const handleSendEmailConfirm = async () => {
    setIsSendingEmail(true);
    setStatusMessage(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (authRes) token = authRes.accessToken;
      }
      if (!token) throw new Error("Cần đăng nhập Google Workspace để gửi mail qua Gmail API.");

      const recipientEmail = "sinhvien@example.com"; // Mock / student target email
      const feedback = result?.nhan_xet_ngan || "Đã hoàn thành bài tập phản biện.";

      await sendResultEmailViaGmail(
        token,
        recipientEmail,
        submission.student_name,
        assignment.title,
        submission.process_score || 0,
        feedback
      );

      setEmailSentSuccess(true);
      setShowEmailModal(false);
      setStatusMessage(`Đã gửi email thông báo kết quả đến ${submission.student_name} qua Gmail API!`);
    } catch (err: any) {
      console.error(err);
      setStatusMessage("Lỗi gửi Gmail: " + (err.message || "Đã xảy ra lỗi khi gửi."));
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Chi tiết bài nộp sinh viên
            </div>
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">{submission.student_name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Nộp lúc:{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">
              {submission.submitted_at
                ? new Date(submission.submitted_at).toLocaleString("vi-VN")
                : "Chưa có thời gian"}
            </strong>
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              submission.status === "submitted"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            }`}
          >
            {submission.status === "submitted" ? "Đã nộp đúng hạn" : "Nộp trễ hạn"}
          </span>
        </div>
      </div>

      {/* Process Score Section (USP) */}
      {result ? (
        <div className="bg-zinc-900 dark:bg-zinc-900 text-white rounded-2xl p-6 border border-zinc-800 space-y-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 text-amber-400 flex items-center justify-center font-black border border-zinc-700">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold flex items-center gap-2 text-zinc-100">
                  Đánh giá Quá trình Tư duy AI (Process Score)
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">
                    Gemini AI
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Phân tích minh bạch 5 tiêu chí tư duy dựa trên nhật ký tương tác thực tế với AI
                </p>
              </div>
            </div>

            <div className="flex items-baseline gap-2 bg-zinc-800/80 px-4 py-2.5 rounded-xl border border-zinc-700 shrink-0">
              <span className="text-xs font-bold text-zinc-400 uppercase">Process Score:</span>
              <span className="text-2xl font-black text-amber-400">{result.process_score}</span>
              <span className="text-xs text-zinc-400 font-semibold">/100</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Radar Chart */}
            <div className="lg:col-span-6 bg-zinc-800/40 p-4 rounded-2xl border border-zinc-800 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: "bold" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Tiêu chí" dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Criteria Scores & Feedback */}
            <div className="lg:col-span-6 space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Chi tiết 5 Tiêu chí tư duy:
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/80 flex justify-between">
                    <span className="text-zinc-300">Tư duy phản biện:</span>
                    <strong className="text-amber-400">{result.tieu_chi.tu_duy_phan_bien}/100</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/80 flex justify-between">
                    <span className="text-zinc-300">Đào sâu vấn đề:</span>
                    <strong className="text-amber-400">{result.tieu_chi.dao_sau_van_de}/100</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/80 flex justify-between">
                    <span className="text-zinc-300">Kiểm chứng thông tin:</span>
                    <strong className="text-amber-400">{result.tieu_chi.kiem_chung_thong_tin}/100</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/80 flex justify-between">
                    <span className="text-zinc-300">Nội hóa kiến thức:</span>
                    <strong className="text-amber-400">{result.tieu_chi.noi_hoa_kien_thuc}/100</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/80 col-span-2 flex justify-between">
                    <span className="text-zinc-300">Tính chủ động mở rộng:</span>
                    <strong className="text-amber-400">{result.tieu_chi.tinh_chu_dong}/100</strong>
                  </div>
                </div>
              </div>

              {/* Evaluation Comment */}
              <div className="p-4 rounded-xl bg-zinc-800/90 border border-zinc-700 text-xs text-zinc-200 leading-relaxed font-sans">
                <strong className="text-amber-400 block mb-1">Nhận xét của AI về quá trình làm bài:</strong>
                <MarkdownRenderer content={result.nhan_xet_ngan} className="text-zinc-200 text-xs" />
              </div>

              {/* Out of flow warning */}
              {result.noi_dung_ngoai_luong && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-rose-300 font-bold">Lưu ý nội dung ngoài luồng:</strong>
                    <div className="text-rose-200">{normalizeVietnameseText(result.noi_dung_ngoai_luong)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Highlight Segments in Transcript */}
          {result.highlight_segments?.length > 0 && (
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Các điểm nhấn tư duy quan trọng được AI tự động phân tích:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.highlight_segments.map((seg, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 font-sans ${getHighlightStyle(seg.mau)}`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span>{getHighlightLabel(seg.mau)}</span>
                      <span className="uppercase text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-black/20">
                        {seg.mau}
                      </span>
                    </div>
                    <p className="italic font-sans font-medium text-xs leading-relaxed">
                      "{normalizeVietnameseText(seg.doan_van_ban)}"
                    </p>
                    <p className="text-[11px] opacity-90 font-sans">
                      <strong>Lý do:</strong> {normalizeVietnameseText(seg.ly_do)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Bài tập này không yêu cầu làm qua AI Chat hoặc chưa có đánh giá Process Score.
        </div>
      )}

      {/* Google Workspace Integration Actions */}
      <div className="bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Tích hợp Google Workspace (Google Docs & Gmail API)
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Xuất báo cáo đánh giá tư duy ra Google Docs hoặc gửi kết quả trực tiếp qua Gmail API cho sinh viên.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleExportDoc}
              disabled={isExportingDoc}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-xs disabled:opacity-50"
            >
              {isExportingDoc ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
              Xuất Google Doc
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Mail className="w-4 h-4 text-white" />
              Gửi Mail qua Gmail API
            </button>
          </div>
        </div>

        {/* Status or Doc URL Link */}
        {statusMessage && (
          <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-emerald-500/20 text-xs text-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-3">
            <span>{statusMessage}</span>
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                Mở Google Doc <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Submitted Content Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Submitted Text and Files */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-500" />
            Văn bản & File bài làm chính thức
          </h3>

          {submission.submitted_text ? (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
              <MarkdownRenderer content={submission.submitted_text} />
            </div>
          ) : (
            <div className="text-xs text-zinc-400 italic font-sans">Không có văn bản nhập trực tiếp.</div>
          )}

          {submission.submitted_files?.length > 0 && (
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">File đính kèm ({submission.submitted_files.length})</label>
              {submission.submitted_files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Paperclip className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="truncate font-bold">{file.name}</span>
                    {file.size && <span className="text-[10px] text-zinc-400 shrink-0">({file.size})</span>}
                  </div>
                  {file.url ? (
                    <a
                      href={file.url}
                      download={file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold shrink-0"
                    >
                      Tải về / Xem file
                    </a>
                  ) : (
                    <span className="text-[10px] text-zinc-400">Đã nộp</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Full AI Chat Transcript Timeline */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs flex flex-col max-h-[600px]">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-zinc-500" />
              Nhật ký Hội thoại AI đầy đủ
            </span>
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {chatSession?.messages?.length || 0} tin nhắn
            </span>
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {chatSession?.messages && chatSession.messages.length > 0 ? (
              chatSession.messages.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className={`p-3.5 rounded-xl text-xs space-y-1.5 ${
                    m.role === "user"
                      ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-950 ml-4 border border-zinc-800 dark:border-zinc-200"
                      : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 mr-4 border border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] opacity-75 font-bold">
                    <span>{m.role === "user" ? submission.student_name : "Trợ lý AI (Trace)"}</span>
                    <span>
                      {new Date(m.timestamp || Date.now()).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="leading-relaxed">
                    <MarkdownRenderer
                      content={m.content}
                      className={m.role === "user" ? "text-zinc-100 dark:text-zinc-950" : "text-zinc-800 dark:text-zinc-200"}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-400 italic text-center py-12">
                Không có nhật ký trò chuyện cho bài nộp này.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gmail Confirmation Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                  Xác nhận gửi Mail qua Gmail API
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Thao tác này sẽ gửi email trực tiếp từ tài khoản Gmail của bạn.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Người nhận:</span>
                <strong className="text-zinc-900 dark:text-zinc-100">{submission.student_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Bài tập:</span>
                <strong className="text-zinc-900 dark:text-zinc-100">{assignment.title}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Process Score:</span>
                <strong className="text-emerald-600 dark:text-emerald-400">{submission.process_score}/100</strong>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              ⚠️ <strong>Lưu ý:</strong> Vui lòng xác nhận trước khi hệ thống gửi email chính thức cho sinh viên qua Gmail API.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={isSendingEmail}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSendEmailConfirm}
                disabled={isSendingEmail}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
              >
                {isSendingEmail && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                Xác nhận & Gửi ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
