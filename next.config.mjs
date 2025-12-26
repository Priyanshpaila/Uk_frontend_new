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
        pathname: "/api/assets/**",
      },

      // ⬇️ Root live backend
      {
        protocol: "https", // use https if your backend is https
        hostname: "safescript.co.uk",
        port: "",
        pathname: "/api/assets/**",
      },

      // ⬇️ Any subdomain like pri.safescript.co.uk, abc.safescript.co.uk, etc.
      {
        protocol: "https",
        hostname: "**.safescript.co.uk",
        port: "",
        pathname: "/api/assets/**",
      },
    ],
  },
};

export default nextConfig;
