/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  images: {
    remotePatterns: [
      // ⬇️ Local backend (dev)
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/upload/**",
      },
      // ⬇️ Live backend (uncomment / adjust protocol+host when you go live)
      {
        protocol: "http", // or "https" if your backend is on https
        hostname: "backend.pharma-health.co.uk",
        port: "",
        pathname: "/upload/**",
      },
    ],
  },
};

export default nextConfig;
