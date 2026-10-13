import type { MetadataRoute } from "next";

/** Add to Home Screen: "Dunya Fam" under the icon, "Dunya Family" everywhere else. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dunya Family",
    short_name: "Dunya Fam",
    start_url: "/",
    display: "standalone",
    background_color: "#F7EFE3",
    theme_color: "#FBF7F0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
