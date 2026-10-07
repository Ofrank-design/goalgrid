"use client";

import { useState } from "react";

export function ControlPlaneActions() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function syncRegistry() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/control-plane", {
        method: "POST",
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error || "The registry sync failed.");
        return;
      }

      setMessage(
        `Synced ${result.syncedLeagues?.length ?? 0} leagues.`,
      );
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chips" style={{ marginTop: 12 }}>
      <button
        className="btn sm"
        type="button"
        disabled={busy}
        onClick={() => void syncRegistry()}
      >
        {busy ? "Syncing…" : "Sync model and provider registry"}
      </button>

      {message && <span className="note" role="status">{message}</span>}
    </div>
  );
}
