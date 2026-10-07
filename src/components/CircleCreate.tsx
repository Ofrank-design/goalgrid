"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CircleCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createCircle() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/community/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error || "Could not create the circle.");
        return;
      }

      setName("");
      setDescription("");
      setMessage("Circle created.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <b>Create a private circle</b>

      <input
        className="in"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        placeholder="Circle name"
        aria-label="Circle name"
      />

      <textarea
        className="in"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Description"
        aria-label="Circle description"
      />

      <div className="row" style={{ margin: 0 }}>
        <span className="note">Members-only</span>
        <button
          className="btn p sm"
          type="button"
          disabled={busy || name.trim().length < 3}
          onClick={() => void createCircle()}
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </div>

      {message && <span className="note" role="status">{message}</span>}
    </div>
  );
}
