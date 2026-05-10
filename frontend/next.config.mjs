/** @type {import('next').NextConfig} */

// `output: "export"` activates static export for Tauri production builds.
// It must NOT be set during `next dev` because Next.js 14 then enforces that
// every navigated dynamic param (e.g. meeting UUIDs) exists in
// generateStaticParams() — impossible for runtime-generated data.
// In dev, Next.js runs as a normal dev-server and dynamic routes work freely.
// In production (`next build`), NODE_ENV is always "production", so the static
// export is applied and Tauri can serve the files from ../dist.
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  ...(isProd ? { output: "export" } : {}),
  // Custom output dir — must match tauri.conf.json frontendDist
  distDir: "../dist",
  // Images: unoptimized required for static export
  images: { unoptimized: true },
  experimental: {},
};

export default nextConfig;
