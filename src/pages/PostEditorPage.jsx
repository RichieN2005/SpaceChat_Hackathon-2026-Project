import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import ForumLayout, { BluePlanet, LoadError, LoadingCards, primaryButton, secondaryButton } from "../components/forum/ForumLayout";
import { useAuth } from "../components/auth/AuthProvider";
import { forumApi } from "../lib/forum";

const fieldClass = "mt-2 w-full rounded-lg border border-white/15 bg-[#0d1019] px-4 py-3 text-base text-starlight placeholder:text-[#7d879c] disabled:opacity-60";

export default function PostEditorPage() {
  const { postId } = useParams();
  const [params] = useSearchParams();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [community, setCommunity] = useState(params.get("community") || "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const pendingRef = useRef(false);
  const errorRef = useRef(null);
  const editing = Boolean(postId);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError("");
    document.title = `${editing ? "Edit" : "New"} transmission — SpaceChat`;
    window.scrollTo({ top: 0, behavior: "instant" });
    Promise.all([forumApi.communities(controller.signal), editing ? forumApi.post(postId, controller.signal) : null]).then(([groups, post]) => {
      if (controller.signal.aborted) return;
      setCommunities(groups);
      if (post) {
        if (post.author_id !== user.id) throw new Error("Only the author can edit this transmission.");
        setTitle(post.title); setBody(post.body); setCommunity(String(post.subreddit_id));
      }
    }).catch((failure) => { if (!controller.signal.aborted) setLoadError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [postId, retry, user.id]);
  async function submit(event) {
    event.preventDefault();
    if (pendingRef.current) return;
    const problem = !community ? "Choose a community for your transmission." : !title.trim() ? "Give your transmission a title." : !body.trim() ? "Add a message to your transmission." : "";
    if (problem) { setError(problem); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    pendingRef.current = true; setPending(true); setError("");
    try {
      const fields = { title: title.trim(), body: body.trim(), subreddit_id: Number(community) };
      const post = editing ? await forumApi.updatePost(postId, { title: fields.title, body: fields.body }) : await forumApi.createPost(fields);
      navigate(`/posts/${post.id}`, { replace: true, state: { notice: editing ? "Transmission updated." : "Transmission sent. Welcome to the conversation." } });
    } catch (failure) {
      setError(failure.message); requestAnimationFrame(() => errorRef.current?.focus());
      if (failure.status === 401) { await refresh(); navigate("/login", { state: { returnTo: editing ? `/posts/${postId}/edit` : `/submit${community ? `?community=${community}` : ""}` } }); }
    }
    finally { pendingRef.current = false; setPending(false); }
  }
  return <ForumLayout><div className="mx-auto max-w-3xl">
    <Link to={editing ? `/posts/${postId}` : "/"} className="mb-6 inline-block py-2 text-sm text-[#b5c3da] hover:text-white">← Back to {editing ? "the transmission" : "the feed"}</Link>
    <section className="relative isolate overflow-hidden rounded-xl border border-white/12 bg-[#111723] p-6 sm:p-9">
      <BluePlanet className="absolute -top-20 -right-24 -z-1 w-64 opacity-20" />
      <p className="font-mono text-xs tracking-widest text-[#9fb8d8]">YOUR FREQUENCY / YOUR PERSPECTIVE</p>
      <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{editing ? "Refine your transmission." : "Send a signal."}</h1>
      <p className="mt-4 text-sm leading-relaxed text-[#b4bfd2]">A big question, a small discovery, or something worth sharing. There’s space for it here.</p>
      {loading ? <div className="mt-7"><LoadingCards count={1} /></div> : loadError ? <div className="mt-7"><LoadError message={loadError} onRetry={() => setRetry((value) => value + 1)} /></div> : <form onSubmit={submit} className="mt-8 space-y-6" aria-busy={pending}>
        <label className="block text-sm font-medium" htmlFor="post-community">Community<select id="post-community" required value={community} disabled={pending || editing} onChange={(event) => setCommunity(event.target.value)} className={fieldClass}><option value="">Choose your orbit</option>{communities.map((item) => <option key={item.id} value={item.id}>s/{item.name}</option>)}</select></label>
        {!communities.length && <p className="text-sm text-[#e7b5a6]">No communities are available yet.</p>}
        <label className="block text-sm font-medium" htmlFor="post-title">Title<input id="post-title" required maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} disabled={pending} placeholder="What’s on your radar?" className={fieldClass} /><span className="mt-1 block text-right text-xs font-normal text-[#919db3]">{title.length}/300</span></label>
        <label className="block text-sm font-medium" htmlFor="post-body">Your message<textarea id="post-body" required rows={9} maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} disabled={pending} placeholder="Share your corner of the universe…" className={`${fieldClass} resize-y`} /><span className="mt-1 block text-right text-xs font-normal text-[#919db3]">{body.length.toLocaleString()}/20,000</span></label>
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-signal/30 bg-signal/8 p-4 text-sm text-[#ffbdab] outline-none">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3"><Link to={editing ? `/posts/${postId}` : "/"} className={secondaryButton}>Cancel</Link><button type="submit" disabled={pending || !communities.length} className={primaryButton}>{pending ? "Sending…" : editing ? "Save changes" : "Publish transmission"}</button></div>
      </form>}
    </section>
  </div></ForumLayout>;
}
