"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CircleMemberManager({ circleId }: { circleId: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function addMember() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/community/circles/${circleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          username: username.trim().toLowerCase(),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error || "Could not add the member.");
        return;
      }

      setUsername("");
      setMessage("Member added.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <b>Invite a member</b>

      <div className="row" style={{ margin: 0 }}>
        <input
          className="in"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          maxLength={20}
          placeholder="username"
          aria-label="Username to invite"
        />
        <button
          className="btn sm p"
          type="button"
          disabled={busy || username.trim().length < 3}
          onClick={() => void addMember()}
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>

      {message && (
        <span className="note" role="status">
          {message}
        </span>
      )}

      <span className="note">
        Only the circle owner can add members. The new member receives an
        in-app notification.
      </span>
    </div>
  );
}
