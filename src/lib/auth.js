export class AuthApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

async function request(endpoint, { method = "GET", data, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api/auth/${endpoint}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", ...(data ? { "Content-Type": "application/json" } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new AuthApiError("We couldn’t connect. Please try again.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AuthApiError("The service is unavailable right now. Please try again.", response.status);
  }
  if (!response.ok) {
    throw new AuthApiError(
      typeof payload?.error === "string" ? payload.error : "Something went wrong. Please try again.",
      response.status,
    );
  }
  return payload;
}

function requireUser(payload) {
  const user = payload?.user;
  if (!user || !Number.isSafeInteger(user.id) || user.id < 1 || typeof user.username !== "string") {
    throw new AuthApiError("We couldn’t verify your session. Please try again.");
  }
  return user;
}

export const authApi = {
  async me(signal) {
    return requireUser(await request("me", { signal }));
  },
  async login({ identifier, password }) {
    return requireUser(await request("login", { method: "POST", data: { identifier, password } }));
  },
  async signup({ username, email, password }) {
    return request("register", { method: "POST", data: { username, email, password } });
  },
  async logout() {
    await request("logout", { method: "POST", data: {} });
  },
};
