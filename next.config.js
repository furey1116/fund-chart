/** @type {import('next').NextConfig} */
const path = require('path');

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
  webpack: (config, { isServer }) => {
    // 添加alias，解决antd Typography.Link组件导入问题
    config.resolve.alias = {
      ...config.resolve.alias,
      'antd/es/typography/Link': path.resolve(__dirname, './src/utils/antd-typography-link-polyfill.ts'),
    };
    return config;
  },
};

module.exports = nextConfig; 