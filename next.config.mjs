/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright is only loaded on the server, on your own computer, for membership sites.
  serverExternalPackages: ["playwright"],
};
export default nextConfig;
