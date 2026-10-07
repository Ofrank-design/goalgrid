import type { TeamVisual } from "@/lib/simulation/visual";

export function TeamTag({
  v,
  color,
}: {
  v: TeamVisual;
  color: string;
}) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
      {v.crest ? (
        <img
          src={v.crest}
          alt=""
          width={40}
          height={40}
          style={{ objectFit: "contain" }}
        />
      ) : (
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: color,
            display: "inline-block",
          }}
        />
      )}
      <b>{v.name}</b>
      <span className="note" style={{ color }}>
        {v.shortName}
      </span>
    </div>
  );
}
