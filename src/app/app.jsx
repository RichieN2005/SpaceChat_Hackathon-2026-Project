import { Navigate, Route, Routes, useLocation } from "react-router";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import useOrbitReturn from "../components/auth/useOrbitReturn";
import { AuthProvider } from "../components/auth/AuthProvider";
import { DefaultRoute, GuestOnly, RequireAuth } from "../components/auth/AuthRoutes";
import HomePage from "../pages/HomePage";
import PostPage from "../pages/PostPage";
import PostEditorPage from "../pages/PostEditorPage";
import CommunitiesPage from "../pages/CommunitiesPage";
import CommunityPage from "../pages/CommunityPage";
import ProfilePage from "../pages/ProfilePage";
import AstroBotChat from "../components/AstroBotChat";
import AstroBotPage from "../pages/AstroBotPage";

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}

function AppRoutes() {
  const returnFromSurface = useOrbitReturn();
  const location = useLocation();
  const activePostId = /^\/posts\/(\d+)\/?$/.exec(location.pathname)?.[1] || null;
  return (
    <>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/posts/:postId" element={<PostPage />} />
      <Route path="/communities" element={<CommunitiesPage />} />
      <Route path="/communities/:communityId" element={<CommunityPage />} />
      <Route path="/users/:userId" element={<ProfilePage />} />
      <Route element={<RequireAuth />}>
        <Route path="/submit" element={<PostEditorPage key="create" />} />
        <Route path="/posts/:postId/edit" element={<PostEditorPage key="edit" />} />
        <Route path="/astrobot" element={<AstroBotPage />} />
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/landing" element={<LandingPage returnFromSurface={returnFromSurface} />} />
      <Route path="/about" element={<LandingPage returnFromSurface={returnFromSurface} />} />
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route path="*" element={<DefaultRoute />} />
    </Routes>
    <AstroBotChat postId={activePostId} onThreadReply={() => window.dispatchEvent(new Event("astrobot:reply"))} />
    </>
  );
}
