import AstroBotReplyWatcher from "../AstroBotReplyWatcher";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Icon } from "../landing/visuals";
import { authorName, commentThreads, forumApi, relativeTime } from "../../lib/forum";
import { LoadError, primaryButton, secondaryButton } from "./ForumLayout";

const fieldStyles = "block min-h-32 w-full min-w-0 resize-y rounded-lg border border-white/15 bg-[#0d1019] px-3.5 py-3 text-sm leading-[1.8] text-starlight placeholder:text-[#838da2] focus:border-[#a8bedc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a8bedc]/40 disabled:cursor-wait disabled:opacity-60";
const actionStyles = "inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-xs text-[#aab9cf] transition-colors hover:bg-white/5 hover:text-starlight disabled:cursor-wait disabled:opacity-50";

function CommentForm({ label, initialBody = "", submitLabel, pendingLabel, disabled, onSave, onCancel, onLogin, autoFocus = false }) {
  const id = useId();
  const field = useRef(null);
  const errorSummary = useRef(null);
  const submitting = useRef(false);
  const [body, setBody] = useState(initialBody);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (autoFocus) field.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || disabled) return;
    setError("");
    setNeedsLogin(false);
    if (!body.trim()) {
      setError("Write a comment before sending it.");
      field.current?.focus();
      return;
    }
    if (body.length > 10000) {
      setError("Keep your comment within 10,000 characters.");
      field.current?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      await onSave(body);
      setBody("");
    } catch (failure) {
      setError(failure.message || "We couldn’t save your comment. Please try again.");
      setNeedsLogin(failure.status === 401);
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-3">
    <label htmlFor={id} className="block text-sm font-medium text-[#d4dbe9]">{label}</label>
    <textarea ref={field} id={id} name="body" value={body} onChange={(event) => { setBody(event.target.value); setError(""); setNeedsLogin(false); }} rows={4} maxLength={10000} required disabled={disabled || pending} aria-describedby={`${id}-length${error ? ` ${id}-error` : ""}`} className={fieldStyles} placeholder="Send a thoughtful transmission…" />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span id={`${id}-length`} className="text-xs tabular-nums text-[#8e9ab0]">{body.length.toLocaleString()} / 10,000</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {onCancel && <button type="button" onClick={onCancel} disabled={disabled || pending} className={secondaryButton}>Cancel</button>}
        <button type="submit" disabled={disabled || pending} className={primaryButton}>{pending ? pendingLabel : submitLabel}<Icon name="diagonal" size={15} /></button>
      </div>
    </div>
    {error && <div ref={errorSummary} id={`${id}-error`} role="alert" tabIndex={-1} className="rounded-lg border border-[#fa7159]/30 bg-[#2b171b]/60 p-3 text-sm leading-relaxed text-[#ffc1af] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"><p>{error}</p>{needsLogin && <button type="button" className="mt-2 underline underline-offset-4" onClick={onLogin}>Log in again</button>}</div>}
  </form>;
}

