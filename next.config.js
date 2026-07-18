/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["mssql", "sharp", "tedious"],
};

module.exports = nextConfig;
