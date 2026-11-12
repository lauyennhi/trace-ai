import { useEffect, useState, useCallback } from "react";

/** Tiny hash router so the browser Back button and F5 keep the user where they were. */
export function useHashRoute() {
  const read = () => (window.location.hash.replace(/^#/, "") || "/");
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const navigate = useCallback((to: string) => { window.location.hash = to; }, []);
  return { path, navigate };
}

export type Route =
  | { name: "home" }
  | { name: "course"; courseId: string; tab?: string }
  | { name: "assignment"; courseId: string; assignmentId: string }
  | { name: "submission"; courseId: string; assignmentId: string; submissionId: string };

export function parseRoute(path: string): Route {
  const [clean] = path.split("?");
  const p = clean.split("/").filter(Boolean);
  if (p[0] === "course" && p[1]) {
    if (p[2] === "assignment" && p[3]) {
      if (p[4] === "submission" && p[5]) return { name: "submission", courseId: p[1], assignmentId: p[3], submissionId: p[5] };
      return { name: "assignment", courseId: p[1], assignmentId: p[3] };
    }
    return { name: "course", courseId: p[1], tab: p[2] };
  }
  return { name: "home" };
}
