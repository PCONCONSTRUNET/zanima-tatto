import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  experimental: {
    staleTimes: {
      dynamic: 45,
      static: 180,
    },
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/minha-conta/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
