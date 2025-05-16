import { PrismaClient } from '@prisma/client';

// 防止开发时创建多个Prisma实例
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma; 