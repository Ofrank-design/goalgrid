import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { allow } from "@/lib/security/limits";
const schema=z.object({name:z.string().trim().min(3).max(60),description:z.string().trim().max(300).optional()});
export async function GET(){const me=await requireMember();if(me instanceof NextResponse)return me;const {data}=await supabaseAdmin().from("private_circle_members").select("circle_id,role,private_circles(id,name,description,owner_id,created_at)").eq("user_id",me.id).order("joined_at",{ascending:false});return NextResponse.json({circles:data??[]});}
export async function POST(req:Request){const me=await requireMember();if(me instanceof NextResponse)return me;if(!(await allow(me.id,"post")))return NextResponse.json({error:"Too many requests."},{status:429});const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"Invalid circle."},{status:400});const db=supabaseAdmin(),{data:c,error}=await db.from("private_circles").insert({owner_id:me.id,name:p.data.name,description:p.data.description??null}).select("id,name,description,owner_id,created_at").single();if(error||!c)return NextResponse.json({error:"Could not create circle."},{status:500});const {error:merr}=await db.from("private_circle_members").insert({circle_id:c.id,user_id:me.id,role:"owner"});if(merr)return NextResponse.json({error:"Could not initialize circle."},{status:500});return NextResponse.json({circle:c},{status:201});}
