import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireMember, requireUser } from "@/lib/community/api";
import { getStaff } from "@/lib/community/staff";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { MAX_UPLOAD_BYTES, checkUpload } from "@/lib/security/upload";
import { supabaseAdmin } from "@/lib/supabase/admin";
/** Upload a proof image for your own share. The path is made on the server, the type is read from the bytes, and a screenshot never changes verification: the share stays unverified. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireMember(); if (me instanceof NextResponse) return me; const { id } = await ctx.params; if (!z.string().uuid().safeParse(id).success) return fail("Invalid request.", 400);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 20_000) return fail("Images must be 1 MB or smaller.", 413);
  const db = supabaseAdmin(), { data: post } = await db.from("community_booking_posts").select("id,user_id,proof_path").eq("id", id).maybeSingle(); if (!post || post.user_id !== me.id) return fail("Not found.", 404);
  if (!(await allow(me.id, "proofUpload"))) return fail(LIMIT_MESSAGE, 429);
  const file = (await req.formData().catch(() => null))?.get("file"); if (!(file instanceof File)) return fail("Choose an image.", 400);
  const c = checkUpload(new Uint8Array(await file.arrayBuffer()), me.id, "proofs"); if (!c.ok) return fail(c.error, 400);
  const { error } = await db.storage.from("proofs").upload(c.path, await file.arrayBuffer(), { contentType: c.contentType, upsert: false }); if (error) return fail("Could not store the image.", 500);
  if (post.proof_path) await db.storage.from("proofs").remove([post.proof_path as string]);
  await db.from("community_booking_posts").update({ proof_path: c.path }).eq("id", id); return NextResponse.json({ saved: true });
}
/** A short lived signed link, for the owner and staff only. Everyone else only sees that a proof exists. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireUser(); if (!u) return fail("Sign in first.", 401); const { id } = await ctx.params; if (!z.string().uuid().safeParse(id).success) return fail("Invalid request.", 400);
  const db = supabaseAdmin(), { data: post } = await db.from("community_booking_posts").select("user_id,proof_path").eq("id", id).maybeSingle();
  if (!post?.proof_path || (post.user_id !== u.id && !(await getStaff()))) return fail("Not found.", 404);
  const { data } = await db.storage.from("proofs").createSignedUrl(post.proof_path as string, 60); return data ? NextResponse.json({ url: data.signedUrl }) : fail("Not available.", 500);
}
