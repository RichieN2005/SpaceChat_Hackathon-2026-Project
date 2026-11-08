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
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Post voting">
      {[1, -1].map((direction) => {
        const up = direction === 1;
        const selected = vote === direction;
        const label = up ? "Upvote" : "Downvote";
        const count = (up ? counts.upvotes : counts.downvotes) ?? 0;
        return <button key={direction} type="button" onClick={() => cast(direction)}
          disabled={pending || status === "loading"}
          aria-label={`${selected ? "Remove " : ""}${label.toLowerCase()}: ${count} ${up ? "upvotes" : "downvotes"}`}
          aria-pressed={selected}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${up
            ? selected ? "border-[#ffac8d] bg-[#783b28] text-[#fff0e7] ring-1 ring-[#ffac8d]" : "border-[#ab6650] bg-[#2b1b18] text-[#ffbc9e] hover:bg-[#4a2b22]"
            : selected ? "border-[#a6cdff] bg-[#254d79] text-[#eef7ff] ring-1 ring-[#a6cdff]" : "border-[#5b7fab] bg-[#172438] text-[#b9d8ff] hover:bg-[#253d5a]"}`}>
          <Icon name={up ? "up" : "down"} size={19} />
          <span>{label}</span>
          <span aria-live="polite" className="min-w-6 rounded bg-black/25 px-1.5 py-0.5 text-center font-mono text-sm tabular-nums">{count}</span>
          {selected && <span className="sr-only">Selected</span>}
        </button>;
      })}
    </div>
    {error && <p role="alert" className="mt-2 max-w-sm text-xs text-[#ffbba8]">{error}</p>}
  </div>;
}
