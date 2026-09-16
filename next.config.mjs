/**
 * Set PREVIEW_EXPORT=1 to produce a fully static build in `out/` with relative
 * asset paths, for hosts that serve files rather than running a Node server.
 * The default build is a normal server-rendered Next.js app.
 */
const previewExport = process.env.PREVIEW_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(previewExport
    ? {
        output: 'export',
        // Assets are referenced under ./assets/_next/... so the whole bundle
        // sits beneath a non-underscore top-level directory. Some static hosts
        // reserve paths beginning with an underscore.
        assetPrefix: './assets',
        images: { unoptimized: true }
      }
    : {})
};

export default nextConfig;
