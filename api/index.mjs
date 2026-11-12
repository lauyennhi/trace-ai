// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";

// src/lib/l2.ts
var L2_ERROR_TYPES = ["language", "logic", "hallucination"];
var DEFAULT_L2_DIMENSIONS = [
  {
    key: "prompt_quality",
    name: "Ch\u1EA5t l\u01B0\u1EE3ng prompt",
    description: "Prompt n\xEAu r\xF5 m\u1EE5c ti\xEAu, ng\u01B0\u1EDDi \u0111\u1ECDc, ng\u1EEF c\u1EA3nh v\xE0 r\xE0ng bu\u1ED9c (\u0111\u1ED9 d\xE0i, gi\u1ECDng v\u0103n, c\u1EA5u tr\xFAc). Ch\u1EA5m theo \xFD \u0111\u1ECBnh, kh\xF4ng tr\u1EEB \u0111i\u1EC3m v\xEC ng\u1EEF ph\xE1p hay tr\xECnh \u0111\u1ED9 ngo\u1EA1i ng\u1EEF. C\u0103n c\u1EE9: nh\u1EADt k\xFD prompt.",
    levels: [
      "Prompt m\u01A1 h\u1ED3 ho\u1EB7c ch\u1EC9 ra l\u1EC7nh chung chung (\u201Cvi\u1EBFt gi\xFAp t\xF4i\u201D), kh\xF4ng n\xEAu m\u1EE5c ti\xEAu hay ng\u01B0\u1EDDi \u0111\u1ECDc.",
      "C\xF3 n\xEAu ch\u1EE7 \u0111\u1EC1 nh\u01B0ng thi\u1EBFu ng\u01B0\u1EDDi \u0111\u1ECDc ho\u1EB7c r\xE0ng bu\u1ED9c; AI ph\u1EA3i \u0111o\xE1n nhi\u1EC1u.",
      "N\xEAu \u0111\u01B0\u1EE3c m\u1EE5c ti\xEAu v\xE0 m\u1ED9t v\xE0i r\xE0ng bu\u1ED9c, c\xF2n thi\u1EBFu ng\u1EEF c\u1EA3nh ho\u1EB7c ti\xEAu ch\xED th\xE0nh c\xF4ng.",
      "N\xEAu r\xF5 m\u1EE5c ti\xEAu, ng\u01B0\u1EDDi \u0111\u1ECDc, \u0111\u1ED9 d\xE0i/gi\u1ECDng v\u0103n; h\u1EA7u h\u1EBFt th\xF4ng tin c\u1EA7n thi\u1EBFt \u0111\u1EC1u c\xF3.",
      "Prompt \u0111\u1EA7y \u0111\u1EE7, c\u1EE5 th\u1EC3 v\xE0 c\xF3 c\u1EA5u tr\xFAc: m\u1EE5c ti\xEAu, ng\u01B0\u1EDDi \u0111\u1ECDc, ng\u1EEF c\u1EA3nh, r\xE0ng bu\u1ED9c, ti\xEAu ch\xED ki\u1EC3m tra k\u1EBFt qu\u1EA3."
    ]
  },
  {
    key: "prompt_iteration",
    name: "C\u1EA3i ti\u1EBFn prompt",
    description: "Sinh vi\xEAn d\xF9ng ph\u1EA3n h\u1ED3i c\u1EE7a AI \u0111\u1EC3 tinh ch\u1EC9nh prompt c\xF3 ch\u1EE7 \u0111\xEDch thay v\xEC h\u1ECFi l\u1EA1i y nguy\xEAn ho\u1EB7c ch\u1EA5p nh\u1EADn k\u1EBFt qu\u1EA3 \u0111\u1EA7u ti\xEAn. C\u0103n c\u1EE9: chu\u1ED7i c\xE1c l\u1EA7n s\u1EEDa prompt v\xE0 prompt cu\u1ED1i.",
    levels: [
      "Ch\u1EC9 h\u1ECFi m\u1ED9t l\u1EA7n ho\u1EB7c l\u1EB7p l\u1EA1i g\u1EA7n nh\u01B0 nguy\xEAn v\u0103n, kh\xF4ng d\xF9ng ph\u1EA3n h\u1ED3i c\u1EE7a AI.",
      "C\xF3 s\u1EEDa prompt nh\u01B0ng thay \u0111\u1ED5i ng\u1EABu nhi\xEAn, kh\xF4ng r\xF5 l\xFD do.",
      "C\xF3 s\u1EEDa theo ph\u1EA3n h\u1ED3i c\u1EE7a AI \u1EDF m\u1ED9t s\u1ED1 l\u1EA7n; ch\u01B0a n\xEAu r\xF5 \u0111i\u1EC1u c\u1EA7n c\u1EA3i thi\u1EC7n.",
      "S\u1EEDa c\xF3 ch\u1EE7 \u0111\xEDch: ch\u1EC9 ra \u0111i\u1EC3m ch\u01B0a \u1ED5n c\u1EE7a k\u1EBFt qu\u1EA3 tr\u01B0\u1EDBc r\u1ED3i th\xEAm y\xEAu c\u1EA7u c\u1EE5 th\u1EC3.",
      "C\u1EA3i ti\u1EBFn l\u1EB7p c\xF3 chi\u1EBFn l\u01B0\u1EE3c: m\u1ED7i l\u1EA7n s\u1EEDa \u0111\u1EC1u b\xE1m v\xE0o m\u1ED9t v\u1EA5n \u0111\u1EC1 c\u1EE5 th\u1EC3 v\xE0 prompt cu\u1ED1i t\u1ED1t h\u01A1n r\xF5 r\u1EC7t."
    ]
  },
  {
    key: "error_detection",
    name: "Ph\xE1t hi\u1EC7n l\u1ED7i",
    description: "B\u1EAFt \u0111\u01B0\u1EE3c c\xE1c l\u1ED7i c\xE0i s\u1EB5n (ng\xF4n ng\u1EEF, logic, \u1EA3o gi\xE1c), \xEDt b\u1ECF s\xF3t v\xE0 \xEDt \u0111\xE1nh d\u1EA5u nh\u1EA7m. C\u0103n c\u1EE9 ch\xEDnh: k\u1EBFt qu\u1EA3 \u0111\u1ED1i chi\u1EBFu t\u1EF1 \u0111\u1ED9ng v\u1EDBi danh s\xE1ch l\u1ED7i c\u1EE7a gi\u1EA3ng vi\xEAn.",
    levels: [
      "B\u1EAFt \u0111\u01B0\u1EE3c r\u1EA5t \xEDt ho\u1EB7c kh\xF4ng b\u1EAFt \u0111\u01B0\u1EE3c l\u1ED7i n\xE0o; \u0111\xE1nh d\u1EA5u nh\u1EA7m nhi\u1EC1u ch\u1ED7.",
      "B\u1EAFt \u0111\u01B0\u1EE3c m\u1ED9t ph\u1EA7n nh\u1ECF c\xE1c l\u1ED7i, b\u1ECF s\xF3t ph\u1EA7n l\u1EDBn.",
      "B\u1EAFt \u0111\u01B0\u1EE3c kho\u1EA3ng m\u1ED9t n\u1EEDa s\u1ED1 l\u1ED7i; c\xF2n b\u1ECF s\xF3t ho\u1EB7c \u0111\xE1nh d\u1EA5u nh\u1EA7m \u0111\xE1ng k\u1EC3.",
      "B\u1EAFt \u0111\u01B0\u1EE3c ph\u1EA7n l\u1EDBn l\u1ED7i, b\u1ECF s\xF3t \xEDt, h\u1EA7u nh\u01B0 kh\xF4ng \u0111\xE1nh d\u1EA5u nh\u1EA7m.",
      "B\u1EAFt \u0111\u01B0\u1EE3c g\u1EA7n nh\u01B0 to\xE0n b\u1ED9 l\u1ED7i, k\u1EC3 c\u1EA3 l\u1ED7i kh\xF3 (\u1EA3o gi\xE1c), g\u1EA7n nh\u01B0 kh\xF4ng \u0111\xE1nh d\u1EA5u nh\u1EA7m."
    ]
  },
  {
    key: "critical_reasoning",
    name: "L\u1EADp lu\u1EADn ph\u1EA3n bi\u1EC7n",
    description: "Ghi ch\xFA gi\u1EA3i th\xEDch \u0111\xFAng v\xEC sao \u0111o\u1EA1n \u0111\xF3 sai: g\u1ECDi \u0111\xFAng lo\u1EA1i l\u1ED7i, n\xEAu l\xFD do, \u0111\u1EC1 xu\u1EA5t c\xE1ch s\u1EEDa ho\u1EB7c c\xE1ch ki\u1EC3m ch\u1EE9ng. C\u0103n c\u1EE9: c\xE1c ghi ch\xFA c\u1EE7a sinh vi\xEAn, \u0111\u1ED1i chi\u1EBFu v\u1EDBi \u0111\xE1p \xE1n c\u1EE7a gi\u1EA3ng vi\xEAn.",
    levels: [
      "Kh\xF4ng ghi ch\xFA ho\u1EB7c ghi ch\xFA tr\u1ED1ng r\u1ED7ng (\u201Csai\u201D, \u201Cl\u1EA1\u201D).",
      "Ghi ch\xFA c\xF3 n\xEAu c\u1EA3m nh\u1EADn nh\u01B0ng kh\xF4ng gi\u1EA3i th\xEDch ho\u1EB7c gi\u1EA3i th\xEDch sai.",
      "Gi\u1EA3i th\xEDch \u0111\xFAng m\u1ED9t ph\u1EA7n; ch\u01B0a g\u1ECDi \u0111\xFAng lo\u1EA1i l\u1ED7i ho\u1EB7c ch\u01B0a n\xEAu c\xE1ch s\u1EEDa.",
      "Gi\u1EA3i th\xEDch \u0111\xFAng l\xFD do v\xE0 g\u1ECDi \u0111\xFAng lo\u1EA1i l\u1ED7i \u1EDF h\u1EA7u h\u1EBFt c\xE1c l\u1ED7i b\u1EAFt \u0111\u01B0\u1EE3c.",
      "Gi\u1EA3i th\xEDch ch\xEDnh x\xE1c, \u0111\u1EC1 xu\u1EA5t c\xE1ch s\u1EEDa ho\u1EB7c c\xE1ch ki\u1EC3m ch\u1EE9ng (\u0111\u1EB7c bi\u1EC7t v\u1EDBi \u1EA3o gi\xE1c) cho c\xE1c l\u1ED7i b\u1EAFt \u0111\u01B0\u1EE3c."
    ]
  },
  {
    key: "revision_ownership",
    name: "Ch\u1EC9nh s\u1EEDa & l\xE0m ch\u1EE7 v\u0103n b\u1EA3n",
    description: "B\u1EA3n s\u1EEDa cu\u1ED1i s\u1EEDa \u0111\xFAng c\xE1c l\u1ED7i \u0111\xE3 ph\xE1t hi\u1EC7n, c\u1EA3i thi\u1EC7n th\u1EF1c ch\u1EA5t v\xE0 ph\xF9 h\u1EE3p ng\u01B0\u1EDDi \u0111\u1ECDc; kh\xF4ng gi\u1EEF nguy\xEAn l\u1ED7i, c\u0169ng kh\xF4ng x\xF3a vi\u1EBFt l\u1EA1i v\xF4 c\u0103n c\u1EE9. C\u0103n c\u1EE9: so s\xE1nh b\u1EA3n cu\u1ED1i v\u1EDBi b\u1EA3n AI g\u1ED1c.",
    levels: [
      "G\u1EA7n nh\u01B0 gi\u1EEF nguy\xEAn v\u0103n b\u1EA3n AI (k\u1EC3 c\u1EA3 l\u1ED7i) ho\u1EB7c x\xF3a \u0111i vi\u1EBFt l\u1EA1i ho\xE0n to\xE0n kh\xF4ng d\u1EF1a tr\xEAn b\u1EA3n g\u1ED1c.",
      "S\u1EEDa \xEDt, nhi\u1EC1u l\u1ED7i v\u1EABn c\xF2n; thay \u0111\u1ED5i ch\u1EE7 y\u1EBFu l\xE0 di\u1EC5n \u0111\u1EA1t l\u1EA1i b\u1EC1 m\u1EB7t.",
      "S\u1EEDa \u0111\u01B0\u1EE3c m\u1ED9t s\u1ED1 l\u1ED7i; c\xF2n l\u1ED7i ho\u1EB7c c\xF3 ch\u1ED7 s\u1EEDa ch\u01B0a \u0111\xFAng.",
      "S\u1EEDa \u0111\xFAng h\u1EA7u h\u1EBFt l\u1ED7i \u0111\xE3 ph\xE1t hi\u1EC7n, v\u0103n b\u1EA3n m\u1EA1ch l\u1EA1c v\xE0 ph\xF9 h\u1EE3p ng\u01B0\u1EDDi \u0111\u1ECDc.",
      "S\u1EEDa \u0111\xFAng v\xE0 c\u1EA3i thi\u1EC7n th\u1EF1c ch\u1EA5t (l\u1EADp lu\u1EADn, b\u1EB1ng ch\u1EE9ng, gi\u1ECDng v\u0103n), gi\u1EEF \u0111\u01B0\u1EE3c c\u1EA5u tr\xFAc h\u1EE3p l\xFD c\u1EE7a b\u1EA3n g\u1ED1c."
    ]
  }
];
var normWs = (s) => s.replace(/\s+/g, " ").trim();
function findPhraseRange(text, phrase) {
  if (!phrase) return null;
  let i = text.indexOf(phrase);
  if (i < 0) i = text.toLowerCase().indexOf(phrase.toLowerCase());
  return i < 0 ? null : { start: i, end: i + phrase.length };
}
var overlapLen = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
function matchErrors(errors, highlights) {
  const hits = [];
  for (const e of errors) {
    for (const h of highlights) {
      const o = overlapLen(e.start, e.end, h.start, h.end);
      if (o > 0 && (o >= 0.4 * (e.end - e.start) || o >= 0.8 * (h.end - h.start))) hits.push({ error: e, highlight: h, overlap: o });
    }
  }
  const caught = errors.map((e) => hits.filter((x) => x.error.id === e.id).sort((a, b) => b.overlap - a.overlap)[0]).filter(Boolean);
  const caughtIds = new Set(caught.map((c) => c.error.id));
  const hitHighlightIds = new Set(hits.map((x) => x.highlight.id));
  const missed = errors.filter((e) => !caughtIds.has(e.id));
  const falsePositives = highlights.filter((h) => !hitHighlightIds.has(h.id));
  return {
    caught,
    missed,
    false_positives: falsePositives,
    recall: errors.length ? caught.length / errors.length : 1,
    precision: highlights.length ? (highlights.length - falsePositives.length) / highlights.length : 0
  };
}
var tokenize = (s) => s.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 1200);
function wordSimilarity(a, b) {
  const x = tokenize(a), y = tokenize(b);
  if (!x.length && !y.length) return 1;
  if (!x.length || !y.length) return 0;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return 2 * prev[y.length] / (x.length + y.length);
}

