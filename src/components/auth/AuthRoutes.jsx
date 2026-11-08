import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthProvider";

function SessionCheck() {
  const { status, error, refresh } = useAuth();
  return (
    <main className="grid min-h-dvh place-items-center bg-space px-6 text-center text-starlight">
      <div>
        {status === "error" ? <>
          <h1 className="text-2xl font-medium">We couldn’t check your session.</h1>
          <p className="mt-4 max-w-md text-sm text-[#b7b5b7]" role="alert">{error}</p>
          <button type="button" onClick={() => refresh()} className="mt-6 rounded bg-signal px-6 py-3 font-medium text-space">Try again</button>
        </> : <p role="status" className="font-mono text-sm text-[#d0bbb3]">Checking your signal…</p>}
      </div>
    </main>
  );
}

export function GuestOnly() {
  const { status } = useAuth();
  // A session-service outage must not hide the public landing or auth forms.
  if (status === "loading") return <SessionCheck />;
  return status === "authenticated" ? <Navigate to="/home" replace /> : <Outlet />;
}

export function RequireAuth() {
  const { status } = useAuth();
  if (status === "loading" || status === "error") return <SessionCheck />;
  return status === "authenticated" ? <Outlet /> : <Navigate to="/login" replace />;
}

export function DefaultRoute() {
  const { status } = useAuth();
  if (status === "loading") return <SessionCheck />;
  return <Navigate to={status === "authenticated" ? "/home" : "/"} replace />;
}
