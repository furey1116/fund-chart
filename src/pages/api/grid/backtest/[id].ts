import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '只支持GET请求' });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ message: '缺少必要参数id' });
    }

    const prismaClient = prisma as any;
    
    // 获取回测结果及其交易记录
    const backtestResult = await prismaClient.gridBacktestResult.findUnique({
      where: { id: id as string },
      include: {
        transactions: true
      }
    });

    if (!backtestResult) {
      return res.status(404).json({ message: '未找到指定的回测结果' });
    }

    return res.status(200).json({
      message: '获取回测结果成功',
      data: backtestResult
    });
  } catch (error: any) {
    console.error('获取回测结果失败:', error);
    return res.status(500).json({ 
      message: '获取回测结果时出错', 
      error: error.message 
    });
  }
} 