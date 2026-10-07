"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type N = { id: string; type: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string };
type P = Record<string, boolean>;
const categories = ["prediction","match","simulation","challenge","community","follow","like","comment","system","security"];
export default function Notifications() {
  const [items,setItems]=useState<N[]>([]),[prefs,setPrefs]=useState<P|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    let off=false;
    fetch("/api/notifications").then(async r=>{const j=await r.json().catch(()=>({}));return {ok:r.ok,j};}).then(({ok,j})=>{
      if(off)return;
      if(!ok){setError(j.error||"Could not load notifications.");setLoading(false);return;}
      setItems(j.notifications||[]);setPrefs(j.preferences||null);setLoading(false);
    });
    return()=>{off=true};
  },[]);
  async function mark(id?:string){await fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{id}:{all:true})}); setItems(x=>x.map(n=>id&&n.id!==id?n:{...n,read_at:new Date().toISOString()}));}
  async function save(key:string,value:boolean){if(!prefs)return;const next={...prefs,[key]:value};setPrefs(next);setSaving(true);const r=await fetch("/api/notifications/preferences",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({[key]:value})});if(!r.ok)setError("Could not save preference.");setSaving(false)}
  return <><div className="row"><div><h1>Notifications</h1><p className="sub">Your GoalGrid activity, challenges, community and simulation updates.</p></div><button className="btn sm" onClick={()=>void mark()}>Mark all read</button></div>
    {error&&<div className="err">{error}</div>}
    {loading?<div className="card">Loading…</div>:!items.length?<div className="card"><b>You're all caught up.</b><p className="note">New activity will appear here without mixing into your football data.</p></div>:<div className="grid">{items.map(n=><div className="card" key={n.id} style={{opacity:n.read_at?.9:1}}><div className="meta"><span>{n.type.toUpperCase()}</span><span>{new Date(n.created_at).toLocaleString()}</span></div><b>{n.title}</b><p className="note">{n.body}</p><div className="chips">{n.href&&<Link className="chip" href={n.href}>Open</Link>}{!n.read_at&&<button className="chip" onClick={()=>void mark(n.id)}>Mark read</button>}</div></div>)}</div>}
    {prefs&&<section><h2>Preferences</h2><div className="card"><p className="note">In-app notifications are the core channel. Security alerts are always retained in-app. Email and push remain opt-in until their delivery providers are configured.</p>{["in_app","email","push",...categories].map(k=><label key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid var(--line)"}}><span>{k.replaceAll("_"," ")}</span><input type="checkbox" checked={!!prefs[k]} disabled={saving||k==="security"||k==="in_app"} onChange={e=>void save(k,e.target.checked)}/></label>)}</div></section>}
  </>;
}
