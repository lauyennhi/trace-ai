/**
 * Shared by server and frontend: "Viết L2" assignment type
 * (write with AI -> critique the AI text -> revise it).
 * Everything here is pure (no I/O) so it can be unit-checked and reused in the browser.
 */

export type L2ErrorType = "language" | "logic" | "hallucination";
export const L2_ERROR_TYPES: L2ErrorType[] = ["language", "logic", "hallucination"];
export const L2_ERROR_LABEL: Record<L2ErrorType, string> = {
  language: "Lỗi ngôn ngữ",
  logic: "Lỗi logic",
  hallucination: "Ảo giác (thông tin bịa)",
};

export interface L2Dimension {
  key: string;
  name: string;
  /** What the dimension measures and which evidence it is scored from. */
  description: string;
  /** Exactly 5 entries: levels[0] describes score 1 ... levels[4] describes score 5. */
  levels: string[];
}

export const L2_DIMENSION_KEYS = ["prompt_quality", "prompt_iteration", "error_detection", "critical_reasoning", "revision_ownership"] as const;

export const DEFAULT_L2_DIMENSIONS: L2Dimension[] = [
  {
    key: "prompt_quality",
    name: "Chất lượng prompt",
    description: "Prompt nêu rõ mục tiêu, người đọc, ngữ cảnh và ràng buộc (độ dài, giọng văn, cấu trúc). Chấm theo ý định, không trừ điểm vì ngữ pháp hay trình độ ngoại ngữ. Căn cứ: nhật ký prompt.",
    levels: [
      "Prompt mơ hồ hoặc chỉ ra lệnh chung chung (“viết giúp tôi”), không nêu mục tiêu hay người đọc.",
      "Có nêu chủ đề nhưng thiếu người đọc hoặc ràng buộc; AI phải đoán nhiều.",
      "Nêu được mục tiêu và một vài ràng buộc, còn thiếu ngữ cảnh hoặc tiêu chí thành công.",
      "Nêu rõ mục tiêu, người đọc, độ dài/giọng văn; hầu hết thông tin cần thiết đều có.",
      "Prompt đầy đủ, cụ thể và có cấu trúc: mục tiêu, người đọc, ngữ cảnh, ràng buộc, tiêu chí kiểm tra kết quả.",
    ],
  },
  {
    key: "prompt_iteration",
    name: "Cải tiến prompt",
    description: "Sinh viên dùng phản hồi của AI để tinh chỉnh prompt có chủ đích thay vì hỏi lại y nguyên hoặc chấp nhận kết quả đầu tiên. Căn cứ: chuỗi các lần sửa prompt và prompt cuối.",
    levels: [
      "Chỉ hỏi một lần hoặc lặp lại gần như nguyên văn, không dùng phản hồi của AI.",
      "Có sửa prompt nhưng thay đổi ngẫu nhiên, không rõ lý do.",
      "Có sửa theo phản hồi của AI ở một số lần; chưa nêu rõ điều cần cải thiện.",
      "Sửa có chủ đích: chỉ ra điểm chưa ổn của kết quả trước rồi thêm yêu cầu cụ thể.",
      "Cải tiến lặp có chiến lược: mỗi lần sửa đều bám vào một vấn đề cụ thể và prompt cuối tốt hơn rõ rệt.",
    ],
  },
  {
    key: "error_detection",
    name: "Phát hiện lỗi",
    description: "Bắt được các lỗi cài sẵn (ngôn ngữ, logic, ảo giác), ít bỏ sót và ít đánh dấu nhầm. Căn cứ chính: kết quả đối chiếu tự động với danh sách lỗi của giảng viên.",
    levels: [
      "Bắt được rất ít hoặc không bắt được lỗi nào; đánh dấu nhầm nhiều chỗ.",
      "Bắt được một phần nhỏ các lỗi, bỏ sót phần lớn.",
      "Bắt được khoảng một nửa số lỗi; còn bỏ sót hoặc đánh dấu nhầm đáng kể.",
      "Bắt được phần lớn lỗi, bỏ sót ít, hầu như không đánh dấu nhầm.",
      "Bắt được gần như toàn bộ lỗi, kể cả lỗi khó (ảo giác), gần như không đánh dấu nhầm.",
    ],
  },
  {
    key: "critical_reasoning",
    name: "Lập luận phản biện",
    description: "Ghi chú giải thích đúng vì sao đoạn đó sai: gọi đúng loại lỗi, nêu lý do, đề xuất cách sửa hoặc cách kiểm chứng. Căn cứ: các ghi chú của sinh viên, đối chiếu với đáp án của giảng viên.",
    levels: [
      "Không ghi chú hoặc ghi chú trống rỗng (“sai”, “lạ”).",
      "Ghi chú có nêu cảm nhận nhưng không giải thích hoặc giải thích sai.",
      "Giải thích đúng một phần; chưa gọi đúng loại lỗi hoặc chưa nêu cách sửa.",
      "Giải thích đúng lý do và gọi đúng loại lỗi ở hầu hết các lỗi bắt được.",
      "Giải thích chính xác, đề xuất cách sửa hoặc cách kiểm chứng (đặc biệt với ảo giác) cho các lỗi bắt được.",
    ],
  },
  {
    key: "revision_ownership",
    name: "Chỉnh sửa & làm chủ văn bản",
    description: "Bản sửa cuối sửa đúng các lỗi đã phát hiện, cải thiện thực chất và phù hợp người đọc; không giữ nguyên lỗi, cũng không xóa viết lại vô căn cứ. Căn cứ: so sánh bản cuối với bản AI gốc.",
    levels: [
      "Gần như giữ nguyên văn bản AI (kể cả lỗi) hoặc xóa đi viết lại hoàn toàn không dựa trên bản gốc.",
      "Sửa ít, nhiều lỗi vẫn còn; thay đổi chủ yếu là diễn đạt lại bề mặt.",
      "Sửa được một số lỗi; còn lỗi hoặc có chỗ sửa chưa đúng.",
      "Sửa đúng hầu hết lỗi đã phát hiện, văn bản mạch lạc và phù hợp người đọc.",
      "Sửa đúng và cải thiện thực chất (lập luận, bằng chứng, giọng văn), giữ được cấu trúc hợp lý của bản gốc.",
    ],
  },
];

