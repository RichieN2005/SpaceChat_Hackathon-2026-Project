import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  authorName,
  commentThreads,
  communityName,
  ForumApiError,
  forumApi,
  relativeTime,
} from "../src/lib/forum.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});
const post = {
  id: 28,
  author_id: 1,
  author_username: "cosmic_traveler",
  subreddit_id: 2,
  subreddit_name: "firstcontact",
  title: "What would Neptune sound like?",
  body: "A quiet question from a very noisy universe.",
  comment_count: 4,
  created_at: "2026-11-08T12:00:00Z",
};

afterEach(() => mock.restoreAll());

test("feed sends encoded search, community, sort, and pagination without losing cookies or cancellation", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json([post]));
  const controller = new AbortController();
  const query = "Neptune & friends? 100% _signals_";
  assert.deepEqual(await forumApi.posts({ q: query, community: "2", sort: "discussed", offset: 20, limit: 21 }, controller.signal), [post]);

  const [path, options] = fetch.mock.calls[0].arguments;
  const url = new URL(path, "https://spacechat.example");
  assert.equal(url.pathname, "/api/posts");
  assert.equal(url.searchParams.get("q"), query);
  assert.equal(url.searchParams.get("subreddit_id"), "2");
  assert.equal(url.searchParams.get("sort"), "discussed");
  assert.equal(url.searchParams.get("offset"), "20");
  assert.equal(url.searchParams.get("limit"), "21");
  assert.equal(options.credentials, "same-origin");
  assert.equal(options.cache, "no-store");
  assert.equal(options.headers.Accept, "application/json");
  assert.equal(options.signal, controller.signal);
  assert.equal(options.body, undefined);
});

test("unfiltered feed requests the initial incremental page without empty filters", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json([]));
  assert.deepEqual(await forumApi.posts(), []);
  const url = new URL(fetch.mock.calls[0].arguments[0], "https://spacechat.example");
  assert.equal(url.searchParams.get("sort"), "new");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.equal(url.searchParams.get("limit"), "21");
  assert.equal(url.searchParams.has("q"), false);
  assert.equal(url.searchParams.has("subreddit_id"), false);
});

test("post, comment, and community reads use their public API paths", async () => {
  const fetch = mock.method(globalThis, "fetch", async (url) => json(url.endsWith("/28") ? post : []));
  assert.deepEqual(await forumApi.post(28), post);
  assert.deepEqual(await forumApi.comments(28), []);
  assert.deepEqual(await forumApi.communities(), []);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url), [
    "/api/posts/28",
    "/api/posts/28/comments",
    "/api/subreddits",
  ]);
});

test("post path IDs are encoded rather than interpreted as another path", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json(post));
  await forumApi.post("28/extra?secret=yes");
  assert.equal(fetch.mock.calls[0].arguments[0], "/api/posts/28%2Fextra%3Fsecret%3Dyes");
});

test("missing posts preserve the backend's 404 and readable error", async () => {
  mock.method(globalThis, "fetch", async () => json({ error: "Post not found" }, 404));
  await assert.rejects(forumApi.post(999), (error) => error instanceof ForumApiError && error.status === 404 && error.message === "Post not found");
});

test("proxy HTML and malformed JSON produce service feedback instead of a JSON parser error", async () => {
  mock.method(globalThis, "fetch", async () => new Response("<html>Bad gateway</html>", { status: 502 }));
  await assert.rejects(forumApi.posts(), (error) => error instanceof ForumApiError && error.status === 502 && /unavailable/.test(error.message));
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => new Response("{invalid", { status: 200 }));
  await assert.rejects(forumApi.communities(), (error) => error instanceof ForumApiError && /unavailable/.test(error.message));
});

test("network failures are actionable while aborts remain recognizable cancellations", async () => {
  mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(forumApi.comments(28), (error) => error instanceof ForumApiError && error.status === 0 && /couldn’t reach/.test(error.message));
  mock.restoreAll();
  const cancellation = new DOMException("Aborted", "AbortError");
  mock.method(globalThis, "fetch", async () => { throw cancellation; });
  await assert.rejects(forumApi.posts(), (error) => error === cancellation);
});

