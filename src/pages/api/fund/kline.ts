import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import axios from 'axios';

// 批处理配置
const BATCH_SIZE = 5; // 每批处理数量减少
const MAX_RETRIES = 3; // 最大重试次数
const RETRY_DELAY = 2000; // 重试等待时间(毫秒)

// 辅助函数：延迟执行
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 批处理函数，带错误重试
async function processBatchWithRetry(
  batch: any[], 
  fundCode: string, 
  scale: string | string[] | number
) {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      return await prisma.$transaction(
        batch.map(item => 
          prisma.fundKLineData.upsert({
            where: {
              fundCode_date_scale: {
                fundCode: fundCode as string,
                date: new Date(item.day),
                scale: Number(scale)
              }
            },
            update: {
              open: parseFloat(item.open),
              high: parseFloat(item.high),
              low: parseFloat(item.low),
              close: parseFloat(item.close),
              volume: item.volume ? BigInt(String(item.volume).replace(/\D/g, '') || '0') : BigInt(0),
            },
            create: {
              fundCode: fundCode as string,
              date: new Date(item.day),
              scale: Number(scale),
              open: parseFloat(item.open),
              high: parseFloat(item.high),
              low: parseFloat(item.low),
              close: parseFloat(item.close),
              volume: item.volume ? BigInt(String(item.volume).replace(/\D/g, '') || '0') : BigInt(0),
            }
          })
        )
      );
    } catch (error: any) {
      retries++;
      console.error(`批处理尝试 ${retries}/${MAX_RETRIES} 失败: ${error.message}`);
      
      // 如果已达到最大重试次数，则抛出错误
      if (retries >= MAX_RETRIES) {
        throw error;
      }
      
      // 等待一段时间后重试
      await delay(RETRY_DELAY);
    }
  }
  
  // 这一行代码理论上不会执行，因为如果所有重试都失败，会在循环内抛出错误
  throw new Error('所有批处理重试都失败了');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '只支持GET请求' });
  }

  try {
    const { fundCode, scale = 240, datalen = 60, startDate, endDate } = req.query;

    if (!fundCode) {
      return res.status(400).json({ message: '缺少必要参数fundCode' });
    }

    // 处理基金代码格式
    let symbol = fundCode as string;
    if (!symbol.startsWith('sh') && !symbol.startsWith('sz')) {
      // 根据基金代码规则确定前缀(例如50开头的通常是上证基金)
      symbol = symbol.startsWith('5') ? `sh${symbol}` : `sz${symbol}`;
    }

    // 构建API URL
    let url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=${scale}&datalen=${datalen}`;
    
    if (endDate) {
      url += `&end=${endDate}`;
    }

    console.log(`正在获取K线数据: ${url}`);

    // 从新浪获取数据
    const response = await axios.get(url);
    let klineData = response.data;

    // 验证数据格式
    if (!Array.isArray(klineData)) {
      try {
        // 尝试转换为JSON (某些情况下返回的可能是字符串)
        klineData = JSON.parse(klineData);
      } catch (error: any) {
        return res.status(500).json({ message: '无法解析返回的数据', error: error.message });
      }
    }

    // 过滤日期范围(如果提供了startDate)
    if (startDate) {
      const startDateObj = new Date(startDate as string);
      klineData = klineData.filter((item: any) => new Date(item.day) >= startDateObj);
    }

    // 优化数据库操作：批量处理但减小批次大小
    const totalItems = klineData.length;
    let processedCount = 0;
    const savedData = [];
    let successCount = 0;
    let failedCount = 0;

    // 按批次处理数据，但采用串行方式，避免并发过多
    for (let i = 0; i < totalItems; i += BATCH_SIZE) {
      const batch = klineData.slice(i, i + BATCH_SIZE);
      
      try {
        const batchResults = await processBatchWithRetry(batch, fundCode as string, scale);
        savedData.push(...batchResults);
        successCount += batch.length;
      } catch (error: any) {
        console.error(`处理批次 ${i/BATCH_SIZE + 1} 失败:`, error);
        failedCount += batch.length;
      }
      
      processedCount += batch.length;
      console.log(`已处理 ${processedCount}/${totalItems} 条K线数据 (成功: ${successCount}, 失败: ${failedCount})`);
      
      // 每批次间增加短暂延迟，避免数据库连接压力过大
      if (i + BATCH_SIZE < totalItems) {
        await delay(500);
      }
    }

    return res.status(200).json({ 
      message: `成功获取并保存了${savedData.length}条K线数据，失败了${failedCount}条`,
      data: klineData
    });
  } catch (error: any) {
    console.error('获取K线数据失败:', error);
    return res.status(500).json({ 
      message: '获取或保存K线数据时出错', 
      error: error.message 
    });
  }
} 