"use client";

import { useState } from "react";

interface SaveMatchButtonProps {
  matchId: string;
  matchDate: string;
  saved?: boolean;
}

export function SaveMatchButton({
  matchId,
  matchDate,
  saved = false,
}: SaveMatchButtonProps) {
  const [isSaved, setIsSaved] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleSaved() {
    setBusy(true);
    setMessage("");

    const response = isSaved
      ? await fetch(
          `/api/community/saved?matchId=${encodeURIComponent(matchId)}`,
          { method: "DELETE" },
        )
      : await fetch("/api/community/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, matchDate }),
        });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      setIsSaved((current) => !current);
    } else {
      setMessage(result.error || "Could not update saved matches.");
    }

    setBusy(false);
  }

  return (
    <button
      className="chip"
      type="button"
      disabled={busy}
      onClick={() => void toggleSaved()}
      aria-pressed={isSaved}
    >
      {isSaved ? "★ Saved" : "☆ Save match"}
      {message ? ` · ${message}` : ""}
    </button>
  );
}
