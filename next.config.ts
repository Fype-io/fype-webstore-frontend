import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The full-page cart was removed - the cart is the theme's drawer. Old
  // bookmarks/shared links land on the home page instead of a 404.
  async redirects() {
    return [{ source: "/cart", destination: "/", permanent: false }];
  },
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
