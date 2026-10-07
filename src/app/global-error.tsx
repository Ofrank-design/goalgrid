"use client";
import { useEffect } from "react";

/** Last resort: replaces the root layout, so it carries its own document and minimal inline styling. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en"><body style={{ margin: 0, background: "#0b1620", color: "#e6eef3", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div role="alert" style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 22 }}>GoalGrid hit a problem</h1>
        <p style={{ color: "#9fb2bf" }}>The page could not be shown. It has been logged. Please try again.</p>
        {error.digest ? <p style={{ fontSize: 12, color: "#9fb2bf" }}>Reference: <code>{error.digest}</code></p> : null}
        <button onClick={reset} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 12, border: 0, background: "#00e676", color: "#04210f", fontWeight: 700, cursor: "pointer" }}>Try again</button>
      </div>
    </body></html>
  );
}
