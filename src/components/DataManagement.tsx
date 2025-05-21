import React, { useState } from 'react';
import { Card, Button, Space, DatePicker, Input, Select, message, Modal, Divider, Alert, Spin } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { confirm } = Modal;

interface DataManagementProps {
  fundCode: string;
  fundName: string;
}

const DataManagement: React.FC<DataManagementProps> = ({ fundCode, fundName }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [kLineRange, setKLineRange] = useState<[string, string] | null>(null);
  
  // 使用固定的用户ID，在实际应用中应从登录会话获取
  const userId = 'current-user-id';

  // 清理回测结果
  const clearBacktestResults = async () => {
    confirm({
      title: '确定要清理所有回测结果吗?',
      icon: <ExclamationCircleOutlined />,
      content: '此操作将删除所有的回测记录和交易数据，但会保留您的策略配置。该操作不可恢复。',
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        setLoading(true);
        try {
          const response = await fetch('/api/data/cleanup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              action: 'clearBacktestResults'
            })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            message.success(result.message);
          } else {
            message.error(`清理失败: ${result.message}`);
          }
        } catch (error: any) {
          message.error(`操作失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 清理策略配置
  const clearStrategies = async () => {
    confirm({
      title: '确定要清理所有网格策略吗?',
      icon: <ExclamationCircleOutlined />,
      content: '此操作将删除所有的网格策略配置、回测记录和交易数据。该操作不可恢复。',
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        setLoading(true);
        try {
          const response = await fetch('/api/data/cleanup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              action: 'clearStrategies'
            })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            message.success(result.message);
          } else {
            message.error(`清理失败: ${result.message}`);
          }
        } catch (error: any) {
          message.error(`操作失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 清理K线数据
  const clearKLineData = async () => {
    // 检查是否选择了日期范围
    if (!kLineRange) {
      message.warning('请先选择要清理的K线数据日期范围');
      return;
    }
    
    confirm({
      title: '确定要清理所选日期范围的K线数据吗?',
      icon: <ExclamationCircleOutlined />,
      content: `此操作将删除 ${fundName} (${fundCode}) 在所选日期范围内的所有K线数据。该操作不可恢复。`,
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        setLoading(true);
        try {
          const response = await fetch('/api/data/cleanup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              action: 'clearKLineData',
              fundCode,
              startDate: kLineRange[0],
              endDate: kLineRange[1]
            })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            message.success(result.message);
            setKLineRange(null); // 清空日期选择
          } else {
            message.error(`清理失败: ${result.message}`);
          }
        } catch (error: any) {
          message.error(`操作失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };
  
  // 清理所有数据
  const clearAllData = async () => {
    confirm({
      title: '确定要清理所有数据吗?',
      icon: <ExclamationCircleOutlined />,
      content: `此操作将删除所有的网格策略配置、回测记录、交易数据，以及 ${fundName} (${fundCode}) 的K线数据。该操作不可恢复。`,
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        setLoading(true);
        try {
          const response = await fetch('/api/data/cleanup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              action: 'clearAll',
              fundCode
            })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            message.success(result.message);
          } else {
            message.error(`清理失败: ${result.message}`);
          }
        } catch (error: any) {
          message.error(`操作失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <Card title="数据管理与清理" className="mb-4">
      <Spin spinning={loading}>
        <Alert
          message="数据管理提示"
          description={
            <div>
              <p>为避免数据库溢出，请定期清理不需要的数据。清理操作不可撤销，请谨慎操作。</p>
              <p>当前基金: {fundName} ({fundCode})</p>
            </div>
          }
          type="info"
          showIcon
          className="mb-4"
        />
        
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">清理回测结果</h4>
            <p className="text-sm text-gray-500 mb-2">
              删除所有回测记录和交易数据，但保留策略配置
            </p>
            <Button 
              type="primary" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={clearBacktestResults}
            >
              清理回测结果
            </Button>
          </div>
          
          <Divider />
          
          <div>
            <h4 className="mb-2 font-medium">清理网格策略</h4>
            <p className="text-sm text-gray-500 mb-2">
              删除所有网格策略配置及关联的回测记录和交易数据
            </p>
            <Button 
              type="primary" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={clearStrategies}
            >
              清理所有策略
            </Button>
          </div>
          
          <Divider />
          
          <div>
            <h4 className="mb-2 font-medium">清理K线数据</h4>
            <p className="text-sm text-gray-500 mb-2">
              删除指定日期范围内的K线数据
            </p>
            <div className="flex space-x-2 items-end">
              <div className="flex-grow">
                <RangePicker 
                  style={{ width: '100%' }} 
                  onChange={(dates) => {
                    if (dates) {
                      setKLineRange([
                        dates[0]?.format('YYYY-MM-DD') || '',
                        dates[1]?.format('YYYY-MM-DD') || ''
                      ]);
                    } else {
                      setKLineRange(null);
                    }
                  }}
                />
              </div>
              <Button 
                type="primary" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={clearKLineData}
                disabled={!kLineRange}
              >
                清理K线数据
              </Button>
            </div>
          </div>
          
          <Divider />
          
          <div>
            <h4 className="mb-2 font-medium">清理所有数据</h4>
            <p className="text-sm text-gray-500 mb-2">
              删除所有数据，包括策略、回测结果、交易记录和K线数据
            </p>
            <Button 
              type="primary" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={clearAllData}
            >
              清理所有数据
            </Button>
          </div>
        </div>
      </Spin>
    </Card>
  );
};

export default DataManagement; 