export interface L2Error {
  id: string;
  type: L2ErrorType;
  /** The planted phrase, exactly as it appears in the AI text. */
  text: string;
  /** Teacher's answer: why it is wrong and the correct version. */
  answer: string;
  start: number;
  end: number;
}

export interface L2Highlight {
  id: string;
  start: number;
  end: number;
  text: string;
  note: string;
}

export interface L2Config {
  /** The "AI-generated" text that contains the planted errors. */
  ai_text: string;
  errors: L2Error[];
  dimensions: L2Dimension[];
  /** "en" = prompts must be in English; "bilingual" = Vietnamese or English allowed. */
  prompt_language: "en" | "bilingual";
}

export interface L2Snapshot { t: string; text: string; sim?: number }

export interface L2Work {
  step: 1 | 2 | 3;
  final_prompt?: string;
  prompt_history?: { text: string; at: string }[];
  highlights: L2Highlight[];
  revision: { text: string; snapshots: L2Snapshot[]; stats: { typed: number; deleted: number; pasted: number } };
  step_times?: Partial<Record<"s1" | "s2" | "s3", string>>;
}

export interface L2DimensionResult {
  key: string;
  score: number;
  comment: string;
  evidence: { quote: string; mau: "xanh" | "vang" | "do"; ly_do: string }[];
}

export interface L2ErrorReport {
  total: number;
  caught: { error_id: string; highlight_id: string; note: string }[];
  missed: string[];
  false_positives: string[];
  recall: number;
  precision: number;
  /** For each planted error: is the phrase still in the final text? */
  remained: string[];
  similarity_to_original: number;
  timeline: { t: string; sim: number }[];
  rewritten_from_scratch: boolean;
}

export interface L2Result {
  dimensions: L2DimensionResult[];
  overall_comment: string;
}

/* ---------------------------------------------------------------- helpers */

export const normWs = (s: string) => s.replace(/\s+/g, " ").trim();

/** Finds a phrase in text (exact first, then case-insensitive). Returns null when absent. */
export function findPhraseRange(text: string, phrase: string): { start: number; end: number } | null {
  if (!phrase) return null;
  let i = text.indexOf(phrase);
  if (i < 0) i = text.toLowerCase().indexOf(phrase.toLowerCase());
  return i < 0 ? null : { start: i, end: i + phrase.length };
}

const overlapLen = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * Deterministic comparison of the student's highlights against the teacher's planted errors.
 * A highlight "hits" an error when it covers >= 40% of the error span, or the highlight lies
 * (>= 80%) inside the error span. This is the objective evidence the AI grader is given.
 */
export function matchErrors(errors: L2Error[], highlights: L2Highlight[]) {
  const hits: { error: L2Error; highlight: L2Highlight; overlap: number }[] = [];
  for (const e of errors) {
    for (const h of highlights) {
      const o = overlapLen(e.start, e.end, h.start, h.end);
      if (o > 0 && (o >= 0.4 * (e.end - e.start) || o >= 0.8 * (h.end - h.start))) hits.push({ error: e, highlight: h, overlap: o });
    }
  }
  const caught = errors
    .map((e) => hits.filter((x) => x.error.id === e.id).sort((a, b) => b.overlap - a.overlap)[0])
    .filter(Boolean);
  const caughtIds = new Set(caught.map((c) => c.error.id));
  const hitHighlightIds = new Set(hits.map((x) => x.highlight.id));
  const missed = errors.filter((e) => !caughtIds.has(e.id));
  const falsePositives = highlights.filter((h) => !hitHighlightIds.has(h.id));
  return {
    caught,
    missed,
    false_positives: falsePositives,
    recall: errors.length ? caught.length / errors.length : 1,
    precision: highlights.length ? (highlights.length - falsePositives.length) / highlights.length : 0,
  };
}

const tokenize = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 1200);

/** Word-level similarity 0..1 (2*LCS / (n+m)). 1 = identical, ~0 = unrelated. */
export function wordSimilarity(a: string, b: string): number {
  const x = tokenize(a), y = tokenize(b);
  if (!x.length && !y.length) return 1;
  if (!x.length || !y.length) return 0;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return (2 * prev[y.length]) / (x.length + y.length);
}

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
