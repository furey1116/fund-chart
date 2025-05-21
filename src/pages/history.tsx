import React from 'react';
import { NextPage } from 'next';
import { Typography } from 'antd';
import Layout from '@/components/Layout';
import BacktestHistory from '@/components/BacktestHistory';

const { Title } = Typography;

const HistoryPage: NextPage = () => {
  // 在实际场景中，应该从会话或context中获取用户ID
  const userId = 'current-user-id';

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <Title level={2} className="mb-6">历史回测记录</Title>
        <BacktestHistory userId={userId} />
      </div>
    </Layout>
  );
};

export default HistoryPage; 