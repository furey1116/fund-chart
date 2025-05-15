/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/fund/:path*',
        destination: 'https://misleading-karil-furey1116-057e2f94.koyeb.app/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 