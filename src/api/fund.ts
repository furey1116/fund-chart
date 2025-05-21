import axios from 'axios';

// 天天基金API基础URL
// 请选择以下一种方式（取消注释）:

// 1. 使用rewrites方式（推荐）:
const API_BASE_URL = '/api/fund';

// 2. 使用API路由方式:
// const API_BASE_URL = '/api/proxy';

// 请求实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 基金搜索接口
export const searchFunds = async (keyword: string) => {
  try {
    // 确保使用与远程API相同的参数格式
    const response = await apiClient.get('/fundSearch', {
      params: {
        m: 1,
        key: keyword,
      },
    });
    
    console.log('API响应数据:', response.data); // 调试用
    
    // 检查返回的数据结构
    if (response.data && response.data.Datas && Array.isArray(response.data.Datas)) {
      return response.data.Datas;
    }
    
    return [];
  } catch (error) {
    console.error('搜索基金出错:', error);
    throw error;
  }
};

// 获取基金历史净值
export const getFundHistoryNetValue = async (
  fundCode: string,
  pageIndex: number = 1,
  pageSize: number = 200  // 增加每页数据量
) => {
  try {
    // 创建一个数组来存储所有页的数据
    let allData: FundHistoryNetValue[] = [];
    let currentPage = pageIndex;
    let hasMoreData = true;
    
    // 最多获取5页数据，防止无限循环
    const MAX_PAGES = 5;
    
    while (hasMoreData && currentPage <= MAX_PAGES) {
      const response = await apiClient.get('/fundMNHisNetList', {
        params: {
          FCODE: fundCode,
          pageIndex: currentPage,
          pageSize: pageSize,
        },
      });
      
      console.log(`获取第${currentPage}页历史净值数据:`, response.data);
      
      if (response.data && response.data.Datas && Array.isArray(response.data.Datas)) {
        const pageData = response.data.Datas;
        
        // 如果当前页没有数据，或者数据量小于pageSize，说明没有更多数据了
        if (pageData.length === 0 || pageData.length < pageSize) {
          hasMoreData = false;
        }
        
        // 添加当前页数据到结果数组
        allData = [...allData, ...pageData];
        
        // 增加页码
        currentPage++;
      } else {
        hasMoreData = false;
      }
    }
    
    return { Datas: allData };
  } catch (error) {
    console.error('获取基金历史净值出错:', error);
    throw error;
  }
};

// 获取基金详情
export const getFundDetail = async (fundCode: string) => {
  try {
    const response = await apiClient.get('/fundMNDetailInformation', {
      params: {
        FCODE: fundCode,
      },
    });
    return response.data;
  } catch (error) {
    console.error('获取基金详情出错:', error);
    throw error;
  }
};

// 获取基金涨幅
export const getFundIncrease = async (fundCode: string, range?: string) => {
  try {
    const response = await apiClient.get('/fundMNPeriodIncrease', {
      params: {
        FCODE: fundCode,
        RANGE: range,
      },
    });
    return response.data;
  } catch (error) {
    console.error('获取基金涨幅出错:', error);
    throw error;
  }
};

// 沪深300ETF基金代码
export const HS300_ETF_CODE = '510300';

// 获取沪深300ETF历史净值
export const getHS300ETFHistoryNetValue = async (
  pageIndex: number = 1,
  pageSize: number = 200
) => {
  // 使用现有的历史净值API，只是使用沪深300ETF的代码
  return getFundHistoryNetValue(HS300_ETF_CODE, pageIndex, pageSize);
};

// 计算收益率
export const calculateReturnRate = (data: FundHistoryNetValue[]): number => {
  if (!data || data.length < 2) return 0;
  
  const sortedData = [...data].sort(
    (a, b) => new Date(a.FSRQ).getTime() - new Date(b.FSRQ).getTime()
  );
  
  const firstValue = parseFloat(sortedData[0].DWJZ);
  const lastValue = parseFloat(sortedData[sortedData.length - 1].DWJZ);
  
  return parseFloat(((lastValue / firstValue - 1) * 100).toFixed(2));
};

// 导出类型定义
export interface FundSearchResult {
  _id: string;
  CODE: string;
  NAME: string;
  JP: string;
  CATEGORY: number;
  CATEGORYDESC: string;
  FundBaseInfo: {
    FCODE: string;
    SHORTNAME: string;
    FTYPE: string;
    DWJZ: number;
    FSRQ: string;
  };
}

export interface FundHistoryNetValue {
  FSRQ: string; // 日期
  DWJZ: string; // 单位净值
  JZZZL: string; // 日涨幅%
  LJJZ: string; // 累计净值
}

export interface FundDetail {
  FCODE: string; // 基金代码
  SHORTNAME: string; // 基金简称
  FULLNAME: string; // 基金全称
  FTYPE: string; // 基金类型
  ESTABDATE: string; // 成立日期
  ENDNAV: string; // 最新规模
  JJGS: string; // 基金公司
}

export interface FundIncrease {
  title: string; // 周期
  syl: string; // 涨跌幅%
  avg: string; // 同类平均%
  rank: string; // 同类排名
  sc: string; // 同类总数
} 