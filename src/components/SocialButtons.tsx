"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface SocialButtonsProps {
  username: string;
  following: boolean;
  blocked: boolean;
  muted: boolean;
}

export function SocialButtons({
  username,
  following,
  blocked,
  muted,
}: SocialButtonsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function updateSocialState(action: string) {
    const response = await fetch("/api/community/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, action }),
    });

    if (response.ok) {
      router.refresh();
      return;
    }

    const result = await response.json().catch(() => ({}));
    setMessage(result.error ?? "Could not update that setting.");
  }

  return (
    <div className="chips" style={{ alignItems: "center" }}>
      {!blocked && (
        <button
          className="chip"
          type="button"
          onClick={() =>
            void updateSocialState(following ? "unfollow" : "follow")
          }
        >
          {following ? "Following" : "Follow"}
        </button>
      )}

      <button
        className="chip"
        type="button"
        onClick={() => void updateSocialState(muted ? "unmute" : "mute")}
      >
        {muted ? "Unmute" : "Mute"}
      </button>

      <button
        className="chip"
        type="button"
        onClick={() =>
          void updateSocialState(blocked ? "unblock" : "block")
        }
      >
        {blocked ? "Unblock" : "Block"}
      </button>

      {message && <span className="note" role="status">{message}</span>}
    </div>
  );
}
