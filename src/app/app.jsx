import { Navigate, Route, Routes } from "react-router";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import useOrbitReturn from "../components/auth/useOrbitReturn";
import { AuthProvider } from "../components/auth/AuthProvider";
import { DefaultRoute, GuestOnly } from "../components/auth/AuthRoutes";
import HomePage from "../pages/HomePage";
import PostPage from "../pages/PostPage";

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}

function AppRoutes() {
  const returnFromSurface = useOrbitReturn();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/posts/:postId" element={<PostPage />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/landing" element={<LandingPage returnFromSurface={returnFromSurface} />} />
      <Route path="/about" element={<LandingPage returnFromSurface={returnFromSurface} />} />
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route path="*" element={<DefaultRoute />} />
    </Routes>
  );
}
