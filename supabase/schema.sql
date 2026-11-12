-- ==========================================================
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
