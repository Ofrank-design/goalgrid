import { NextResponse } from "next/server";

export const GET = () =>
  NextResponse.json({
    ok: true,
    service: "goalgrid",
    time: new Date().toISOString(),
  });
