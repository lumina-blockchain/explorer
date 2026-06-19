import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        os: false,
        http2: false,
      };

      // Completely stub out grpc.js in the browser bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        './grpc.js': false,
        '../src/grpc.js': false,
      };
    }
    return config;
  },
  turbopack: {},
};

export default nextConfig;



