import React from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import FundNetValueChart from './FundNetValueChart';
import ETFGridOperation from './ETFGridOperation';
import { FundHistoryNetValue } from '@/api/fund';

interface FundTabsViewProps {
  fundCode: string;
  fundName: string;
  netValueData: FundHistoryNetValue[];
  loading: boolean;
}

const FundTabsView: React.FC<FundTabsViewProps> = ({
  fundCode,
  fundName,
  netValueData,
  loading,
}) => {
  // 获取最新净值
  const currentPrice = netValueData && netValueData.length > 0 
    ? parseFloat(netValueData[0].DWJZ) 
    : 0;

  const items: TabsProps['items'] = [
    {
      key: 'netValue',
      label: '净值走势',
      children: (
        <FundNetValueChart
          data={netValueData}
          fundName={fundName}
          loading={loading}
        />
      ),
    },
    {
      key: 'gridOperation',
      label: 'ETF网格操作',
      children: (
        <ETFGridOperation
          fundCode={fundCode}
          fundName={fundName}
          netValueData={netValueData}
        />
      ),
    },
  ];

  return (
    <Tabs defaultActiveKey="netValue" items={items} />
  );
};

export default FundTabsView; 