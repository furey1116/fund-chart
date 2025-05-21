import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { GridBacktestEngine, GridStrategy } from '@/utils/gridBacktestEngine';

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
    let strategy: GridStrategy;
    const prismaClient = prisma as any;
    
    if (strategyId) {
      const dbStrategy = await prismaClient.gridStrategy.findUnique({
        where: { id: strategyId }
      });
      
      if (!dbStrategy) {
        return res.status(404).json({ message: '未找到指定的网格策略' });
      }
      
      strategy = dbStrategy as GridStrategy;
      
      // 加载网格点信息（如果数据库中没有存储）
      if (!strategy.gridPoints || strategy.gridPoints.length === 0) {
        strategy.gridPoints = generateGridPoints(strategy);
      }
    } else {
      // 否则使用请求体中的策略参数
      strategy = req.body as GridStrategy;
      
      // 确保有网格点信息
      if (!strategy.gridPoints || strategy.gridPoints.length === 0) {
        strategy.gridPoints = generateGridPoints(strategy);
      }
    }

    // 加载数据
    let data: any[];
    if (useIntraDayData) {
      // 加载K线数据
      data = await prismaClient.fundKLineData.findMany({
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

      if (data.length === 0) {
        return res.status(404).json({ 
          message: '未找到指定时间范围内的K线数据',
          hint: '请先调用/api/fund/kline接口获取数据'
        });
      }
    } else {
      // 从数据源加载净值数据（可以是API调用或数据库查询）
      // 这里是从请求体中获取数据的示例，实际应根据数据源调整
      if (req.body.netValueData && req.body.netValueData.length > 0) {
        data = req.body.netValueData;
      } else {
        // 如果没有提供净值数据，可以尝试从其他数据源获取
        // 这里可以添加获取净值数据的逻辑
        return res.status(400).json({ 
          message: '未提供净值数据',
          hint: '请提供netValueData参数或实现净值数据获取逻辑'
        });
      }
    }

    // 执行回测
    const backtestResult = GridBacktestEngine.runBacktest({
      strategy,
      data,
      useIntraDayData: !!useIntraDayData
    });
    
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
        profitAmount: backtestResult.profitAmount || 0,
        profitPercentage: backtestResult.profitPercentage || 0,
        transactionCount: backtestResult.transactions.length,
        buyCount: backtestResult.buyCount || 0,
        sellCount: backtestResult.sellCount || 0,
        useIntraDayData: !!useIntraDayData,
      }
    });

    // 保存交易记录
    if (backtestResult.transactions && backtestResult.transactions.length > 0) {
      await Promise.all(
        backtestResult.transactions.map(async (tx) => {
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
        transactionCount: backtestResult.transactions.length
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

// 生成网格点函数（从前端移植）
function generateGridPoints(strategy: GridStrategy) {
  const {
    initialPrice,
    gridCount,
    gridWidth,
    gridMode,
    strategyType,
    investmentPerGrid,
    enableMediumGrid,
    mediumGridMultiplier = 3,
    enableLargeGrid,
    largeGridMultiplier = 5,
    retainedProfitsRatio,
    maxPercentOfDecline = 40,
    enableMaxDeclineLimit
  } = strategy;
  
  const gridPoints = [];
  
  // 计算最小档位比例（基于最大下跌幅度限制）
  const minGearPercentage = enableMaxDeclineLimit 
    ? -maxPercentOfDecline  // 负值表示下跌幅度
    : -Infinity;  // 没有限制
  
  // 生成所有的网格点位
  if (strategyType === 'symmetric') {
    // 对称网格策略
    // 小网格
    for (let i = -gridCount; i <= gridCount; i++) {
      let price: number;
      let percentage: number;
      
      if (gridMode === 'percentage') {
        // 百分比模式
        percentage = i * gridWidth;
        
        // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
        if (percentage < minGearPercentage) continue;
        
        price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
      } else {
        // 绝对值模式
        const absoluteGridWidth = strategy.absoluteGridWidth || 0.025;
        const absoluteChange = i * absoluteGridWidth;
        price = Number((initialPrice + absoluteChange).toFixed(4));
        
        // 计算对应的百分比变化
        percentage = ((price / initialPrice) - 1) * 100;
        
        // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
        if (percentage < minGearPercentage) continue;
        
        // 确保价格为正
        if (price <= 0) continue;
      }
      
      // 修改: 0%也作为买入或卖出点，根据实际情况在回测中确定方向
      let operation: string;
      
      if (percentage < 0) {
        operation = '买入';
      } else {
        // 包括0%和大于0%的情况都设为'卖出'，实际操作将在回测中根据穿越方向决定
        operation = '卖出';
      }
      
      // 创建完整的网格点对象，确保包含所有可能的属性
      const point: any = {
        price,
        percentage,
        operation,
        gridType: '小网格'
      };

      // 计算买卖相关数据
      if (operation === '买入') {
        // 买入情况
        point.buyAmount = investmentPerGrid;
        // 按照100份整数买入
        point.buyCount = Math.floor(point.buyAmount / price / 100) * 100; 
        // 调整实际买入金额
        point.buyAmount = point.buyCount * price; 
        
        // 计算此买入点对应的下一个卖出点的百分比（用于固定数量卖出策略）
        if (gridMode === 'percentage') {
          // 百分比模式下，下一个卖出点是当前百分比加上网格宽度
          point.correspondingSellLevel = percentage + gridWidth;
        } else {
          // 绝对值模式下，下一个卖出点是当前价格加上网格宽度对应的百分比
          const absoluteGridWidth = strategy.absoluteGridWidth || 0.025;
          const nextPrice = price + absoluteGridWidth;
          point.correspondingSellLevel = ((nextPrice / initialPrice) - 1) * 100;
        }
      } else if (operation === '卖出' && i > 0) {
        // 卖出情况，计算留存利润
        // 对应买入价格，根据网格模式计算
        let buyPrice: number;
        
        if (gridMode === 'percentage') {
          buyPrice = initialPrice * (1 - percentage / 100);
        } else {
          // 在绝对模式下，买入价格是当前卖出价格减去两倍的网格宽度
          const absoluteGridWidth = strategy.absoluteGridWidth || 0.025;
          buyPrice = price - (2 * absoluteGridWidth);
          // 确保买入价格为正
          if (buyPrice <= 0) buyPrice = price * 0.5; // 应急处理
        }
        
        point.buyAmount = investmentPerGrid;
        point.buyCount = Math.floor(point.buyAmount / buyPrice / 100) * 100;
        point.buyAmount = point.buyCount * buyPrice;
        
        point.sellAmount = point.buyCount * price;
        point.profits = point.sellAmount - point.buyAmount;
        point.returnRate = ((point.profits / point.buyAmount) * 100).toFixed(2) + '%';
        
        // 留存利润相关计算
        point.retainedProfits = point.profits * retainedProfitsRatio;
        // 按照100份整数卖出
        point.sellCount = Math.floor((point.sellAmount - point.retainedProfits) / price / 100) * 100;
        // 调整实际卖出金额
        point.sellAmount = point.sellCount * price;
        // 调整实际留存利润
        point.retainedProfits = point.sellAmount - point.buyAmount - (point.sellCount * price);
        point.retainedCount = point.retainedProfits > 0 ? point.retainedProfits / price : 0;
      }
      
      gridPoints.push(point);
    }
    
    // 中网格
    if (enableMediumGrid) {
      // 中网格逻辑实现...省略详细实现
      // 与小网格相似，但使用mediumGridMultiplier倍数
    }
    
    // 大网格
    if (enableLargeGrid) {
      // 大网格逻辑实现...省略详细实现
      // 与小网格相似，但使用largeGridMultiplier倍数
    }
  } else {
    // 单向下跌网格策略
    // 小网格
    for (let i = 0; i <= gridCount; i++) {
      let price: number;
      let percentage: number;
      
      if (gridMode === 'percentage') {
        // 百分比模式
        percentage = -i * gridWidth;
        
        // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
        if (percentage < minGearPercentage) continue;
        
        price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
      } else {
        // 绝对值模式
        const absoluteGridWidth = strategy.absoluteGridWidth || 0.025;
        const absoluteChange = -i * absoluteGridWidth;
        price = Number((initialPrice + absoluteChange).toFixed(4));
        
        // 计算对应的百分比变化
        percentage = ((price / initialPrice) - 1) * 100;
        
        // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
        if (percentage < minGearPercentage) continue;
        
        // 确保价格为正
        if (price <= 0) continue;
      }
      
      const operation = i === 0 ? '起始点' : '买入';
      
      // 创建完整的网格点对象，确保包含所有可能的属性
      const point: any = {
        price,
        percentage,
        operation,
        gridType: '小网格'
      };
      
      // 计算买卖相关数据
      if (operation === '买入') {
        point.buyAmount = investmentPerGrid;
        point.buyCount = Math.floor(point.buyAmount / price / 100) * 100;
        point.buyAmount = point.buyCount * price;
      }
      
      gridPoints.push(point);
    }
    
    // 中网格和大网格实现省略...
  }
  
  // 按价格从高到低排序
  return gridPoints.sort((a, b) => b.price - a.price);
} 