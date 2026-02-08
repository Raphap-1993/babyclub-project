const path = require("path");

const workspaceRoot = path.join(__dirname, "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wtwnhqbbcocpnqqsybln.supabase.co" },
    ],
  },
};

module.exports = nextConfig;
