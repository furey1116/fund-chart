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
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: '只支持DELETE请求' });
  }

  try {
    const { 
      userId,
      fundCode, 
      cleanupType, // 'all', 'strategies', 'backtests', 'klines'
      olderThan,   // ISO日期字符串，清理此日期之前的数据
      strategyId,  // 特定的策略ID
      backtestId   // 特定的回测ID
    } = req.query;

    if (!userId && !cleanupType) {
      return res.status(400).json({ message: '缺少必要参数userId或cleanupType' });
    }

    const prismaClient = prisma as any;
    const results = { deleted: {} as any };
    
    // 准备日期过滤条件
    let dateFilter = {};
    if (olderThan) {
      dateFilter = {
        createdAt: {
          lt: new Date(olderThan as string)
        }
      };
    }

    // 准备用户ID过滤条件
    const userFilter = userId ? { userId: userId as string } : {};
    
    // 准备基金代码过滤条件
    const fundFilter = fundCode ? { fundCode: fundCode as string } : {};

    // 开始事务处理，确保数据一致性
    await prismaClient.$transaction(async (tx: any) => {
      // 根据清理类型执行不同的清理操作
      if (cleanupType === 'all' || cleanupType === 'backtests' || strategyId || backtestId) {
        // 1. 如果指定了回测ID，只删除该回测及其交易记录
        if (backtestId) {
          // 首先删除关联的交易记录
          const deletedTransactions = await tx.gridTransaction.deleteMany({
            where: {
              backtestId: backtestId as string
            }
          });
          
          // 然后删除回测记录
          const deletedBacktest = await tx.gridBacktestResult.deleteMany({
            where: {
              id: backtestId as string
            }
          });
          
          results.deleted.transactions = deletedTransactions.count;
          results.deleted.backtests = deletedBacktest.count;
        } 
        // 2. 如果指定了策略ID，删除该策略的所有回测及交易记录
        else if (strategyId) {
          // 首先找出所有关联的回测ID
          const backtests = await tx.gridBacktestResult.findMany({
            where: {
              strategyId: strategyId as string,
              ...dateFilter
            },
            select: {
              id: true
            }
          });
          
          const backtestIds = backtests.map((b: any) => b.id);
          
          // 删除关联的交易记录
          const deletedTransactions = await tx.gridTransaction.deleteMany({
            where: {
              backtestId: {
                in: backtestIds
              }
            }
          });
          
          // 删除回测记录
          const deletedBacktests = await tx.gridBacktestResult.deleteMany({
            where: {
              strategyId: strategyId as string,
              ...dateFilter
            }
          });
          
          results.deleted.transactions = deletedTransactions.count;
          results.deleted.backtests = deletedBacktests.count;
        }
        // 3. 如果是清理所有回测或全部数据
        else {
          // 构建回测查询条件
          const backtestWhere = {
            ...userFilter,
            ...dateFilter
          };
          
          // 找出满足条件的所有回测ID
          const backtests = await tx.gridBacktestResult.findMany({
            where: backtestWhere,
            select: {
              id: true
            }
          });
          
          const backtestIds = backtests.map((b: any) => b.id);
          
          // 删除关联的交易记录
          const deletedTransactions = await tx.gridTransaction.deleteMany({
            where: {
              backtestId: {
                in: backtestIds
              }
            }
          });
          
          // 删除回测记录
          const deletedBacktests = await tx.gridBacktestResult.deleteMany({
            where: backtestWhere
          });
          
          results.deleted.transactions = deletedTransactions.count;
          results.deleted.backtests = deletedBacktests.count;
        }
      }
      
      // 清理策略
      if (cleanupType === 'all' || cleanupType === 'strategies') {
        // 构建策略查询条件
        const strategyWhere: any = {
          ...userFilter,
          ...fundFilter,
          ...dateFilter
        };
        
        // 如果指定了策略ID
        if (strategyId) {
          strategyWhere.id = strategyId as string;
        }
        
        // 删除策略
        const deletedStrategies = await tx.gridStrategy.deleteMany({
          where: strategyWhere
        });
        
        results.deleted.strategies = deletedStrategies.count;
      }
      
      // 清理K线数据
      if (cleanupType === 'all' || cleanupType === 'klines') {
        // 构建K线数据查询条件
        const klineWhere: any = {
          ...fundFilter
        };
        
        // 如果指定了日期范围
        if (olderThan) {
          klineWhere.date = {
            lt: new Date(olderThan as string)
          };
        }
        
        // 删除K线数据
        const deletedKLines = await tx.fundKLineData.deleteMany({
          where: klineWhere
        });
        
        results.deleted.klines = deletedKLines.count;
      }
    });

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