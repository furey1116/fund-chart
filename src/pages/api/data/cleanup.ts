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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只支持POST请求' });
  }

  try {
    const { userId, cleanupType, backtestIds, fundCodes, beforeDate } = req.body;

    if (!userId) {
      return res.status(400).json({ message: '缺少必要参数userId' });
    }

    if (!cleanupType) {
      return res.status(400).json({ message: '缺少必要参数cleanupType' });
    }

    const prismaClient = prisma as any;
    const results: Record<string, any> = {};
    
    // 清理回测数据
    if (cleanupType === 'backtest' || cleanupType === 'all') {
      // 如果提供了特定的回测ID，只清理这些回测
      let deleteCondition = {};
      
      if (backtestIds && backtestIds.length > 0) {
        deleteCondition = {
          id: {
            in: backtestIds
          }
        };
      } else if (beforeDate) {
        // 如果提供了日期，清理该日期之前的回测
        deleteCondition = {
          createdAt: {
            lt: new Date(beforeDate)
          },
          strategy: {
            userId: userId
          }
        };
      } else {
        // 默认清理该用户的所有回测
        deleteCondition = {
          strategy: {
            userId: userId
          }
        };
      }

      // 先找到需要删除的回测结果
      const backtestsToDelete = await prismaClient.gridBacktestResult.findMany({
        where: deleteCondition,
        select: {
          id: true
        }
      });
      
      const backtestIdList = backtestsToDelete.map((bt: any) => bt.id);

      // 先删除交易记录（外键约束）
      if (backtestIdList.length > 0) {
        const deletedTransactions = await prismaClient.gridTransaction.deleteMany({
          where: {
            backtestId: {
              in: backtestIdList
            }
          }
        });
        results.deletedTransactions = deletedTransactions.count;
      }

      // 再删除回测结果
      const deletedBacktests = await prismaClient.gridBacktestResult.deleteMany({
        where: deleteCondition
      });
      results.deletedBacktests = deletedBacktests.count;
    }
    
    // 清理策略数据
    if (cleanupType === 'strategy' || cleanupType === 'all') {
      // 不能删除与回测关联的策略，所以先找出没有关联回测的策略
      let deleteCondition: any = {
        userId: userId,
        NOT: {
          gridBacktestResults: {
            some: {}
          }
        }
      };
      
      if (beforeDate) {
        deleteCondition = {
          ...deleteCondition,
          createdAt: {
            lt: new Date(beforeDate)
          }
        };
      }
      
      const deletedStrategies = await prismaClient.gridStrategy.deleteMany({
        where: deleteCondition
      });
      results.deletedStrategies = deletedStrategies.count;
    }
    
    // 清理K线数据
    if (cleanupType === 'kline' || cleanupType === 'all') {
      let deleteCondition = {};
      
      if (fundCodes && fundCodes.length > 0) {
        deleteCondition = {
          fundCode: {
            in: fundCodes
          }
        };
      }
      
      if (beforeDate) {
        deleteCondition = {
          ...deleteCondition,
          date: {
            lt: new Date(beforeDate)
          }
        };
      }
      
      // 如果没有提供任何过滤条件，不允许清理所有K线数据，以防误操作
      if (Object.keys(deleteCondition).length === 0) {
        results.klineDataWarning = '没有提供足够的条件，为防止误删除，不执行K线数据清理';
      } else {
        const deletedKLineData = await prismaClient.fundKLineData.deleteMany({
          where: deleteCondition
        });
        results.deletedKLineData = deletedKLineData.count;
      }
    }

    return res.status(200).json({
      message: '数据清理成功',
      results
    });
  } catch (error: any) {
    console.error('数据清理失败:', error);
    return res.status(500).json({ 
      message: '数据清理时出错', 
      error: error.message 
    });
  }
} 