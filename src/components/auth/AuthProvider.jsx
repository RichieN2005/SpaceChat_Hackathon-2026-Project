import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authApi } from "../../lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ status: "loading", user: null, error: "" });
  const requestId = useRef(0);

  const refresh = useCallback(async (signal) => {
    const id = ++requestId.current;
    setSession((previous) => ({ ...previous, status: "loading", error: "" }));
    try {
      const user = await authApi.me(signal);
      if (id === requestId.current) setSession({ status: "authenticated", user, error: "" });
    } catch (error) {
      if (error.name === "AbortError" || id !== requestId.current) return;
      setSession(error.status === 401
        ? { status: "anonymous", user: null, error: "" }
        : { status: "error", user: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => {
      controller.abort();
      requestId.current += 1;
    };
  }, [refresh]);

  async function authenticate(action, fields) {
    const user = await authApi[action](fields);
    requestId.current += 1;
    setSession({ status: "authenticated", user, error: "" });
    return user;
  }

  async function logout() {
    await authApi.logout();
    requestId.current += 1;
    setSession({ status: "anonymous", user: null, error: "" });
  }

  return (
    <AuthContext.Provider value={{ ...session, refresh, logout, login: (fields) => authenticate("login", fields), signup: (fields) => authenticate("signup", fields) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
