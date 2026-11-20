import React from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { criterionLabel, type CoachNote } from "../lib/coach";

const TONE = {
  good: { box: "bg-green-500/10 border-green-500/30", icon: <CheckCircle2 className="h-4 w-4 text-green-600" />, label: "Làm tốt" },
  weak: { box: "bg-amber-500/10 border-amber-500/30", icon: <Lightbulb className="h-4 w-4 text-amber-600" />, label: "Có thể mạnh hơn" },
  warn: { box: "bg-red-500/10 border-red-500/30", icon: <AlertTriangle className="h-4 w-4 text-red-600" />, label: "Chú ý" },
} as const;

/** The live coach's note under a student turn: one observation, the student's own words as evidence, and one thing to try next. */
export const CoachChip: React.FC<{ coach: CoachNote }> = ({ coach }) => {
  const t = TONE[coach.level];
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`mt-1 max-w-[34rem] rounded-xl border px-3 py-2 text-xs ${t.box}`} data-testid="coach-note">
      <div className="flex items-center gap-1.5 font-semibold text-ink-2">{t.icon}{t.label} · {criterionLabel(coach.criterion)}</div>
      {coach.quote && <p className="mt-1 italic text-ink-2">“{coach.quote}”</p>}
      <p className="mt-1 text-ink-2">{coach.note}</p>
      {coach.tip && <p className="mt-1 font-medium text-ink">→ {coach.tip}</p>}
    </motion.div>
  );
};
