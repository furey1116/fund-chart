import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只支持POST请求' });
  }

  try {
    const { 
      userId,
      strategyId, 
      fundCode, 
      startDate, 
      endDate,
      useIntraDayData,
      scale = 240
    } = req.body;

    if (!userId || !fundCode || !startDate || !endDate) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    // 如果提供了策略ID，从数据库加载策略
    let strategy;
    if (strategyId) {
      const prismaClient = prisma as any;
      strategy = await prismaClient.gridStrategy.findUnique({
        where: { id: strategyId }
      });
      
      if (!strategy) {
        return res.status(404).json({ message: '未找到指定的网格策略' });
      }
    } else {
      // 否则使用请求体中的策略参数
      strategy = req.body;
    }

    // 加载K线数据
    const prismaClient = prisma as any;
    const klineData = await prismaClient.fundKLineData.findMany({
      where: {
        fundCode,
        scale: Number(scale),
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    if (klineData.length === 0) {
      return res.status(404).json({ 
        message: '未找到指定时间范围内的K线数据',
        hint: '请先调用/api/fund/kline接口获取数据'
      });
    }

    // 执行回测
    // 注意：实际的回测逻辑非常复杂，这里只是一个简化的示例框架
    // 您需要将前端的回测逻辑移植到后端
    const backtestResult = {
      strategyId: strategy.id || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalInvestment: 0,
      totalValue: 0,
      totalShares: 0,
      totalBuyAmount: 0,
      totalSellAmount: 0,
      totalFees: 0,
      profitAmount: 0,
      profitPercentage: 0,
      transactionCount: 0,
      buyCount: 0,
      sellCount: 0,
      useIntraDayData: !!useIntraDayData,
      transactions: []
    };

    // 这里需要调用实际的回测逻辑...
    // const result = runBacktest(strategy, klineData, useIntraDayData);
    
    // 保存回测结果
    const savedResult = await prismaClient.gridBacktestResult.create({
      data: {
        strategyId: strategy.id || 'temp',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalInvestment: backtestResult.totalInvestment,
        totalValue: backtestResult.totalValue,
        totalShares: backtestResult.totalShares,
        totalBuyAmount: backtestResult.totalBuyAmount,
        totalSellAmount: backtestResult.totalSellAmount,
        totalFees: backtestResult.totalFees,
        profitAmount: backtestResult.profitAmount,
        profitPercentage: backtestResult.profitPercentage,
        transactionCount: backtestResult.transactionCount,
        buyCount: backtestResult.buyCount,
        sellCount: backtestResult.sellCount,
        useIntraDayData: backtestResult.useIntraDayData,
      }
    });

    // 保存交易记录
    if (backtestResult.transactions && backtestResult.transactions.length > 0) {
      await Promise.all(
        backtestResult.transactions.map(async (tx: any) => {
          return await prismaClient.gridTransaction.create({
            data: {
              backtestId: savedResult.id,
              date: new Date(tx.date),
              price: tx.price,
              operation: tx.operation,
              amount: tx.amount,
              shares: tx.shares,
              gridLevel: tx.gridLevel,
              gridType: tx.gridType || '小网格',
              fee: tx.fee || 0,
              buyDate: tx.buyDate ? new Date(tx.buyDate) : null
            }
          });
        })
      );
    }

    return res.status(200).json({
      message: '网格回测完成并保存',
      backtestId: savedResult.id,
      summary: {
        totalInvestment: backtestResult.totalInvestment,
        totalValue: backtestResult.totalValue,
        profitAmount: backtestResult.profitAmount,
        profitPercentage: backtestResult.profitPercentage,
        transactionCount: backtestResult.transactionCount
      }
    });
  } catch (error: any) {
    console.error('网格回测失败:', error);
    return res.status(500).json({ 
      message: '执行网格回测时出错', 
      error: error.message 
    });
  }
} 