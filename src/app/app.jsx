import { Navigate, Route, Routes } from "react-router";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import useOrbitReturn from "../components/auth/useOrbitReturn";

export default function App() {
  const returnFromSurface = useOrbitReturn();
  return (
    <Routes>
      <Route path="/" element={<LandingPage returnFromSurface={returnFromSurface} />} />
      <Route path="/landing" element={<LandingPage returnFromSurface={returnFromSurface} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      {/* Preserve the existing /about URL while the forum is in development. */}
      <Route path="/about" element={<LandingPage returnFromSurface={returnFromSurface} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
