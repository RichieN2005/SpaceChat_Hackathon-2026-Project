export class ForumApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ForumApiError";
    this.status = status;
  }
}

async function read(path, signal) {
  let response;
  try {
    response = await fetch(`/api${path}`, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" }, signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ForumApiError("We couldn’t reach SpaceChat. Please try again.");
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw new ForumApiError("SpaceChat is unavailable right now. Please try again shortly.", response.status); }
  if (!response.ok) throw new ForumApiError(typeof payload?.error === "string" ? payload.error : "We couldn’t load this transmission.", response.status);
  return payload;
}

function collection(payload) {
  if (!Array.isArray(payload)) throw new ForumApiError("SpaceChat sent an unexpected response. Please try again.");
  return payload;
}

function postRecord(payload) {
  if (!payload || !Number.isSafeInteger(payload.id) || payload.id < 1 || typeof payload.title !== "string" || typeof payload.body !== "string") {
    throw new ForumApiError("SpaceChat sent an unexpected response. Please try again.");
  }
  return payload;
}

export const forumApi = {
  async posts({ q = "", sort = "new", community = "", offset = 0, limit = 21 } = {}, signal) {
    const params = new URLSearchParams({ sort, limit: String(limit), offset: String(offset) });
    if (q) params.set("q", q);
    if (community) params.set("subreddit_id", community);
    return collection(await read(`/posts?${params}`, signal)).map(postRecord);
  },
  async post(id, signal) { return postRecord(await read(`/posts/${encodeURIComponent(id)}`, signal)); },
  async comments(id, signal) { return collection(await read(`/posts/${encodeURIComponent(id)}/comments`, signal)); },
  async communities(signal) { return collection(await read("/subreddits", signal)); },
};

export function authorName(item) { return item.author_username ? `u/${item.author_username}` : `User #${item.author_id}`; }
export function communityName(item) { return item.subreddit_name ? `s/${item.subreddit_name}` : `Community #${item.subreddit_id}`; }

export function relativeTime(value, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Time unavailable";
  const seconds = Math.round((timestamp - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return "Just now";
}

// Keep every comment readable, including orphaned or cyclic older data.
export function commentThreads(comments) {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const children = new Map();
  const roots = [];
  for (const comment of comments) {
    if (comment.parent_comment_id && comment.parent_comment_id !== comment.id && byId.has(comment.parent_comment_id)) {
      if (!children.has(comment.parent_comment_id)) children.set(comment.parent_comment_id, []);
      children.get(comment.parent_comment_id).push(comment);
    } else roots.push(comment);
  }
  const ordered = [];
  const visited = new Set();
  function walk(root) {
    const stack = [{ comment: root, depth: 0 }];
    while (stack.length) {
      const entry = stack.pop();
      if (visited.has(entry.comment.id)) continue;
      visited.add(entry.comment.id);
      ordered.push(entry);
      const replies = children.get(entry.comment.id) || [];
      for (let index = replies.length - 1; index >= 0; index--) stack.push({ comment: replies[index], depth: entry.depth + 1 });
    }
  }
  roots.forEach(walk);
  comments.forEach((comment) => { if (!visited.has(comment.id)) walk(comment); });
  return ordered;
}
