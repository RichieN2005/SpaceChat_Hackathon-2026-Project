import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import ForumLayout, { BluePlanet, LoadError, LoadingCards, primaryButton, secondaryButton } from "../components/forum/ForumLayout";
import { PostMeta } from "../components/forum/PostCard";
import { useAuth } from "../components/auth/AuthProvider";
import { Icon } from "../components/landing/visuals";
import { authorName, commentThreads, communityName, forumApi, relativeTime } from "../lib/forum";

function Comments({ comments, loading, error, onRetry }) {
  const ordered = commentThreads(comments);
  return <section id="comments" aria-labelledby="comments-title" className="scroll-mt-44 rounded-xl border border-white/10 bg-[#11131b]/95 p-5 sm:scroll-mt-28 sm:p-7">
    <div className="mb-6 flex items-center justify-between gap-3"><h2 id="comments-title" className="text-xl font-medium">The conversation {!loading && !error && <span className="ml-1 text-sm text-[#929bad]">({comments.length})</span>}</h2><span className="text-xs text-[#939bad]">Oldest first</span></div>
    {loading ? <p role="status" className="py-6 text-sm text-[#adb3c4]">Receiving replies…</p> : error ? <LoadError message={error} onRetry={onRetry} /> : !ordered.length ? <p className="py-6 text-sm leading-relaxed text-[#a9afbf]">No replies to this transmission yet.</p> : <div className="space-y-5">{ordered.map(({ comment, depth }) => <article key={comment.id} style={{ marginLeft: `${Math.min(depth, 3) * 14}px` }} className={depth ? "border-l border-[#7193bd]/25 pl-4" : "border-t border-white/8 pt-5 first:border-0 first:pt-0"}><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#a2a9bc]"><span className="font-medium text-[#c4d1e7] [overflow-wrap:anywhere]">{authorName(comment)}</span><span aria-hidden="true">·</span><time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString()}>{relativeTime(comment.created_at)}</time>{depth > 0 && <span className="text-[#8996ac]">· Reply</span>}</div><p className="mt-2.5 text-sm leading-[1.9] whitespace-pre-wrap text-[#c5c8d4] [overflow-wrap:anywhere]">{comment.body}</p></article>)}</div>}
  </section>;
}

export default function PostPage() {
  const { postId } = useParams();
  const { status } = useAuth();
  const heading = useRef(null);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState("");
  const [retry, setRetry] = useState(0);
  const [commentsRetry, setCommentsRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setPost(null);
    window.scrollTo({ top: 0, behavior: "instant" });
    forumApi.post(postId, controller.signal).then((item) => { if (!controller.signal.aborted) setPost(item); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [postId, retry]);
  useEffect(() => {
    const controller = new AbortController();
    setComments([]); setCommentsLoading(true); setCommentsError("");
    forumApi.comments(postId, controller.signal).then((items) => { if (!controller.signal.aborted) setComments(items); })
      .catch((failure) => { if (!controller.signal.aborted) setCommentsError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setCommentsLoading(false); });
    return () => controller.abort();
  }, [postId, commentsRetry, retry]);
  useEffect(() => {
    document.title = post ? `${post.title} — SpaceChat` : "Transmission — SpaceChat";
    if (post) {
      if (window.location.hash === "#comments") document.getElementById("comments")?.scrollIntoView({ behavior: "instant" });
      else heading.current?.focus({ preventScroll: true });
    }
  }, [post]);
  const returnTo = `/posts/${postId}#comments`;
  return <ForumLayout>
    <Link to="/" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-[#aebbd0] hover:text-white"><Icon name="arrow" size={17} className="rotate-180" />Back to the feed</Link>
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_270px]">
      <div className="min-w-0 space-y-5">
        {loading ? <LoadingCards count={1} /> : error ? <LoadError title={error.status === 404 ? "This signal is out of range." : undefined} message={error.status === 404 ? "This post may have been removed, or the link may be incorrect. Explore the feed to find another conversation." : error.message} onRetry={error.status === 404 ? undefined : () => setRetry((current) => current + 1)} /> : post && <>
          <article className="rounded-xl border border-white/12 bg-[#11131b]/95 p-5 sm:p-7"><PostMeta post={post} /><h1 ref={heading} tabIndex={-1} className="mt-5 text-[28px] leading-[1.25] font-medium tracking-[-.65px] outline-none [overflow-wrap:anywhere] sm:text-[36px]">{post.title}</h1><p className="mt-6 text-base leading-[1.95] whitespace-pre-wrap text-[#ccd0dc] [overflow-wrap:anywhere]">{post.body}</p><div className="mt-7 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-[#98a6bc]"><Icon name="chat" size={18} />{Number.isInteger(post.comment_count) ? `${post.comment_count} ${post.comment_count === 1 ? "reply" : "replies"}` : "Public discussion"}<span className="ml-auto font-mono text-[11px]">SIGNAL #{post.id}</span></div></article>
          <Comments comments={comments} loading={commentsLoading} error={commentsError} onRetry={() => setCommentsRetry((current) => current + 1)} />
          {status !== "authenticated" && status !== "loading" && <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-[#7e94b8]/20 bg-[#151d2c]/85 p-5 sm:p-6"><div><h2 className="text-lg font-medium">Find your people out here.</h2><p className="mt-1 text-sm text-[#aeb8cb]">Make a callsign. Make yourself at home.</p></div><div className="flex flex-wrap gap-3"><Link className={secondaryButton} to="/login" state={{ returnTo }}>Log in</Link><Link className={primaryButton} to="/signup" state={{ returnTo }}>Join the crew <Icon name="diagonal" size={16} /></Link></div></div>}
        </>}
      </div>
      <aside className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-[#111a2b] p-6 lg:sticky lg:top-28"><BluePlanet className="relative -mt-5 -mb-8 mx-auto w-48 opacity-80" /><p className="relative font-mono text-[11px] tracking-[1.4px] text-[#9bb9d9]">A SHARED ORBIT</p><h2 className="relative mt-3 text-xl font-medium [overflow-wrap:anywhere]">{post ? communityName(post) : "Across the cosmos"}</h2><p className="relative mt-4 text-sm leading-[1.85] text-[#aebbd0]">A good conversation can start anywhere. Bring your curiosity. Leave room for someone else’s perspective.</p>{post && <Link to={`/?community=${post.subreddit_id}`} className={`${secondaryButton} relative mt-6 w-full`}>Explore this community <Icon name="arrow" size={16} /></Link>}</aside>
    </div>
  </ForumLayout>;
}
