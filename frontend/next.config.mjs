/** @type {import('next').NextConfig} */

// `output: "export"` activates static export for Tauri production builds.
// Must NOT be set during `next dev` — Next.js 14 would then require every
// dynamic route param to exist in generateStaticParams(), impossible for
// runtime-generated UUIDs.
//
// `distDir`: in production, output to ../dist so Tauri can serve via file://.
// In dev, use the default .next/ directory — mixing dev cache with production
// static files in the same dist/ folder causes ChunkLoadError on startup.
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  ...(isProd ? { output: "export", distDir: "../dist" } : {}),
  // Images: unoptimized required for static export
  images: { unoptimized: true },
  experimental: {},
};

export default nextConfig;
