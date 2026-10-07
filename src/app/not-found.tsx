import "./globals.css";
import { StatePanel } from "@/components/StatePanel";

export default function NotFound() {
  return <main><div className="wrap"><StatePanel title="Page not found">That page does not exist or has moved. Check the address, or head back to the dashboard.</StatePanel></div></main>;
}
