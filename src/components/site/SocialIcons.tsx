import site from "@/content/site.json";
/** Footer social icons, using the supplied brand artwork in /public/social. */
export function SocialIcons() {
  const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
  const img = (n: string) => <img src={`/social/${n}.webp`} alt="" width={36} height={36} />;
  return (
    <div className="si-soc">
      <a href={site.social.x} {...ext} aria-label="X">{img("twitter")}</a>
      <a href={site.social.instagram} {...ext} aria-label="Instagram">{img("instagram")}</a>
      <a href={site.social.linkedin} {...ext} aria-label="LinkedIn">{img("linkedin")}</a>
      <a href={site.social.github} {...ext} aria-label="GitHub">{img("github")}</a>
      <a href={`mailto:${site.contactEmail}`} aria-label="Email">{img("gmail")}</a>
    </div>
  );
}
