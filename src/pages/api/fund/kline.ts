import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

// 使用单例模式，确保在多次请求之间复用同一个Prisma客户端实例
let prismaInstance: PrismaClient | null = null;

function getPrisma() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  return prismaInstance;
}

const prisma = getPrisma();

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

    // 优化数据库操作：批量处理而不是并行执行所有请求
    // 将数据按10条一批进行分组处理
    const batchSize = 10;
    const totalItems = klineData.length;
    let processedCount = 0;
    const savedData = [];

    // 使用类型断言来避免TypeScript错误
    const prismaClient = prisma as any;

    // 按批次处理数据
    for (let i = 0; i < totalItems; i += batchSize) {
      const batch = klineData.slice(i, i + batchSize);
      
      // 在一个事务中批量处理一组数据
      const batchResults = await prismaClient.$transaction(
        batch.map((item: any) => 
          prismaClient.fundKLineData.upsert({
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
      
      savedData.push(...batchResults);
      processedCount += batch.length;
      console.log(`已处理 ${processedCount}/${totalItems} 条K线数据`);
    }

    return res.status(200).json({ 
      message: `成功获取并保存了${savedData.length}条K线数据`,
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