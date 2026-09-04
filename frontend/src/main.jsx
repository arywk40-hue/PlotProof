import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import CapturePage from "./pages/CapturePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import { CONFIG_ERROR } from "./lib/config.js";
import "./styles/tokens.css";
import "./styles/global.css";

function Shell() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <Link to="/" className="brand">
            PlotProof
          </Link>
          <nav className="topnav">
            <Link to="/capture">Submit a plot</Link>
            <Link to="/dashboard">Look up a record</Link>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/capture" element={<CapturePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function ConfigurationError() {
  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 30 }}>PlotProof is not configured</h1>
      <p>The application was stopped before it could connect to a backend or contract.</p>
      <div className="ledger-card" role="alert">
        <span className="mono">{CONFIG_ERROR}</span>
      </div>
      <p style={{ marginTop: 20 }}>Set the required `VITE_*` variables in `frontend/.env` and restart the app.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{CONFIG_ERROR ? <ConfigurationError /> : <Shell />}</React.StrictMode>
);
