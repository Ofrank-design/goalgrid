type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

/** Extract text from the response shapes used by our supported LLM adapters. */
export function extractOpenAI(response: unknown): string | null {
  if (!isRecord(response) || !Array.isArray(response.choices)) {
    return null;
  }

  const firstChoice = response.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  const content = firstChoice.message.content;
  return typeof content === "string" ? content : null;
}

export function extractAnthropic(response: unknown): string | null {
  if (!isRecord(response) || !Array.isArray(response.content)) {
    return null;
  }

  const textPart = response.content.find(
    (part) => isRecord(part) && part.type === "text",
  );

  if (!isRecord(textPart) || typeof textPart.text !== "string") {
    return null;
  }

  return textPart.text;
}

export function extractGemini(response: unknown): string | null {
  if (!isRecord(response) || !Array.isArray(response.candidates)) {
    return null;
  }

  const firstCandidate = response.candidates[0];
  if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content)) {
    return null;
  }

  const parts = firstCandidate.content.parts;
  if (!Array.isArray(parts)) {
    return null;
  }

  const text = parts
    .filter((part) => isRecord(part) && typeof part.text === "string")
    .map((part) => String(part.text))
    .join("");

  return text || null;
}
