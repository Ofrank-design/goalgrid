import { NextResponse } from "next/server";
import { MATCH_ID_RE } from "@/lib/football/match-id";
import { z } from "zod";
import { requireUser } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { allow } from "@/lib/security/limits";
const schema = z.object({ matchId: z.string().regex(MATCH_ID_RE), matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export async function POST(req: Request) { const u=await requireUser(); if(!u)return NextResponse.json({error:"Sign in first."},{status:401}); if(!(await allow(u.id,"save")))return NextResponse.json({error:"Too many requests."},{status:429}); const p=schema.safeParse(await req.json().catch(()=>null)); if(!p.success)return NextResponse.json({error:"Invalid match."},{status:400}); const {error}=await supabaseAdmin().from("saved_matches").upsert({user_id:u.id,match_id:p.data.matchId,match_date:p.data.matchDate},{onConflict:"user_id,match_id"}); return error?NextResponse.json({error:"Could not save match."},{status:500}):NextResponse.json({saved:true}); }
export async function DELETE(req: Request) { const u=await requireUser(); if(!u)return NextResponse.json({error:"Sign in first."},{status:401}); const p=z.string().regex(MATCH_ID_RE).safeParse(new URL(req.url).searchParams.get("matchId")); if(!p.success)return NextResponse.json({error:"Invalid match."},{status:400}); const {error}=await supabaseAdmin().from("saved_matches").delete().eq("user_id",u.id).eq("match_id",p.data); return error?NextResponse.json({error:"Could not remove saved match."},{status:500}):NextResponse.json({saved:false}); }
