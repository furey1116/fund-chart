import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只支持POST请求' });
  }

  try {
    const { userId, action, fundCode, startDate, endDate } = req.body;

    if (!userId || !action) {
      return res.status(400).json({ message: '缺少必要参数: userId 和 action' });
    }

    const prismaClient = prisma as any;
    let message = '';
    let deletedCount = 0;

    // 根据不同的清理操作执行不同的删除逻辑
    switch (action) {
      case 'clearBacktestResults':
        // 首先查找所有符合条件的回测结果ID
        const backtestResults = await prismaClient.gridBacktestResult.findMany({
          where: {
            strategyId: {
              in: await prismaClient.gridStrategy.findMany({
                where: { userId },
                select: { id: true }
              }).then((strategies: Array<{id: string}>) => strategies.map(s => s.id))
            }
          },
          select: { id: true }
        });

        const backtestIds = backtestResults.map((result: any) => result.id);
        
        // 先删除交易记录(外键关联的数据)
        if (backtestIds.length > 0) {
          await prismaClient.gridTransaction.deleteMany({
            where: { backtestId: { in: backtestIds } }
          });
        }
        
        // 再删除回测结果
        const deletedBacktests = await prismaClient.gridBacktestResult.deleteMany({
          where: { id: { in: backtestIds } }
        });
        
        deletedCount = deletedBacktests.count;
        message = `成功清理了${deletedCount}条回测结果及其相关交易记录`;
        break;
        
      case 'clearStrategies':
        // 先查找所有该用户的策略ID
        const strategies = await prismaClient.gridStrategy.findMany({
          where: { userId },
          select: { id: true }
        });
        
        const strategyIds = strategies.map((strategy: any) => strategy.id);
        
        // 先删除依赖于策略的回测结果
        if (strategyIds.length > 0) {
          // 查找依赖于这些策略的回测结果
          const relatedBacktestResults = await prismaClient.gridBacktestResult.findMany({
            where: { strategyId: { in: strategyIds } },
            select: { id: true }
          });
          
          const relatedBacktestIds = relatedBacktestResults.map((result: any) => result.id);
          
          // 删除相关交易记录
          if (relatedBacktestIds.length > 0) {
            await prismaClient.gridTransaction.deleteMany({
              where: { backtestId: { in: relatedBacktestIds } }
            });
          }
          
          // 删除回测结果
          await prismaClient.gridBacktestResult.deleteMany({
            where: { strategyId: { in: strategyIds } }
          });
        }
        
        // 最后删除策略
        const deletedStrategies = await prismaClient.gridStrategy.deleteMany({
          where: { userId }
        });
        
        deletedCount = deletedStrategies.count;
        message = `成功清理了${deletedCount}条网格策略及其相关回测和交易记录`;
        break;
        
      case 'clearKLineData':
        if (!fundCode) {
          return res.status(400).json({ message: '清理K线数据需要提供fundCode参数' });
        }
        
        const whereClause: any = { fundCode };
        
        // 添加日期范围过滤条件
        if (startDate || endDate) {
          whereClause.date = {};
          if (startDate) whereClause.date.gte = new Date(startDate);
          if (endDate) whereClause.date.lte = new Date(endDate);
        }
        
        const deletedKLines = await prismaClient.fundKLineData.deleteMany({
          where: whereClause
        });
        
        deletedCount = deletedKLines.count;
        message = `成功清理了${deletedCount}条K线数据`;
        break;
        
      case 'clearAll':
        // 清理该用户的所有数据，包括策略、回测结果和交易记录
        // 首先获取用户所有策略ID
        const allStrategies = await prismaClient.gridStrategy.findMany({
          where: { userId },
          select: { id: true }
        });
        
        const allStrategyIds = allStrategies.map((strategy: any) => strategy.id);
        
        // 获取所有相关回测结果ID
        const allBacktestResults = await prismaClient.gridBacktestResult.findMany({
          where: { strategyId: { in: allStrategyIds } },
          select: { id: true }
        });
        
        const allBacktestIds = allBacktestResults.map((result: any) => result.id);
        
        // 首先删除交易记录
        if (allBacktestIds.length > 0) {
          await prismaClient.gridTransaction.deleteMany({
            where: { backtestId: { in: allBacktestIds } }
          });
        }
        
        // 删除回测结果
        if (allStrategyIds.length > 0) {
          await prismaClient.gridBacktestResult.deleteMany({
            where: { strategyId: { in: allStrategyIds } }
          });
        }
        
        // 删除策略
        const allDeletedStrategies = await prismaClient.gridStrategy.deleteMany({
          where: { userId }
        });
        
        // 可选：也清理K线数据
        let kLineCount = 0;
        if (fundCode) {
          const deletedKLines = await prismaClient.fundKLineData.deleteMany({
            where: { fundCode }
          });
          kLineCount = deletedKLines.count;
        }
        
        deletedCount = allDeletedStrategies.count;
        message = `成功清理了${deletedCount}条网格策略及其相关回测和交易记录`;
        if (kLineCount > 0) {
          message += `，以及${kLineCount}条K线数据`;
        }
        break;
        
      default:
        return res.status(400).json({ message: '不支持的操作类型' });
    }

    return res.status(200).json({
      message,
      deletedCount
    });
  } catch (error: any) {
    console.error('数据清理失败:', error);
    return res.status(500).json({ 
      message: '执行数据清理操作时出错', 
      error: error.message 
    });
  }
} 