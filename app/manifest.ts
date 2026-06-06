import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AD Astra",
    short_name: "AD Astra",
    description: "AD Astra Learning Platform",
    start_url: "/home",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#FEC20C",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}