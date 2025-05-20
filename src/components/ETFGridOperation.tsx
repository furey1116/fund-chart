import React, { useState, useEffect } from 'react';
import { Card, Table, InputNumber, Button, Space, Alert, Tabs, Typography, Switch, Select, Radio, message, Modal, Checkbox } from 'antd';
import type { TabsProps } from 'antd';
import ReactECharts from 'echarts-for-react';
import { FundHistoryNetValue } from '@/api/fund';
import { DownloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

// 网格模式类型定义
type GridModeType = 'percentage' | 'absolute';

// 添加卖出策略类型定义
type SellStrategyType = 'dynamic' | 'fixed';

interface ETFGridOperationProps {
  fundCode: string;
  fundName: string;
  netValueData: FundHistoryNetValue[];
}

interface GridPoint {
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

interface GridStrategy {
  initialPrice: number;
  gridPoints: GridPoint[];
  investmentPerGrid: number;
}

interface Transaction {
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

interface BacktestResults {
  totalInvestment: number;
  totalValue: number;
  totalShares: number;
  transactions: Transaction[];
  dates: string[];
  netValues: number[];
  investmentLine: number[];
  valueLine: number[];
  triggerHistory: {
    date: string;
    price: number;
    prevPrice: number;
    triggers: {
      gridLevel: number;
      gridType: string;
      triggerPrice: number;
      triggered: boolean;
      direction: string;
      operation: string;
    }[];
  }[];
  totalFees: number;
  totalSellProceeds: number;
  // 添加新字段，分别跟踪总买入金额和总卖出金额
  totalBuyAmount: number;
  totalSellAmount: number;
}

const ETFGridOperation: React.FC<ETFGridOperationProps> = ({
  fundCode,
  fundName,
  netValueData,
}) => {
  // 状态定义
  const [initialPrice, setInitialPrice] = useState<number>(0);
  const [gridCount, setGridCount] = useState<number>(5);
  const [gridWidth, setGridWidth] = useState<number>(5);
  const [gridMode, setGridMode] = useState<GridModeType>('percentage'); // 网格模式：百分比或绝对值
  const [absoluteGridWidth, setAbsoluteGridWidth] = useState<number>(0.025); // 绝对宽度模式下的网格宽度
  const [investmentPerGrid, setInvestmentPerGrid] = useState<number>(1000);
  const [strategyType, setStrategyType] = useState<string>('symmetric');
  const [gridStrategy, setGridStrategy] = useState<GridStrategy | null>(null);
  const [showBacktest, setShowBacktest] = useState<boolean>(false);
  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>(null);
  const [enableMediumGrid, setEnableMediumGrid] = useState<boolean>(false);
  const [enableLargeGrid, setEnableLargeGrid] = useState<boolean>(false);
  const [mediumGridMultiplier, setMediumGridMultiplier] = useState<number>(3);
  const [largeGridMultiplier, setLargeGridMultiplier] = useState<number>(5);
  const [retainedProfitsRatio, setRetainedProfitsRatio] = useState<number>(0);
  const [maxPercentOfDecline, setMaxPercentOfDecline] = useState<number>(40);
  const [enableMaxDeclineLimit, setEnableMaxDeclineLimit] = useState<boolean>(false);
  const [exportModalVisible, setExportModalVisible] = useState<boolean>(false);
  const [exportOptions, setExportOptions] = useState<{
    includeSummary: boolean;
    includeTransactions: boolean;
    includeTriggerHistory: boolean;
  }>({
    includeSummary: true,
    includeTransactions: true,
    includeTriggerHistory: true,
  });

  // 添加手续费率常量
  const TRANSACTION_FEE_RATE = 0.0003; // 万分之三

  // 添加卖出策略类型状态，默认使用固定数量策略
  const [sellStrategy, setSellStrategy] = useState<SellStrategyType>('fixed');

  // 当净值数据变化时，自动设置初始价格
  useEffect(() => {
    if (netValueData && netValueData.length > 0) {
      // 默认使用最近的净值作为初始价格
      const latestNetValue = parseFloat(netValueData[0].DWJZ);
      setInitialPrice(Number(latestNetValue.toFixed(4)));
      
      // 初始化默认的绝对网格宽度（约为价格的2.5%）
      if (latestNetValue > 0) {
        setAbsoluteGridWidth(Number((latestNetValue * 0.025).toFixed(4)));
      }
    }
  }, [netValueData]);

  // 生成网格策略
  const generateStrategy = () => {
    if (!initialPrice || initialPrice <= 0) {
      return;
    }

    const gridPoints: GridPoint[] = [];
    
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
        // 原代码: const operation = percentage < 0 ? '买入' : percentage > 0 ? '卖出' : '起始点';
        let operation: string;
        
        if (percentage < 0) {
          operation = '买入';
        } else {
          // 包括0%和大于0%的情况都设为'卖出'，实际操作将在回测中根据穿越方向决定
          operation = '卖出';
        }
        
        const point: GridPoint = {
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
        for (let i = -gridCount; i <= gridCount; i++) {
          // 修改: 不再跳过0点，使中网格也包含0%点
          // 原代码: if (i === 0) continue;
          
          let price: number;
          let percentage: number;
          
          if (gridMode === 'percentage') {
            // 百分比模式
            percentage = i * gridWidth * mediumGridMultiplier;
            
            // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
            if (percentage < minGearPercentage) continue;
            
            price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
          } else {
            // 绝对值模式
            const absoluteChange = i * absoluteGridWidth * mediumGridMultiplier;
            price = Number((initialPrice + absoluteChange).toFixed(4));
            
            // 计算对应的百分比变化
            percentage = ((price / initialPrice) - 1) * 100;
            
            // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
            if (percentage < minGearPercentage) continue;
            
            // 确保价格为正
            if (price <= 0) continue;
          }
          
          // 修改: 0%点也作为交易点，根据实际情况在回测中确定方向
          let operation: string;
          
          if (percentage < 0) {
            operation = '买入';
          } else {
            // 包括0%和大于0%的情况都设为'卖出'，实际操作将在回测中根据穿越方向决定
            operation = '卖出';
          }
          
          const point: GridPoint = {
            price,
            percentage,
            operation,
            gridType: '中网格'
          };
          
          // 计算买卖相关数据
          if (operation === '买入') {
            point.buyAmount = investmentPerGrid * mediumGridMultiplier;
            point.buyCount = Math.floor(point.buyAmount / price / 100) * 100;
            point.buyAmount = point.buyCount * price;
            
            // 计算此买入点对应的下一个卖出点的百分比（用于固定数量卖出策略）
            if (gridMode === 'percentage') {
              // 百分比模式下，下一个卖出点是当前百分比加上网格宽度
              point.correspondingSellLevel = percentage + gridWidth;
            } else {
              // 绝对值模式下，下一个卖出点是当前价格加上网格宽度对应的百分比
              const nextPrice = price + absoluteGridWidth;
              point.correspondingSellLevel = ((nextPrice / initialPrice) - 1) * 100;
            }
          } else if (operation === '卖出') {
            // 对应买入价格，根据网格模式计算
            let buyPrice: number;
            
            if (gridMode === 'percentage') {
              buyPrice = initialPrice * (1 - percentage / 100);
            } else {
              // 在绝对模式下，买入价格是当前卖出价格减去两倍的网格宽度
              buyPrice = price - (2 * absoluteGridWidth * mediumGridMultiplier);
              // 确保买入价格为正
              if (buyPrice <= 0) buyPrice = price * 0.5; // 应急处理
            }
            
            point.buyAmount = investmentPerGrid * mediumGridMultiplier;
            point.buyCount = Math.floor(point.buyAmount / buyPrice / 100) * 100;
            point.buyAmount = point.buyCount * buyPrice;
            
            point.sellAmount = point.buyCount * price;
            point.profits = point.sellAmount - point.buyAmount;
            point.returnRate = ((point.profits / point.buyAmount) * 100).toFixed(2) + '%';
            
            point.retainedProfits = point.profits * retainedProfitsRatio;
            point.sellCount = Math.floor((point.sellAmount - point.retainedProfits) / price / 100) * 100;
            point.sellAmount = point.sellCount * price;
            point.retainedProfits = point.sellAmount - point.buyAmount - (point.sellCount * price);
            point.retainedCount = point.retainedProfits > 0 ? point.retainedProfits / price : 0;
            
            // 计算此买入点对应的下一个卖出点的百分比（用于固定数量卖出策略）
            if (gridMode === 'percentage') {
              // 百分比模式下，下一个卖出点是当前百分比加上网格宽度
              point.correspondingSellLevel = percentage + gridWidth;
            } else {
              // 绝对值模式下，下一个卖出点是当前价格加上网格宽度对应的百分比
              const nextPrice = price + absoluteGridWidth;
              point.correspondingSellLevel = ((nextPrice / initialPrice) - 1) * 100;
            }
          }
          
          gridPoints.push(point);
        }
      }
      
      // 大网格
      if (enableLargeGrid) {
        for (let i = -gridCount; i <= gridCount; i++) {
          // 修改: 不再跳过0点，使大网格也包含0%点
          // 原代码: if (i === 0) continue;
          
          let price: number;
          let percentage: number;
          
          if (gridMode === 'percentage') {
            // 百分比模式
            percentage = i * gridWidth * largeGridMultiplier;
            
            // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
            if (percentage < minGearPercentage) continue;
            
            price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
          } else {
            // 绝对值模式
            const absoluteChange = i * absoluteGridWidth * largeGridMultiplier;
            price = Number((initialPrice + absoluteChange).toFixed(4));
            
            // 计算对应的百分比变化
            percentage = ((price / initialPrice) - 1) * 100;
            
            // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
            if (percentage < minGearPercentage) continue;
            
            // 确保价格为正
            if (price <= 0) continue;
          }
          
          // 修改: 0%点也作为交易点，根据实际情况在回测中确定方向
          let operation: string;
          
          if (percentage < 0) {
            operation = '买入';
          } else {
            // 包括0%和大于0%的情况都设为'卖出'，实际操作将在回测中根据穿越方向决定
            operation = '卖出';
          }
          
          const point: GridPoint = {
            price,
            percentage,
            operation,
            gridType: '大网格'
          };
          
          // 计算买卖相关数据
          if (operation === '买入') {
            point.buyAmount = investmentPerGrid * largeGridMultiplier;
            point.buyCount = Math.floor(point.buyAmount / price / 100) * 100;
            point.buyAmount = point.buyCount * price;
            
            // 计算此买入点对应的下一个卖出点的百分比（用于固定数量卖出策略）
            if (gridMode === 'percentage') {
              // 百分比模式下，下一个卖出点是当前百分比加上网格宽度
              point.correspondingSellLevel = percentage + gridWidth;
            } else {
              // 绝对值模式下，下一个卖出点是当前价格加上网格宽度对应的百分比
              const nextPrice = price + absoluteGridWidth;
              point.correspondingSellLevel = ((nextPrice / initialPrice) - 1) * 100;
            }
          } else if (operation === '卖出') {
            // 对应买入价格，根据网格模式计算
            let buyPrice: number;
            
            if (gridMode === 'percentage') {
              buyPrice = initialPrice * (1 - percentage / 100);
            } else {
              // 在绝对模式下，买入价格是当前卖出价格减去两倍的网格宽度
              buyPrice = price - (2 * absoluteGridWidth * largeGridMultiplier);
              // 确保买入价格为正
              if (buyPrice <= 0) buyPrice = price * 0.5; // 应急处理
            }
            
            point.buyAmount = investmentPerGrid * largeGridMultiplier;
            point.buyCount = Math.floor(point.buyAmount / buyPrice / 100) * 100;
            point.buyAmount = point.buyCount * buyPrice;
            
            point.sellAmount = point.buyCount * price;
            point.profits = point.sellAmount - point.buyAmount;
            point.returnRate = ((point.profits / point.buyAmount) * 100).toFixed(2) + '%';
            
            point.retainedProfits = point.profits * retainedProfitsRatio;
            point.sellCount = Math.floor((point.sellAmount - point.retainedProfits) / price / 100) * 100;
            point.sellAmount = point.sellCount * price;
            point.retainedProfits = point.sellAmount - point.buyAmount - (point.sellCount * price);
            point.retainedCount = point.retainedProfits > 0 ? point.retainedProfits / price : 0;
            
            // 计算此买入点对应的下一个卖出点的百分比（用于固定数量卖出策略）
            if (gridMode === 'percentage') {
              // 百分比模式下，下一个卖出点是当前百分比加上网格宽度
              point.correspondingSellLevel = percentage + gridWidth;
            } else {
              // 绝对值模式下，下一个卖出点是当前价格加上网格宽度对应的百分比
              const nextPrice = price + absoluteGridWidth;
              point.correspondingSellLevel = ((nextPrice / initialPrice) - 1) * 100;
            }
          }
          
          gridPoints.push(point);
        }
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
        
        const point: GridPoint = {
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
      
      // 中网格
      if (enableMediumGrid) {
        for (let i = 1; i <= gridCount; i++) { // 从1开始，跳过起始点
          const percentage = -i * gridWidth * mediumGridMultiplier;
          
          // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
          if (percentage < minGearPercentage) continue;
          
          const price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
          const operation = '买入';
          
          const point: GridPoint = {
            price,
            percentage,
            operation,
            gridType: '中网格'
          };
          
          // 计算买入相关数据
          point.buyAmount = investmentPerGrid * mediumGridMultiplier;
          point.buyCount = Math.floor(point.buyAmount / price / 100) * 100;
          point.buyAmount = point.buyCount * price;
          
          gridPoints.push(point);
        }
      }
      
      // 大网格
      if (enableLargeGrid) {
        for (let i = 1; i <= gridCount; i++) { // 从1开始，跳过起始点
          const percentage = -i * gridWidth * largeGridMultiplier;
          
          // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
          if (percentage < minGearPercentage) continue;
          
          const price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
          const operation = '买入';
          
          const point: GridPoint = {
            price,
            percentage,
            operation,
            gridType: '大网格'
          };
          
          // 计算买入相关数据
          point.buyAmount = investmentPerGrid * largeGridMultiplier;
          point.buyCount = Math.floor(point.buyAmount / price / 100) * 100;
          point.buyAmount = point.buyCount * price;
          
          gridPoints.push(point);
        }
      }
    }
    
    // 按价格从高到低排序
    gridPoints.sort((a, b) => b.price - a.price);
    
    setGridStrategy({
      initialPrice,
      gridPoints,
      investmentPerGrid,
    });
  };

  // 运行回测
  const runBacktest = () => {
    if (!gridStrategy || !netValueData || netValueData.length === 0) {
      return;
    }

    // 按日期从早到晚排序
    const sortedData = [...netValueData].sort(
      (a, b) => new Date(a.FSRQ).getTime() - new Date(b.FSRQ).getTime()
    );

    // 回测结果
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
      totalSellAmount: 0    // 总卖出金额（不扣除手续费）
    };

    // 用于跟踪留存份额
    let retainedShares = 0;

    // 新增：用于跟踪持仓中的最低买入价格，初始设为初始价格
    let lowestBuyPrice = initialPrice;
    
    // 用于跟踪固定数量卖出策略所需的信息
    const buyRecords: {
      gridLevel: number;     // 买入网格级别
      nextSellLevel: number; // 下一个卖出点级别
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
      const dayTriggerHistory = {
        date: currentDate,
        price: currentPrice,
        prevPrice: prevPrice,
        triggers: [] as {
          gridLevel: number;
          gridType: string;
          triggerPrice: number;
          triggered: boolean;
          direction: string;
          operation: string;
        }[]
      };
      
      // 检查是否触发任何网格点位
      gridStrategy.gridPoints.forEach(point => {
        // 判断价格是否从上方或下方穿过网格点
        const crossedFromAbove = prevPrice > point.price && currentPrice <= point.price;
        const crossedFromBelow = prevPrice < point.price && currentPrice >= point.price;
        
        // 确定操作类型 - 从上方穿越时买入，从下方穿越时卖出
        let operation = '';
        let triggered = false;
        
        // 修改: 移除对"起始点"的特殊处理，所有网格点都可以触发交易
        // 原代码: if (point.operation !== '起始点') {
        //   if (crossedFromAbove) {
        //     operation = '买入';
        //     triggered = true;
        //   } else if (crossedFromBelow) {
        //     operation = '卖出';
        //     triggered = true;
        //   }
        // }
        
        // 新代码: 根据穿越方向决定操作
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
          const multiplier = point.gridType === '中网格' ? mediumGridMultiplier 
                           : point.gridType === '大网格' ? largeGridMultiplier
                           : 1;
          
          // 使用网格价格而非当日净值
          const tradePrice = point.price;
          
          if (operation === '买入') {
            // 买入操作
            const actualInvestment = gridStrategy.investmentPerGrid * multiplier;
            // 必须按100份整数买入，使用网格价格
            const shares = Math.floor(actualInvestment / tradePrice / 100) * 100;
            // 调整实际投资金额
            const adjustedInvestment = shares * tradePrice;
            
            // 计算手续费
            const fee = adjustedInvestment * TRANSACTION_FEE_RATE;
            // 更新总手续费
            results.totalFees += fee;
            
            // 更新总买入金额（包含手续费）
            results.totalBuyAmount += (adjustedInvestment + fee);
            // 更新净投入（买入总额-卖出总额）
            results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
            
            results.totalShares += shares;
            
            // 新增：更新最低买入价格
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
            if (sellStrategy === 'fixed') {
              // 计算下一个卖出点的级别
              let nextSellLevel: number;
              
              if (gridMode === 'percentage') {
                // 百分比模式下，下一个卖出点是当前百分比加上网格宽度
                nextSellLevel = point.percentage + gridWidth;
              } else {
                // 绝对值模式下，下一个卖出点是当前价格加上网格宽度对应的百分比
                const nextPrice = tradePrice + absoluteGridWidth;
                nextSellLevel = ((nextPrice / initialPrice) - 1) * 100;
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
            if (sellStrategy === 'dynamic') {
              // 动态卖出策略 - 以最低买入价格作为参考点计算卖出份额
              
              // 计算当前价格相对于最低买入价格的位置
              let currentGridPosition: number;
              
              if (gridMode === 'percentage') {
                // 百分比模式：计算当前价格相对于最低买入价格的百分比变化
                const percentageChange = ((tradePrice / lowestBuyPrice) - 1) * 100;
                // 转换为网格位置
                currentGridPosition = percentageChange / gridWidth;
              } else {
                // 绝对值模式：计算当前价格相对于最低买入价格的绝对变化
                const absoluteChange = tradePrice - lowestBuyPrice;
                // 转换为网格位置
                currentGridPosition = absoluteChange / absoluteGridWidth;
              }
              
              // 确保网格位置在有效范围内
              currentGridPosition = Math.max(0, Math.min(gridCount, currentGridPosition));
              
              // 计算卖出比例
              const sellRatio = currentGridPosition / gridCount;
              
              // 输出调试信息
              console.log(`卖出点位分析 - 日期: ${currentDate}, 价格: ${tradePrice}, 最低买入价: ${lowestBuyPrice}, 网格位置: ${currentGridPosition}, 卖出比例: ${sellRatio}`);
              
              // 计算卖出份额
              const sharesToSell = results.totalShares * sellRatio * multiplier;
              
              // 必须按100份整数卖出
              const adjustedSharesToSell = Math.floor(sharesToSell / 100) * 100;
              
              // 计算卖出金额
              const sellAmount = adjustedSharesToSell * tradePrice;
              
              // 只要卖出金额和份额为正值即可执行卖出（不再限制必须高于初始价格）
              if (sellAmount > 0 && adjustedSharesToSell > 0) {
                // 计算手续费
                const fee = sellAmount * TRANSACTION_FEE_RATE;
                
                // 计算扣除手续费后的收益
                const netSellAmount = sellAmount - fee;
                const avgCostPerShare = results.totalShares > 0 ? results.totalInvestment / results.totalShares : 0;
                const costBasis = adjustedSharesToSell * avgCostPerShare;
                const profits = netSellAmount - costBasis;
                
                // 调试信息
                console.log(`卖出试算 - 日期: ${currentDate}, 价格: ${tradePrice}, 卖出数量: ${adjustedSharesToSell}, 收益: ${profits}, 平均成本: ${avgCostPerShare}`);
                
                // 新的留存利润计算逻辑
                let actualSharesToSell = adjustedSharesToSell;
                let retainedShares = 0;
                
                // 只在有正收益且留存比例大于0时计算留存份额
                if (profits > 0 && retainedProfitsRatio > 0) {
                  // 计算应该留存的金额
                  const retainedAmount = profits * retainedProfitsRatio;
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
                const actualFee = actualSellAmount * TRANSACTION_FEE_RATE;
                
                // 计算实际留存金额
                const retainedAmount = (adjustedSharesToSell - actualSharesToSell) * tradePrice;
                
                // 调试信息
                console.log(`实际卖出 - 份额: ${actualSharesToSell}, 金额: ${actualSellAmount}, 留存份额: ${retainedShares}, 留存金额: ${retainedAmount}`);
                
                // 更新总手续费
                results.totalFees += actualFee;
                
                // 更新卖出所得现金
                results.totalSellProceeds += (actualSellAmount - actualFee);
                
                // 更新总卖出金额（不扣除手续费）
                results.totalSellAmount += actualSellAmount;
                
                // 更新净投入（买入总额-卖出总额）
                results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
                
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
            } else if (sellStrategy === 'fixed') {
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
                  const sellShares = Math.floor(buyShares * (1 - retainedProfitsRatio) / 100) * 100;
                  
                  if (sellShares > 0 && results.totalShares >= sellShares) {
                    // 使用网格价格计算卖出金额
                    const sellAmount = sellShares * tradePrice;
                    const buyAmount = buyShares * buyRecord.price;
                    
                    // 计算手续费
                    const fee = sellAmount * TRANSACTION_FEE_RATE;
                    // 更新总手续费
                    results.totalFees += fee;
                    
                    // 更新卖出所得现金
                    results.totalSellProceeds += (sellAmount - fee);
                    
                    // 更新总卖出金额（不扣除手续费）
                    results.totalSellAmount += sellAmount;
                    // 更新净投入（买入总额-卖出总额）
                    results.totalInvestment = results.totalBuyAmount - results.totalSellAmount;
                    
                    results.totalShares -= sellShares;
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
                      // 修改: 不再将留存利润份额加入totalShares，因为它们已经包含在剩余份额中
                      
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
      // 修改前: results.totalValue = (results.totalShares + retainedShares) * currentPrice;
      // 修改后: 只使用totalShares，不再单独考虑retainedShares
      results.totalValue = results.totalShares * currentPrice;
      
      // 记录投资曲线和价值曲线
      results.investmentLine.push(results.totalInvestment);
      results.valueLine.push(results.totalValue);
    });
    
    setBacktestResults(results);
    setShowBacktest(true);
  };

  // 显示导出选项对话框
  const showExportModal = () => {
    setExportModalVisible(true);
  };

  // 导出交易记录为CSV文件
  const exportToCSV = () => {
    if (!backtestResults || backtestResults.transactions.length === 0) {
      message.error('没有可导出的交易记录');
      return;
    }

    let csvContent = '';
    const BOM = '\uFEFF';
    
    // 添加基本信息
    csvContent += `${fundName}(${fundCode}) - 网格交易回测结果\n`;
    csvContent += `生成时间,${new Date().toLocaleString()}\n\n`;
    
    // 如果包含摘要信息
    if (exportOptions.includeSummary) {
      // 添加策略参数
      csvContent += `策略参数\n`;
      csvContent += `策略类型,${strategyType === 'symmetric' ? '对称网格' : '单向下跌网格'}\n`;
      csvContent += `网格模式,${gridMode === 'percentage' ? '百分比模式' : '绝对金额模式'}\n`;
      csvContent += `卖出策略,${sellStrategy === 'dynamic' ? '动态比例' : '固定数量'}\n`;
      csvContent += `参考价格,${initialPrice}\n`;
      csvContent += `网格数量,${gridCount}\n`;
      csvContent += `${gridMode === 'percentage' ? '网格宽度(%)' : '网格宽度(绝对值)'},${gridMode === 'percentage' ? gridWidth : absoluteGridWidth}\n`;
      csvContent += `每格投资金额(元),${investmentPerGrid}\n`;
      csvContent += `留存利润比例,${retainedProfitsRatio}\n`;
      if (enableMaxDeclineLimit) {
        csvContent += `最大下跌幅度限制(%),${maxPercentOfDecline}\n`;
      }
      if (enableMediumGrid) {
        csvContent += `中网格倍数,${mediumGridMultiplier}\n`;
      }
      if (enableLargeGrid) {
        csvContent += `大网格倍数,${largeGridMultiplier}\n`;
      }
      csvContent += `\n`;
      
      // 添加回测摘要（使用修正的计算方法）
      csvContent += `回测摘要\n`;
      
      // 计算实际买入投入的总金额
      const buyTransactions = backtestResults.transactions.filter(tx => tx.operation === '买入');
      const totalBuyAmount = buyTransactions.reduce((sum, tx) => sum + tx.amount + (tx.fee || 0), 0);
      
      // 当前总值 = 持仓市值 + 卖出所得现金
      const totalCurrentValue = backtestResults.totalValue + backtestResults.totalSellProceeds;
      
      // 计算实际收益和收益率
      const actualProfit = totalCurrentValue - totalBuyAmount;
      const returnRate = totalBuyAmount > 0 ? (actualProfit / totalBuyAmount) * 100 : 0;
      
      csvContent += `回测周期,${backtestResults.dates.length}天\n`;
      csvContent += `累计投入,${totalBuyAmount.toFixed(2)}元\n`;
      csvContent += `当前持仓市值,${backtestResults.totalValue.toFixed(2)}元\n`;
      csvContent += `卖出所得现金,${backtestResults.totalSellProceeds.toFixed(2)}元\n`;
      csvContent += `当前总值,${totalCurrentValue.toFixed(2)}元\n`;
      csvContent += `持有份额,${backtestResults.totalShares.toFixed(2)}\n`;
      csvContent += `累计收益,${actualProfit.toFixed(2)}元\n`;
      csvContent += `收益率,${returnRate.toFixed(2)}%\n`;
      csvContent += `交易次数,${backtestResults.transactions.length}\n`;
      csvContent += `买入次数,${backtestResults.transactions.filter(t => t.operation === '买入').length}\n`;
      csvContent += `卖出次数,${backtestResults.transactions.filter(t => t.operation === '卖出').length}\n`;
      csvContent += `总手续费,${backtestResults.totalFees.toFixed(2)}元\n`;
      csvContent += `\n`;
    }
    
    // 如果包含交易记录，添加买入日期列
    if (exportOptions.includeTransactions) {
      csvContent += `交易记录\n`;
      
      // CSV表头
      const headers = ['日期', '价格', '操作', '网格类型', '金额(元)', '份额', '买入日期', '网格级别', '手续费(元)'];
      csvContent += headers.join(',') + '\n';
      
      // 转换交易记录为CSV行
      backtestResults.transactions.forEach(tx => {
        const row = [
          tx.date,
          tx.price.toString(),
          tx.operation,
          tx.gridType || '小网格',
          tx.amount.toFixed(2),
          tx.shares.toFixed(2),
          tx.buyDate || '',
          `${tx.gridLevel}%`,
          (tx.fee || 0).toFixed(2)
        ];
        csvContent += row.join(',') + '\n';
      });
    }
    
    // 添加网格触发历史
    if (exportOptions.includeTriggerHistory) {
      csvContent += `\n网格触发历史\n`;
      csvContent += `日期,当日价格,前日价格,网格级别,网格类型,触发价格,是否触发,穿越方向,操作\n`;
      
      backtestResults.triggerHistory.forEach(day => {
        // 如果当天有触发记录，则输出所有网格点的触发情况
        day.triggers.forEach(trigger => {
          const row = [
            day.date,
            day.price.toFixed(4),
            day.prevPrice.toFixed(4),
            `${trigger.gridLevel}%`,
            trigger.gridType,
            trigger.triggerPrice.toFixed(4),
            trigger.triggered ? '是' : '否',
            trigger.direction,
            trigger.operation
          ];
          csvContent += row.join(',') + '\n';
        });
      });
    }
    
    // 添加BOM头以确保Excel正确显示中文
    const csvContentWithBOM = BOM + csvContent;
    
    // 创建Blob对象
    const blob = new Blob([csvContentWithBOM], { type: 'text/csv;charset=utf-8;' });
    
    // 创建URL对象
    const url = URL.createObjectURL(blob);
    
    // 创建临时的a标签用于下载
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fundCode}_${fundName}_网格交易回测_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    
    // 模拟点击下载
    link.click();
    
    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    message.success('回测数据已成功导出');
    setExportModalVisible(false);
  };

  // 表格列定义
  const columns = [
    {
      title: '网格类型',
      dataIndex: 'gridType',
      key: 'gridType',
      render: (text: string) => {
        const colorMap: Record<string, string> = {
          '小网格': '#1890ff',
          '中网格': '#52c41a',
          '大网格': '#fa8c16'
        };
        return <Text style={{ color: colorMap[text] || 'inherit' }}>{text}</Text>;
      }
    },
    {
      title: '网格级别',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (text: number) => `${text > 0 ? '+' : ''}${text}%`,
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
    },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      render: (text: string) => (
        <Text 
          type={text === '买入' ? 'success' : text === '卖出' ? 'danger' : 'secondary'}
        >
          {text}
        </Text>
      ),
    },
    {
      title: '投资金额',
      key: 'investment',
      render: (_: any, record: GridPoint) => {
        if (record.operation === '买入' && record.buyAmount) {
          return `¥${record.buyAmount.toFixed(2)} (${record.buyCount}份)`;
        } else if (record.operation === '卖出' && record.sellAmount) {
          return `¥${record.sellAmount.toFixed(2)} (${record.sellCount}份)`;
        }
        return '-';
      }
    },
    {
      title: '留存利润',
      key: 'retained',
      render: (_: any, record: GridPoint) => {
        if (record.operation === '卖出' && record.retainedProfits && record.retainedProfits > 0) {
          return `¥${record.retainedProfits.toFixed(2)} (${record.retainedCount?.toFixed(2)}份)`;
        }
        return '-';
      }
    }
  ];

  // 回测结果表格列定义
  const transactionColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
    },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      render: (text: string) => (
        <Text 
          type={text === '买入' ? 'success' : text === '卖出' ? 'danger' : 'warning'}
        >
          {text}
        </Text>
      ),
    },
    {
      title: '网格类型',
      dataIndex: 'gridType',
      key: 'gridType',
      render: (text: string) => {
        const colorMap: Record<string, string> = {
          '小网格': '#1890ff',
          '中网格': '#52c41a',
          '大网格': '#fa8c16'
        };
        return <Text style={{ color: colorMap[text] || 'inherit' }}>{text || '小网格'}</Text>;
      }
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '份额',
      dataIndex: 'shares',
      key: 'shares',
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '买入日期',
      dataIndex: 'buyDate',
      key: 'buyDate',
      render: (value: string) => value || '-',
    },
    {
      title: '网格级别',
      dataIndex: 'gridLevel',
      key: 'gridLevel',
      render: (value: number) => `${value}%`,
    },
    {
      title: '手续费',
      dataIndex: 'fee',
      key: 'fee',
      render: (value: number) => value ? `¥${value.toFixed(2)}` : '-',
    },
  ];

  // 回测图表配置
  const getBacktestChartOption = () => {
    if (!backtestResults) return {};

    return {
      title: {
        text: '网格交易回测结果',
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
      },
      legend: {
        data: ['净值', '累计投入', '当前价值'],
        top: 30,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: backtestResults.dates,
        axisLabel: {
          rotate: 45,
          interval: Math.max(Math.floor(backtestResults.dates.length / 15), 0),
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '净值',
          position: 'left',
          axisLine: {
            lineStyle: {
              color: '#5470C6',
            },
          },
        },
        {
          type: 'value',
          name: '金额(元)',
          position: 'right',
          axisLine: {
            lineStyle: {
              color: '#91CC75',
            },
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
        },
      ],
      series: [
        {
          name: '净值',
          type: 'line',
          data: backtestResults.netValues,
          yAxisIndex: 0,
          symbol: 'none',
        },
        {
          name: '累计投入',
          type: 'line',
          data: backtestResults.investmentLine,
          yAxisIndex: 1,
          symbol: 'none',
        },
        {
          name: '当前价值',
          type: 'line',
          data: backtestResults.valueLine,
          yAxisIndex: 1,
          symbol: 'none',
        },
      ],
    };
  };

  // 策略配置面板
  const strategyPanel = (
    <Card title="网格交易策略配置" className="mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">策略类型</label>
            <Select 
              value={strategyType}
              onChange={setStrategyType}
              style={{ width: '100%' }}
            >
              <Option value="symmetric">对称网格(上涨卖出/下跌买入)</Option>
              <Option value="downward">单向下跌网格(只买入)</Option>
            </Select>
            {strategyType === 'symmetric' && (
              <span className="text-xs text-gray-500">
                选择对称或单项下跌网格
              </span>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">网格模式</label>
            <Radio.Group
              value={gridMode}
              onChange={(e) => setGridMode(e.target.value)}
              style={{ width: '100%' }}
            >
              <Radio.Button value="percentage">百分比模式</Radio.Button>
              <Radio.Button value="absolute">绝对金额模式</Radio.Button>
            </Radio.Group>
            <span className="text-xs text-gray-500">
              百分比模式：按价格变动百分比设置网格；绝对金额模式：按价格绝对变动值设置网格
            </span>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">卖出策略</label>
            <Radio.Group
              value={sellStrategy}
              onChange={(e) => setSellStrategy(e.target.value)}
              style={{ width: '100%' }}
            >
              <Radio.Button value="fixed">固定数量</Radio.Button>
              <Radio.Button value="dynamic">动态比例</Radio.Button>
            </Radio.Group>
            <span className="text-xs text-gray-500">
              固定数量：对应买入量按留存比例卖出；动态比例：根据当前持仓比例卖出
            </span>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">参考价格</label>
            <InputNumber
              min={0.0001}
              step={0.0001}
              precision={4}
              value={initialPrice}
              onChange={value => setInitialPrice(value || 0)}
              style={{ width: '100%' }}
            />
            <span className="text-xs text-gray-500">
              默认使用最新净值，可以手动调整
            </span>
          </div>
        </div>
        
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">网格数量</label>
            <InputNumber
              min={1}
              max={50}
              value={gridCount}
              onChange={value => setGridCount(value || 5)}
              style={{ width: '100%' }}
            />
            {strategyType === 'symmetric' && (
              <span className="text-xs text-gray-500">
                实际生成 {gridCount * 2 + 1} 个网格点(包括起始点)
              </span>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {gridMode === 'percentage' ? '小网格宽度(%)' : '小网格宽度(绝对值)'}
            </label>
            {gridMode === 'percentage' ? (
              <InputNumber
                min={0.5}
                max={20}
                step={0.5}
                value={gridWidth}
                onChange={value => setGridWidth(value || 5)}
                style={{ width: '100%' }}
              />
            ) : (
              <InputNumber
                min={0.001}
                max={1}
                step={0.001}
                precision={4}
                value={absoluteGridWidth}
                onChange={value => setAbsoluteGridWidth(value || 0.025)}
                style={{ width: '100%' }}
              />
            )}
            <span className="text-xs text-gray-500">
              {gridMode === 'percentage' 
                ? '相邻网格点之间的百分比间隔' 
                : '相邻网格点之间的绝对价格间隔'}
            </span>
          </div>
        </div>
        
        <div className="md:col-span-2">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">每格投资金额(元)</label>
            <InputNumber
              min={100}
              step={100}
              value={investmentPerGrid}
              onChange={value => setInvestmentPerGrid(value || 1000)}
              style={{ width: '100%' }}
            />
            <span className="text-xs text-gray-500">
              触发买入网格时的投资金额（场内基金必须按100份整数委托）
            </span>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">留存利润比例</label>
            <InputNumber
              min={0}
              max={1}
              step={0.1}
              value={retainedProfitsRatio}
              onChange={value => setRetainedProfitsRatio(value || 0)}
              style={{ width: '100%' }}
            />
            <span className="text-xs text-gray-500">
              卖出时保留的利润比例（0-1之间，0表示不保留，1表示全部保留）
            </span>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium mb-1">限制最大下跌幅度</label>
              <Switch checked={enableMaxDeclineLimit} onChange={setEnableMaxDeclineLimit} />
            </div>
            {enableMaxDeclineLimit && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">最大下跌幅度(%)</label>
                <InputNumber
                  min={10}
                  max={90}
                  step={5}
                  value={maxPercentOfDecline}
                  onChange={value => setMaxPercentOfDecline(value || 60)}
                  style={{ width: '100%' }}
                />
                <span className="text-xs text-gray-500">
                  限制网格策略的最大下跌幅度，在初始价格以下超过此幅度的价格不再设置网格
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* 多重网格设置 */}
        <div>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium mb-1">启用中网格</label>
              <Switch checked={enableMediumGrid} onChange={setEnableMediumGrid} />
            </div>
            {enableMediumGrid && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">中网格倍数</label>
                <InputNumber
                  min={1.5}
                  max={10}
                  step={0.5}
                  value={mediumGridMultiplier}
                  onChange={value => setMediumGridMultiplier(value || 3)}
                  style={{ width: '100%' }}
                />
                <span className="text-xs text-gray-500">
                  中网格宽度 = 小网格宽度 × {mediumGridMultiplier}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium mb-1">启用大网格</label>
              <Switch checked={enableLargeGrid} onChange={setEnableLargeGrid} />
            </div>
            {enableLargeGrid && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">大网格倍数</label>
                <InputNumber
                  min={3}
                  max={20}
                  step={1}
                  value={largeGridMultiplier}
                  onChange={value => setLargeGridMultiplier(value || 5)}
                  style={{ width: '100%' }}
                />
                <span className="text-xs text-gray-500">
                  大网格宽度 = 小网格宽度 × {largeGridMultiplier}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mt-4">
        <Space>
          <Button type="primary" onClick={generateStrategy}>
            生成网格策略
          </Button>
          {gridStrategy && (
            <Button type="default" onClick={runBacktest}>
              运行回测
            </Button>
          )}
        </Space>
      </div>
    </Card>
  );

  // 网格策略结果面板
  const gridResultPanel = gridStrategy ? (
    <Card title="网格策略" className="mb-4">
      <Table
        dataSource={gridStrategy.gridPoints.map((point, index) => ({
          ...point,
          key: index,
        }))}
        columns={columns}
        pagination={false}
        size="small"
        summary={(pageData) => {
          if (pageData.length === 0) return null;
          
          // 计算总买入金额
          const totalBuyAmount = pageData
            .filter(item => item.operation === '买入' && item.buyAmount)
            .reduce((sum, item) => sum + (item.buyAmount || 0), 0);
            
          // 计算网格点数量
          const gridPointsCount = pageData.length;
          
          return (
            <>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <Text strong>总计 ({gridPointsCount}个网格点)</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Text strong>{totalBuyAmount > 0 ? `¥${totalBuyAmount.toFixed(2)}` : '-'}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}></Table.Summary.Cell>
              </Table.Summary.Row>
            </>
          );
        }}
      />
      
      <Alert
        className="mt-4"
        message="网格交易策略说明"
        description={
          <>
            <p>1. 当价格下跌到买入网格时，以设定金额买入</p>
            <p>2. 当价格上涨到卖出网格时，卖出部分份额获利</p>
            <p>3. 适合震荡行情，不适合单边趋势市场</p>
            <p>4. 场内基金交易必须按照100份的整数倍进行委托</p>
            {enableMaxDeclineLimit && (
              <p>5. 已设置最大下跌幅度限制为{maxPercentOfDecline}%，超过此幅度不再设置网格</p>
            )}
          </>
        }
        type="info"
      />
    </Card>
  ) : null;

  // 回测结果面板
  const backtestPanel = showBacktest && backtestResults ? (
    <Card 
      title="回测结果" 
      className="mb-4"
      extra={
        <Button 
          type="primary" 
          icon={<DownloadOutlined />} 
          onClick={showExportModal}
        >
          导出回测数据
        </Button>
      }
    >
      <Tabs
        defaultActiveKey="chart"
        items={[
          {
            key: 'chart',
            label: '回测图表',
            children: (
              <div className="h-96">
                <ReactECharts
                  option={getBacktestChartOption()}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            ),
          },
          {
            key: 'summary',
            label: '回测摘要',
            children: (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card size="small">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>累计投入:</span>
                      <Text strong>
                        ¥{(() => {
                          // 使用新的计算方式：总买入金额 - 总卖出金额
                          return backtestResults.totalBuyAmount.toFixed(2);
                        })()}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>总买入金额:</span>
                      <Text strong>
                        ¥{backtestResults.totalBuyAmount.toFixed(2)}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>总卖出金额:</span>
                      <Text strong>
                        ¥{backtestResults.totalSellAmount.toFixed(2)}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>净投入金额:</span>
                      <Text strong>
                        ¥{(backtestResults.totalBuyAmount - backtestResults.totalSellAmount).toFixed(2)}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>当前持仓市值:</span>
                      <Text strong>
                        ¥{backtestResults.totalValue.toFixed(2)}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>持有份额:</span>
                      <Text strong>{backtestResults.totalShares.toFixed(2)}</Text>
                    </div>
                    <div className="flex justify-between">
                      <span>累计收益:</span>
                      <Text type={(() => {
                        // 修改后: 累计收益 = 持仓市值 - 净投入金额
                        // 计算净投入金额
                        const netInvestment = backtestResults.totalBuyAmount - backtestResults.totalSellAmount;
                        
                        const actualProfit = backtestResults.totalValue - netInvestment;
                        return actualProfit > 0 ? 'success' : 'danger';
                      })()} strong>
                        ¥{(() => {
                          // 修改后: 累计收益 = 持仓市值 - 净投入金额
                          // 计算净投入金额
                          const netInvestment = backtestResults.totalBuyAmount - backtestResults.totalSellAmount;
                          
                          const actualProfit = backtestResults.totalValue - netInvestment;
                          return actualProfit.toFixed(2);
                        })()}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>收益率:</span>
                      <Text type={(() => {
                        // 修改后: 累计收益 = 持仓市值 - 净投入金额
                        // 计算净投入金额
                        const netInvestment = backtestResults.totalBuyAmount - backtestResults.totalSellAmount;
                        
                        const actualProfit = backtestResults.totalValue - netInvestment;
                        return actualProfit > 0 ? 'success' : 'danger';
                      })()} strong>
                        {(() => {
                          // 修改后: 累计收益 = 持仓市值 - 净投入金额
                          // 计算净投入金额
                          const netInvestment = backtestResults.totalBuyAmount - backtestResults.totalSellAmount;
                          
                          const actualProfit = backtestResults.totalValue - netInvestment;
                          return netInvestment > 0 
                            ? ((actualProfit / netInvestment) * 100).toFixed(2) 
                            : 0;
                        })()}%
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>总手续费:</span>
                      <Text type="warning" strong>
                        ¥{backtestResults.totalFees.toFixed(2)}
                      </Text>
                    </div>
                  </div>
                </Card>
                
                <Card size="small">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>交易次数:</span>
                      <Text strong>{backtestResults.transactions.length}</Text>
                    </div>
                    <div className="flex justify-between">
                      <span>买入次数:</span>
                      <Text strong>
                        {backtestResults.transactions.filter((t: Transaction) => t.operation === '买入').length}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>卖出次数:</span>
                      <Text strong>
                        {backtestResults.transactions.filter((t: Transaction) => t.operation === '卖出').length}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>回测周期:</span>
                      <Text strong>
                        {backtestResults.dates.length} 天
                      </Text>
                    </div>
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'transactions',
            label: '交易记录',
            children: (
              <Table
                dataSource={backtestResults.transactions.map((tx: Transaction, index: number) => ({
                  ...tx,
                  key: index,
                }))}
                columns={transactionColumns}
                size="small"
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'triggerHistory',
            label: '网格触发历史',
            children: (
              <Table
                dataSource={
                  // 将触发历史数据展平为表格行
                  backtestResults.triggerHistory.flatMap((day, dayIndex) => 
                    day.triggers
                      .filter(trigger => trigger.triggered) // 只显示被触发的网格
                      .map((trigger, triggerIndex) => ({
                        key: `${dayIndex}-${triggerIndex}`,
                        date: day.date,
                        price: day.price,
                        prevPrice: day.prevPrice,
                        gridLevel: trigger.gridLevel,
                        gridType: trigger.gridType,
                        triggerPrice: trigger.triggerPrice,
                        direction: trigger.direction,
                        operation: trigger.operation
                      }))
                  )
                }
                columns={[
                  {
                    title: '日期',
                    dataIndex: 'date',
                    key: 'date',
                  },
                  {
                    title: '当日价格',
                    dataIndex: 'price',
                    key: 'price',
                    render: (value: number) => value.toFixed(4)
                  },
                  {
                    title: '前日价格',
                    dataIndex: 'prevPrice',
                    key: 'prevPrice',
                    render: (value: number) => value.toFixed(4)
                  },
                  {
                    title: '网格级别',
                    dataIndex: 'gridLevel',
                    key: 'gridLevel',
                    render: (value: number) => `${value}%`
                  },
                  {
                    title: '网格类型',
                    dataIndex: 'gridType',
                    key: 'gridType',
                    render: (text: string) => {
                      const colorMap: Record<string, string> = {
                        '小网格': '#1890ff',
                        '中网格': '#52c41a',
                        '大网格': '#fa8c16'
                      };
                      return <Text style={{ color: colorMap[text] || 'inherit' }}>{text}</Text>;
                    }
                  },
                  {
                    title: '触发价格',
                    dataIndex: 'triggerPrice',
                    key: 'triggerPrice',
                    render: (value: number) => value.toFixed(4)
                  },
                  {
                    title: '穿越方向',
                    dataIndex: 'direction',
                    key: 'direction',
                  },
                  {
                    title: '操作',
                    dataIndex: 'operation',
                    key: 'operation',
                    render: (text: string) => (
                      <Text 
                        type={text === '买入' ? 'success' : text === '卖出' ? 'danger' : 'secondary'}
                      >
                        {text}
                      </Text>
            ),
          },
        ]}
                size="small"
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'fullTriggerHistory',
            label: '完整触发记录',
            children: (
              <Table
                dataSource={
                  // 完整的触发历史，包括每天的所有网格点
                  backtestResults.triggerHistory.flatMap((day, dayIndex) => 
                    day.triggers.map((trigger, triggerIndex) => ({
                      key: `${dayIndex}-${triggerIndex}`,
                      date: day.date,
                      price: day.price,
                      prevPrice: day.prevPrice,
                      gridLevel: trigger.gridLevel,
                      gridType: trigger.gridType,
                      triggerPrice: trigger.triggerPrice,
                      triggered: trigger.triggered,
                      direction: trigger.direction,
                      operation: trigger.operation
                    }))
                  )
                }
                columns={[
                  {
                    title: '日期',
                    dataIndex: 'date',
                    key: 'date',
                  },
                  {
                    title: '当日价格',
                    dataIndex: 'price',
                    key: 'price',
                    render: (value: number) => value.toFixed(4)
                  },
                  {
                    title: '前日价格',
                    dataIndex: 'prevPrice',
                    key: 'prevPrice',
                    render: (value: number) => value.toFixed(4)
                  },
                  {
                    title: '网格级别',
                    dataIndex: 'gridLevel',
                    key: 'gridLevel',
                    render: (value: number) => `${value}%`
                  },
                  {
                    title: '网格类型',
                    dataIndex: 'gridType',
                    key: 'gridType',
                    render: (text: string) => {
                      const colorMap: Record<string, string> = {
                        '小网格': '#1890ff',
                        '中网格': '#52c41a',
                        '大网格': '#fa8c16'
                      };
                      return <Text style={{ color: colorMap[text] || 'inherit' }}>{text}</Text>;
                    }
                  },
                  {
                    title: '触发价格',
                    dataIndex: 'triggerPrice',
                    key: 'triggerPrice',
                    render: (value: number) => value.toFixed(4)
                  },
                  {
                    title: '是否触发',
                    dataIndex: 'triggered',
                    key: 'triggered',
                    render: (value: boolean) => value ? <Text type="success">是</Text> : <Text type="secondary">否</Text>
                  },
                  {
                    title: '穿越方向',
                    dataIndex: 'direction',
                    key: 'direction',
                  },
                  {
                    title: '操作',
                    dataIndex: 'operation',
                    key: 'operation',
                    render: (text: string) => (
                      <Text 
                        type={text === '买入' ? 'success' : text === '卖出' ? 'danger' : 'secondary'}
                      >
                        {text}
                      </Text>
                    ),
                  },
                ]}
                size="small"
                pagination={{ pageSize: 20 }}
              />
            ),
          }
        ]}
      />
      
      {/* 导出选项对话框 */}
      <Modal
        title="导出回测数据"
        open={exportModalVisible}
        onOk={exportToCSV}
        onCancel={() => setExportModalVisible(false)}
        okText="导出"
        cancelText="取消"
      >
        <p>请选择要导出的内容：</p>
        <div style={{ marginBottom: 16 }}>
          <Checkbox
            checked={exportOptions.includeSummary}
            onChange={e => setExportOptions({ ...exportOptions, includeSummary: e.target.checked })}
          >
            包含策略参数和回测摘要
          </Checkbox>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Checkbox
            checked={exportOptions.includeTransactions}
            onChange={e => setExportOptions({ ...exportOptions, includeTransactions: e.target.checked })}
          >
            包含交易记录
          </Checkbox>
        </div>
        <div>
          <Checkbox
            checked={exportOptions.includeTriggerHistory}
            onChange={e => setExportOptions({ ...exportOptions, includeTriggerHistory: e.target.checked })}
          >
            包含网格触发历史
          </Checkbox>
        </div>
      </Modal>
    </Card>
  ) : null;

  return (
    <div className="space-y-4">
      <Title level={4}>{fundName} ({fundCode}) - ETF网格交易策略</Title>
      
      {strategyPanel}
      {gridResultPanel}
      {backtestPanel}
    </div>
  );
};

export default ETFGridOperation; 