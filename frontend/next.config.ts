import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Home-dir package-lock.json otherwise wins; breaks @/ imports in dev.
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
