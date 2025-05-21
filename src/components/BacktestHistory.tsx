import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Modal, DatePicker, message, Spin, Tabs, Select, Tag } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { TabsProps } from 'antd';
import dayjs from 'dayjs';
import Link from 'next/link';

const { confirm } = Modal;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface BacktestHistoryProps {
  userId: string;
}

const BacktestHistory: React.FC<BacktestHistoryProps> = ({ userId }) => {
  const [backtestResults, setBacktestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [cleanupModal, setCleanupModal] = useState<boolean>(false);
  const [cleanupType, setCleanupType] = useState<string>('backtest');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [selectedBacktestIds, setSelectedBacktestIds] = useState<string[]>([]);
  const [selectedFundCodes, setSelectedFundCodes] = useState<string[]>([]);
  
  // 获取基金代码列表
  const [fundCodeOptions, setFundCodeOptions] = useState<{ label: string, value: string }[]>([]);
  
  // 在组件加载时获取历史回测数据
  useEffect(() => {
    fetchBacktestHistory();
  }, [userId]);
  
  // 获取历史回测数据
  const fetchBacktestHistory = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/grid/backtest/history?userId=${userId}`);
      if (!response.ok) {
        throw new Error('获取历史回测数据失败');
      }
      
      const result = await response.json();
      setBacktestResults(result.data);
      
      // 提取所有不重复的基金代码
      const fundCodes = Array.from(new Set(result.data.map((item: any) => 
        item.strategy?.fundCode
      ))).filter(Boolean) as string[];
      
      setFundCodeOptions(fundCodes.map((code) => {
        const backtest = result.data.find((item: any) => item.strategy?.fundCode === code);
        return {
          label: `${code} (${backtest?.strategy?.fundName || '未知'})`,
          value: code
        };
      }));
      
    } catch (error: any) {
      message.error(`获取历史回测数据失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 打开数据清理对话框
  const showCleanupConfirm = () => {
    setCleanupModal(true);
  };
  
  // 执行数据清理
  const handleCleanupData = async () => {
    if (!userId) return;
    
    // 构建清理请求
    const cleanupData: any = {
      userId,
      cleanupType
    };
    
    // 如果选择了日期范围，添加日期条件
    if (dateRange[0]) {
      cleanupData.beforeDate = dateRange[0].format('YYYY-MM-DD');
    }
    
    // 如果选择了特定的回测ID
    if (selectedBacktestIds.length > 0) {
      cleanupData.backtestIds = selectedBacktestIds;
    }
    
    // 如果选择了特定的基金代码
    if (selectedFundCodes.length > 0) {
      cleanupData.fundCodes = selectedFundCodes;
    }
    
    try {
      const response = await fetch('/api/data/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanupData)
      });
      
      if (!response.ok) {
        throw new Error('数据清理失败');
      }
      
      const result = await response.json();
      
      // 显示清理结果
      let resultMessage = '数据清理结果：';
      if (result.results.deletedTransactions) {
        resultMessage += `\n删除交易记录: ${result.results.deletedTransactions}条`;
      }
      if (result.results.deletedBacktests) {
        resultMessage += `\n删除回测记录: ${result.results.deletedBacktests}条`;
      }
      if (result.results.deletedStrategies) {
        resultMessage += `\n删除策略: ${result.results.deletedStrategies}条`;
      }
      if (result.results.deletedKLineData) {
        resultMessage += `\nK线数据: ${result.results.deletedKLineData}条`;
      }
      if (result.results.klineDataWarning) {
        resultMessage += `\n警告: ${result.results.klineDataWarning}`;
      }
      
      Modal.success({
        title: '数据清理成功',
        content: resultMessage,
      });
      
      // 重新获取数据以更新列表
      fetchBacktestHistory();
      
    } catch (error: any) {
      message.error(`数据清理失败: ${error.message}`);
    } finally {
      setCleanupModal(false);
    }
  };
  
  // 删除单个回测记录
  const handleDeleteBacktest = (backtestId: string) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除此回测记录吗？操作不可恢复。',
      onOk: async () => {
        try {
          const response = await fetch('/api/data/cleanup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              cleanupType: 'backtest',
              backtestIds: [backtestId]
            })
          });
          
          if (!response.ok) {
            throw new Error('删除回测记录失败');
          }
          
          message.success('删除回测记录成功');
          // 重新获取数据以更新列表
          fetchBacktestHistory();
          
        } catch (error: any) {
          message.error(`删除回测记录失败: ${error.message}`);
        }
      }
    });
  };
  
  // 表格列定义
  const columns = [
    {
      title: '基金',
      dataIndex: ['strategy', 'fundName'],
      key: 'fundName',
      render: (text: string, record: any) => (
        <span>
          {record.strategy?.fundName || '未知'} 
          <br />
          <small>({record.strategy?.fundCode})</small>
        </span>
      )
    },
    {
      title: '策略类型',
      key: 'strategyType',
      render: (text: string, record: any) => (
        <Tag color={record.strategy?.strategyType === 'symmetric' ? 'blue' : 'orange'}>
          {record.strategy?.strategyType === 'symmetric' ? '对称网格' : '单向下跌网格'}
        </Tag>
      )
    },
    {
      title: '回测区间',
      key: 'dateRange',
      render: (text: string, record: any) => (
        <span>
          {new Date(record.startDate).toLocaleDateString()} 
          至 
          {new Date(record.endDate).toLocaleDateString()}
        </span>
      )
    },
    {
      title: '交易次数',
      dataIndex: 'transactionCount',
      key: 'transactionCount',
      sorter: (a: any, b: any) => a.transactionCount - b.transactionCount
    },
    {
      title: '投入金额',
      dataIndex: 'totalInvestment',
      key: 'totalInvestment',
      render: (value: number) => `¥${value.toFixed(2)}`,
      sorter: (a: any, b: any) => a.totalInvestment - b.totalInvestment
    },
    {
      title: '最终价值',
      dataIndex: 'totalValue',
      key: 'totalValue',
      render: (value: number) => `¥${value.toFixed(2)}`,
      sorter: (a: any, b: any) => a.totalValue - b.totalValue
    },
    {
      title: '收益率',
      key: 'profitPercentage',
      render: (text: string, record: any) => {
        const profitPercentage = record.profitPercentage || 
          ((record.totalValue - record.totalInvestment) / record.totalInvestment * 100);
        const isPositive = profitPercentage > 0;
        
        return (
          <span style={{ color: isPositive ? 'green' : 'red' }}>
            {isPositive ? '+' : ''}{profitPercentage.toFixed(2)}%
          </span>
        );
      },
      sorter: (a: any, b: any) => {
        const profitA = a.profitPercentage || ((a.totalValue - a.totalInvestment) / a.totalInvestment * 100);
        const profitB = b.profitPercentage || ((b.totalValue - b.totalInvestment) / b.totalInvestment * 100);
        return profitA - profitB;
      }
    },
    {
      title: '日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString(),
      sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: any) => (
        <Space size="small">
          <Link href={`/backtest/${record.id}`}>查看</Link>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDeleteBacktest(record.id)}
          />
        </Space>
      )
    }
  ];
  
  const tabs: TabsProps['items'] = [
    {
      key: 'backtestResults',
      label: '回测记录',
      children: (
        <Table 
          dataSource={backtestResults.map(item => ({ ...item, key: item.id }))}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      )
    }
  ];
  
  return (
    <div className="space-y-4">
      <Card 
        title="历史回测记录" 
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchBacktestHistory}
              loading={loading}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              danger
              onClick={showCleanupConfirm}
            >
              数据清理
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div className="flex justify-center items-center p-10">
            <Spin size="large" />
          </div>
        ) : (
          <Tabs items={tabs} />
        )}
      </Card>
      
      {/* 数据清理对话框 */}
      <Modal
        title="数据清理"
        open={cleanupModal}
        onCancel={() => setCleanupModal(false)}
        onOk={handleCleanupData}
        okText="确认清理"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 font-medium">清理类型</p>
            <Select
              value={cleanupType}
              onChange={setCleanupType}
              style={{ width: '100%' }}
            >
              <Option value="backtest">回测记录（包含交易记录）</Option>
              <Option value="strategy">未使用的策略</Option>
              <Option value="kline">K线数据</Option>
              <Option value="all">全部数据</Option>
            </Select>
          </div>
          
          <div>
            <p className="mb-2 font-medium">清理时间范围（指定日期之前的数据）</p>
            <DatePicker
              value={dateRange[0]}
              onChange={(date) => setDateRange([date, null])}
              style={{ width: '100%' }}
            />
          </div>
          
          {(cleanupType === 'backtest' || cleanupType === 'all') && (
            <div>
              <p className="mb-2 font-medium">指定回测记录（可多选）</p>
              <Select
                mode="multiple"
                placeholder="选择要清理的回测记录"
                value={selectedBacktestIds}
                onChange={setSelectedBacktestIds}
                style={{ width: '100%' }}
                optionFilterProp="children"
              >
                {backtestResults.map(item => (
                  <Option key={item.id} value={item.id}>
                    {item.strategy?.fundName || '未知'} ({new Date(item.createdAt).toLocaleString()})
                  </Option>
                ))}
              </Select>
            </div>
          )}
          
          {(cleanupType === 'kline' || cleanupType === 'all') && (
            <div>
              <p className="mb-2 font-medium">指定基金代码（可多选）</p>
              <Select
                mode="multiple"
                placeholder="选择要清理的基金K线数据"
                value={selectedFundCodes}
                onChange={setSelectedFundCodes}
                style={{ width: '100%' }}
                options={fundCodeOptions}
              />
            </div>
          )}
          
          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
            <p className="text-yellow-800">
              <ExclamationCircleOutlined className="mr-2" />
              警告：数据清理操作不可恢复，请谨慎操作！
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BacktestHistory; 