import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../components/auth/AuthProvider";
import ForumLayout, { BluePlanet, LoadError, LoadingCards, primaryButton, secondaryButton } from "../components/forum/ForumLayout";
import PostCard from "../components/forum/PostCard";
import { Icon } from "../components/landing/visuals";
import { forumApi } from "../lib/forum";

const PAGE_SIZE = 20;

function ProfilePosts({ userId, username }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [request, setRequest] = useState({ offset: 0, retry: 0 });
  const pending = useRef(true);
  useEffect(() => {
    const controller = new AbortController();
    pending.current = true;
    setLoading(true); setError("");
    forumApi.posts({ author: userId, limit: PAGE_SIZE + 1, offset: request.offset }, controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        const page = rows.slice(0, PAGE_SIZE);
        setPosts((previous) => request.offset === 0 ? page : [...previous, ...page.filter((post) => !previous.some((item) => item.id === post.id))]);
        setHasMore(rows.length > PAGE_SIZE);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); pending.current = false; } });
    return () => controller.abort();
  }, [userId, request]);

  return <section aria-labelledby="profile-posts" className="mt-8">
    <h2 id="profile-posts" className="mb-5 text-2xl font-medium tracking-[-.6px] [overflow-wrap:anywhere]">Transmissions from u/{username}</h2>
    {loading && !posts.length ? <LoadingCards /> : error && !posts.length ? <LoadError message={error} onRetry={() => setRequest((current) => ({ ...current, retry: current.retry + 1 }))} /> : !posts.length ? <div className="rounded-xl border border-dashed border-white/15 bg-[#11131b]/90 p-9 text-center"><Icon name="orbit" size={35} className="mx-auto text-[#9db5d2]" /><h3 className="mt-4 text-lg font-medium">A quiet frequency, for now.</h3><p className="mt-3 text-sm text-[#aeb5c7]">This traveler hasn’t published any posts yet.</p></div> : <>
      <div className="space-y-4">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
      {error && <div className="mt-4"><LoadError message={error} onRetry={() => setRequest((current) => ({ ...current, retry: current.retry + 1 }))} /></div>}
      {!error && hasMore && <button type="button" disabled={loading} className={`${secondaryButton} mt-5 w-full`} onClick={() => {
        if (pending.current) return;
        pending.current = true;
        setRequest((current) => ({ offset: current.offset + PAGE_SIZE, retry: 0 }));
      }}>{loading ? "Receiving transmissions…" : "Load more posts"}{!loading && <Icon name="down" size={17} />}</button>}
    </>}
  </section>;
}

