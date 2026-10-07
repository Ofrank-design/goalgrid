"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ComposerProps {
  matchId?: string;
  parentId?: string;
  circleId?: string;
  placeholder: string;
  compact?: boolean;
}

export function Composer({
  matchId,
  parentId,
  circleId,
  placeholder,
  compact,
}: ComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendPost() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: matchId ?? null,
          parentId: parentId ?? null,
          circleId: circleId ?? null,
          body,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Could not post that message.");
        return;
      }

      setBody("");
      router.refresh();
    } catch {
      setMessage("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea
        className="in"
        rows={compact ? 2 : 3}
        maxLength={500}
        placeholder={placeholder}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label={placeholder}
      />

      <div className="row" style={{ margin: 0 }}>
        <span className="note">{body.length}/500</span>
        <button
          className="btn p sm"
          type="button"
          disabled={busy || !body.trim()}
          onClick={() => void sendPost()}
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>

      {message && (
        <div className="msg" role="status" style={{ color: "#ff5d5d" }}>
          {message}
        </div>
      )}
    </div>
  );
}
