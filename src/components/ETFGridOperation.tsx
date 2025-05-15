import React, { useState, useEffect } from 'react';
import { Card, Table, InputNumber, Button, Space, Alert, Tabs, Typography, Switch, Select } from 'antd';
import type { TabsProps } from 'antd';
import ReactECharts from 'echarts-for-react';
import { FundHistoryNetValue } from '@/api/fund';

const { Title, Text } = Typography;
const { Option } = Select;

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
  const [maxPercentOfDecline, setMaxPercentOfDecline] = useState<number>(60);
  const [enableMaxDeclineLimit, setEnableMaxDeclineLimit] = useState<boolean>(false);

  // 当净值数据变化时，自动设置初始价格
  useEffect(() => {
    if (netValueData && netValueData.length > 0) {
      // 默认使用最近的净值作为初始价格
      const latestNetValue = parseFloat(netValueData[0].DWJZ);
      setInitialPrice(Number(latestNetValue.toFixed(4)));
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
        const percentage = i * gridWidth;
        
        // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
        if (percentage < minGearPercentage) continue;
        
        const price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
        const operation = percentage < 0 ? '买入' : percentage > 0 ? '卖出' : '起始点';
        
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
        } else if (operation === '卖出' && i > 0) {
          // 卖出情况，计算留存利润
          const buyPrice = initialPrice * (1 - percentage / 100); // 对应买入价格
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
          // 跳过0点，因为起始点已经在小网格中添加
          if (i === 0) continue;
          
          const percentage = i * gridWidth * mediumGridMultiplier;
          
          // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
          if (percentage < minGearPercentage) continue;
          
          const price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
          const operation = percentage < 0 ? '买入' : '卖出';
          
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
          } else if (operation === '卖出') {
            const buyPrice = initialPrice * (1 - percentage / 100);
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
          }
          
          gridPoints.push(point);
        }
      }
      
      // 大网格
      if (enableLargeGrid) {
        for (let i = -gridCount; i <= gridCount; i++) {
          // 跳过0点，因为起始点已经在小网格中添加
          if (i === 0) continue;
          
          const percentage = i * gridWidth * largeGridMultiplier;
          
          // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
          if (percentage < minGearPercentage) continue;
          
          const price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
          const operation = percentage < 0 ? '买入' : '卖出';
          
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
          } else if (operation === '卖出') {
            const buyPrice = initialPrice * (1 - percentage / 100);
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
          }
          
          gridPoints.push(point);
        }
      }
    } else {
      // 单向下跌网格策略
      // 小网格
      for (let i = 0; i <= gridCount; i++) {
        const percentage = -i * gridWidth;
        
        // 如果启用了最大下跌幅度限制，并且下跌幅度超过限制，则跳过
        if (percentage < minGearPercentage) continue;
        
        const price = Number((initialPrice * (1 + percentage / 100)).toFixed(4));
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
      totalInvestment: 0,
      totalValue: 0,
      totalShares: 0,
      transactions: [],
      dates: [],
      netValues: [],
      investmentLine: [],
      valueLine: [],
    };

    // 用于跟踪留存份额
    let retainedShares = 0;

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
      
      // 检查是否触发任何网格点位
      gridStrategy.gridPoints.forEach(point => {
        // 如果价格从上方穿过网格点，且不是起始点，则进行操作
        if (point.operation !== '起始点' && 
            ((prevPrice > point.price && currentPrice <= point.price) || 
             (prevPrice < point.price && currentPrice >= point.price))) {
          
          // 根据网格类型决定投资金额倍数
          const multiplier = point.gridType === '中网格' ? mediumGridMultiplier 
                           : point.gridType === '大网格' ? largeGridMultiplier
                           : 1;
          
          if (point.operation === '买入') {
            // 买入操作
            const actualInvestment = gridStrategy.investmentPerGrid * multiplier;
            // 必须按100份整数买入
            const shares = Math.floor(actualInvestment / currentPrice / 100) * 100;
            // 调整实际投资金额
            const adjustedInvestment = shares * currentPrice;
            
            results.totalInvestment += adjustedInvestment;
            results.totalShares += shares;
            
            results.transactions.push({
              date: currentDate,
              price: currentPrice,
              operation: '买入',
              amount: adjustedInvestment,
              shares,
              gridLevel: point.percentage,
              gridType: point.gridType
            });
          } else if (point.operation === '卖出' && results.totalShares > 0) {
            // 卖出操作 - 卖出当前持有份额的一部分
            const sharesToSell = results.totalShares / (gridCount + 1) * multiplier;
            // 必须按100份整数卖出
            const adjustedSharesToSell = Math.floor(sharesToSell / 100) * 100;
            const sellAmount = adjustedSharesToSell * currentPrice;
            const profits = sellAmount - (adjustedSharesToSell * results.totalInvestment / results.totalShares);
            
            // 留存部分利润对应的份额
            const retainedProfit = profits * retainedProfitsRatio;
            // 计算实际卖出份额（考虑留存利润）
            const actualSharesToSell = Math.floor((adjustedSharesToSell - retainedProfit / currentPrice) / 100) * 100;
            const actualSellAmount = actualSharesToSell * currentPrice;
            
            if (actualSharesToSell > 0) {
              results.totalShares -= actualSharesToSell;
              results.totalInvestment -= (actualSharesToSell * results.totalInvestment / (results.totalShares + actualSharesToSell));
              
              results.transactions.push({
                date: currentDate,
                price: currentPrice,
                operation: '卖出',
                amount: actualSellAmount,
                shares: actualSharesToSell,
                gridLevel: point.percentage,
                gridType: point.gridType
              });
              
              // 记录留存利润
              const actualRetainedProfit = sellAmount - actualSellAmount;
              if (actualRetainedProfit > 0) {
                const actualRetainedShares = Math.floor(actualRetainedProfit / currentPrice / 100) * 100;
                retainedShares += actualRetainedShares;
                
                results.transactions.push({
                  date: currentDate,
                  price: currentPrice,
                  operation: '留存利润',
                  amount: actualRetainedProfit,
                  shares: actualRetainedShares,
                  gridLevel: point.percentage,
                  gridType: point.gridType
                });
              }
            }
          }
        }
      });
      
      // 更新当前总价值（包括留存份额）
      results.totalValue = (results.totalShares + retainedShares) * currentPrice;
      
      // 记录投资曲线和价值曲线
      results.investmentLine.push(results.totalInvestment);
      results.valueLine.push(results.totalValue);
    });
    
    setBacktestResults(results);
    setShowBacktest(true);
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
      title: '网格级别',
      dataIndex: 'gridLevel',
      key: 'gridLevel',
      render: (value: number) => `${value}%`,
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
              max={20}
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
            <label className="block text-sm font-medium mb-1">小网格宽度(%)</label>
            <InputNumber
              min={0.5}
              max={20}
              step={0.5}
              value={gridWidth}
              onChange={value => setGridWidth(value || 5)}
              style={{ width: '100%' }}
            />
            <span className="text-xs text-gray-500">
              相邻网格点之间的百分比间隔
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
    <Card title="回测结果" className="mb-4">
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
                      <Text strong>¥{backtestResults.totalInvestment.toFixed(2)}</Text>
                    </div>
                    <div className="flex justify-between">
                      <span>当前总值:</span>
                      <Text type={backtestResults.totalValue > backtestResults.totalInvestment ? 'success' : 'danger'} strong>
                        ¥{backtestResults.totalValue.toFixed(2)}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>持有份额:</span>
                      <Text strong>{backtestResults.totalShares.toFixed(2)}</Text>
                    </div>
                    <div className="flex justify-between">
                      <span>累计收益:</span>
                      <Text type={backtestResults.totalValue - backtestResults.totalInvestment > 0 ? 'success' : 'danger'} strong>
                        ¥{(backtestResults.totalValue - backtestResults.totalInvestment).toFixed(2)}
                      </Text>
                    </div>
                    <div className="flex justify-between">
                      <span>收益率:</span>
                      <Text type={backtestResults.totalValue - backtestResults.totalInvestment > 0 ? 'success' : 'danger'} strong>
                        {backtestResults.totalInvestment > 0 
                          ? ((backtestResults.totalValue - backtestResults.totalInvestment) / backtestResults.totalInvestment * 100).toFixed(2) 
                          : 0}%
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
        ]}
      />
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