import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // uth.ts reads these at runtime with fs; make sure they ship with the function on Vercel.
  outputFileTracingIncludes: {
    "/api/under-the-hood": ["./data/questions.json", "./data/questions-rejections.json", "./data/evals/results.json"],
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
