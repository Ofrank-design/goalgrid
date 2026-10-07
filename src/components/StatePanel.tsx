import Link from "next/link";
import type { ReactNode } from "react";

/** One look for every "something went wrong / not found" screen. It never prints raw error text, only an opaque reference a person can quote to support. */
export function StatePanel({ title, children, reference, actions }: { title: string; children: ReactNode; reference?: string; actions?: ReactNode }) {
  return (
    <div className="card state-panel" role="alert">
      <h1>{title}</h1>
      <p className="sub">{children}</p>
      {reference ? <p className="note">Reference: <code>{reference}</code></p> : null}
      <div className="row state-actions">
        {actions}
        <Link className="btn sm" href="/dashboard">Go to dashboard</Link>
      </div>
    </div>
  );
}
