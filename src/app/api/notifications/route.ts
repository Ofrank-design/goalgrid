import { NextResponse } from "next/server";
import { requireUser } from "@/lib/community/api";
import { ensurePreferences } from "@/lib/notifications/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
export async function GET(){const u=await requireUser();if(!u)return NextResponse.json({error:"Sign in first."},{status:401});const db=supabaseAdmin();const [{data:notifications,error},{data:preferences}]=await Promise.all([db.from("notifications").select("id,type,title,body,href,read_at,created_at").eq("user_id",u.id).order("created_at",{ascending:false}).limit(100),ensurePreferences(u.id)]);if(error)return NextResponse.json({error:"Could not load notifications."},{status:500});return NextResponse.json({notifications,preferences});}
