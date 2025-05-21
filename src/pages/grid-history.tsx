import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tabs, Typography, Pagination, Tag, Spin, message, Modal, DatePicker, Select, Input, Form, Tooltip } from 'antd';
import { DeleteOutlined, SearchOutlined, ReloadOutlined, SwapOutlined, LineChartOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface StrategyRecord {
  id: string;
  userId: string;
  fundCode: string;
  fundName: string;
  strategyType: string;
  gridMode: string;
  initialPrice: number;
  gridCount: number;
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
}

const StrategyHistoryPage: React.FC = () => {
  const router = useRouter();
  
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    userId: 'current-user-id', // 实际应用中应该从会话或登录状态获取
    fundCode: '',
    dateRange: [null, null] as [any, any]
  });
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [deleteType, setDeleteType] = useState<string>('selected');
  const [deleteOlderThan, setDeleteOlderThan] = useState<string | null>(null);
  
  // 加载策略数据
  const loadStrategies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId: filters.userId,
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString()
      });
      
      if (filters.fundCode) {
        params.append('fundCode', filters.fundCode);
      }
      
      const response = await fetch(`/api/grid/history?${params.toString()}`);
      if (!response.ok) {
        throw new Error('获取策略数据失败');
      }
      
      const result = await response.json();
      setStrategies(result.data);
      setPagination({
        ...pagination,
        total: result.pagination.total
      });
    } catch (error: any) {
      message.error(`加载策略数据失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载和筛选条件变化时重新加载数据
  useEffect(() => {
    loadStrategies();
  }, [pagination.current, pagination.pageSize, filters.userId, filters.fundCode]);
  
  // 处理表格分页变化
  const handleTableChange = (page: number, pageSize?: number) => {
    setPagination({
      ...pagination,
      current: page,
      pageSize: pageSize || pagination.pageSize
    });
  };
  
  // 处理筛选条件变化
  const handleFilterChange = (values: any) => {
    setFilters({
      ...filters,
      ...values
    });
    // 重置到第一页
    setPagination({
      ...pagination,
      current: 1
    });
  };
  
  // 处理删除操作
  const handleDelete = async () => {
    try {
      setLoading(true);
      
      let url = '/api/admin/cleanup?';
      const params = new URLSearchParams();
      
      params.append('userId', filters.userId);
      
      if (deleteType === 'selected' && selectedStrategies.length > 0) {
        // 如果是删除选中的策略
        const deletePromises = selectedStrategies.map(id => 
          fetch(`/api/admin/cleanup?userId=${filters.userId}&strategyId=${id}&cleanupType=strategies`, {
            method: 'DELETE'
          })
        );
        
        await Promise.all(deletePromises);
      } else {
        // 根据删除类型设置参数
        params.append('cleanupType', deleteType);
        
        if (filters.fundCode) {
          params.append('fundCode', filters.fundCode);
        }
        
        if (deleteOlderThan) {
          params.append('olderThan', deleteOlderThan);
        }
        
        // 执行删除请求
        const response = await fetch(`/api/admin/cleanup?${params.toString()}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error('删除数据失败');
        }
      }
      
      // 删除成功后重新加载数据
      message.success('数据删除成功');
      setDeleteModalVisible(false);
      setSelectedStrategies([]);
      loadStrategies();
    } catch (error: any) {
      message.error(`删除数据失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 查看策略详情
  const viewStrategyDetail = (strategyId: string) => {
    router.push(`/grid-detail?id=${strategyId}`);
  };
  
  // 选择或取消选择策略
  const handleSelectStrategy = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedStrategies(prev => [...prev, id]);
    } else {
      setSelectedStrategies(prev => prev.filter(strategyId => strategyId !== id));
    }
  };
  
  // 比较选中的策略
  const compareStrategies = () => {
    if (selectedStrategies.length < 2) {
      message.warning('请至少选择两个策略进行比较');
      return;
    }
    
    const ids = selectedStrategies.join(',');
    router.push(`/grid-compare?ids=${ids}`);
  };
  
  // 渲染操作列
  const renderActions = (record: StrategyRecord, onSelect: (id: string, selected: boolean) => void, isSelected: boolean, onViewDetails: (id: string) => void) => {
    return (
      <Space size="small">
        <Tooltip title="查看详情">
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => onViewDetails(record.id)} 
            size="small"
          />
        </Tooltip>
        <Tooltip title={isSelected ? "取消选择" : "选择比较"}>
          <Button
            type={isSelected ? "primary" : "default"}
            icon={<SwapOutlined />}
            onClick={() => onSelect(record.id, !isSelected)}
            size="small"
          />
        </Tooltip>
      </Space>
    );
  };
  
  // 策略表格列定义
  const strategyColumns = [
    {
      title: '基金代码',
      dataIndex: 'fundCode',
      key: 'fundCode',
    },
    {
      title: '基金名称',
      dataIndex: 'fundName',
      key: 'fundName',
    },
    {
      title: '策略类型',
      dataIndex: 'strategyType',
      key: 'strategyType',
      render: (text: string) => text === 'symmetric' ? '对称网格' : '单向下跌网格'
    },
    {
      title: '网格模式',
      dataIndex: 'gridMode',
      key: 'gridMode',
      render: (text: string) => text === 'percentage' ? '百分比模式' : '绝对金额模式'
    },
    {
      title: '初始价格',
      dataIndex: 'initialPrice',
      key: 'initialPrice',
      render: (value: number) => value.toFixed(4)
    },
    {
      title: '网格数量',
      dataIndex: 'gridCount',
      key: 'gridCount',
    },
    {
      title: '回测次数',
      key: 'backtestCount',
      render: (_: any, record: StrategyRecord) => record.backtests?.length || 0
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: StrategyRecord) => renderActions(
        record, 
        handleSelectStrategy, 
        selectedStrategies.includes(record.id),
        viewStrategyDetail
      ),
      fixed: 'right' as const,
      width: 120,
    },
  ];
  
  // 回测结果展开行
  const expandedRowRender = (record: StrategyRecord) => {
    const backtestColumns = [
      {
        title: '回测开始日期',
        dataIndex: 'startDate',
        key: 'startDate',
        render: (text: string) => dayjs(text).format('YYYY-MM-DD')
      },
      {
        title: '回测结束日期',
        dataIndex: 'endDate',
        key: 'endDate',
        render: (text: string) => dayjs(text).format('YYYY-MM-DD')
      },
      {
        title: '回测模式',
        dataIndex: 'useIntraDayData',
        key: 'useIntraDayData',
        render: (value: boolean) => (
          <Tag color={value ? 'green' : 'blue'}>
            {value ? '日内高低点' : '日线净值'}
          </Tag>
        )
      },
      {
        title: '总投资',
        dataIndex: 'totalInvestment',
        key: 'totalInvestment',
        render: (value: number) => `¥${value.toFixed(2)}`
      },
      {
        title: '最终价值',
        dataIndex: 'totalValue',
        key: 'totalValue',
        render: (value: number) => `¥${value.toFixed(2)}`
      },
      {
        title: '收益金额',
        dataIndex: 'profitAmount',
        key: 'profitAmount',
        render: (value: number) => (
          <Text type={value >= 0 ? 'success' : 'danger'}>
            ¥{value.toFixed(2)}
          </Text>
        )
      },
      {
        title: '收益率',
        dataIndex: 'profitPercentage',
        key: 'profitPercentage',
        render: (value: number) => (
          <Text type={value >= 0 ? 'success' : 'danger'}>
            {value.toFixed(2)}%
          </Text>
        )
      },
      {
        title: '交易次数',
        dataIndex: 'transactionCount',
        key: 'transactionCount',
      },
      {
        title: '回测时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
      },
      {
        title: '操作',
        key: 'action',
        render: (_: any, backtestRecord: BacktestRecord) => (
          <Space size="small">
            <Button 
              type="link" 
              size="small" 
              onClick={() => router.push(`/grid-backtest?id=${backtestRecord.id}`)}
            >
              详情
            </Button>
            <Button 
              type="link" 
              size="small" 
              danger
              onClick={() => {
                // 设置删除单个回测
                setDeleteType('backtests');
                setSelectedStrategies([]);
                fetch(`/api/admin/cleanup?backtestId=${backtestRecord.id}&cleanupType=backtests`, {
                  method: 'DELETE'
                })
                  .then(() => {
                    message.success('删除回测成功');
                    loadStrategies();
                  })
                  .catch(error => {
                    message.error(`删除回测失败: ${error.message}`);
                  });
              }}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ];

    return (
      <Table
        rowKey="id"
        columns={backtestColumns}
        dataSource={record.backtests || []}
        pagination={false}
        size="small"
      />
    );
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Title level={2}>网格策略历史记录</Title>
      
      {/* 筛选器 */}
      <Card className="mb-6">
        <Form
          layout="inline"
          onFinish={handleFilterChange}
          initialValues={filters}
        >
          <Form.Item name="fundCode" label="基金代码">
            <Input
              placeholder="输入基金代码"
              allowClear
              style={{ width: 150 }}
            />
          </Form.Item>
          
          <Form.Item name="dateRange" label="创建日期">
            <RangePicker />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              筛选
            </Button>
          </Form.Item>
          
          <Form.Item>
            <Button 
              onClick={() => {
                handleFilterChange({ fundCode: '', dateRange: [null, null] });
              }}
              icon={<ReloadOutlined />}
            >
              重置
            </Button>
          </Form.Item>
        </Form>
      </Card>
      
      {/* 操作按钮 */}
      <div className="mb-4 flex justify-between">
        <Space>
          <Button
            type="primary"
            onClick={compareStrategies}
            disabled={selectedStrategies.length < 2}
            icon={<SwapOutlined />}
          >
            比较选中策略
          </Button>
        </Space>
        
        <Space>
          <Button
            danger
            onClick={() => {
              setDeleteType('all');
              setDeleteOlderThan(null);
              setDeleteModalVisible(true);
            }}
            icon={<DeleteOutlined />}
          >
            清理数据
          </Button>
        </Space>
      </div>
      
      {/* 策略表格 */}
      <Card>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            columns={strategyColumns}
            dataSource={strategies}
            expandable={{
              expandedRowRender,
              expandRowByClick: true
            }}
            pagination={false}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedStrategies,
              onChange: keys => setSelectedStrategies(keys as string[])
            }}
          />
          
          <div className="mt-4 flex justify-end">
            <Pagination
              current={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              showSizeChanger
              showQuickJumper
              showTotal={total => `共 ${total} 条记录`}
              onChange={handleTableChange}
              onShowSizeChange={(current, size) => handleTableChange(1, size)}
            />
          </div>
        </Spin>
      </Card>
      
      {/* 删除确认对话框 */}
      <Modal
        title="确认删除数据"
        open={deleteModalVisible}
        onOk={handleDelete}
        onCancel={() => setDeleteModalVisible(false)}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading }}
      >
        <div className="space-y-4">
          <p>请选择要删除的数据类型：</p>
          
          <Select
            value={deleteType}
            onChange={setDeleteType}
            style={{ width: '100%' }}
          >
            {selectedStrategies.length > 0 && (
              <Option value="selected">选中的策略</Option>
            )}
            <Option value="all">所有数据</Option>
            <Option value="strategies">仅策略数据</Option>
            <Option value="backtests">仅回测数据</Option>
            <Option value="klines">仅K线数据</Option>
          </Select>
          
          {deleteType !== 'selected' && (
            <div>
              <p>可以选择删除某一日期之前的数据：</p>
              <DatePicker
                style={{ width: '100%' }}
                onChange={(date) => setDeleteOlderThan(date ? date.toISOString() : null)}
              />
            </div>
          )}
          
          <div className="text-red-500 font-bold">
            警告：此操作不可撤销，删除的数据将无法恢复！
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StrategyHistoryPage; 