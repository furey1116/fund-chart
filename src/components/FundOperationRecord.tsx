import React, { useState, useEffect } from 'react';
import {   Form,   Input,   Button,   DatePicker,   Select,   InputNumber,   Table,   message,   Card,   Typography,  Divider,  Popconfirm,  Space} from 'antd';
import dayjs from 'dayjs';
import type { TableProps } from 'antd';
import { FundOperation, createFundOperation } from '@/types/fundOperation';
import {   saveFundOperation as dbSaveFundOperation,   getFundOperations as dbGetFundOperations,  deleteFundOperation as dbDeleteFundOperation} from '@/lib/db';

const { Text } = Typography;
const { Option } = Select;

interface FundOperationRecordProps {
  fundCode: string;
  fundName: string;
  currentPrice: number;
  userId: string;
}

const FundOperationRecord: React.FC<FundOperationRecordProps> = ({
  fundCode,
  fundName,
  currentPrice,
  userId,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [operations, setOperations] = useState<FundOperation[]>([]);
  const [holdingShares, setHoldingShares] = useState(0);
  const [marketValue, setMarketValue] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalFees, setTotalFees] = useState(0);

  const loadOperations = async () => {
    setLoading(true);
    try {
      const data = await dbGetFundOperations(fundCode, userId);
      setOperations(data);
      
      calculateHoldings(data);
    } catch (error) {
      console.error('加载操作记录失败:', error);
      message.error('加载操作记录失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateHoldings = (data: FundOperation[]) => {
    let totalShares = 0;
    let invested = 0;
    let fees = 0;
    
    data.forEach(op => {
      if (op.operationType === 'buy') {
        totalShares += op.shares;
        invested += op.amount;
        fees += op.fee;
      } else if (op.operationType === 'sell') {
        totalShares -= op.shares;
        invested -= op.amount;
        fees += op.fee;
      }
    });
    
    setHoldingShares(totalShares);
    setMarketValue(totalShares * currentPrice);
    setTotalInvested(invested);
    setTotalFees(fees);
  };

  useEffect(() => {
    if (fundCode && userId) {
      loadOperations();
    }
  }, [fundCode, userId]);
  
  useEffect(() => {
    setMarketValue(holdingShares * currentPrice);
  }, [currentPrice, holdingShares]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const amount = values.price * values.shares;
      const newHoldingShares = values.operationType === 'buy' 
        ? holdingShares + values.shares 
        : holdingShares - values.shares;
      
      const operation = createFundOperation(
        userId,
        fundCode, 
        fundName, 
        {
          operationType: values.operationType,
          operationDate: values.operationDate.format('YYYY-MM-DD'),
          price: values.price,
          shares: values.shares,
          amount,
          fee: values.fee || 0,
          holdingShares: newHoldingShares,
          marketValue: newHoldingShares * currentPrice,
          remark: values.remark
        }
      );
      
      const success = await dbSaveFundOperation(operation);
      
      if (success) {
        message.success('操作记录已保存');
        form.resetFields();
        loadOperations();
      } else {
        message.error('保存操作记录失败');
      }
    } catch (error) {
      console.error('保存操作记录失败:', error);
      message.error('保存操作记录失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (operationId: string) => {
    setLoading(true);
    try {
      const success = await dbDeleteFundOperation(fundCode, operationId, userId);
      
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

  const getEnhancedOperations = () => {
    let runningShares = 0;
    
    const sortedOperations = [...operations].sort((a, b) => 
      new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime()
    );
    
    return sortedOperations.map(op => {
      if (op.operationType === 'buy') {
        runningShares += op.shares;
      } else {
        runningShares -= op.shares;
      }
      
      return {
        ...op,
        key: op.id,
        holdingShares: runningShares,
        marketValue: runningShares * currentPrice
      };
    });
  };

  const columns: TableProps<FundOperation>['columns'] = [
    {
      title: '操作日期',
      dataIndex: 'operationDate',
      key: 'operationDate',
      sorter: (a, b) => new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime(),
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type) => (
        <Text type={type === 'buy' ? 'success' : 'danger'}>
          {type === 'buy' ? '买入' : '卖出'}
        </Text>
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
      render: (shares, record) => 
        <Text type={record.operationType === 'buy' ? 'success' : 'danger'}>
          {record.operationType === 'buy' ? '+' : '-'}{shares.toLocaleString()}
        </Text>,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount, record) => 
        <Text type={record.operationType === 'buy' ? 'success' : 'danger'}>
          {record.operationType === 'buy' ? '+' : '-'}¥{amount.toFixed(2)}
        </Text>,
    },
    {
      title: '手续费',
      dataIndex: 'fee',
      key: 'fee',
      render: (fee) => `¥${fee.toFixed(2)}`,
    },
    {
      title: '持有份额',
      dataIndex: 'holdingShares',
      key: 'holdingShares',
      render: (shares) => shares ? shares.toLocaleString() : '-',
      fixed: 'right',
    },
    {
      title: '市值',
      dataIndex: 'marketValue',
      key: 'marketValue',
      render: (value) => value ? `¥${value.toFixed(2)}` : '-',
      fixed: 'right',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="删除操作记录"
          description="确定要删除这条操作记录吗？此操作不可恢复。"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger>删除</Button>
        </Popconfirm>
      ),
      fixed: 'right',
    },
  ];

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return '';
    return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const parseNumber = (value: string | undefined) => {
    if (!value) return 0;
    return Number(value.replace(/\$\s?|(,*)/g, ''));
  };

  const enhancedOperations = getEnhancedOperations();

  return (
    <div className="space-y-4">
      <Card title="持仓摘要" size="small">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Text type="secondary">持有份额:</Text>
            <Text strong className="ml-2">{holdingShares.toLocaleString()}</Text>
          </div>
          <div>
            <Text type="secondary">当前市值:</Text>
            <Text strong className="ml-2">¥{marketValue.toFixed(2)}</Text>
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
      
      <Card title="录入操作记录">
        <Form
          form={form}
          name="fundOperation"
          onFinish={onFinish}
          initialValues={{
            operationType: 'buy',
            operationDate: dayjs(),
            price: currentPrice,
          }}
          layout="vertical"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item
              name="operationType"
              label="操作类型"
              rules={[{ required: true, message: '请选择操作类型' }]}
            >
              <Select>
                <Option value="buy">买入</Option>
                <Option value="sell">卖出</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              name="operationDate"
              label="操作日期"
              rules={[{ required: true, message: '请选择操作日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              name="price"
              label="操作价格"
              rules={[{ required: true, message: '请输入操作价格' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                min={0.0001} 
                step={0.0001} 
                precision={4}
              />
            </Form.Item>
            
            <Form.Item
              name="shares"
              label="份数"
              rules={[{ required: true, message: '请输入份数' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                min={0} 
                step={100}
                formatter={formatNumber}
                parser={parseNumber}
              />
            </Form.Item>
            
            <Form.Item
              name="fee"
              label="手续费"
              initialValue={0}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                min={0} 
                step={0.01} 
                precision={2} 
              />
            </Form.Item>
            
            <Form.Item
              name="remark"
              label="备注"
            >
              <Input.TextArea rows={1} />
            </Form.Item>
          </div>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存操作记录
            </Button>
          </Form.Item>
        </Form>
      </Card>
      
      <Divider orientation="left">操作记录历史</Divider>
      
      <Table
        columns={columns}
        dataSource={enhancedOperations}
        loading={loading}
        pagination={{ pageSize: 10 }}
        size="small"
        scroll={{ x: 'max-content' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}>
                <Text strong>总计</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3}>
                <Text strong>{holdingShares.toLocaleString()}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4}>
                <Text strong>¥{totalInvested.toFixed(2)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5}>
                <Text strong>¥{totalFees.toFixed(2)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6}>
                <Text strong>{holdingShares.toLocaleString()}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7}>
                <Text strong>¥{marketValue.toFixed(2)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} colSpan={2}></Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
};

export default FundOperationRecord; 