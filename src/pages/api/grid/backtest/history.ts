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
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: '缺少必要参数userId' });
    }

    const prismaClient = prisma as any;
    
    // 获取用户的所有回测结果
    const backtestResults = await prismaClient.gridBacktestResult.findMany({
      where: {
        // 通过策略ID关联到用户
        strategy: {
          userId: userId as string
        }
      },
      include: {
        strategy: {
          select: {
            fundCode: true,
            fundName: true,
            strategyType: true,
            gridMode: true,
            initialPrice: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            transactions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      message: '获取历史回测记录成功',
      count: backtestResults.length,
      data: backtestResults
    });
  } catch (error: any) {
    console.error('获取历史回测记录失败:', error);
    return res.status(500).json({ 
      message: '获取历史回测记录时出错', 
      error: error.message 
    });
  }
} 