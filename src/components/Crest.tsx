import crests from "../../public/crests/manifest.json";
const LOCAL = crests as Record<string, string>;
/** Local crest file by team slug first, then the provider's image, then a monogram. Decided on the server, so no client code and no broken images. */
export function Crest({ slug, url, name }: { slug?: string; url: string | null; name: string }) {
  const file = slug ? LOCAL[slug] : undefined;
  if (file) return <img className="crest" src={`/crests/${file}.webp`} alt="" width={40} height={40} loading="lazy" />;
  return url && url.startsWith("https://")
    ? <img className="crest" src={url} alt="" width={40} height={40} loading="lazy" />
    : <span className="crest mono" aria-hidden="true">{name.slice(0, 3).toUpperCase()}</span>;
}
