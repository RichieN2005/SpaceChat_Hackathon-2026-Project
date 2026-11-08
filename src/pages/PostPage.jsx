import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import ForumLayout, { BluePlanet, LoadError, LoadingCards, secondaryButton } from "../components/forum/ForumLayout";
import { PostMeta } from "../components/forum/PostCard";
import VoteButtons from "../components/forum/VoteButtons";
import Discussion from "../components/forum/Discussion";
import { useAuth } from "../components/auth/AuthProvider";
import { Icon } from "../components/landing/visuals";
import { communityName, forumApi } from "../lib/forum";

export default function PostPage() {
  const { postId } = useParams();
  const { user, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef(null);
  const pendingRef = useRef(false);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setPost(null); setConfirmDelete(false); setDeleteError("");
    window.scrollTo({ top: 0, behavior: "instant" });
    forumApi.post(postId, controller.signal).then((item) => { if (!controller.signal.aborted) setPost(item); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [postId, retry, user?.id]);
  useEffect(() => {
    document.title = post ? `${post.title} — SpaceChat` : "Transmission — SpaceChat";
    if (post) {
      if (window.location.hash === "#comments") document.getElementById("comments")?.scrollIntoView({ behavior: "instant" });
      else heading.current?.focus({ preventScroll: true });
    }
  }, [post?.id, post?.title]);
  async function remove() {
    if (pendingRef.current) return;
    pendingRef.current = true; setDeleting(true); setDeleteError("");
    try { await forumApi.deletePost(postId); navigate("/home", { replace: true }); }
    catch (failure) {
      setDeleteError(failure.message);
      if (failure.status === 401) { await refresh(); navigate("/login", { state: { returnTo: `/posts/${postId}` } }); }
    } finally { pendingRef.current = false; setDeleting(false); }
  }
  return <ForumLayout>
    <Link to="/home" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-[#aebbd0] hover:text-white"><Icon name="arrow" size={17} className="rotate-180" />Back to the feed</Link>
    {location.state?.notice && <p role="status" className="mb-5 rounded-lg border border-[#7ea8a1]/30 bg-[#233a34]/35 p-4 text-sm text-[#bfe6d6]">{location.state.notice}</p>}
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_270px]">
      <div className="min-w-0 space-y-5">
        {loading ? <LoadingCards count={1} /> : error ? <LoadError title={error.status === 404 ? "This signal is out of range." : undefined} message={error.status === 404 ? "This post may have been removed, or the link may be incorrect. Explore the feed to find another conversation." : error.message} onRetry={error.status === 404 ? undefined : () => setRetry((current) => current + 1)} /> : post && <>
          <article className="rounded-xl border border-white/12 bg-[#11131b]/95 p-5 sm:p-7">
            <PostMeta post={post} />
            <h1 ref={heading} tabIndex={-1} className="mt-5 text-[28px] leading-[1.25] font-medium tracking-[-.65px] outline-none [overflow-wrap:anywhere] sm:text-[36px]">{post.title}</h1>
            <p className="mt-6 text-base leading-[1.95] whitespace-pre-wrap text-[#ccd0dc] [overflow-wrap:anywhere]">{post.body}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4 text-xs text-[#98a6bc]">
              <VoteButtons post={post} /><a href="#comments" className="inline-flex min-h-10 items-center gap-2 hover:text-white"><Icon name="chat" size={18} />{post.comment_count ?? 0} replies</a>
              {user?.id === post.author_id && <div className="ml-auto flex flex-wrap items-center gap-2"><Link to={`/posts/${post.id}/edit`} className={secondaryButton}>Edit post</Link><button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 rounded-lg px-3 text-sm text-[#efab9b] hover:bg-signal/8">Delete post</button></div>}
            </div>
            {confirmDelete && <div role="group" aria-label="Confirm post deletion" className="mt-5 rounded-lg border border-signal/30 bg-signal/5 p-4"><h2 className="text-lg font-medium">Delete this transmission?</h2><p className="mt-2 text-sm leading-relaxed text-[#d0b2aa]">This permanently removes your post and its discussion.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className={secondaryButton}>Keep post</button><button type="button" onClick={remove} disabled={deleting} className="min-h-11 rounded-lg bg-[#b64032] px-4 text-sm font-semibold text-white disabled:opacity-50">{deleting ? "Deleting…" : "Delete permanently"}</button></div>{deleteError && <p role="alert" className="mt-3 text-sm text-[#ffc2b2]">{deleteError}</p>}</div>}
          </article>
          <Discussion postId={postId} onCountChange={(count) => setPost((current) => current ? { ...current, comment_count: count } : current)} />
        </>}
      </div>
      <aside className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-[#111a2b] p-6 lg:sticky lg:top-28"><BluePlanet className="relative -mt-5 -mb-8 mx-auto w-48 opacity-80" /><p className="relative font-mono text-[11px] tracking-[1.4px] text-[#9bb9d9]">A SHARED ORBIT</p><h2 className="relative mt-3 text-xl font-medium [overflow-wrap:anywhere]">{post ? communityName(post) : "Across the cosmos"}</h2><p className="relative mt-4 text-sm leading-[1.85] text-[#aebbd0]">A good conversation can start anywhere. Bring your curiosity. Leave room for someone else’s perspective.</p>{post && <Link to={`/communities/${post.subreddit_id}`} className={`${secondaryButton} relative mt-6 w-full`}>Explore this community <Icon name="arrow" size={16} /></Link>}</aside>
    </div>
  </ForumLayout>;
}
