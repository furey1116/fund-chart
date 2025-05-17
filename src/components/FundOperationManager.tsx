import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Typography, message, Button, Tooltip, Popconfirm, Space, Tag, Alert } from 'antd';
import { SearchOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { FundOperation } from '@/types/fundOperation';
import { User } from '@/types/user';
import { getAllFundOperations, deleteFundOperation } from '@/lib/db';
import { getFundPrices } from '@/lib/api';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const { Title, Text } = Typography;

// 计算持有情况的函数
const calculateHoldings = (operations: FundOperation[]): {
  holdingsByFund: Record<string, number>,
  totalInvested: number,
  totalFees: number
} => {
  const holdingsByFund: Record<string, number> = {};
  let totalInvested = 0;
  let totalFees = 0;
  
  // 按基金代码分组计算持有情况
  operations.forEach(op => {
    const { fundCode, operationType, shares, amount, fee } = op;
    
    // 初始化持仓
    if (!holdingsByFund[fundCode]) {
      holdingsByFund[fundCode] = 0;
    }
    
    // 更新持仓
    if (operationType === 'buy') {
      holdingsByFund[fundCode] += shares;
      totalInvested += amount;
    } else if (operationType === 'sell') {
      holdingsByFund[fundCode] -= shares;
      totalInvested -= amount;
    }
    
    // 累计手续费
    totalFees += fee;
  });
  
  return { holdingsByFund, totalInvested, totalFees };
};

const FundOperationManager: React.FC = () => {
  // 状态
  const [operations, setOperations] = useState<FundOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  
  // 持有情况计算
  const holdings = useMemo(() => calculateHoldings(operations), [operations]);
  const { holdingsByFund, totalInvested, totalFees } = holdings;
  
  // 计算总市值
  const totalMarketValue = useMemo(() => {
    let sum = 0;
    Object.entries(holdingsByFund).forEach(([fundCode, shares]) => {
      if (shares > 0) { // 只计算持有份额大于0的基金
        const price = currentPrices[fundCode] || 1.0000;
        sum += shares * price;
      }
    });
    return sum;
  }, [holdingsByFund, currentPrices]);
  
  // 刷新价格数据
  const refreshPrices = useCallback(async () => {
    if (!currentUser || operations.length === 0) return;
    
    setRefreshing(true);
    try {
      // 获取基金代码列表
      const fundCodes = Array.from(new Set(operations.map(op => op.fundCode)));
      // 获取当前价格
      const prices = await getFundPrices(fundCodes);
      setCurrentPrices(prices);
    } catch (error) {
      console.error('刷新价格数据失败:', error);
    } finally {
      setRefreshing(false);
    }
  }, [currentUser, operations]);
  
  // 加载用户的所有操作记录
  const loadOperations = useCallback(async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const data = await getAllFundOperations(currentUser.id);
      setOperations(data);
      
      // 获取基金代码列表
      const fundCodes = Array.from(new Set(data.map(op => op.fundCode)));
      // 获取当前价格
      const prices = await getFundPrices(fundCodes);
      setCurrentPrices(prices);
    } catch (error) {
      console.error('加载操作记录失败:', error);
      message.error('加载操作记录失败');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);
  
  // 当用户登录状态变化时加载数据
  useEffect(() => {
    if (currentUser) {
      loadOperations();
    } else {
      setOperations([]);
      setCurrentPrices({});
    }
  }, [currentUser, loadOperations]);
  
  // 设置定时刷新价格
  useEffect(() => {
    // 只在有用户登录且有操作记录的情况下启用定时刷新
    if (currentUser && operations.length > 0) {
      // 每5分钟刷新一次价格
      const intervalId = setInterval(() => {
        refreshPrices();
      }, 5 * 60 * 1000);
      
      return () => clearInterval(intervalId);
    }
  }, [currentUser, operations, refreshPrices]);
  
  // 检查本地存储是否有登录状态
  useEffect(() => {
    const storedUser = localStorage.getItem('current_user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('current_user');
      }
    }
  }, []);
  
  // 处理登录
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('current_user', JSON.stringify(user));
    setShowLoginForm(false);
    message.success(`欢迎回来, ${user.displayName}`);
  };
  
  // 处理注销
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
    message.info('已成功退出');
  };
  
  // 删除操作记录
  const handleDelete = async (record: FundOperation) => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const success = await deleteFundOperation(record.fundCode, record.id, currentUser.id);
      
      if (success) {
        message.success('操作记录已删除');
        loadOperations();
      } else {
        message.error('删除操作记录失败');
      }
    } catch (error) {
      console.error('删除操作记录失败:', error);
      message.error('删除操作记录失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 扩展操作数据，添加当前持有份额和市值
  const getEnhancedOperations = () => {
    // 按基金代码分组
    const operationsByFund: Record<string, FundOperation[]> = {};
    operations.forEach(op => {
      if (!operationsByFund[op.fundCode]) {
        operationsByFund[op.fundCode] = [];
      }
      operationsByFund[op.fundCode].push(op);
    });
    
    // 计算每个基金的持有情况
    const enhancedOps: (FundOperation & { key: string, currentHolding: number, currentMarketValue: number })[] = [];
    
    // 处理每个基金
    Object.entries(operationsByFund).forEach(([fundCode, ops]) => {
      // 获取该基金的当前价格
      const currentPrice = currentPrices[fundCode] || 1.0000;
      
      // 初始化该基金的持仓
      let fundHolding = 0;
      
      // 按日期排序操作
      const sortedOps = [...ops].sort((a, b) => 
        new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime()
      );
      
      // 计算每个操作后的持仓
      sortedOps.forEach(op => {
        if (op.operationType === 'buy') {
          fundHolding += op.shares;
        } else {
          fundHolding -= op.shares;
        }
        
        // 添加增强的操作数据，使用当前价格计算市值
        enhancedOps.push({
          ...op,
          key: op.id,
          currentHolding: fundHolding,
          currentMarketValue: fundHolding * currentPrice
        });
      });
    });
    
    // 按操作日期倒序排序，显示最新的操作
    return enhancedOps.sort((a, b) => 
      new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime()
    );
  };
  
  // 表格列定义
  const columns: TableProps<(FundOperation & { key: string, currentHolding: number, currentMarketValue: number })>['columns'] = [
    {
      title: '操作日期',
      dataIndex: 'operationDate',
      key: 'operationDate',
      sorter: (a, b) => new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime(),
    },
    {
      title: '基金代码',
      dataIndex: 'fundCode',
      key: 'fundCode',
      render: (code, record) => (
        <Tooltip title={record.fundName}>
          <a href={`/?code=${code}&name=${encodeURIComponent(record.fundName)}`} target="_blank" rel="noopener noreferrer">
            {code}
          </a>
        </Tooltip>
      ),
    },
    {
      title: '基金名称',
      dataIndex: 'fundName',
      key: 'fundName',
      responsive: ['md'],
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type) => (
        <Tag color={type === 'buy' ? 'green' : 'red'}>
          {type === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price) => price.toFixed(4),
    },
    {
      title: '份数',
      dataIndex: 'shares',
      key: 'shares',
      render: (shares, record) => (
        <Text type={record.operationType === 'buy' ? 'success' : 'danger'}>
          {record.operationType === 'buy' ? '+' : '-'}{shares.toLocaleString()}
        </Text>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount, record) => (
        <Text type={record.operationType === 'buy' ? 'success' : 'danger'}>
          {record.operationType === 'buy' ? '+' : '-'}¥{amount.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '手续费',
      dataIndex: 'fee',
      key: 'fee',
      responsive: ['lg'],
      render: (fee) => `¥${fee.toFixed(2)}`,
    },
    {
      title: '持有份额',
      dataIndex: 'currentHolding',
      key: 'currentHolding',
      render: (holding) => holding.toLocaleString(),
      fixed: 'right',
    },
    {
      title: '市值',
      dataIndex: 'currentMarketValue',
      key: 'currentMarketValue',
      render: (value) => `¥${value.toFixed(2)}`,
      fixed: 'right',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      responsive: ['lg'],
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="删除操作记录"
          description="确定要删除这条操作记录吗？此操作不可恢复。"
          onConfirm={() => handleDelete(record)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger>删除</Button>
        </Popconfirm>
      ),
      fixed: 'right',
    },
  ];
  
  // 渲染用户信息或登录注册按钮
  const renderAuthSection = () => {
    if (currentUser) {
      return (
        <Space>
          <Text><UserOutlined /> {currentUser.displayName}</Text>
          <Button 
            icon={<LogoutOutlined />} 
            onClick={handleLogout}
            size="small"
          >
            退出
          </Button>
        </Space>
      );
    }
    
    return (
      <Space>
        <Button onClick={() => setShowLoginForm(true)}>登录</Button>
        <Button type="primary" onClick={() => setShowRegisterForm(true)}>注册</Button>
      </Space>
    );
  };
  
  // 显示登录/注册表单或操作记录
  const renderContent = () => {
    if (showLoginForm) {
      return (
        <Card title="用户登录">
          <LoginForm 
            onLogin={handleLogin} 
            onCancel={() => setShowLoginForm(false)} 
            onRegisterClick={() => {
              setShowLoginForm(false);
              setShowRegisterForm(true);
            }}
          />
        </Card>
      );
    }
    
    if (showRegisterForm) {
      return (
        <Card title="用户注册">
          <RegisterForm 
            onRegister={handleLogin}
            onCancel={() => setShowRegisterForm(false)}
            onLoginClick={() => {
              setShowRegisterForm(false);
              setShowLoginForm(true);
            }}
          />
        </Card>
      );
    }
    
    if (!currentUser) {
      return (
        <Alert
          message="访问受限"
          description="请登录或注册以查看你的基金操作记录"
          type="info"
          showIcon
        />
      );
    }
    
    const enhancedOperations = getEnhancedOperations();
    
    return (
      <>
        <Card title="持仓摘要" size="small" className="mb-4" extra={
          <Button 
            type="link" 
            onClick={refreshPrices} 
            loading={refreshing}
            disabled={refreshing}
          >
            刷新价格
          </Button>
        }>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Text type="secondary">持有基金:</Text>
              <Text strong className="ml-2">{Object.keys(holdingsByFund).filter(k => holdingsByFund[k] > 0).length} 只</Text>
            </div>
            <div>
              <Text type="secondary">总市值:</Text>
              <Text strong className="ml-2">¥{totalMarketValue.toFixed(2)}</Text>
            </div>
            <div>
              <Text type="secondary">总投入:</Text>
              <Text strong className="ml-2">¥{totalInvested.toFixed(2)}</Text>
            </div>
            <div>
              <Text type="secondary">总手续费:</Text>
              <Text strong className="ml-2">¥{totalFees.toFixed(2)}</Text>
            </div>
          </div>
        </Card>
        
        <Table 
          columns={columns} 
          dataSource={enhancedOperations}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
          size="middle"
          scroll={{ x: 'max-content' }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <Text strong>总计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5}></Table.Summary.Cell>
                <Table.Summary.Cell index={6}>
                  <Text strong>¥{totalInvested.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7}>
                  <Text strong>¥{totalFees.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8}></Table.Summary.Cell>
                <Table.Summary.Cell index={9}>
                  <Text strong>¥{totalMarketValue.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={10} colSpan={2}></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </>
    );
  };
  
  return (
    <Card 
      title={
        <div className="flex justify-between items-center">
          <Title level={4} className="m-0">基金操作记录</Title>
          {renderAuthSection()}
        </div>
      }
      className="mb-6"
    >
      {renderContent()}
    </Card>
  );
};

export default FundOperationManager; 