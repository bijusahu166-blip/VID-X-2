import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[LITLink] Runtime error caught by ErrorBoundary:", error.message);
    console.error("[LITLink] Stack:", error.stack);
    console.error("[LITLink] Component stack:", info.componentStack);
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

