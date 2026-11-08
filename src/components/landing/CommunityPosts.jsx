import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { authorName, forumApi, relativeTime } from "../../lib/forum";
import VoteButtons from "../forum/VoteButtons";
import { Icon } from "./visuals";

export default function CommunityPosts({ communityId, sort }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    forumApi.posts({ community: communityId, sort: sort === "newest" ? "new" : sort, limit: 3 }, controller.signal)
      .then((rows) => { if (!controller.signal.aborted) setPosts(rows); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [communityId, sort, retry]);

  if (loading) return <p role="status" className="border-t border-white/10 py-6 text-sm text-[#aaa0a6]">Receiving transmissions...</p>;
  if (error) return <div role="alert" className="border-t border-white/10 py-5 text-sm text-[#c5a9a0]"><p>{error}</p><button type="button" className="mt-2 min-h-9 underline underline-offset-4" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>;
  if (!posts.length) return <p className="border-t border-white/10 py-6 text-sm text-[#aaa0a6]">No transmissions yet. Start the first conversation.</p>;
  return <div>{posts.map((post) => <article key={post.id} className="cursor-pointer border-t border-[#292629] py-5" onClick={(event) => {
    if (!event.target.closest("a, button, input, select, textarea, [data-selectable]") && !window.getSelection()?.toString()) navigate(`/posts/${post.id}`);
  }}>
    <p className="mb-2 font-mono text-[11px] text-[#a395a0]">{authorName(post)} <span aria-hidden="true">/</span> {relativeTime(post.created_at)}</p>
    <h4 className="text-[16px] font-medium leading-relaxed text-[#ddd3d8]"><Link className="hover:text-white" to={`/posts/${post.id}`}>{post.title}</Link></h4>
    <p data-selectable className="mt-2 line-clamp-2 cursor-text select-text whitespace-pre-line text-sm leading-relaxed text-[#a69aa1]">{post.body}</p>
    <div className="mt-3 flex flex-wrap items-center gap-3"><VoteButtons post={post} /><Link to={`/posts/${post.id}#comments`} className="inline-flex min-h-9 items-center gap-1.5 text-xs text-[#a99ba3] hover:text-starlight"><Icon name="chat" size={14} />{post.comment_count ?? 0} replies</Link></div>
  </article>)}</div>;
}
