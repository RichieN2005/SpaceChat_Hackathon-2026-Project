import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import ForumLayout, { BluePlanet, LoadError, LoadingCards, secondaryButton } from "../components/forum/ForumLayout";
import PostCard from "../components/forum/PostCard";
import { Icon, MiniPlanet } from "../components/landing/visuals";
import { forumApi } from "../lib/forum";
import { useAuth } from "../components/auth/AuthProvider";

const PAGE_SIZE = 20;

function Feed({ filters }) {
  const [posts, setPosts] = useState([]);
  const [request, setRequest] = useState({ offset: 0, retry: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const pending = useRef(true);
  useEffect(() => {
    const controller = new AbortController();
    pending.current = true;
    setLoading(true); setError("");
    forumApi.posts({ ...filters, offset: request.offset, limit: PAGE_SIZE + 1 }, controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        const page = rows.slice(0, PAGE_SIZE);
        setPosts((previous) => request.offset === 0 ? page : [...previous, ...page.filter((post) => !previous.some((item) => item.id === post.id))]);
        setHasMore(rows.length > PAGE_SIZE);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) { pending.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [request]);
  if (loading && !posts.length) return <LoadingCards />;
  if (error && !posts.length) return <LoadError message={error} onRetry={() => setRequest((current) => ({ ...current, retry: current.retry + 1 }))} />;
  if (!posts.length) return <div className="rounded-xl border border-dashed border-white/15 bg-[#11131b]/80 px-6 py-14 text-center"><Icon name="orbit" size={38} className="mx-auto text-[#95adc9]" /><h2 className="mt-5 text-xl font-medium">{filters.q || filters.community ? "No signals in this orbit." : "It’s quiet out here. For now."}</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#a6a9ba]">{filters.q || filters.community ? "Try a different search or explore the full public feed." : "There aren’t any public posts yet. New conversations will appear here as the community grows."}</p>{(filters.q || filters.community) && <Link to="/home" className={`${secondaryButton} mt-6`}>Explore all posts <Icon name="arrow" size={16} /></Link>}</div>;
  return <div>
    <div className="space-y-4">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
    {error && <div className="mt-4"><LoadError title="We lost the next signal." message={error} onRetry={() => setRequest((current) => ({ ...current, retry: current.retry + 1 }))} /></div>}
    {!error && hasMore && <button type="button" disabled={loading} className={`${secondaryButton} mt-5 w-full`} onClick={() => {
      if (pending.current) return;
      pending.current = true;
      setRequest((current) => ({ offset: current.offset + PAGE_SIZE, retry: 0 }));
    }}>{loading ? "Receiving transmissions…" : "Load more transmissions"} {!loading && <Icon name="down" size={17} />}</button>}
    {!hasMore && <p className="py-8 text-center font-mono text-xs text-[#8d94a7]">YOU’RE ALL CAUGHT UP. STAY CURIOUS.</p>}
  </div>;
}

function CommunityList({ communities, activeCommunity, onSelect, error, loading, onRetry }) {
  return <section className="rounded-xl border border-white/10 bg-[#11131b]/95 p-5" aria-labelledby="communities-title">
    <div className="flex items-center justify-between gap-3"><h2 id="communities-title" className="text-lg font-medium">Find your orbit</h2><Icon name="orbit" className="text-[#8fa8c8]" /></div>
    <p className="mt-2 text-sm leading-relaxed text-[#989fb2]">Different worlds. Same curiosity.</p>
    {loading ? <p role="status" className="mt-5 text-sm text-[#a6a9ba]">Locating communities…</p> : error ? <div className="mt-5"><p role="alert" className="text-sm text-[#e7baa9]">Communities are unavailable.</p><button type="button" onClick={onRetry} className="mt-2 text-sm text-[#bfcfe6] underline underline-offset-4">Try again</button></div> : <div className="mt-4 max-h-[min(55dvh,440px)] space-y-1 overflow-y-auto overscroll-contain">
      <button type="button" onClick={() => onSelect("")} aria-pressed={!activeCommunity} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm ${!activeCommunity ? "bg-white/7 text-white" : "text-[#b2b6c7] hover:bg-white/4"}`}><span className="grid size-8 place-items-center"><Icon name="spark" size={20} /></span>All transmissions</button>
      {communities.map((community, index) => <button type="button" key={community.id} onClick={() => onSelect(String(community.id))} aria-pressed={activeCommunity === String(community.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm ${activeCommunity === String(community.id) ? "bg-white/7 text-white" : "text-[#b2b6c7] hover:bg-white/4"}`}><MiniPlanet planet={["earth", "mars", "saturn"][index % 3]} className="size-8!" /><span className="min-w-0"><span className="block truncate font-medium">s/{community.name}</span><span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#9399aa]">{community.description || "A little corner of the cosmos."}</span></span></button>)}
      {!communities.length && <p className="py-3 text-sm leading-relaxed text-[#a6a9ba]">No communities have been created yet.</p>}
    </div>}
  </section>;
}

export default function HomePage() {
  const { status } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").trim().slice(0, 200);
  const sort = ["discussed", "top"].includes(params.get("sort")) ? params.get("sort") : "new";
  const community = /^[1-9]\d*$/.test(params.get("community") || "") ? params.get("community") : "";
  const [communities, setCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const [communitiesError, setCommunitiesError] = useState("");
  const [retryCommunities, setRetryCommunities] = useState(0);
  useEffect(() => { document.title = q ? `Search: ${q} — SpaceChat` : "The public feed — SpaceChat"; window.scrollTo({ top: 0, behavior: "instant" }); }, [q, sort, community]);
  useEffect(() => {
    const controller = new AbortController();
    setCommunitiesLoading(true); setCommunitiesError("");
    forumApi.communities(controller.signal).then((rows) => { if (!controller.signal.aborted) setCommunities(rows); })
      .catch((failure) => { if (!controller.signal.aborted) setCommunitiesError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setCommunitiesLoading(false); });
    return () => controller.abort();
  }, [retryCommunities]);
  function updateFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  }
  const selected = communities.find((item) => String(item.id) === community);
  return <ForumLayout>
    <section className="relative mb-8 isolate overflow-hidden rounded-xl border border-[#7289b5]/20 bg-[#111a2b] px-6 py-9 sm:px-9 sm:py-12" aria-labelledby="feed-welcome">
      <div aria-hidden="true" className="absolute inset-0 -z-1 bg-[radial-gradient(ellipse_at_80%_20%,#31578635,transparent_65%)]" />
      <BluePlanet className="absolute -right-24 -bottom-29 -z-1 w-[320px] opacity-55 sm:-right-10 sm:-bottom-32 sm:w-[440px] sm:opacity-90 lg:right-8 lg:-bottom-41 lg:w-[490px]" />
      <div className="max-w-[560px]"><p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[1.4px] text-[#a0badb]"><span className="size-1.5 rounded-full bg-[#a2c8e1]" />THE OPEN FREQUENCY</p><h1 id="feed-welcome" className="text-[clamp(32px,4.2vw,49px)] leading-[1.13] font-medium tracking-[-1.5px]">Big universe.<br /><span className="text-[#ff9b83]">Small talk welcome.</span></h1><p className="mt-5 max-w-[425px] text-sm leading-[1.85] text-[#bec8d8]">Ideas, discoveries, and existential spirals. Tune into conversations from every corner of the cosmos.</p></div>
      <span aria-hidden="true" className="absolute top-6 right-6 hidden font-mono text-[11px] tracking-[1.5px] text-[#94b4d6]/75 sm:block">SC—002 / OUTER ORBIT</span>
    </section>
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_290px]">
      <section aria-labelledby="feed-title" className="min-w-0">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><h2 id="feed-title" className="text-2xl font-medium tracking-[-.6px]">{q ? "Search transmissions" : selected ? `s/${selected.name}` : "Your window to the universe"}</h2>{q && <p role="status" className="mt-2 text-sm text-[#a6aabd] [overflow-wrap:anywhere]">Results for “{q}”</p>}</div><div className="inline-flex min-h-11 max-w-full shrink-0 flex-wrap items-center gap-0.5 self-start rounded-lg border border-white/10 bg-[#10121b] p-1" role="group" aria-label="Sort posts">{[['new', 'Newest'], ['top', 'Top'], ['discussed', 'Most discussed']].map(([value, label]) => <button type="button" key={value} aria-pressed={sort === value} onClick={() => updateFilter("sort", value)} className={`inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs leading-5 transition-colors ${sort === value ? "bg-white/9 text-starlight" : "text-[#9b9eaf] hover:text-white"}`}>{label}</button>)}</div></div>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 lg:hidden"><label htmlFor="community-filter" className="shrink-0 text-xs text-[#a5aabc]">Community</label><select id="community-filter" value={community} onChange={(event) => updateFilter("community", event.target.value)} className="min-h-11 w-full min-w-0 max-w-full flex-1 rounded-lg border border-white/15 bg-[#13151f] px-3 py-2 text-sm leading-5"><option value="">All transmissions</option>{communities.map((item) => <option key={item.id} value={item.id}>s/{item.name}</option>)}</select></div>
        {communitiesLoading && <p role="status" className="mb-4 text-xs text-[#a5aabc] lg:hidden">Locating communities…</p>}
        {communitiesError && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm lg:hidden"><p role="alert" className="text-[#e7baa9]">Communities are unavailable.</p><button type="button" onClick={() => setRetryCommunities((current) => current + 1)} className="min-h-10 text-[#bfcfe6] underline underline-offset-4">Try communities again</button></div>}
        {(q || community) && <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[#a3b3ca]">{community && <span className="rounded-md border border-white/12 bg-white/3 px-3 py-2">{selected ? `s/${selected.name}` : `Community #${community}`}</span>}<Link to="/home" className="inline-flex min-h-10 items-center justify-center rounded-md px-3 py-2 leading-5 underline underline-offset-4 hover:bg-white/4 hover:text-white">Clear filters</Link></div>}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#111723] p-4"><p className="text-sm text-[#b3bfd4]">Something on your radar?</p><Link to={community ? `/submit?community=${community}` : "/submit"} className={secondaryButton} state={status !== "authenticated" ? { returnTo: community ? `/submit?community=${community}` : "/submit" } : null}>Start a discussion <Icon name="diagonal" size={16} /></Link></div>
        <Feed key={`${q}|${sort}|${community}|${status}`} filters={{ q, sort, community }} />
      </section>
      <aside className="space-y-5 lg:sticky lg:top-28"><div className="hidden lg:block"><CommunityList communities={communities} activeCommunity={community} onSelect={(id) => updateFilter("community", id)} error={communitiesError} loading={communitiesLoading} onRetry={() => setRetryCommunities((current) => current + 1)} /></div><section className="rounded-xl border border-white/10 bg-[#11131b]/95 p-5"><Icon name="spark" size={24} className="text-signal" /><h2 className="mt-4 text-lg font-medium">A little space for everyone.</h2><p className="mt-3 text-sm leading-[1.85] text-[#a9aebf]">Be curious. Be kind. There’s a whole universe of perspectives out here.</p><Link to="/landing" className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm text-[#e8b3a3] hover:text-white">The SpaceChat story <Icon name="diagonal" size={16} /></Link></section></aside>
    </div>
  </ForumLayout>;
}
