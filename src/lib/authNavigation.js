// Authentication can return to recognized app routes, never another auth page
// or an external URL supplied through history state.
export function safeReturnTo(destination) {
  if (typeof destination !== "string" || /[\u0000-\u0020\u007f\\]/.test(destination)) return "/";
  const pathname = destination.split(/[?#]/, 1)[0];
  return pathname === "/" || ["/submit", "/communities", "/astrobot"].includes(pathname)
    || /^\/posts\/[1-9]\d*(?:\/edit)?\/?$/.test(pathname)
    || /^\/(?:communities|users)\/[1-9]\d*\/?$/.test(pathname) ? destination : "/";
}

export function authNavigationState(state) {
  const next = {};
  if (state?.fromOrbit === true) next.fromOrbit = true;
  if (state && Object.hasOwn(state, "returnTo")) next.returnTo = safeReturnTo(state.returnTo);
  return Object.keys(next).length ? next : null;
}
