"use client";

import { useState } from "react";

type LabContext = {
  game: string;
  source: string;
  range: string;
  window: number;
  threshold: number;
};

type AskResult = {
  answer?: { text: string; facts: string[] }[];
  limitations?: string;
  sample?: number;
  runRef?: string;
  engineVersion?: string;
  note?: string;
  usedModel?: string | null;
  error?: string;
  message?: string;
  small?: boolean;
  delayed?: boolean;
};

type VerificationResult = {
  status?: string;
  message?: string;
  algorithm?: string;
  derived?: string;
  expected?: string;
  match?: boolean;
  error?: string;
};

async function postLabRequest(path: string, body: object) {
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

export function AskLab(context: LabContext) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  async function askQuestion() {
    setBusy(true);

    const { result: response } = await postLabRequest("/api/lab/ask", {
      ...context,
      question,
    });

    setResult(response);
    setBusy(false);
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <b>Ask the Lab</b>
      <p className="note">
        Answers use the stored observations above. The Lab will not invent
        missing values or claim to know what comes next.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="in"
          style={{ flex: 1 }}
          maxLength={300}
          placeholder="What changed in this sample?"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-label="Question"
        />
        <button
          className="btn p sm"
          type="button"
          disabled={busy || question.trim().length < 5}
          onClick={() => void askQuestion()}
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </div>

      {result &&
        (result.error || result.message ? (
          <p className="note" role="alert">
            {result.error ?? result.message}
          </p>
        ) : (
          <div>
            {result.answer?.map((answer, index) => (
              <p key={index} style={{ margin: "6px 0" }}>
                • {answer.text}{" "}
                <span className="note">[{answer.facts.join(", ")}]</span>
              </p>
            ))}

            {result.small && (
              <p className="note">
                Small sample: treat these results with extra caution.
              </p>
            )}
            {result.delayed && (
              <p className="note">Data is currently delayed.</p>
            )}
            {result.limitations && (
              <p className="note">{result.limitations}</p>
            )}

            <p className="note">
              Sample: {result.sample} · Analysis run: {result.runRef} · Engine{" "}
              {result.engineVersion}
              {result.usedModel ? ` · ${result.usedModel}` : ""}. {result.note}
            </p>
          </div>
        ))}
    </div>
  );
}

export function NotesBox({ game, range }: { game: string; range: string }) {
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function saveNote() {
    const { ok, result } = await postLabRequest("/api/lab/notes", {
      game,
      range,
      body,
    });

    setMessage(ok ? "Note saved." : result.error ?? "Could not save the note.");
    if (ok) setBody("");
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <b>Research note</b>
      <textarea
        className="in"
        rows={2}
        maxLength={500}
        placeholder="Add something you want to remember about this sample."
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label="Research note"
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          className="btn sm"
          type="button"
          disabled={!body.trim()}
          onClick={() => void saveNote()}
        >
          Save note
        </button>
        {message && (
          <span className="note" role="status">
            {message}
          </span>
        )}
        <span className="note">Private to you. Notes never change observations.</span>
      </div>
    </div>
  );
}

export function VerifyBox({ source }: { source: string }) {
  const [publishedInput, setPublishedInput] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);

  async function verifyPublishedResult() {
    const { result: response } = await postLabRequest("/api/lab/verify", {
      sourceId: source,
      inputs: publishedInput ? { value: publishedInput } : {},
      expected: expectedResult,
    });

    setResult(response);
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <b>Published-mechanism check</b>
      <p className="note">
        This works only when the source publishes the inputs and verification
        method needed to reproduce its result.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="in"
          placeholder="Published input"
          value={publishedInput}
          onChange={(event) => setPublishedInput(event.target.value)}
          aria-label="Published input"
        />
        <input
          className="in"
          placeholder="Stated result"
          value={expectedResult}
          onChange={(event) => setExpectedResult(event.target.value)}
          aria-label="Stated result"
        />
        <button
          className="btn sm"
          type="button"
          onClick={() => void verifyPublishedResult()}
        >
          Check
        </button>
      </div>

      {result && (
        <div className="meta">
          <span>
            <b>{(result.status ?? "").replace(/_/g, " ") || "Error"}</b>
          </span>
          <span>{result.message ?? result.error}</span>
          {result.algorithm && <span>Algorithm: {result.algorithm}</span>}
          {result.derived && <span>Derived: {result.derived}</span>}
          {result.expected && <span>Expected: {result.expected}</span>}
        </div>
      )}
    </div>
  );
}
