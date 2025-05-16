/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 允许 Vercel Blob 环境变量
  env: {
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  },
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