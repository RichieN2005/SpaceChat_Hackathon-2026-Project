import { Route, Routes } from "react-router";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import useOrbitReturn from "../components/auth/useOrbitReturn";
import { AuthProvider } from "../components/auth/AuthProvider";
import { DefaultRoute, GuestOnly, RequireAuth } from "../components/auth/AuthRoutes";
import HomePage from "../pages/HomePage";

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}

function AppRoutes() {
  const returnFromSurface = useOrbitReturn();
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/" element={<LandingPage returnFromSurface={returnFromSurface} />} />
        <Route path="/landing" element={<LandingPage returnFromSurface={returnFromSurface} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/about" element={<LandingPage returnFromSurface={returnFromSurface} />} />
      </Route>
      <Route element={<RequireAuth />}><Route path="/home" element={<HomePage />} /></Route>
      <Route path="*" element={<DefaultRoute />} />
    </Routes>
  );
}
