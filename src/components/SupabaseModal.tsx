import React, { useState, useEffect } from "react";
import { 
  X, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Check, 
  ArrowUpRight, 
  UploadCloud, 
  DownloadCloud,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Server,
  Key,
  Sparkles,
  Play
} from "lucide-react";

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{
    configured: boolean;
    connected: boolean;
    url: string | null;
    error?: string;
    tableStatus?: Record<string, boolean>;
    counts?: Record<string, number>;
  } | null>(null);
  const [schemaSql, setSchemaSql] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "sql" | "guide">("overview");
  const [dbPassword, setDbPassword] = useState("");
  const [autoSettingUp, setAutoSettingUp] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/supabase/status");
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchema = async () => {
    try {
      const res = await fetch("/api/supabase/schema");
      const data = await res.json();
      if (data.success && data.sql) {
        setSchemaSql(data.sql);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      fetchSchema();
      setMessage(null);
    }
  }, [isOpen]);

  const handleCopySql = () => {
    if (!schemaSql) return;
    navigator.clipboard.writeText(schemaSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSyncToSupabase = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/supabase/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: data.message || "Đã đồng bộ toàn bộ dữ liệu sang Supabase thành công!",
        });
        await fetchStatus();
      } else {
        setMessage({
          type: "error",
          text: data.message || "Lỗi đồng bộ. Hãy kiểm tra các bảng đã được tạo bằng SQL Schema chưa.",
        });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Không thể kết nối đến máy chủ" });
    } finally {
      setSyncing(false);
    }
  };

  const handlePullFromSupabase = async () => {
    setPulling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/supabase/pull", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: data.message || "Đã kéo thành công dữ liệu từ Supabase về hệ thống!",
        });
        if (onDataChanged) onDataChanged();
        await fetchStatus();
      } else {
        setMessage({
          type: "error",
          text: data.message || "Không thể tải dữ liệu từ Supabase.",
        });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Không thể kết nối đến máy chủ" });
    } finally {
      setPulling(false);
    }
  };

  const handleAutoSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbPassword.trim()) {
      setMessage({
        type: "error",
        text: "Vui lòng nhập mật khẩu Database của dự án Supabase để tự động kích hoạt.",
      });
      return;
    }

    setAutoSettingUp(true);
    setMessage({
      type: "info",
      text: "Đang kết nối PostgreSQL Supabase và tự động tạo các bảng...",
    });

    try {
      const res = await fetch("/api/supabase/auto-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db_password: dbPassword.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: data.message || "Đã tự động khởi tạo cơ sở dữ liệu và đồng bộ lên Supabase thành công!",
        });
        setDbPassword("");
        if (onDataChanged) onDataChanged();
        await fetchStatus();
      } else {
        setMessage({
          type: "error",
          text: data.message || "Không thể tự động khởi tạo. Vui lòng kiểm tra lại mật khẩu Database.",
        });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Lỗi kết nối máy chủ" });
    } finally {
      setAutoSettingUp(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = Boolean(status?.connected);
  const isConfigured = Boolean(status?.configured);
  const projectRef = status?.url ? status.url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] : null;
  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : "https://supabase.com/dashboard";
  const databaseSettingsUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/settings/database`
    : "https://supabase.com/dashboard";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 text-zinc-900 dark:text-zinc-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white">Liên kết Supabase Database</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
                  PostgreSQL
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-normal">
                Đồng bộ hóa dữ liệu môn học, bài tập và phiên chat AI với tài khoản Supabase của bạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Trạng thái & Đồng bộ</span>
          </button>

          <button
            onClick={() => setActiveTab("sql")}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "sql"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>SQL Schema (Tạo bảng)</span>
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "guide"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Hướng dẫn thiết lập</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium border flex items-start gap-2.5 ${
                message.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">{message.text}</div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & ACTIONS */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Status Card */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isConnected
                        ? "bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse"
                        : isConfigured
                        ? "bg-amber-500"
                        : "bg-zinc-400"
                    }`}
                  />
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <span>Trạng thái kết nối:</span>
                      {isConnected ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã kết nối Supabase
                        </span>
                      ) : isConfigured ? (
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Đã cấu hình, chờ tạo bảng
                        </span>
                      ) : (
                        <span className="text-zinc-500 font-medium">Chưa cấu hình biến môi trường</span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                      URL: {status?.url || "Chưa có SUPABASE_URL"}
                    </div>
                  </div>
                </div>

                <button
                  onClick={fetchStatus}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Kiểm tra lại</span>
                </button>
              </div>

              {/* Auto Activation Box if not connected yet */}
              {!isConnected && isConfigured && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-emerald-500/10 to-teal-500/5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                        Kích hoạt tự động tạo bảng Supabase (Nhanh nhất)
                      </span>
                    </div>
                    <a
                      href={sqlEditorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Hoặc mở SQL Editor</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Nhập <strong>mật khẩu Database</strong> của bạn trên Supabase để hệ thống tự động kết nối qua cổng PostgreSQL bảo mật, tạo 6 bảng và tự động đồng bộ toàn bộ dữ liệu ngay lập tức.
                  </p>

                  <form onSubmit={handleAutoSetup} className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Key className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="password"
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        placeholder="Nhập mật khẩu Database của Supabase..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={autoSettingUp || !dbPassword.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                    >
                      <Play className={`w-3.5 h-3.5 ${autoSettingUp ? "animate-spin" : "fill-current"}`} />
                      <span>{autoSettingUp ? "Đang kích hoạt..." : "Tự động kích hoạt ngay"}</span>
                    </button>
                  </form>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span>* Mật khẩu bạn đã đặt khi tạo dự án trên Supabase.</span>
                    <a
                      href={databaseSettingsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-emerald-500 hover:underline flex items-center gap-0.5"
                    >
                      <span>Quên mật khẩu? Đặt lại tại đây</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Table Status Overview */}
              {status?.tableStatus && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Trạng thái các bảng cơ sở dữ liệu trên Supabase:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(status.tableStatus).map(([tbl, ok]) => (
                      <div
                        key={tbl}
                        className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
                          ok
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                            : "bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                        }`}
                      >
                        <span className="font-bold">{tbl}</span>
                        {ok ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans">Chưa tạo</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Hành động đồng bộ dữ liệu</span>
                  {status?.counts && (
                    <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                      Hiện có: {status.counts.courses} môn học, {status.counts.assignments} bài tập
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSyncToSupabase}
                    disabled={syncing || !isConfigured}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title={!isConfigured ? "Cần cấu hình SUPABASE_URL trước" : "Đẩy dữ liệu hiện tại lên Supabase"}
                  >
                    <UploadCloud className={`w-4 h-4 ${syncing ? "animate-bounce" : ""}`} />
                    <span>{syncing ? "Đang đồng bộ..." : "Đẩy dữ liệu sang Supabase (Push Sync)"}</span>
                  </button>

                  <button
                    onClick={handlePullFromSupabase}
                    disabled={pulling || !isConfigured}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <DownloadCloud className={`w-4 h-4 ${pulling ? "animate-bounce" : ""}`} />
                    <span>{pulling ? "Đang tải..." : "Kéo dữ liệu từ Supabase (Pull Data)"}</span>
                  </button>
                </div>
                {!isConfigured && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                    💡 Để kích hoạt đồng bộ, hãy thêm <strong>SUPABASE_URL</strong> và <strong>SUPABASE_ANON_KEY</strong> vào mục Settings hoặc file <code>.env</code>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SQL SCHEMA */}
          {activeTab === "sql" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    PostgreSQL Schema cho Supabase
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Sao chép mã này và dán vào <strong>SQL Editor</strong> của Supabase rồi bấm <strong>Run</strong>.
                  </p>
                </div>
                <button
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Đã sao chép!" : "Sao chép SQL"}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-zinc-950 text-zinc-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[380px] border border-zinc-800 leading-relaxed">
                  {schemaSql || "Đang tải schema..."}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: GUIDE */}
          {activeTab === "guide" && (
            <div className="space-y-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                  <span>3 Bước liên kết dự án Supabase:</span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="text-zinc-900 dark:text-zinc-100">Lấy thông tin API từ Supabase:</strong>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Truy cập <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 underline inline-flex items-center gap-0.5">Supabase Dashboard <ArrowUpRight className="w-3 h-3" /></a> &gt; Chọn dự án &gt; <strong>Project Settings</strong> &gt; <strong>API</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="text-zinc-900 dark:text-zinc-100">Khai báo biến môi trường:</strong>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Trong menu <strong>Settings</strong> của AI Studio (hoặc tệp môi trường), thiết lập 2 biến:
                      </p>
                      <ul className="list-disc pl-5 mt-1 text-zinc-600 dark:text-zinc-300 font-mono text-[11px] space-y-0.5">
                        <li><code>SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co</code></li>
                        <li><code>SUPABASE_ANON_KEY=[YOUR_ANON_PUBLIC_KEY]</code></li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <strong className="text-zinc-900 dark:text-zinc-100">Tạo bảng tự động:</strong>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Chuyển sang tab <strong>SQL Schema</strong>, bấm nút <strong>"Sao chép SQL"</strong> và chạy mã này trong <strong>SQL Editor</strong> của Supabase. Toàn bộ 6 bảng và các chính sách bảo mật RLS sẽ được khởi tạo tự động!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span>Hỗ trợ tự động lưu đồng thời cả Supabase &amp; Firestore</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
