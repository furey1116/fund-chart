import React from 'react';
import { Descriptions, Card, Spin, Empty } from 'antd';
import { FundDetail as FundDetailType, FundIncrease } from '@/api/fund';

interface FundDetailProps {
  fundDetail: FundDetailType | null;
  fundIncreases: FundIncrease[];
  loading: boolean;
}

const FundDetail: React.FC<FundDetailProps> = ({
  fundDetail,
  fundIncreases,
  loading,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (!fundDetail) {
    return (
      <Card className="h-64">
        <Empty description="暂无基金详情" />
      </Card>
    );
  }

  return (
    <Card title="基金基本信息" className="w-full mb-6">
      <Descriptions bordered column={2}>
        <Descriptions.Item label="基金代码">{fundDetail.FCODE}</Descriptions.Item>
        <Descriptions.Item label="基金简称">{fundDetail.SHORTNAME}</Descriptions.Item>
        <Descriptions.Item label="基金全称">{fundDetail.FULLNAME}</Descriptions.Item>
        <Descriptions.Item label="基金类型">{fundDetail.FTYPE}</Descriptions.Item>
        <Descriptions.Item label="成立日期">{fundDetail.ESTABDATE}</Descriptions.Item>
        <Descriptions.Item label="基金公司">{fundDetail.JJGS}</Descriptions.Item>
      </Descriptions>

      {fundIncreases && fundIncreases.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-4">业绩表现</h3>
          <Descriptions bordered column={3}>
            {fundIncreases.map(item => (
              <Descriptions.Item 
                key={item.title} 
                label={item.title}
                contentStyle={{ 
                  color: parseFloat(item.syl) >= 0 ? 'red' : 'green',
                  fontWeight: 'bold'
                }}
              >
                {`${item.syl}%`}
                <br />
                <span className="text-gray-500 text-xs">
                  同类平均: {item.avg}% （{item.rank}/{item.sc}）
                </span>
              </Descriptions.Item>
            ))}
          </Descriptions>
        </div>
      )}
    </Card>
  );
};

export default FundDetail; 