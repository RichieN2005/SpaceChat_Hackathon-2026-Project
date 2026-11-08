import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Icon } from "../landing/visuals";
import { forumApi } from "../../lib/forum";

export default function VoteButtons({ post }) {
  const { status, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ upvotes: post.upvotes ?? 0, downvotes: post.downvotes ?? 0 });
  const [vote, setVote] = useState(post.user_vote ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);
  useEffect(() => { setCounts({ upvotes: post.upvotes ?? 0, downvotes: post.downvotes ?? 0 }); setVote(status === "authenticated" ? post.user_vote ?? 0 : 0); }, [post.id, post.upvotes, post.downvotes, post.user_vote, status]);
  async function cast(direction) {
    if (pendingRef.current || status === "loading") return;
    if (status !== "authenticated") {
      navigate("/login", { state: { returnTo: location.pathname + location.search + location.hash } });
      return;
    }
    pendingRef.current = true; setPending(true); setError("");
    try {
      const result = await forumApi.vote(post.id, vote === direction ? 0 : direction);
      setCounts({ upvotes: result.upvotes, downvotes: result.downvotes }); setVote(result.user_vote);
    } catch (failure) {
      setError(failure.message);
      if (failure.status === 401) { await refresh(); navigate("/login", { state: { returnTo: location.pathname + location.search } }); }
    } finally { pendingRef.current = false; setPending(false); }
  }
  return <div>
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Post voting">
      {[1, -1].map((direction) => {
        const up = direction === 1;
        const selected = vote === direction;
        const label = up ? "Upvote" : "Downvote";
        const count = (up ? counts.upvotes : counts.downvotes) ?? 0;
        return <button key={direction} type="button" onClick={() => cast(direction)}
          disabled={pending || status === "loading"}
          aria-label={`${selected ? "Remove " : ""}${label.toLowerCase()}: ${count} ${up ? "upvotes" : "downvotes"}`}
          aria-pressed={selected}
          title={selected ? `Remove ${label.toLowerCase()}` : label}
          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${selected
            ? up ? "border-signal/35 bg-signal/10 text-[#ffb49f]" : "border-[#92bbfa]/35 bg-[#92bbfa]/10 text-[#b7d4ff]"
            : "border-white/10 bg-white/4 text-[#b5bdcd] hover:border-white/20 hover:bg-white/8 hover:text-starlight"}`}>
          <Icon name={up ? "up" : "down"} size={15} />
          <span>{label}</span>
          <span aria-live="polite" className="min-w-3 text-center font-mono text-[11px] tabular-nums">{count}</span>
          {selected && <span className="sr-only">Selected</span>}
        </button>;
      })}
    </div>
    {error && <p role="alert" className="mt-2 max-w-sm text-xs text-[#ffbba8]">{error}</p>}
  </div>;
}
