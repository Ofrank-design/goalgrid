import "../globals.css";
import { AppNav } from "@/components/AppNav";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <><AppNav /><main><div className="wrap">{children}</div></main></>;
}
