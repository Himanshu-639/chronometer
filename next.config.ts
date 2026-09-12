import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow audio fetches from Supabase Storage and Internet Archive
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        ],
      },
    ];
  },

  // Supabase storage URLs for audio
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "archive.org" },
    ],
  },
};

export default nextConfig;
