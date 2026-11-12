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
      error: "Chưa cấu hình biến môi trường SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.",
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

  const tableStatus: Record<string, boolean> = { documents: false };

  let connected = false;
  let connectionError: string | undefined;

  try {
    const { error } = await client.from("documents").select("id").limit(1);
    if (!error) {
      tableStatus.documents = true;
      connected = true;
    } else {
      connectionError = `Bảng 'documents': ${error.message}`;
    }
  } catch (e: any) {
    connectionError = e.message || "Lỗi kiểm tra kết nối";
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
-- TRACE: lưu dữ liệu ứng dụng trên Supabase (PostgreSQL)
-- Chạy script này trong Supabase: SQL Editor -> New query -> Paste & Run
-- Có thể chạy lại nhiều lần mà không mất dữ liệu.
-- ==========================================================

-- Mỗi bản ghi của ứng dụng (người dùng, môn học, bài nộp, ...) là một dòng JSON.
CREATE TABLE IF NOT EXISTS public.documents (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON public.documents (updated_at);

-- Tự đóng dấu thời gian cập nhật ở phía cơ sở dữ liệu (để nhiều máy chủ đồng bộ với nhau).
CREATE OR REPLACE FUNCTION public.touch_documents() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS documents_touch ON public.documents;
CREATE TRIGGER documents_touch BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_documents();

-- Bảo mật: bật RLS và KHÔNG tạo policy nào => chỉ máy chủ (service_role key) mới đọc/ghi được.
-- Khóa anon công khai sẽ KHÔNG truy cập được dữ liệu.
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
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
      message: "Khởi tạo thành công bảng lưu dữ liệu trên Supabase!",
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
