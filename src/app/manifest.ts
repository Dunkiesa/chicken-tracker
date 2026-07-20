import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChickenTrack",
    short_name: "ChickenTrack",
    description: "Egg-production tracking for your backyard flock",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f4ee",
    theme_color: "#AE9965",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon?size=512&maskable=true",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
