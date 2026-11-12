// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// src/lib/supabase-service.ts
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
var clientInstance = null;
function getSupabaseClient() {
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
          autoRefreshToken: false
        }
      });
      console.log(`[Supabase] Successfully initialized Supabase client with URL: ${url}`);
    } catch (err) {
      console.error("[Supabase] Error initializing client:", err);
      return null;
    }
  }
  return clientInstance;
}
function isSupabaseConfigured() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return Boolean(url && key);
}
async function checkSupabaseConnection() {
  const configured = isSupabaseConfigured();
  const url = process.env.SUPABASE_URL?.trim() || null;
  if (!configured) {
    return {
      configured: false,
      connected: false,
      url: null,
      error: "Ch\u01B0a c\u1EA5u h\xECnh bi\u1EBFn m\xF4i tr\u01B0\u1EDDng SUPABASE_URL v\xE0 SUPABASE_SERVICE_ROLE_KEY."
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      url,
      error: "Kh\xF4ng th\u1EC3 kh\u1EDFi t\u1EA1o Supabase Client. Vui l\xF2ng ki\u1EC3m tra \u0111\u1ECBnh d\u1EA1ng URL."
    };
  }
  const tableStatus = { documents: false };
  let connected = false;
  let connectionError;
  try {
    const { error } = await client.from("documents").select("id").limit(1);
    if (!error) {
      tableStatus.documents = true;
      connected = true;
    } else {
      connectionError = `B\u1EA3ng 'documents': ${error.message}`;
    }
  } catch (e) {
    connectionError = e.message || "L\u1ED7i ki\u1EC3m tra k\u1EBFt n\u1ED1i";
  }
  return {
    configured: true,
    connected,
    url: url ? url.replace(/^(https?:\/\/[^/]+).*/, "$1") : null,
    error: connected ? void 0 : connectionError || "Ch\u01B0a th\u1EC3 k\u1EBFt n\u1ED1i t\u1EDBi c\xE1c b\u1EA3ng. B\u1EA1n \u0111\xE3 ch\u1EA1y SQL Schema ch\u01B0a?",
    tableStatus
  };
}
var SUPABASE_SCHEMA_SQL = `-- ==========================================================
-- TRACE: l\u01B0u d\u1EEF li\u1EC7u \u1EE9ng d\u1EE5ng tr\xEAn Supabase (PostgreSQL)
-- Ch\u1EA1y script n\xE0y trong Supabase: SQL Editor -> New query -> Paste & Run
-- C\xF3 th\u1EC3 ch\u1EA1y l\u1EA1i nhi\u1EC1u l\u1EA7n m\xE0 kh\xF4ng m\u1EA5t d\u1EEF li\u1EC7u.
-- ==========================================================

-- M\u1ED7i b\u1EA3n ghi c\u1EE7a \u1EE9ng d\u1EE5ng (ng\u01B0\u1EDDi d\xF9ng, m\xF4n h\u1ECDc, b\xE0i n\u1ED9p, ...) l\xE0 m\u1ED9t d\xF2ng JSON.
CREATE TABLE IF NOT EXISTS public.documents (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON public.documents (updated_at);

-- T\u1EF1 \u0111\xF3ng d\u1EA5u th\u1EDDi gian c\u1EADp nh\u1EADt \u1EDF ph\xEDa c\u01A1 s\u1EDF d\u1EEF li\u1EC7u (\u0111\u1EC3 nhi\u1EC1u m\xE1y ch\u1EE7 \u0111\u1ED3ng b\u1ED9 v\u1EDBi nhau).
CREATE OR REPLACE FUNCTION public.touch_documents() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS documents_touch ON public.documents;
CREATE TRIGGER documents_touch BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_documents();

-- B\u1EA3o m\u1EADt: b\u1EADt RLS v\xE0 KH\xD4NG t\u1EA1o policy n\xE0o => ch\u1EC9 m\xE1y ch\u1EE7 (service_role key) m\u1EDBi \u0111\u1ECDc/ghi \u0111\u01B0\u1EE3c.
-- Kh\xF3a anon c\xF4ng khai s\u1EBD KH\xD4NG truy c\u1EADp \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u.
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
`;
function getSupabaseProjectRef() {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return null;
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}
async function runAutoSetupSql(options) {
  const { Client } = pg;
  let client = null;
  try {
    if (options.connectionString?.trim()) {
      client = new Client({
        connectionString: options.connectionString.trim(),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15e3
      });
    } else if (options.dbPassword?.trim()) {
      const ref = getSupabaseProjectRef();
      if (!ref) {
        throw new Error("Kh\xF4ng t\xECm th\u1EA5y m\xE3 d\u1EF1 \xE1n Supabase t\u1EEB URL.");
      }
      client = new Client({
        host: `db.${ref}.supabase.co`,
        port: 5432,
        user: "postgres",
        password: options.dbPassword.trim(),
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15e3
      });
    } else {
      throw new Error("Vui l\xF2ng cung c\u1EA5p m\u1EADt kh\u1EA9u Database ho\u1EB7c Connection String.");
    }
    await client.connect();
    await client.query(SUPABASE_SCHEMA_SQL);
    return {
      success: true,
      message: "Kh\u1EDFi t\u1EA1o th\xE0nh c\xF4ng b\u1EA3ng l\u01B0u d\u1EEF li\u1EC7u tr\xEAn Supabase!"
    };
  } catch (err) {
    console.error("[Supabase Auto-Setup Error]", err);
    return {
      success: false,
      message: `L\u1ED7i k\u1EBFt n\u1ED1i c\u01A1 s\u1EDF d\u1EEF li\u1EC7u: ${err.message || err}`
    };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
      }
    }
  }
}