test("collection endpoints reject unexpected successful response shapes", async () => {
  mock.method(globalThis, "fetch", async () => json({ posts: [] }));
  for (const read of [() => forumApi.posts(), () => forumApi.comments(28), () => forumApi.communities()]) {
    await assert.rejects(read(), (error) => error instanceof ForumApiError && /unexpected response/.test(error.message));
  }
});

test("malformed post records become actionable errors in details and feed pages", async () => {
  let payload;
  mock.method(globalThis, "fetch", async () => json(payload));
  const unexpected = (error) => error instanceof ForumApiError && /unexpected response/.test(error.message);
  for (const candidate of [null, {}, { ...post, body: null }, { ...post, id: 0 }, { ...post, id: Number.MAX_SAFE_INTEGER + 1 }]) {
    payload = candidate;
    await assert.rejects(forumApi.post(28), unexpected);
  }
  payload = [post, { ...post, title: 123 }];
  await assert.rejects(forumApi.posts(), unexpected);
});

test("non-string backend errors use safe fallback feedback", async () => {
  mock.method(globalThis, "fetch", async () => json({ error: { internal: "details" } }, 503));
  await assert.rejects(forumApi.post(28), { message: "We couldn’t load this transmission.", status: 503 });
});

test("post text containing HTML is returned as literal content", async () => {
  const literal = '<script>alert("test only")</script> & <b>stars</b> ✨';
  mock.method(globalThis, "fetch", async () => json({ ...post, body: literal }));
  assert.equal((await forumApi.post(28)).body, literal);
});

test("comment threads keep replies beside their parent and preserve sibling order", () => {
  const comments = [
    { id: 1, parent_comment_id: null },
    { id: 2, parent_comment_id: 1 },
    { id: 3, parent_comment_id: 1 },
    { id: 4, parent_comment_id: 2 },
    { id: 5, parent_comment_id: null },
  ];
  assert.deepEqual(commentThreads(comments).map(({ comment, depth }) => [comment.id, depth]), [
    [1, 0], [2, 1], [4, 2], [3, 1], [5, 0],
  ]);
  assert.equal(comments[1].parent_comment_id, 1);
});

test("orphans, self-replies, and cycles remain readable exactly once", () => {
  const comments = [
    { id: 1, parent_comment_id: 999 },
    { id: 2, parent_comment_id: 2 },
    { id: 3, parent_comment_id: 4 },
    { id: 4, parent_comment_id: 3 },
  ];
  const result = commentThreads(comments);
  assert.deepEqual(result.map(({ comment, depth }) => [comment.id, depth]), [[1, 0], [2, 0], [3, 0], [4, 1]]);
  assert.equal(new Set(result.map(({ comment }) => comment.id)).size, comments.length);
});

test("deep comment chains do not overflow the JavaScript call stack", () => {
  const size = 20000;
  const comments = Array.from({ length: size }, (_, index) => ({ id: index + 1, parent_comment_id: index || null }));
  const result = commentThreads(comments);
  assert.equal(result.length, size);
  assert.equal(result[0].depth, 0);
  assert.equal(result.at(-1).comment.id, size);
  assert.equal(result.at(-1).depth, size - 1);
});

test("time labels use a supplied clock and handle invalid timestamps", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  assert.equal(relativeTime("2026-11-08T11:59:45Z", now), "Just now");
  assert.equal(relativeTime("2026-11-08T11:58:00Z", now), "2 minutes ago");
  assert.equal(relativeTime("2026-11-08T09:00:00Z", now), "3 hours ago");
  assert.equal(relativeTime("2026-11-07T12:00:00Z", now), "yesterday");
  assert.equal(relativeTime("2026-11-09T12:00:00Z", now), "tomorrow");
  assert.equal(relativeTime("not-a-date", now), "Time unavailable");
});

test("missing optional joined names fall back to public IDs", () => {
  assert.equal(authorName(post), "u/cosmic_traveler");
  assert.equal(communityName(post), "s/firstcontact");
  assert.equal(authorName({ author_id: 5, author_username: null }), "User #5");
  assert.equal(communityName({ subreddit_id: 8 }), "Community #8");
});
