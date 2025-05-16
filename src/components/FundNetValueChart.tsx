import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin, Empty, Card } from 'antd';
import { FundHistoryNetValue } from '@/api/fund';

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

  useEffect(() => {
    if (data && data.length > 0) {
      // 数据处理：按日期从早到晚排序
      const sortedData = [...data].sort(
        (a, b) => new Date(a.FSRQ).getTime() - new Date(b.FSRQ).getTime()
      );

      console.log('图表处理的数据条数:', sortedData.length);
      console.log('图表日期范围:', sortedData[0].FSRQ, '至', sortedData[sortedData.length - 1].FSRQ);

      // 提取日期和净值数据
      const dates = sortedData.map((item) => item.FSRQ);
      const netValues = sortedData.map((item) => parseFloat(parseFloat(item.DWJZ).toFixed(4)));
      const percentChanges = sortedData.map((item) => 
        item.JZZZL ? parseFloat(item.JZZZL) : null
      );

      // 计算净值数据的最大值和最小值，用于设置y轴范围
      const minValue = Math.min(...netValues);
      const maxValue = Math.max(...netValues);
      
      // 计算y轴边距，以显示更多细节（增加10%的上下边距）
      const yAxisPadding = (maxValue - minValue) * 0.1;
      const yAxisMin = Math.max(0, minValue - yAxisPadding); // 确保最小值不小于0
      const yAxisMax = maxValue + yAxisPadding;

      // 构建图表选项
      const chartOption = {
        title: {
          text: `${fundName} 净值走势`,
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
          formatter: function (params: any) {
            const dateStr = params[0].axisValue;
            let tooltipText = `${dateStr}<br/>`;
            
            // 单位净值
            if (params[0]) {
              tooltipText += `单位净值: ${params[0].data.toFixed(4)}<br/>`;
            }
            
            // 日涨跌幅
            const index = dates.indexOf(dateStr);
            if (index > -1 && percentChanges[index] !== null) {
              const change = percentChanges[index];
              const color = change >= 0 ? 'red' : 'green';
              tooltipText += `<span style="color:${color}">日涨跌幅: ${change}%</span>`;
            }
            
            return tooltipText;
          }
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
          name: '单位净值',
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
              return value.toFixed(4);
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
            name: '单位净值',
            type: 'line',
            data: netValues,
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
            markPoint: {
              data: [
                { type: 'max', name: '最高值' },
                { type: 'min', name: '最低值' },
              ],
              label: {
                formatter: function(params: any) {
                  return params.value.toFixed(4);
                }
              }
            },
          },
        ],
        grid: {
          left: '5%',
          right: '5%',
          bottom: '15%',
          containLabel: true,
        },
      };

      setOption(chartOption);
    }
  }, [data, fundName]);

  if (loading) {
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

  return (
    <Card className="w-full">
      <ReactECharts
        option={option}
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

export default FundNetValueChart; 