// server.ts
var AUTH_SECRET = process.env.AUTH_SECRET || "trace-dev-secret-change-me";
if (!process.env.AUTH_SECRET) console.warn("[Auth] AUTH_SECRET is not set. Using an insecure development secret.");
var GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
var GEMINI_FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash,gemini-flash-lite-latest").split(",").map((m) => m.trim()).filter(Boolean);
async function generateWithFallback(params, timeoutMs = 3e4) {
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACKS.filter((m) => m !== GEMINI_MODEL)];
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await Promise.race([
          getGenAI().models.generateContent({ model, ...params }),
          new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(`Model ${model} kh\xF4ng ph\u1EA3n h\u1ED3i trong ${timeoutMs / 1e3}s`), { code: 503 })), timeoutMs))
        ]);
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || err);
        const code = Number(err?.status || err?.code || (msg.match(/"code":\s*(\d+)/) || [])[1]);
        if (code === 503 || code === 429 || code === 500) {
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
          continue;
        }
        if (code === 404) break;
        throw err;
      }
    }
  }
  throw lastErr;
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString("hex")}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = crypto.scryptSync(pw, salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function signToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 7 * 24 * 3600 * 1e3 })).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function readToken(token) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data.uid : null;
  } catch {
    return null;
  }
}
function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const uid2 = header.startsWith("Bearer ") ? readToken(header.slice(7)) : null;
  const user = uid2 ? db.users.find((u) => u.id === uid2) : null;
  if (!user) return res.status(401).json({ success: false, message: "Phi\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 h\u1EBFt h\u1EA1n, vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i." });
  if (user.active === false) return res.status(401).json({ success: false, message: "T\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB v\xF4 hi\u1EC7u h\xF3a." });
  if (!user.last_seen || Date.now() - new Date(user.last_seen).getTime() > 5 * 60 * 1e3) {
    user.last_seen = (/* @__PURE__ */ new Date()).toISOString();
    saveDocument("users", user.id, user);
  }
  req.user = user;
  next();
}
process.on("unhandledRejection", (reason) => {
  console.warn("[Server] Unhandled rejection ignored:", reason?.message || reason);
});
var _dirname = typeof __dirname !== "undefined" ? __dirname : process.cwd();
var firestoreDb = null;
var aiClient = null;
function getGenAI() {
  if (!aiClient) {
    const aiKey = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({
      apiKey: aiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var DEFAULT_SETTINGS = {
  allow_registration: true,
  teacher_self_register: true,
  permissions: {
    teacher: { create_course: true, manage_assignments: true, grade: true, manage_members: true },
    student: { join_course: true, use_ai_chat: true, submit: true }
  }
};
var initialDb = {
  notifications: [],
  audit_logs: [],
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  users: [
    {
      id: "u_admin_1",
      name: "Qu\u1EA3n tr\u1ECB vi\xEAn Trace",
      email: "admin@trace.edu.vn",
      role: "admin",
      avatar: ""
    },
    {
      id: "u_teacher_1",
      name: "TS. Nguy\u1EC5n V\u0103n H\xF9ng",
      email: "hung.nguyen@edu.vn",
      role: "teacher",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    },
    {
      id: "u_student_1",
      name: "L\xE3 Uy\u1EC3n Nhi",
      email: "la.uyennhi@student.edu.vn",
      role: "student",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80"
    },
    {
      id: "u_student_2",
      name: "Ph\u1EA1m Qu\u1ED1c B\u1EA3o",
      email: "quocbao.pham@student.edu.vn",
      role: "student",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80"
    }
  ],
  courses: [
    {
      id: "c_1",
      name: "L\u1EADp Tr\xECnh & T\u01B0 Duy AI",
      code: "CS101",
      teacher_id: "u_teacher_1",
      teacher_name: "TS. Nguy\u1EC5n V\u0103n H\xF9ng",
      semester: "H\u1ECDc k\u1EF3 I (2025-2026)",
      description: "H\u1ECDc c\xE1ch \u0111\u1EB7t c\xE2u h\u1ECFi, ph\xE2n t\xEDch gi\u1EA3i thu\u1EADt v\xE0 ph\u1EA3n bi\u1EC7n c\xF9ng Tr\u1EE3 l\xFD AI \u0111\u1EC3 l\xE0m ch\u1EE7 tri th\u1EE9c.",
      invite_code: "AI2025",
      accent_color: "from-indigo-500 to-violet-600",
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1e3).toISOString()
    },
    {
      id: "c_2",
      name: "\u0110\u1EA1o \u0110\u1EE9c AI & X\xE3 H\u1ED9i",
      code: "ETH201",
      teacher_id: "u_teacher_1",
      teacher_name: "TS. Nguy\u1EC5n V\u0103n H\xF9ng",
      semester: "H\u1ECDc k\u1EF3 I (2025-2026)",
      description: "\u0110\xE1nh gi\xE1 t\xE1c \u0111\u1ED9ng c\u1EE7a AI trong \u0111\u1EDDi s\u1ED1ng, hi\u1EC7n t\u01B0\u1EE3ng thi\xEAn v\u1ECB d\u1EEF li\u1EC7u v\xE0 x\xE2y d\u1EF1ng gi\u1EA3i ph\xE1p tr\xE1ch nhi\u1EC7m.",
      invite_code: "ETH999",
      accent_color: "from-sky-500 to-blue-600",
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1e3).toISOString()
    },
    {
      id: "c_3",
      name: "L\u1EADp Tr\xECnh Web Modern",
      code: "WEB301",
      teacher_id: "u_teacher_1",
      teacher_name: "TS. Nguy\u1EC5n V\u0103n H\xF9ng",
      semester: "H\u1ECDc k\u1EF3 I (2025-2026)",
      description: "X\xE2y d\u1EF1ng \u1EE9ng d\u1EE5ng Web Full-stack v\u1EDBi React, Express, REST API v\xE0 t\xEDch h\u1EE3p m\xF4 h\xECnh ng\xF4n ng\u1EEF l\u1EDBn.",
      invite_code: "WEB2025",
      accent_color: "from-emerald-500 to-teal-600",
      created_at: new Date(Date.now() - 15 * 24 * 3600 * 1e3).toISOString()
    }
  ],
  course_members: [
    { course_id: "c_1", student_id: "u_student_1", student_name: "L\xE3 Uy\u1EC3n Nhi", student_email: "la.uyennhi@student.edu.vn", joined_at: (/* @__PURE__ */ new Date()).toISOString() },
    { course_id: "c_1", student_id: "u_student_2", student_name: "Ph\u1EA1m Qu\u1ED1c B\u1EA3o", student_email: "quocbao.pham@student.edu.vn", joined_at: (/* @__PURE__ */ new Date()).toISOString() },
    { course_id: "c_2", student_id: "u_student_1", student_name: "L\xE3 Uy\u1EC3n Nhi", student_email: "la.uyennhi@student.edu.vn", joined_at: (/* @__PURE__ */ new Date()).toISOString() },
    { course_id: "c_3", student_id: "u_student_1", student_name: "L\xE3 Uy\u1EC3n Nhi", student_email: "la.uyennhi@student.edu.vn", joined_at: (/* @__PURE__ */ new Date()).toISOString() }
  ],
  assignments: [
    {
      id: "a_1",
      course_id: "c_1",
      title: "B\xE0i t\u1EADp 1: Ph\xE2n T\xEDch \u0110\u1EA1o \u0110\u1EE9c AI trong L\u1ECDc CV Tuy\u1EC3n D\u1EE5ng",
      description: `Y\xEAu c\u1EA7u \u0111\u01A1n gi\u1EA3n & tr\u1ECDng t\xE2m:
1. Ph\xE2n t\xEDch nguy\xEAn nh\xE2n khi\u1EBFn thu\u1EADt to\xE1n AI l\u1ECDc h\u1ED3 s\u01A1 b\u1ECB thi\xEAn v\u1ECB gi\u1EDBi t\xEDnh.
2. Trao \u0111\u1ED5i v\u1EDBi Tr\u1EE3 l\xFD AI \u1EDF Ch\u1EBF \u0111\u1ED9 Socratic \u0111\u1EC3 tranh lu\u1EADn hai ch\u1EC9 s\u1ED1: Demographic Parity vs Equalized Odds.
3. R\xFAt ra k\u1EBFt lu\u1EADn v\xE0 t\u1EF1 t\u1ED5ng h\u1EE3p g\xF3c nh\xECn c\u1EE7a c\xE1 nh\xE2n.`,
      rubric: `- T\u01B0 duy ph\u1EA3n bi\u1EC7n (30%): Th\xE1ch th\u1EE9c gi\u1EA3 \u0111\u1ECBnh c\u1EE7a m\xF4 h\xECnh AI
- \u0110\xE0o s\xE2u v\u1EA5n \u0111\u1EC1 (25%): \u0110\u1EB7t c\xE2u h\u1ECFi truy xu\u1EA5t c\u0103n nguy\xEAn
- Ki\u1EC3m ch\u1EE9ng th\xF4ng tin (20%): \u0110\u1ED1i chi\u1EBFu kh\xE1i ni\u1EC7m h\u1ECDc thu\u1EADt
- T\u1EF1 di\u1EC5n gi\u1EA3i (15%): Tr\xECnh b\xE0y b\u1EB1ng ng\xF4n t\u1EEB c\xE1 nh\xE2n
- T\xEDnh ch\u1EE7 \u0111\u1ED9ng (10%): M\u1EDF r\u1ED9ng c\xE2u h\u1ECFi nghi\xEAn c\u1EE9u`,
      due_date: new Date(Date.now() + 3 * 24 * 3600 * 1e3).toISOString(),
      attachments: [
        { id: "f1", name: "De_bai_Dao_duc_AI_2025.pdf", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", size: "1.2 MB", type: "pdf" }
      ],
      submission_mode: "both",
      ai_submode: "socratic",
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString()
    },
    {
      id: "a_2",
      course_id: "c_1",
      title: "B\xE0i t\u1EADp 2: T\u1ED1i \u01AFu H\xE0m M\u1EA5t M\xE1t (Loss Function) trong M\u1EA1ng N\u01A1-ron",
      description: "So s\xE1nh Cross-Entropy Loss v\xE0 MSE cho b\xE0i to\xE1n Ph\xE2n lo\u1EA1i. Gi\u1EA3i th\xEDch hi\u1EC7n t\u01B0\u1EE3ng Tri\u1EC7t ti\xEAu \u0110\u1EA1o h\xE0m (Vanishing Gradient).",
      rubric: "Hi\u1EC3u b\u1EA3n ch\u1EA5t to\xE1n h\u1ECDc 50%, Gi\u1EA3i th\xEDch r\xF5 r\xE0ng 50%",
      due_date: new Date(Date.now() + 7 * 24 * 3600 * 1e3).toISOString(),
      attachments: [],
      submission_mode: "ai_chat_only",
      ai_submode: "socratic",
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1e3).toISOString()
    },
    {
      id: "a_3",
      course_id: "c_2",
      title: "\u0110\u1ED3 \xE1n Gi\u1EEFa k\u1EF3: Thi\u1EBFt K\u1EBF B\u1ED9 Ti\xEAu Ch\xED \u0110\xE1nh Gi\xE1 AI Tr\xE1ch Nhi\u1EC7m",
      description: "X\xE2y d\u1EF1ng khung ti\xEAu ch\xED 5 b\u01B0\u1EDBc \u0111\xE1nh gi\xE1 s\u1EA3n ph\u1EA9m AI trong gi\xE1o d\u1EE5c.",
      rubric: "T\xEDnh \u1EE9ng d\u1EE5ng 40%, Kh\u1EA3 thi 30%, B\xE1o c\xE1o 30%",
      due_date: new Date(Date.now() - 1 * 24 * 3600 * 1e3).toISOString(),
      attachments: [],
      submission_mode: "file_only",
      ai_submode: "normal",
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1e3).toISOString()
    }
  ],
  submissions: [
    {
      id: "sub_1",
      assignment_id: "a_1",
      student_id: "u_student_1",
      student_name: "L\xE3 Uy\u1EC3n Nhi",
      student_email: "la.uyennhi@student.edu.vn",
      student_avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      submitted_at: new Date(Date.now() - 1 * 24 * 3600 * 1e3).toISOString(),
      submitted_files: [
        { id: "f2", name: "Bai_Nop_UyenNhi_DaoDucAI.pdf", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", size: "850 KB", type: "pdf" }
      ],
      submitted_text: "Em ch\u1EC9 ra nguy\xEAn nh\xE2n thi\xEAn v\u1ECB l\xE0 do t\u1EADp d\u1EEF li\u1EC7u hu\u1EA5n luy\u1EC7n l\u1ECBch s\u1EED 10 n\u0103m tr\u01B0\u1EDBc c\xF3 t\u1EF7 l\u1EC7 nam gi\u1EDBi v\u01B0\u1EE3t tr\u1ED9i. \u0110\u1EC3 x\u1EED l\xFD, em ch\u1ECDn Equalized Odds v\xEC n\xF3 \u0111\u1EA3m b\u1EA3o t\u1EF7 l\u1EC7 D\u01B0\u01A1ng t\xEDnh Gi\u1EA3 (FPR) c\xF4ng b\u1EB1ng gi\u1EEFa c\xE1c nh\xF3m.",
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
        nhan_xet_ngan: "Sinh vi\xEAn th\u1EC3 hi\u1EC7n t\u01B0 duy ph\u1EA3n bi\u1EC7n xu\u1EA5t s\u1EAFc, kh\xF4ng ch\xE9p \u0111\xE1p \xE1n c\xF3 s\u1EB5n m\xE0 ch\u1EE7 \u0111\u1ED9ng \u0111\u1EB7t c\xE2u h\u1ECFi so s\xE1nh gi\u1EEFa Demographic Parity v\xE0 Equalized Odds.",
        highlight_segments: [
          {
            doan_van_ban: "T\u1EA1i sao Demographic Parity l\u1EA1i c\xF3 th\u1EC3 g\xE2y thi\u1EC7t th\xF2i cho \u1EE9ng vi\xEAn xu\u1EA5t s\u1EAFc n\u1EBFu t\u1EF7 l\u1EC7 n\u1EC1n kh\xF4ng \u0111\u1ED3ng \u0111\u1EC1u?",
            mau: "xanh",
            ly_do: "C\xE2u h\u1ECFi ph\u1EA3n bi\u1EC7n s\u1EAFc b\xE9n, xo\xE1y s\xE2u v\xE0o to\xE1n h\u1ECDc c\u1EE7a ch\u1EC9 s\u1ED1 c\xF4ng b\u1EB1ng."
          },
          {
            doan_van_ban: "Cho m\xECnh xin c\xF4ng th\u1EE9c t\xF3m t\u1EAFt \u0111\u1EC3 \xE1p d\u1EE5ng lu\xF4n \u0111\u01B0\u1EE3c kh\xF4ng?",
            mau: "vang",
            ly_do: "Mu\u1ED1n l\u1EA5y c\xF4ng th\u1EE9c nhanh nh\u01B0ng ngay sau \u0111\xF3 \u0111\xE3 t\u1EF1 suy lu\u1EADn \xE1p d\u1EE5ng."
          }
        ]
      }
    },
    {
      id: "sub_2",
      assignment_id: "a_2",
      student_id: "u_student_1",
      student_name: "L\xE3 Uy\u1EC3n Nhi",
      student_email: "la.uyennhi@student.edu.vn",
      student_avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      submitted_at: new Date(Date.now() - 2 * 3600 * 1e3).toISOString(),
      submitted_files: [],
      submitted_text: `| Ti\xEAu ch\xED | Mean Squared Error (MSE) | Cross-Entropy Loss |
|---|---|---|
| **M\u1EE5c \u0111\xEDch s\u1EED d\u1EE5ng ch\xEDnh** | D\xE0nh cho b\xE0i to\xE1n **H\u1ED3i quy** (Regression - d\u1EF1 \u0111o\xE1n s\u1ED1 th\u1EF1c li\xEAn t\u1EE5c nh\u01B0 gi\xE1 nh\xE0, nhi\u1EC7t \u0111\u1ED9). | D\xE0nh cho b\xE0i to\xE1n **Ph\xE2n lo\u1EA1i** (Classification - d\u1EF1 \u0111o\xE1n x\xE1c su\u1EA5t thu\u1ED9c v\u1EC1 l\u1EDBp n\xE0o). |
| **D\u1EA1ng b\u1EC1 m\u1EB7t t\u1ED1i \u01B0u (Loss Landscape)** | Khi k\u1EBFt h\u1EE3p v\u1EDBi h\xE0m Sigmoid/Softmax, h\xE0m MSE t\u1EA1o ra b\u1EC1 m\u1EB7t **Phi l\u1ED3i (Non-convex)** $\\rightarrow$ C\xF3 nhi\u1EC1u c\u1EF1c tr\u1ECB \u0111\u1ECBa ph\u01B0\u01A1ng (Local Minima), khi\u1EBFn thu\u1EADt to\xE1n d\u1EC5 b\u1ECB "k\u1EB9t", kh\xF3 t\xECm ra \u0111\xE1p \xE1n t\u1ED1t nh\u1EA5t. | T\u1EA1o ra b\u1EC1 m\u1EB7t **L\u1ED3i (Convex)** khi k\u1EBFt h\u1EE3p v\u1EDBi Sigmoid/Softmax $\\rightarrow$ C\xF3 duy nh\u1EA5t m\u1ED9t \u0111i\u1EC3m c\u1EF1c ti\u1EC3u to\xE0n c\u1EE5c (Global Minimum), gi\xFAp thu\u1EADt to\xE1n Gradient Descent d\u1EC5 d\xE0ng h\u1ED9i t\u1EE5. |
| **T\u1ED1c \u0111\u1ED9 h\u1ECDc khi \u0111o\xE1n SAI n\u1EB7ng** | **R\u1EA5t ch\u1EADm**: Do \u0111\u1EA1o h\xE0m c\u1EE7a Sigmoid b\u1ECB tri\u1EC7t ti\xEAu \u1EDF c\xE1c v\xF9ng bi\xEAn, l\xE0m Gradient ti\u1EBFn v\u1EC1 0 khi\u1EBFn m\xF4 h\xECnh g\u1EA7n nh\u01B0 "ng\u1EEBng h\u1ECDc". | **R\u1EA5t nhanh**: \u0110\u1EA1o h\xE0m c\u1EE7a Cross-Entropy t\u1EC9 l\u1EC7 thu\u1EADn tr\u1EF1c ti\u1EBFp v\u1EDBi \u0111\u1ED9 sai l\u1EC7ch $(p - y)$. M\xF4 h\xECnh \u0111o\xE1n c\xE0ng sai th\xEC b\u1ECB "ph\u1EA1t" c\xE0ng n\u1EB7ng v\xE0 h\u1ECDc c\xE0ng nhanh. |

---

## 2. Gi\u1EA3i th\xEDch hi\u1EC7n t\u01B0\u1EE3ng Tri\u1EC7t ti\xEAu \u0110\u1EA1o h\xE0m (Vanishing Gradient)

### a. Kh\xE1i ni\u1EC7m:
Hi\u1EC7n t\u01B0\u1EE3ng c\xE1c t\u1EA7ng s\xE2u trong m\u1EA1ng n\u01A1-ron h\u1ECDc r\u1EA5t ch\u1EADm ho\u1EB7c ng\u1EEBng c\u1EADp nh\u1EADt tr\u1ECDng s\u1ED1 do \u0111\u1EA1o h\xE0m lan truy\u1EC1n ng\u01B0\u1EE3c b\u1ECB suy gi\u1EA3m d\u1EA7n v\u1EC1 0.

### b. Nguy\xEAn nh\xE2n (G\u1EAFn v\u1EDBi h\xE0m k\xEDch ho\u1EA1t Sigmoid):
1. **\u0110\u1EB7c \u0111i\u1EC3m h\xE0m Sigmoid**: C\xF4ng th\u1EE9c $\\sigma(z) = \\frac{1}{1 + e^{-z}}$. \u0110\u1ED3 th\u1ECB h\xE0m Sigmoid c\xF3 d\u1EA1ng \u0111\u01B0\u1EDDng cong ch\u1EEF S, b\u1ECB n\xE9n trong kho\u1EA3ng $(0, 1)$.
2. **\u0110\u1EA1o h\xE0m c\u1EE7a Sigmoid**: $\\sigma'(z) = \\sigma(z)(1 - \\sigma(z))$.
   * Gi\xE1 tr\u1ECB l\u1EDBn nh\u1EA5t c\u1EE7a \u0111\u1EA1o h\xE0m n\xE0y ch\u1EC9 l\xE0 **0.25** (khi $z = 0$).
   * Khi $|z|$ r\u1EA5t l\u1EDBn (v\xF9ng m\xF4 h\xECnh r\u1EA5t t\u1EF1 tin ho\u1EB7c \u0111o\xE1n sai nghi\xEAm tr\u1ECDng), \u0111\u1ED3 th\u1ECB n\u1EB1m ngang v\xE0 \u0111\u1EA1o h\xE0m $\\sigma'(z)$ **s\u1EBD b\u1EB1ng 0**.
3. **Quy t\u1EAFc chu\u1ED7i (Chain Rule)**: Khi lan truy\u1EC1n ng\u01B0\u1EE3c qua $L$ t\u1EA7ng \u1EA9n, Gradient t\u1EA1i t\u1EA7ng \u0111\u1EA7u ti\xEAn b\u1ECB nh\xE2n li\xEAn ti\u1EBFp b\u1EDFi $L$ s\u1ED1 nh\u1ECF h\u01A1n ho\u1EB7c b\u1EB1ng 0.25:
$$\\frac{\\partial L}{\\partial w_1} = \\frac{\\partial L}{\\partial a_L} \\cdot \\prod_{i=1}^{L} \\sigma'(z_i) W_i$$
K\u1EBFt qu\u1EA3 l\xE0 Gradient tri\u1EC7t ti\xEAu g\u1EA7n nh\u01B0 b\u1EB1ng 0, khi\u1EBFn m\u1EA1ng kh\xF4ng th\u1EC3 h\u1ECDc \u0111\u01B0\u1EE3c c\xE1c \u0111\u1EB7c tr\u01B0ng tr\u1EEBu t\u01B0\u1EE3ng \u1EDF c\xE1c t\u1EA7ng \u0111\u1EA7u.`,
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
        nhan_xet_ngan: "Sinh vi\xEAn n\u1EAFm v\u1EEFng b\u1EA3n ch\u1EA5t to\xE1n h\u1ECDc c\u1EE7a c\xE1c h\xE0m m\u1EA5t m\xE1t v\xE0 hi\u1EC7n t\u01B0\u1EE3ng suy gi\u1EA3m \u0111\u1EA1o h\xE0m. T\u1EF1 x\xE2y d\u1EF1ng b\u1EA3ng so s\xE1nh tr\u1EF1c quan v\xE0 ph\xE2n t\xEDch c\xF4ng th\u1EE9c chu\u1ED7i lan truy\u1EC1n ng\u01B0\u1EE3c r\u1EA5t thuy\u1EBFt ph\u1EE5c.",
        highlight_segments: [
          {
            doan_van_ban: "T\u1EA1i sao khi k\u1EBFt h\u1EE3p v\u1EDBi Sigmoid, h\xE0m MSE l\u1EA1i t\u1EA1o ra b\u1EC1 m\u1EB7t phi l\u1ED3i (Non-convex) trong khi Cross-Entropy l\u1EA1i l\u1ED3i?",
            mau: "xanh",
            ly_do: "C\xE2u h\u1ECFi \u0111\xE0o s\xE2u v\xE0o b\u1EA3n ch\u1EA5t h\xECnh h\u1ECDc t\u1ED1i \u01B0u h\xF3a c\u1EE7a Loss Landscape."
          },
          {
            doan_van_ban: "s\u1EBD b\u1EB1ng 0",
            mau: "vang",
            ly_do: "T\xF2 m\xF2 / Y\xEAu c\u1EA7u gi\u1EA3i \u0111\xE1p v\u1EC1 \u0111\u1EA1o h\xE0m t\u1EA1i v\xF9ng bi\xEAn b\xE3o h\xF2a c\u1EE7a Sigmoid."
          },
          {
            doan_van_ban: "tr\u1EA3 l\u1EDDi cho t\xF4i n\u1ED9p b\xE0i",
            mau: "do",
            ly_do: "Nguy c\u01A1 d\xF9ng AI l\xE0m h\u1ED9 / ch\xE9p nguy\xEAn v\u0103n n\u1EBFu y\xEAu c\u1EA7u AI gi\u1EA3i to\xE0n b\u1ED9 m\xE0 kh\xF4ng t\u1EF1 t\u01B0 duy."
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
          content: "Ch\xE0o b\u1EA1n, m\xECnh \u0111ang ph\xE2n t\xEDch case AI tuy\u1EC3n d\u1EE5ng. T\u1EA1i sao m\xF4 h\xECnh l\u1ECDc CV l\u1EA1i t\u1EF1 \u0111\u1ED9ng b\u1ECB thi\xEAn v\u1ECB gi\u1EDBi t\xEDnh?",
          timestamp: new Date(Date.now() - 1e6).toISOString()
        },
        {
          id: "m2",
          role: "model",
          content: "Ch\xE0o Uy\u1EC3n Nhi! \u0110\xE2y l\xE0 b\xE0i to\xE1n Data Bias \u0111i\u1EC3n h\xECnh. Theo b\u1EA1n, n\u1EBFu t\u1EADp d\u1EEF li\u1EC7u hu\u1EA5n luy\u1EC7n trong 10 n\u0103m tr\u01B0\u1EDBc h\u1EA7u h\u1EBFt l\xE0 h\u1ED3 s\u01A1 nam gi\u1EDBi, AI s\u1EBD h\u1ECDc \u0111\u01B0\u1EE3c quy lu\u1EADt g\xEC?",
          timestamp: new Date(Date.now() - 98e4).toISOString()
        },
        {
          id: "m3",
          role: "user",
          content: "N\xF3 s\u1EBD hi\u1EC3u nh\u1EA7m r\u1EB1ng nam gi\u1EDBi c\xF3 t\u1EF7 l\u1EC7 th\xE0nh c\xF4ng cao h\u01A1n! Nh\u01B0ng t\u1EA1i sao Demographic Parity l\u1EA1i c\xF3 th\u1EC3 g\xE2y thi\u1EC7t th\xF2i cho \u1EE9ng vi\xEAn xu\u1EA5t s\u1EAFc n\u1EBFu t\u1EF7 l\u1EC7 n\u1EC1n kh\xF4ng \u0111\u1ED3ng \u0111\u1EC1u?",
          timestamp: new Date(Date.now() - 95e4).toISOString()
        },
        {
          id: "m4",
          role: "model",
          content: "Ph\u1EA3n bi\u1EC7n r\u1EA5t ch\xEDnh x\xE1c! Demographic Parity bu\u1ED9c t\u1EF7 l\u1EC7 tr\xFAng tuy\u1EC3n ngang nhau b\u1EA5t k\u1EC3 n\u0103ng l\u1EF1c n\u1EC1n. V\xEC v\u1EADy ch\u1EC9 s\u1ED1 Equalized Odds \u0111\u01B0\u1EE3c \u01B0u ti\xEAn h\u01A1n. B\u1EA1n suy ngh\u0129 th\u1EBF n\xE0o v\u1EC1 h\u01B0\u1EDBng gi\u1EA3i quy\u1EBFt n\xE0y?",
          timestamp: new Date(Date.now() - 9e5).toISOString()
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
          content: "Ch\xE0o Tr\u1EE3 l\xFD, m\xECnh \u0111ang l\xE0m b\xE0i t\u1EADp 2 v\u1EC1 so s\xE1nh MSE v\xE0 Cross-Entropy. T\u1EA1i sao b\xE0i to\xE1n ph\xE2n lo\u1EA1i l\u1EA1i kh\xF4ng d\xF9ng MSE?",
          timestamp: new Date(Date.now() - 36e5).toISOString()
        },
        {
          id: "m2_2",
          role: "model",
          content: "Ch\xE0o b\u1EA1n! \u0110\u1EC3 tr\u1EA3 l\u1EDDi c\xE2u h\u1ECFi n\xE0y, h\xE3y th\u1EED xem x\xE9t \u0111i\u1EC1u g\xEC x\u1EA3y ra v\u1EDBi h\xE0m m\u1EA5t m\xE1t MSE khi k\u1EBFt h\u1EE3p v\u1EDBi h\xE0m k\xEDch ho\u1EA1t Sigmoid $\\sigma(z) = \\frac{1}{1 + e^{-z}}$ l\xFAc m\xF4 h\xECnh d\u1EF1 \u0111o\xE1n ho\xE0n to\xE0n sai (v\xED d\u1EE5 nh\xE3n $y=1$ nh\u01B0ng d\u1EF1 \u0111o\xE1n $p=0$). \u0110\u1EA1o h\xE0m l\xFAc \u0111\xF3 s\u1EBD nh\u01B0 th\u1EBF n\xE0o?",
          timestamp: new Date(Date.now() - 35e5).toISOString()
        },
        {
          id: "m2_3",
          role: "user",
          content: "\u0110\u1EA1o h\xE0m c\u1EE7a Sigmoid l\xE0 $\\sigma'(z) = \\sigma(z)(1 - \\sigma(z))$. Khi d\u1EF1 \u0111o\xE1n sai n\u1EB7ng ($z \\rightarrow -\\infty$), $\\sigma(z) \\rightarrow 0$, n\xEAn \u0111\u1EA1o h\xE0m $\\sigma'(z)$ s\u1EBD b\u1EB1ng 0! Gradient bi\u1EBFn m\u1EA5t khi\u1EBFn m\xF4 h\xECnh kh\xF4ng h\u1ECDc \u0111\u01B0\u1EE3c!",
          timestamp: new Date(Date.now() - 34e5).toISOString()
        },
        {
          id: "m2_4",
          role: "model",
          content: "Tuy\u1EC7t v\u1EDDi! Hi\u1EC7n t\u01B0\u1EE3ng \u0111\xF3 li\xEAn quan m\u1EADt thi\u1EBFt \u0111\u1EBFn Vanishing Gradient. C\xF2n v\u1EDBi Cross-Entropy Loss $L = -y \\ln(p) - (1-y)\\ln(1-p)$, \u0111\u1EA1o h\xE0m theo $z$ s\u1EBD r\xFAt g\u1ECDn th\xE0nh g\xEC?",
          timestamp: new Date(Date.now() - 33e5).toISOString()
        },
        {
          id: "m2_5",
          role: "user",
          content: "\u0110\u1EA1o h\xE0m r\xFAt g\u1ECDn th\xE0nh $\\frac{\\partial L}{\\partial z} = p - y$. Khi \u0111o\xE1n c\xE0ng sai, \u0111\u1ED9 ch\xEAnh l\u1EC7ch $(p - y)$ c\xE0ng l\u1EDBn, Gradient c\xE0ng m\u1EA1nh gi\xFAp c\u1EADp nh\u1EADt tr\u1ECDng s\u1ED1 nhanh ch\xF3ng!",
          timestamp: new Date(Date.now() - 32e5).toISOString()
        }
      ]
    }
  ]
};
for (const u of initialDb.users) u.pwd = hashPassword("123456");
var db = JSON.parse(JSON.stringify(initialDb));
function ensureSeedCredentials() {
  for (const seed of initialDb.users) {
    const u = db.users.find((x) => x.id === seed.id);
    if (u && !u.pwd) u.pwd = seed.pwd;
    if (!u && seed.role === "admin") db.users.push(JSON.parse(JSON.stringify(seed)));
  }
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings || {}, permissions: { ...DEFAULT_SETTINGS.permissions, ...(db.settings || {}).permissions || {} } };
}
async function initFirestore() {
  try {
    const configPath = path.join(_dirname, "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (!getApps().length) {
        initializeApp({
          projectId: firebaseConfig.projectId
        });
      }
      const dbId = firebaseConfig.firestoreDatabaseId || void 0;
      const testDb = getFirestore(dbId);
      try {
        await Promise.race([
          testDb.collection("users").limit(1).get(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("Firestore check timed out")), 6e3))
        ]);
        firestoreDb = testDb;
        console.log(`[Firestore] Connected successfully with database: ${dbId || "default"}`);
        await loadFromFirestore();
      } catch (checkErr) {
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
    const usersSnap = await firestoreDb.collection("users").get();
    if (!usersSnap.empty) {
      db.users = usersSnap.docs.map((doc) => doc.data());
    } else {
      for (const u of initialDb.users) {
        await firestoreDb.collection("users").doc(u.id).set(u);
      }
    }
    const coursesSnap = await firestoreDb.collection("courses").get();
    if (!coursesSnap.empty) {
      db.courses = coursesSnap.docs.map((doc) => doc.data());
    } else {
      for (const c of initialDb.courses) {
        await firestoreDb.collection("courses").doc(c.id).set(c);
      }
    }
    const membersSnap = await firestoreDb.collection("course_members").get();
    if (!membersSnap.empty) {
      db.course_members = membersSnap.docs.map((doc) => doc.data());
    } else {
      for (const m of initialDb.course_members) {
        const id = `${m.course_id}_${m.student_id}`;
        await firestoreDb.collection("course_members").doc(id).set(m);
      }
    }
    const assignmentsSnap = await firestoreDb.collection("assignments").get();
    if (!assignmentsSnap.empty) {
      db.assignments = assignmentsSnap.docs.map((doc) => doc.data());
    } else {
      for (const a of initialDb.assignments) {
        await firestoreDb.collection("assignments").doc(a.id).set(a);
      }
    }
    const subsSnap = await firestoreDb.collection("submissions").get();
    if (!subsSnap.empty) {
      db.submissions = subsSnap.docs.map((doc) => doc.data());
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
    const chatSnap = await firestoreDb.collection("chat_sessions").get();
    if (!chatSnap.empty) {
      db.chat_sessions = chatSnap.docs.map((doc) => doc.data());
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
    db.notifications = notifSnap.docs.map((doc) => doc.data());
    const settingsDoc = await firestoreDb.collection("settings").doc("global").get();
    if (settingsDoc.exists) db.settings = settingsDoc.data();
    const auditSnap = await firestoreDb.collection("audit_logs").orderBy("created_at", "desc").limit(300).get();
    db.audit_logs = auditSnap.docs.map((doc) => doc.data());
    ensureSeedCredentials();
    console.log("[Firestore] Collections synchronized and loaded into memory.");
  } catch (err) {
    firestoreDb = null;
    console.log("[Firestore] Firestore load skipped:", err.message || err);
  }
}
var reqStore = new AsyncLocalStorage();
var track = (p) => {
  reqStore.getStore()?.pending.push(p.catch(() => {
  }));
  return p;
};
var DOC_COLLECTIONS = ["users", "courses", "course_members", "assignments", "submissions", "chat_sessions", "notifications", "audit_logs"];
var docKey = (collection, d) => collection === "course_members" ? `${d.course_id}_${d.student_id}` : d.id;
async function saveDocumentInner(collectionName, docId, data) {
  const snapshot = JSON.parse(JSON.stringify(data));
  const supabase = getSupabaseClient();
  const writes = [];
  if (supabase) {
    writes.push((async () => {
      try {
        const { error } = await supabase.from("documents").upsert({ collection: collectionName, id: docId, data: snapshot, deleted: false }, { onConflict: "collection,id" });
        if (error) console.warn(`[Supabase] Save ${collectionName}/${docId} failed:`, error.message);
      } catch (err) {
        console.error(`[Supabase] Error saving ${collectionName}/${docId}:`, err?.message || err);
      }
    })());
  }
  if (firestoreDb) {
    writes.push((async () => {
      try {
        await firestoreDb.collection(collectionName).doc(docId).set(snapshot, { merge: true });
      } catch (err) {
        const msg = err.message || "";
        if (msg.includes("PERMISSION_DENIED") || msg.includes("has not been used") || msg.includes("7")) firestoreDb = null;
        console.warn(`[Firestore] Unable to save to ${collectionName}/${docId}:`, msg);
      }
    })());
  }
  await Promise.all(writes);
}
var saveDocument = (collectionName, docId, data) => track(saveDocumentInner(collectionName, docId, data));
async function deleteDocumentInner(collectionName, docId) {
  const supabase = getSupabaseClient();
  const writes = [];
  if (supabase) {
    writes.push((async () => {
      try {
        const { error } = await supabase.from("documents").upsert({ collection: collectionName, id: docId, data: {}, deleted: true }, { onConflict: "collection,id" });
        if (error) console.warn(`[Supabase] Delete ${collectionName}/${docId} failed:`, error.message);
      } catch (err) {
        console.error(`[Supabase] Error deleting ${collectionName}/${docId}:`, err?.message || err);
      }
    })());
  }
  if (firestoreDb) {
    writes.push((async () => {
      try {
        await firestoreDb.collection(collectionName).doc(docId).delete();
      } catch (err) {
        const msg = err.message || "";
        if (msg.includes("PERMISSION_DENIED") || msg.includes("has not been used") || msg.includes("7")) firestoreDb = null;
        console.warn(`[Firestore] Unable to delete from ${collectionName}/${docId}:`, msg);
      }
    })());
  }
  await Promise.all(writes);
}
var deleteDocument = (collectionName, docId) => track(deleteDocumentInner(collectionName, docId));
var syncCursor = 0;
var lastRefresh = 0;
var initialLoad = null;
var supabaseLoaded = false;
var refreshing = null;
function emptyDb() {
  return { users: [], courses: [], course_members: [], assignments: [], submissions: [], chat_sessions: [], notifications: [], audit_logs: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) };
}
function applyRow(row) {
  if (row.collection === "settings") {
    if (!row.deleted) db.settings = row.data;
    return;
  }
  const arr = db[row.collection];
  if (!arr) return;
  const idx = arr.findIndex((x) => docKey(row.collection, x) === row.id);
  if (row.deleted) {
    if (idx >= 0) arr.splice(idx, 1);
    return;
  }
  const incoming = row.data || {};
  if (idx >= 0) {
    const cur = arr[idx];
    if (row.collection === "users" && cur.last_seen && (!incoming.last_seen || cur.last_seen > incoming.last_seen)) incoming.last_seen = cur.last_seen;
    for (const k of Object.keys(cur)) delete cur[k];
    Object.assign(cur, incoming);
  } else {
    arr.push(incoming);
  }
}
async function pullFromSupabase(full = false) {
  const sb = getSupabaseClient();
  if (!sb) return;
  const since = full || !syncCursor ? null : new Date(syncCursor - 3e3).toISOString();
  const page = 1e3;
  let from = 0;
  let maxTs = syncCursor;
  for (; ; ) {
    let q = sb.from("documents").select("collection,id,data,deleted,updated_at").order("updated_at", { ascending: true }).order("collection").order("id").range(from, from + page - 1);
    if (since) q = q.gte("updated_at", since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const r of data || []) {
      applyRow(r);
      const t = Date.parse(r.updated_at);
      if (t > maxTs) maxTs = t;
    }
    if (!data || data.length < page) break;
    from += page;
  }
  syncCursor = maxTs;
}
async function pushAllToSupabase() {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Ch\u01B0a c\u1EA5u h\xECnh Supabase.");
  const rows = [];
  const counts = {};
  for (const c of DOC_COLLECTIONS) {
    const list = db[c] || [];
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
  const seed = JSON.parse(JSON.stringify(initialDb));
  const admin = seed.users.find((u) => u.role === "admin");
  if (process.env.ADMIN_PASSWORD) admin.pwd = hashPassword(process.env.ADMIN_PASSWORD);
  db.users = demo ? seed.users : [admin];
  if (demo) {
    db.courses = seed.courses;
    db.course_members = seed.course_members;
    db.assignments = seed.assignments;
    db.submissions = seed.submissions;
    db.chat_sessions = seed.chat_sessions;
  }
  await pushAllToSupabase();
  console.log(`[Supabase] Database was empty: seeded ${demo ? "demo data" : "admin account only"}.`);
}
async function loadFromSupabase() {
  db = emptyDb();
  syncCursor = 0;
  await pullFromSupabase(true);
  await seedIfEmpty();
  ensureSeedCredentials();
  supabaseLoaded = true;
  lastRefresh = Date.now();
  console.log(`[Supabase] Loaded ${db.users.length} users, ${db.courses.length} courses, ${db.submissions.length} submissions.`);
}
function needsFreshData(req) {
  const header = String(req.headers.authorization || "");
  if (header.startsWith("Bearer ")) {
    const uid2 = readToken(header.slice(7));
    if (uid2 && !db.users.some((u) => u.id === uid2)) return true;
  }
  if (req.path === "/auth/login" && req.body?.email) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!db.users.some((u) => u.email.toLowerCase() === email)) return true;
  }
  return false;
}
async function syncMiddleware(req, res, next) {
  if (!isSupabaseConfigured()) return next();
  try {
    if (!supabaseLoaded) {
      if (!initialLoad) initialLoad = loadFromSupabase().finally(() => {
        if (!supabaseLoaded) initialLoad = null;
      });
      await initialLoad;
    } else if (needsFreshData(req) || Date.now() - lastRefresh > 1500) {
      if (!refreshing) refreshing = pullFromSupabase().catch((e) => console.warn("[Supabase] Refresh failed:", e.message)).finally(() => {
        lastRefresh = Date.now();
        refreshing = null;
      });
      await refreshing;
    }
  } catch (e) {
    console.error("[Supabase] Load failed:", e.message);
    return res.status(503).json({ success: false, message: "Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c c\u01A1 s\u1EDF d\u1EEF li\u1EC7u. Vui l\xF2ng th\u1EED l\u1EA1i sau \xEDt ph\xFAt." });
  }
  next();
}
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
var app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/api", (req, res, next) => {
  const store = { pending: [] };
  const origEnd = res.end;
  res.end = function(...args) {
    const go = () => origEnd.apply(this, args);
    if (store.pending.length) Promise.allSettled([...store.pending]).then(go);
    else go();
    return this;
  };
  reqStore.run(store, next);
});
app.use("/api", syncMiddleware);
app.use("/api/supabase", requireAuth, (req, res, next) => req.user?.role === "admin" ? next() : res.status(403).json({ success: false, message: "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn m\u1EDBi \u0111\u01B0\u1EE3c qu\u1EA3n l\xFD c\u01A1 s\u1EDF d\u1EEF li\u1EC7u." }));
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
          users: db.users.length
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/supabase/schema", (req, res) => {
  res.json({ success: true, sql: SUPABASE_SCHEMA_SQL });
});
app.post("/api/supabase/sync", async (req, res) => {
  if (!getSupabaseClient()) return res.status(400).json({ success: false, message: "Ch\u01B0a c\u1EA5u h\xECnh Supabase. H\xE3y \u0111\u1EB7t SUPABASE_URL v\xE0 SUPABASE_SERVICE_ROLE_KEY." });
  try {
    const results = await pushAllToSupabase();
    res.json({ success: true, message: "\u0110\xE3 ghi to\xE0n b\u1ED9 d\u1EEF li\u1EC7u hi\u1EC7n t\u1EA1i l\xEAn Supabase.", results });
  } catch (err) {
    res.status(500).json({ success: false, message: `L\u1ED7i ghi d\u1EEF li\u1EC7u: ${err.message}. B\u1EA1n \u0111\xE3 ch\u1EA1y SQL Schema ch\u01B0a?` });
  }
});
app.post("/api/supabase/pull", async (req, res) => {
  if (!getSupabaseClient()) return res.status(400).json({ success: false, message: "Ch\u01B0a c\u1EA5u h\xECnh Supabase." });
  try {
    await pullFromSupabase(true);
    res.json({ success: true, message: "\u0110\xE3 n\u1EA1p l\u1EA1i d\u1EEF li\u1EC7u t\u1EEB Supabase.", stats: { users: db.users.length, courses: db.courses.length, assignments: db.assignments.length, submissions: db.submissions.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "L\u1ED7i \u0111\u1ECDc d\u1EEF li\u1EC7u t\u1EEB Supabase" });
  }
});
app.post("/api/supabase/auto-setup", async (req, res) => {
  const { db_password, connection_string } = req.body || {};
  const password = db_password || process.env.SUPABASE_DB_PASSWORD;
  const connStr = connection_string || process.env.DATABASE_URL;
  if (!password && !connStr) {
    return res.status(400).json({
      success: false,
      message: "Vui l\xF2ng nh\u1EADp Database Password c\u1EE7a Supabase (m\u1EADt kh\u1EA9u \u0111\xE3 t\u1EA1o khi t\u1EA1o project)."
    });
  }
  try {
    const result = await runAutoSetupSql({
      dbPassword: password,
      connectionString: connStr
    });
    if (!result.success) {
      return res.status(400).json(result);
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        if (db.users.length > 0) await supabase.from("users").upsert(db.users);
        if (db.courses.length > 0) await supabase.from("courses").upsert(db.courses);
        if (db.course_members.length > 0) {
          const formatted = db.course_members.map((m) => ({
            ...m,
            id: m.id || `${m.course_id}_${m.student_id}`
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
      message: "Tuy\u1EC7t v\u1EDDi! To\xE0n b\u1ED9 b\u1EA3ng \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EF1 \u0111\u1ED9ng t\u1EA1o v\xE0 \u0111\u1ED3ng b\u1ED9 d\u1EEF li\u1EC7u l\xEAn Supabase th\xE0nh c\xF4ng!"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "L\u1ED7i trong qu\xE1 tr\xECnh k\xEDch ho\u1EA1t t\u1EF1 \u0111\u1ED9ng Supabase."
    });
  }
});
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var uid = (p) => `${p}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
var PERMISSION_KEYS = ["create_course", "manage_assignments", "grade", "manage_members", "join_course", "use_ai_chat", "submit"];
var can = (user, perm) => user.role === "admin" || db.settings?.permissions?.[user.role]?.[perm] === true;
var permsFor = (user) => PERMISSION_KEYS.filter((k) => can(user, k));
var publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, active: u.active !== false, last_seen: u.last_seen, permissions: permsFor(u) });
function audit(actor, action, target, detail = "") {
  const log = { id: uid("log"), actor_id: actor?.id || "", actor_name: actor?.name || "H\u1EC7 th\u1ED1ng", action, target, detail, created_at: nowIso() };
  db.audit_logs.unshift(log);
  if (db.audit_logs.length > 500) db.audit_logs.length = 500;
  saveDocument("audit_logs", log.id, log);
}
var denied = (res) => fail(res, 403, "B\u1EA1n ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n th\u1EF1c hi\u1EC7n thao t\xE1c n\xE0y. H\xE3y li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn.");
var fail = (res, code, message) => res.status(code).json({ success: false, message });
function addNotification(userId, title, body, link) {
  const n = { id: uid("n"), user_id: userId, title, body, link: link || "", read: false, created_at: nowIso() };
  db.notifications.unshift(n);
  if (db.notifications.length > 500) db.notifications.length = 500;
  saveDocument("notifications", n.id, n);
}
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 400, "Vui l\xF2ng nh\u1EADp email v\xE0 m\u1EADt kh\u1EA9u.");
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || !user.pwd || !verifyPassword(String(password), user.pwd)) {
    return fail(res, 401, "Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng.");
  }
  if (user.active === false) return fail(res, 403, "T\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB v\xF4 hi\u1EC7u h\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn.");
  user.last_seen = nowIso();
  res.json({ success: true, data: { token: signToken(user.id), user: publicUser(user) } });
});
app.post("/api/auth/register", (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return fail(res, 400, "Vui l\xF2ng \u0111i\u1EC1n \u0111\u1EA7y \u0111\u1EE7 h\u1ECD t\xEAn, email v\xE0 m\u1EADt kh\u1EA9u.");
  if (!/^\S+@\S+\.\S+$/.test(String(email))) return fail(res, 400, "Email kh\xF4ng h\u1EE3p l\u1EC7.");
  if (String(password).length < 6) return fail(res, 400, "M\u1EADt kh\u1EA9u c\u1EA7n \xEDt nh\u1EA5t 6 k\xFD t\u1EF1.");
  if (role !== "teacher" && role !== "student") return fail(res, 400, "Vai tr\xF2 kh\xF4ng h\u1EE3p l\u1EC7.");
  if (db.settings.allow_registration === false) return fail(res, 403, "H\u1EC7 th\u1ED1ng \u0111ang \u0111\xF3ng \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n m\u1EDBi. H\xE3y li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn.");
  if (role === "teacher" && db.settings.teacher_self_register === false) return fail(res, 403, "T\xE0i kho\u1EA3n gi\u1EA3ng vi\xEAn c\u1EA7n \u0111\u01B0\u1EE3c qu\u1EA3n tr\u1ECB vi\xEAn c\u1EA5p. H\xE3y \u0111\u0103ng k\xFD sinh vi\xEAn ho\u1EB7c li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn.");
  const cleanEmail = String(email).trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) return fail(res, 409, "Email n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD.");
  const cleanName = String(name).trim().slice(0, 80);
  const user = {
    id: uid("u"),
    name: cleanName,
    email: cleanEmail,
    role,
    avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundType=gradientLinear`,
    pwd: hashPassword(String(password))
  };
  db.users.push(user);
  saveDocument("users", user.id, user);
  audit(user, "register", user.email, `\u0110\u0103ng k\xFD t\xE0i kho\u1EA3n ${role}`);
  res.json({ success: true, data: { token: signToken(user.id), user: publicUser(user) } });
});
app.use("/api", requireAuth);
app.get("/api/auth/me", (req, res) => res.json({ success: true, data: publicUser(req.user) }));
app.put("/api/auth/password", (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next) return fail(res, 400, "Vui l\xF2ng nh\u1EADp m\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i v\xE0 m\u1EADt kh\u1EA9u m\u1EDBi.");
  if (!verifyPassword(String(current), req.user.pwd || "")) return fail(res, 400, "M\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i kh\xF4ng \u0111\xFAng.");
  if (String(next).length < 6) return fail(res, 400, "M\u1EADt kh\u1EA9u m\u1EDBi c\u1EA7n \xEDt nh\u1EA5t 6 k\xFD t\u1EF1.");
  req.user.pwd = hashPassword(String(next));
  saveDocument("users", req.user.id, req.user);
  res.json({ success: true, message: "\u0110\xE3 \u0111\u1ED5i m\u1EADt kh\u1EA9u." });
});
app.put("/api/auth/me", (req, res) => {
  const { name } = req.body || {};
  if (name && String(name).trim()) req.user.name = String(name).trim().slice(0, 80);
  saveDocument("users", req.user.id, req.user);
  res.json({ success: true, data: publicUser(req.user) });
});
var findCourse = (id) => db.courses.find((c) => c.id === id);
var isOwner = (course, user) => !!course && user.role === "teacher" && course.teacher_id === user.id;
var isMember = (courseId, user) => db.course_members.some((m) => m.course_id === courseId && m.student_id === user.id);
var canViewCourse = (course, user) => isOwner(course, user) || user.role === "student" && isMember(course.id, user);
var gradedState = (s) => s.grade !== void 0 && s.grade !== null;
var isSubmitted = (s) => s.status === "submitted" || s.status === "late";
function teacherOnly(req, res) {
  if (req.user.role !== "teacher") {
    fail(res, 403, "Ch\u1EE9c n\u0103ng n\xE0y ch\u1EC9 d\xE0nh cho gi\u1EA3ng vi\xEAn.");
    return false;
  }
  return true;
}
function courseWithCounts(course, user) {
  const courseAssignments = db.assignments.filter((a) => a.course_id === course.id);
  const openAssignments = courseAssignments.filter((a) => new Date(a.due_date) > /* @__PURE__ */ new Date());
  const base = {
    ...course,
    accent_color: !course.accent_color || /zinc|slate|gray/.test(course.accent_color) ? COURSE_COLORS[[...course.id].reduce((a, c) => a + c.charCodeAt(0), 0) % COURSE_COLORS.length] : course.accent_color,
    member_count: db.course_members.filter((m) => m.course_id === course.id).length,
    open_assignments_count: openAssignments.length,
    assignments_count: courseAssignments.length
  };
  if (user.role !== "student") {
    const subs = db.submissions.filter((s) => courseAssignments.some((a) => a.id === s.assignment_id));
    base.ungraded_count = subs.filter((s) => isSubmitted(s) && !gradedState(s)).length;
  } else {
    delete base.invite_code;
    const mine = db.submissions.filter((s) => s.student_id === user.id && isSubmitted(s));
    base.todo_count = courseAssignments.filter((a) => !mine.some((s) => s.assignment_id === a.id) && new Date(a.due_date) > /* @__PURE__ */ new Date()).length;
  }
  const mineDone = user.role === "student" ? db.submissions.filter((s) => s.student_id === user.id && isSubmitted(s)) : [];
  const next = courseAssignments.filter((a) => new Date(a.due_date) > /* @__PURE__ */ new Date() && !mineDone.some((s) => s.assignment_id === a.id)).sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date))[0];
  base.next_due = next ? { id: next.id, title: next.title, due_date: next.due_date } : null;
  return base;
}
app.get("/api/courses", (req, res) => {
  const user = req.user;
  const list = user.role === "admin" ? [] : user.role === "teacher" ? db.courses.filter((c) => c.teacher_id === user.id) : db.courses.filter((c) => isMember(c.id, user));
  res.json({ success: true, data: list.map((c) => courseWithCounts(c, user)) });
});
var COURSE_COLORS = ["from-indigo-500 to-violet-600", "from-sky-500 to-blue-600", "from-emerald-500 to-teal-600", "from-rose-500 to-pink-600", "from-amber-500 to-orange-600", "from-fuchsia-500 to-purple-600"];
app.post("/api/courses", (req, res) => {
  if (!teacherOnly(req, res)) return;
  if (!can(req.user, "create_course")) return denied(res);
  const { name, code, semester, description } = req.body || {};
  if (!name?.trim() || !code?.trim()) return fail(res, 400, "T\xEAn m\xF4n h\u1ECDc v\xE0 M\xE3 m\xF4n l\xE0 b\u1EAFt bu\u1ED9c.");
  let invite = generateInviteCode();
  while (db.courses.some((c) => c.invite_code === invite)) invite = generateInviteCode();
  const newCourse = {
    id: uid("c"),
    name: name.trim(),
    code: code.trim().toUpperCase(),
    teacher_id: req.user.id,
    teacher_name: req.user.name,
    semester: semester || "H\u1ECDc k\u1EF3 I (2025-2026)",
    description: description || "",
    invite_code: invite,
    accent_color: COURSE_COLORS[db.courses.length % COURSE_COLORS.length],
    created_at: nowIso()
  };
  db.courses.unshift(newCourse);
  saveDocument("courses", newCourse.id, newCourse);
  res.json({ success: true, data: courseWithCounts(newCourse, req.user) });
});
app.put("/api/courses/:id", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y m\xF4n h\u1ECDc.");
  if (!isOwner(course, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa m\xF4n h\u1ECDc n\xE0y.");
  const { name, code, semester, description } = req.body || {};
  if (!name?.trim() || !code?.trim()) return fail(res, 400, "T\xEAn m\xF4n h\u1ECDc v\xE0 M\xE3 m\xF4n l\xE0 b\u1EAFt bu\u1ED9c.");
  Object.assign(course, {
    name: name.trim(),
    code: code.trim().toUpperCase(),
    semester: semester || course.semester,
    description: description !== void 0 ? String(description).trim() : course.description,
    updated_at: nowIso()
  });
  saveDocument("courses", course.id, course);
  res.json({ success: true, data: course, message: "C\u1EADp nh\u1EADt th\xF4ng tin m\xF4n h\u1ECDc th\xE0nh c\xF4ng!" });
});
app.post("/api/courses/:id/regenerate-code", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y m\xF4n h\u1ECDc.");
  if (!isOwner(course, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n.");
  if (!can(req.user, "manage_members")) return denied(res);
  let invite = generateInviteCode();
  while (db.courses.some((c) => c.invite_code === invite)) invite = generateInviteCode();
  course.invite_code = invite;
  saveDocument("courses", course.id, course);
  res.json({ success: true, data: { invite_code: invite }, message: "\u0110\xE3 t\u1EA1o m\xE3 m\u1EDDi m\u1EDBi. M\xE3 c\u0169 kh\xF4ng c\xF2n hi\u1EC7u l\u1EF1c." });
});
app.delete("/api/courses/:id", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y m\xF4n h\u1ECDc \u0111\u1EC3 x\xF3a.");
  if (!isOwner(course, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n x\xF3a m\xF4n h\u1ECDc n\xE0y.");
  audit(req.user, "course.delete", course.name, `M\xE3 ${course.code}`);
  deleteCourseCascade(course.id);
  res.json({ success: true, message: `\u0110\xE3 x\xF3a m\xF4n h\u1ECDc "${course.name}" v\xE0 c\xE1c d\u1EEF li\u1EC7u li\xEAn quan.` });
});
function deleteCourseCascade(courseId) {
  db.courses = db.courses.filter((c) => c.id !== courseId);
  deleteDocument("courses", courseId);
  const assignmentIds = db.assignments.filter((a) => a.course_id === courseId).map((a) => a.id);
  for (const id of assignmentIds) deleteAssignmentCascade(id);
  const members = db.course_members.filter((m) => m.course_id === courseId);
  db.course_members = db.course_members.filter((m) => m.course_id !== courseId);
  for (const m of members) deleteDocument("course_members", `${courseId}_${m.student_id}`);
}
function deleteAssignmentCascade(assignmentId) {
  db.assignments = db.assignments.filter((a) => a.id !== assignmentId);
  deleteDocument("assignments", assignmentId);
  for (const s of db.submissions.filter((x) => x.assignment_id === assignmentId)) deleteDocument("submissions", s.id);
  db.submissions = db.submissions.filter((s) => s.assignment_id !== assignmentId);
  for (const cs of db.chat_sessions.filter((x) => x.assignment_id === assignmentId)) deleteDocument("chat_sessions", cs.id);
  db.chat_sessions = db.chat_sessions.filter((cs) => cs.assignment_id !== assignmentId);
}
app.post("/api/courses/join", (req, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Ch\u1EC9 sinh vi\xEAn m\u1EDBi tham gia l\u1EDBp b\u1EB1ng m\xE3 m\u1EDDi.");
  if (!can(req.user, "join_course")) return denied(res);
  const { invite_code } = req.body || {};
  if (!invite_code) return fail(res, 400, "Vui l\xF2ng nh\u1EADp m\xE3 m\u1EDDi.");
  const course = db.courses.find((c) => c.invite_code === String(invite_code).trim().toUpperCase());
  if (!course) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y m\xF4n h\u1ECDc v\u1EDBi m\xE3 m\u1EDDi n\xE0y.");
  if (isMember(course.id, req.user)) return fail(res, 400, "B\u1EA1n \u0111\xE3 tham gia m\xF4n h\u1ECDc n\xE0y r\u1ED3i!");
  const member = {
    course_id: course.id,
    student_id: req.user.id,
    student_name: req.user.name,
    student_email: req.user.email,
    student_avatar: req.user.avatar,
    joined_at: nowIso()
  };
  db.course_members.push(member);
  saveDocument("course_members", `${course.id}_${req.user.id}`, member);
  addNotification(course.teacher_id, "Sinh vi\xEAn m\u1EDBi tham gia", `${req.user.name} v\u1EEBa tham gia ${course.name}.`);
  res.json({ success: true, data: courseWithCounts(course, req.user), message: `Tham gia m\xF4n h\u1ECDc "${course.name}" th\xE0nh c\xF4ng!` });
});
app.post("/api/courses/:id/leave", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 404, "B\u1EA1n kh\xF4ng thu\u1ED9c m\xF4n h\u1ECDc n\xE0y.");
  db.course_members = db.course_members.filter((m) => !(m.course_id === course.id && m.student_id === req.user.id));
  deleteDocument("course_members", `${course.id}_${req.user.id}`);
  res.json({ success: true, message: "B\u1EA1n \u0111\xE3 r\u1EDDi kh\u1ECFi m\xF4n h\u1ECDc." });
});
app.delete("/api/courses/:id/members/:studentId", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y m\xF4n h\u1ECDc.");
  if (!isOwner(course, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n.");
  if (!can(req.user, "manage_members")) return denied(res);
  const before = db.course_members.length;
  db.course_members = db.course_members.filter((m) => !(m.course_id === course.id && m.student_id === req.params.studentId));
  if (db.course_members.length === before) return fail(res, 404, "Sinh vi\xEAn kh\xF4ng thu\u1ED9c l\u1EDBp.");
  deleteDocument("course_members", `${course.id}_${req.params.studentId}`);
  res.json({ success: true, message: "\u0110\xE3 x\xF3a sinh vi\xEAn kh\u1ECFi l\u1EDBp." });
});
app.get("/api/courses/:id", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "M\xF4n h\u1ECDc kh\xF4ng t\u1ED3n t\u1EA1i.");
  if (!canViewCourse(course, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng thu\u1ED9c m\xF4n h\u1ECDc n\xE0y.");
  const owner = isOwner(course, req.user);
  const members = db.course_members.filter((m) => m.course_id === course.id);
  const assignments = db.assignments.filter((a) => a.course_id === course.id).map((a) => {
    const out = { ...a };
    if (!owner) {
      const sub = db.submissions.find((s) => s.assignment_id === a.id && s.student_id === req.user.id);
      out.submission_status = sub ? sub.status : "not_submitted";
      out.submitted_at = sub?.submitted_at;
      out.my_process_score = sub?.process_score_result?.process_score;
      out.my_grade = sub?.grade;
    } else {
      const subs = db.submissions.filter((s) => s.assignment_id === a.id && isSubmitted(s));
      out.submitted_count = subs.length;
      out.ungraded_count = subs.filter((s) => !gradedState(s)).length;
      out.member_count = members.length;
    }
    return out;
  }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const { invite_code, ...rest } = course;
  res.json({ success: true, data: { ...owner ? course : rest, members, assignments } });
});
function sanitizeAssignmentInput(body) {
  const { title, description, rubric, due_date, attachments, submission_mode, ai_submode, allow_late } = body || {};
  return {
    title: typeof title === "string" ? title.trim() : title,
    description: description ?? "",
    rubric: rubric ?? "",
    due_date,
    attachments: Array.isArray(attachments) ? attachments : [],
    submission_mode: ["file_only", "ai_chat_only", "both"].includes(submission_mode) ? submission_mode : "both",
    ai_submode: ai_submode === "normal" ? "normal" : "socratic",
    allow_late: allow_late === false ? false : true
  };
}
app.post("/api/courses/:id/assignments", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y m\xF4n h\u1ECDc.");
  if (!isOwner(course, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n giao b\xE0i cho m\xF4n n\xE0y.");
  if (!can(req.user, "manage_assignments")) return denied(res);
  const input = sanitizeAssignmentInput(req.body);
  if (!input.title || !input.due_date || isNaN(new Date(input.due_date).getTime())) return fail(res, 400, "Ti\xEAu \u0111\u1EC1 v\xE0 h\u1EA1n n\u1ED9p h\u1EE3p l\u1EC7 l\xE0 b\u1EAFt bu\u1ED9c.");
  const a = { id: uid("a"), course_id: course.id, ...input, created_at: nowIso() };
  db.assignments.unshift(a);
  saveDocument("assignments", a.id, a);
  for (const m of db.course_members.filter((m2) => m2.course_id === course.id)) {
    addNotification(m.student_id, "B\xE0i t\u1EADp m\u1EDBi", `${course.name}: ${a.title}`, `/course/${course.id}/assignment/${a.id}`);
  }
  res.json({ success: true, data: a });
});
app.put("/api/assignments/:id", (req, res) => {
  const a = db.assignments.find((x) => x.id === req.params.id);
  if (!a) return fail(res, 404, "B\xE0i t\u1EADp kh\xF4ng t\u1ED3n t\u1EA1i.");
  if (!isOwner(findCourse(a.course_id), req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa b\xE0i t\u1EADp n\xE0y.");
  if (!can(req.user, "manage_assignments")) return denied(res);
  const input = sanitizeAssignmentInput({ ...a, ...req.body });
  if (!input.title || !input.due_date || isNaN(new Date(input.due_date).getTime())) return fail(res, 400, "Ti\xEAu \u0111\u1EC1 v\xE0 h\u1EA1n n\u1ED9p h\u1EE3p l\u1EC7 l\xE0 b\u1EAFt bu\u1ED9c.");
  Object.assign(a, input, { updated_at: nowIso() });
  saveDocument("assignments", a.id, a);
  res.json({ success: true, data: a, message: "\u0110\xE3 c\u1EADp nh\u1EADt b\xE0i t\u1EADp." });
});
app.delete("/api/assignments/:id", (req, res) => {
  const a = db.assignments.find((x) => x.id === req.params.id);
  if (!a) return fail(res, 404, "B\xE0i t\u1EADp kh\xF4ng t\u1ED3n t\u1EA1i.");
  if (!isOwner(findCourse(a.course_id), req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n x\xF3a b\xE0i t\u1EADp n\xE0y.");
  if (!can(req.user, "manage_assignments")) return denied(res);
  deleteAssignmentCascade(a.id);
  res.json({ success: true, message: "\u0110\xE3 x\xF3a b\xE0i t\u1EADp v\xE0 c\xE1c b\xE0i n\u1ED9p li\xEAn quan." });
});
app.get("/api/assignments/:id", (req, res) => {
  const assignment = db.assignments.find((a) => a.id === req.params.id);
  if (!assignment) return fail(res, 404, "B\xE0i t\u1EADp kh\xF4ng t\u1ED3n t\u1EA1i.");
  const course = findCourse(assignment.course_id);
  if (!course || !canViewCourse(course, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng thu\u1ED9c m\xF4n h\u1ECDc n\xE0y.");
  let submission = null, chatSession = null;
  if (req.user.role === "student") {
    submission = db.submissions.find((s) => s.assignment_id === assignment.id && s.student_id === req.user.id) || null;
    chatSession = db.chat_sessions.find((cs) => cs.assignment_id === assignment.id && cs.student_id === req.user.id) || null;
  }
  res.json({ success: true, data: { assignment, course_name: course.name, submission, chat_session: chatSession } });
});
app.get("/api/assignments/:id/submissions", (req, res) => {
  const assignment = db.assignments.find((a) => a.id === req.params.id);
  if (!assignment) return fail(res, 404, "B\xE0i t\u1EADp kh\xF4ng t\u1ED3n t\u1EA1i.");
  if (!isOwner(findCourse(assignment.course_id), req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem b\xE0i n\u1ED9p.");
  const isPastDue = new Date(assignment.due_date) < /* @__PURE__ */ new Date();
  const submissions = db.course_members.filter((m) => m.course_id === assignment.course_id).map((m) => {
    const sub = db.submissions.find((s) => s.assignment_id === assignment.id && s.student_id === m.student_id);
    return sub || {
      id: `stub_${m.student_id}_${assignment.id}`,
      assignment_id: assignment.id,
      student_id: m.student_id,
      student_name: m.student_name,
      student_email: m.student_email,
      student_avatar: m.student_avatar,
      submitted_files: [],
      submitted_text: "",
      status: isPastDue ? "not_submitted" : "draft"
    };
  });
  res.json({ success: true, data: { assignment, submissions } });
});
app.get("/api/submissions/:id", (req, res) => {
  const sub = db.submissions.find((s) => s.id === req.params.id);
  if (!sub) return fail(res, 404, "B\xE0i n\u1ED9p kh\xF4ng t\u1ED3n t\u1EA1i.");
  const assignment = db.assignments.find((a) => a.id === sub.assignment_id);
  const course = assignment && findCourse(assignment.course_id);
  if (!isOwner(course, req.user) && sub.student_id !== req.user.id) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem b\xE0i n\u1ED9p n\xE0y.");
  const chatSession = db.chat_sessions.find((cs) => cs.assignment_id === sub.assignment_id && cs.student_id === sub.student_id);
  res.json({ success: true, data: { submission: sub, assignment, chat_session: chatSession } });
});
app.put("/api/submissions/:id/grade", (req, res) => {
  const sub = db.submissions.find((s) => s.id === req.params.id);
  if (!sub) return fail(res, 404, "B\xE0i n\u1ED9p kh\xF4ng t\u1ED3n t\u1EA1i.");
  const assignment = db.assignments.find((a) => a.id === sub.assignment_id);
  if (!isOwner(assignment && findCourse(assignment.course_id), req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n ch\u1EA5m b\xE0i n\xE0y.");
  if (!can(req.user, "grade")) return denied(res);
  const grade = Number(req.body?.grade);
  if (!Number.isFinite(grade) || grade < 0 || grade > 10) return fail(res, 400, "\u0110i\u1EC3m ph\u1EA3i n\u1EB1m trong kho\u1EA3ng 0 - 10.");
  sub.grade = Math.round(grade * 100) / 100;
  sub.feedback = String(req.body?.feedback || "").slice(0, 5e3);
  sub.graded_at = nowIso();
  saveDocument("submissions", sub.id, sub);
  addNotification(sub.student_id, "B\xE0i t\u1EADp \u0111\xE3 \u0111\u01B0\u1EE3c ch\u1EA5m", `${assignment.title}: ${sub.grade}/10`, `/course/${assignment.course_id}/assignment/${assignment.id}`);
  res.json({ success: true, data: sub, message: "\u0110\xE3 l\u01B0u \u0111i\u1EC3m v\xE0 nh\u1EADn x\xE9t." });
});
app.post("/api/submissions/:id/reevaluate", async (req, res) => {
  const sub = db.submissions.find((s) => s.id === req.params.id);
  if (!sub) return fail(res, 404, "B\xE0i n\u1ED9p kh\xF4ng t\u1ED3n t\u1EA1i.");
  const assignment = db.assignments.find((a) => a.id === sub.assignment_id);
  if (!isOwner(assignment && findCourse(assignment.course_id), req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n.");
  if (!can(req.user, "grade")) return denied(res);
  const chat = db.chat_sessions.find((cs) => cs.assignment_id === sub.assignment_id && cs.student_id === sub.student_id);
  if (!chat || !chat.messages.some((m) => m.role === "user")) return fail(res, 400, "B\xE0i n\u1ED9p n\xE0y kh\xF4ng c\xF3 nh\u1EADt k\xFD chat \u0111\u1EC3 ch\u1EA5m.");
  try {
    sub.process_score_result = await evaluateProcess(assignment, chat, sub.submitted_text);
    sub.eval_status = "ok";
    sub.eval_error = void 0;
    saveDocument("submissions", sub.id, sub);
    res.json({ success: true, data: sub, message: "\u0110\xE3 ch\u1EA5m l\u1EA1i b\u1EB1ng AI." });
  } catch (e) {
    sub.eval_status = "failed";
    sub.eval_error = e.message;
    saveDocument("submissions", sub.id, sub);
    fail(res, 502, "AI ch\u01B0a ch\u1EA5m \u0111\u01B0\u1EE3c: " + e.message);
  }
});
function transcriptOf(chat) {
  return chat.messages.map((m) => `${m.role === "user" ? "Sinh vi\xEAn" : "AI Assistant"}: ${m.content}`).join("\n");
}
async function evaluateProcess(assignment, chat, submittedText) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Ch\u01B0a c\u1EA5u h\xECnh GEMINI_API_KEY tr\xEAn m\xE1y ch\u1EE7.");
  const transcript = transcriptOf(chat).slice(-6e4);
  const evalPrompt = `B\u1EA1n \u0111\u01B0\u1EE3c cung c\u1EA5p transcript cu\u1ED9c tr\xF2 chuy\u1EC7n gi\u1EEFa sinh vi\xEAn v\xE0 AI khi l\xE0m b\xE0i t\u1EADp [${assignment.title}], c\xF9ng b\xE0i n\u1ED9p cu\u1ED1i c\xF9ng (n\u1EBFu c\xF3: "${submittedText || "Kh\xF4ng c\xF3 v\u0103n b\u1EA3n n\u1ED9p tr\u1EF1c ti\u1EBFp"}"). H\xE3y \u0111\xE1nh gi\xE1 QU\xC1 TR\xCCNH T\u01AF DUY c\u1EE7a sinh vi\xEAn m\u1ED9t c\xE1ch nghi\xEAm kh\u1EAFc, trung th\u1EF1c: n\u1EBFu sinh vi\xEAn ch\u1EC9 xin \u0111\xE1p \xE1n, copy-paste, ho\u1EB7c l\xE0m h\u1ED9 th\xEC \u0111i\u1EC3m ph\u1EA3i th\u1EA5p. Tr\u1EA3 v\u1EC1 JSON theo schema:
- process_score: s\u1ED1 nguy\xEAn 0-100
- tieu_chi: tu_duy_phan_bien (ch\u1EA5t v\u1EA5n/ph\u1EA3n b\xE1c AI), dao_sau_van_de (refine c\xE2u h\u1ECFi t\u1EEB chung chung sang c\u1EE5 th\u1EC3), kiem_chung_thong_tin (y\xEAu c\u1EA7u d\u1EABn ngu\u1ED3n/verify), noi_hoa_kien_thuc (t\u1EF1 di\u1EC5n gi\u1EA3i b\u1EB1ng l\u1EDDi ri\xEAng), tinh_chu_dong (m\u1EDF r\u1ED9ng v\u1EA5n \u0111\u1EC1 thay v\xEC ch\u1EC9 nh\u1EADn \u0111\xE1p \xE1n); m\u1ED7i ti\xEAu ch\xED 0-100
- noi_dung_ngoai_luong: m\xF4 t\u1EA3 n\u1EBFu b\xE0i n\u1ED9p c\xF3 \u0111o\u1EA1n kh\xF4ng kh\u1EDBp transcript, ho\u1EB7c chu\u1ED7i r\u1ED7ng
- nhan_xet_ngan: 2-3 c\xE2u ti\u1EBFng Vi\u1EC7t t\xF3m t\u1EAFt ki\u1EC3u t\u01B0 duy
- highlight_segments: danh s\xE1ch {doan_van_ban (tr\xEDch NGUY\xCAN V\u0102N c\xE2u c\u1EE7a sinh vi\xEAn), mau: "xanh"|"vang"|"do", ly_do}
M\xE0u: xanh = ph\u1EA3n bi\u1EC7n/t\u01B0 duy s\xE2u/t\u1EF1 t\u1ED5ng h\u1EE3p; vang = t\xF2 m\xF2, c\u1EA7n l\xE0m r\xF5; do = copy ho\xE0n to\xE0n ho\u1EB7c nh\u1EDD AI l\xE0m h\u1ED9.`;
  const response = await generateWithFallback({
    contents: [{ role: "user", parts: [{ text: `Transcript:
${transcript}

${evalPrompt}` }] }],
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
              tinh_chu_dong: { type: Type.INTEGER }
            },
            required: ["tu_duy_phan_bien", "dao_sau_van_de", "kiem_chung_thong_tin", "noi_hoa_kien_thuc", "tinh_chu_dong"]
          },
          noi_dung_ngoai_luong: { type: Type.STRING },
          nhan_xet_ngan: { type: Type.STRING },
          highlight_segments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { doan_van_ban: { type: Type.STRING }, mau: { type: Type.STRING }, ly_do: { type: Type.STRING } },
              required: ["doan_van_ban", "mau", "ly_do"]
            }
          }
        },
        required: ["process_score", "tieu_chi", "nhan_xet_ngan", "highlight_segments"]
      }
    }
  });
  if (!response.text) throw new Error("AI tr\u1EA3 v\u1EC1 n\u1ED9i dung r\u1ED7ng.");
  const parsed = JSON.parse(response.text.trim());
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  parsed.process_score = clamp(parsed.process_score);
  for (const k of Object.keys(parsed.tieu_chi || {})) parsed.tieu_chi[k] = clamp(parsed.tieu_chi[k]);
  parsed.noi_dung_ngoai_luong = parsed.noi_dung_ngoai_luong?.trim() ? parsed.noi_dung_ngoai_luong : null;
  parsed.highlight_segments = (parsed.highlight_segments || []).map((h) => ({ ...h, mau: ["xanh", "vang", "do"].includes(h.mau) ? h.mau : "vang" }));
  return parsed;
}
app.post("/api/submissions/draft", (req, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Ch\u1EC9 sinh vi\xEAn m\u1EDBi l\u01B0u nh\xE1p.");
  const { assignment_id, submitted_files, submitted_text, notes } = req.body || {};
  const assignment = db.assignments.find((a) => a.id === assignment_id);
  if (!assignment || !isMember(assignment.course_id, req.user)) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y b\xE0i t\u1EADp.");
  let sub = db.submissions.find((s) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (sub && isSubmitted(sub)) return fail(res, 409, "B\xE0i \u0111\xE3 \u0111\u01B0\u1EE3c n\u1ED9p, kh\xF4ng th\u1EC3 l\u01B0u nh\xE1p.");
  if (!sub) {
    sub = {
      id: uid("sub"),
      assignment_id,
      student_id: req.user.id,
      student_name: req.user.name,
      student_email: req.user.email,
      student_avatar: req.user.avatar,
      submitted_files: [],
      submitted_text: "",
      status: "draft"
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
var chatHits = /* @__PURE__ */ new Map();
function chatRateLimited(userId) {
  const now = Date.now();
  const hits = (chatHits.get(userId) || []).filter((t) => now - t < 5 * 60 * 1e3);
  if (hits.length >= 25) {
    chatHits.set(userId, hits);
    return true;
  }
  hits.push(now);
  chatHits.set(userId, hits);
  return false;
}
app.post("/api/chat/message", async (req, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Ch\u1EC9 sinh vi\xEAn m\u1EDBi tr\xF2 chuy\u1EC7n trong b\xE0i t\u1EADp.");
  if (!can(req.user, "use_ai_chat")) return denied(res);
  const { assignment_id, message_content } = req.body || {};
  if (!assignment_id || !message_content || typeof message_content !== "string") return fail(res, 400, "Thi\u1EBFu th\xF4ng tin tin nh\u1EAFn.");
  if (message_content.length > 3e4) return fail(res, 413, "Tin nh\u1EAFn qu\xE1 d\xE0i (t\u1ED1i \u0111a 30.000 k\xFD t\u1EF1).");
  const assignment = db.assignments.find((a) => a.id === assignment_id);
  if (!assignment) return fail(res, 404, "B\xE0i t\u1EADp kh\xF4ng t\xECm th\u1EA5y.");
  const course = findCourse(assignment.course_id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng thu\u1ED9c m\xF4n h\u1ECDc n\xE0y.");
  if (assignment.submission_mode === "file_only") return fail(res, 400, "B\xE0i t\u1EADp n\xE0y ch\u1EC9 n\u1ED9p file, kh\xF4ng c\xF3 AI chat.");
  const existing = db.submissions.find((s) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (existing && isSubmitted(existing)) return fail(res, 409, "B\xE0i \u0111\xE3 n\u1ED9p, cu\u1ED9c tr\xF2 chuy\u1EC7n \u0111\xE3 \u0111\u01B0\u1EE3c kh\xF3a.");
  if (chatRateLimited(req.user.id)) return fail(res, 429, "B\u1EA1n g\u1EEDi qu\xE1 nhanh, vui l\xF2ng \u0111\u1EE3i v\xE0i ph\xFAt r\u1ED3i th\u1EED l\u1EA1i.");
  let chatSession = db.chat_sessions.find((cs) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  if (!chatSession) {
    chatSession = { id: uid("cs"), assignment_id, student_id: req.user.id, messages: [] };
    db.chat_sessions.push(chatSession);
  }
  const userMsg = { id: uid("m"), role: "user", content: message_content, timestamp: nowIso() };
  chatSession.messages.push(userMsg);
  const systemInstruction = assignment.ai_submode === "socratic" ? `B\u1EA1n l\xE0 tr\u1EE3 l\xFD h\u1ECDc t\u1EADp AI trong m\xF4n ${course.name}, h\u1ED7 tr\u1EE3 sinh vi\xEAn l\xE0m b\xE0i t\u1EADp: ${assignment.title}. M\xF4 t\u1EA3 b\xE0i t\u1EADp: ${assignment.description}.
Khi sinh vi\xEAn h\u1ECFi, \u0111\u1EEBng \u0111\u01B0a \u0111\xE1p \xE1n ngay. \u0110\u1EB7t 1-2 c\xE2u h\u1ECFi g\u1EE3i m\u1EDF \u0111\u1EC3 sinh vi\xEAn t\u1EF1 suy ngh\u0129 tr\u01B0\u1EDBc. Ch\u1EC9 \u0111\u01B0a \u0111\xE1p \xE1n/h\u01B0\u1EDBng d\u1EABn chi ti\u1EBFt sau khi sinh vi\xEAn \u0111\xE3 th\u1EED tr\u1EA3 l\u1EDDi. N\u1EBFu sinh vi\xEAn y\xEAu c\u1EA7u \u0111\xE1p \xE1n ngay, nh\u1EAFc nh\u1EB9 nh\xE0ng v\u1EC1 l\u1EE3i \xEDch t\u1EF1 t\u01B0 duy tr\u01B0\u1EDBc, sau \u0111\xF3 v\u1EABn h\u1ED7 tr\u1EE3 n\u1EBFu h\u1ECD th\u1EF1c s\u1EF1 c\u1EA7n.
Tr\u1EA3 l\u1EDDi b\u1EB1ng ti\u1EBFng Vi\u1EC7t th\xE2n thi\u1EC7n, r\xF5 r\xE0ng, mang t\xEDnh gi\xE1o d\u1EE5c.` : `B\u1EA1n l\xE0 tr\u1EE3 l\xFD h\u1ECDc t\u1EADp AI nhi\u1EC7t t\xECnh trong m\xF4n ${course.name}, h\u1ED7 tr\u1EE3 sinh vi\xEAn l\xE0m b\xE0i t\u1EADp: ${assignment.title}.
Gi\u1EA3i \u0111\xE1p th\u1EAFc m\u1EAFc, g\u1EE3i \xFD h\u01B0\u1EDBng gi\u1EA3i quy\u1EBFt v\xE0 cung c\u1EA5p t\xE0i li\u1EC7u tham kh\u1EA3o ch\xEDnh x\xE1c. Tr\u1EA3 l\u1EDDi b\u1EB1ng ti\u1EBFng Vi\u1EC7t chuy\xEAn nghi\u1EC7p, ng\u1EAFn g\u1ECDn.`;
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Ch\u01B0a c\u1EA5u h\xECnh GEMINI_API_KEY tr\xEAn m\xE1y ch\u1EE7.");
    const response = await generateWithFallback({
      contents: chatSession.messages.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
      config: { systemInstruction, temperature: 0.7 }
    });
    const replyText = response.text;
    if (!replyText) throw new Error("AI tr\u1EA3 v\u1EC1 n\u1ED9i dung r\u1ED7ng.");
    const aiMsg = { id: uid("m"), role: "model", content: replyText, timestamp: nowIso() };
    chatSession.messages.push(aiMsg);
    saveDocument("chat_sessions", chatSession.id, chatSession);
    res.json({ success: true, data: { chat_session: chatSession, new_message: aiMsg } });
  } catch (err) {
    console.error("Gemini Chat Error:", err?.message || err);
    chatSession.messages = chatSession.messages.filter((m) => m.id !== userMsg.id);
    fail(res, 502, "Tr\u1EE3 l\xFD AI t\u1EA1m th\u1EDDi kh\xF4ng ph\u1EA3n h\u1ED3i \u0111\u01B0\u1EE3c. Tin nh\u1EAFn ch\u01B0a \u0111\u01B0\u1EE3c ghi nh\u1EADn, h\xE3y th\u1EED g\u1EEDi l\u1EA1i.");
  }
});
app.post("/api/submissions/submit", async (req, res) => {
  if (req.user.role !== "student") return fail(res, 403, "Ch\u1EC9 sinh vi\xEAn m\u1EDBi n\u1ED9p b\xE0i.");
  if (!can(req.user, "submit")) return denied(res);
  const { assignment_id, submitted_files, submitted_text, notes } = req.body || {};
  const assignment = db.assignments.find((a) => a.id === assignment_id);
  if (!assignment || !isMember(assignment.course_id, req.user)) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y b\xE0i t\u1EADp.");
  let sub = db.submissions.find((s) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (sub && isSubmitted(sub)) return fail(res, 409, "B\u1EA1n \u0111\xE3 n\u1ED9p b\xE0i n\xE0y r\u1ED3i, kh\xF4ng th\u1EC3 n\u1ED9p l\u1EA1i.");
  const isLate = /* @__PURE__ */ new Date() > new Date(assignment.due_date);
  if (isLate && assignment.allow_late === false) return fail(res, 403, "\u0110\xE3 qu\xE1 h\u1EA1n n\u1ED9p v\xE0 b\xE0i t\u1EADp n\xE0y kh\xF4ng nh\u1EADn b\xE0i tr\u1EC5.");
  const chatSession = db.chat_sessions.find((cs) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  const userTurns = chatSession ? chatSession.messages.filter((m) => m.role === "user").length : 0;
  if (assignment.submission_mode !== "file_only" && userTurns < 3) return fail(res, 400, "B\u1EA1n c\u1EA7n trao \u0111\u1ED5i \xEDt nh\u1EA5t 3 l\u01B0\u1EE3t v\u1EDBi tr\u1EE3 l\xFD AI tr\u01B0\u1EDBc khi n\u1ED9p.");
  if (assignment.submission_mode === "file_only" && !(submitted_files?.length || submitted_text?.trim())) return fail(res, 400, "Vui l\xF2ng \u0111\xEDnh k\xE8m file ho\u1EB7c nh\u1EADp n\u1ED9i dung b\xE0i l\xE0m.");
  let processScoreResult = void 0;
  let evalStatus = "skipped";
  let evalError;
  if (assignment.submission_mode !== "file_only" && chatSession && userTurns > 0) {
    try {
      processScoreResult = await evaluateProcess(assignment, chatSession, submitted_text);
      evalStatus = "ok";
    } catch (e) {
      console.error("Gemini Evaluation error:", e?.message || e);
      evalStatus = "failed";
      evalError = e?.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh";
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
    notes: notes || ""
  });
  if (chatSession) {
    chatSession.submission_id = sub.id;
    saveDocument("chat_sessions", chatSession.id, chatSession);
  }
  saveDocument("submissions", sub.id, sub);
  const course = findCourse(assignment.course_id);
  if (course) addNotification(course.teacher_id, "C\xF3 b\xE0i n\u1ED9p m\u1EDBi", `${req.user.name} \u0111\xE3 n\u1ED9p "${assignment.title}"${isLate ? " (tr\u1EC5 h\u1EA1n)" : ""}.`, `/course/${course.id}/assignment/${assignment.id}`);
  res.json({
    success: true,
    data: sub,
    message: evalStatus === "failed" ? "N\u1ED9p b\xE0i th\xE0nh c\xF4ng. Ph\u1EA7n ch\u1EA5m qu\xE1 tr\xECnh b\u1EB1ng AI s\u1EBD \u0111\u01B0\u1EE3c gi\u1EA3ng vi\xEAn ch\u1EA1y l\u1EA1i sau." : "N\u1ED9p b\xE0i th\xE0nh c\xF4ng!"
  });
});
app.get("/api/courses/:id/stats", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "M\xF4n h\u1ECDc kh\xF4ng t\u1ED3n t\u1EA1i.");
  if (!isOwner(course, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem th\u1ED1ng k\xEA.");
  const members = db.course_members.filter((m) => m.course_id === course.id);
  const assignments = db.assignments.filter((a) => a.course_id === course.id);
  const subs = db.submissions.filter((s) => assignments.some((a) => a.id === s.assignment_id) && isSubmitted(s) && members.some((m) => m.student_id === s.student_id));
  const totalPossible = members.length * assignments.length;
  const pct = (n) => totalPossible ? Math.round(n / totalPossible * 100) : 0;
  const onTime = subs.filter((s) => s.status === "submitted").length;
  const late = subs.filter((s) => s.status === "late").length;
  const scored = subs.filter((s) => s.process_score_result);
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const distribution = [
    { range: "90-100", label: "Xu\u1EA5t s\u1EAFc", count: 0 },
    { range: "80-89", label: "Gi\u1ECFi", count: 0 },
    { range: "70-79", label: "Kh\xE1", count: 0 },
    { range: "50-69", label: "Trung b\xECnh", count: 0 },
    { range: "<50", label: "Y\u1EBFu / nh\u1EDD AI l\xE0m h\u1ED9", count: 0 }
  ];
  for (const s of scored) {
    const v = s.process_score_result.process_score;
    distribution[v >= 90 ? 0 : v >= 80 ? 1 : v >= 70 ? 2 : v >= 50 ? 3 : 4].count++;
  }
  const per_assignment = assignments.map((a) => {
    const aSubs = subs.filter((s) => s.assignment_id === a.id);
    const aScores = aSubs.filter((s) => s.process_score_result).map((s) => s.process_score_result.process_score);
    const avgScore = avg(aScores);
    return {
      assignment_id: a.id,
      title: a.title,
      submitted: aSubs.length,
      total: members.length,
      avg_score: avgScore,
      recommendation: avgScore === null ? "Ch\u01B0a c\xF3 b\xE0i n\u1ED9p n\xE0o \u0111\u01B0\u1EE3c ch\u1EA5m qu\xE1 tr\xECnh." : avgScore < 75 ? "Sinh vi\xEAn c\xF3 xu h\u01B0\u1EDBng xin \u0111\xE1p \xE1n tr\u1EF1c ti\u1EBFp. C\xE2n nh\u1EAFc chuy\u1EC3n sang ch\u1EBF \u0111\u1ED9 Socratic v\xE0 b\u1ED5 sung y\xEAu c\u1EA7u ph\u1EA3n bi\u1EC7n tr\u01B0\u1EDDng h\u1EE3p bi\xEAn." : "\u0110\u1EC1 b\xE0i k\xEDch th\xEDch t\u01B0 duy t\u1ED1t, sinh vi\xEAn t\u01B0\u01A1ng t\xE1c ch\u1EE7 \u0111\u1ED9ng."
    };
  }).sort((a, b) => (a.avg_score ?? 999) - (b.avg_score ?? 999));
  const students = members.map((m) => {
    const mine = subs.filter((s) => s.student_id === m.student_id);
    const myScores = mine.filter((s) => s.process_score_result).map((s) => s.process_score_result.process_score);
    const myGrades = mine.filter(gradedState).map((s) => s.grade);
    return {
      student_id: m.student_id,
      student_name: m.student_name,
      student_email: m.student_email,
      student_avatar: m.student_avatar,
      submitted: mine.length,
      total: assignments.length,
      late: mine.filter((s) => s.status === "late").length,
      avg_process_score: avg(myScores),
      avg_grade: myGrades.length ? Math.round(myGrades.reduce((a, b) => a + b, 0) / myGrades.length * 10) / 10 : null,
      needs_attention: myScores.length > 0 && avg(myScores) < 60 || assignments.length > 0 && mine.length < assignments.length / 2
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
      average_process_score: avg(scored.map((s) => s.process_score_result.process_score)),
      evaluated_count: scored.length,
      score_distribution: distribution,
      per_assignment,
      students
    }
  });
});
app.get("/api/overview", (req, res) => {
  const user = req.user;
  const now = Date.now();
  if (user.role === "admin") return res.json({ success: true, data: {} });
  if (user.role === "teacher") {
    const myCourses = db.courses.filter((c) => c.teacher_id === user.id);
    const myAssignments = db.assignments.filter((a) => myCourses.some((c) => c.id === a.course_id));
    const toGrade = db.submissions.filter((s) => isSubmitted(s) && !gradedState(s) && myAssignments.some((a) => a.id === s.assignment_id)).map((s) => {
      const a = myAssignments.find((x) => x.id === s.assignment_id);
      return { submission_id: s.id, assignment_id: a.id, course_id: a.course_id, assignment_title: a.title, student_name: s.student_name, submitted_at: s.submitted_at, process_score: s.process_score_result?.process_score };
    }).sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()).slice(0, 8);
    const students = new Set(db.course_members.filter((m) => myCourses.some((c) => c.id === m.course_id)).map((m) => m.student_id));
    const upcoming = myAssignments.filter((a) => new Date(a.due_date).getTime() > now).sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date)).slice(0, 5).map((a) => ({ id: a.id, course_id: a.course_id, title: a.title, due_date: a.due_date, course_name: myCourses.find((c) => c.id === a.course_id)?.name }));
    const recentDue = myAssignments.filter((a) => {
      const t = new Date(a.due_date).getTime();
      return t < now + 7 * 864e5 && t > now - 30 * 864e5;
    }).sort((a, b) => +new Date(b.due_date) - +new Date(a.due_date)).slice(0, 5).map((a) => {
      const subs = db.submissions.filter((s) => s.assignment_id === a.id && isSubmitted(s));
      return {
        id: a.id,
        course_id: a.course_id,
        title: a.title,
        due_date: a.due_date,
        mode: a.submission_mode,
        course_name: myCourses.find((c) => c.id === a.course_id)?.name,
        turned_in: subs.length,
        graded: subs.filter(gradedState).length,
        assigned: db.course_members.filter((m) => m.course_id === a.course_id).length
      };
    });
    const insights = [];
    for (const c of myCourses) {
      const members = db.course_members.filter((m) => m.course_id === c.id);
      if (members.length === 0) continue;
      const past = db.assignments.filter((a) => a.course_id === c.id && new Date(a.due_date).getTime() < now).sort((a, b) => +new Date(b.due_date) - +new Date(a.due_date)).slice(0, 2);
      if (past.length === 2) {
        const missed = members.filter((m) => past.every((a) => !db.submissions.some((s) => s.assignment_id === a.id && s.student_id === m.student_id && isSubmitted(s)))).length;
        if (missed > 0) insights.push({ kind: "missed", count: missed, text: `${missed} sinh vi\xEAn ch\u01B0a n\u1ED9p 2 b\xE0i g\u1EA7n nh\u1EA5t`, course: c.name, course_id: c.id });
      }
      const low = members.filter((m) => {
        const sc = db.submissions.filter((s) => s.student_id === m.student_id && s.process_score_result && db.assignments.some((a) => a.id === s.assignment_id && a.course_id === c.id)).map((s) => s.process_score_result.process_score);
        return sc.length > 0 && sc.reduce((a, b) => a + b, 0) / sc.length < 60;
      }).length;
      if (low > 0) insights.push({ kind: "low", count: low, text: `${low} sinh vi\xEAn c\xF3 \u0111i\u1EC3m t\u01B0 duy trung b\xECnh d\u01B0\u1EDBi 60`, course: c.name, course_id: c.id });
      const idle = members.filter((m) => {
        const u = db.users.find((x) => x.id === m.student_id);
        return !u?.last_seen || now - new Date(u.last_seen).getTime() > 7 * 864e5;
      }).length;
      if (idle > 0) insights.push({ kind: "idle", count: idle, text: `${idle} sinh vi\xEAn ch\u01B0a truy c\u1EADp trong 7 ng\xE0y qua`, course: c.name, course_id: c.id });
    }
    return res.json({ success: true, data: { course_count: myCourses.length, student_count: students.size, assignment_count: myAssignments.length, to_grade_count: toGrade.length, to_grade: toGrade, upcoming, recent_due: recentDue, insights: insights.slice(0, 4) } });
  }
  const myCourseIds = db.course_members.filter((m) => m.student_id === user.id).map((m) => m.course_id);
  const mySubs = db.submissions.filter((s) => s.student_id === user.id);
  const withCourse = (a) => ({ id: a.id, course_id: a.course_id, title: a.title, due_date: a.due_date, course_name: findCourse(a.course_id)?.name });
  const pending = db.assignments.filter((a) => myCourseIds.includes(a.course_id) && !mySubs.some((s) => s.assignment_id === a.id && isSubmitted(s)));
  const grades = mySubs.filter(gradedState).map((s) => s.grade);
  const scores = mySubs.filter((s) => s.process_score_result).map((s) => s.process_score_result.process_score);
  const recentGraded = mySubs.filter(gradedState).sort((a, b) => +new Date(b.graded_at) - +new Date(a.graded_at)).slice(0, 5).map((s) => {
    const a = db.assignments.find((x) => x.id === s.assignment_id);
    return { assignment_id: a?.id, course_id: a?.course_id, title: a?.title, grade: s.grade, feedback: s.feedback };
  });
  res.json({
    success: true,
    data: {
      course_count: myCourseIds.length,
      submitted_count: mySubs.filter(isSubmitted).length,
      pending_count: pending.filter((a) => new Date(a.due_date).getTime() > now).length,
      overdue_count: pending.filter((a) => new Date(a.due_date).getTime() <= now).length,
      avg_grade: grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10 : null,
      avg_process_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      upcoming: pending.filter((a) => new Date(a.due_date).getTime() > now).sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date)).slice(0, 5).map(withCourse),
      overdue: pending.filter((a) => new Date(a.due_date).getTime() <= now).slice(0, 5).map(withCourse),
      recent_graded: recentGraded
    }
  });
});
app.get("/api/notifications", (req, res) => {
  const list = db.notifications.filter((n) => n.user_id === req.user.id).slice(0, 30);
  res.json({ success: true, data: list, unread: list.filter((n) => !n.read).length });
});
app.post("/api/notifications/read", (req, res) => {
  for (const n of db.notifications.filter((n2) => n2.user_id === req.user.id && !n2.read)) {
    n.read = true;
    saveDocument("notifications", n.id, n);
  }
  res.json({ success: true });
});
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return fail(res, 403, "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn m\u1EDBi truy c\u1EADp \u0111\u01B0\u1EE3c khu v\u1EF1c n\xE0y.");
  next();
}
app.use("/api/admin", requireAdmin);
var adminUserRow = (u) => {
  const courses = db.courses.filter((c) => c.teacher_id === u.id).length;
  const enrolled = db.course_members.filter((m) => m.student_id === u.id).length;
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, active: u.active !== false, last_seen: u.last_seen, course_count: u.role === "teacher" ? courses : enrolled };
};
app.get("/api/admin/overview", (req, res) => {
  const subs = db.submissions.filter(isSubmitted);
  res.json({
    success: true,
    data: {
      users: { total: db.users.length, admin: db.users.filter((u) => u.role === "admin").length, teacher: db.users.filter((u) => u.role === "teacher").length, student: db.users.filter((u) => u.role === "student").length, inactive: db.users.filter((u) => u.active === false).length },
      courses: db.courses.length,
      assignments: db.assignments.length,
      submissions: subs.length,
      ungraded: subs.filter((s) => !gradedState(s)).length,
      ai_failed: subs.filter((s) => s.eval_status === "failed").length,
      recent_audit: db.audit_logs.slice(0, 6),
      storage: { firestore: !!firestoreDb, supabase: isSupabaseConfigured(), gemini: !!process.env.GEMINI_API_KEY }
    }
  });
});
app.get("/api/admin/users", (req, res) => res.json({ success: true, data: db.users.map(adminUserRow) }));
app.post("/api/admin/users", (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return fail(res, 400, "Vui l\xF2ng nh\u1EADp h\u1ECD t\xEAn, email v\xE0 m\u1EADt kh\u1EA9u.");
  if (!/^\S+@\S+\.\S+$/.test(String(email))) return fail(res, 400, "Email kh\xF4ng h\u1EE3p l\u1EC7.");
  if (String(password).length < 6) return fail(res, 400, "M\u1EADt kh\u1EA9u c\u1EA7n \xEDt nh\u1EA5t 6 k\xFD t\u1EF1.");
  if (!["admin", "teacher", "student"].includes(role)) return fail(res, 400, "Vai tr\xF2 kh\xF4ng h\u1EE3p l\u1EC7.");
  const cleanEmail = String(email).trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) return fail(res, 409, "Email n\xE0y \u0111\xE3 t\u1ED3n t\u1EA1i.");
  const user = { id: uid("u"), name: String(name).trim().slice(0, 80), email: cleanEmail, role, avatar: "", pwd: hashPassword(String(password)), active: true };
  db.users.push(user);
  saveDocument("users", user.id, user);
  audit(req.user, "user.create", user.email, `T\u1EA1o t\xE0i kho\u1EA3n ${role}`);
  res.json({ success: true, data: adminUserRow(user) });
});
app.put("/api/admin/users/:id", (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng.");
  const { role, active, name } = req.body || {};
  const isSelf = u.id === req.user.id;
  const otherAdmins = db.users.filter((x) => x.role === "admin" && x.active !== false && x.id !== u.id).length;
  if (role !== void 0 && role !== u.role) {
    if (!["admin", "teacher", "student"].includes(role)) return fail(res, 400, "Vai tr\xF2 kh\xF4ng h\u1EE3p l\u1EC7.");
    if (isSelf) return fail(res, 400, "B\u1EA1n kh\xF4ng th\u1EC3 t\u1EF1 \u0111\u1ED5i vai tr\xF2 c\u1EE7a ch\xEDnh m\xECnh.");
    if (u.role === "admin" && otherAdmins === 0) return fail(res, 400, "Ph\u1EA3i c\xF2n \xEDt nh\u1EA5t m\u1ED9t qu\u1EA3n tr\u1ECB vi\xEAn.");
    if (u.role === "teacher" && db.courses.some((c) => c.teacher_id === u.id)) return fail(res, 400, "Gi\u1EA3ng vi\xEAn n\xE0y \u0111ang ph\u1EE5 tr\xE1ch m\xF4n h\u1ECDc. H\xE3y chuy\u1EC3n giao m\xF4n h\u1ECDc tr\u01B0\u1EDBc khi \u0111\u1ED5i vai tr\xF2.");
    audit(req.user, "user.role", u.email, `${u.role} \u2192 ${role}`);
    u.role = role;
  }
  if (active !== void 0 && active !== false !== (u.active !== false)) {
    if (isSelf) return fail(res, 400, "B\u1EA1n kh\xF4ng th\u1EC3 t\u1EF1 v\xF4 hi\u1EC7u h\xF3a t\xE0i kho\u1EA3n c\u1EE7a m\xECnh.");
    if (active === false && u.role === "admin" && otherAdmins === 0) return fail(res, 400, "Ph\u1EA3i c\xF2n \xEDt nh\u1EA5t m\u1ED9t qu\u1EA3n tr\u1ECB vi\xEAn ho\u1EA1t \u0111\u1ED9ng.");
    u.active = active !== false;
    audit(req.user, u.active ? "user.enable" : "user.disable", u.email);
  }
  if (name !== void 0 && String(name).trim()) u.name = String(name).trim().slice(0, 80);
  saveDocument("users", u.id, u);
  res.json({ success: true, data: adminUserRow(u) });
});
app.post("/api/admin/users/:id/reset-password", (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng.");
  const temp = crypto.randomBytes(5).toString("hex");
  u.pwd = hashPassword(temp);
  saveDocument("users", u.id, u);
  audit(req.user, "user.reset_password", u.email);
  res.json({ success: true, data: { temp_password: temp }, message: "\u0110\xE3 \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u." });
});
app.delete("/api/admin/users/:id", (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng.");
  if (u.id === req.user.id) return fail(res, 400, "B\u1EA1n kh\xF4ng th\u1EC3 x\xF3a ch\xEDnh m\xECnh.");
  if (u.role === "admin" && db.users.filter((x) => x.role === "admin" && x.id !== u.id).length === 0) return fail(res, 400, "Ph\u1EA3i c\xF2n \xEDt nh\u1EA5t m\u1ED9t qu\u1EA3n tr\u1ECB vi\xEAn.");
  if (u.role === "teacher" && db.courses.some((c) => c.teacher_id === u.id)) return fail(res, 400, "Gi\u1EA3ng vi\xEAn n\xE0y \u0111ang ph\u1EE5 tr\xE1ch m\xF4n h\u1ECDc. H\xE3y chuy\u1EC3n giao m\xF4n h\u1ECDc tr\u01B0\u1EDBc khi x\xF3a.");
  for (const m of db.course_members.filter((m2) => m2.student_id === u.id)) deleteDocument("course_members", `${m.course_id}_${m.student_id}`);
  db.course_members = db.course_members.filter((m) => m.student_id !== u.id);
  for (const sb of db.submissions.filter((x) => x.student_id === u.id)) deleteDocument("submissions", sb.id);
  db.submissions = db.submissions.filter((x) => x.student_id !== u.id);
  for (const cs of db.chat_sessions.filter((x) => x.student_id === u.id)) deleteDocument("chat_sessions", cs.id);
  db.chat_sessions = db.chat_sessions.filter((x) => x.student_id !== u.id);
  db.users = db.users.filter((x) => x.id !== u.id);
  deleteDocument("users", u.id);
  audit(req.user, "user.delete", u.email, `Vai tr\xF2 ${u.role}`);
  res.json({ success: true, message: "\u0110\xE3 x\xF3a ng\u01B0\u1EDDi d\xF9ng v\xE0 d\u1EEF li\u1EC7u li\xEAn quan." });
});
app.get("/api/admin/courses", (req, res) => {
  res.json({
    success: true,
    data: db.courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      semester: c.semester,
      teacher_id: c.teacher_id,
      teacher_name: c.teacher_name,
      invite_code: c.invite_code,
      member_count: db.course_members.filter((m) => m.course_id === c.id).length,
      assignment_count: db.assignments.filter((a) => a.course_id === c.id).length
    }))
  });
});
app.put("/api/admin/courses/:id/teacher", (req, res) => {
  const course = findCourse(req.params.id);
  const teacher = db.users.find((u) => u.id === req.body?.teacher_id && u.role === "teacher" && u.active !== false);
  if (!course) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y m\xF4n h\u1ECDc.");
  if (!teacher) return fail(res, 400, "Gi\u1EA3ng vi\xEAn kh\xF4ng h\u1EE3p l\u1EC7.");
  audit(req.user, "course.transfer", course.name, `${course.teacher_name} \u2192 ${teacher.name}`);
  course.teacher_id = teacher.id;
  course.teacher_name = teacher.name;
  saveDocument("courses", course.id, course);
  addNotification(teacher.id, "B\u1EA1n \u0111\u01B0\u1EE3c giao ph\u1EE5 tr\xE1ch m\xF4n h\u1ECDc", course.name, `/course/${course.id}`);
  res.json({ success: true, data: course });
});
app.delete("/api/admin/courses/:id", (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y m\xF4n h\u1ECDc.");
  audit(req.user, "course.delete", course.name, `M\xE3 ${course.code} (b\u1EDFi qu\u1EA3n tr\u1ECB vi\xEAn)`);
  deleteCourseCascade(course.id);
  res.json({ success: true, message: `\u0110\xE3 x\xF3a m\xF4n h\u1ECDc "${course.name}" v\xE0 c\xE1c d\u1EEF li\u1EC7u li\xEAn quan.` });
});
app.get("/api/admin/settings", (req, res) => res.json({ success: true, data: db.settings }));
app.put("/api/admin/settings", (req, res) => {
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
  audit(req.user, "settings.update", "C\xE0i \u0111\u1EB7t h\u1EC7 th\u1ED1ng", JSON.stringify({ allow_registration: next.allow_registration, teacher_self_register: next.teacher_self_register }));
  res.json({ success: true, data: next, message: "\u0110\xE3 l\u01B0u c\u1EA5u h\xECnh ph\xE2n quy\u1EC1n." });
});
app.get("/api/admin/audit", (req, res) => res.json({ success: true, data: db.audit_logs.slice(0, 200) }));
app.use("/api", (req, res) => fail(res, 404, "API kh\xF4ng t\u1ED3n t\u1EA1i."));
var isServerlessInitialized = false;
app.use(async (req, res, next) => {
  if (process.env.VERCEL && !isServerlessInitialized) {
    isServerlessInitialized = true;
    try {
      await initFirestore();
    } catch {
    }
  }
  next();
});
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
  const PORT = Number(process.env.PORT) || 3e3;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
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
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
export {
  app,
  server_default as default
};
