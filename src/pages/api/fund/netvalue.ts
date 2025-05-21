import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '只支持GET请求' });
  }

  try {
    const { fundCode, startDate, endDate } = req.query;

    if (!fundCode) {
      return res.status(400).json({ message: '缺少必要参数fundCode' });
    }

    // 构建API URL (以天天基金网API为例)
    const url = `http://api.fund.eastmoney.com/f10/lsjz?callback=jQuery183013311842879481127_1591613950159&fundCode=${fundCode}&pageIndex=1&pageSize=100&startDate=${startDate || ''}&endDate=${endDate || ''}&_=1591615415941`;

    console.log(`正在获取净值数据: ${url}`);

    // 发送请求获取数据
    const response = await axios.get(url, {
      headers: {
        'Referer': 'http://fundf10.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // 从响应中提取JSON数据
    const responseText = response.data;
    const jsonText = responseText.match(/jQuery\d+_\d+\((.*)\)/)[1];
    const jsonData = JSON.parse(jsonText);

    // 检查是否成功获取数据
    if (jsonData.ErrCode !== 0) {
      return res.status(500).json({ message: `获取净值数据失败: ${jsonData.ErrMsg}` });
    }

    // 格式化数据
    const netValueData = jsonData.Data.LSJZList.map((item: any) => ({
      FSRQ: item.FSRQ, // 日期
      DWJZ: item.DWJZ, // 单位净值
      LJJZ: item.LJJZ  // 累计净值
    }));

    return res.status(200).json({ 
      message: `成功获取${netValueData.length}条净值数据`,
      data: netValueData
    });
  } catch (error: any) {
    console.error('获取净值数据失败:', error);
    return res.status(500).json({ 
      message: '获取净值数据时出错', 
      error: error.message 
    });
  }
} 