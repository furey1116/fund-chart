import { NextRequest, NextResponse } from 'next/server';
import { FundOperation } from '@/types/fundOperation';
import { prisma } from '@/lib/prisma';

// 使用 as any 临时解决类型问题
const prismaClient = prisma as any;

// 获取用户的所有基金操作记录
export async function GET(request: NextRequest) {
  try {
    // 从URL获取用户ID
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }
    
    // 使用Prisma查询数据库
    const operations = await prismaClient.fundOperation.findMany({
      where: { userId },
      orderBy: { operationDate: 'desc' }
    });
    
    // 格式化结果
    const formattedOperations = operations.map((op: any) => ({
      id: op.id,
      userId: op.userId,
      fundCode: op.fundCode,
      fundName: op.fundName,
      operationType: op.operationType,
      operationDate: op.operationDate.toISOString().split('T')[0], // 转换为YYYY-MM-DD格式
      price: op.price,
      shares: op.shares,
      amount: op.amount,
      fee: op.fee,
      holdingShares: op.holdingShares,
      marketValue: op.marketValue,
      remark: op.remark,
      createdAt: op.createdAt.toISOString()
    }));
    
    return NextResponse.json(formattedOperations, { status: 200 });
  } catch (error) {
    console.error('获取所有基金操作记录失败:', error);
    return NextResponse.json({ error: '获取所有基金操作记录失败' }, { status: 500 });
  }
} 