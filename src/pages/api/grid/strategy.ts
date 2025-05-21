import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只支持POST请求' });
  }

  try {
    const {
      userId,
      fundCode,
      fundName,
      initialPrice,
      strategyType,
      gridMode,
      sellStrategy,
      gridCount,
      gridWidth,
      absoluteGridWidth,
      investmentPerGrid,
      enableMediumGrid,
      mediumGridMultiplier,
      enableLargeGrid,
      largeGridMultiplier,
      retainedProfitsRatio,
      maxPercentOfDecline,
      enableMaxDeclineLimit,
      enableIntraDayBacktest
    } = req.body;

    if (!userId || !fundCode || !fundName) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    const prismaClient = prisma as any;
    
    // 创建或更新网格策略
    const strategy = await prismaClient.gridStrategy.upsert({
      where: {
        // 假设我们使用复合唯一性约束：用户ID + 基金代码 + 策略类型
        id: req.body.id || 'temp-id' // 如果没有ID，使用临时ID
      },
      update: {
        userId,
        fundCode,
        fundName,
        initialPrice,
        strategyType,
        gridMode,
        sellStrategy,
        gridCount,
        gridWidth,
        absoluteGridWidth,
        investmentPerGrid,
        enableMediumGrid,
        mediumGridMultiplier,
        enableLargeGrid,
        largeGridMultiplier,
        retainedProfitsRatio,
        maxPercentOfDecline,
        enableMaxDeclineLimit,
        enableIntraDayBacktest
      },
      create: {
        userId,
        fundCode,
        fundName,
        initialPrice,
        strategyType,
        gridMode,
        sellStrategy,
        gridCount,
        gridWidth,
        absoluteGridWidth,
        investmentPerGrid,
        enableMediumGrid,
        mediumGridMultiplier,
        enableLargeGrid,
        largeGridMultiplier,
        retainedProfitsRatio,
        maxPercentOfDecline: maxPercentOfDecline || 40,
        enableMaxDeclineLimit: enableMaxDeclineLimit || false,
        enableIntraDayBacktest: enableIntraDayBacktest || false
      }
    });

    return res.status(200).json({
      message: '网格策略保存成功',
      strategyId: strategy.id
    });
  } catch (error: any) {
    console.error('保存网格策略失败:', error);
    return res.status(500).json({ 
      message: '保存网格策略时出错', 
      error: error.message 
    });
  }
} 