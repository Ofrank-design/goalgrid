"use client";

import { useState } from "react";

interface BookingActionsProps {
  id: string;
  username: string;
  likes: number;
  comments: number;
  canAct: boolean;
  mine: boolean;
}

export function BookingActions({
  id,
  username,
  likes,
  comments,
  canAct,
  mine,
}: BookingActionsProps) {
  const [likeCount, setLikeCount] = useState(likes);
  const [message, setMessage] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");

  async function postAction(path: string, body: object) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return {
      ok: response.ok,
      result: await response.json().catch(() => ({})),
    };
  }

  async function toggleLike() {
    const { ok, result } = await postAction(
      `/api/community/bookings/${id}`,
      { action: "like" },
    );

    if (ok) {
      setLikeCount((count) => count + (result.liked ? 1 : -1));
    } else {
      setMessage(result.error ?? "Could not update the like.");
    }
  }

  async function reportShare() {
    const { ok, result } = await postAction(
      `/api/community/bookings/${id}`,
      { action: "report", category: "other" },
    );

    setMessage(
      ok
        ? "Reported. Thank you."
        : result.error ?? "Could not report the share.",
    );
  }

  async function blockUser() {
    const { ok, result } = await postAction("/api/community/social", {
      username,
      action: "block",
    });

    setMessage(
      ok
        ? "User blocked. Refresh to update your feed."
        : result.error ?? "Could not block the user.",
    );
  }

  async function addComment() {
    const { ok, result } = await postAction(
      `/api/community/bookings/${id}`,
      { action: "comment", body: comment },
    );

    setMessage(
      ok ? "Comment added." : result.error ?? "Could not add the comment.",
    );

    if (ok) {
      setComment("");
      setCommentsOpen(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="chips" style={{ alignItems: "center" }}>
        <button
          className="chip"
          type="button"
          disabled={!canAct}
          onClick={() => void toggleLike()}
        >
          Like {likeCount}
        </button>

        <button
          className="chip"
          type="button"
          disabled={!canAct}
          onClick={() => setCommentsOpen((open) => !open)}
        >
          Comment {comments}
        </button>

        {canAct && !mine && (
          <>
            <button className="chip" type="button" onClick={() => void reportShare()}>
              Report
            </button>
            <button className="chip" type="button" onClick={() => void blockUser()}>
              Block user
            </button>
          </>
        )}

        {message && <span className="note" role="status">{message}</span>}
      </div>

      {commentsOpen && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            className="in"
            maxLength={300}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Add a comment"
            aria-label="Comment"
          />
          <button
            className="btn sm"
            type="button"
            disabled={!comment.trim()}
            onClick={() => void addComment()}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
