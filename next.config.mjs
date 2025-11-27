/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,

  images: {
    remotePatterns: [
      // ⬇️ Local backend (dev)
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/upload/**",
      },

      // ⬇️ Root live backend
      {
        protocol: "http", // use https if your backend is https
        hostname: "backend.pharma-health.co.uk",
        port: "",
        pathname: "/upload/**",
      },

      // ⬇️ Any subdomain like pri.backend.pharma-health.co.uk, abc.backend.pharma-health.co.uk, etc.
      {
        protocol: "http",
        hostname: "**.backend.pharma-health.co.uk",
        port: "",
        pathname: "/upload/**",
      },
    ],
  },
};

export default nextConfig;
