import Link from "next/link";
import { shiftDate } from "@/lib/app/format";
export function DateTabs({ base, date, extra = "" }: { base: string; date: string; extra?: string }) {
  const href = (d: string) => `${base}?date=${d}${extra}`;
  return <div className="row"><div className="tabs" style={{ margin: 0 }}><Link className="tab" href={href(shiftDate(date, -1))}>Previous day</Link><span className="tab on">{date}</span><Link className="tab" href={href(shiftDate(date, 1))}>Next day</Link></div></div>;
}
