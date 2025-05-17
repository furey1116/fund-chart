import axios from 'axios';

// 基金API基础URL
const API_BASE_URL = 'https://api.fund.eastmoney.com/f10/lsjz';
const VALUATION_API_URL = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo';

// 获取基金净值估算（实时）
export const getFundValuation = async (fundCode: string): Promise<number> => {
  try {
    const response = await axios.get(`${VALUATION_API_URL}`, {
      params: {
        FCODE: fundCode,
        deviceid: 'webkit',
        plat: 'Wap',
        product: 'EFund',
        version: '2.0.0',
      },
    });
    
    if (response.data && response.data.Expansion) {
      // 返回估值或最新净值
      return parseFloat(response.data.Expansion.GZ || response.data.Expansion.DWJZ || '1.0000');
    }
    
    return 1.0000; // 默认值
  } catch (error) {
    console.error(`获取基金估值失败 (${fundCode}):`, error);
    return 1.0000; // 默认值
  }
};

// 备用方法：获取基金最新历史净值
export const getFundLatestNetValue = async (fundCode: string): Promise<number> => {
  try {
    const response = await axios.get(`${API_BASE_URL}`, {
      params: {
        FCODE: fundCode,
        pageIndex: 1,
        pageSize: 1,
        deviceid: 'webkit',
        plat: 'Wap',
        product: 'EFund',
        version: '2.0.0',
      },
    });
    
    if (response.data && response.data.Datas && response.data.Datas.length > 0) {
      return parseFloat(response.data.Datas[0].DWJZ || '1.0000');
    }
    
    return 1.0000; // 默认值
  } catch (error) {
    console.error(`获取基金最新净值失败 (${fundCode}):`, error);
    return 1.0000; // 默认值
  }
};

// 获取基金当前价格（综合估值和历史净值）
export const getFundPrice = async (fundCode: string): Promise<number> => {
  try {
    // 首先尝试获取估值
    const valuation = await getFundValuation(fundCode);
    if (valuation !== 1.0000) {
      return valuation;
    }
    
    // 如果估值获取失败，尝试获取最新历史净值
    return await getFundLatestNetValue(fundCode);
  } catch (error) {
    console.error(`获取基金价格失败 (${fundCode}):`, error);
    return 1.0000; // 默认值
  }
};

// 批量获取多个基金的当前价格
export const getFundPrices = async (fundCodes: string[]): Promise<Record<string, number>> => {
  const result: Record<string, number> = {};
  
  try {
    // 使用Promise.all并行获取所有基金价格
    const promises = fundCodes.map(async (code) => {
      result[code] = await getFundPrice(code);
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.error('批量获取基金价格失败:', error);
    // 确保所有基金代码都有值
    fundCodes.forEach(code => {
      if (!result[code]) {
        result[code] = 1.0000;
      }
    });
  }
  
  return result;
}; 