import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TraceLogo } from "../components/TraceLogo";
import { ProfileView, type ProfileData } from "../components/ProfileView";

/** The read-only page behind a student's share link. No login. Shows aggregates only (and quotes if the student chose to include them). */
export const PublicProfilePage: React.FC<{ token: string }> = ({ token }) => {
  const [d, setD] = useState<(ProfileData & { name: string; shared_at: string; note: string }) | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api(`/api/public/profile/${encodeURIComponent(token)}`).then(setD).catch((e) => setErr(e.message)); }, [token]);
  return (
    <div className="min-h-screen bg-bg px-5 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <TraceLogo tone="light" className="h-7 w-auto" />
        {err ? <div className="card p-8 text-center"><h1 className="text-xl font-semibold">Không mở được hồ sơ</h1><p className="mt-2 text-ink-2">{err}</p></div> : !d ? <div className="card h-64 animate-pulse" /> : (
          <>
            <div><div className="text-sm text-mute">Hồ sơ tư duy</div><h1 className="text-3xl tracking-tight">{d.name}</h1><p className="text-sm text-mute">Chia sẻ từ {new Date(d.shared_at).toLocaleDateString("vi-VN")}</p></div>
            <div className="card p-6"><ProfileView data={d} /></div>
            <p className="text-xs text-mute">{d.note}</p>
          </>
        )}
      </div>
    </div>
  );
};
