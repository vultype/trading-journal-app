import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // URL jurnal dipindah dari /dashboard -> /jurnal; jaga bookmark/link lama.
      { source: "/dashboard", destination: "/jurnal", permanent: true },
    ];
  },
};

export default nextConfig;
