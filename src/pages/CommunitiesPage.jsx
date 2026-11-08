import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import ForumLayout, { BluePlanet, LoadError, LoadingCards, secondaryButton } from "../components/forum/ForumLayout";
import { Icon, MiniPlanet } from "../components/landing/visuals";
import { forumApi } from "../lib/forum";
import { useAuth } from "../components/auth/AuthProvider";

export default function CommunitiesPage() {
  const { status, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const joinedOnly = params.get("view") === "joined";
  const query = (params.get("q") || "").trim().slice(0, 200);
  const [draft, setDraft] = useState(query);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const heading = useRef(null);

  useEffect(() => {
    document.title = joinedOnly ? "Your communities — SpaceChat" : query ? `Communities: ${query} — SpaceChat` : "Explore communities — SpaceChat";
    setDraft(query);
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [query, joinedOnly]);

  useEffect(() => {
    const controller = new AbortController();
    if (joinedOnly && status !== "authenticated") {
      setCommunities([]); setError(""); setLoading(status === "loading");
      return () => controller.abort();
    }
    setLoading(true);
    setError("");
    const request = query ? forumApi.searchCommunities(query, controller.signal) : forumApi.communities(controller.signal);
    request.then((items) => { if (!controller.signal.aborted) setCommunities(items); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, retry, joinedOnly, status, user?.id]);

  function search(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (joinedOnly) next.set("view", "joined");
    if (draft.trim()) next.set("q", draft.trim());
    setParams(next);
  }

  const visibleCommunities = joinedOnly ? status === "authenticated" ? communities.filter((community) => community.is_member === true) : [] : communities;
  const viewLink = (joined) => {
    const next = new URLSearchParams();
    if (joined) next.set("view", "joined");
    if (query) next.set("q", query);
    return next.size ? `/communities?${next}` : "/communities";
  };

  return <ForumLayout>
    <section className="relative isolate mb-8 overflow-hidden rounded-xl border border-[#7289b5]/20 bg-[#111a2b] px-6 py-9 sm:px-9 sm:py-12">
      <BluePlanet className="absolute -right-20 -bottom-30 -z-1 w-80 opacity-40 sm:right-2 sm:-bottom-40 sm:w-[420px] sm:opacity-65" />
      <p className="font-mono text-xs tracking-[1.4px] text-[#a0badb]">{joinedOnly ? "YOUR OWN CORNER OF THE COSMOS" : "FIND YOUR CORNER OF THE COSMOS"}</p>
      <h1 ref={heading} tabIndex={-1} className="mt-4 text-[clamp(32px,4vw,48px)] leading-tight font-medium tracking-[-1.2px] outline-none">{joinedOnly ? <>Your communities<span className="text-[#ff9b83]">.</span></> : <>Different worlds.<br /><span className="text-[#ff9b83]">Same wavelength.</span></>}</h1>
      <p className="mt-5 max-w-lg text-sm leading-[1.85] text-[#bec8d8]">{joinedOnly ? "The communities you’ve joined, together in one orbit. Open a community to catch up on its conversations." : "Explore the communities that make up SpaceChat. There’s room for every curiosity, from the familiar to the far out."}</p>
    </section>

    {status === "authenticated" && <nav aria-label="Community views" className="mb-7 flex flex-wrap gap-2"><Link to={viewLink(false)} aria-current={!joinedOnly ? "page" : undefined} className={`${secondaryButton} ${!joinedOnly ? "border-[#91aacb]/50! bg-white/8!" : ""}`}>Explore all</Link><Link to={viewLink(true)} aria-current={joinedOnly ? "page" : undefined} className={`${secondaryButton} ${joinedOnly ? "border-signal/60! bg-signal/10! text-[#ffbaa7]!" : ""}`}><Icon name="orbit" size={17} />Your communities</Link></nav>}

    {joinedOnly && status !== "authenticated" && status !== "loading" ? <div className="rounded-xl border border-white/15 bg-[#111723] p-7 text-center"><h2 className="text-xl font-medium">Your orbit is waiting.</h2><p className="mt-3 text-sm text-[#aebbd0]">Log in to see the communities you’re a part of.</p><Link to="/login" state={{ returnTo: viewLink(true) }} className={`${secondaryButton} mt-5`}>Log in</Link><Link to="/communities" className="mt-4 block py-2 text-sm text-[#b6c9e5] hover:text-white">Explore public communities</Link></div> : <>

    <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <div><h2 className="text-2xl font-medium tracking-[-.6px]">{joinedOnly ? "Your joined communities" : query ? "Community search" : "Explore communities"}{!loading && !error && <span className="ml-2 text-base text-[#9aabc3]">({visibleCommunities.length})</span>}</h2>{query && <p role="status" className="mt-2 text-sm text-[#a7adbf] [overflow-wrap:anywhere]">Results for “{query}”</p>}</div>
      <form role="search" onSubmit={search} className="flex w-full gap-2 sm:w-auto sm:max-w-md sm:flex-1">
        <label htmlFor="community-search" className="sr-only">{joinedOnly ? "Search your communities" : "Search communities"}</label>
        <input id="community-search" type="search" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={200} placeholder={joinedOnly ? "Search your communities" : "Search communities"} className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#151722] px-4 text-sm placeholder:text-[#8e94a6]" />
        <button type="submit" className={secondaryButton}>Search</button>
      </form>
    </div>

    {loading || (joinedOnly && status === "loading") ? <LoadingCards count={3} /> : error ? <LoadError message={error} onRetry={() => setRetry((value) => value + 1)} /> : !visibleCommunities.length ? <div className="rounded-xl border border-dashed border-white/15 bg-[#11131b]/90 px-6 py-14 text-center"><Icon name="orbit" size={38} className="mx-auto text-[#9cb7d8]" /><h2 className="mt-5 text-xl font-medium">{joinedOnly ? query ? "No joined communities match that search." : "You haven’t joined an orbit yet." : query ? "No communities on that frequency." : "A new universe is taking shape."}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#a7adbf]">{joinedOnly ? query ? "Try another name or clear your search to see all of your communities." : "Open a community and choose Join community to add it to your list." : query ? "Try another name or explore all communities." : "Public communities will appear here as they are created."}</p><Link to={joinedOnly && query ? "/communities?view=joined" : "/communities"} className={`${secondaryButton} mt-6`}>{joinedOnly && query ? "Clear search" : "Explore communities"}</Link></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleCommunities.map((community, index) => <Link key={community.id} to={`/communities/${community.id}`} className="group flex min-w-0 flex-col rounded-xl border border-white/10 bg-[#11131b]/95 p-6 transition-colors hover:border-[#a7bddb]/40 hover:bg-[#151925]">
        <div className="flex flex-wrap items-center gap-3"><MiniPlanet planet={["earth", "mars", "saturn"][index % 3]} /><h3 className="min-w-0 flex-1 text-lg leading-snug font-medium text-[#d9e4f4] [overflow-wrap:anywhere]">s/{community.name}</h3>{status === "authenticated" && community.is_member === true && <span className="rounded-full border border-[#83ba9c]/30 bg-[#316149]/20 px-2.5 py-1 text-xs font-medium text-[#b4dfc7]">Joined</span>}</div>
        <p className="mt-4 line-clamp-3 flex-1 text-sm leading-[1.85] whitespace-pre-line text-[#aeb5c7] [overflow-wrap:anywhere]">{community.description || "A little corner of the cosmos. Bring your curiosity."}</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-4 text-xs text-[#a4b6d0]">{Number.isSafeInteger(community.member_count) ? <span>{community.member_count.toLocaleString()} {community.member_count === 1 ? "member" : "members"}</span> : <span>Public community</span>}<span className="inline-flex items-center gap-2 group-hover:text-white">Explore <Icon name="diagonal" size={15} /></span></div>
      </Link>)}
    </div>}
    </>}
  </ForumLayout>;
}