// server.ts
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// src/lib/supabase-service.ts
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
var clientInstance = null;
function normalizeSupabaseUrl(raw) {
  const v = (raw || "").trim();
  if (!v) return "";
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).origin;
  } catch {
    return v;
  }
}
function getSupabaseClient() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
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
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL) || null;
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

-- C\u1EA5p quy\u1EC1n cho kh\xF3a m\xE1y ch\u1EE7 (service_role). Supabase m\u1EDBi kh\xF4ng c\xF2n t\u1EF1 c\u1EA5p quy\u1EC1n cho b\u1EA3ng t\u1EA1o th\xEAm.
-- C\u1ED1 \xFD KH\xD4NG c\u1EA5p cho anon / authenticated.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.documents TO service_role;
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
    const reason = String(e?.cause?.message || e?.message || e).slice(0, 200);
    console.error("[Supabase] Load failed:", reason);
    return res.status(503).json({ success: false, message: `Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c c\u01A1 s\u1EDF d\u1EEF li\u1EC7u: ${reason}` });
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
app.get("/api/health", async (req, res) => {
  const url = process.env.SUPABASE_URL?.trim() || "";
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  const out = {
    ok: true,
    supabase: {
      configured: isSupabaseConfigured(),
      url_host: url ? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
      key_type: !key ? null : key.startsWith("sb_secret_") ? "secret (\u0111\xFAng)" : key.startsWith("sb_publishable_") ? "publishable (SAI - c\u1EA7n secret)" : key.startsWith("eyJ") ? "legacy JWT (service_role ho\u1EB7c anon)" : "kh\xF4ng nh\u1EADn d\u1EA1ng \u0111\u01B0\u1EE3c",
      using_service_role_env: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      loaded: supabaseLoaded,
      error: null
    },
    gemini_configured: !!process.env.GEMINI_API_KEY,
    auth_secret_configured: !!process.env.AUTH_SECRET
  };
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { error } = await sb.from("documents").select("id").limit(1);
      if (error) out.supabase.error = error.message;
    } catch (e) {
      out.supabase.error = String(e?.cause?.message || e?.message || e);
    }
  }
  res.json(out);
});
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
    const out = { ...publicAssignment(a, req.user) };
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
function sanitizeL2(raw) {
  const ai_text = String(raw?.ai_text ?? "").replace(/\r\n/g, "\n").trimEnd().slice(0, 8e3);
  if (ai_text.trim().length < 20) return { error: "V\u0103n b\u1EA3n AI qu\xE1 ng\u1EAFn (t\u1ED1i thi\u1EC3u 20 k\xFD t\u1EF1)." };
  const rawErrors = Array.isArray(raw?.errors) ? raw.errors.slice(0, 25) : [];
  const errors = [];
  for (const e of rawErrors) {
    const phrase = String(e?.text ?? "").trim();
    if (!phrase) continue;
    const range = findPhraseRange(ai_text, phrase);
    if (!range) return { error: `Kh\xF4ng t\xECm th\u1EA5y \u0111o\u1EA1n l\u1ED7i \u201C${phrase.slice(0, 40)}\u201D trong v\u0103n b\u1EA3n AI. H\xE3y ch\u1ECDn l\u1EA1i \u0111o\u1EA1n l\u1ED7i t\u1EEB ch\xEDnh v\u0103n b\u1EA3n.` };
    if (errors.some((x) => range.start < x.end && range.end > x.start)) return { error: `\u0110o\u1EA1n l\u1ED7i \u201C${phrase.slice(0, 40)}\u201D b\u1ECB ch\u1ED3ng l\xEAn m\u1ED9t l\u1ED7i kh\xE1c.` };
    errors.push({
      id: typeof e?.id === "string" && e.id ? e.id : uid("err"),
      type: L2_ERROR_TYPES.includes(e?.type) ? e.type : "language",
      text: ai_text.slice(range.start, range.end),
      answer: String(e?.answer ?? "").trim().slice(0, 1e3),
      start: range.start,
      end: range.end
    });
  }
  if (errors.length === 0) return { error: "C\u1EA7n \u0111\xE1nh d\u1EA5u \xEDt nh\u1EA5t m\u1ED9t l\u1ED7i c\xE0i s\u1EB5n trong v\u0103n b\u1EA3n AI." };
  errors.sort((a, b) => a.start - b.start);
  const rawDims = Array.isArray(raw?.dimensions) ? raw.dimensions : [];
  const dimensions = DEFAULT_L2_DIMENSIONS.map((d) => {
    const r = rawDims.find((x) => x?.key === d.key);
    const levels = Array.isArray(r?.levels) && r.levels.length === 5 ? r.levels.map((l, i) => String(l ?? "").trim().slice(0, 400) || d.levels[i]) : d.levels;
    return { key: d.key, name: String(r?.name ?? "").trim().slice(0, 80) || d.name, description: String(r?.description ?? "").trim().slice(0, 600) || d.description, levels };
  });
  return { l2: { ai_text, errors, dimensions, prompt_language: raw?.prompt_language === "bilingual" ? "bilingual" : "en" } };
}
function publicAssignment(a, user) {
  if (a?.l2 && user?.role === "student") return { ...a, l2: { ...a.l2, errors: [] } };
  return a;
}
function sanitizeAssignmentInput(body) {
  const { title, description, rubric, due_date, attachments, submission_mode, ai_submode, allow_late } = body || {};
  return {
    title: typeof title === "string" ? title.trim() : title,
    description: description ?? "",
    rubric: rubric ?? "",
    due_date,
    attachments: Array.isArray(attachments) ? attachments : [],
    submission_mode: ["file_only", "ai_chat_only", "both", "writing_l2"].includes(submission_mode) ? submission_mode : "both",
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
  if (input.submission_mode === "writing_l2") {
    const r = sanitizeL2(req.body?.l2);
    if (r.error) return fail(res, 400, r.error);
    input.l2 = r.l2;
    input.ai_submode = "socratic";
  }
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
  const hasWork = db.submissions.some((x) => x.assignment_id === a.id && (x.l2_work || isSubmitted(x)));
  if (input.submission_mode !== a.submission_mode && hasWork) return fail(res, 409, "\u0110\xE3 c\xF3 sinh vi\xEAn l\xE0m b\xE0i n\xEAn kh\xF4ng th\u1EC3 \u0111\u1ED5i h\xECnh th\u1EE9c b\xE0i t\u1EADp.");
  if (input.submission_mode === "writing_l2") {
    const r = sanitizeL2(req.body?.l2 ?? a.l2);
    if (r.error) return fail(res, 400, r.error);
    if (hasWork && a.l2 && r.l2.ai_text !== a.l2.ai_text) return fail(res, 409, "\u0110\xE3 c\xF3 sinh vi\xEAn l\xE0m b\xE0i n\xEAn kh\xF4ng th\u1EC3 \u0111\u1ED5i v\u0103n b\u1EA3n AI.");
    input.l2 = r.l2;
    input.ai_submode = "socratic";
  } else {
    input.l2 = void 0;
  }
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
  const extra = {};
  if (req.user.role === "student" && assignment.l2 && submission && isSubmitted(submission)) extra.l2_feedback = studentL2Feedback(assignment, submission);
  res.json({ success: true, data: { assignment: publicAssignment(assignment, req.user), course_name: course.name, submission, chat_session: chatSession, ...extra } });
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
  res.json({ success: true, data: { submission: sub, assignment: publicAssignment(assignment, req.user), chat_session: chatSession } });
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
  if (assignment?.l2 && sub.l2_work) {
    try {
      sub.l2_report = computeL2Report(assignment, sub);
      sub.l2_result = await evaluateL2(assignment, sub, chat, sub.l2_report);
      sub.eval_status = "ok";
      sub.eval_error = void 0;
      saveDocument("submissions", sub.id, sub);
      return res.json({ success: true, data: sub, message: "\u0110\xE3 ch\u1EA5m l\u1EA1i b\u1EB1ng AI." });
    } catch (e) {
      sub.eval_status = "failed";
      sub.eval_error = e.message;
      saveDocument("submissions", sub.id, sub);
      return fail(res, 502, "AI ch\u01B0a ch\u1EA5m \u0111\u01B0\u1EE3c: " + e.message);
    }
  }
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
var l2Lang = (a) => a.l2?.prompt_language === "bilingual" ? "Reply in the language the student used (English or Vietnamese)." : "Reply in English only. If the student writes in another language, still answer in English and remind them to write prompts in English.";
function l2ChatInstruction(assignment, course, phase) {
  if (phase === "prompt") {
    return `You are an AI writing assistant in a second-language (L2) writing course (${course?.name || "course"}). The student must complete this writing task: """${assignment.description}""".
In this step you may ONLY help with planning: brainstorm ideas and give a short bullet-point OUTLINE (at most 6 bullets, phrases not sentences).
NEVER write full sentences or paragraphs of the final text, even if asked; say that in this step you can only help with an outline.
If the request is vague, ask ONE short clarifying question about the goal, the reader or the constraints.
${l2Lang(assignment)}`;
  }
  return `You are a Socratic tutor. The student is critically reading the following AI-generated text to find hidden problems (language errors, logical errors, invented facts).
TEXT: """${assignment.l2.ai_text}"""
Rules: NEVER say which word, sentence or claim is wrong, never list errors, and never confirm or deny that a specific phrase is an error. Ask one or two short guiding questions and suggest strategies (check articles and agreement, check connectors and logic, verify numbers, names and sources). Keep answers brief.
${l2Lang(assignment)}`;
}
function studentL2Feedback(assignment, sub) {
  const errors = assignment.l2?.errors || [];
  const rep = sub.l2_report;
  if (!rep) return null;
  const byId = new Map(errors.map((e) => [e.id, e]));
  const afterDeadline = Date.now() > new Date(assignment.due_date).getTime();
  return {
    total: rep.total,
    caught: rep.caught.map((c) => {
      const e = byId.get(c.error_id);
      return { type: e?.type, text: e?.text, answer: e?.answer, note: c.note };
    }),
    missed_count: rep.missed.length,
    missed: afterDeadline ? rep.missed.map((id) => {
      const e = byId.get(id);
      return { type: e?.type, text: e?.text, answer: e?.answer };
    }) : [],
    false_positive_count: rep.false_positives.length,
    recall: rep.recall,
    precision: rep.precision
  };
}
function computeL2Report(assignment, sub) {
  const l2 = assignment.l2;
  const work = sub.l2_work;
  const m = matchErrors(l2.errors, work.highlights || []);
  const finalText = work.revision?.text || "";
  const normFinal = normWs(finalText).toLowerCase();
  const sim = wordSimilarity(l2.ai_text, finalText);
  const snaps = (work.revision?.snapshots || []).slice(-40);
  for (const sn of snaps) sn.sim = Math.round(wordSimilarity(l2.ai_text, sn.text) * 100) / 100;
  return {
    total: l2.errors.length,
    caught: m.caught.map((c) => ({ error_id: c.error.id, highlight_id: c.highlight.id, note: c.highlight.note })),
    missed: m.missed.map((e) => e.id),
    false_positives: m.false_positives.map((h) => h.id),
    recall: Math.round(m.recall * 100) / 100,
    precision: Math.round(m.precision * 100) / 100,
    remained: l2.errors.filter((e) => normFinal.includes(normWs(e.text).toLowerCase())).map((e) => e.id),
    similarity_to_original: Math.round(sim * 100) / 100,
    timeline: snaps.map((sn) => ({ t: sn.t, sim: sn.sim ?? 0 })),
    rewritten_from_scratch: sim < 0.35
  };
}
async function evaluateL2(assignment, sub, chat, report) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Ch\u01B0a c\u1EA5u h\xECnh GEMINI_API_KEY tr\xEAn m\xE1y ch\u1EE7.");
  const l2 = assignment.l2;
  const work = sub.l2_work;
  const msgs = chat?.messages || [];
  const transcript = (phase) => msgs.filter((m) => m.phase === phase).map((m) => `${m.role === "user" ? "STUDENT" : "AI"}: ${m.content}`).join("\n").slice(-12e3);
  const errById = new Map(l2.errors.map((e) => [e.id, e]));
  const evidence = {
    writing_task: assignment.description,
    prompt_language_policy: l2.prompt_language === "en" ? "English only" : "English or Vietnamese allowed",
    prompt_history: (work.prompt_history || []).map((p) => p.text),
    final_prompt: work.final_prompt,
    prompt_phase_chat: transcript("prompt"),
    ai_text: l2.ai_text,
    planted_errors: l2.errors.map((e) => ({ id: e.id, type: e.type, text: e.text, teacher_answer: e.answer })),
    student_highlights: (work.highlights || []).map((h) => ({ id: h.id, text: h.text, note: h.note })),
    critique_phase_chat: transcript("critique"),
    automatic_matching: {
      caught: report.caught.map((c) => ({ error_id: c.error_id, error_text: errById.get(c.error_id)?.text, student_note: c.note })),
      missed_error_ids: report.missed,
      false_positive_highlight_ids: report.false_positives,
      recall: report.recall,
      precision: report.precision
    },
    final_text: work.revision?.text,
    similarity_to_original_0_to_1: report.similarity_to_original,
    planted_errors_still_in_final_text: report.remained,
    rewritten_from_scratch: report.rewritten_from_scratch
  };
  const rubric = l2.dimensions.map((d, i) => `${i + 1}. ${d.key} \u2014 ${d.name}: ${d.description}
` + d.levels.map((lv, k) => `   ${k + 1} = ${lv}`).join("\n")).join("\n");
  const instruction = `B\u1EA1n ch\u1EA5m m\u1ED9t b\xE0i "Vi\u1EBFt L2" (vi\u1EBFt b\u1EB1ng ngo\u1EA1i ng\u1EEF c\xF3 AI h\u1ED7 tr\u1EE3) theo 5 chi\u1EC1u, thang 1-5, \u0111\xFAng theo b\u1EA3ng ti\xEAu ch\xED d\u01B0\u1EDBi \u0111\xE2y. H\xE3y nghi\xEAm kh\u1EAFc v\xE0 trung th\u1EF1c, ch\u1EC9 d\u1EF1a tr\xEAn b\u1EB1ng ch\u1EE9ng \u0111\u01B0\u1EE3c cung c\u1EA5p.

B\u1EA2NG TI\xCAU CH\xCD:
${rubric}

QUY T\u1EAEC:
- Chi\u1EC1u prompt_quality v\xE0 prompt_iteration ch\u1EC9 ch\u1EA5m t\u1EEB nh\u1EADt k\xFD prompt. \u0110\xE1nh gi\xE1 \xFD \u0111\u1ECBnh, b\u1ED1i c\u1EA3nh, r\xE0ng bu\u1ED9c v\xE0 chi\u1EBFn l\u01B0\u1EE3c; KH\xD4NG tr\u1EEB \u0111i\u1EC3m v\xEC ng\u1EEF ph\xE1p hay tr\xECnh \u0111\u1ED9 ngo\u1EA1i ng\u1EEF.
- Chi\u1EC1u error_detection: d\xF9ng k\u1EBFt qu\u1EA3 \u0111\u1ED1i chi\u1EBFu t\u1EF1 \u0111\u1ED9ng ("automatic_matching") l\xE0m c\u0103n c\u1EE9 ch\xEDnh, kh\xF4ng t\u1EF1 \u0111o\xE1n l\u1EA1i l\u1ED7i n\xE0o \u0111\u01B0\u1EE3c b\u1EAFt. N\u1EBFu recall = 0 th\xEC \u0111i\u1EC3m t\u1ED1i \u0111a l\xE0 2. Precision th\u1EA5p (\u0111\xE1nh d\u1EA5u nh\u1EA7m nhi\u1EC1u) th\xEC h\u1EA1 \u0111i\u1EC3m.
- Chi\u1EC1u critical_reasoning: ch\u1EC9 x\xE9t c\xE1c l\u1ED7i \u0111\xE3 b\u1EAFt; so ghi ch\xFA c\u1EE7a sinh vi\xEAn v\u1EDBi "teacher_answer" (g\u1ECDi \u0111\xFAng lo\u1EA1i l\u1ED7i? gi\u1EA3i th\xEDch \u0111\xFAng? \u0111\u1EC1 xu\u1EA5t c\xE1ch s\u1EEDa/ki\u1EC3m ch\u1EE9ng?). Kh\xF4ng c\xF3 ghi ch\xFA n\xE0o th\xEC \u0111i\u1EC3m 1.
- Chi\u1EC1u revision_ownership: d\u1EF1a tr\xEAn final_text so v\u1EDBi ai_text, "planted_errors_still_in_final_text" v\xE0 "similarity_to_original". L\u1ED7i c\xF2n nguy\xEAn th\xEC h\u1EA1 \u0111i\u1EC3m; rewritten_from_scratch = true th\xEC \u0111i\u1EC3m t\u1ED1i \u0111a l\xE0 2.
- M\u1ED7i chi\u1EC1u: "score" (s\u1ED1 nguy\xEAn 1-5), "comment" (2 c\xE2u ti\u1EBFng Vi\u1EC7t, n\xEAu l\xFD do), "evidence" (1-3 m\u1EE5c: "quote" tr\xEDch NGUY\xCAN V\u0102N t\u1EEB b\u1EB1ng ch\u1EE9ng, "mau" = xanh (\u0111i\u1EC3m m\u1EA1nh) | vang (c\u1EA7n l\xE0m r\xF5) | do (v\u1EA5n \u0111\u1EC1), "ly_do").
- "overall_comment": 2-3 c\xE2u ti\u1EBFng Vi\u1EC7t t\xF3m t\u1EAFt \u0111i\u1EC3m m\u1EA1nh v\xE0 vi\u1EC7c c\u1EA7n c\u1EA3i thi\u1EC7n.
- Ph\u1EA3i tr\u1EA3 \u0111\u1EE7 c\u1EA3 5 chi\u1EC1u v\u1EDBi \u0111\xFAng "key" nh\u01B0 b\u1EA3ng.`;
  const response = await generateWithFallback({
    contents: [{ role: "user", parts: [{ text: `${instruction}

B\u1EB0NG CH\u1EE8NG (JSON):
${JSON.stringify(evidence)}` }] }],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dimensions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                score: { type: Type.INTEGER },
                comment: { type: Type.STRING },
                evidence: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { quote: { type: Type.STRING }, mau: { type: Type.STRING }, ly_do: { type: Type.STRING } }, required: ["quote", "mau", "ly_do"] } }
              },
              required: ["key", "score", "comment", "evidence"]
            }
          },
          overall_comment: { type: Type.STRING }
        },
        required: ["dimensions", "overall_comment"]
      }
    }
  }, 6e4);
  if (!response.text) throw new Error("AI tr\u1EA3 v\u1EC1 n\u1ED9i dung r\u1ED7ng.");
  const parsed = JSON.parse(response.text.trim());
  const dims = DEFAULT_L2_DIMENSIONS.map((d) => {
    const r = (parsed.dimensions || []).find((x) => x?.key === d.key);
    if (!r) throw new Error(`AI kh\xF4ng tr\u1EA3 v\u1EC1 chi\u1EC1u "${d.key}".`);
    return {
      key: d.key,
      score: Math.max(1, Math.min(5, Math.round(Number(r.score) || 1))),
      comment: String(r.comment || ""),
      evidence: (Array.isArray(r.evidence) ? r.evidence : []).slice(0, 3).map((ev) => ({ quote: String(ev?.quote || ""), mau: ["xanh", "vang", "do"].includes(ev?.mau) ? ev.mau : "vang", ly_do: String(ev?.ly_do || "") }))
    };
  });
  const d3 = dims.find((d) => d.key === "error_detection");
  if (report.recall === 0) d3.score = Math.min(d3.score, 2);
  const d5 = dims.find((d) => d.key === "revision_ownership");
  if (report.rewritten_from_scratch) d5.score = Math.min(d5.score, 2);
  return { dimensions: dims, overall_comment: String(parsed.overall_comment || "") };
}
function l2Student(req, res) {
  if (req.user.role !== "student") {
    fail(res, 403, "Ch\u1EC9 sinh vi\xEAn m\u1EDBi l\xE0m b\xE0i n\xE0y.");
    return null;
  }
  if (!can(req.user, "submit")) {
    denied(res);
    return null;
  }
  const assignment = db.assignments.find((a) => a.id === req.params.id);
  if (!assignment || assignment.submission_mode !== "writing_l2" || !assignment.l2) {
    fail(res, 404, "Kh\xF4ng t\xECm th\u1EA5y b\xE0i t\u1EADp Vi\u1EBFt L2.");
    return null;
  }
  if (!isMember(assignment.course_id, req.user)) {
    fail(res, 403, "B\u1EA1n kh\xF4ng thu\u1ED9c m\xF4n h\u1ECDc n\xE0y.");
    return null;
  }
  if (/* @__PURE__ */ new Date() > new Date(assignment.due_date) && assignment.allow_late === false) {
    fail(res, 403, "B\xE0i t\u1EADp \u0111\xE3 kh\xF3a sau h\u1EA1n n\u1ED9p.");
    return null;
  }
  let sub = db.submissions.find((s) => s.assignment_id === assignment.id && s.student_id === req.user.id);
  if (sub && isSubmitted(sub)) {
    fail(res, 409, "B\u1EA1n \u0111\xE3 n\u1ED9p b\xE0i n\xE0y r\u1ED3i.");
    return null;
  }
  if (!sub) {
    sub = { id: uid("sub"), assignment_id: assignment.id, student_id: req.user.id, student_name: req.user.name, student_email: req.user.email, student_avatar: req.user.avatar, submitted_files: [], submitted_text: "", status: "draft" };
    db.submissions.push(sub);
  }
  if (!sub.l2_work) sub.l2_work = { step: 1, highlights: [], revision: { text: "", snapshots: [], stats: { typed: 0, deleted: 0, pasted: 0 } }, step_times: { s1: nowIso() } };
  return { assignment, sub };
}
app.post("/api/l2/:id/lock-prompt", (req, res) => {
  const ctx = l2Student(req, res);
  if (!ctx) return;
  const { assignment, sub } = ctx;
  const work = sub.l2_work;
  if (work.step !== 1) return fail(res, 409, "B\u01B0\u1EDBc 1 \u0111\xE3 \u0111\u01B0\u1EE3c ch\u1ED1t.");
  const finalPrompt = String(req.body?.final_prompt ?? "").trim();
  if (finalPrompt.length < 5) return fail(res, 400, "H\xE3y nh\u1EADp prompt cu\u1ED1i c\xF9ng c\u1EE7a b\u1EA1n (t\u1ED1i thi\u1EC3u 5 k\xFD t\u1EF1).");
  const chat = db.chat_sessions.find((cs) => cs.assignment_id === assignment.id && cs.student_id === req.user.id);
  const prompts = (chat?.messages || []).filter((m) => m.phase === "prompt" && m.role === "user");
  if (prompts.length < 1) return fail(res, 400, "H\xE3y trao \u0111\u1ED5i v\u1EDBi tr\u1EE3 l\xFD AI \xEDt nh\u1EA5t m\u1ED9t l\u1EA7n tr\u01B0\u1EDBc khi ch\u1ED1t prompt.");
  work.final_prompt = finalPrompt.slice(0, 4e3);
  work.prompt_history = prompts.map((m) => ({ text: String(m.content).slice(0, 4e3), at: m.timestamp }));
  work.step = 2;
  work.step_times = { ...work.step_times, s2: nowIso() };
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: sub });
});
app.put("/api/l2/:id/critique", (req, res) => {
  const ctx = l2Student(req, res);
  if (!ctx) return;
  const { assignment, sub } = ctx;
  const work = sub.l2_work;
  if (work.step !== 2) return fail(res, 409, "B\u01B0\u1EDBc ph\u1EA3n bi\u1EC7n ch\u01B0a m\u1EDF ho\u1EB7c \u0111\xE3 \u0111\xF3ng.");
  const text = assignment.l2.ai_text;
  const raw = Array.isArray(req.body?.highlights) ? req.body.highlights.slice(0, 40) : [];
  const out = [];
  for (const h of raw) {
    const start = Number(h?.start), end = Number(h?.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || end <= start) return fail(res, 400, "V\xF9ng \u0111\xE1nh d\u1EA5u kh\xF4ng h\u1EE3p l\u1EC7.");
    out.push({ id: typeof h?.id === "string" && h.id ? h.id : uid("hl"), start, end, text: text.slice(start, end), note: String(h?.note ?? "").trim().slice(0, 500) });
  }
  out.sort((a, b) => a.start - b.start);
  for (let i = 1; i < out.length; i++) if (out[i].start < out[i - 1].end) return fail(res, 400, "Hai v\xF9ng \u0111\xE1nh d\u1EA5u kh\xF4ng \u0111\u01B0\u1EE3c ch\u1ED3ng l\xEAn nhau.");
  work.highlights = out;
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: { highlights: out } });
});
app.post("/api/l2/:id/finish-critique", (req, res) => {
  const ctx = l2Student(req, res);
  if (!ctx) return;
  const { assignment, sub } = ctx;
  const work = sub.l2_work;
  if (work.step !== 2) return fail(res, 409, "B\u01B0\u1EDBc ph\u1EA3n bi\u1EC7n ch\u01B0a m\u1EDF ho\u1EB7c \u0111\xE3 \u0111\xF3ng.");
  if (!work.highlights.length) return fail(res, 400, "H\xE3y \u0111\xE1nh d\u1EA5u \xEDt nh\u1EA5t m\u1ED9t \u0111o\u1EA1n nghi ng\u1EDD tr\u01B0\u1EDBc khi sang b\u01B0\u1EDBc ch\u1EC9nh s\u1EEDa.");
  if (work.highlights.some((h) => !h.note)) return fail(res, 400, "M\u1ED7i \u0111o\u1EA1n \u0111\xE1nh d\u1EA5u c\u1EA7n c\xF3 ghi ch\xFA l\xFD do.");
  work.step = 3;
  work.revision = { text: assignment.l2.ai_text, snapshots: [{ t: nowIso(), text: assignment.l2.ai_text }], stats: { typed: 0, deleted: 0, pasted: 0 } };
  work.step_times = { ...work.step_times, s3: nowIso() };
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: sub });
});
app.put("/api/l2/:id/revision", (req, res) => {
  const ctx = l2Student(req, res);
  if (!ctx) return;
  const { sub } = ctx;
  const work = sub.l2_work;
  if (work.step !== 3) return fail(res, 409, "B\u01B0\u1EDBc ch\u1EC9nh s\u1EEDa ch\u01B0a m\u1EDF.");
  const text = String(req.body?.text ?? "");
  if (text.length > 2e4) return fail(res, 413, "V\u0103n b\u1EA3n qu\xE1 d\xE0i.");
  const snaps = (Array.isArray(req.body?.snapshots) ? req.body.snapshots : []).slice(-60).map((x) => ({ t: String(x?.t || nowIso()), text: String(x?.text ?? "").slice(0, 6e3) }));
  const n = (v) => Math.max(0, Math.min(1e7, Math.floor(Number(v) || 0)));
  work.revision = { text, snapshots: snaps.length ? snaps : work.revision.snapshots, stats: { typed: n(req.body?.stats?.typed), deleted: n(req.body?.stats?.deleted), pasted: n(req.body?.stats?.pasted) } };
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: { saved_at: nowIso() } });
});
async function submitL2(req, res, assignment, sub, isLate) {
  const work = sub?.l2_work;
  if (!sub || !work || work.step !== 3) return fail(res, 400, "B\u1EA1n c\u1EA7n ho\xE0n th\xE0nh c\u1EA3 3 b\u01B0\u1EDBc tr\u01B0\u1EDBc khi n\u1ED9p.");
  if (!work.revision.text.trim()) return fail(res, 400, "B\u1EA3n ch\u1EC9nh s\u1EEDa \u0111ang tr\u1ED1ng.");
  const chat = db.chat_sessions.find((cs) => cs.assignment_id === assignment.id && cs.student_id === req.user.id);
  const report = computeL2Report(assignment, sub);
  let result, evalStatus = "ok", evalError;
  try {
    result = await evaluateL2(assignment, sub, chat, report);
  } catch (e) {
    console.error("L2 evaluation error:", e?.message || e);
    evalStatus = "failed";
    evalError = e?.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh";
  }
  Object.assign(sub, {
    submitted_at: nowIso(),
    submitted_text: work.revision.text,
    submitted_files: [],
    chat_session_id: chat?.id,
    l2_report: report,
    l2_result: result,
    eval_status: evalStatus,
    eval_error: evalError,
    status: isLate ? "late" : "submitted"
  });
  if (chat) {
    chat.submission_id = sub.id;
    saveDocument("chat_sessions", chat.id, chat);
  }
  saveDocument("submissions", sub.id, sub);
  const course = findCourse(assignment.course_id);
  if (course) addNotification(course.teacher_id, "C\xF3 b\xE0i n\u1ED9p m\u1EDBi", `${req.user.name} \u0111\xE3 n\u1ED9p "${assignment.title}"${isLate ? " (tr\u1EC5 h\u1EA1n)" : ""}.`, `/course/${course.id}/assignment/${assignment.id}`);
  res.json({ success: true, data: sub, message: evalStatus === "failed" ? "N\u1ED9p b\xE0i th\xE0nh c\xF4ng. Ph\u1EA7n ch\u1EA5m b\u1EB1ng AI s\u1EBD \u0111\u01B0\u1EE3c gi\u1EA3ng vi\xEAn ch\u1EA1y l\u1EA1i sau." : "N\u1ED9p b\xE0i th\xE0nh c\xF4ng!" });
}
app.put("/api/submissions/:id/l2-scores", (req, res) => {
  const sub = db.submissions.find((s) => s.id === req.params.id);
  if (!sub) return fail(res, 404, "B\xE0i n\u1ED9p kh\xF4ng t\u1ED3n t\u1EA1i.");
  const assignment = db.assignments.find((a) => a.id === sub.assignment_id);
  if (!assignment?.l2 || !isOwner(findCourse(assignment.course_id), req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n ch\u1EA5m b\xE0i n\xE0y.");
  if (!can(req.user, "grade")) return denied(res);
  const scores = {};
  for (const d of DEFAULT_L2_DIMENSIONS) {
    const v = req.body?.scores?.[d.key];
    if (v === void 0 || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) return fail(res, 400, "\u0110i\u1EC3m m\u1ED7i chi\u1EC1u ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn t\u1EEB 1 \u0111\u1EBFn 5.");
    scores[d.key] = n;
  }
  sub.l2_teacher_scores = scores;
  saveDocument("submissions", sub.id, sub);
  res.json({ success: true, data: sub, message: "\u0110\xE3 l\u01B0u \u0111i\u1EC3m t\u1EEBng chi\u1EC1u." });
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
  const phase = req.body?.phase === "critique" ? "critique" : req.body?.phase === "prompt" ? "prompt" : void 0;
  if (!assignment_id || !message_content || typeof message_content !== "string") return fail(res, 400, "Thi\u1EBFu th\xF4ng tin tin nh\u1EAFn.");
  if (message_content.length > 3e4) return fail(res, 413, "Tin nh\u1EAFn qu\xE1 d\xE0i (t\u1ED1i \u0111a 30.000 k\xFD t\u1EF1).");
  const assignment = db.assignments.find((a) => a.id === assignment_id);
  if (!assignment) return fail(res, 404, "B\xE0i t\u1EADp kh\xF4ng t\xECm th\u1EA5y.");
  const course = findCourse(assignment.course_id);
  if (!course || !isMember(course.id, req.user)) return fail(res, 403, "B\u1EA1n kh\xF4ng thu\u1ED9c m\xF4n h\u1ECDc n\xE0y.");
  if (assignment.submission_mode === "file_only") return fail(res, 400, "B\xE0i t\u1EADp n\xE0y ch\u1EC9 n\u1ED9p file, kh\xF4ng c\xF3 AI chat.");
  const existing = db.submissions.find((s) => s.assignment_id === assignment_id && s.student_id === req.user.id);
  if (existing && isSubmitted(existing)) return fail(res, 409, "B\xE0i \u0111\xE3 n\u1ED9p, cu\u1ED9c tr\xF2 chuy\u1EC7n \u0111\xE3 \u0111\u01B0\u1EE3c kh\xF3a.");
  const isL2 = assignment.submission_mode === "writing_l2" && !!assignment.l2;
  if (isL2) {
    if (!phase) return fail(res, 400, "Thi\u1EBFu th\xF4ng tin b\u01B0\u1EDBc l\xE0m b\xE0i.");
    const step = existing?.l2_work?.step ?? 1;
    if (phase === "prompt" && step !== 1 || phase === "critique" && step !== 2) return fail(res, 409, "B\u01B0\u1EDBc n\xE0y ch\u01B0a m\u1EDF ho\u1EB7c \u0111\xE3 \u0111\u01B0\u1EE3c ch\u1ED1t.");
  }
  if (chatRateLimited(req.user.id)) return fail(res, 429, "B\u1EA1n g\u1EEDi qu\xE1 nhanh, vui l\xF2ng \u0111\u1EE3i v\xE0i ph\xFAt r\u1ED3i th\u1EED l\u1EA1i.");
  let chatSession = db.chat_sessions.find((cs) => cs.assignment_id === assignment_id && cs.student_id === req.user.id);
  if (!chatSession) {
    chatSession = { id: uid("cs"), assignment_id, student_id: req.user.id, messages: [] };
    db.chat_sessions.push(chatSession);
  }
  const userMsg = { id: uid("m"), role: "user", content: message_content, timestamp: nowIso() };
  if (isL2) userMsg.phase = phase;
  chatSession.messages.push(userMsg);
  const systemInstruction = isL2 ? l2ChatInstruction(assignment, course, phase) : assignment.ai_submode === "socratic" ? `B\u1EA1n l\xE0 tr\u1EE3 l\xFD h\u1ECDc t\u1EADp AI trong m\xF4n ${course.name}, h\u1ED7 tr\u1EE3 sinh vi\xEAn l\xE0m b\xE0i t\u1EADp: ${assignment.title}. M\xF4 t\u1EA3 b\xE0i t\u1EADp: ${assignment.description}.
Khi sinh vi\xEAn h\u1ECFi, \u0111\u1EEBng \u0111\u01B0a \u0111\xE1p \xE1n ngay. \u0110\u1EB7t 1-2 c\xE2u h\u1ECFi g\u1EE3i m\u1EDF \u0111\u1EC3 sinh vi\xEAn t\u1EF1 suy ngh\u0129 tr\u01B0\u1EDBc. Ch\u1EC9 \u0111\u01B0a \u0111\xE1p \xE1n/h\u01B0\u1EDBng d\u1EABn chi ti\u1EBFt sau khi sinh vi\xEAn \u0111\xE3 th\u1EED tr\u1EA3 l\u1EDDi. N\u1EBFu sinh vi\xEAn y\xEAu c\u1EA7u \u0111\xE1p \xE1n ngay, nh\u1EAFc nh\u1EB9 nh\xE0ng v\u1EC1 l\u1EE3i \xEDch t\u1EF1 t\u01B0 duy tr\u01B0\u1EDBc, sau \u0111\xF3 v\u1EABn h\u1ED7 tr\u1EE3 n\u1EBFu h\u1ECD th\u1EF1c s\u1EF1 c\u1EA7n.
Tr\u1EA3 l\u1EDDi b\u1EB1ng ti\u1EBFng Vi\u1EC7t th\xE2n thi\u1EC7n, r\xF5 r\xE0ng, mang t\xEDnh gi\xE1o d\u1EE5c.` : `B\u1EA1n l\xE0 tr\u1EE3 l\xFD h\u1ECDc t\u1EADp AI nhi\u1EC7t t\xECnh trong m\xF4n ${course.name}, h\u1ED7 tr\u1EE3 sinh vi\xEAn l\xE0m b\xE0i t\u1EADp: ${assignment.title}.
Gi\u1EA3i \u0111\xE1p th\u1EAFc m\u1EAFc, g\u1EE3i \xFD h\u01B0\u1EDBng gi\u1EA3i quy\u1EBFt v\xE0 cung c\u1EA5p t\xE0i li\u1EC7u tham kh\u1EA3o ch\xEDnh x\xE1c. Tr\u1EA3 l\u1EDDi b\u1EB1ng ti\u1EBFng Vi\u1EC7t chuy\xEAn nghi\u1EC7p, ng\u1EAFn g\u1ECDn.`;
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Ch\u01B0a c\u1EA5u h\xECnh GEMINI_API_KEY tr\xEAn m\xE1y ch\u1EE7.");
    const response = await generateWithFallback({
      contents: chatSession.messages.filter((m) => !isL2 || m.phase === phase).map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
      config: { systemInstruction, temperature: 0.7 }
    });
    const replyText = response.text;
    if (!replyText) throw new Error("AI tr\u1EA3 v\u1EC1 n\u1ED9i dung r\u1ED7ng.");
    const aiMsg = { id: uid("m"), role: "model", content: replyText, timestamp: nowIso() };
    if (isL2) aiMsg.phase = phase;
    chatSession.messages.push(aiMsg);
    saveDocument("chat_sessions", chatSession.id, chatSession);
    res.json({ success: true, data: { chat_session: chatSession, new_message: aiMsg } });
  } catch (err) {
    console.error("Gemini Chat Error:", err?.message || err);
    chatSession.messages = chatSession.messages.filter((m) => m.id !== userMsg.id);
    fail(res, 502, "Tr\u1EE3 l\xFD AI t\u1EA1m th\u1EDDi kh\xF4ng ph\u1EA3n h\u1ED3i \u0111\u01B0\u1EE3c. Tin nh\u1EAFn ch\u01B0a \u0111\u01B0\u1EE3c ghi nh\u1EADn, h\xE3y th\u1EED g\u1EEDi l\u1EA1i.");
  }
});
function l2DimScores(sub) {
  return DEFAULT_L2_DIMENSIONS.map((d) => sub.l2_teacher_scores?.[d.key] ?? sub.l2_result?.dimensions?.find((x) => x.key === d.key)?.score ?? 0);
}
function l2ClassStats(assignments, subs) {
  const l2Assignments = assignments.filter((a) => a.submission_mode === "writing_l2" && a.l2);
  if (l2Assignments.length === 0) return void 0;
  const scored = subs.filter((s) => s.l2_result && l2Assignments.some((a) => a.id === s.assignment_id));
  const dimensions = DEFAULT_L2_DIMENSIONS.map((d, i) => {
    const vals = scored.map((s) => l2DimScores(s)[i]).filter((v) => v > 0);
    const distribution = [1, 2, 3, 4, 5].map((n) => vals.filter((v) => v === n).length);
    return { key: d.key, name: d.name, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null, distribution };
  });
  const missed_errors = [];
  for (const a of l2Assignments) {
    const done = subs.filter((s) => s.assignment_id === a.id && s.l2_report);
    if (!done.length) continue;
    for (const e of a.l2.errors) {
      const missed = done.filter((s) => s.l2_report.missed.includes(e.id)).length;
      if (missed > 0) missed_errors.push({ assignment_title: a.title, type: e.type, text: e.text, missed, total: done.length });
    }
  }
  missed_errors.sort((x, y) => y.missed / y.total - x.missed / x.total);
  return { assignments: l2Assignments.length, evaluated: scored.length, dimensions, missed_errors: missed_errors.slice(0, 10) };
}
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
  if (assignment.submission_mode === "writing_l2" && assignment.l2) return submitL2(req, res, assignment, sub, isLate);
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
    const isL2a = a.submission_mode === "writing_l2";
    const aScores = isL2a ? aSubs.filter((s) => s.l2_result).map((s) => l2DimScores(s).reduce((x, y) => x + y, 0) / 5 * 20) : aSubs.filter((s) => s.process_score_result).map((s) => s.process_score_result.process_score);
    const avgScore = avg(aScores);
    return {
      assignment_id: a.id,
      title: a.title,
      submitted: aSubs.length,
      total: members.length,
      avg_score: avgScore,
      recommendation: isL2a ? avgScore === null ? "Ch\u01B0a c\xF3 b\xE0i Vi\u1EBFt L2 n\xE0o \u0111\u01B0\u1EE3c ch\u1EA5m." : "Xem ph\xE2n t\xEDch theo t\u1EEBng chi\u1EC1u v\xE0 c\xE1c l\u1ED7i c\u1EA3 l\u1EDBp hay b\u1ECF s\xF3t \u1EDF ph\u1EA7n Vi\u1EBFt L2 b\xEAn d\u01B0\u1EDBi." : avgScore === null ? "Ch\u01B0a c\xF3 b\xE0i n\u1ED9p n\xE0o \u0111\u01B0\u1EE3c ch\u1EA5m qu\xE1 tr\xECnh." : avgScore < 75 ? "Sinh vi\xEAn c\xF3 xu h\u01B0\u1EDBng xin \u0111\xE1p \xE1n tr\u1EF1c ti\u1EBFp. C\xE2n nh\u1EAFc chuy\u1EC3n sang ch\u1EBF \u0111\u1ED9 Socratic v\xE0 b\u1ED5 sung y\xEAu c\u1EA7u ph\u1EA3n bi\u1EC7n tr\u01B0\u1EDDng h\u1EE3p bi\xEAn." : "\u0110\u1EC1 b\xE0i k\xEDch th\xEDch t\u01B0 duy t\u1ED1t, sinh vi\xEAn t\u01B0\u01A1ng t\xE1c ch\u1EE7 \u0111\u1ED9ng."
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
      students,
      l2: l2ClassStats(assignments, subs)
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
