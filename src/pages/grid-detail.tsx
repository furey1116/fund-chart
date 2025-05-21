import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tabs, Typography, Tag, Spin, message, Descriptions, Divider } from 'antd';
import { RollbackOutlined, DeleteOutlined, LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface GridStrategy {
  id: string;
  userId: string;
  fundCode: string;
  fundName: string;
  strategyType: string;
  gridMode: string;
  initialPrice: number;
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
  createdAt: string;
  backtests: BacktestRecord[];
}

interface BacktestRecord {
  id: string;
  strategyId: string;
  startDate: string;
  endDate: string;
  totalInvestment: number;
  totalValue: number;
  profitAmount: number;
  profitPercentage: number;
  transactionCount: number;
  useIntraDayData: boolean;
  createdAt: string;
  buyCount: number;
  sellCount: number;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  backtestId: string;
  date: string;
  price: number;
  operation: string;
  amount: number;
  shares: number;
  gridLevel: number;
  gridType: string;
  fee: number;
  buyDate?: string;
}

const GridDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [strategy, setStrategy] = useState<GridStrategy | null>(null);
  const [selectedBacktest, setSelectedBacktest] = useState<BacktestRecord | null>(null);
  
  // 加载策略数据
  const loadStrategy = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/grid/history?strategyId=${id}`);
      if (!response.ok) {
        throw new Error('获取策略数据失败');
      }
      
      const result = await response.json();
      if (result.data && result.data.length > 0) {
        setStrategy(result.data[0]);
        // 默认选择最新的回测
        if (result.data[0].backtests && result.data[0].backtests.length > 0) {
          await loadBacktestDetail(result.data[0].backtests[0].id);
        }
      } else {
        message.error('未找到策略数据');
      }
    } catch (error: any) {
      message.error(`加载策略数据失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 加载回测详情
  const loadBacktestDetail = async (backtestId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/grid/backtest/${backtestId}`);
      if (!response.ok) {
        throw new Error('获取回测详情失败');
      }
      
      const result = await response.json();
      setSelectedBacktest(result.data);
    } catch (error: any) {
      message.error(`加载回测详情失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载策略数据
  useEffect(() => {
    if (id) {
      loadStrategy();
    }
  }, [id]);
  
  // 删除策略
  const handleDeleteStrategy = async () => {
    if (!strategy) return;
    
    if (!confirm('确定要删除此策略吗？此操作不可撤销！')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/cleanup?strategyId=${strategy.id}&cleanupType=strategies`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('删除策略失败');
      }
      
      message.success('策略删除成功');
      router.push('/grid-history');
    } catch (error: any) {
      message.error(`删除策略失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 删除回测
  const handleDeleteBacktest = async (backtestId: string) => {
    if (!confirm('确定要删除此回测结果吗？此操作不可撤销！')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/cleanup?backtestId=${backtestId}&cleanupType=backtests`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('删除回测失败');
      }
      
      message.success('回测删除成功');
      loadStrategy();
    } catch (error: any) {
      message.error(`删除回测失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 交易记录表格列
  const transactionColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD')
    },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      render: (text: string) => (
        <Tag color={text === '买入' ? 'green' : text === '卖出' ? 'red' : 'blue'}>
          {text}
        </Tag>
      )
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (value: number) => value.toFixed(4)
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number) => `¥${value.toFixed(2)}`
    },
    {
      title: '份额',
      dataIndex: 'shares',
      key: 'shares',
      render: (value: number) => value.toFixed(2)
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
      render: (text: string) => (
        <Tag color={
          text === '小网格' ? 'blue' : 
          text === '中网格' ? 'green' : 
          text === '大网格' ? 'orange' : 'default'
        }>
          {text}
        </Tag>
      )
    },
    {
      title: '手续费',
      dataIndex: 'fee',
      key: 'fee',
      render: (value: number) => `¥${value.toFixed(2)}`
    },
    {
      title: '买入日期',
      dataIndex: 'buyDate',
      key: 'buyDate',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-'
    },
  ];
  
  // 回测结果图表
  const getBacktestChartOption = () => {
    if (!selectedBacktest) return {};
    
    // 从交易记录中提取数据
    const transactions = selectedBacktest.transactions || [];
    const dates = Array.from(new Set(transactions.map(tx => dayjs(tx.date).format('YYYY-MM-DD')))).sort();
    
    // 按日期聚合交易记录
    const dailyTransactions = dates.map(date => {
      const dayTx = transactions.filter(tx => dayjs(tx.date).format('YYYY-MM-DD') === date);
      const buys = dayTx.filter(tx => tx.operation === '买入');
      const sells = dayTx.filter(tx => tx.operation === '卖出');
      
      return {
        date,
        buyAmount: buys.reduce((sum, tx) => sum + tx.amount, 0),
        sellAmount: sells.reduce((sum, tx) => sum + tx.amount, 0),
        buyShares: buys.reduce((sum, tx) => sum + tx.shares, 0),
        sellShares: sells.reduce((sum, tx) => sum + tx.shares, 0),
        txCount: dayTx.length
      };
    });
    
    return {
      title: {
        text: '交易分布',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: {
        data: ['买入金额', '卖出金额', '交易次数'],
        top: 30
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: 45,
          interval: Math.max(Math.floor(dates.length / 15), 0)
        }
      },
      yAxis: [
        {
          type: 'value',
          name: '金额',
          axisLabel: {
            formatter: '{value} 元'
          }
        },
        {
          type: 'value',
          name: '次数',
          axisLabel: {
            formatter: '{value}'
          }
        }
      ],
      series: [
        {
          name: '买入金额',
          type: 'bar',
          stack: 'amount',
          data: dailyTransactions.map(d => d.buyAmount)
        },
        {
          name: '卖出金额',
          type: 'bar',
          stack: 'amount',
          data: dailyTransactions.map(d => d.sellAmount)
        },
        {
          name: '交易次数',
          type: 'line',
          yAxisIndex: 1,
          data: dailyTransactions.map(d => d.txCount)
        }
      ]
    };
  };
  
  // 收益变化图表
  const getProfitChartOption = () => {
    if (!selectedBacktest) return {};
    
    // 按日期累计收益
    const transactions = selectedBacktest.transactions || [];
    const allDates = Array.from(new Set(transactions.map(tx => dayjs(tx.date).format('YYYY-MM-DD')))).sort();
    
    let investment = 0;
    let shares = 0;
    const profitData = allDates.map(date => {
      const dayTx = transactions.filter(tx => dayjs(tx.date).format('YYYY-MM-DD') === date);
      
      // 计算当天投资和份额变化
      dayTx.forEach(tx => {
        if (tx.operation === '买入') {
          investment += tx.amount;
          shares += tx.shares;
        } else if (tx.operation === '卖出') {
          shares -= tx.shares;
        }
      });
      
      // 使用最后一笔交易的价格作为当天收盘价
      const price = dayTx.length > 0 ? dayTx[dayTx.length - 1].price : 0;
      const value = shares * price;
      const profit = value - investment;
      const profitRate = investment > 0 ? (profit / investment) * 100 : 0;
      
      return {
        date,
        investment,
        value,
        profit,
        profitRate
      };
    });
    
    return {
      title: {
        text: '收益变化',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['投资金额', '持仓价值', '收益率'],
        top: 30
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          rotate: 45,
          interval: Math.max(Math.floor(allDates.length / 15), 0)
        }
      },
      yAxis: [
        {
          type: 'value',
          name: '金额',
          axisLabel: {
            formatter: '{value} 元'
          }
        },
        {
          type: 'value',
          name: '收益率',
          axisLabel: {
            formatter: '{value} %'
          }
        }
      ],
      series: [
        {
          name: '投资金额',
          type: 'line',
          data: profitData.map(d => d.investment)
        },
        {
          name: '持仓价值',
          type: 'line',
          data: profitData.map(d => d.value)
        },
        {
          name: '收益率',
          type: 'line',
          yAxisIndex: 1,
          data: profitData.map(d => d.profitRate)
        }
      ]
    };
  };
  
  if (!strategy) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Spin spinning={loading}>
          <Card>
            <div className="text-center py-12">
              {loading ? '正在加载策略数据...' : '没有找到策略数据'}
            </div>
          </Card>
        </Spin>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>{strategy.fundName} ({strategy.fundCode}) - 网格策略详情</Title>
        
        <Space>
          <Button 
            icon={<RollbackOutlined />} 
            onClick={() => router.push('/grid-history')}
          >
            返回列表
          </Button>
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            onClick={handleDeleteStrategy}
          >
            删除策略
          </Button>
        </Space>
      </div>
      
      <Spin spinning={loading}>
        {/* 策略基本信息 */}
        <Card title="策略基本信息" className="mb-6">
          <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
            <Descriptions.Item label="策略类型">
              {strategy.strategyType === 'symmetric' ? '对称网格' : '单向下跌网格'}
            </Descriptions.Item>
            <Descriptions.Item label="网格模式">
              {strategy.gridMode === 'percentage' ? '百分比模式' : '绝对金额模式'}
            </Descriptions.Item>
            <Descriptions.Item label="初始价格">
              {strategy.initialPrice.toFixed(4)}
            </Descriptions.Item>
            <Descriptions.Item label="网格数量">
              {strategy.gridCount}
            </Descriptions.Item>
            <Descriptions.Item label="网格宽度">
              {strategy.gridMode === 'percentage' 
                ? `${strategy.gridWidth}%` 
                : strategy.absoluteGridWidth?.toFixed(4) || '-'
              }
            </Descriptions.Item>
            <Descriptions.Item label="每格投资金额">
              ¥{strategy.investmentPerGrid.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="留存利润比例">
              {(strategy.retainedProfitsRatio * 100).toFixed(0)}%
            </Descriptions.Item>
            <Descriptions.Item label="最大下跌限制">
              {strategy.enableMaxDeclineLimit ? `${strategy.maxPercentOfDecline}%` : '无限制'}
            </Descriptions.Item>
            <Descriptions.Item label="中网格">
              {strategy.enableMediumGrid 
                ? `启用 (倍数: ${strategy.mediumGridMultiplier})` 
                : '未启用'
              }
            </Descriptions.Item>
            <Descriptions.Item label="大网格">
              {strategy.enableLargeGrid 
                ? `启用 (倍数: ${strategy.largeGridMultiplier})` 
                : '未启用'
              }
            </Descriptions.Item>
            <Descriptions.Item label="日内回测">
              {strategy.enableIntraDayBacktest ? '启用' : '未启用'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(strategy.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        
        {/* 回测结果列表 */}
        <Card title="回测结果列表" className="mb-6">
          {strategy.backtests && strategy.backtests.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">回测日期</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">回测模式</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总投资</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最终价值</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">收益金额</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">收益率</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">交易次数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {strategy.backtests.map(backtest => (
                    <tr 
                      key={backtest.id} 
                      className={`${selectedBacktest?.id === backtest.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {dayjs(backtest.startDate).format('YYYY-MM-DD')} ~ {dayjs(backtest.endDate).format('YYYY-MM-DD')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Tag color={backtest.useIntraDayData ? 'green' : 'blue'}>
                          {backtest.useIntraDayData ? '日内高低点' : '日线净值'}
                        </Tag>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ¥{backtest.totalInvestment.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ¥{backtest.totalValue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Text type={backtest.profitAmount >= 0 ? 'success' : 'danger'}>
                          ¥{backtest.profitAmount.toFixed(2)}
                        </Text>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Text type={backtest.profitPercentage >= 0 ? 'success' : 'danger'}>
                          {backtest.profitPercentage.toFixed(2)}%
                        </Text>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {backtest.transactionCount} (买:{backtest.buyCount}/卖:{backtest.sellCount})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Space>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => loadBacktestDetail(backtest.id)}
                            icon={<LineChartOutlined />}
                          >
                            查看
                          </Button>
                          <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleDeleteBacktest(backtest.id)}
                            icon={<DeleteOutlined />}
                          >
                            删除
                          </Button>
                        </Space>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Text type="secondary">暂无回测记录</Text>
            </div>
          )}
        </Card>
        
        {/* 回测详情 */}
        {selectedBacktest && (
          <Card title="回测详情" className="mb-6">
            <Tabs defaultActiveKey="summary">
              <TabPane tab="回测摘要" key="summary">
                <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
                  <Descriptions.Item label="回测时间段">
                    {dayjs(selectedBacktest.startDate).format('YYYY-MM-DD')} ~ {dayjs(selectedBacktest.endDate).format('YYYY-MM-DD')}
                  </Descriptions.Item>
                  <Descriptions.Item label="回测模式">
                    {selectedBacktest.useIntraDayData ? '日内高低点' : '日线净值'}
                  </Descriptions.Item>
                  <Descriptions.Item label="总投资">
                    ¥{selectedBacktest.totalInvestment.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="最终价值">
                    ¥{selectedBacktest.totalValue.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="收益金额">
                    <Text type={selectedBacktest.profitAmount >= 0 ? 'success' : 'danger'}>
                      ¥{selectedBacktest.profitAmount.toFixed(2)}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="收益率">
                    <Text type={selectedBacktest.profitPercentage >= 0 ? 'success' : 'danger'}>
                      {selectedBacktest.profitPercentage.toFixed(2)}%
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="交易次数">
                    {selectedBacktest.transactionCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="买入次数">
                    {selectedBacktest.buyCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="卖出次数">
                    {selectedBacktest.sellCount}
                  </Descriptions.Item>
                </Descriptions>
                
                <Divider />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Title level={4}>交易分布</Title>
                    <div className="h-80">
                      <ReactECharts
                        option={getBacktestChartOption()}
                        style={{ height: '100%', width: '100%' }}
                      />
                    </div>
                  </div>
                  <div>
                    <Title level={4}>收益变化</Title>
                    <div className="h-80">
                      <ReactECharts
                        option={getProfitChartOption()}
                        style={{ height: '100%', width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </TabPane>
              
              <TabPane tab="交易记录" key="transactions">
                {selectedBacktest.transactions && selectedBacktest.transactions.length > 0 ? (
                  <Table
                    rowKey="id"
                    columns={transactionColumns}
                    dataSource={selectedBacktest.transactions}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: true }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <Text type="secondary">暂无交易记录</Text>
                  </div>
                )}
              </TabPane>
            </Tabs>
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default GridDetailPage; 