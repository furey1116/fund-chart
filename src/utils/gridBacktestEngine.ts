// 网格回测引擎
// 包含两种回测模式：1. 基于日线数据回测 2. 基于日内高低点数据回测

// 网格点类型定义
export interface GridPoint {
  price: number;
  percentage: number;
  operation: string;
  gridType?: string;
  buyAmount?: number;
  buyCount?: number;
  sellAmount?: number;
  sellCount?: number;
  profits?: number;
  returnRate?: string;
  retainedProfits?: number;
  retainedCount?: number;
  correspondingSellLevel?: number;
  correspondingBuyLevel?: number;
}

// 网格策略类型定义
export interface GridStrategy {
  id?: string;
  userId?: string;
  fundCode: string;
  fundName: string;
  initialPrice: number;
  strategyType: string; // 'symmetric' 或 'downward'
  gridMode: string; // 'percentage' 或 'absolute'
  sellStrategy: string; // 'dynamic' 或 'fixed'
  gridCount: number;
  gridWidth: number;
  absoluteGridWidth?: number;
  investmentPerGrid: number;
  enableMediumGrid: boolean;
  mediumGridMultiplier?: number;
  enableLargeGrid: boolean;
  largeGridMultiplier?: number;
  retainedProfitsRatio: number;
  maxPercentOfDecline?: number;
  enableMaxDeclineLimit: boolean;
  enableIntraDayBacktest: boolean;
  gridPoints: GridPoint[];
}

// 交易记录类型定义
export interface Transaction {
  date: string;
  price: number;
  operation: string;
  amount: number;
  shares: number;
  gridLevel: number;
  gridType?: string;
  key?: number;
  fee?: number;
  buyDate?: string;
}

// 回测结果类型定义
export interface BacktestResults {
  totalInvestment: number;
  totalValue: number;
  totalShares: number;
  transactions: Transaction[];
  dates: string[];
  netValues: number[];
  investmentLine: number[];
  valueLine: number[];
  triggerHistory: TriggerHistory[];
  totalFees: number;
  totalSellProceeds: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  profitAmount?: number;
  profitPercentage?: number;
  transactionCount?: number;
  buyCount?: number;
  sellCount?: number;
}

// 网格触发历史记录类型定义
export interface TriggerHistory {
  date: string;
  price: number;
  prevPrice: number;
  triggers: TriggerItem[];
}

// 触发项类型定义
export interface TriggerItem {
  gridLevel: number;
  gridType: string;
  triggerPrice: number;
  triggered: boolean;
  direction: string;
  operation: string;
}

// K线数据类型定义
export interface KLineData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
  scale: number;
}

// 净值数据类型定义
export interface NetValueData {
  FSRQ: string; // 日期
  DWJZ: string; // 单位净值
  LJJZ?: string; // 累计净值
}

// 回测引擎类
export class GridBacktestEngine {
  // 手续费率常量
  private static readonly TRANSACTION_FEE_RATE = 0.0003; // 万分之三

  // 主回测函数
  public static runBacktest(params: {
    strategy: GridStrategy,
    data: KLineData[] | NetValueData[],
    useIntraDayData: boolean
  }): BacktestResults {
    const { strategy, data, useIntraDayData } = params;

    // 根据数据类型和回测模式选择不同的回测方法
    if (useIntraDayData) {
      // 使用K线数据（日内高低点）进行回测
      return this.runIntraDayBacktest(strategy, data as KLineData[]);
    } else {
      // 使用净值数据进行回测
      return this.runDailyBacktest(strategy, data as NetValueData[]);
    }
  }

