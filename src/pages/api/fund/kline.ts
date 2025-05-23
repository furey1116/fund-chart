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
    const { fundCode, scale = 240, datalen = 60, startDate, endDate, check = 'false' } = req.query;

    if (!fundCode) {
      return res.status(400).json({ message: '缺少必要参数fundCode' });
    }

    // 检查模式：只查询数据库中是否已有数据，不从外部API获取
    if (check === 'true' && startDate && endDate) {
      console.log(`检查数据库中是否存在 ${fundCode} 从 ${startDate} 到 ${endDate} 的K线数据`);
      
      // 查询数据库
      const data = await prisma.fundKLineData.findMany({
        where: {
          fundCode: fundCode as string,
          scale: Number(scale),
          date: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string)
          }
        },
        orderBy: {
          date: 'asc'
        }
      });
      
      // 检查是否有足够的数据
      // 计算两个日期之间的工作日数量（简单估算，每周5个工作日）
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // 估算期望的数据条数（考虑到周末和节假日，工作日约为自然日的70%）
      const expectedRecords = Math.ceil(diffDays * 0.7);
      
      // 比较实际获取的数据条数与预期条数
      const hasEnoughData = data.length >= expectedRecords * 0.9; // 允许10%的误差
      
      // 转换数据格式以匹配前端期望的格式
      const formattedData = data.map(item => ({
        day: item.date.toISOString().split('T')[0],
        open: item.open.toString(),
        high: item.high.toString(),
        low: item.low.toString(),
        close: item.close.toString(),
        volume: item.volume.toString()
      }));
      
      return res.status(200).json({
        hasData: hasEnoughData,
        data: formattedData,
        count: data.length,
        expectedCount: expectedRecords
      });
    }

    // 正常模式：从外部API获取数据并保存到数据库
    // 处理基金代码格式
    let symbol = fundCode as string;
    if (!symbol.startsWith('sh') && !symbol.startsWith('sz')) {
      // 根据基金代码规则确定前缀(例如50开头的通常是上证基金)
      symbol = symbol.startsWith('5') ? `sh${symbol}` : `sz${symbol}`;
    }

    // 根据日期范围计算所需的数据长度
    let calculatedDataLen = parseInt(datalen as string);
    
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // 计算日期差（以天为单位）
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // 考虑周末和节假日，添加一定的余量（交易日通常比自然日少）
      // 这里预估交易日约为自然日的70%，再增加10天作为余量
      calculatedDataLen = Math.ceil(diffDays * 0.7) + 10;
      
      // 限制最小值和最大值
      calculatedDataLen = Math.max(calculatedDataLen, 60);  // 至少获取60条
      calculatedDataLen = Math.min(calculatedDataLen, 500); // 最多获取500条（避免请求过大）
      
      console.log(`根据日期范围(${startDate}至${endDate})计算的数据长度: ${calculatedDataLen}`);
    }

    // 构建API URL
    let url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=${scale}&datalen=${calculatedDataLen}`;
    
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
    // 将数据按较小批次进行分组处理
    let batchSize = 5; // 改为let，允许动态调整批量大小
    const totalItems = klineData.length;
    let processedCount = 0;
    const savedData = [];

    // 使用类型断言来避免TypeScript错误
    const prismaClient = prisma as any;

    // 按批次处理数据
    for (let i = 0; i < totalItems; i += batchSize) {
      try {
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
      } catch (error: any) {
        console.error(`处理第 ${i+1}-${Math.min(i+batchSize, totalItems)} 批数据时出错:`, error);
        
        // 如果是连接池超时错误，尝试暂停一下再继续
        if (error.code === 'P2024') {
          console.log('数据库连接池超时，暂停1秒后继续...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 减小批量大小，降低单个事务的压力
          // 注意：这会改变循环的步长，可能会导致某些数据被跳过
          // 所以我们需要回退索引以确保处理所有数据
          i = Math.max(0, i - batchSize); // 回退到上一批的起始位置
          batchSize = Math.max(1, Math.floor(batchSize / 2)); // 减半批量大小，但至少为1
          
          continue; // 跳过本次循环中剩余的代码，从头开始重试
        }
        
        // 对于其他错误，记录日志但继续处理后续批次
        console.warn(`跳过此批次，继续处理剩余数据`);
      }
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