import React, { useState, useEffect, useRef } from "react";
import { Assignment, Submission, ChatSession, ProcessScoreResult } from "../types";
import { FileUploadZone, UploadedFileItem } from "./FileUploadZone";
import { 
  ArrowLeft, 
  Send, 
  Bot, 
  Sparkles, 
  Paperclip, 
  CheckCircle2, 
  Lock, 
  Clock, 
  AlertCircle,
  FileText,
  Upload,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Award
} from "lucide-react";
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

interface StudentWorkspaceViewProps {
  assignment: Assignment;
  courseName?: string;
  studentId: string;
  submission: Submission | null;
  chatSession: ChatSession | null;
  onBack: () => void;
  onSubmitAssignment: (data: {
    assignment_id: string;
    student_id: string;
    submitted_files: any[];
    submitted_text: string;
    notes?: string;
  }) => Promise<void>;
  onSendMessage: (data: {
    assignment_id: string;
    student_id: string;
    message_content: string;
  }) => Promise<any>;
}

export const StudentWorkspaceView: React.FC<StudentWorkspaceViewProps> = ({
  assignment,
  courseName,
  studentId,
  submission,
  chatSession,
  onBack,
  onSubmitAssignment,
  onSendMessage,
}) => {
  const [messages, setMessages] = useState<any[]>(chatSession?.messages || []);
  const [inputMsg, setInputMsg] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [submittedFiles, setSubmittedFiles] = useState<UploadedFileItem[]>(
    (submission?.submitted_files || []).map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size || "Đã đính kèm",
      url: f.url,
      type: f.type,
    }))
  );
  const [submittedText, setSubmittedText] = useState(submission?.submitted_text || "");
  const [notes, setNotes] = useState(submission?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(submission?.status === "submitted" || submission?.status === "late");
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(submission);
  const [showPromptMobile, setShowPromptMobile] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || isSending || isSubmitted) return;

    const userText = inputMsg.trim();
    setInputMsg("");
    setIsSending(true);

    // If files uploaded, append file context summary for Gemini
    let fullContent = userText;
    if (submittedFiles.length > 0 && messages.length === 0) {
      const filesContext = submittedFiles.map(f => {
        if (f.textContent) {
          return `\n\n[File đính kèm: ${f.name} (${f.size})]\nNội dung file:\n${f.textContent}`;
        }
        return `\n\n[File đính kèm: ${f.name} (${f.size})]`;
      }).join("");
      fullContent = `${userText}${filesContext}`;
    }

    // Optimistic user msg update
    const tempUserMsg = {
      id: "temp_" + Date.now(),
      role: "user",
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await onSendMessage({
        assignment_id: assignment.id,
        student_id: studentId,
        message_content: fullContent,
      });

      if (res?.data?.chat_session?.messages) {
        setMessages(res.data.chat_session.messages);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isSubmitted) return;

    setIsSubmitting(true);
    try {
      await onSubmitAssignment({
        assignment_id: assignment.id,
        student_id: studentId,
        submitted_files: submittedFiles,
        submitted_text: submittedText,
        notes,
      });
      setIsSubmitted(true);
    } catch (err: any) {
      alert(err.message || "Không thể nộp bài, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const userInteractionCount = messages.filter((m) => m.role === "user").length;
  const canSubmit = assignment.submission_mode === "file_only" || userInteractionCount >= 3 || isSubmitted;

  // Prepare radar data if process score exists
  const processResult: ProcessScoreResult | undefined = currentSubmission?.process_score_result || submission?.process_score_result;
  
  const radarData = processResult?.tieu_chi ? [
    { subject: "Phản biện", score: processResult.tieu_chi.tu_duy_phan_bien, fullMark: 100 },
    { subject: "Đào sâu", score: processResult.tieu_chi.dao_sau_van_de, fullMark: 100 },
    { subject: "Kiểm chứng", score: processResult.tieu_chi.kiem_chung_thong_tin, fullMark: 100 },
    { subject: "Nội hóa", score: processResult.tieu_chi.noi_hoa_kien_thuc, fullMark: 100 },
    { subject: "Chủ động", score: processResult.tieu_chi.tinh_chu_dong, fullMark: 100 },
  ] : [];

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between gap-4 shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{courseName}</div>
            <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              {assignment.title}
              {isSubmitted && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Đã nộp bài
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs transition-all ${
                canSubmit
                  ? "bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <span>Đang xử lý nộp bài...</span>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Nộp bài chính thức</span>
                </>
              )}
            </button>
          ) : (
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <Lock className="w-3.5 h-3.5" />
              <span>Đã khóa chỉnh sửa</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Container - Split View */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Column: Prompt, Rubric, Documents */}
        <div
          className={`w-full md:w-5/12 lg:w-4/12 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto p-5 space-y-6 ${
            showPromptMobile ? "block" : "hidden md:block"
          }`}
        >
          {/* Socratic banner */}
          {assignment.submission_mode !== "file_only" && assignment.ai_submode === "socratic" && (
            <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Chế độ Socratic AI kích hoạt
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Trợ lý AI sẽ đặt câu hỏi gợi mở để hỗ trợ tư duy. Bạn cần trao đổi ít nhất 3 lượt để nộp bài.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Đề bài & Yêu cầu</h3>
            <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <MarkdownRenderer content={assignment.description || "Không có mô tả bổ sung."} />
            </div>
          </div>

          {/* Rubric */}
          {assignment.rubric && (
            <div>
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Tiêu chí đánh giá (Rubric)</h3>
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <MarkdownRenderer content={assignment.rubric} />
              </div>
            </div>
          )}

          {/* Attachments */}
          {assignment.attachments?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Tài liệu tham khảo</h3>
              <div className="space-y-2">
                {assignment.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span className="font-semibold truncate">{att.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 shrink-0">{att.size}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Process Score Result Summary if Submitted */}
          {isSubmitted && processResult && (
            <div className="p-4 rounded-2xl bg-zinc-900 dark:bg-zinc-950 text-white space-y-4 border border-zinc-800 shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-sm">Kết quả AI Process Score</span>
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {processResult.process_score}<span className="text-xs text-zinc-400 font-normal">/100</span>
                </div>
              </div>

              {/* Radar chart */}
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                    <PolarGrid stroke="#3f3f46" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Tiêu chí" dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="text-xs text-zinc-300 bg-zinc-800/80 p-3 rounded-xl border border-zinc-700 leading-relaxed font-sans">
                <strong className="text-amber-400 block mb-1">Nhận xét quá trình tư duy:</strong>
                <MarkdownRenderer content={processResult.nhan_xet_ngan} className="text-zinc-200 text-xs" />
              </div>
            </div>
          )}
        </div>

        {/* Mobile prompt toggle */}
        <div className="md:hidden bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <span>{showPromptMobile ? "Đang hiện Đề bài" : "Đang làm bài trong AI Chat"}</span>
          <button
            onClick={() => setShowPromptMobile(!showPromptMobile)}
            className="flex items-center gap-1 text-zinc-900 dark:text-zinc-100 underline"
          >
            {showPromptMobile ? "Xem khung chat" : "Xem đề bài & tài liệu"}
            {showPromptMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Right Column: AI Chat or File Upload Workspace */}
        <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 h-full overflow-hidden">
          {assignment.submission_mode === "file_only" ? (
            /* File Only Mode Workspace */
            <div className="p-6 max-w-2xl mx-auto w-full space-y-6 overflow-y-auto">
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-500" />
                  Nộp file bài làm
                </h3>

                <FileUploadZone
                  files={submittedFiles}
                  onFilesChange={setSubmittedFiles}
                  disabled={isSubmitted}
                  label="Kéo & thả file bài làm vào đây, hoặc nhấp để tải từ máy"
                  sublabel="Hỗ trợ PDF, Word (.docx), TXT, Mã nguồn, ZIP, Ảnh (Tối đa 15MB)"
                />

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Ghi chú hoặc nội dung nộp văn bản</label>
                  <textarea
                    rows={4}
                    disabled={isSubmitted}
                    placeholder="Nhập nội dung tóm tắt bài nộp hoặc ghi chú gửi Giảng viên..."
                    value={submittedText}
                    onChange={(e) => setSubmittedText(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* AI Chat Workspace View */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Chat Message History */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="max-w-md">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Bắt đầu trao đổi với Trợ lý AI</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        {assignment.ai_submode === "socratic"
                          ? "Hãy đặt câu hỏi về đề bài. Trợ lý Socratic sẽ gợi mở từng bước giúp bạn tự xây dựng lời giải xuất sắc nhất."
                          : "Đặt câu hỏi để được trợ lý giải đáp thắc mắc và hướng dẫn làm bài tập."}
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isUser
                              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {isUser ? "SV" : <Bot className="w-3.5 h-3.5" />}
                        </div>

                        <div className={`space-y-1 ${isUser ? "text-right" : "text-left"}`}>
                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed font-sans ${
                              isUser
                                ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-950"
                                : "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800"
                            }`}
                          >
                            <MarkdownRenderer
                              content={msg.content}
                              className={isUser ? "text-zinc-100 dark:text-zinc-950" : "text-zinc-800 dark:text-zinc-200"}
                            />
                          </div>
                          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 px-1">
                            {new Date(msg.timestamp || Date.now()).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {isSending && (
                  <div className="flex gap-3 max-w-3xl mr-auto">
                    <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center animate-pulse">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 italic flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                      Trợ lý AI đang tư duy câu trả lời...
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* If "both" mode, add file dropzone section above chat bar */}
              {assignment.submission_mode === "both" && (
                <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                  <FileUploadZone
                    files={submittedFiles}
                    onFilesChange={setSubmittedFiles}
                    disabled={isSubmitted}
                    label="Kéo & thả file đính kèm bài làm vào đây để nộp cùng với trao đổi AI"
                    sublabel="Hỗ trợ PDF, Word, TXT, mã nguồn, ZIP..."
                  />
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="p-3 md:p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                {isSubmitted ? (
                  <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    Đã nộp bài thành công. Toàn bộ hội thoại đã được lưu lại trong AI Process log.
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={
                        assignment.ai_submode === "socratic"
                          ? "Hỏi hoặc phản biện lại Trợ lý AI..."
                          : "Nhập tin nhắn cho AI..."
                      }
                      value={inputMsg}
                      onChange={(e) => setInputMsg(e.target.value)}
                      disabled={isSending}
                      className="flex-1 px-4 py-3 text-xs md:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950"
                    />
                    <button
                      type="submit"
                      disabled={!inputMsg.trim() || isSending}
                      className="p-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 font-bold rounded-xl transition-colors disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}

                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 px-1">
                  <span>Nhật ký trao đổi AI được bảo lưu để giảng viên chấm điểm quá trình.</span>
                  <span>Đã tương tác: <strong className="text-zinc-700 dark:text-zinc-300">{userInteractionCount} lượt</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
