/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/api/assets/**",
      },
      {
        protocol: "http",
        hostname: "**.localhost", // Should match any localhost subdomain
        port: "8000",
        pathname: "/api/assets/**",
      },
      {
        protocol: "https",
        hostname: "pharma-health.co.uk",
        port: "",
        pathname: "/api/assets/**",
      },
      {
        protocol: "https",
        hostname: "**.pharma-health.co.uk", // Match any subdomain for pharma-health.co.uk
        port: "",
        pathname: "/api/assets/**",
      },
    ],
  },
};

export default nextConfig;
