import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../components/auth/AuthProvider";
import ForumLayout, { BluePlanet, LoadError, LoadingCards, primaryButton, secondaryButton } from "../components/forum/ForumLayout";
import PostCard from "../components/forum/PostCard";
import { Icon } from "../components/landing/visuals";
import { forumApi } from "../lib/forum";

function CommunityContent({ communityId }) {
  const navigate = useNavigate();
  const { status, user, refresh } = useAuth();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState("");
  const [postsRetry, setPostsRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const [membershipError, setMembershipError] = useState("");
  const [notice, setNotice] = useState("");
  const pendingRef = useRef(false);
  const heading = useRef(null);
  const returnTo = `/communities/${communityId}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setNotice(""); setMembershipError("");
    forumApi.community(communityId, controller.signal)
      .then((item) => { if (!controller.signal.aborted) setCommunity(item); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [communityId, user?.id, retry]);

  useEffect(() => {
    const controller = new AbortController();
    setPostsLoading(true); setPostsError("");
    forumApi.posts({ community: communityId, limit: 6 }, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setPosts(items); })
      .catch((failure) => { if (!controller.signal.aborted) setPostsError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setPostsLoading(false); });
    return () => controller.abort();
  }, [communityId, postsRetry, user?.id]);

  useEffect(() => {
    document.title = community ? `s/${community.name} — SpaceChat` : "Community — SpaceChat";
  }, [community?.name]);
  useEffect(() => {
    if (community) heading.current?.focus({ preventScroll: true });
  }, [community?.id]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [communityId]);

  async function toggleMembership() {
    if (pendingRef.current || !community) return;
    if (status !== "authenticated") {
      navigate("/login", { state: { returnTo } });
      return;
    }
    pendingRef.current = true;
    setPending(true); setMembershipError(""); setNotice("");
    try {
      const result = await forumApi.setMembership(communityId, { joined: !community.is_member });
      setCommunity((current) => ({ ...current, is_member: result.joined, member_count: result.member_count }));
      setNotice(result.joined ? "You’ve joined this orbit." : "You’ve left this community. You can still explore its conversations.");
    } catch (failure) {
      if (failure.status === 401) {
        await refresh();
        navigate("/login", { state: { returnTo } });
      } else setMembershipError(failure.message);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return <ForumLayout>
    <Link to="/communities" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-[#aebbd0] hover:text-white"><Icon name="arrow" size={17} className="rotate-180" />All communities</Link>
    {loading ? <LoadingCards count={1} /> : error ? <LoadError title={error.status === 404 ? "This orbit hasn’t been charted." : undefined} message={error.status === 404 ? "This community may have been removed, or the link may be incorrect." : error.message} onRetry={error.status === 404 ? undefined : () => setRetry((value) => value + 1)} /> : community && <>
      <section className="relative isolate overflow-hidden rounded-xl border border-[#7289b5]/20 bg-[#111a2b] p-6 sm:p-9">
        <BluePlanet className="absolute -right-16 -bottom-32 -z-1 w-80 opacity-35 sm:right-5 sm:w-[420px] sm:opacity-60" />
        <p className="font-mono text-xs tracking-[1.4px] text-[#a0badb]">A SHARED ORBIT</p>
        <h1 ref={heading} tabIndex={-1} className="mt-4 max-w-3xl text-[clamp(30px,4vw,46px)] leading-tight font-medium tracking-[-1px] outline-none [overflow-wrap:anywhere]">s/{community.name}</h1>
        <p className="mt-5 max-w-2xl text-base leading-[1.85] whitespace-pre-wrap text-[#c0cbdc] [overflow-wrap:anywhere]">{community.description || "A little corner of the cosmos. Bring your curiosity, and make yourself at home."}</p>
        <div className="mt-7 flex flex-wrap items-center gap-4"><button type="button" onClick={toggleMembership} disabled={pending || status === "loading"} className={community.is_member ? secondaryButton : primaryButton}>{pending ? "Updating orbit…" : community.is_member ? "Leave community" : "Join community"}{!pending && <Icon name="orbit" size={17} />}</button>{Number.isSafeInteger(community.member_count) && <span className="text-sm text-[#b0bfd5]">{community.member_count.toLocaleString()} {community.member_count === 1 ? "member" : "members"}</span>}{Number.isSafeInteger(community.post_count) && <span className="text-sm text-[#b0bfd5]">{community.post_count.toLocaleString()} {community.post_count === 1 ? "post" : "posts"}</span>}<span className="text-xs text-[#9cacc3]">Public community · Everyone can browse</span></div>
        {membershipError && <p role="alert" className="mt-4 max-w-xl rounded-lg border border-signal/30 bg-[#27191b]/90 p-3 text-sm text-[#ffd0c0]">{membershipError}</p>}
        {notice && <p role="status" className="mt-4 text-sm text-[#c3d6ef]">{notice}</p>}
      </section>
      <section aria-labelledby="community-posts" className="mt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 id="community-posts" className="text-2xl font-medium tracking-[-.6px]">Latest transmissions</h2><Link to={`/?community=${communityId}`} className={secondaryButton}>View all posts <Icon name="arrow" size={16} /></Link></div>
        {postsLoading ? <LoadingCards /> : postsError ? <LoadError message={postsError} onRetry={() => setPostsRetry((value) => value + 1)} /> : !posts.length ? <div className="rounded-xl border border-dashed border-white/15 bg-[#11131b]/90 p-9 text-center"><Icon name="chat" size={32} className="mx-auto text-[#9db5d2]" /><h3 className="mt-4 text-lg font-medium">The first signal is still to come.</h3><p className="mt-3 text-sm text-[#aeb5c7]">This community doesn’t have any public posts yet.</p></div> : <div className="space-y-4">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>}
      </section>
    </>}
  </ForumLayout>;
}

export default function CommunityPage() {
  const { communityId } = useParams();
  return <CommunityContent key={communityId} communityId={communityId} />;
}
