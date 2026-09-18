import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tenny",
    short_name: "Tenny",
    description:
      "Verified tennis scores, fair group standings, and a clearer next match.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1e8",
    theme_color: "#14304f",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
