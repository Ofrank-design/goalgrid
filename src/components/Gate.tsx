import Link from "next/link";
/** Shown to visitors who are not signed in. Pro and Premium tools are free: an account is all that is needed. */
export function Gate({ need, signedIn, title, blurb }: { need: "pro" | "premium"; signedIn: boolean; title: string; blurb: string }) {
  return (
    <div className="gate"><span className={`badge ${need}`}>{need.toUpperCase()}</span><h1 style={{ marginTop: 14 }}>{title}</h1><p>{blurb}</p>
      {signedIn ? <p className="note">This tool is available to you. Try reloading the page.</p> : <Link className="btn p" href={`/sign-in?next=/${need}`}>Sign in free to open this</Link>}
      <p className="note" style={{ marginTop: 18 }}><Link href="/dashboard" style={{ color: "#00e676" }}>Back to the dashboard</Link></p>
    </div>
  );
}
