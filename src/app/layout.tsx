import localFont from "next/font/local";

const font = localFont({
  src: [
    { path: "./fonts/montserrat-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/montserrat-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/montserrat-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/montserrat-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/montserrat-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/montserrat-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--f",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

export const metadata = { title: "GoalGrid | AI Football Intelligence" };

// Stylesheets are imported per area (the homepage, the app, the public site) so the
// homepage keeps its own CSS and does not pick up the app's global rules.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={font.variable}><body>{children}</body></html>;
}
