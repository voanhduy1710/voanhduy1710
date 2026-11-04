import type { NextConfig } from "next";
import { LANGS } from "./src/lib/content/types";
import { sectionRedirects } from "./src/lib/sections";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // No floating "N" dev-tools button in `next dev` (it never shows in production builds).
  devIndicators: false,
  async redirects() {
    return [
      // The old section pages are now sections of the home page: /en/skills -> /en#skills.
      ...sectionRedirects(LANGS),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
