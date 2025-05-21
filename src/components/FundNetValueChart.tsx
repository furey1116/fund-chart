import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin, Empty, Card, Tag, Space, Typography } from 'antd';
import { FundHistoryNetValue, getHS300ETFHistoryNetValue, calculateReturnRate } from '@/api/fund';

const { Title, Text } = Typography;

interface FundNetValueChartProps {
  data: FundHistoryNetValue[];
  fundName: string;
  loading: boolean;
}

const FundNetValueChart: React.FC<FundNetValueChartProps> = ({
  data,
  fundName,
  loading,
}) => {
  const [option, setOption] = useState({});
  const [hs300Data, setHs300Data] = useState<FundHistoryNetValue[]>([]);
  const [hs300Loading, setHs300Loading] = useState(false);
  const [fundReturnRate, setFundReturnRate] = useState(0);
  const [hs300ReturnRate, setHs300ReturnRate] = useState(0);

  // 获取沪深300ETF数据
  useEffect(() => {
    const fetchHS300Data = async () => {
      if (data && data.length > 0) {
        try {
          setHs300Loading(true);
          const response = await getHS300ETFHistoryNetValue();
          if (response && response.Datas) {
            setHs300Data(response.Datas);
            
            // 计算沪深300ETF收益率
            const returnRate = calculateReturnRate(response.Datas);
            setHs300ReturnRate(returnRate);
          }
        } catch (error) {
          console.error('获取沪深300ETF数据出错:', error);
        } finally {
          setHs300Loading(false);
        }
      }
    };

    fetchHS300Data();
  }, [data]);

  // 计算本基金收益率
  useEffect(() => {
    if (data && data.length > 0) {
      const returnRate = calculateReturnRate(data);
      setFundReturnRate(returnRate);
    }
  }, [data]);

  useEffect(() => {
    if (data && data.length > 0 && hs300Data.length > 0) {
      // 找到两个数据集的日期交集
      const fundDates = new Set(data.map(item => item.FSRQ));
      const filteredHs300Data = hs300Data.filter(item => fundDates.has(item.FSRQ));
      
      // 数据处理：按日期从早到晚排序
      const sortedFundData = [...data].sort(
        (a, b) => new Date(a.FSRQ).getTime() - new Date(b.FSRQ).getTime()
      );
      
      const sortedHs300Data = [...filteredHs300Data].sort(
        (a, b) => new Date(a.FSRQ).getTime() - new Date(b.FSRQ).getTime()
      );

      console.log('图表处理的基金数据条数:', sortedFundData.length);
      console.log('图表处理的沪深300ETF数据条数:', sortedHs300Data.length);
      console.log('图表日期范围:', sortedFundData[0].FSRQ, '至', sortedFundData[sortedFundData.length - 1].FSRQ);

      // 提取日期和净值数据
      const dates = sortedFundData.map((item) => item.FSRQ);
      const fundNetValues = sortedFundData.map((item) => parseFloat(parseFloat(item.DWJZ).toFixed(4)));
      const fundPercentChanges = sortedFundData.map((item) => 
        item.JZZZL ? parseFloat(item.JZZZL) : null
      );
      
      // 沪深300ETF数据
      const hs300NetValues: (number | null)[] = [];
      const hs300PercentChanges: (number | null)[] = [];
      
      // 为每个基金日期找对应的沪深300ETF数据
      for (const date of dates) {
        const hs300Item = sortedHs300Data.find(item => item.FSRQ === date);
        if (hs300Item) {
          hs300NetValues.push(parseFloat(parseFloat(hs300Item.DWJZ).toFixed(4)));
          hs300PercentChanges.push(hs300Item.JZZZL ? parseFloat(hs300Item.JZZZL) : null);
        } else {
          // 如果没有找到对应日期的数据，插入null
          hs300NetValues.push(null);
          hs300PercentChanges.push(null);
        }
      }

      // 对基金和沪深300ETF数据进行基准化处理，使两条线都从1.0开始，便于比较
      const normalizedFundValues = fundNetValues.map(
        value => value / fundNetValues[0]
      );
      
      const normalizedHs300Values = hs300NetValues.map(
        (value, index) => {
          if (value === null) return null;
          // 确保找到的第一个非null值存在
          const firstValidValue = hs300NetValues.find(v => v !== null);
          return firstValidValue !== undefined ? value / firstValidValue : null;
        }
      );

      // 计算净值数据的最大值和最小值，用于设置y轴范围
      const allValues = [...normalizedFundValues, ...normalizedHs300Values.filter(v => v !== null)];
      const minValue = Math.min(...allValues);
      const maxValue = Math.max(...allValues);
      
      // 计算y轴边距，以显示更多细节（增加10%的上下边距）
      const yAxisPadding = (maxValue - minValue) * 0.1;
      const yAxisMin = Math.max(0, minValue - yAxisPadding); // 确保最小值不小于0
      const yAxisMax = maxValue + yAxisPadding;

      // 构建图表选项
      const chartOption = {
        title: {
          text: `${fundName} vs 沪深300ETF 走势对比`,
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
          formatter: function (params: any) {
            const dateStr = params[0].axisValue;
            let tooltipText = `${dateStr}<br/>`;
            
            // 本基金净值
            if (params[0]) {
              tooltipText += `${fundName}: ${fundNetValues[params[0].dataIndex].toFixed(4)}<br/>`;
              
              // 本基金日涨跌幅
              const fundChange = fundPercentChanges[params[0].dataIndex];
              if (fundChange !== null) {
                const color = fundChange >= 0 ? 'red' : 'green';
                tooltipText += `<span style="color:${color}">日涨跌幅: ${fundChange}%</span><br/>`;
              }
            }
            
            // 沪深300ETF净值
            if (params[1] && params[1].value !== null) {
              const hsIndex = params[1].dataIndex;
              const hsValue = hs300NetValues[hsIndex];
              tooltipText += `沪深300ETF: ${hsValue !== null ? hsValue.toFixed(4) : '--'}<br/>`;
              
              // 沪深300ETF日涨跌幅
              const hs300Change = hs300PercentChanges[hsIndex];
              if (hs300Change !== null) {
                const color = hs300Change >= 0 ? 'red' : 'green';
                tooltipText += `<span style="color:${color}">日涨跌幅: ${hs300Change}%</span>`;
              }
            }
            
            return tooltipText;
          }
        },
        legend: {
          data: [fundName, '沪深300ETF'],
          top: 30,
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: {
            rotate: 45,
            interval: Math.max(Math.floor(dates.length / 15), 0),
          },
        },
        yAxis: {
          type: 'value',
          name: '基准化净值',
          min: yAxisMin,
          max: yAxisMax,
          splitLine: {
            show: true,
            lineStyle: {
              type: 'dashed',
            },
          },
          axisLabel: {
            formatter: function(value: number) {
              return value.toFixed(2);
            }
          },
        },
        dataZoom: [
          {
            type: 'inside',
            start: 0,
            end: 100,
          },
          {
            type: 'slider',
            start: 0,
            end: 100,
          },
        ],
        series: [
          {
            name: fundName,
            type: 'line',
            data: normalizedFundValues,
            symbol: 'circle',
            symbolSize: 4,
            itemStyle: {
              normal: {
                color: '#1890ff',
                lineStyle: {
                  color: '#1890ff',
                  width: 2,
                },
              },
            },
          },
          {
            name: '沪深300ETF',
            type: 'line',
            data: normalizedHs300Values,
            symbol: 'circle',
            symbolSize: 4,
            itemStyle: {
              normal: {
                color: '#ff7a45',
                lineStyle: {
                  color: '#ff7a45',
                  width: 2,
                },
              },
            },
          },
        ],
        grid: {
          left: '5%',
          right: '5%',
          bottom: '15%',
          top: '15%',
          containLabel: true,
        },
      };

      setOption(chartOption);
    }
  }, [data, hs300Data, fundName]);

  if (loading || hs300Loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="h-64">
        <Empty description="暂无净值数据" />
      </Card>
    );
  }

  // 确定收益率标签的颜色
  const getFundColor = () => fundReturnRate >= 0 ? '#f50' : '#52c41a';
  const getHs300Color = () => hs300ReturnRate >= 0 ? '#f50' : '#52c41a';
  
  // 计算超额收益率
  const excessReturn = fundReturnRate - hs300ReturnRate;
  const getExcessColor = () => excessReturn >= 0 ? '#f50' : '#52c41a';

  return (
    <Card className="w-full">
      <Space direction="vertical" style={{ width: '100%', marginBottom: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <Title level={5}>收益率对比</Title>
          <Space wrap>
            <Tag color={getFundColor()}>
              {fundName}: {fundReturnRate}%
            </Tag>
            <Tag color={getHs300Color()}>
              沪深300ETF: {hs300ReturnRate}%
            </Tag>
            <Tag color={getExcessColor()}>
              超额收益: {excessReturn.toFixed(2)}%
            </Tag>
          </Space>
        </div>
      </Space>
      <ReactECharts
        option={option}
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

export default FundNetValueChart; 