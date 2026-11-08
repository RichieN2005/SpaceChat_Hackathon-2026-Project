import { useEffect, useId, useRef, useState } from "react";

import AstroBotChat from "../components/AstroBotChat";
import AstroBotReplyWatcher from "../components/AstroBotReplyWatcher";

const buttonStyles = "inline-flex cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none";
const inputStyles = "w-full min-w-0 rounded-md border border-[#3a3032] bg-[#151113] px-3 py-[11px] text-base leading-[1.6] text-[#eee3df] placeholder:text-[#8e8286] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal";
const submitStyles = `${buttonStyles} shrink-0 rounded-md border border-[#a9543c] bg-signal px-3 py-2 text-[13px] font-semibold text-[#160d0a] enabled:hover:bg-[#ff8b70]`;

function Icon({ name, className = "size-[18px]", ...props }) {
  const paths = {
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <path d="M12 19V5m-6 6 6-6 6 6" />,
    comment: <path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 20l1.4-4.5A8 8 0 1 1 20 11.5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    orbit: <>
      <circle cx="12" cy="12" r="5" />
      <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-35 12 12)" />
      <circle cx="19.5" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
    </>,
  };

  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}

function makePosts(community) {
  const planetary = community.id === "mars" || /mars|martian/i.test(community.title);
  return [
    {
      id: "first", author: "cosmic_crouton", avatar: "✳", time: "2 light-minutes ago", tag: "Discussion",
      title: planetary ? "First day on Mars. Is the sunset always this blue?" : "What’s one Earth thing you’d take to another planet?",
      body: planetary ? "Came for the adventure, stayed because I’m still figuring out the airlock. What should a new arrival know?" : "My human friend says coffee. I’m leaning toward a really good playlist. Make your case, earthlings.",
      votes: 128,
      comments: [{ id: "seed-1", author: "orbit_observer", text: planetary ? "Rule one: label your space snacks. Rule two: enjoy the view." : "A houseplant. Someone has to bring a little green to the galaxy." }],
    },
    {
      id: "second", author: "slightly_alien", avatar: "◉", time: "17 light-minutes ago", tag: "Question",
      title: "Is waving a universal greeting, or did I just start a duel?",
      body: "Just trying to make friends across the solar system. Asking for a very nervous extraterrestrial.",
      votes: 86,
      comments: [{ id: "seed-2", author: "moon_moth", text: "Try offering a snack. That’s worked on every planet I’ve visited." }],
    },
    {
      id: "third", author: "saturn_after_dark", avatar: "✶", time: "1 orbit ago", tag: "Just for fun",
      title: "Unpopular opinion: Saturn is doing too much with the rings.",
      body: "We get it. You accessorize. Some of us are perfectly happy with one moon.",
      votes: 42, comments: [],
    },
  ];
}

