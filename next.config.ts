import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.senat.ro" },
      { protocol: "https", hostname: "senat.ro" },
      { protocol: "http", hostname: "www.cdep.ro" },
      { protocol: "https", hostname: "www.cdep.ro" },
      { protocol: "https", hostname: "www.gov.ro" },
      { protocol: "https", hostname: "gov.ro" }
    ]
  },
  typedRoutes: true,
  outputFileTracingRoot: projectRoot
};

export default nextConfig;
