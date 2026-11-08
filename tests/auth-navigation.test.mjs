import assert from "node:assert/strict";
import { test } from "node:test";
import { authNavigationState, safeReturnTo } from "../src/lib/authNavigation.js";

test("login destinations preserve public feed and post context", () => {
  for (const destination of ["/", "/?community=3&sort=new#compose", "/posts/42", "/posts/42?reply=9#comments"]) {
    assert.equal(safeReturnTo(destination), destination);
  }
});

test("login destinations cannot leave the site or loop through auth routes", () => {
  for (const destination of [undefined, null, {}, "", "https://example.com/", "//example.com/", "/\\example.com/", "/login", "/signup?returnTo=/", "/landing", "/posts/0", "/posts/42/../../login", "/posts/not-an-id", "/\n/evil.example", "/%2fexample.com"]) {
    assert.equal(safeReturnTo(destination), "/");
  }
});

test("auth switches retain the reading destination without retaining transient notices", () => {
  assert.deepEqual(authNavigationState({ returnTo: "/posts/42#comments", signupComplete: true }), { returnTo: "/posts/42#comments" });
  assert.deepEqual(authNavigationState({ returnTo: "//example.com" }), { returnTo: "/" });
});

test("auth switches preserve moon history and keep direct visits distinct from feed visits", () => {
  assert.deepEqual(authNavigationState({ fromOrbit: true, signupComplete: true }), { fromOrbit: true });
  assert.equal(authNavigationState(null), null);
  assert.equal(authNavigationState({ signupComplete: true }), null);
});
