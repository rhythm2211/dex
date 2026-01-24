import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'standalone',
  // Production optimizations
  compress: true,
  poweredByHeader: false, // Remove X-Powered-By header for security
  // Suppress MetaMask extension errors in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Turbopack config (empty to silence the error when webpack config is present)
  turbopack: {},
  // Ignore browser extension errors
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Suppress warnings from browser extensions
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /chrome-extension/,
        },
        {
          message: /Failed to connect to MetaMask/,
        },
        {
          message: /metamask/i,
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