function ProfileContent({ userId }) {
  const { status, user, refresh } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const heading = useRef(null);
  const bioField = useRef(null);
  const savingRef = useRef(false);
  const ownProfile = status === "authenticated" && user?.id === profile?.id;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    forumApi.user(userId, controller.signal)
      .then((item) => { if (!controller.signal.aborted) { setProfile(item); setBio(item.bio || ""); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, retry]);
  useEffect(() => {
    document.title = profile ? `u/${profile.username} — SpaceChat` : "Traveler profile — SpaceChat";
  }, [profile?.username]);
  useEffect(() => { if (profile) heading.current?.focus({ preventScroll: true }); }, [profile?.id]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [userId]);
  useEffect(() => { if (editing) bioField.current?.focus(); }, [editing]);

  async function saveBio(event) {
    event.preventDefault();
    if (savingRef.current || !ownProfile) return;
    if (bio.length > 2000) { setSaveError("Keep your bio to 2,000 characters or fewer."); return; }
    savingRef.current = true;
    setSaving(true); setSaveError(""); setNotice("");
    try {
      const updated = await forumApi.updateUser(userId, { bio: bio.trim() });
      setProfile(updated); setBio(updated.bio || ""); setEditing(false);
      setNotice("Your bio has been updated.");
    } catch (failure) {
      if (failure.status === 401) {
        await refresh();
        navigate("/login", { state: { returnTo: `/users/${userId}` } });
      } else setSaveError(failure.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const joinedDate = profile && Date.parse(profile.created_at);
  return <ForumLayout>
    <Link to="/" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-[#aebbd0] hover:text-white"><Icon name="arrow" size={17} className="rotate-180" />Back to the feed</Link>
    {loading ? <LoadingCards count={1} /> : error ? <LoadError title={error.status === 404 ? "This traveler is off the radar." : undefined} message={error.status === 404 ? "This profile may no longer exist, or the link may be incorrect." : error.message} onRetry={error.status === 404 ? undefined : () => setRetry((value) => value + 1)} /> : profile && <>
      <section className="relative isolate overflow-hidden rounded-xl border border-[#7289b5]/20 bg-[#111a2b] p-6 sm:p-9">
        <BluePlanet className="absolute -right-16 -bottom-32 -z-1 w-80 opacity-30 sm:right-2 sm:w-[420px] sm:opacity-55" />
        <div className="flex flex-wrap items-start justify-between gap-5"><div className="flex min-w-0 items-center gap-4"><span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full border border-[#a9c6e6]/30 bg-[#223650] text-[28px] font-medium text-[#d6e7fc] shadow-[0_0_35px_#619be515] sm:size-20 sm:text-[34px]">{Array.from(profile.username || "?")[0].toUpperCase()}</span><div className="min-w-0"><p className="font-mono text-[11px] tracking-[1.3px] text-[#9bb8d9]">A FELLOW SPACE TRAVELER</p><h1 ref={heading} tabIndex={-1} className="mt-2 text-[clamp(25px,4vw,40px)] leading-tight font-medium tracking-[-.8px] outline-none [overflow-wrap:anywhere]">u/{profile.username}</h1></div></div>{ownProfile && !editing && <button type="button" onClick={() => { setEditing(true); setBio(profile.bio || ""); setSaveError(""); setNotice(""); }} className={secondaryButton}>Edit bio <Icon name="diagonal" size={16} /></button>}</div>
        {Number.isFinite(joinedDate) && <p className="mt-5 text-xs text-[#a7bad2]">Joined <time dateTime={profile.created_at}>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(joinedDate)}</time></p>}
        {editing && ownProfile ? <form onSubmit={saveBio} className="mt-6 max-w-2xl" aria-busy={saving}>
          <label htmlFor="profile-bio" className="mb-3 block text-sm font-medium text-[#d5e0f0]">Tell the universe a little about yourself</label>
          <textarea ref={bioField} id="profile-bio" rows={5} maxLength={2000} value={bio} onChange={(event) => { setBio(event.target.value); setSaveError(""); }} disabled={saving} aria-describedby="profile-bio-hint" className="w-full resize-y rounded-lg border border-white/20 bg-[#101522]/95 p-4 text-base leading-relaxed text-starlight placeholder:text-[#8d98ac] disabled:opacity-60" placeholder="Your interests, your home planet, your next big question…" />
          <p id="profile-bio-hint" className="mt-2 text-xs text-[#a4b1c8]">Your bio is public. {bio.length.toLocaleString()} / 2,000 characters.</p>
          <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className={primaryButton} disabled={saving}>{saving ? "Saving bio…" : "Save bio"}</button><button type="button" className={secondaryButton} disabled={saving} onClick={() => { setEditing(false); setBio(profile.bio || ""); setSaveError(""); }}>Cancel</button></div>
          {saveError && <p role="alert" className="mt-4 rounded-lg border border-signal/30 bg-[#27191b]/90 p-3 text-sm text-[#ffd0c0]">{saveError}</p>}
        </form> : <p className="mt-6 max-w-2xl text-base leading-[1.9] whitespace-pre-wrap text-[#c0cbdc] [overflow-wrap:anywhere]">{profile.bio || (ownProfile ? "Your story is still unwritten. Add a bio to introduce yourself." : "This traveler is keeping a little mystery in their orbit.")}</p>}
        {notice && <p role="status" className="mt-4 text-sm text-[#c3d6ef]">{notice}</p>}
      </section>
      <ProfilePosts key={`${profile.id}:${user?.id || "guest"}`} userId={profile.id} username={profile.username} />
    </>}
  </ForumLayout>;
}

export default function ProfilePage() {
  const { userId } = useParams();
  return <ProfileContent key={userId} userId={userId} />;
}
