import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createServer } from 'vite';

let server;
let App;
let AuthProvider;
let VoteButtons;
let MoonScene;
let ForumDialog;
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  App = (await server.ssrLoadModule('/src/app/app.jsx')).default;
  AuthProvider = (await server.ssrLoadModule('/src/components/auth/AuthProvider.jsx')).AuthProvider;
  VoteButtons = (await server.ssrLoadModule('/src/components/forum/VoteButtons.jsx')).default;
  MoonScene = (await server.ssrLoadModule('/src/components/landing/visuals.jsx')).MoonScene;
  ForumDialog = (await server.ssrLoadModule('/src/app/ForumDialog.jsx')).default;
});
after(async () => { await server?.close(); });

function render(element, path = '/') {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, element));
}

test('landing renders its hero and moon without undefined merge leftovers', () => {
  const html = render(createElement(App), '/landing');
  assert.match(html, /Your next/);
  assert.match(html, /data-moon-image/);
  assert.match(html, /Log in/);
  assert.match(html, /Sign up/);
});

test('forum shows both guest account links before session restoration completes', () => {
  const html = render(createElement(App));
  const account = /<nav aria-label="Account"[^>]*>(.*?)<\/nav>/.exec(html)?.[1];
  assert.ok(account);
  assert.match(account, /href="\/login"/);
  assert.match(account, /href="\/signup"/);
});

test('vote directions have visible labels and separate totals', () => {
  const html = render(createElement(AuthProvider, null, createElement(VoteButtons, { post: { id: 1, upvotes: 12, downvotes: 3, user_vote: 0 } })));
  assert.match(html, /<span>Upvote<\/span>/);
  assert.match(html, /<span>Downvote<\/span>/);
  assert.match(html, /12 upvotes/);
  assert.match(html, /3 downvotes/);
  assert.equal((html.match(/aria-pressed="false"/g) || []).length, 2);
});

test('moon rotation wrapper remains separate from its entrance animation', () => {
  const html = render(createElement(MoonScene, { showAuth: false }));
  assert.match(html, /data-moon-spin/);
  assert.match(html, /Click or drag/);
  assert.doesNotMatch(html, /LAND ON THE MOON/);
});

test('sample community posts open details and a working composer in the preview dialog', () => {
  const community = { id: 'earthlings', title: 'Earth', handle: 's/earthlings', posts: ['A sample transmission'] };
  const detail = render(createElement(ForumDialog, { community, initialPostId: 'first', onClose() {} }));
  assert.match(detail, /A sample transmission/);
  assert.match(detail, /Back to community posts/);
  assert.match(detail, /Reply to A sample transmission/);
  const composer = render(createElement(ForumDialog, { community, initiallyComposing: true, onClose() {} }));
  assert.match(composer, /Give your post a title/);
  assert.match(composer, /Transmit post/);
});
