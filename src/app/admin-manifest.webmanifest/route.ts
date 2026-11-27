import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      id: "/admin",
      name: "ZANIMA Admin",
      short_name: "ZANIMA Admin",
      description:
        "Painel administrativo, agenda e gestão financeira do estúdio ZANIMA TATTOO.",
      start_url: "/admin",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#101114",
      theme_color: "#101114",
      lang: "pt-BR",
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/icons/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    }
  );
}
