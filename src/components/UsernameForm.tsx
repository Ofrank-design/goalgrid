"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useState } from "react";

export function UsernameForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveUsername() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        router.refresh();
      } else {
        setMessage(result.error ?? "Could not save your username.");
      }
    } catch {
      setMessage("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && username) {
      void saveUsername();
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <b>Choose your username</b>
      <p className="note" style={{ margin: "6px 0 12px" }}>
        This is the name other fans see on your posts and on the leaderboard.
        Use 3 to 20 letters, numbers or underscores.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="in"
          aria-label="Username"
          placeholder="your_name"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          onKeyDown={handleKeyDown}
        />
        <button
          className="btn p sm"
          type="button"
          disabled={busy || username.length < 3}
          onClick={() => void saveUsername()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      {message && (
        <div
          className="msg"
          role="status"
          style={{ color: "#ff5d5d", marginTop: 8 }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