  // 基于日内高低点的回测方法
  private static runIntraDayBacktest(strategy: GridStrategy, klineData: KLineData[]): BacktestResults {
    // 按日期排序
    const sortedData = [...klineData].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    // 回测结果初始化
    const results: BacktestResults = {
      totalInvestment: 0,  // 总投入（净投入，即买入总额-卖出总额）
      totalValue: 0,       // 当前持有份额的市值
      totalShares: 0,      // 当前持有份额
      transactions: [],    // 交易记录
      dates: [],
      netValues: [],
      investmentLine: [],
      valueLine: [],
      triggerHistory: [],
      totalFees: 0,        // 总手续费
      totalSellProceeds: 0, // 卖出所得现金（卖出金额-卖出手续费）
      totalBuyAmount: 0,    // 总买入金额（包含手续费）
      totalSellAmount: 0,   // 总卖出金额（不扣除手续费）
      profitAmount: 0,
      profitPercentage: 0,
      transactionCount: 0,
      buyCount: 0,
      sellCount: 0
    };

    // 用于跟踪买入记录（固定数量卖出策略）
    const buyRecords: {
      gridLevel: number;     // 买入网格级别
      nextSellLevel: number; // 下一个卖出点级别
      gridType: string;
      shares: number;
      price: number;
      date: string;
    }[] = [];

    // 用于跟踪持仓中的最低买入价格，初始设为初始价格
    let lowestBuyPrice = strategy.initialPrice;

    // 对每个交易日进行回测
    sortedData.forEach((dayData, index) => {
      const currentDate = dayData.date.toISOString().split('T')[0]; // 日期格式化为YYYY-MM-DD
      const closePrice = dayData.close;
      
      // 记录日期和收盘价（作为净值）
      results.dates.push(currentDate);
      results.netValues.push(closePrice);
      
      // 如果是第一天，仅初始化状态
      if (index === 0) {
        results.investmentLine.push(0);
        results.valueLine.push(0);
        return;
      }
      
      // 前一天的收盘价
      const prevDayClose = sortedData[index - 1].close;
      
      // 创建当天的触发历史记录
      const dayTriggerHistory: TriggerHistory = {
        date: currentDate,
        price: closePrice,
        prevPrice: prevDayClose,
        triggers: []
      };
      
      // 定义价格路径序列
      // 我们考虑两种可能的日内价格路径:
      // 路径1: 开盘价->最高价->最低价->收盘价 (先涨后跌)
      // 路径2: 开盘价->最低价->最高价->收盘价 (先跌后涨)
      
      // 判断价格路径 - 根据最高价和最低价与开盘价、收盘价的相对位置判断可能的价格路径
      let pricePath: Array<{price: number, label: string}>;
      
      // 简单的启发式方法确定价格路径
      // 如果开盘价更接近最高价，则假设先涨后跌
      // 如果开盘价更接近最低价，则假设先跌后涨
      const openToHigh = Math.abs(dayData.open - dayData.high);
      const openToLow = Math.abs(dayData.open - dayData.low);
      
      if (openToHigh <= openToLow) {
        // 开盘价更接近最高价，假设路径1: 开盘->最高->最低->收盘
        pricePath = [
          { price: dayData.open, label: '开盘价' },
          { price: dayData.high, label: '最高价' },
          { price: dayData.low, label: '最低价' },
          { price: closePrice, label: '收盘价' }
        ];
      } else {
        // 开盘价更接近最低价，假设路径2: 开盘->最低->最高->收盘
        pricePath = [
          { price: dayData.open, label: '开盘价' },
          { price: dayData.low, label: '最低价' },
          { price: dayData.high, label: '最高价' },
          { price: closePrice, label: '收盘价' }
        ];
      }
      
      // 去除重复的价格点（如果存在）
      const uniquePricePath = [pricePath[0]];
      for (let i = 1; i < pricePath.length; i++) {
        if (Math.abs(pricePath[i].price - uniquePricePath[uniquePricePath.length - 1].price) > 0.0001) {
          uniquePricePath.push(pricePath[i]);
        }
      }
      
      // 日内价格路径模拟 - 检查每相邻两个价格点之间是否触发网格
      for (let i = 0; i < uniquePricePath.length - 1; i++) {
        const startPrice = uniquePricePath[i].price;
        const endPrice = uniquePricePath[i + 1].price;
        const priceMovement = startPrice > endPrice ? 'down' : 'up';
        
        // 检查是否有网格点在这两个价格之间被触发
        strategy.gridPoints.forEach(point => {
          // 只有当网格价格在起始价格和结束价格之间时，才会被触发
          const inRange = (startPrice >= point.price && endPrice <= point.price) || 
                        (startPrice <= point.price && endPrice >= point.price);
          
          if (inRange) {
            let operation = '';
            let triggered = false;
            
            // 确定操作方向：价格下跌触发买入，价格上涨触发卖出
            if (priceMovement === 'down' && startPrice > point.price && endPrice <= point.price) {
              operation = '买入';
              triggered = true;
            } else if (priceMovement === 'up' && startPrice < point.price && endPrice >= point.price) {
              operation = '卖出';
              triggered = true;
            }
            
            // 记录触发信息
            dayTriggerHistory.triggers.push({
              gridLevel: point.percentage,
              gridType: point.gridType || '小网格',
              triggerPrice: point.price,
              triggered: triggered,
              direction: priceMovement === 'down' ? '从上方穿越' : '从下方穿越',
              operation: operation
            });
            
            // 如果触发了交易，执行相应操作
            if (triggered) {
              // 获取网格对应的投资倍数
              const multiplier = point.gridType === '中网格' ? (strategy.mediumGridMultiplier || 3) 
                             : point.gridType === '大网格' ? (strategy.largeGridMultiplier || 5)
                             : 1;
              
              // 使用网格价格执行交易
              const tradePrice = point.price;
              
              if (operation === '买入') {
                // 执行买入逻辑
                const actualInvestment = strategy.investmentPerGrid * multiplier;
                // 必须按100份整数买入
                const shares = Math.floor(actualInvestment / tradePrice / 100) * 100;
                // 调整实际投资金额
                const adjustedInvestment = shares * tradePrice;
                
                // 计算手续费
                const fee = adjustedInvestment * this.TRANSACTION_FEE_RATE;
                
                // 更新统计数据
                results.totalFees += fee;
                results.totalBuyAmount += (adjustedInvestment + fee);
                results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
                results.totalShares += shares;
                results.buyCount = (results.buyCount || 0) + 1;
                
                // 更新最低买入价格
                lowestBuyPrice = Math.min(lowestBuyPrice, tradePrice);
                
                // 记录交易
                results.transactions.push({
                  date: `${currentDate} (${uniquePricePath[i].label}→${uniquePricePath[i+1].label})`,
                  price: tradePrice,
                  operation: '买入',
                  amount: adjustedInvestment,
                  shares,
                  gridLevel: point.percentage,
                  gridType: point.gridType,
                  fee: fee,
                  buyDate: currentDate
                });
                
                // 固定数量卖出策略的记录
                if (strategy.sellStrategy === 'fixed') {
                  let nextSellLevel: number;
                  if (strategy.gridMode === 'percentage') {
                    nextSellLevel = point.percentage + strategy.gridWidth;
                  } else {
                    const nextPrice = tradePrice + (strategy.absoluteGridWidth || 0.025);
                    nextSellLevel = ((nextPrice / strategy.initialPrice) - 1) * 100;
                  }
                  
                  buyRecords.push({
                    gridLevel: point.percentage,
                    nextSellLevel: nextSellLevel,
                    gridType: point.gridType || '小网格',
                    shares: shares,
                    price: tradePrice,
                    date: currentDate
                  });
                }
              } else if (operation === '卖出' && results.totalShares > 0) {
                // 根据卖出策略执行卖出逻辑
                if (strategy.sellStrategy === 'dynamic') {
                  // 动态卖出策略 - 以最低买入价格作为参考点
                  let currentGridPosition: number;
                  
                  if (strategy.gridMode === 'percentage') {
                    // 百分比模式：计算当前价格相对于最低买入价格的百分比变化
                    const percentageChange = ((tradePrice / lowestBuyPrice) - 1) * 100;
                    // 转换为网格位置
                    currentGridPosition = percentageChange / strategy.gridWidth;
                  } else {
                    // 绝对值模式：计算当前价格相对于最低买入价格的绝对变化
                    const absoluteChange = tradePrice - lowestBuyPrice;
                    // 转换为网格位置
                    currentGridPosition = absoluteChange / (strategy.absoluteGridWidth || 0.025);
                  }
                  
                  // 确保网格位置在有效范围内
                  currentGridPosition = Math.max(0, Math.min(strategy.gridCount, currentGridPosition));
                  
                  // 计算卖出比例
                  const sellRatio = currentGridPosition / strategy.gridCount;
                  
                  // 计算卖出份额
                  const sharesToSell = results.totalShares * sellRatio * multiplier;
                  // 必须按100份整数卖出
                  const adjustedSharesToSell = Math.floor(sharesToSell / 100) * 100;
                  
                  // 执行卖出
                  if (adjustedSharesToSell > 0 && results.totalShares >= adjustedSharesToSell) {
                    const sellAmount = adjustedSharesToSell * tradePrice;
                    const fee = sellAmount * this.TRANSACTION_FEE_RATE;
                    
                    // 更新统计数据
                    results.totalFees += fee;
                    results.totalSellProceeds += (sellAmount - fee);
                    results.totalSellAmount += sellAmount;
                    results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
                    results.sellCount = (results.sellCount || 0) + 1;
                    
                    // 计算利润留存
                    const avgCostPerShare = results.totalShares > 0 ? results.totalInvestment / results.totalShares : 0;
                    const actualSharesToSell = adjustedSharesToSell;
                    
                    // 执行卖出
                    results.totalShares -= actualSharesToSell;
                    results.totalInvestment -= (actualSharesToSell * avgCostPerShare);
                    
                    // 记录交易
                    results.transactions.push({
                      date: `${currentDate} (${uniquePricePath[i].label}→${uniquePricePath[i+1].label})`,
                      price: tradePrice,
                      operation: '卖出',
                      amount: sellAmount,
                      shares: actualSharesToSell,
                      gridLevel: point.percentage,
                      gridType: point.gridType,
                      fee: fee,
                      buyDate: currentDate
                    });
                  }
                } else if (strategy.sellStrategy === 'fixed') {
                  // 固定数量卖出策略
                  const currentLevel = point.percentage;
                  const matchingBuyRecords = buyRecords.filter(record => 
                    record.nextSellLevel <= currentLevel && 
                    record.gridType === (point.gridType || '小网格')
                  );
                  
                  // 处理每条匹配的买入记录
                  for (const buyRecord of matchingBuyRecords) {
                    const buyShares = buyRecord.shares;
                    const sellShares = Math.floor(buyShares * (1 - strategy.retainedProfitsRatio) / 100) * 100;
                    
                    if (sellShares > 0 && results.totalShares >= sellShares) {
                      const sellAmount = sellShares * tradePrice;
                      const buyAmount = buyShares * buyRecord.price;
                      
                      // 计算手续费
                      const fee = sellAmount * this.TRANSACTION_FEE_RATE;
                      
                      // 更新统计数据
                      results.totalFees += fee;
                      results.totalSellProceeds += (sellAmount - fee);
                      results.totalSellAmount += sellAmount;
                      results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
                      results.totalShares -= sellShares;
                      results.totalInvestment -= buyAmount;
                      results.sellCount = (results.sellCount || 0) + 1;
                      
                      // 记录交易
                      results.transactions.push({
                        date: `${currentDate} (${uniquePricePath[i].label}→${uniquePricePath[i+1].label})`,
                        price: tradePrice,
                        operation: '卖出',
                        amount: sellAmount,
                        shares: sellShares,
                        gridLevel: point.percentage,
                        gridType: point.gridType,
                        fee: fee,
                        buyDate: buyRecord.date
                      });
                      
                      // 记录留存利润
                      const localRetainedShares = buyShares - sellShares;
                      if (localRetainedShares > 0) {
                        results.transactions.push({
                          date: `${currentDate} (${uniquePricePath[i].label}→${uniquePricePath[i+1].label})`,
                          price: tradePrice,
                          operation: '留存利润',
                          amount: localRetainedShares * tradePrice,
                          shares: localRetainedShares,
                          gridLevel: point.percentage,
                          gridType: point.gridType,
                          fee: 0
                        });
                      }
                      
                      // 从买入记录中移除已卖出的记录
                      const index = buyRecords.indexOf(buyRecord);
                      if (index > -1) {
                        buyRecords.splice(index, 1);
                      }
                    }
                  }
                }
              }
            }
          }
        });
      }
      
      // 保存当天的触发历史
      results.triggerHistory.push(dayTriggerHistory);
      
      // 更新收盘时的持仓价值
      results.totalValue = results.totalShares * closePrice;
      results.investmentLine.push(results.totalInvestment);
      results.valueLine.push(results.totalValue);
    });
    
    // 计算最终统计数据
    results.transactionCount = results.transactions.length;
    
    // 计算收益金额和收益率
    const netInvestment = results.totalBuyAmount - results.totalSellAmount;
    results.profitAmount = results.totalValue - netInvestment;
    results.profitPercentage = netInvestment > 0 ? (results.profitAmount / netInvestment) * 100 : 0;
    
    return results;
  }

