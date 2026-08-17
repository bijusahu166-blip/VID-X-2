import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Component, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";

// ── GLOBAL API FETCH PATCH ───────────────────────────────────────────────
// Native app (Capacitor) loads from capacitor://localhost, so relative fetch
// paths like "/api/..." used all over the app (Home.tsx, Profile.tsx, etc.)
// don't reach the real backend. This intercepts every fetch() call and
// rewrites relative "/api/..." paths to the full backend URL — but ONLY
// inside the native app. The website is untouched.
// ⚠️ Set this to your real backend domain.
const API_BASE = "https://iqpartner.xyz";

if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = `${API_BASE}${input}`;
    } else if (input instanceof Request && input.url.startsWith("/api/")) {
      input = new Request(`${API_BASE}${input.url}`, input);
    }
    return originalFetch(input, init);
  };
}
// ── END PATCH ─────────────────────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[iqpartner] Runtime error caught by ErrorBoundary:", error.message);
    console.error("[iqpartner] Stack:", error.stack);
    console.error("[iqpartner] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: 24, background: "#0a0a0a", color: "#fff", minHeight: "100vh", fontFamily: "monospace" }}>
          <h2 style={{ color: "#f87171", fontSize: 18, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#fca5a5", marginBottom: 16 }}>{err.message}</p>
          <pre style={{ fontSize: 11, color: "#888", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {err.stack}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: 20, padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);