import { shirtNumber, textOn, type Pt } from "@/lib/simulation/visual";
const X = (x: number) => x * 1.05, Y = (y: number) => y * 0.68;
type Kit = { fill: string; trim: string };
/** The pitch, the 22 players and the ball. A pure drawing of positions it is given, so it can be rendered on its own. */
export function PitchSvg({ players, ball, kit, nums, carrier, flash, label }: { players: Pt[]; ball: Pt; kit: { home: Kit; away: Kit }; nums: { home: number[]; away: number[] }; carrier: number; flash: { side: "home" | "away"; slot: number } | null; label: string }) {
  return (
    <svg viewBox="-3 -3 111 74" role="img" aria-label={label} style={{ width: "100%", display: "block" }} xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="grass" x1="0" x2="1">{[0, 1, 2, 3, 4, 5, 6, 7].map(i => <stop key={i} offset={`${i * 12.5}%`} stopColor={i % 2 ? "#1f7a3a" : "#238540"} />)}</linearGradient></defs>
      <rect x="-3" y="-3" width="111" height="74" fill="#0b3d1c" /><rect x="0" y="0" width="105" height="68" fill="url(#grass)" />
      <g fill="none" stroke="rgba(255,255,255,.85)" strokeWidth=".35"><rect x="0" y="0" width="105" height="68" /><line x1="52.5" y1="0" x2="52.5" y2="68" /><circle cx="52.5" cy="34" r="9.15" /><circle cx="52.5" cy="34" r=".5" fill="#fff" />
        <rect x="0" y="13.84" width="16.5" height="40.32" /><rect x="88.5" y="13.84" width="16.5" height="40.32" /><rect x="0" y="24.84" width="5.5" height="18.32" /><rect x="99.5" y="24.84" width="5.5" height="18.32" /><circle cx="11" cy="34" r=".4" fill="#fff" /><circle cx="94" cy="34" r=".4" fill="#fff" />
        <path d="M16.5 27.2a9.15 9.15 0 0 1 0 13.6" /><path d="M88.5 27.2a9.15 9.15 0 0 0 0 13.6" /></g>
      <rect x="-2" y="30.34" width="2" height="7.32" fill="rgba(255,255,255,.18)" stroke="#fff" strokeWidth=".3" /><rect x="105" y="30.34" width="2" height="7.32" fill="rgba(255,255,255,.18)" stroke="#fff" strokeWidth=".3" />
      {players.map((p, i) => { const side = i < 11 ? "home" : "away", idx = i % 11, k = kit[side], gk = idx === 0, fill = gk ? (side === "home" ? "#f4d03f" : "#58d68d") : k.fill, isFlash = !!flash && flash.side === side && flash.slot === idx;
        return (<g key={i} transform={`translate(${X(p.x)} ${Y(p.y)})`}>{(i === carrier || isFlash) && <circle r="2.9" fill="none" stroke={isFlash ? "#38bdf8" : "#ffffff"} strokeWidth=".45" className="mp-ring" />}<circle r="1.75" fill={fill} stroke={gk ? "#111" : k.trim} strokeWidth=".45" /><text textAnchor="middle" dy=".62" fontSize="1.9" fontWeight="700" fill={textOn(fill)} style={{ userSelect: "none" }}>{nums[side][idx] ?? shirtNumber(idx)}</text></g>); })}
      <g transform={`translate(${X(ball.x)} ${Y(ball.y)})`}><ellipse cx=".25" cy=".6" rx=".9" ry=".4" fill="rgba(0,0,0,.35)" /><circle r=".85" fill="#fff" stroke="#111" strokeWidth=".18" /></g>
    </svg>
  );
}