function Post({ post, onVote, onReply, onCommentVote, detailsOpen, onOpen, onBack }) {
  const [commentsOpen, setCommentsOpen] = useState(detailsOpen);
  useEffect(() => { if (detailsOpen) setCommentsOpen(true); }, [detailsOpen]);
  const [reply, setReply] = useState("");
  const replyId = useId();

  async function submitReply(event) {
    event.preventDefault();
    if (!reply.trim()) return;
    try { await onReply(post.id, reply.trim()); setReply(""); } catch { /* Parent displays the error. */ }
  }

  return (
    <article className="cursor-pointer border-b border-[#29272a] py-6" onClick={(event) => {
      if (event.target.closest('button, a, input, textarea, select, form, [data-selectable]') || window.getSelection()?.toString()) return;
      onOpen(post.id);
    }}>
      <button className="sr-only focus:not-sr-only" onClick={() => { onOpen(post.id); }}>Open post: {post.title}</button>
      {detailsOpen && <button className={`${buttonStyles} mb-4 text-sm text-signal`} onClick={onBack}>Back to community posts</button>}
      <div className="flex flex-wrap items-center gap-2 text-[12px] leading-[1.6] text-[#8e878b]">
        <span className="grid size-6 place-items-center rounded-full border border-[#51332c] bg-[#2d1c19] text-[19px] text-[#f3a18b]">{post.avatar}</span>
        <strong className="text-[13px] font-medium text-[#c5bec0]">u/{post.author}</strong>
        <span className="hidden min-[601px]:inline">· {post.time}</span>
        <span className="ml-auto rounded border border-[#333034] px-2 py-0.5 text-[11px] text-[#b5a8a3]">{post.tag}</span>
      </div>
      <h3 className="mt-3.5 mb-2 text-[19px] leading-[1.45] font-medium tracking-[-.25px] wrap-anywhere text-[#eee9e5] min-[601px]:text-lg">{post.title}</h3>
      <p data-selectable className="cursor-text select-text m-0 text-[15px] leading-[1.8] whitespace-pre-wrap wrap-anywhere text-[#a29b9e]">{post.body}</p>
      <div className="mt-[17px] flex items-center gap-2.5">
        {[1, -1].map((direction) => <button
          key={direction} type="button"
          className={`${buttonStyles} rounded-full border border-[#353033] px-3 py-2 text-sm ${post.user_vote === direction ? "text-signal" : "text-[#c1b8b8]"}`}
          aria-pressed={post.user_vote === direction}
          aria-label={`${direction === 1 ? "Upvote" : "Downvote"} ${post.title}`}
          onClick={() => onVote(post.id, direction)}
        ><span aria-hidden="true">{direction === 1 ? "\u2191" : "\u2193"}</span> {direction === 1 ? post.upvotes : post.downvotes}</button>)}
        <button
          type="button"
          className={`${buttonStyles} min-h-8 rounded-full border border-transparent bg-transparent px-[9px] py-[5px] text-[13px] text-[#aca2a5] hover:bg-[#201a1c] hover:text-[#eee6e3]`}
          aria-expanded={commentsOpen}
          aria-controls={`${replyId}-comments`}
          onClick={() => setCommentsOpen(!commentsOpen)}
        >
          <Icon name="comment" className="size-[15px]" />
          {post.comments.length} {post.comments.length === 1 ? "reply" : "replies"}
        </button>
      </div>
      {commentsOpen && (
        <div className="mt-[18px] border-l border-[#48302a] pt-[3px] pl-4" id={`${replyId}-comments`}>
          <div aria-live="polite">
            {post.comments.length ? [...post.comments].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || new Date(b.created_at || 0) - new Date(a.created_at || 0) || String(b.id).localeCompare(String(a.id))).map((comment) => (
              <div data-selectable className="cursor-text mb-[17px]" key={comment.id}>
                <strong className="text-[12px] font-medium text-[#d5bbb2]">u/{comment.author}</strong>
                {comment.is_bot && <span className="ml-2 rounded bg-indigo-500/25 px-2 py-0.5 text-xs text-indigo-200">AI bot</span>}
                <p className="mt-[5px] text-xs leading-[1.75] wrap-anywhere text-[#a99fa1]">{comment.text}</p>
                {[1, -1].map((direction) => <button key={direction} type="button" className={`${buttonStyles} mr-3 text-xs ${comment.user_vote === direction ? "text-signal" : "text-[#aaa]"}`} aria-label={`${direction === 1 ? "Upvote" : "Downvote"} comment by ${comment.author}`} aria-pressed={comment.user_vote === direction} onClick={() => onCommentVote(post.id, comment.id, direction)}>{direction === 1 ? "\u2191" : "\u2193"} {direction === 1 ? comment.upvotes || 0 : comment.downvotes || 0}</button>)}
              </div>
            )) : <p className="mb-3.5 text-xs leading-[1.7] text-[#9e9296]">An empty frequency. Be the first to say hello.</p>}
          </div>
          <form className="flex flex-wrap gap-2 min-[601px]:flex-nowrap" onSubmit={submitReply}>
            <label className="sr-only" htmlFor={replyId}>Reply to {post.title}</label>
            <input
              className={`${inputStyles} flex-[1_1_190px] min-[601px]:flex-auto`}
              id={replyId}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Send a friendly transmission…"
              maxLength={500}
              required
            />
            <button className={`${submitStyles} ml-auto min-[601px]:ml-0`} type="submit" disabled={!reply.trim()}>
              Reply <span aria-hidden="true">↗</span>
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export default function ForumDialog({ community, onClose, initiallyComposing = false, initialSort = "newest" }) {
  const [posts, setPosts] = useState(() => community.apiId ? [] : makePosts(community).map((post, index) => ({ ...post, upvotes: post.votes, downvotes: 0, user_vote: 0, created_at: new Date(Date.now() - index * 60000).toISOString() })));
  const [composing, setComposing] = useState(initiallyComposing);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [sort, setSort] = useState(initialSort);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const votesInFlight = useRef(new Set());

  async function api(path, options) {
    const response = await fetch(`/api${path}`, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json" } });
    const data = await response.json().catch(() => ({ error: "Unable to reach the community service. Please try again." }));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function loadPosts() {
    const rows = await api(`/posts?subreddit_id=${community.apiId}&sort=${sort}`);
    const loaded = await Promise.all(rows.map(async (post) => ({ ...post, avatar: "*", time: new Date(post.created_at).toLocaleString(), tag: "Discussion", comments: (await api(`/posts/${post.id}/comments`)).map((comment) => ({ ...comment, text: comment.body })) })));
    setPosts(loaded);
  }
  useEffect(() => {
    if (!community.apiId) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const rows = await api(`/posts?subreddit_id=${community.apiId}&sort=${sort}`);
        const loaded = await Promise.all(rows.map(async (post) => ({ ...post, avatar: "*", time: new Date(post.created_at).toLocaleString(), tag: "Discussion", comments: (await api(`/posts/${post.id}/comments`)).map((comment) => ({ ...comment, text: comment.body })) })));
        if (active) setPosts(loaded);
      } catch (error) { if (active) setNotice(error.message); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [community.apiId, sort]);

  const sortedPosts = [...posts].sort((a, b) => {
    const ranking = sort === "top" ? (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes) : sort === "discussed" ? b.comments.length - a.comments.length : 0;
    return ranking || new Date(b.created_at) - new Date(a.created_at) || String(b.id).localeCompare(String(a.id));
  });
  function applyVote(item, direction) {
    const previous = item.user_vote || 0;
    const next = previous === direction ? 0 : direction;
    return { ...item, upvotes: (item.upvotes || 0) - Number(previous === 1) + Number(next === 1), downvotes: (item.downvotes || 0) - Number(previous === -1) + Number(next === -1), user_vote: next };
  }
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const composeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const headingId = useId();
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')]
        .filter((element) => element.getClientRects().length);
      const first = elements[0];
      const last = elements[elements.length - 1];
      const focusOutsideDialog = !dialogRef.current.contains(document.activeElement);

      if (event.shiftKey && (document.activeElement === first || focusOutsideDialog)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || focusOutsideDialog)) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, []);

  async function vote(id, direction) {
    const key = `post-${id}`;
    if (votesInFlight.current.has(key)) return;
    votesInFlight.current.add(key);
    const post = posts.find((post) => post.id === id);
    try {
      const updated = community.apiId ? await api(`/posts/${id}/vote`, { method: "PUT", body: JSON.stringify({ value: post.user_vote === direction ? 0 : direction }) }) : applyVote(post, direction);
      setPosts((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item));
    } catch (error) { setNotice(error.message); } finally { votesInFlight.current.delete(key); }
  }
  async function commentVote(postId, id, direction) {
    const key = `comment-${id}`;
    if (votesInFlight.current.has(key)) return;
    votesInFlight.current.add(key);
    const comment = posts.find((post) => post.id === postId).comments.find((comment) => comment.id === id);
    try {
      const updated = community.apiId ? await api(`/comments/${id}/vote`, { method: "PUT", body: JSON.stringify({ value: comment.user_vote === direction ? 0 : direction }) }) : applyVote(comment, direction);
      setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: post.comments.map((item) => item.id === id ? { ...item, ...updated } : item) } : post));
    } catch (error) { setNotice(error.message); } finally { votesInFlight.current.delete(key); }
  }
  async function reply(id, text) {
    try {
      if (community.apiId) {
        await api(`/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ body: text }) });
        await loadPosts();
      } else setPosts((current) => current.map((post) => post.id === id
        ? { ...post, comments: [...post.comments, { id: crypto.randomUUID(), author: "you_from_earth", text, created_at: new Date().toISOString(), upvotes: 0 }] }
        : post));
    } catch (error) { setNotice(error.message); throw error; }
  }

  async function submitPost(event) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (pending) return;
    setPending(true);
    try {
    if (community.apiId) {
      await api("/posts", { method: "POST", body: JSON.stringify({ subreddit_id: community.apiId, title: title.trim(), body: body.trim() }) });
      await loadPosts();
    } else setPosts((current) => [{
      id: crypto.randomUUID(), author: "you_from_earth", avatar: "✦", time: "just transmitted", tag: "Discussion",
      title: title.trim(), body: body.trim(), upvotes: 0, downvotes: 0, user_vote: 0, created_at: new Date().toISOString(), comments: [],
    }, ...current]);
    setTitle("");
    setBody("");
    setComposing(false);
    setNotice("Post created in this community.");
    composeRef.current?.focus();
    } catch (error) { setNotice(error.message); } finally { setPending(false); }
  }

  return (
    <div
      className="fixed inset-0 z-1000 flex animate-forum-appear items-center justify-center bg-black/78 p-3 backdrop-blur-[12px] motion-reduce:animate-none min-[601px]:p-7"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[13px] border border-[#333033] bg-[#0c0c0e] text-left text-starlight shadow-[0_30px_100px_#0009] min-[601px]:max-h-[calc(100dvh-56px)] min-[601px]:rounded-[18px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={`${headingId}-description`}
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-[#29272a] px-[17px] py-5 min-[601px]:gap-3.5 min-[601px]:px-7 min-[601px]:py-[25px]">
          <div className="grid size-10 shrink-0 place-items-center rounded-full border border-[#3e3432] bg-[#1d1514] min-[601px]:size-12" style={{ color: community.color || "#fa674e" }}>
            <Icon name="orbit" className="size-[27px] min-[601px]:size-8" />
          </div>
          <div className="min-w-0">
            <span className="mb-1 block font-mono text-[13px] tracking-[1px] text-[#a7a0a0]">{community.handle}</span>
            <h2 className="m-0 text-xl leading-[1.2] font-semibold tracking-[-.6px] wrap-anywhere min-[601px]:text-2xl" id={headingId}>{community.title}</h2>
          </div>
          <button ref={closeRef} className={`${buttonStyles} ml-auto size-[34px] shrink-0 self-start rounded-full border border-[#353134] bg-transparent text-[#bdb8b8] hover:bg-[#272326] hover:text-white`} type="button" onClick={onClose} aria-label="Close community preview">
            <Icon name="close" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-[17px] pt-[19px] [scrollbar-color:#4d4141_#0c0c0e] [scrollbar-width:thin] min-[601px]:px-7 min-[601px]:pt-[23px]">
          <p className="mb-[15px] text-[15px] leading-[1.7] text-[#b6b0b2] min-[601px]:text-sm" id={`${headingId}-description`}>{community.description}</p>
          <div className="flex flex-wrap items-center gap-[7px] font-mono text-[11px] leading-[1.6] tracking-[.25px] text-[#aca1a0] min-[601px]:flex-nowrap min-[601px]:text-[12px]">
            <span className="size-[5px] rounded-full bg-signal" aria-hidden="true" />
            {community.apiId ? "COMMUNITY POSTS" : "INTERACTIVE PREVIEW - posts stay in this session"}
          </div>
          <div className="mt-[25px] flex flex-wrap items-center justify-between gap-2 border-y border-[#29272a] py-4 min-[601px]:flex-nowrap min-[601px]:gap-3.5">
            <span className="flex items-center gap-[7px] text-[12px] text-[#ccc5c3] min-[601px]:text-xs">
              <span className="block size-[5px] rounded-full bg-[#b7c695]" />Open frequencies
            </span>
            <button
              ref={composeRef}
              type="button"
              className={`${buttonStyles} min-h-[35px] rounded-md border border-[#59352d] bg-[#231612] p-2 text-[12px] text-[#ffac98] hover:border-[#9b5340] hover:bg-[#392018] min-[601px]:px-3 min-[601px]:text-[13px]`}
              onClick={() => setComposing(!composing)}
              aria-expanded={composing}
              aria-controls={`${headingId}-compose`}
            >
              <Icon name={composing ? "close" : "plus"} />
              {composing ? "Cancel" : "Create a post"}
            </button>
          </div>

          {composing && (
            <form className="mt-5 grid gap-[11px] rounded-[9px] border border-[#51332c] bg-[#151011] p-[13px] min-[601px]:p-[18px]" id={`${headingId}-compose`} onSubmit={submitPost}>
              <label className="text-xs text-[#e0c7bd]" htmlFor={titleId}>Your transmission</label>
              <input className={inputStyles} id={titleId} placeholder="Give your post a title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required />
              <label className="sr-only" htmlFor={bodyId}>Post text</label>
              <textarea className={`${inputStyles} min-h-[85px] max-h-60 resize-y`} id={bodyId} placeholder="What’s on your mind, traveler?" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} required />
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 max-w-[120px] text-[12px] leading-[1.6] wrap-anywhere text-[#a49497] min-[601px]:max-w-none">{community.apiId ? "Posting to this community" : "Posting as u/you_from_earth"}</span>
                <button className={submitStyles} type="submit" disabled={pending || !title.trim() || !body.trim()}>Transmit post <span aria-hidden="true">↗</span></button>
              </div>
            </form>
          )}
          {!selectedPostId && <label className="my-4 flex items-center gap-3 text-sm">Sort posts
            <select value={sort} onChange={(event) => setSort(event.target.value)} className={inputStyles}>
              <option value="newest">Newest</option><option value="top">Top Voted Post</option><option value="discussed">Most Discussed</option>
            </select>
          </label>}
          <p className="my-3 text-sm text-[#ffac98]" role="status">{notice}</p>
          {loading ? <p role="status">Loading posts...</p> : <div>{sortedPosts.filter((post) => selectedPostId === null || post.id === selectedPostId).map((post) => <Post key={post.id} post={post} onVote={vote} onReply={reply} onCommentVote={commentVote} detailsOpen={selectedPostId === post.id} onOpen={setSelectedPostId} onBack={() => setSelectedPostId(null)} />)}</div>}
          <footer className="flex items-center justify-center gap-[9px] py-[22px] font-mono text-[12px] tracking-[.5px] text-[#9c8e90]">
            <Icon name="orbit" className="size-[18px] text-[#d48068]" />Different planets. Same curiosity.
          </footer>
        </div>
        <AstroBotChat inDialog postId={community.apiId ? selectedPostId : null} onThreadReply={loadPosts} />
        {community.apiId && selectedPostId && <AstroBotReplyWatcher postId={selectedPostId} onBotReply={loadPosts} />}
      </section>
    </div>
  );
}
