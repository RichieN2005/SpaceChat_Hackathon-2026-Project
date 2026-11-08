import { Navigate, Route, Routes } from "react-router";
import LandingPage from "../pages/LandingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />
      {/* Preserve the existing /about URL while the forum is in development. */}
      <Route path="/about" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
