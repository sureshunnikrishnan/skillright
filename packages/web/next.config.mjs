/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  serverExternalPackages: ['better-sqlite3', '@skillright/backend'],
};

export default nextConfig;
