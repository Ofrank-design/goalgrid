"use client";
import "./globals.css";
import { useEffect } from "react";
import { StatePanel } from "@/components/StatePanel";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main><div className="wrap"><StatePanel title="Something went wrong" reference={error.digest}
    actions={<button className="btn p sm" onClick={reset}>Try again</button>}>This page hit a problem. It has been logged. Try again, or come back in a minute.</StatePanel></div></main>;
}
