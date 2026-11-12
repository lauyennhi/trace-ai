import { createClient, SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (!url || !key) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log(`[Supabase] Successfully initialized Supabase client with URL: ${url}`);
    } catch (err) {
      console.error("[Supabase] Error initializing client:", err);
      return null;
    }
  }

  return clientInstance;
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return Boolean(url && key);
}

export async function checkSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  url: string | null;
  error?: string;
  tableStatus?: Record<string, boolean>;
}> {
  const configured = isSupabaseConfigured();
  const url = process.env.SUPABASE_URL?.trim() || null;

  if (!configured) {
    return {
      configured: false,
      connected: false,
      url: null,
      error: "Chưa cấu hình biến môi trường SUPABASE_URL và SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      url,
      error: "Không thể khởi tạo Supabase Client. Vui lòng kiểm tra định dạng URL.",
    };
  }

  const tableStatus: Record<string, boolean> = {
    courses: false,
    assignments: false,
    submissions: false,
    chat_sessions: false,
    users: false,
    course_members: false,
  };

  let connected = false;
  let connectionError: string | undefined;

  // Check each core table
  for (const table of Object.keys(tableStatus)) {
    try {
      const { error } = await client.from(table).select("id").limit(1);
      if (!error) {
        tableStatus[table] = true;
        connected = true;
      } else {
        if (!connectionError) {
          connectionError = `Bảng '${table}': ${error.message}`;
        }
      }
    } catch (e: any) {
      if (!connectionError) {
        connectionError = e.message || "Lỗi kiểm tra kết nối";
      }
    }
  }

  return {
    configured: true,
    connected,
    url: url ? url.replace(/^(https?:\/\/[^/]+).*/, "$1") : null,
    error: connected ? undefined : connectionError || "Chưa thể kết nối tới các bảng. Bạn đã chạy SQL Schema chưa?",
    tableStatus,
  };
}

export const SUPABASE_SCHEMA_SQL = `-- ==========================================================
-- TRACE LMS Schema for Supabase PostgreSQL
-- Chạy script này trong Supabase: SQL Editor -> New query -> Paste & Run
-- ==========================================================

-- 1. Bảng Người dùng (Users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng Môn học (Courses)
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  teacher_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  teacher_name TEXT,
  semester TEXT,
  description TEXT,
  invite_code TEXT UNIQUE,
  accent_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Thành viên môn học (Course Members)
CREATE TABLE IF NOT EXISTS public.course_members (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_name TEXT,
  student_email TEXT,
  student_avatar TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Bài tập (Assignments)
CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT,
  due_date TIMESTAMPTZ,
  rubric JSONB DEFAULT '[]'::jsonb,
  ai_instructions TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bảng Bài làm & Điểm tư duy (Submissions)
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_name TEXT,
  student_email TEXT,
  status TEXT DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  content TEXT,
  process_score NUMERIC DEFAULT 0,
  process_score_result JSONB DEFAULT '{}'::jsonb,
  history_summary TEXT,
  turn_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bảng Phiên chat AI (Chat Sessions)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  messages JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active'
);

-- Indexes tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_invite_code ON public.courses(invite_code);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_lookup ON public.chat_sessions(assignment_id, student_id);

-- 7. Cột bổ sung cho đăng nhập, chấm điểm thủ công và thông báo
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pwd TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  allow_registration BOOLEAN DEFAULT TRUE,
  teacher_self_register BOOLEAN DEFAULT TRUE,
  permissions JSONB
);
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT,
  target TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS allow_late BOOLEAN DEFAULT TRUE;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.course_members ADD COLUMN IF NOT EXISTS student_avatar TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS grade NUMERIC;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS eval_status TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS eval_error TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Các policy cho phép ứng dụng đọc/ghi dữ liệu
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access users') THEN
    CREATE POLICY "Allow public access users" ON public.users FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access courses') THEN
    CREATE POLICY "Allow public access courses" ON public.courses FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access course_members') THEN
    CREATE POLICY "Allow public access course_members" ON public.course_members FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access assignments') THEN
    CREATE POLICY "Allow public access assignments" ON public.assignments FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access submissions') THEN
    CREATE POLICY "Allow public access submissions" ON public.submissions FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access chat_sessions') THEN
    CREATE POLICY "Allow public access chat_sessions" ON public.chat_sessions FOR ALL USING (true);
  END IF;
END $$;
`;

export function getSupabaseProjectRef(): string | null {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return null;
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

export async function runAutoSetupSql(options: {
  dbPassword?: string;
  connectionString?: string;
}): Promise<{ success: boolean; message: string }> {
  const { Client } = pg;
  let client: any = null;

  try {
    if (options.connectionString?.trim()) {
      client = new Client({
        connectionString: options.connectionString.trim(),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });
    } else if (options.dbPassword?.trim()) {
      const ref = getSupabaseProjectRef();
      if (!ref) {
        throw new Error("Không tìm thấy mã dự án Supabase từ URL.");
      }
      client = new Client({
        host: `db.${ref}.supabase.co`,
        port: 5432,
        user: "postgres",
        password: options.dbPassword.trim(),
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });
    } else {
      throw new Error("Vui lòng cung cấp mật khẩu Database hoặc Connection String.");
    }

    await client.connect();
    await client.query(SUPABASE_SCHEMA_SQL);
    return {
      success: true,
      message: "Khởi tạo thành công toàn bộ 6 bảng và quyền truy cập trên Supabase!",
    };
  } catch (err: any) {
    console.error("[Supabase Auto-Setup Error]", err);
    return {
      success: false,
      message: `Lỗi kết nối cơ sở dữ liệu: ${err.message || err}`,
    };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {}
    }
  }
}
