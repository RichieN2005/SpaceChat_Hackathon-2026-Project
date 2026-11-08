import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { authApi, AuthApiError } from "../src/lib/auth.js";

const user = { id: 7, username: "test_traveler", bio: null };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => mock.restoreAll());

test("session restoration uses the server cookie, without a cached response", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json({ user }));
  assert.deepEqual(await authApi.me(), user);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, "/api/auth/me");
  assert.equal(options.credentials, "same-origin");
  assert.equal(options.cache, "no-store");
  assert.equal(options.body, undefined);
});

test("login sends the backend's identifier field and returns its public user", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json({ user }));
  assert.deepEqual(await authApi.login({ identifier: "test_traveler", password: "test-password" }), user);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, "/api/auth/login");
  assert.equal(options.method, "POST");
  assert.deepEqual(JSON.parse(options.body), { identifier: "test_traveler", password: "test-password" });
});

test("signup registers first, then establishes a session with login", async () => {
  const fetch = mock.method(globalThis, "fetch", async (url) => url.endsWith("register") ? json(user, 201) : json({ user }));
  const fields = { username: "test_traveler", email: "traveler@example.com", password: "test-password" };
  assert.deepEqual(await authApi.signup(fields), user);
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(fetch.mock.calls[0].arguments[0], "/api/auth/register");
  assert.deepEqual(JSON.parse(fetch.mock.calls[0].arguments[1].body), fields);
  assert.equal(fetch.mock.calls[1].arguments[0], "/api/auth/login");
  assert.deepEqual(JSON.parse(fetch.mock.calls[1].arguments[1].body), { identifier: fields.email, password: fields.password });
});

test("duplicate signup displays the backend error and never attempts login", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json({ error: "Username or email already exists" }, 409));
  await assert.rejects(authApi.signup({ username: "taken", email: "taken@example.com", password: "test-password" }), { message: "Username or email already exists", status: 409 });
  assert.equal(fetch.mock.callCount(), 1);
});

test("a registered account with a failed auto-login gets actionable feedback", async () => {
  mock.method(globalThis, "fetch", async (url) => url.endsWith("register") ? json(user, 201) : json({ error: "Invalid credentials" }, 401));
  await assert.rejects(authApi.signup({ username: "test_traveler", email: "traveler@example.com", password: "test-password" }), /account was created.*Please log in/);
});

test("an expired or anonymous session preserves the 401 status for the guard", async () => {
  mock.method(globalThis, "fetch", async () => json({ error: "Login required" }, 401));
  await assert.rejects(authApi.me(), (error) => error instanceof AuthApiError && error.status === 401);
});

test("a malformed success response cannot authenticate a user", async () => {
  mock.method(globalThis, "fetch", async () => json({ user: { username: "missing_id" } }));
  await assert.rejects(authApi.login({ identifier: "someone", password: "test-password" }), /couldn’t verify your session/);
});

test("reverse proxy HTML errors become readable errors rather than JSON exceptions", async () => {
  mock.method(globalThis, "fetch", async () => new Response("<html>Unavailable</html>", { status: 502 }));
  await assert.rejects(authApi.me(), { message: "The service is unavailable right now. Please try again.", status: 502 });
});

test("network failures are actionable and aborts remain aborts", async () => {
  mock.method(globalThis, "fetch", async () => { throw new TypeError("Network error"); });
  await assert.rejects(authApi.me(), /couldn’t connect/);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => { throw new DOMException("Cancelled", "AbortError"); });
  await assert.rejects(authApi.me(), { name: "AbortError" });
});

test("logout revokes the server session using a JSON POST", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json({ message: "Logged out" }));
  await authApi.logout();
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, "/api/auth/logout");
  assert.equal(options.method, "POST");
  assert.equal(options.credentials, "same-origin");
  assert.deepEqual(JSON.parse(options.body), {});
});
