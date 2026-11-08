// Authentication can return to recognized app routes, never another auth page
// or an external URL supplied through history state.
export function safeReturnTo(destination) {
  if (typeof destination !== "string" || /[\u0000-\u0020\u007f\\]/.test(destination)) return "/";
  const pathname = destination.split(/[?#]/, 1)[0];
  return pathname === "/" || ["/home", "/submit", "/communities", "/astrobot"].includes(pathname)
    || /^\/posts\/[1-9]\d*(?:\/edit)?\/?$/.test(pathname)
    || /^\/(?:communities|users)\/[1-9]\d*\/?$/.test(pathname) ? destination : "/";
}

export function authNavigationState(state) {
  const next = {};
  if (state?.fromOrbit === true) next.fromOrbit = true;
  if (state && Object.hasOwn(state, "returnTo")) next.returnTo = safeReturnTo(state.returnTo);
  if (state && Object.hasOwn(state, "cancelTo")) next.cancelTo = authCancelDestination(state);
  return Object.keys(next).length ? next : null;
}

// Leaving authentication must lead somewhere a guest can actually visit.
// Keep returnTo separate: it may point at a protected page after login.
export function authCancelDestination(state) {
  const requested = state?.cancelTo ?? state?.returnTo;
  if (requested === "/landing") return "/landing";
  const destination = safeReturnTo(requested);
  const pathname = destination.split(/[?#]/, 1)[0];
  if (pathname === "/submit") {
    const community = new URLSearchParams(destination.split("?")[1]?.split("#")[0]).get("community");
    return /^[1-9]\d*$/.test(community || "") ? `/communities/${community}` : "/home";
  }
  const editing = /^\/posts\/([1-9]\d*)\/edit\/?$/.exec(pathname);
  if (editing) return `/posts/${editing[1]}`;
  return pathname === "/astrobot" ? "/home" : destination;
}

// Wait for session restoration before choosing the site's initial destination.
export function defaultDestination(status) {
  if (status === "loading") return null;
  return status === "authenticated" ? "/home" : "/landing";
}
