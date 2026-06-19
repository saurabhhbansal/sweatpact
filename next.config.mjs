/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/group", destination: "/groups", permanent: true },
    ];
  },
};

export default nextConfig;
