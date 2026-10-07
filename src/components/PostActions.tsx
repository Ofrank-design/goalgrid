"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PostActionsProps {
  postId: string;
  likes: number;
  mine: boolean;
  canAct: boolean;
}

export function PostActions({
  postId,
  likes,
  mine,
  canAct,
}: PostActionsProps) {
  const router = useRouter();
  const [likeCount, setLikeCount] = useState(likes);
  const [message, setMessage] = useState<string | null>(null);

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

  async function likePost() {
    const { ok, result } = await postAction("/api/community/like", {
      postId,
    });

    if (ok) {
      setLikeCount((count) => count + (result.liked ? 1 : -1));
    } else {
      setMessage(result.error ?? "Could not update the like.");
    }
  }

  async function reportPost() {
    const { ok, result } = await postAction("/api/community/report", {
      postId,
    });

    setMessage(
      ok ? "Reported. Thank you." : result.error ?? "Could not report the post.",
    );
  }

  async function deletePost() {
    const { ok } = await postAction("/api/community/delete", { postId });

    if (ok) {
      router.refresh();
    }
  }

  return (
    <div className="chips" style={{ marginTop: 8, alignItems: "center" }}>
      <button
        className="chip"
        type="button"
        disabled={!canAct}
        onClick={() => void likePost()}
        aria-label="Like post"
      >
        Like {likeCount}
      </button>

      {canAct && !mine && (
        <button className="chip" type="button" onClick={() => void reportPost()}>
          Report
        </button>
      )}

      {mine && (
        <button className="chip" type="button" onClick={() => void deletePost()}>
          Delete
        </button>
      )}

      {message && <span className="note" role="status">{message}</span>}
    </div>
  );
}
