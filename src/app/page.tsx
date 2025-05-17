'use client';

import { useState, useEffect } from 'react';
import { ConfigProvider, message, Layout, Typography } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

import FundSearch from '@/components/FundSearch';
import DateRangePicker, { DateRangeType } from '@/components/DateRangePicker';
import FundTabsView from '@/components/FundTabsView';
import FundDetail from '@/components/FundDetail';
import FundOperationManager from '@/components/FundOperationManager';
import FundOperationRecord from '@/components/FundOperationRecord';

import {
  getFundHistoryNetValue,
  getFundDetail,
  getFundIncrease,
  FundSearchResult,
  FundHistoryNetValue,
  FundDetail as FundDetailType,
  FundIncrease
} from '@/api/fund';
import { getFundPrice } from '@/lib/api';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

// 设置 dayjs 语言为中文
dayjs.locale('zh-cn');

// 简化后的FundSearchResult类型，用于URL参数
interface SimpleFundInfo {
  CODE: string;
  NAME: string;
}

export default function Home() {
  // 选中的基金
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);
  
  // 日期范围
  const [dateRange, setDateRange] = useState({
    type: '3m' as DateRangeType,
    startDate: dayjs().subtract(3, 'month'),
    endDate: dayjs(),
  });
  
  // 数据加载状态
  const [loadingNetValue, setLoadingNetValue] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // 基金数据
  const [netValueData, setNetValueData] = useState<FundHistoryNetValue[]>([]);
  const [fundDetail, setFundDetail] = useState<FundDetailType | null>(null);
  const [fundIncreases, setFundIncreases] = useState<FundIncrease[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  // 当前用户
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // 处理基金选择
  const handleFundSelect = (fund: FundSearchResult) => {
    setSelectedFund(fund);
  };

  // 处理日期范围改变
  const handleDateRangeChange = (value: {
    type: DateRangeType;
    startDate: dayjs.Dayjs | null;
    endDate: dayjs.Dayjs | null;
  }) => {
    // 确保不传入null值
    const safeStartDate = value.startDate || dayjs().subtract(3, 'month');
    const safeEndDate = value.endDate || dayjs();
    
    setDateRange({
      type: value.type,
      startDate: safeStartDate,
      endDate: safeEndDate,
    });
  };

  // 获取基金历史净值数据
  useEffect(() => {
    if (selectedFund && dateRange.startDate && dateRange.endDate) {
      const fetchData = async () => {
        setLoadingNetValue(true);
        try {
          // 获取历史净值
          const response = await getFundHistoryNetValue(selectedFund.CODE);
          if (response && response.Datas) {
            // 转换日期格式为YYYY-MM-DD以便比较
            const startDate = dateRange.startDate.format('YYYY-MM-DD');
            const endDate = dateRange.endDate.format('YYYY-MM-DD');
            
            console.log('筛选日期范围:', startDate, '至', endDate);
            console.log('获取到的数据条数:', response.Datas.length);
            
            const filteredData = response.Datas.filter((item: FundHistoryNetValue) => {
              const itemDate = item.FSRQ;
              return itemDate >= startDate && itemDate <= endDate;
            });
            
            console.log('筛选后的数据条数:', filteredData.length);
            console.log('最早的日期:', filteredData.length > 0 ? 
              filteredData.reduce((earliest, item) => 
                item.FSRQ < earliest ? item.FSRQ : earliest, filteredData[0].FSRQ) : 'N/A');
            
            setNetValueData(filteredData);
          }
        } catch (error) {
          console.error('获取基金净值数据失败:', error);
          message.error('获取基金净值数据失败');
        } finally {
          setLoadingNetValue(false);
        }
      };

      fetchData();
    }
  }, [selectedFund, dateRange]);

  // 获取基金详情和涨幅数据
  useEffect(() => {
    if (selectedFund) {
      const fetchDetailData = async () => {
        setLoadingDetail(true);
        try {
          // 获取基金详情
          const detailResponse = await getFundDetail(selectedFund.CODE);
          if (detailResponse && detailResponse.Datas) {
            setFundDetail(detailResponse.Datas);
          }

          // 获取基金涨幅
          const increaseResponse = await getFundIncrease(selectedFund.CODE);
          if (increaseResponse && increaseResponse.Datas) {
            setFundIncreases(increaseResponse.Datas);
          }
        } catch (error) {
          console.error('获取基金详情数据失败:', error);
          message.error('获取基金详情数据失败');
        } finally {
          setLoadingDetail(false);
        }
      };

      fetchDetailData();
    }
  }, [selectedFund]);

  // 检查URL参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const name = params.get('name');
    
    if (code && name) {
      // 使用AI获取基金详情
      const fetchFundByCode = async () => {
        try {
          // 先尝试使用简化后的FundSearchResult类型
          const simpleFund: SimpleFundInfo = {
            CODE: code,
            NAME: decodeURIComponent(name)
          };
          
          // 设置选中的基金
          setSelectedFund(simpleFund as FundSearchResult);
          
          // 同时尝试获取完整的FundDetail
          const detailResponse = await getFundDetail(code);
          if (detailResponse && detailResponse.Datas) {
            // 更新基金详情
            setFundDetail(detailResponse.Datas);
          }
        } catch (error) {
          console.error('获取基金详情失败:', error);
        }
      };
      
      fetchFundByCode();
    }
  }, []);
  
  // 检查本地存储是否有登录状态
  useEffect(() => {
    const storedUser = localStorage.getItem('current_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setCurrentUserId(userData.id);
      } catch (e) {
        localStorage.removeItem('current_user');
      }
    }
  }, []);

  // 获取基金当前价格
  useEffect(() => {
    if (selectedFund) {
      const fetchCurrentPrice = async () => {
        try {
          const price = await getFundPrice(selectedFund.CODE);
          setCurrentPrice(price);
        } catch (error) {
          console.error('获取基金当前价格失败:', error);
          // 如果获取实时价格失败，尝试使用历史净值
          if (netValueData.length > 0) {
            setCurrentPrice(parseFloat(netValueData[0].DWJZ));
          }
        }
      };

      fetchCurrentPrice();
    }
  }, [selectedFund, netValueData]);

  return (
    <ConfigProvider locale={zhCN}>
      <Layout className="min-h-screen">
        <Header className="bg-white flex items-center px-6 shadow-sm">
          <Title level={3} className="m-0 text-blue-600">基金净值及网格操作系统</Title>
        </Header>
        <Content className="p-6 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <Title level={4} className="mb-4">搜索基金</Title>
              <FundSearch onSelect={handleFundSelect} />
            </div>

            <FundOperationManager />

            {selectedFund && (
              <>
                <FundDetail 
                  fundDetail={fundDetail} 
                  fundIncreases={fundIncreases}
                  loading={loadingDetail} 
                />

                {currentUserId && netValueData.length > 0 && (
                  <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
                    <Title level={4} className="mb-4">基金操作记录</Title>
                    <FundOperationRecord
                      fundCode={selectedFund.CODE}
                      fundName={selectedFund.NAME}
                      currentPrice={currentPrice}
                      userId={currentUserId}
                    />
                  </div>
                )}

                <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <Title level={4} className="m-0">净值走势</Title>
                    <DateRangePicker 
                      value={dateRange}
                      onChange={handleDateRangeChange}
                    />
                  </div>
                  
                  <FundTabsView 
                    netValueData={netValueData}
                    fundName={selectedFund.NAME}
                    fundCode={selectedFund.CODE}
                    loading={loadingNetValue}
                  />
                </div>
              </>
            )}
          </div>
        </Content>
        <Footer className="text-center bg-gray-100">
          基金净值及网格操作系统 ©{new Date().getFullYear()} Created with Next.js and Niuzige Design
        </Footer>
      </Layout>
    </ConfigProvider>
  );
} 