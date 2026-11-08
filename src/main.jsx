
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import AstroBotChat from "./components/AstroBotChat";
import App from "./app/app.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <AstroBotChat />
    </BrowserRouter>
  </React.StrictMode>
);
