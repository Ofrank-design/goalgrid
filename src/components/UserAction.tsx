"use client";

import { useState } from "react";

import { ModActions } from "./ModActions";

export function UserAction({ admin }: { admin: boolean }) {
  const [usernameInput, setUsernameInput] = useState("");
  const username = usernameInput.trim().toLowerCase().replace(/^@/, "");
  const validUsername = /^[a-z0-9_]{3,20}$/.test(username);

  return (
    <div className="card">
      <input
        className="in"
        placeholder="Username"
        value={usernameInput}
        onChange={(event) => setUsernameInput(event.target.value)}
        aria-label="Username"
      />

      {validUsername && (
        <ModActions
          type="user"
          id={username}
          actions={admin
            ? ["warn", "suspend", "ban", "unban"]
            : ["warn", "suspend"]}
          admin={admin}
        />
      )}
    </div>
  );
}
