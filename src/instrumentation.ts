/** Runs once when the server starts. In production a missing or malformed required setting stops the app at boot with a clear message, instead of failing later on a user's request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { env } = await import("@/lib/env");
  try { env(); }
  catch (e) {
    const message = `GoalGrid configuration error: ${e instanceof Error ? e.message : String(e)}`;
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(message);
  }
}
