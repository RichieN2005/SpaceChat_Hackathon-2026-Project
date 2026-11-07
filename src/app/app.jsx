
import { Routes, Route } from "react-router";

function Home() {
  return <h1 className="text-3xl font-bold">Home</h1>;
}

function About() {
  return <h1 className="text-3xl font-bold">About</h1>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
    </Routes>
  );
}
