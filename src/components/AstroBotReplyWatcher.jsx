import { useEffect, useRef } from "react";

// Refresh the current discussion in place, preserving the dialog and drafts.
export default function AstroBotReplyWatcher({ postId, onBotReply }) {
  const refreshRef = useRef(onBotReply);
  refreshRef.current = onBotReply;
  useEffect(() => {
    if (!postId) return;
    const controller = new AbortController();
    let baseline = null;
    let busy = false;
    let active = true;
    let interval;
    const load = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const response = await fetch(`/api/posts/${postId}/comments`, { signal: controller.signal, credentials: "same-origin" });
        if (!response.ok) return;
        const comments = await response.json();
        const current = new Set(comments.filter((comment) => comment.is_bot).map((comment) => comment.id));
        if (!active) return;
        const changed = baseline !== null && [...current].some((id) => !baseline.has(id));
        baseline = current;
        if (changed) await refreshRef.current?.();
      } catch { /* A later poll can recover from a temporary connection error. */ }
      finally { busy = false; }
    };
    load();
    interval = window.setInterval(load, 4000);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 60000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); window.clearTimeout(timeout); };
  }, [postId]);
  return null;
}
