export function Avatar({ name, url, size }: { name: string; url: string | null; size?: "lg" }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={`avatar${size === "lg" ? " lg" : ""}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" /> : initials}
    </span>
  );
}
