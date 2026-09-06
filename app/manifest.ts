import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tennis App",
    short_name: "Tennis",
    description:
      "Verified tennis scores, fair group standings, and a clearer next match.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0eee5",
    theme_color: "#102721",
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
