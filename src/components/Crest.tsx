/** The provider's crest image, or a monogram when the provider sent none. Decided on the server, so no client code and no broken images. */
export function Crest({ url, name }: { url: string | null | undefined; name: string }) {
  return url && url.startsWith("https://")
    ? <img className="crest" src={url} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" />
    : <span className="crest mono" aria-hidden="true">{name.slice(0, 3).toUpperCase()}</span>;
}
