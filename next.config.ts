import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sparticuz/chromium ships a native Chromium binary that webpack cannot bundle.
  // Without this, Next.js bundles these packages and the binary is unreachable at runtime.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