  // 基于日线数据的回测方法
  private static runDailyBacktest(strategy: GridStrategy, netValueData: NetValueData[]): BacktestResults {
    // 按日期从早到晚排序
    const sortedData = [...netValueData].sort(
      (a, b) => new Date(a.FSRQ).getTime() - new Date(b.FSRQ).getTime()
    );

    // 回测结果初始化
    const results: BacktestResults = {
      totalInvestment: 0,  // 总投入（净投入，即买入总额-卖出总额）
      totalValue: 0,       // 当前持有份额的市值
      totalShares: 0,      // 当前持有份额
      transactions: [],    // 交易记录
      dates: [],
      netValues: [],
      investmentLine: [],
      valueLine: [],
      triggerHistory: [],
      totalFees: 0,        // 总手续费
      totalSellProceeds: 0, // 卖出所得现金（卖出金额-卖出手续费）
      totalBuyAmount: 0,    // 总买入金额（包含手续费）
      totalSellAmount: 0,   // 总卖出金额（不扣除手续费）
      profitAmount: 0,
      profitPercentage: 0,
      transactionCount: 0,
      buyCount: 0,
      sellCount: 0
    };

    // 用于跟踪持仓中的最低买入价格，初始设为初始价格
    let lowestBuyPrice = strategy.initialPrice;
    
    // 用于跟踪固定数量卖出策略所需的信息
    const buyRecords: {
      gridLevel: number;
      nextSellLevel: number;
      gridType: string;
      shares: number;
      price: number;
      date: string;
    }[] = [];

    // 按照网格点位进行回测
    sortedData.forEach((item, index) => {
      const currentDate = item.FSRQ;
      const currentPrice = parseFloat(item.DWJZ);
      
      results.dates.push(currentDate);
      results.netValues.push(currentPrice);
      
      // 如果是第一天，记录初始状态
      if (index === 0) {
        results.investmentLine.push(0);
        results.valueLine.push(0);
        return;
      }
      
      // 前一天的价格
      const prevPrice = parseFloat(sortedData[index - 1].DWJZ);
      
      // 创建当天的触发历史记录
      const dayTriggerHistory: TriggerHistory = {
        date: currentDate,
        price: currentPrice,
        prevPrice: prevPrice,
        triggers: []
      };
      
      // 检查是否触发任何网格点位
      strategy.gridPoints.forEach(point => {
        // 判断价格是否从上方或下方穿过网格点
        const crossedFromAbove = prevPrice > point.price && currentPrice <= point.price;
        const crossedFromBelow = prevPrice < point.price && currentPrice >= point.price;
        
        // 确定操作类型 - 从上方穿越时买入，从下方穿越时卖出
        let operation = '';
        let triggered = false;
        
        if (crossedFromAbove) {
          operation = '买入';
          triggered = true;
        } else if (crossedFromBelow) {
          operation = '卖出';
          triggered = true;
        }
        
        // 记录网格触发历史
        dayTriggerHistory.triggers.push({
          gridLevel: point.percentage,
          gridType: point.gridType || '小网格',
          triggerPrice: point.price,
          triggered: triggered,
          direction: crossedFromAbove ? '从上方穿越' : crossedFromBelow ? '从下方穿越' : '未穿越',
          operation: operation || point.operation
        });
        
        // 如果触发了网格点，执行相应操作
        if (triggered) {
          // 根据网格类型决定投资金额倍数
          const multiplier = point.gridType === '中网格' ? (strategy.mediumGridMultiplier || 3) 
                           : point.gridType === '大网格' ? (strategy.largeGridMultiplier || 5)
                           : 1;
          
          // 使用网格价格而非当日净值
          const tradePrice = point.price;
          
          if (operation === '买入') {
            // 买入操作
            const actualInvestment = strategy.investmentPerGrid * multiplier;
            // 必须按100份整数买入，使用网格价格
            const shares = Math.floor(actualInvestment / tradePrice / 100) * 100;
            // 调整实际投资金额
            const adjustedInvestment = shares * tradePrice;
            
            // 计算手续费
            const fee = adjustedInvestment * this.TRANSACTION_FEE_RATE;
            // 更新总手续费
            results.totalFees += fee;
            
            // 更新总买入金额（包含手续费）
            results.totalBuyAmount += (adjustedInvestment + fee);
            // 更新净投入（买入总额-卖出总额）
            results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
            
            results.totalShares += shares;
            results.buyCount = (results.buyCount || 0) + 1;
            
            // 更新最低买入价格
            lowestBuyPrice = Math.min(lowestBuyPrice, tradePrice);
            
            results.transactions.push({
              date: currentDate,
              price: tradePrice,  // 使用网格价格
              operation: '买入',
              amount: adjustedInvestment,
              shares,
              gridLevel: point.percentage,
              gridType: point.gridType,
              fee: fee,  // 记录手续费
              buyDate: currentDate  // 记录买入日期
            });
            
            // 记录买入信息，用于固定数量卖出策略
            if (strategy.sellStrategy === 'fixed') {
              // 计算下一个卖出点的级别
              let nextSellLevel: number;
              
              if (strategy.gridMode === 'percentage') {
                // 百分比模式下，下一个卖出点是当前百分比加上网格宽度
                nextSellLevel = point.percentage + strategy.gridWidth;
              } else {
                // 绝对值模式下，下一个卖出点是当前价格加上网格宽度对应的百分比
                const nextPrice = tradePrice + (strategy.absoluteGridWidth || 0.025);
                nextSellLevel = ((nextPrice / strategy.initialPrice) - 1) * 100;
              }
              
              buyRecords.push({
                gridLevel: point.percentage,
                nextSellLevel: nextSellLevel,
                gridType: point.gridType || '小网格',
                shares: shares,
                price: tradePrice,
                date: currentDate
              });
            }
          } else if (operation === '卖出' && results.totalShares > 0) {
            if (strategy.sellStrategy === 'dynamic') {
              // 动态卖出策略 - 以最低买入价格作为参考点计算卖出份额
              
              // 计算当前价格相对于最低买入价格的位置
              let currentGridPosition: number;
              
              if (strategy.gridMode === 'percentage') {
                // 百分比模式：计算当前价格相对于最低买入价格的百分比变化
                const percentageChange = ((tradePrice / lowestBuyPrice) - 1) * 100;
                // 转换为网格位置
                currentGridPosition = percentageChange / strategy.gridWidth;
              } else {
                // 绝对值模式：计算当前价格相对于最低买入价格的绝对变化
                const absoluteChange = tradePrice - lowestBuyPrice;
                // 转换为网格位置
                currentGridPosition = absoluteChange / (strategy.absoluteGridWidth || 0.025);
              }
              
              // 确保网格位置在有效范围内
              currentGridPosition = Math.max(0, Math.min(strategy.gridCount, currentGridPosition));
              
              // 计算卖出比例
              const sellRatio = currentGridPosition / strategy.gridCount;
              
              // 计算卖出份额
              const sharesToSell = results.totalShares * sellRatio * multiplier;
              
              // 必须按100份整数卖出
              const adjustedSharesToSell = Math.floor(sharesToSell / 100) * 100;
              
              // 计算卖出金额
              const sellAmount = adjustedSharesToSell * tradePrice;
              
              // 只要卖出金额和份额为正值即可执行卖出
              if (sellAmount > 0 && adjustedSharesToSell > 0) {
                // 计算手续费
                const fee = sellAmount * this.TRANSACTION_FEE_RATE;
                
                // 计算扣除手续费后的收益
                const netSellAmount = sellAmount - fee;
                const avgCostPerShare = results.totalShares > 0 ? results.totalInvestment / results.totalShares : 0;
                const costBasis = adjustedSharesToSell * avgCostPerShare;
                const profits = netSellAmount - costBasis;
                
                // 新的留存利润计算逻辑
                let actualSharesToSell = adjustedSharesToSell;
                let retainedShares = 0;
                
                // 只在有正收益且留存比例大于0时计算留存份额
                if (profits > 0 && strategy.retainedProfitsRatio > 0) {
                  // 计算应该留存的金额
                  const retainedAmount = profits * strategy.retainedProfitsRatio;
                  // 转换为份额(按100份取整)
                  retainedShares = Math.floor(retainedAmount / tradePrice / 100) * 100;
                  
                  // 确保留存份额不大于计划卖出份额的80%（防止过度留存导致无法卖出）
                  retainedShares = Math.min(retainedShares, Math.floor(adjustedSharesToSell * 0.8 / 100) * 100);
                  
                  // 计算实际卖出份额
                  actualSharesToSell = adjustedSharesToSell - retainedShares;
                }
                
                // 确保实际卖出份额至少为100份
                actualSharesToSell = Math.max(actualSharesToSell, 100);
                
                // 重新计算实际卖出金额和手续费
                const actualSellAmount = actualSharesToSell * tradePrice;
                const actualFee = actualSellAmount * this.TRANSACTION_FEE_RATE;
                
                // 计算实际留存金额
                const retainedAmount = (adjustedSharesToSell - actualSharesToSell) * tradePrice;
                
                // 更新总手续费
                results.totalFees += actualFee;
                
                // 更新卖出所得现金
                results.totalSellProceeds += (actualSellAmount - actualFee);
                
                // 更新总卖出金额（不扣除手续费）
                results.totalSellAmount += actualSellAmount;
                
                // 更新净投入（买入总额-卖出总额）
                results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
                
                results.sellCount = (results.sellCount || 0) + 1;
                
                // 实际卖出操作
                results.totalShares -= actualSharesToSell;
                
                // 减少的投资金额需要考虑平均成本
                results.totalInvestment -= (actualSharesToSell * avgCostPerShare);
                
                // 记录卖出交易
                results.transactions.push({
                  date: currentDate,
                  price: tradePrice,
                  operation: '卖出',
                  amount: actualSellAmount,
                  shares: actualSharesToSell,
                  gridLevel: point.percentage,
                  gridType: point.gridType,
                  fee: actualFee,
                  buyDate: currentDate
                });
                
                // 记录留存利润（如果有）
                if (retainedShares > 0 && retainedAmount > 0) {
                  results.transactions.push({
                    date: currentDate,
                    price: tradePrice,
                    operation: '留存利润',
                    amount: retainedAmount,
                    shares: retainedShares,
                    gridLevel: point.percentage,
                    gridType: point.gridType,
                    fee: 0  // 留存利润不额外收取手续费
                  });
                }
              }
            } else if (strategy.sellStrategy === 'fixed') {
              // 固定数量卖出策略 - 卖出所有达到卖出条件的买入记录
              // 找出所有应该在当前网格点卖出的买入记录
              const currentLevel = point.percentage;
              const matchingBuyRecords = buyRecords.filter(record => 
                record.nextSellLevel <= currentLevel && 
                record.gridType === (point.gridType || '小网格')
              );
              
              if (matchingBuyRecords.length > 0) {
                // 遍历每个匹配的买入记录并执行卖出
                for (const buyRecord of matchingBuyRecords) {
                  // 根据留存利润比例计算卖出份额
                  const buyShares = buyRecord.shares;
                  const sellShares = Math.floor(buyShares * (1 - strategy.retainedProfitsRatio) / 100) * 100;
                  
                  if (sellShares > 0 && results.totalShares >= sellShares) {
                    // 使用网格价格计算卖出金额
                    const sellAmount = sellShares * tradePrice;
                    const buyAmount = buyShares * buyRecord.price;
                    
                    // 计算手续费
                    const fee = sellAmount * this.TRANSACTION_FEE_RATE;
                    // 更新总手续费
                    results.totalFees += fee;
                    
                    // 更新卖出所得现金
                    results.totalSellProceeds += (sellAmount - fee);
                    
                    // 更新总卖出金额（不扣除手续费）
                    results.totalSellAmount += sellAmount;
                    // 更新净投入（买入总额-卖出总额）
                    results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
                    
                    results.totalShares -= sellShares;
                    results.sellCount = (results.sellCount || 0) + 1;
                    // 减少投资金额需要考虑原始买入价格
                    results.totalInvestment -= buyAmount;
                    
                    results.transactions.push({
                      date: currentDate,
                      price: tradePrice,
                      operation: '卖出',
                      amount: sellAmount,
                      shares: sellShares,
                      gridLevel: point.percentage,
                      gridType: point.gridType,
                      fee: fee,
                      buyDate: buyRecord.date  // 记录对应的买入日期
                    });
                    
                    // 记录留存利润
                    const localRetainedShares = buyShares - sellShares;
                    if (localRetainedShares > 0) {
                      results.transactions.push({
                        date: currentDate,
                        price: tradePrice,
                        operation: '留存利润',
                        amount: localRetainedShares * tradePrice,
                        shares: localRetainedShares,
                        gridLevel: point.percentage,
                        gridType: point.gridType,
                        fee: 0
                      });
                    }
                    
                    // 从买入记录中移除已卖出的记录
                    const index = buyRecords.indexOf(buyRecord);
                    if (index > -1) {
                      buyRecords.splice(index, 1);
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      // 添加当天的触发历史到结果中
      results.triggerHistory.push(dayTriggerHistory);
      
      // 更新当前持有份额的市值，使用当天的实际净值
      results.totalValue = results.totalShares * currentPrice;
      
      // 记录投资曲线和价值曲线
      results.investmentLine.push(results.totalInvestment);
      results.valueLine.push(results.totalValue);
    });
    
    // 计算最终统计数据
    results.transactionCount = results.transactions.length;
    
    // 计算收益金额和收益率
    const netInvestment = results.totalBuyAmount - results.totalSellAmount;
    results.profitAmount = results.totalValue - netInvestment;
    results.profitPercentage = netInvestment > 0 ? (results.profitAmount / netInvestment) * 100 : 0;
    
    return results;
  }
} 