import type { NextConfig } from "next";
import path from "path";

const isStaticExport = process.env.NEXT_EXPORT === "true";

const nextConfig: NextConfig = {
  // Home-dir package-lock.json otherwise wins; breaks @/ imports in dev.
  turbopack: {
    root: path.join(__dirname),
  },
  ...(isStaticExport
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          const backendUrl =
            process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
          return [
            {
              source: "/api/:path*",
              destination: `${backendUrl}/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
