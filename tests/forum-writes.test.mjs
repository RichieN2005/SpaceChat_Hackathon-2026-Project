import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { forumApi } from "../src/lib/forum.js";
import { safeReturnTo } from "../src/lib/authNavigation.js";

const post = { id: 3, title: "A new orbit", body: "Hello from Earth." };
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => mock.restoreAll());

test("post create/edit mutations use JSON, the session cookie, and server-owned authorship", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json(post));
  const fields = { title: post.title, body: post.body, subreddit_id: 2 };
  assert.deepEqual(await forumApi.createPost(fields), post);
  await forumApi.updatePost(3, { title: "Edited", body: "Updated body" });
  for (const call of fetch.mock.calls) {
    const [, options] = call.arguments;
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(JSON.parse(options.body).author_id, undefined);
  }
  assert.equal(fetch.mock.calls[0].arguments[0], "/api/posts");
  assert.equal(fetch.mock.calls[0].arguments[1].method, "POST");
  assert.equal(fetch.mock.calls[1].arguments[0], "/api/posts/3");
  assert.equal(fetch.mock.calls[1].arguments[1].method, "PATCH");
});

test("post/comment deletion accepts an empty 204 response", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  assert.equal(await forumApi.deletePost(3), null);
  assert.equal(await forumApi.deleteComment(7), null);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url, options] }) => [url, options.method]), [["/api/posts/3", "DELETE"], ["/api/comments/7", "DELETE"]]);
});

test("comment replies and edits use the existing parent relationship", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json({ id: 8, body: "A reply" }));
  await forumApi.createComment(3, { body: "A reply", parent_comment_id: 7 });
  await forumApi.updateComment(8, { body: "Edited reply" });
  assert.equal(fetch.mock.calls[0].arguments[0], "/api/posts/3/comments");
  assert.deepEqual(JSON.parse(fetch.mock.calls[0].arguments[1].body), { body: "A reply", parent_comment_id: 7 });
  assert.equal(fetch.mock.calls[1].arguments[1].method, "PATCH");
});

test("votes can be added, changed, and removed without supplying a user ID", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json({ score: 2, user_vote: 1 }));
  for (const value of [1, -1, 0]) await forumApi.vote(3, value);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url, options] }) => [url, options.method, JSON.parse(options.body)]), [1, -1, 0].map((value) => ["/api/posts/3/vote", "PUT", { value }]));
});

test("memberships, profiles, community search, and author feeds use explicit API contracts", async () => {
  const fetch = mock.method(globalThis, "fetch", async (url) => json(url.includes("/posts?") || url.includes("?q=") ? [] : { id: 1 }));
  await forumApi.setMembership(2, { joined: true });
  await forumApi.setMembership(2, { joined: false });
  await forumApi.updateUser(1, { bio: "Hello, universe." });
  await forumApi.user(1);
  await forumApi.community(2);
  await forumApi.searchCommunities("space & stars");
  await forumApi.posts({ author: 1 });
  assert.equal(fetch.mock.calls[0].arguments[0], "/api/subreddits/2/membership");
  assert.deepEqual(JSON.parse(fetch.mock.calls[1].arguments[1].body), { joined: false });
  assert.equal(fetch.mock.calls[2].arguments[0], "/api/users/1");
  assert.equal(fetch.mock.calls[2].arguments[1].method, "PUT");
  assert.equal(new URL(fetch.mock.calls[5].arguments[0], "https://test.example").searchParams.get("q"), "space & stars");
  assert.equal(new URL(fetch.mock.calls[6].arguments[0], "https://test.example").searchParams.get("author_id"), "1");
});

test("write authorization errors preserve the 401/403 response for UI recovery", async () => {
  mock.method(globalThis, "fetch", async () => json({ error: "Forbidden" }, 403));
  await assert.rejects(forumApi.updateComment(8, { body: "x" }), { status: 403, message: "Forbidden" });
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => json({ error: "Login required" }, 401));
  await assert.rejects(forumApi.vote(3, 1), { status: 401, message: "Login required" });
});

test("authentication safely returns to contribution and discovery pages", () => {
  for (const destination of ["/submit?community=2", "/posts/3/edit", "/communities", "/communities/2", "/users/1", "/astrobot"]) assert.equal(safeReturnTo(destination), destination);
  for (const destination of ["//evil.example", "/submit/../login", "/login", "https://evil.example", "/users/nope"]) assert.equal(safeReturnTo(destination), "/");
});

test("AI chat sends only the explicitly submitted message", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json({ sender: "AstroBot", response: "Hello, Earthling." }));
  await forumApi.chat("Why is Neptune blue?");
  assert.equal(fetch.mock.calls[0].arguments[0], "/api/ai/chat");
  assert.deepEqual(JSON.parse(fetch.mock.calls[0].arguments[1].body), { message: "Why is Neptune blue?" });
});


test("AI errors retain quota categories and provider reset times", async () => {
  mock.method(globalThis, "fetch", async () => json({ error: "Daily AI allowance has been used up.", code: "ai_daily_usage_limit", retry_after: 3600 }, 429));
  await assert.rejects(forumApi.chat("Hello"), { status: 429, code: "ai_daily_usage_limit", retryAfter: 3600, message: "Daily AI allowance has been used up." });
});

test("AI proxy errors distinguish server failures from empty answers", async () => {
  mock.method(globalThis, "fetch", async () => new Response("<html>Bad gateway</html>", { status: 502 }));
  await assert.rejects(forumApi.chat("Hello"), (error) => error.status === 502 && /server is unavailable or restarting/.test(error.message));
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => new Response("<html>Gateway timeout</html>", { status: 504 }));
  await assert.rejects(forumApi.chat("Hello"), (error) => error.status === 504 && /too long/.test(error.message));
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => json({ response: " " }));
  await assert.rejects(forumApi.chat("Hello"), { code: "ai_empty_response" });
});

test("AI requests stop waiting after thirty seconds and can be retried", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let sentSignal;
  mock.method(globalThis, "fetch", (_path, options) => new Promise((_resolve, reject) => {
    sentSignal = options.signal;
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  const request = forumApi.chat("Hello");
  const assertion = assert.rejects(request, { status: 504, code: "ai_timeout" });
  context.mock.timers.tick(30000);
  await assertion;
  assert.equal(sentSignal.aborted, true);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => json({ response: "Signal received." }));
  assert.equal((await forumApi.chat("Hello again")).response, "Signal received.");
});

test("AI timeout also covers a stalled response body", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let fetchSignal;
  mock.method(globalThis, "fetch", async (_path, options) => {
    fetchSignal = options.signal;
    return { status: 200, ok: true, json: () => new Promise((_resolve, reject) => {
      fetchSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }) };
  });
  const request = forumApi.chat("Hello");
  const assertion = assert.rejects(request, { status: 504, code: "ai_timeout" });
  await Promise.resolve();
  await Promise.resolve();
  context.mock.timers.tick(30000);
  await assertion;
});

test("AI caller cancellation remains an abort rather than a timeout", async () => {
  const controller = new AbortController();
  mock.method(globalThis, "fetch", (_path, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  const request = forumApi.chat("Hello", controller.signal);
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
});
