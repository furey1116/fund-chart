import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// 使用单例模式，确保在多次请求之间复用同一个Prisma客户端实例
let prismaInstance: PrismaClient | null = null;

function getPrisma() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  return prismaInstance;
}

const prisma = getPrisma();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '只支持GET请求' });
  }

  try {
    const { userId, fundCode, limit = '10', page = '1', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    if (!userId) {
      return res.status(400).json({ message: '缺少必要参数userId' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // 构建查询条件
    const where: any = { userId: userId as string };
    if (fundCode) {
      where.fundCode = fundCode as string;
    }

    const prismaClient = prisma as any;
    
    // 获取策略列表
    const strategies = await prismaClient.gridStrategy.findMany({
      where,
      orderBy: {
        [sortBy as string]: sortOrder === 'desc' ? 'desc' : 'asc'
      },
      skip,
      take,
      include: {
        // 包含每个策略的回测结果
        backtests: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 5, // 每个策略只取最近5条回测记录
        }
      }
    });

    // 获取总记录数
    const totalCount = await prismaClient.gridStrategy.count({ where });

    return res.status(200).json({
      message: '获取历史策略记录成功',
      data: strategies,
      pagination: {
        total: totalCount,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(totalCount / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    console.error('获取历史策略记录失败:', error);
    return res.status(500).json({ 
      message: '获取历史策略记录时出错', 
      error: error.message 
    });
  }
} 