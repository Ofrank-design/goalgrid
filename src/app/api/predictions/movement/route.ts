import { NextResponse } from "next/server";

import { loadVersions, movement } from "@/lib/engine/history-server";

/** Summarise how a match prediction moved from its first version to its latest. */
export async function GET(request: Request) {
  const result = await loadVersions(request);

  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.json(
    {
      matchId: result.matchId,
      frozen: result.frozen,
      ...movement(result.versions),
    },
    {
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}
