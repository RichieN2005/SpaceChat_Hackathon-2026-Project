import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Icon } from "../landing/visuals";
import { forumApi } from "../../lib/forum";

export default function VoteButtons({ post }) {
  const { status, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [score, setScore] = useState(post.score ?? 0);
  const [vote, setVote] = useState(post.user_vote ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);
  useEffect(() => { setScore(post.score ?? 0); setVote(status === "authenticated" ? post.user_vote ?? 0 : 0); }, [post.id, post.score, post.user_vote, status]);
  async function cast(direction) {
    if (pendingRef.current || status === "loading") return;
    if (status !== "authenticated") {
      navigate("/login", { state: { returnTo: location.pathname + location.search + location.hash } });
      return;
    }
    pendingRef.current = true; setPending(true); setError("");
    try {
      const result = await forumApi.vote(post.id, vote === direction ? 0 : direction);
      setScore(result.score); setVote(result.user_vote);
    } catch (failure) {
      setError(failure.message);
      if (failure.status === 401) { await refresh(); navigate("/login", { state: { returnTo: location.pathname + location.search } }); }
    } finally { pendingRef.current = false; setPending(false); }
  }
  return <div>
    <div className="inline-flex min-h-10 items-center rounded-md border border-white/10 bg-white/4" aria-label="Post voting">
      <button type="button" onClick={() => cast(1)} disabled={pending || status === "loading"} aria-label={vote === 1 ? "Remove upvote" : "Upvote post"} aria-pressed={vote === 1} className={`grid size-10 place-items-center rounded-l-md hover:bg-white/8 disabled:opacity-50 ${vote === 1 ? "text-signal" : "text-[#bcc3d2]"}`}><Icon name="up" size={18} /></button>
      <span aria-live="polite" aria-label={`Score: ${score}`} className="min-w-6 text-center font-mono text-xs">{score}</span>
      <button type="button" onClick={() => cast(-1)} disabled={pending || status === "loading"} aria-label={vote === -1 ? "Remove downvote" : "Downvote post"} aria-pressed={vote === -1} className={`grid size-10 place-items-center rounded-r-md hover:bg-white/8 disabled:opacity-50 ${vote === -1 ? "text-[#92bbfa]" : "text-[#bcc3d2]"}`}><Icon name="up" size={18} className="rotate-180" /></button>
    </div>
    {error && <p role="alert" className="mt-2 max-w-sm text-xs text-[#ffbba8]">{error}</p>}
  </div>;
}
