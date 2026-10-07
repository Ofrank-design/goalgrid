import { NextResponse } from "next/server";

import { loadVersions } from "@/lib/engine/history-server";

/** Return the stored prediction versions for one match, oldest first. */
export async function GET(request: Request) {
  const result = await loadVersions(request);

  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