function Comment({ comment, depth, authenticated, isAuthor, checkingSession, disabled, onReply, onEdit, onDelete, onLogin }) {
  const [mode, setMode] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteNeedsLogin, setDeleteNeedsLogin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletePending = useRef(false);
  const deleteButton = useRef(null);
  const deleteErrorRef = useRef(null);
  const deleted = comment.body === "[deleted]";

  function openReply() {
    if (!authenticated) { onLogin(); return; }
    setMode((current) => current === "reply" ? null : "reply");
    setDeleteError("");
  }

  async function remove() {
    if (deletePending.current || disabled) return;
    deletePending.current = true;
    setDeleting(true); setDeleteError(""); setDeleteNeedsLogin(false);
    try {
      await onDelete(comment.id);
      setMode(null);
    } catch (failure) {
      setDeleteError(failure.message || "We couldn’t delete your comment. Please try again.");
      setDeleteNeedsLogin(failure.status === 401);
      requestAnimationFrame(() => deleteErrorRef.current?.focus());
    } finally {
      deletePending.current = false;
      setDeleting(false);
    }
  }

  return <li id={`comment-${comment.id}`} style={{ marginLeft: `${Math.min(depth, 3) * 12}px` }} className={`min-w-0 scroll-mt-[300px] min-[400px]:scroll-mt-[220px] md:scroll-mt-[160px] ${depth ? "border-l border-[#7193bd]/25 pl-3 sm:pl-4" : "border-t border-white/8 pt-5 first:border-0 first:pt-0"}`}>
    <article aria-label={`${deleted ? "Deleted comment" : `Comment by ${authorName(comment)}`}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#a2a9bc]">
        <span className="font-medium text-[#c4d1e7] [overflow-wrap:anywhere]">{deleted ? "[deleted]" : authorName(comment)}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString()}>{relativeTime(comment.created_at)}</time>
        {depth > 0 && <span className="text-[#8996ac]">· Reply</span>}
        {comment.is_bot && <span className="rounded bg-indigo-500/25 px-2 py-0.5 text-indigo-200">AI bot</span>}
        {isAuthor && !deleted && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[#a6bddc]">You</span>}
      </div>
      {mode === "edit" && isAuthor && !deleted ? <div className="mt-4"><CommentForm label="Edit your comment" initialBody={comment.body} submitLabel="Save changes" pendingLabel="Saving…" disabled={disabled} onCancel={() => setMode(null)} onLogin={onLogin} autoFocus onSave={async (body) => { await onEdit(comment.id, body); setMode(null); }} /></div> : <p className={`mt-2.5 whitespace-pre-wrap text-sm leading-[1.9] [overflow-wrap:anywhere] ${deleted ? "italic text-[#8993a5]" : "text-[#c5c8d4]"}`}>{comment.body}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        <button type="button" className={actionStyles} disabled={disabled || checkingSession} onClick={openReply} aria-expanded={mode === "reply"}><Icon name="chat" size={15} />Reply</button>
        {isAuthor && !deleted && <>
          <button type="button" className={actionStyles} disabled={disabled} onClick={() => { setMode((current) => current === "edit" ? null : "edit"); setDeleteError(""); }} aria-expanded={mode === "edit"}>Edit</button>
          <button ref={deleteButton} type="button" className={`${actionStyles} hover:text-[#ffb3a0]`} disabled={disabled} onClick={() => { setMode("delete"); setDeleteError(""); }} aria-expanded={mode === "delete"}>Delete</button>
        </>}
      </div>
      {mode === "reply" && authenticated && <div className="mt-4 rounded-lg border border-white/10 bg-white/2 p-3 sm:p-4"><CommentForm label={`Reply to ${deleted ? "this comment" : authorName(comment)}`} submitLabel="Send reply" pendingLabel="Sending…" disabled={disabled} onCancel={() => setMode(null)} onLogin={onLogin} autoFocus onSave={async (body) => { await onReply(comment.id, body); setMode(null); }} /></div>}
      {mode === "delete" && isAuthor && !deleted && <div className="mt-3 rounded-lg border border-[#fa7159]/25 bg-[#26171a]/60 p-4">
        <p className="text-sm leading-relaxed text-[#e8c5bc]">Delete this comment? Replies will stay in the conversation.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={secondaryButton} disabled={disabled || deleting} onClick={() => { setMode(null); deleteButton.current?.focus(); }}>Keep comment</button><button type="button" className={primaryButton} disabled={disabled || deleting} onClick={remove}>{deleting ? "Deleting…" : "Delete comment"}</button></div>
        {deleteError && <div ref={deleteErrorRef} role="alert" tabIndex={-1} className="mt-3 text-sm leading-relaxed text-[#ffc1af] focus:outline-none"><p>{deleteError}</p>{deleteNeedsLogin && <button type="button" className="mt-2 underline underline-offset-4" onClick={onLogin}>Log in again</button>}</div>}
      </div>}
    </article>
  </li>;
}

function DiscussionThread({ postId, onCountChange }) {
  const { status, user, refresh } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  const readController = useRef(null);
  const readId = useRef(0);
  const mutationPending = useRef(false);
  const countCallback = useRef(onCountChange);
  countCallback.current = onCountChange;
  const authenticated = status === "authenticated";

  const reload = useCallback(async () => {
    if (!mounted.current) return false;
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    const id = ++readId.current;
    setLoading(true); setError("");
    try {
      const rows = await forumApi.comments(postId, controller.signal);
      if (!mounted.current || controller.signal.aborted || id !== readId.current) return false;
      setComments(rows);
      countCallback.current?.(rows.length);
      return true;
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted && id === readId.current) setError(failure.message || "We couldn’t load this conversation. Please try again.");
      return false;
    } finally {
      if (mounted.current && !controller.signal.aborted && id === readId.current) setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => { mounted.current = false; readId.current += 1; readController.current?.abort(); };
  }, [reload]);

  useEffect(() => {
    const refresh = () => { reload(); };
    window.addEventListener("astrobot:reply", refresh);
    return () => window.removeEventListener("astrobot:reply", refresh);
  }, [reload]);

  async function login() {
    // A write can discover an expired server session before the page does.
    // Recheck before entering a guest-only route with stale auth state.
    if (authenticated) await refresh();
    navigate("/login", { state: { returnTo: `/posts/${postId}#comments` } });
  }

  async function mutate(action, message) {
    if (mutationPending.current) throw new Error("Another comment is being saved. Please wait a moment.");
    if (!authenticated) {
      login();
      throw new Error("Log in to join the conversation.");
    }
    mutationPending.current = true;
    setPending(true); setNotice("");
    try {
      await action();
      if (!mounted.current) return;
      setNotice(message);
      const refreshed = await reload();
      if (!refreshed && mounted.current) setNotice(`${message} Refresh the conversation below to see the latest comments.`);
    } finally {
      mutationPending.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return <section id="comments" aria-labelledby="comments-title" className="scroll-mt-[300px] rounded-xl border border-white/10 bg-[#11131b]/95 p-5 min-[400px]:scroll-mt-[220px] md:scroll-mt-[160px] sm:p-7">
    <AstroBotReplyWatcher postId={postId} onBotReply={reload} />
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 id="comments-title" className="text-xl font-medium">The conversation {!loading && !error && <span className="ml-1 text-sm text-[#929bad]">({comments.length})</span>}</h2><span className="text-xs text-[#939bad]">Most upvoted, then newest</span></div>
    {authenticated ? <div className="mb-7 border-b border-white/10 pb-6"><CommentForm label={`Join the conversation as u/${user.username}`} submitLabel="Send comment" pendingLabel="Sending…" disabled={pending || loading} onLogin={login} onSave={(body) => mutate(() => forumApi.createComment(postId, { body, parent_comment_id: null }), "Your comment was sent.")} /></div> : status === "loading" ? <p role="status" className="mb-6 text-sm text-[#9ca9be]">Checking your signal…</p> : <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/2 p-4"><p className="text-sm leading-relaxed text-[#b6c0d2]">There’s room for your perspective, too.</p><button type="button" onClick={login} className={secondaryButton}>Log in to comment <Icon name="diagonal" size={15} /></button></div>}
    {notice && <p role="status" className="mb-5 rounded-lg border border-[#87bca5]/25 bg-[#14241f]/60 p-3 text-sm leading-relaxed text-[#b7ddca]">{notice}</p>}
    {loading && <p role="status" className="py-4 text-sm text-[#adb3c4]">{comments.length ? "Refreshing the conversation…" : "Receiving replies…"}</p>}
    {error && <div className="mb-5"><LoadError title="We couldn’t receive the conversation." message={error} onRetry={reload} /></div>}
    {!loading && !error && !comments.length && <p className="py-6 text-sm leading-relaxed text-[#a9afbf]">No replies to this transmission yet. Start the conversation.</p>}
    {comments.length > 0 && <ol className="space-y-5" aria-label="Comments">{commentThreads(comments).map(({ comment, depth }) => <Comment key={comment.id} comment={comment} depth={depth} authenticated={authenticated} isAuthor={authenticated && user.id === comment.author_id} checkingSession={status === "loading"} disabled={pending || loading} onLogin={login} onReply={(parentId, body) => mutate(() => forumApi.createComment(postId, { body, parent_comment_id: parentId }), "Your reply was sent.")} onEdit={(commentId, body) => mutate(() => forumApi.updateComment(commentId, { body }), "Your comment was updated.")} onDelete={(commentId) => mutate(() => forumApi.deleteComment(commentId), "Your comment was deleted.")} />)}</ol>}
  </section>;
}

export default function Discussion(props) {
  return <DiscussionThread key={props.postId} {...props} />;
}
