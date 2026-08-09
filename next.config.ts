import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ngrok (and similar tunnels) load the app from a non-localhost Host.
  // Next 16 blocks cross-origin access to /_next/* in development unless
  // the tunnel hostname is listed here — without this, login can look broken
  // because JS/CSS/HMR requests fail while the HTML shell still loads.
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
