import { PrismaClient } from '@prisma/client';

// 全局变量以避免在开发环境下的热加载时创建多个实例
declare global {
  var prisma: PrismaClient | undefined;
}

// 使用全局对象存储PrismaClient实例，避免热重载问题
const prisma = global.prisma || new PrismaClient({
  log: ['error', 'warn'],
  // 增加连接池超时配置
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  }
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma; 