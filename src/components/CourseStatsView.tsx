import React from "react";
import { ClassStats } from "../types";
import { Award, BarChart3, AlertCircle, Sparkles, CheckCircle2, Clock, Users, HelpCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface CourseStatsViewProps {
  stats: ClassStats;
}

export const CourseStatsView: React.FC<CourseStatsViewProps> = ({ stats }) => {
  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f97316", "#ef4444"];

  const submissionPieData = [
    { name: "Đúng hạn", value: stats.on_time_rate, color: "#10b981" },
    { name: "Trễ hạn", value: stats.late_rate, color: "#f97316" },
    { name: "Chưa nộp", value: stats.not_submitted_rate, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Tổng số sinh viên</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.total_students} sinh viên</div>
          <div className="text-[11px] text-slate-500">Đã tham gia vào lớp học</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Tỷ lệ nộp đúng hạn</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">{stats.on_time_rate}%</div>
          <div className="text-[11px] text-slate-500">
            Trễ hạn: {stats.late_rate}% • Chưa nộp: {stats.not_submitted_rate}%
          </div>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider">
            <span>Process Score Trung Bình</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{stats.average_process_score}/100</div>
          <div className="text-[11px] text-slate-400">Đánh giá tư duy qua AI Chat</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Tỷ lệ hoàn thành bài</span>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.submission_rate}%</div>
          <div className="text-[11px] text-slate-500">Trên tổng số bài tập đã giao</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Process Score Distribution Bar Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-600" />
                Phân bố Điểm Quá Trình (Process Score) Toàn Lớp
              </h3>
              <p className="text-xs text-slate-500">Thống kê số lượng sinh viên theo các dải điểm tư duy</p>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.score_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#475569" }} interval={0} angle={-10} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: "#475569" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                />
                <Bar dataKey="count" name="Số sinh viên" radius={[8, 8, 0, 0]}>
                  {stats.score_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Submission Status Pie Chart */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Tỷ lệ Nộp bài</h3>
            <p className="text-xs text-slate-500">Tiến độ nộp bài hiện tại của cả lớp</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={submissionPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {submissionPieData.map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {submissionPieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-2 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                  {d.name}
                </span>
                <strong className="text-slate-900">{d.value}%</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Process Score Assignments & AI Recommendations */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Gợi ý Cải thiện Cách Ra Đề cho Giảng viên
            </h3>
            <p className="text-xs text-slate-500">
              Danh sách bài tập có Điểm Quá Trình thấp nhất & khuyến nghị từ Gemini để kích thích tư duy tốt hơn
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {stats.low_process_score_assignments?.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{item.title}</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900">
                    Process Score TB: {item.avg_score}/100
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-1.5 pt-1">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>Gợi ý cải thiện:</strong> {item.recommendation}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
