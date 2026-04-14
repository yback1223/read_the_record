import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Read The Record",
    short_name: "Read The Record",
    description: "책에 남기는 목소리",
    start_url: "/",
    display: "standalone",
    background_color: "#f4ead0",
    theme_color: "#f4ead0",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
